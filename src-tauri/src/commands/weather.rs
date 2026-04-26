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
const TUCSON_LATITUDE: f64 = 32.2226;
const TUCSON_LONGITUDE: f64 = -110.9747;
const TUCSON_LABEL: &str = "Tucson, AZ";

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
    pub forecast: Vec<ForecastDay>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ForecastDay {
    #[serde(rename = "dayLabel")]
    pub day_label: String,
    #[serde(rename = "weatherCode")]
    pub weather_code: i32,
    pub high: String,
    pub low: String,
    #[serde(rename = "isToday")]
    pub is_today: bool,
}

#[derive(Clone)]
struct CachedWeatherResponse {
    payload: WeatherResponse,
    fetched_at: Instant,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    current: OpenMeteoCurrent,
    daily: OpenMeteoDaily,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoCurrent {
    temperature_2m: f64,
    relative_humidity_2m: f64,
    wind_speed_10m: f64,
    weather_code: i32,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoDaily {
    time: Vec<String>,
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    weather_code: Vec<i32>,
}

#[tauri::command]
pub fn fetch_weather() -> Result<WeatherResponse, String> {
    let cache_key = format!("{TUCSON_LATITUDE:.4}:{TUCSON_LONGITUDE:.4}:{TUCSON_LABEL}");

    if let Some(cached) = WEATHER_CACHE
        .lock()
        .map_err(|error| error.to_string())?
        .get(&cache_key)
        .cloned()
        .filter(|entry| entry.fetched_at.elapsed() < WEATHER_CACHE_TTL)
    {
        eprintln!("[Olympus::Weather] serving cached Tucson forecast");
        return Ok(cached.payload);
    }

    let client = Client::new();
    let response = client
        .get("https://api.open-meteo.com/v1/forecast")
        .query(&[
            ("latitude", TUCSON_LATITUDE.to_string()),
            ("longitude", TUCSON_LONGITUDE.to_string()),
            (
                "current",
                "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code".to_string(),
            ),
            (
                "daily",
                "temperature_2m_max,temperature_2m_min,weather_code".to_string(),
            ),
            ("temperature_unit", "fahrenheit".to_string()),
            ("wind_speed_unit", "mph".to_string()),
            ("timezone", "America/Phoenix".to_string()),
            ("forecast_days", "7".to_string()),
        ])
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| error.to_string())?
        .json::<OpenMeteoResponse>()
        .map_err(|error| error.to_string())?;

    eprintln!("[Olympus::Weather] fetched live Tucson forecast from Open-Meteo");

    let payload = WeatherResponse {
        temp_f: format!("{} F", response.current.temperature_2m.round() as i32),
        humidity: format!("{}%", response.current.relative_humidity_2m.round() as i32),
        wind_mph: format!("{} mph", response.current.wind_speed_10m.round() as i32),
        condition_label: weather_code_to_label(response.current.weather_code).to_string(),
        location_label: TUCSON_LABEL.to_string(),
        updated_at: Local::now().format("%-I:%M %p").to_string(),
        forecast: response
            .daily
            .time
            .iter()
            .enumerate()
            .map(|(index, date)| ForecastDay {
                day_label: weekday_label(date),
                weather_code: response
                    .daily
                    .weather_code
                    .get(index)
                    .copied()
                    .unwrap_or_default(),
                high: format!(
                    "{}°",
                    response
                        .daily
                        .temperature_2m_max
                        .get(index)
                        .copied()
                        .unwrap_or_default()
                        .round() as i32
                ),
                low: format!(
                    "{}°",
                    response
                        .daily
                        .temperature_2m_min
                        .get(index)
                        .copied()
                        .unwrap_or_default()
                        .round() as i32
                ),
                is_today: index == 0,
            })
            .collect(),
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

fn weekday_label(date: &str) -> String {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map(|value| value.format("%a").to_string().to_uppercase())
        .unwrap_or_else(|_| "DAY".to_string())
}
