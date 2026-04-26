use std::sync::Mutex;
use std::time::{Duration, Instant};

use chrono::Local;
use once_cell::sync::Lazy;
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE, CACHE_CONTROL, CONNECTION, PRAGMA, USER_AGENT};
use serde::{Deserialize, Serialize};

static MARKET_CACHE: Lazy<Mutex<Option<CachedMarketResponse>>> = Lazy::new(|| Mutex::new(None));
const MARKET_CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketMetric {
    pub id: String,
    pub label: String,
    pub value: String,
    pub change: String,
    pub direction: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct MarketQuotesResponse {
    pub indexes: Vec<MarketMetric>,
    pub rates: Vec<MarketMetric>,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "indexWarning")]
    pub index_warning: Option<String>,
    #[serde(rename = "rateWarning")]
    pub rate_warning: Option<String>,
    #[serde(rename = "overallError")]
    pub overall_error: Option<String>,
}

#[derive(Clone)]
struct CachedMarketResponse {
    payload: MarketQuotesResponse,
    fetched_at: Instant,
}

#[derive(Debug, Deserialize)]
struct FredObservationsResponse {
    observations: Vec<FredObservation>,
}

#[derive(Debug, Deserialize)]
struct FredObservation {
    value: String,
}

#[derive(Debug, Deserialize)]
struct YahooChartResponse {
    chart: YahooChart,
}

#[derive(Debug, Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooChartResult>>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResult {
    meta: YahooMeta,
    indicators: YahooIndicators,
}

#[derive(Debug, Deserialize)]
struct YahooMeta {
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct YahooIndicators {
    quote: Vec<YahooQuote>,
}

#[derive(Debug, Deserialize)]
struct YahooQuote {
    close: Vec<Option<f64>>,
}

#[tauri::command]
pub fn fetch_market_quotes() -> Result<MarketQuotesResponse, String> {
    if let Some(cached) = MARKET_CACHE
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .filter(|entry| entry.fetched_at.elapsed() < MARKET_CACHE_TTL)
    {
        eprintln!("[Olympus::Markets] serving cached market snapshot");
        return Ok(cached.payload);
    }

    let client = Client::new();

    let indexes_result = [
        ("spx", "S&P 500", "^GSPC"),
        ("ndx", "Nasdaq 100", "^NDX"),
        ("dji", "Dow", "^DJI"),
    ]
    .iter()
    .map(|(id, label, symbol)| fetch_index_quote(&client, id, label, symbol))
    .collect::<Result<Vec<_>, _>>();

    let rates_result = match std::env::var("FRED_API_KEY") {
        Ok(fred_key) => [
            ("ust2", "2Y Treasury", "DGS2"),
            ("ust10", "10Y Treasury", "DGS10"),
            ("ust30", "30Y Treasury", "DGS30"),
            ("mort30", "30Y Fixed Mortgage", "MORTGAGE30US"),
        ]
        .iter()
        .map(|(id, label, series_id)| fetch_treasury_rate(&client, &fred_key, id, label, series_id))
        .collect::<Result<Vec<_>, _>>(),
        Err(_) => Err("Treasury rates require FRED_API_KEY in .env".to_string()),
    };

    let (indexes, index_warning) = match indexes_result {
        Ok(indexes) => (indexes, None),
        Err(error) => {
            eprintln!("[Olympus::Markets] index quotes failed: {error}");
            (
                placeholder_metrics(&[
                    ("spx", "S&P 500"),
                    ("ndx", "Nasdaq 100"),
                    ("dji", "Dow"),
                ]),
                Some("Index quotes unavailable right now.".to_string()),
            )
        }
    };

    let (rates, rate_warning) = match rates_result {
        Ok(rates) => (rates, None),
        Err(error) => {
            eprintln!("[Olympus::Markets] treasury rates failed: {error}");
            (
                placeholder_metrics(&[
                    ("ust2", "2Y Treasury"),
                    ("ust10", "10Y Treasury"),
                    ("ust30", "30Y Treasury"),
                    ("mort30", "30Y Fixed Mortgage"),
                ]),
                Some(if error.contains("FRED_API_KEY") {
                    error
                } else {
                    "Treasury rates unavailable right now.".to_string()
                }),
            )
        }
    };

    let overall_error = match (index_warning.as_ref(), rate_warning.as_ref()) {
        (Some(_), Some(_)) => Some("Both index quotes and Treasury rates are unavailable right now.".to_string()),
        _ => None,
    };

    let payload = MarketQuotesResponse {
        indexes,
        rates,
        updated_at: Local::now().format("%-I:%M %p").to_string(),
        index_warning,
        rate_warning,
        overall_error,
    };

    eprintln!("[Olympus::Markets] fetched live market snapshot from Yahoo and FRED");

    *MARKET_CACHE.lock().map_err(|error| error.to_string())? = Some(CachedMarketResponse {
        payload: payload.clone(),
        fetched_at: Instant::now(),
    });

    Ok(payload)
}

fn placeholder_metrics(items: &[(&str, &str)]) -> Vec<MarketMetric> {
    items
        .iter()
        .map(|(id, label)| MarketMetric {
            id: id.to_string(),
            label: label.to_string(),
            value: "—".to_string(),
            change: "—".to_string(),
            direction: "flat".to_string(),
        })
        .collect()
}

fn fetch_index_quote(
    client: &Client,
    id: &str,
    label: &str,
    symbol: &str,
) -> Result<MarketMetric, String> {
    let response = client
        .get(format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}",
            urlencoding::encode(symbol)
        ))
        .header(
            USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        )
        .header(ACCEPT, "application/json,text/plain,*/*")
        .header(ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .header(CACHE_CONTROL, "no-cache")
        .header(PRAGMA, "no-cache")
        .header(CONNECTION, "keep-alive")
        .query(&[("interval", "1d"), ("range", "5d")])
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| error.to_string())?
        .json::<YahooChartResponse>()
        .map_err(|error| error.to_string())?;

    let result = response
        .chart
        .result
        .and_then(|mut items| items.drain(..).next())
        .ok_or_else(|| format!("Yahoo did not return chart data for {}", label))?;

    let latest = result
        .meta
        .regular_market_price
        .or_else(|| {
            result
                .indicators
                .quote
                .first()
                .and_then(|quote| quote.close.iter().rev().flatten().next().copied())
        })
        .ok_or_else(|| format!("Yahoo did not return a live price for {}", label))?;

    let previous = result
        .indicators
        .quote
        .first()
        .and_then(|quote| {
            let closes = quote
                .close
                .iter()
                .filter_map(|close| *close)
                .collect::<Vec<f64>>();

            if closes.len() >= 2 {
                Some(closes[closes.len() - 2])
            } else {
                None
            }
        })
        .ok_or_else(|| format!("Yahoo did not return enough close data for {}", label))?;

    if previous == 0.0 {
        return Err(format!("Previous close for {} was zero.", label));
    }

    let delta_percent = ((latest - previous) / previous) * 100.0;
    let direction = direction_from_number(delta_percent);

    Ok(MarketMetric {
        id: id.to_string(),
        label: label.to_string(),
        value: format_number(latest, 2),
        change: format!("{:+.1}%", delta_percent),
        direction: direction.to_string(),
    })
}

