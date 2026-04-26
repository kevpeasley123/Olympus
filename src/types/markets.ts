import type { MarketIndex, MarketNewsItem, MarketRate } from "../types";

export interface MarketPanelData {
  indexes: MarketIndex[];
  rates: MarketRate[];
  news: MarketNewsItem[];
  updatedAt: string;
  indexWarning?: string | null;
  rateWarning?: string | null;
  overallError?: string | null;
}

export interface MarketCommandResponse {
  indexes: MarketIndex[];
  rates: MarketRate[];
  updatedAt: string;
  indexWarning?: string | null;
  rateWarning?: string | null;
  overallError?: string | null;
}
