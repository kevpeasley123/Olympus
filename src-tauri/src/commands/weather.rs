use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use chrono::Local;
use once_cell::sync::Lazy;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

static WEATHER_CACHE: Lazy<Mutex<HashMap<String, CachedWeatherResponse>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
const WEATHER_CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Debug, Deserialize)]
pub struct WeatherRequest {
    pub latitude: f64,
    pub longitude: f64,
    #[serde(rename = "locationLabel")]
    pub location_label: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct WeatherResponse {
    #[serde(rename = "tempF")]
    pub temp_f: String,
    pub humidity: String,
    #[serde(rename = "windMph")]
    pub wind_mph: String,
    #[serde(rename = "conditionLabel")]
    pub condition_label: String,
    #[serde(rename = "locationLabel")]
    pub location_label: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Clone)]
struct CachedWeatherResponse {
    payload: WeatherResponse,
    fetched_at: Instant,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    current: OpenMeteoCurrent,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoCurrent {
    temperature_2m: f64,
    relative_humidity_2m: f64,
    wind_speed_10m: f64,
    weather_code: i32,
}

#[tauri::command]
pub fn fetch_weather(request: WeatherRequest) -> Result<WeatherResponse, String> {
    let cache_key = format!(
        "{:.4}:{:.4}:{}",
        request.latitude, request.longitude, request.location_label
    );

    if let Some(cached) = WEATHER_CACHE
        .lock()
        .map_err(|error| error.to_string())?
        .get(&cache_key)
        .cloned()
        .filter(|entry| entry.fetched_at.elapsed() < WEATHER_CACHE_TTL)
    {
        return Ok(cached.payload);
    }

    let client = Client::new();
    let response = client
        .get("https://api.open-meteo.com/v1/forecast")
        .query(&[
            ("latitude", request.latitude.to_string()),
            ("longitude", request.longitude.to_string()),
            (
                "current",
                "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code".to_string(),
            ),
            ("temperature_unit", "fahrenheit".to_string()),
            ("wind_speed_unit", "mph".to_string()),
        ])
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| error.to_string())?
        .json::<OpenMeteoResponse>()
        .map_err(|error| error.to_string())?;

    let payload = WeatherResponse {
        temp_f: format!("{} F", response.current.temperature_2m.round() as i32),
        humidity: format!("{}%", response.current.relative_humidity_2m.round() as i32),
        wind_mph: format!("{} mph", response.current.wind_speed_10m.round() as i32),
        condition_label: weather_code_to_label(response.current.weather_code).to_string(),
        location_label: request.location_label,
        updated_at: Local::now().format("%-I:%M %p").to_string(),
    };

    WEATHER_CACHE
        .lock()
        .map_err(|error| error.to_string())?
        .insert(
            cache_key,
            CachedWeatherResponse {
                payload: payload.clone(),
                fetched_at: Instant::now(),
            },
        );

    Ok(payload)
}

fn weather_code_to_label(code: i32) -> &'static str {
    match code {
        0 => "Clear",
        1 | 2 => "Partly cloudy",
        3 => "Overcast",
        45 | 48 => "Fog",
        51 | 53 | 55 => "Drizzle",
        56 | 57 => "Freezing drizzle",
        61 | 63 | 65 => "Rain",
        66 | 67 => "Freezing rain",
        71 | 73 | 75 => "Snow",
        77 => "Snow grains",
        80 | 81 | 82 => "Rain showers",
        85 | 86 => "Snow showers",
        95 => "Thunderstorm",
        96 | 99 => "Thunderstorm with hail",
        _ => "Conditions unavailable",
    }
}
