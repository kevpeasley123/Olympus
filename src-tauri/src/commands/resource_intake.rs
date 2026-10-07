//! Local reusable analysis instructions. No execution or network access.
use super::persistence::Db;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ResourceSkill { pub id:String, pub name:String, pub instructions:String, pub created_at:String }
pub fn read_skills(c:&Connection)->Result<Vec<ResourceSkill>,String>{
 let mut q=c.prepare("SELECT id,name,instructions,created_at FROM resource_skills ORDER BY created_at DESC,id").map_err(|e|e.to_string())?;
 let rows=q.query_map([],|r|Ok(ResourceSkill{id:r.get(0)?,name:r.get(1)?,instructions:r.get(2)?,created_at:r.get(3)?})).map_err(|e|e.to_string())?;
 rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
}
#[tauri::command]
pub fn resource_skills(db:State<Db>)->Result<Vec<ResourceSkill>,String>{let c=db.0.lock().map_err(|e|e.to_string())?;read_skills(&c)}
fn insert_skill(c:&Connection,name:String,instructions:String)->Result<ResourceSkill,String>{
 if name.trim().is_empty()||name.len()>160||instructions.trim().is_empty()||instructions.len()>20_000{return Err("Provide a name (up to 160 bytes) and instructions (up to 20 KB).".into())}
 let count:i64=c.query_row("SELECT count(*) FROM resource_skills",[],|r|r.get(0)).map_err(|e|e.to_string())?;
 if count>=100{return Err("The resource skill library is limited to 100 entries.".into())}
 let mut bytes=[0u8;16];getrandom::getrandom(&mut bytes).map_err(|_|"Randomness unavailable")?;
 let s=ResourceSkill{id:format!("resource-skill-{}",bytes.iter().map(|b|format!("{b:02x}")).collect::<String>()),name:name.trim().into(),instructions:instructions.trim().into(),created_at:chrono::Utc::now().to_rfc3339()};
 c.execute("INSERT INTO resource_skills(id,name,instructions,created_at) VALUES(?1,?2,?3,?4)",params![s.id,s.name,s.instructions,s.created_at]).map_err(|_|"A skill with that name already exists, or the library could not be written.".to_string())?;Ok(s)
}
#[tauri::command]
pub fn add_resource_skill(db:State<Db>,name:String,instructions:String)->Result<ResourceSkill,String>{let c=db.0.lock().map_err(|e|e.to_string())?;insert_skill(&c,name,instructions)}
#[cfg(test)] mod tests {
 use super::*;
 #[test] fn skills_persist_and_duplicate_names_are_rejected(){let c=Connection::open_in_memory().unwrap();c.execute_batch(include_str!("../../schema.sql")).unwrap();let s=insert_skill(&c,"Extract decisions".into(),"Find decisions and evidence.".into()).unwrap();assert_eq!(read_skills(&c).unwrap()[0].id,s.id);assert!(insert_skill(&c,"extract DECISIONS".into(),"Different".into()).is_err());}
 #[test] fn no_empty_or_oversize_skill(){let c=Connection::open_in_memory().unwrap();c.execute_batch(include_str!("../../schema.sql")).unwrap();assert!(insert_skill(&c," ".into(),"a".into()).is_err());assert!(insert_skill(&c,"x".into(),"a".repeat(20001)).is_err());}
}
