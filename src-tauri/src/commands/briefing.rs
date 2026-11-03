//! Bounded receipts for displayed factual brief items. Never a model or mailbox operation.
use std::collections::BTreeMap;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use super::persistence::Db;

const KEY:&str="briefing.displayed.v1";
#[derive(Debug,Clone,Deserialize,Serialize)]
pub struct DeliveredItem { pub id:String, pub revision:String }
#[derive(Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Receipt { pub revision:String, pub delivered_at:i64, #[serde(default)] pub prepared_at:Option<i64> }
type Receipts=BTreeMap<String,Receipt>;
fn is_digest(value:&str)->bool { value.len()==64 && value.bytes().all(|c| c.is_ascii_hexdigit()) }

fn read(c:&Connection)->Result<Receipts,String> {
    let raw:Option<String>=c.query_row("SELECT value FROM settings WHERE key=?1",[KEY],|r|r.get(0))
        .optional().map_err(|_|"briefing_receipts_unavailable")?;
    let mut result:Receipts=raw.filter(|s|s.len()<=1_000_000)
        .and_then(|s|serde_json::from_str(&s).ok()).unwrap_or_default();
    result.retain(|id,r|!id.is_empty()&&id.len()<=256&&is_digest(&r.revision)&&r.delivered_at>=0);
    if result.len()>200 {return Ok(Receipts::new());}
    Ok(result)
}
fn record(c:&Connection,items:Vec<DeliveredItem>,now:i64)->Result<(),String> {
    record_prepared(c,items,now,now,3)
}
fn record_prepared(c:&Connection,items:Vec<DeliveredItem>,now:i64,prepared:i64,limit:usize)->Result<(),String>{
    if items.len()>limit||items.iter().any(|i|i.id.is_empty()||i.id.len()>256||!is_digest(&i.revision)) {
        return Err("briefing_receipt_invalid".into());
    }
    if items.is_empty(){return Ok(());}
    let mut receipts=read(c)?;
    for item in items {
        if receipts.get(&item.id).is_some_and(|r|r.prepared_at.unwrap_or(r.delivered_at)>prepared){continue;}
        receipts.insert(item.id,Receipt{revision:item.revision,delivered_at:now,prepared_at:Some(prepared)});
    }
    while receipts.len()>200 {
        let oldest=receipts.iter().min_by_key(|(_,r)|r.delivered_at).map(|(id,_)|id.clone()).unwrap();
        receipts.remove(&oldest);
    }
    let value=serde_json::to_string(&receipts).map_err(|_|"briefing_receipt_invalid")?;
    c.execute("INSERT INTO settings(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",params![KEY,value])
        .map_err(|_|"briefing_receipt_save_failed")?;
    Ok(())
}
pub(crate) fn forget_account(c:&Connection,account:&str)->Result<(),String> {
    let mut receipts=read(c)?;
    let prefix=format!("mail:{account}:");
    c.execute("DELETE FROM pending_brief_displays WHERE EXISTS (SELECT 1 FROM json_each(payload,'$.items') WHERE instr(json_extract(value,'$.id'),?1)=1)",[&prefix]).map_err(|_|"briefing_pending_cleanup_failed")?;
    receipts.retain(|id,_| !id.starts_with(&prefix) && id!="coverage:gmail" && id!="coverage:analysis");
    let value=serde_json::to_string(&receipts).map_err(|_|"briefing_receipt_invalid")?;
    c.execute("UPDATE settings SET value=?2,updated_at=CURRENT_TIMESTAMP WHERE key=?1",params![KEY,value])
        .map_err(|_|"briefing_receipt_save_failed")?;
    Ok(())
}
#[derive(Debug,Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct DisplayCursor { pub source:String, pub at:i64, pub oids:Vec<String> }
#[derive(Debug,Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct DisplayPlan { pub prepared_at:i64, pub items:Vec<DeliveredItem>, pub cursors:Vec<DisplayCursor> }

