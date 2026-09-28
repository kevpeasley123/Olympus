//! Local file access is resolved from the current account's saved source registry.
use super::*;
use std::path::{Path,PathBuf};
use tauri_plugin_opener::OpenerExt;
fn source_path(c:&Connection,account_id:&str,situation_id:&str,source_id:&str)->Result<PathBuf,String>{
 let raw:String=c.query_row("SELECT payload_json FROM communication_situation_contexts WHERE account_id=?1 AND situation_id=?2",params![account_id,situation_id],|r|r.get(0)).map_err(|_|"document_context_unavailable")?;
 let context:Value=serde_json::from_str(&raw).map_err(|_|"document_context_invalid")?;
 let source=context["sources"].as_array().and_then(|s|s.iter().find(|s|s["id"].as_str()==Some(source_id))).ok_or("document_source_unknown")?;
 let raw=source["path"].as_str().ok_or("document_path_missing")?;
 // Never resolve browser-supplied paths, URLs, network shares or relative paths.
 if raw.starts_with("\\\\")||raw.starts_with("//")||raw.contains("://"){return Err("document_path_not_local".into())}
 let path=PathBuf::from(raw);
 if !path.is_absolute(){return Err("document_path_not_absolute".into())}
 Ok(path)
}
fn openable(path:&Path)->bool{
 matches!(path.extension().and_then(|x|x.to_str()).unwrap_or("").to_ascii_lowercase().as_str(),"pdf"|"png"|"jpg"|"jpeg"|"webp"|"gif"|"txt"|"md"|"docx"|"xlsx"|"pptx"|"zip")
}
#[tauri::command]
pub fn situation_document_status(db:State<'_,Db>,situation_id:String)->Result<Value,String>{
 let c=db.0.lock().map_err(|_|"gmail_database_unavailable")?;let a=account(&c)?;
 let raw:String=c.query_row("SELECT payload_json FROM communication_situation_contexts WHERE account_id=?1 AND situation_id=?2",params![a.id,situation_id],|r|r.get(0)).map_err(|_|"document_context_unavailable")?;
 let context:Value=serde_json::from_str(&raw).map_err(|_|"document_context_invalid")?;
 let entries=context["sources"].as_array().ok_or("document_sources_invalid")?;
 Ok(Value::Array(entries.iter().filter_map(|s|s["id"].as_str()).map(|id|{
  let path=source_path(&c,&a.id,&situation_id,id).ok();let available=path.as_ref().is_some_and(|p|p.is_file());
  json!({"id":id,"available":available,"openable":available&&path.as_ref().is_some_and(|p|openable(p))})
 }).collect()))
}
#[tauri::command]
pub fn situation_document_open(app:tauri::AppHandle,db:State<'_,Db>,situation_id:String,source_id:String)->Result<(),String>{
 let c=db.0.lock().map_err(|_|"gmail_database_unavailable")?;let a=account(&c)?;
 let path=source_path(&c,&a.id,&situation_id,&source_id)?;
 if !path.is_file(){return Err("document_file_unavailable".into())}
 if !openable(&path){return Err("document_type_not_supported".into())}
 app.opener().open_path(path.to_string_lossy().as_ref(),None::<&str>).map_err(|_|"document_open_failed".into())
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn registry_is_account_scoped(){let db=super::super::tests::database();let c=db.0.lock().unwrap();
 c.execute("INSERT INTO communication_situation_contexts VALUES('fixture','home',?1,'now')",[json!({"sources":[{"id":"doc","path":std::env::temp_dir().join("example.pdf") }]}).to_string()]).unwrap();
 assert!(source_path(&c,"fixture","home","doc").is_ok());assert!(source_path(&c,"other","home","doc").is_err());assert!(source_path(&c,"fixture","home","unknown").is_err());}
 #[test]fn rejects_nonlocal_registry_paths(){let db=super::super::tests::database();let c=db.0.lock().unwrap();for path in ["relative.pdf","https://example.invalid/a.pdf","//server/share/a.pdf"]{c.execute("INSERT OR REPLACE INTO communication_situation_contexts VALUES('fixture','home',?1,'now')",[json!({"sources":[{"id":"doc","path":path}]}).to_string()]).unwrap();assert!(source_path(&c,"fixture","home","doc").is_err());}}
 #[test]fn only_document_types_are_openable(){for path in ["a.exe","a.cmd","a.html","a.svg","a.url","a.lnk","a.docm"]{assert!(!openable(Path::new(path)));}for path in ["a.PDF","a.docx","a.png","a.zip"]{assert!(openable(Path::new(path)));}}
}
