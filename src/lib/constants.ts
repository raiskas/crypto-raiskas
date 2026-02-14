export const API_URL = 'https://api.coingecko.com/api/v3';

export const CRYPTO_CURRENCIES = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'binancecoin', name: 'Binance Coin', symbol: 'BNB' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
  { id: 'ripple', name: 'Ripple', symbol: 'XRP' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
  { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
];

export const OPERATION_TYPES = [
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venda' },
];

export const DEFAULT_CURRENCY = 'brl';

export const REFRESH_INTERVAL = 300000; // 5 minutos

export const TABLE_NAMES = {
  OPERATIONS: 'operations',
  PORTFOLIO: 'portfolio',
} as const; 