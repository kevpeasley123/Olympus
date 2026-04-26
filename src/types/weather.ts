export interface WeatherPanelData {
  label: string;
  temperature: string;
  condition: string;
  humidity: string;
  wind: string;
  updatedAt: string;
}

export interface WeatherCommandResponse {
  tempF: string;
  humidity: string;
  windMph: string;
  conditionLabel: string;
  locationLabel: string;
  updatedAt: string;
}
