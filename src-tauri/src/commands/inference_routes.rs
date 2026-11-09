//! Task routing independent of connector health. Configuration is not runtime proof.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LocalTask { Extraction, Briefing, Memory }

pub(crate) fn task_for(purpose:&str)->LocalTask {
    if purpose.starts_with("briefing_") {LocalTask::Briefing} else if purpose.contains("memory") {LocalTask::Memory} else {LocalTask::Extraction}
}

pub fn local_model_for(task: LocalTask, email_provider: &str, email_model: Option<&str>, brief_model: Option<&str>) -> Result<String, String> {
    if matches!(task, LocalTask::Briefing | LocalTask::Memory) {
        if let Some(model) = brief_model.filter(|m| !m.is_empty()) {
            return if super::analysis_readiness::valid_local_model(model) { Ok(model.into()) }
                else { Err("local_brief_model_not_configured".into()) };
        }
    }
    if email_provider != "ollama" { return Err("local_analysis_not_enabled".into()); }
    email_model.filter(|m| super::analysis_readiness::valid_local_model(m))
        .map(str::to_owned).ok_or_else(|| "local_email_model_not_configured".into())
}

pub fn configured_local_model(task: LocalTask) -> Result<String, String> {
    if super::acceptance::active() { return Err("analysis_waiting:acceptance".into()); }
    local_model_for(task,
        &std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_| "openai".into()),
        std::env::var("OLYMPUS_EMAIL_MODEL").ok().as_deref(),
        if task == LocalTask::Memory { std::env::var("OLYMPUS_MEMORY_MODEL").ok().or_else(||std::env::var("OLYMPUS_BRIEF_MODEL").ok()) } else { std::env::var("OLYMPUS_BRIEF_MODEL").ok() }.as_deref())
}

/// Device choices are task-specific; model inheritance does not inherit a device.
pub(crate) fn local_device_for<'a>(task:LocalTask,global:Option<&'a str>,email:Option<&'a str>,brief:Option<&'a str>,memory:Option<&'a str>)->Result<&'a str,String>{
    let selected=match task {LocalTask::Extraction=>email,LocalTask::Briefing=>brief,LocalTask::Memory=>memory};
    match selected.or(global).unwrap_or("auto") {value @ ("auto"|"cpu")=>Ok(value),_=>Err("local_analysis_device_invalid".into())}
}

pub(crate) fn configured_local_device(task:LocalTask)->Result<String,String>{
    fn read(key:&str)->Result<Option<String>,String>{
        match std::env::var(key) {
            Ok(value)=>Ok(Some(value)),Err(std::env::VarError::NotPresent)=>Ok(None),
            Err(_)=>Err("local_analysis_device_invalid".into()),
        }
    }
    let key=match task {LocalTask::Extraction=>"OLYMPUS_EMAIL_DEVICE",LocalTask::Briefing=>"OLYMPUS_BRIEF_DEVICE",LocalTask::Memory=>"OLYMPUS_MEMORY_DEVICE"};
    let selected=read(key)?;
    let global=if selected.is_none(){read("OLYMPUS_LOCAL_DEVICE")?}else{None};
    let (email,brief,memory)=match task {
        LocalTask::Extraction=>(selected.as_deref(),None,None),
        LocalTask::Briefing=>(None,selected.as_deref(),None),
        LocalTask::Memory=>(None,None,selected.as_deref()),
    };
    local_device_for(task,global.as_deref(),email,brief,memory).map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn task_devices_override_global_without_cross_task_inheritance() {
        assert_eq!(local_device_for(LocalTask::Extraction,Some("cpu"),Some("auto"),Some("cpu"),None).unwrap(),"auto");
        assert_eq!(local_device_for(LocalTask::Briefing,Some("auto"),Some("auto"),Some("cpu"),None).unwrap(),"cpu");
        assert_eq!(local_device_for(LocalTask::Memory,Some("auto"),Some("cpu"),Some("cpu"),None).unwrap(),"auto");
        assert_eq!(local_device_for(LocalTask::Memory,Some("auto"),None,None,Some("cpu")).unwrap(),"cpu");
    }
    #[test]
    fn device_defaults_and_global_compatibility_are_preserved() {
        for task in [LocalTask::Extraction,LocalTask::Briefing,LocalTask::Memory] {
            assert_eq!(local_device_for(task,None,None,None,None).unwrap(),"auto");
            assert_eq!(local_device_for(task,Some("cpu"),None,None,None).unwrap(),"cpu");
            assert!(local_device_for(task,Some("gpu"),None,None,None).is_err());
        }
    }
    #[test]
    fn invalid_explicit_device_never_falls_back() {
        for invalid in ["", "gpu", "CPU", " auto", "remote"] {
            assert!(local_device_for(LocalTask::Extraction,Some("auto"),Some(invalid),None,None).is_err());
            assert!(local_device_for(LocalTask::Briefing,Some("auto"),None,Some(invalid),None).is_err());
            assert!(local_device_for(LocalTask::Memory,Some("auto"),None,None,Some(invalid)).is_err());
        }
        assert_eq!(local_device_for(LocalTask::Extraction,Some("invalid"),Some("auto"),None,None).unwrap(),"auto");
    }
    #[test]
    fn memory_transport_and_router_use_the_same_mail_independent_task() {
        assert_eq!(task_for("memory_contribution"),LocalTask::Memory);
        assert_eq!(task_for("briefing_investigation"),LocalTask::Briefing);
        assert_eq!(task_for("situation_discovery"),LocalTask::Extraction);
    }
    #[test]
    fn memory_model_is_independent_of_mail_and_rejects_cloud_overrides() {
        assert_eq!(local_model_for(LocalTask::Memory,"openai",None,Some("qwen3:14b")).unwrap(),"qwen3:14b");
        assert!(local_model_for(LocalTask::Memory,"ollama",Some("qwen3:8b"),Some("cloud:model")).is_err());
        assert!(local_model_for(LocalTask::Memory,"openai",None,None).is_err());
    }
    #[test]
    fn briefing_override_is_independent_of_email_provider() {
        assert_eq!(local_model_for(LocalTask::Briefing, "openai", None, Some("qwen3:14b")).unwrap(), "qwen3:14b");
    }
    #[test]
    fn extraction_does_not_borrow_the_briefing_route() {
        assert!(local_model_for(LocalTask::Extraction, "openai", None, Some("qwen3:14b")).is_err());
        assert_eq!(local_model_for(LocalTask::Extraction, "ollama", Some("qwen3:8b"), Some("qwen3:14b")).unwrap(), "qwen3:8b");
    }
    #[test]
    fn briefing_inheritance_requires_local_email_configuration() {
        assert_eq!(local_model_for(LocalTask::Briefing, "ollama", Some("qwen3:8b"), None).unwrap(), "qwen3:8b");
        assert!(local_model_for(LocalTask::Briefing, "openai", Some("qwen3:8b"), None).is_err());
    }
    #[test]
    fn invalid_explicit_override_never_falls_back() {
        for model in ["cloud:model", "bad?model", "   "] {
            assert!(local_model_for(LocalTask::Briefing, "ollama", Some("qwen3:8b"), Some(model)).is_err());
        }
    }
}
