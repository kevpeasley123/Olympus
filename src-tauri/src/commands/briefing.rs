//! Bounded receipts for displayed factual brief items. Never a model or mailbox operation.
use std::collections::BTreeMap;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use super::persistence::Db;

const KEY:&str="briefing.displayed.v1";
#[derive(Deserialize)]
pub struct DeliveredItem { pub id:String, pub revision:String }
#[derive(Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Receipt { pub revision:String, pub delivered_at:i64 }
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
    if items.len()>3||items.iter().any(|i|i.id.is_empty()||i.id.len()>256||!is_digest(&i.revision)) {
        return Err("briefing_receipt_invalid".into());
    }
    if items.is_empty(){return Ok(());}
    let mut receipts=read(c)?;
    for item in items {receipts.insert(item.id,Receipt{revision:item.revision,delivered_at:now});}
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
    receipts.retain(|id,_| !id.starts_with(&prefix) && id!="coverage:gmail" && id!="coverage:analysis");
    let value=serde_json::to_string(&receipts).map_err(|_|"briefing_receipt_invalid")?;
    c.execute("UPDATE settings SET value=?2,updated_at=CURRENT_TIMESTAMP WHERE key=?1",params![KEY,value])
        .map_err(|_|"briefing_receipt_save_failed")?;
    Ok(())
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
