'use client';

// Interfaces para os dados retornados pela API
export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  image: string;
}

export interface CryptoDetails {
  id: string;
  symbol: string;
  name: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  market_data: {
    current_price: {
      usd: number;
      brl: number;
    };
    market_cap: {
      usd: number;
      brl: number;
    };
    price_change_percentage_24h: number;
  };
  description: {
    en: string;
  };
}

// Interface para padronizar a resposta da API, independente da implementação
export interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  marketCapRank: number;
  imageUrl: string;
}

export interface CryptoDetailedData extends CryptoData {
  description: string;
  priceBRL: number;
  marketCapBRL: number;
}

/**
 * Serviço para interação com a API do CoinGecko
 * Esta implementação pode ser substituída no futuro por outra API sem afetar
 * o restante da aplicação, desde que mantenha a mesma interface
 */
export class CryptoService {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  
  /**
   * Busca as top moedas por capitalização de mercado
   */
  async getTopCryptos(limit: number = 50, currency: string = 'usd'): Promise<CryptoData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&locale=en`,
        { next: { revalidate: 60 * 15 } } // Cache por 15 minutos
      );
      
      if (!response.ok) {
        throw new Error('Falha ao buscar dados de criptomoedas');
      }
      
      const data: CryptoPrice[] = await response.json();
      
      // Mapear para nosso formato padronizado
      return data.map(crypto => ({
        id: crypto.id,
        symbol: crypto.symbol,
        name: crypto.name,
        currentPrice: crypto.current_price,
        priceChangePercentage24h: crypto.price_change_percentage_24h,
        marketCap: crypto.market_cap,
        marketCapRank: crypto.market_cap_rank,
        imageUrl: crypto.image
      }));
    } catch (error) {
      console.error('Erro ao buscar criptomoedas:', error);
      throw error;
    }
  }
  
  /**
   * Busca detalhes de uma criptomoeda específica
   */
  async getCryptoDetails(id: string): Promise<CryptoDetailedData> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
        { next: { revalidate: 60 * 5 } } // Cache por 5 minutos
      );
      
      if (!response.ok) {
        throw new Error(`Falha ao buscar detalhes da moeda ${id}`);
      }
      
      const data: CryptoDetails = await response.json();
      
      // Mapear para nosso formato padronizado
      return {
        id: data.id,
        symbol: data.symbol,
        name: data.name,
        currentPrice: data.market_data.current_price.usd,
        priceBRL: data.market_data.current_price.brl,
        priceChangePercentage24h: data.market_data.price_change_percentage_24h,
        marketCap: data.market_data.market_cap.usd,
        marketCapBRL: data.market_data.market_cap.brl,
        marketCapRank: 0, // Não disponível nesta rota da API
        imageUrl: data.image.small,
        description: data.description.en
      };
    } catch (error) {
      console.error(`Erro ao buscar detalhes da moeda ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Busca criptomoedas por termo de pesquisa
   */
  async searchCryptos(query: string): Promise<CryptoData[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/search?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Falha ao buscar resultados da pesquisa');
      }
      
      const data = await response.json();
      
      // A API de pesquisa não retorna preços e outros detalhes,
      // então vamos retornar apenas os dados básicos
      return data.coins.slice(0, 10).map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        currentPrice: 0, // Não disponível nesta rota
        priceChangePercentage24h: 0, // Não disponível nesta rota
        marketCap: 0, // Não disponível nesta rota
        marketCapRank: coin.market_cap_rank || 0,
        imageUrl: coin.large ? coin.large.replace('coin-images.coingecko.com', 'assets.coingecko.com') : coin.thumb
      }));
    } catch (error) {
      console.error('Erro ao pesquisar criptomoedas:', error);
      throw error;
    }
  }
}

// Exportando uma instância única do serviço
export const cryptoService = new CryptoService(); 