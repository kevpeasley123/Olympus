//! Read-only inspection of compiled definitions and original, account-owned run snapshots.
use super::*;

pub fn descriptor() -> Value {
    json!({
        "id":v3::GRAPH,"name":"Communication Intelligence","version":4,
        "purpose":"Interpret a bounded selection of cached correspondence and suggest what deserves review.",
        "trigger":"Explicit Analyze / Refresh intelligence",
        "completion":"Selected evidence passed contract, identity and freshness checks; generated findings were published. No obligation was completed or approved.",
        "recovery":"A failed or interrupted run retains evidence. Explicit retry creates a new run; no automatic retry or provider switch.",
        "allowedCapabilities":["read scoped cached mail","read bounded project metadata","invoke PRIMARY reasoning","record generated operational evidence"],
        "prohibitedEffects":["send email","create tasks or commitments","change projects","promote memory","rewrite skills or workflows"],
        "execution":"Sequential fixed runner. Project suggestions inside assessment are deterministic context preparation, not parallel agents.",
        "loop":"At most three assessment batch requests; only threads with newly expanded cached evidence are reassessed.",
        "definition":v3::graph(),"skills":skill::registry(),
        "nodeSkills":{"assess":["communication-assess@2","project-relevance@2"],"project":["project-relevance@2"]}
    })
}

