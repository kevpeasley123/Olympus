import type { MarketIndex, MarketNewsItem, MarketRate } from "../types";

export interface MarketPanelData {
  indexes: MarketIndex[];
  rates: MarketRate[];
  news: MarketNewsItem[];
  updatedAt: string;
}

export interface MarketCommandResponse {
  indexes: MarketIndex[];
  rates: MarketRate[];
  updatedAt: string;
}