pub fn store_display(c:&Connection,id:&str,role:&str,plan:&DisplayPlan)->Result<(),String>{
    if role!="assistant" || !id.starts_with("conversation-briefing-") || plan.items.len()>12 || plan.cursors.len()>3 ||
       plan.items.iter().any(|i|i.id.is_empty() || i.id.len()>256 || !is_digest(&i.revision)) ||
       plan.cursors.iter().any(|cursor|cursor.at<0 || cursor.at>plan.prepared_at || cursor.source.len()>8192 || cursor.oids.iter().any(|oid| !matches!(oid.len(),40|64) || !oid.bytes().all(|b|b.is_ascii_hexdigit()))) {
        return Err("Invalid briefing delivery metadata".into());
    }
    let payload=serde_json::to_string(plan).map_err(|e|e.to_string())?;
    if payload.len()>131072 {return Err("Briefing delivery metadata too large".into());}
    c.execute("INSERT INTO pending_brief_displays(message_id,payload) VALUES(?,?)",params![id,payload]).map_err(|e|e.to_string())?;
    Ok(())
}

fn display(c:&mut Connection,id:&str)->Result<bool,String>{
    let tx=c.transaction().map_err(|e|e.to_string())?;
    let raw:Option<String>=tx.query_row("SELECT payload FROM pending_brief_displays WHERE message_id=?",[id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
    let Some(raw)=raw else {return Ok(false)};
    let plan:DisplayPlan=serde_json::from_str(&raw).map_err(|e|e.to_string())?;
    record_prepared(&tx,plan.items,chrono::Utc::now().timestamp_millis(),plan.prepared_at,12)?;
    for cursor in plan.cursors {
        let prior:Option<(i64,String)>=tx.query_row("SELECT observed_ms,oids FROM project_brief_cursors WHERE source=?",[&cursor.source],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(|e|e.to_string())?;
        let mut oids:std::collections::BTreeSet<String>=cursor.oids.into_iter().collect();
        if let Some((at,old))=prior {
            if at>cursor.at {continue;}
            if at==cursor.at {oids.extend(serde_json::from_str::<Vec<String>>(&old).map_err(|e|e.to_string())?);}
        }
        tx.execute("INSERT INTO project_brief_cursors(source,observed_ms,oids) VALUES(?,?,?) ON CONFLICT(source) DO UPDATE SET observed_ms=excluded.observed_ms,oids=excluded.oids",
            params![cursor.source,cursor.at,serde_json::to_string(&oids).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
    }
    tx.execute("DELETE FROM pending_brief_displays WHERE message_id=?",[id]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e|e.to_string())?;
    Ok(true)
}
#[tauri::command]
pub fn briefing_confirm_display(db:tauri::State<'_,Db>,message_id:String)->Result<bool,String>{
    let mut conn=db.0.lock().map_err(|_|"briefing_database_unavailable")?;
    display(&mut conn,&message_id)
}
#[tauri::command]
pub fn briefing_receipts(db:tauri::State<'_,Db>)->Result<Receipts,String> {
    let c=db.0.lock().map_err(|_|"briefing_database_unavailable")?;
    read(&c)
}
#[tauri::command]
pub fn briefing_record_delivery(db:tauri::State<'_,Db>,items:Vec<DeliveredItem>)->Result<(),String> {
    let c=db.0.lock().map_err(|_|"briefing_database_unavailable")?;
    record(&c,items,chrono::Utc::now().timestamp_millis())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db()->rusqlite::Connection {
        let c=rusqlite::Connection::open_in_memory().unwrap();
        c.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();c
    }
    fn item(id:&str)->DeliveredItem { DeliveredItem{id:id.into(),revision:"a".repeat(64)} }
    #[test]
    fn saved_brief_can_be_acknowledged_after_reopening_the_database() {
        let path=std::env::temp_dir().join(format!("olympus-display-{}.sqlite",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let id="conversation-briefing-restart";
        let raw=serde_json::json!({"id":id,"role":"assistant","content":"Fixture finding","timestamp":"10:00",
            "delivery":{"preparedAt":1000,"items":[{"id":"project:fixture:progress","revision":"a".repeat(64)}],
                "cursors":[{"source":"fixture","at":800,"oids":["a".repeat(40)]}]}});
        {
            let mut db=Connection::open(&path).unwrap();
            super::super::migrations::apply(&db).unwrap();
            super::super::persistence::store_messages(&mut db,"fixture-chat",vec![serde_json::from_value(raw).unwrap()]).unwrap();
            assert!(read(&db).unwrap().is_empty());
        }
        {
            let mut db=Connection::open(&path).unwrap();
            assert!(display(&mut db,id).unwrap());
            assert!(!display(&mut db,id).unwrap());
            assert_eq!(read(&db).unwrap()["project:fixture:progress"].revision,"a".repeat(64));
            assert_eq!(db.query_row("SELECT observed_ms FROM project_brief_cursors WHERE source='fixture'",[],|r|r.get::<_,i64>(0)).unwrap(),800);
        }
        std::fs::remove_file(path).unwrap();
    }
    #[test] fn corrupt_receipts_do_not_suppress_a_brief() {
        let c=db();c.execute("INSERT INTO settings(key,value) VALUES (?1,'broken')",[KEY]).unwrap();
        assert!(read(&c).unwrap().is_empty());
    }
    #[test] fn receipts_merge_without_losing_other_delivered_items() {
        let c=db();record(&c,vec![item("a")],10).unwrap();record(&c,vec![item("b")],20).unwrap();
        let saved=read(&c).unwrap();assert_eq!(saved.len(),2);assert_eq!(saved["a"].delivered_at,10);assert_eq!(saved["b"].delivered_at,20);
        record(&c,vec![DeliveredItem{id:"a".into(),revision:"b".repeat(64)}],30).unwrap();
        assert_eq!(read(&c).unwrap()["a"].revision,"b".repeat(64));
    }
    #[test] fn invalid_receipts_fail_without_overwriting_valid_history() {
        let c=db();record(&c,vec![item("valid")],10).unwrap();
        assert!(record(&c,vec![item("")],20).is_err());
        assert!(record(&c,vec![DeliveredItem{id:"x".into(),revision:"x".repeat(4001)}],20).is_err());
        assert_eq!(read(&c).unwrap().len(),1);
    }
    #[test] fn receipt_history_is_bounded_and_keeps_newest_items() {
        let c=db();for n in 0..205 {record(&c,vec![item(&format!("item-{n}"))],n).unwrap();}
        let saved=read(&c).unwrap();assert_eq!(saved.len(),200);assert!(!saved.contains_key("item-0"));assert!(saved.contains_key("item-204"));
    }
    #[test] fn receipt_storage_rejects_source_text() {
        let c=db();
        assert!(record(&c,vec![DeliveredItem{id:"mail:a:thread".into(),revision:"private source quote".into()}],10).is_err());
        assert!(read(&c).unwrap().is_empty());
    }
    #[test] fn removing_mail_cache_also_removes_account_receipts() {
        let mut c=db();
        crate::commands::gmail::store::connect(&c,"a","a@example.invalid",7).unwrap();
        record(&c,vec![item("mail:a:thread"),item("mail:b:thread"),item("coverage:gmail")],10).unwrap();
        crate::commands::gmail::store::disconnect(&c,"a").unwrap();
        crate::commands::gmail::store::remove_cache(&mut c,"a").unwrap();
        let saved=read(&c).unwrap();
        assert!(!saved.contains_key("mail:a:thread"));assert!(!saved.contains_key("coverage:gmail"));assert!(saved.contains_key("mail:b:thread"));
    }
}