/// New snapshots must be self-contained; a changed registry cannot supply missing bindings.
pub fn validate_descriptor(value: &Value) -> Result<(), String> {
    let nodes: Vec<GraphNode> = serde_json::from_value(value["definition"].clone()).map_err(|_| "workflow_definition_invalid")?;
    let contracts: Vec<crate::commands::workflow::SkillContract> = serde_json::from_value(value["skills"].clone()).map_err(|_| "workflow_contract_invalid")?;
    let keys: BTreeSet<String> = contracts.iter().map(|s| format!("{}@{}", s.id, s.version)).collect();
    if keys.len() != contracts.len() { return Err("workflow_duplicate_skill".into()); }
    let ids: BTreeSet<_> = nodes.iter().map(|n| n.id.as_str()).collect();
    if ids.len() != nodes.len() { return Err("workflow_duplicate_node".into()); }
    let mut done = BTreeSet::new();
    for node in &nodes {
        if node.depends_on.iter().any(|d| !done.contains(d)) { return Err("workflow_dependency_invalid".into()); }
        if node.kind.contains('@') && !keys.contains(&node.kind) { return Err("workflow_skill_missing".into()); }
        done.insert(node.id.clone());
    }
    for (node, bindings) in value["nodeSkills"].as_object().ok_or("workflow_bindings_invalid")? {
        if !ids.contains(node.as_str()) { return Err("workflow_binding_node_missing".into()); }
        for key in bindings.as_array().ok_or("workflow_bindings_invalid")? {
            if !key.as_str().is_some_and(|s| keys.contains(s)) { return Err("workflow_skill_missing".into()); }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn communication_workflow() -> Result<Value, String> {
    let value = descriptor();
    validate_descriptor(&value)?;
    Ok(value)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InspectRequest {
    pub id: String,
    pub after: Option<i64>,
    pub through: Option<i64>,
}

#[tauri::command]
pub fn inspect_communication_run(db: State<'_, Db>, request: InspectRequest) -> Result<Value, String> {
    let c = db.0.lock().map_err(|_| "database_busy")?;
    inspect(&c, request)
}

fn inspect(c: &Connection, request: InspectRequest) -> Result<Value, String> {
    let after = request.after.unwrap_or(0);
    if request.id.is_empty() || request.id.len() > 80 || after < 0 || request.through.is_some_and(|v| v < after) {
        return Err("inspection_request_invalid".into());
    }
    authorized(c, &request.id)?;
    let raw: String = c.query_row("SELECT payload_json FROM communication_runs WHERE id=?1", [&request.id], |r| r.get(0)).map_err(err)?;
    let run: Value = serde_json::from_str(&raw).map_err(|_| "inspection_saved_record_invalid")?;
    if !matches!(run["graph"].as_str(), Some("communication-intelligence/v1" | "communication-intelligence/v2" | "communication-intelligence/v3" | "communication-intelligence/v4")) {
        return Err("inspection_workflow_unsupported".into());
    }
    let latest: i64 = c.query_row("SELECT COALESCE(MAX(sequence),0) FROM communication_events WHERE run_id=?1", [&request.id], |r| r.get(0)).map_err(err)?;
    let through = request.through.unwrap_or(latest).min(latest);
    let mut q = c.prepare("SELECT sequence,node,state,at,result_json FROM communication_events WHERE run_id=?1 AND sequence>?2 AND sequence<=?3 ORDER BY sequence LIMIT 101").map_err(err)?;
    let mut events = q.query_map(params![request.id, after, through], |r| Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?))).map_err(err)?
        .map(|r| { let (sequence,node,state,at,raw)=r.map_err(err)?; let result=serde_json::from_str::<Value>(&raw).map_err(|_|"inspection_saved_event_invalid".to_string())?; Ok(json!({"sequence":sequence,"node":node,"state":state,"at":at,"result":result})) }).collect::<Result<Vec<Value>,String>>()?;
    let has_more=events.len()>100;
    events.truncate(100);
    let next=events.last().and_then(|e|e["sequence"].as_i64()).unwrap_or(after);
    // Return the saved payload verbatim. Do not enrich old records with today's contracts.
    Ok(json!({"run":run,"events":events,"through":through,"next":next,"hasMore":has_more}))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let c=Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../../schema.sql")).unwrap();
        store::connect(&c,"fixture","operator@example.invalid",7).unwrap();
        c
    }
    fn save(c:&Connection,id:&str,account:&str,value:&Value) {
        c.execute("INSERT INTO communication_runs VALUES(?1,?2,7,'completed',?3)",params![id,account,value.to_string()]).unwrap();
    }
    fn request(id:&str)->InspectRequest {InspectRequest{id:id.into(),after:None,through:None}}
    #[test]
    fn definitions_bind_real_skills_and_reject_missing_or_reordered_dependencies() {
        let original=descriptor();validate_descriptor(&original).unwrap();
        let mut bad=original.clone();bad["skills"]=json!([]);assert!(validate_descriptor(&bad).is_err());
        let mut bad=original;bad["definition"][0]["dependsOn"]=json!(["synthesize"]);assert!(validate_descriptor(&bad).is_err());
    }
    #[test]
    fn history_is_verbatim_scoped_and_read_only() {
        let c=db();let old=json!({"id":"old","graph":"communication-intelligence/v2","skills":[{"id":"communication-assess","version":1}],"definition":[{"id":"assess","kind":"communication-assess@1"}]});
        save(&c,"old","fixture",&old);save(&c,"foreign","other",&old);
        let changes=c.total_changes();
        let inspected=inspect(&c,request("old")).unwrap();assert_eq!(inspected["run"],old);assert_eq!(c.total_changes(),changes);
        assert!(inspect(&c,request("foreign")).is_err());
        c.execute("UPDATE gmail_accounts SET enabled=0",[]).unwrap();assert!(inspect(&c,request("old")).is_err());
    }
    #[test]
    fn pagination_is_ordered_and_does_not_silently_drop_events() {
        let c=db();save(&c,"many","fixture",&json!({"graph":"communication-intelligence/v3"}));
        for _ in 0..205 {event(&c,"many","assess","iteration",json!({})).unwrap();}
        let first=inspect(&c,request("many")).unwrap();assert_eq!(first["events"].as_array().unwrap().len(),100);assert_eq!(first["hasMore"],true);
        event(&c,"many","feedback","recorded",json!({})).unwrap();
        let mut cursor=first["next"].as_i64().unwrap();let through=first["through"].as_i64();let mut count=100;
        loop {let page=inspect(&c,InspectRequest{id:"many".into(),after:Some(cursor),through}).unwrap();for e in page["events"].as_array().unwrap(){let n=e["sequence"].as_i64().unwrap();assert!(n>cursor);cursor=n;count+=1;}if page["hasMore"]==false {break;}}
        assert_eq!(count,205);assert_eq!(inspect(&c,request("many")).unwrap()["through"],206);
    }
}
