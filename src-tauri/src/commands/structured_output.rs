//! Bounded validation of the JSON Schema subset used by Olympus structured jobs.
//! This validates shape and declared bounds, never semantic truth or execution authority.
use serde_json::Value;

const TYPES: &[&str] = &[
    "object", "array", "string", "integer", "number", "boolean", "null",
];
fn schema_ok(schema: &Value, depth: usize) -> bool {
    if depth > 32 {
        return false;
    }
    if schema.is_boolean() {
        return true;
    }
    let Some(s) = schema.as_object() else {
        return false;
    };
    if s.keys().any(|key| {
        !matches!(
            key.as_str(),
            "type"
                | "properties"
                | "required"
                | "additionalProperties"
                | "items"
                | "enum"
                | "anyOf"
                | "minLength"
                | "maxLength"
                | "minItems"
                | "maxItems"
                | "minimum"
                | "maximum"
                | "description"
                | "title"
        )
    }) {
        return false;
    }
    for (key, value) in s {
        let valid = match key.as_str() {
            "type" => {
                value.as_str().is_some_and(|t| TYPES.contains(&t))
                    || value.as_array().is_some_and(|a| {
                        !a.is_empty()
                            && a.iter()
                                .all(|t| t.as_str().is_some_and(|t| TYPES.contains(&t)))
                    })
            }
            "properties" => value
                .as_object()
                .is_some_and(|p| p.values().all(|v| schema_ok(v, depth + 1))),
            "items" | "additionalProperties" => schema_ok(value, depth + 1),
            "required" => value
                .as_array()
                .is_some_and(|a| a.iter().all(Value::is_string)),
            "enum" => value.as_array().is_some_and(|a| !a.is_empty()),
            "anyOf" => value.as_array().is_some_and(|a| {
                !a.is_empty() && a.len() <= 16 && a.iter().all(|v| schema_ok(v, depth + 1))
            }),
            "minLength" | "maxLength" | "minItems" | "maxItems" => value.is_u64(),
            "minimum" | "maximum" => value.is_number(),
            "title" | "description" => value.is_string(),
            _ => false,
        };
        if !valid {
            return false;
        }
    }
    true
}
fn is_type(value: &Value, kind: &str) -> bool {
    match kind {
        "object" => value.is_object(),
        "array" => value.is_array(),
        "string" => value.is_string(),
        "integer" => value.is_i64() || value.is_u64(),
        "number" => value.is_number(),
        "boolean" => value.is_boolean(),
        "null" => value.is_null(),
        _ => false,
    }
}
fn matches(value: &Value, schema: &Value, depth: usize) -> bool {
    if depth > 32 {
        return false;
    }
    if let Some(allowed) = schema.as_bool() {
        return allowed;
    }
    if let Some(types) = schema.get("type") {
        if !types.as_str().is_some_and(|t| is_type(value, t))
            && !types
                .as_array()
                .is_some_and(|ts| ts.iter().any(|t| is_type(value, t.as_str().unwrap_or(""))))
        {
            return false;
        }
    }
    if schema
        .get("enum")
        .is_some_and(|e| !e.as_array().unwrap().contains(value))
    {
        return false;
    }
    if schema.get("anyOf").is_some_and(|a| {
        !a.as_array()
            .unwrap()
            .iter()
            .any(|s| matches(value, s, depth + 1))
    }) {
        return false;
    }
    if let Some(object) = value.as_object() {
        if schema["required"]
            .as_array()
            .is_some_and(|r| r.iter().any(|k| !object.contains_key(k.as_str().unwrap())))
        {
            return false;
        }
        for (key, value) in object {
            if let Some(property) = schema["properties"].get(key) {
                if !matches(value, property, depth + 1) {
                    return false;
                }
            } else if let Some(additional) = schema.get("additionalProperties") {
                if !matches(value, additional, depth + 1) {
                    return false;
                }
            }
        }
    }
    if let Some(array) = value.as_array() {
        if schema["minItems"]
            .as_u64()
            .is_some_and(|n| array.len() < (n as usize))
            || schema["maxItems"]
                .as_u64()
                .is_some_and(|n| array.len() > (n as usize))
        {
            return false;
        }
        if let Some(items) = schema.get("items") {
            if array.iter().any(|v| !matches(v, items, depth + 1)) {
                return false;
            }
        }
    }
    if let Some(text) = value.as_str() {
        let size = text.chars().count() as u64;
        if schema["minLength"].as_u64().is_some_and(|n| size < n)
            || schema["maxLength"].as_u64().is_some_and(|n| size > n)
        {
            return false;
        }
    }
    if let Some(number) = value.as_f64() {
        if schema["minimum"].as_f64().is_some_and(|n| number < n)
            || schema["maximum"].as_f64().is_some_and(|n| number > n)
        {
            return false;
        }
    }
    true
}
pub(crate) fn validate(value: &Value, schema: &Value) -> Result<(), String> {
    if schema.to_string().len() > 65_536 || !schema_ok(schema, 0) {
        return Err("job_invalid_schema".into());
    }
    if !matches(value, schema, 0) {
        return Err("job_invalid_output".into());
    }
    Ok(())
}
pub(crate) fn extract_object(text: &str, schema: &Value) -> Result<String, String> {
    if text.len() > 262_144 {
        return Err("job_output_too_large".into());
    }
    let candidate = match (text.find('{'), text.rfind('}')) {
        (Some(start), Some(end)) if start < end => &text[start..=end],
        _ => return Err("job_invalid_output".into()),
    };
    let value: Value = serde_json::from_str(candidate).map_err(|_| "job_invalid_output")?;
    if !value.is_object() {
        return Err("job_invalid_output".into());
    }
    validate(&value, schema)?;
    serde_json::to_string(&value).map_err(|_| "job_invalid_output".into())
}