fn fetch_treasury_rate(
    client: &Client,
    api_key: &str,
    id: &str,
    label: &str,
    series_id: &str,
) -> Result<MarketMetric, String> {
    let response = client
        .get("https://api.stlouisfed.org/fred/series/observations")
        .query(&[
            ("series_id", series_id),
            ("api_key", api_key),
            ("file_type", "json"),
            ("sort_order", "desc"),
            ("limit", "7"),
        ])
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| error.to_string())?
        .json::<FredObservationsResponse>()
        .map_err(|error| error.to_string())?;

    let mut values = response
        .observations
        .iter()
        .filter_map(|observation| observation.value.parse::<f64>().ok());

    let latest = values
        .next()
        .ok_or_else(|| format!("No usable observations returned for {}", label))?;
    let previous = values
        .next()
        .ok_or_else(|| format!("Not enough observations returned for {}", label))?;

    let delta_bps = ((latest - previous) * 100.0).round() as i32;
    let direction = direction_from_number(delta_bps as f64);
    let units = if delta_bps.abs() == 1 { "bp" } else { "bps" };

    Ok(MarketMetric {
        id: id.to_string(),
        label: label.to_string(),
        value: format!("{latest:.2}%"),
        change: format!("{:+} {}", delta_bps, units),
        direction: direction.to_string(),
    })
}

fn direction_from_number(value: f64) -> &'static str {
    if value > 0.0 {
        "up"
    } else if value < 0.0 {
        "down"
    } else {
        "flat"
    }
}

fn format_number(value: f64, decimals: usize) -> String {
    let formatted = format!("{value:.decimals$}");
    let mut parts = formatted.split('.');
    let integer_part = parts.next().unwrap_or_default();
    let fractional_part = parts.next();

    let mut with_commas_reversed = String::new();
    for (index, character) in integer_part.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 && character != '-' {
            with_commas_reversed.push(',');
        }
        with_commas_reversed.push(character);
    }

    let integer_with_commas = with_commas_reversed.chars().rev().collect::<String>();

    match fractional_part {
        Some(fraction) => format!("{integer_with_commas}.{fraction}"),
        None => integer_with_commas,
    }
}
