import { invoke } from "@tauri-apps/api/core";
import { seedState } from "../data/seed";
import type { TrackedProject } from "../types";
import type { MarketPanelData } from "../types/markets";
import type { WeatherPanelData, WeatherCommandResponse } from "../types/weather";
import type { MarketCommandResponse } from "../types/markets";

export async function fetchMarkets(): Promise<MarketPanelData> {
  const response = await invoke<MarketCommandResponse>("fetch_market_quotes");
  return {
    indexes: response.indexes,
    rates: response.rates,
    news: seedState.market.news,
    updatedAt: response.updatedAt
  };
}

export async function fetchWeather(): Promise<WeatherPanelData> {
  const response = await invoke<WeatherCommandResponse>("fetch_weather");

  return {
    label: response.locationLabel,
    temperature: response.tempF,
    condition: response.conditionLabel,
    humidity: `${response.humidity} RH`,
    wind: response.windMph,
    updatedAt: response.updatedAt,
    forecast: response.forecast
  };
}

export async function fetchProjects(rootPath: string): Promise<TrackedProject[]> {
  return invoke<TrackedProject[]>("scan_tracked_projects", {
    request: { rootPath }
  });
}
