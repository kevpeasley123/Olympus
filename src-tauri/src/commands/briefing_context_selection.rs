//! Conservative candidate recall only: overlap never establishes a causal relationship.
use super::super::briefing_context::Item;
use super::Evidence;

fn terms(text:&str)->std::collections::BTreeSet<String>{
    const COMMON:&[&str]=&["about","after","before","could","would","should","their","there","these","those","which","where","please","account","accounts","payment","payments","notice","update","updated","message","instruction","instructions","operator","change","changed","email","source","subject","sender","remembered"];
    text.split(|c:char|!c.is_alphabetic()).map(str::to_lowercase).filter(|s|s.chars().count()>=5&&!COMMON.contains(&s.as_str())).collect()
}
pub fn relevant_ids(mail:&[Evidence],candidates:&[Item])->Vec<String>{
    let seeds:Vec<_>=mail.iter().filter(|e|!e.context_only&&e.kind=="mail").map(|e|{
        let text=serde_json::from_str::<serde_json::Value>(&e.text).ok().filter(|v|v.is_object()).map(|v|["sender","subject","text"].iter().filter_map(|k|v[*k].as_str()).collect::<Vec<_>>().join(" ")).unwrap_or_else(||e.text.clone());terms(&text)
    }).collect();
    let mut ranked:Vec<_>=candidates.iter().filter_map(|c|{
        let words=terms(&format!("{} {}",c.title,c.summary));
        let score=seeds.iter().map(|seed|seed.intersection(&words).count()).max().unwrap_or(0);
        (score>=2).then_some((score,c.id.clone()))
    }).collect();
    ranked.sort_by(|a,b|b.0.cmp(&a.0).then_with(||a.1.cmp(&b.1)));
    ranked.into_iter().take(2).map(|(_,id)|id).collect()
}

#[cfg(test)] mod tests {
 use super::*;
 fn item(id:&str,text:&str)->Item{Item{id:id.into(),title:text.into(),summary:text.into(),learned_at:String::new(),source_message_ids:vec!["fixture-user".into()],revision:"a".repeat(64)}}
 fn mail(text:&str)->Evidence{Evidence{id:"mail:fixture".into(),revision:"b".repeat(64),kind:"mail".into(),text:text.into(),observed_at:1,authority:super::super::Authority::SourceFact,context_only:false}}
 #[test]fn recall_requires_multiple_distinctive_terms_not_common_account_words(){
  let candidates=vec![item("relevant","Studio inspection is scheduled"),item("unrelated","Bank account notice and payment update"),item("one-word","Studio artwork is ready")];
  assert_eq!(relevant_ids(&[mail("Studio inspection report and account update")],&candidates),vec!["relevant"]);
 }
 #[test]fn recall_is_bounded_stable_and_never_uses_context_only_to_seed_it(){
  let candidates=vec![item("z","Studio inspection"),item("a","Studio inspection"),item("b","Studio inspection")];
  assert_eq!(relevant_ids(&[mail("Studio inspection")],&candidates),vec!["a","b"]);
  let mut context=mail("Studio inspection");context.context_only=true;
  assert!(relevant_ids(&[context],&candidates).is_empty());
 }
 #[test]fn repeated_single_keyword_does_not_inflate_relevance(){
  assert!(relevant_ids(&[mail("inspection inspection inspection")],&[item("x","inspection inspection inspection")]).is_empty());
 }
}
