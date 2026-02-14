export const calculateTotalInvested = (amount: number, price: number): number => {
  return amount * price;
};

export const calculateAveragePrice = (
  currentAmount: number,
  currentAveragePrice: number,
  newAmount: number,
  newPrice: number
): number => {
  if (currentAmount + newAmount === 0) return 0;
  return (
    (currentAmount * currentAveragePrice + newAmount * newPrice) /
    (currentAmount + newAmount)
  );
};

export const calculateProfitLoss = (
  currentPrice: number,
  averagePrice: number,
  amount: number
): number => {
  return (currentPrice - averagePrice) * amount;
};

export const calculateProfitLossPercentage = (
  currentPrice: number,
  averagePrice: number
): number => {
  if (averagePrice === 0) return 0;
  return ((currentPrice - averagePrice) / averagePrice) * 100;
};

export const calculatePortfolioValue = (
  amount: number,
  currentPrice: number
): number => {
  return amount * currentPrice;
}; 