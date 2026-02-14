import { OPERATION_TYPES } from './constants';

export const validateAmount = (amount: number): boolean => {
  return amount > 0;
};

export const validatePrice = (price: number): boolean => {
  return price > 0;
};

export const validateOperationType = (type: string): boolean => {
  return OPERATION_TYPES.some((op) => op.value === type);
};

export const validateCryptoId = (id: string): boolean => {
  return id.length > 0;
};

export const validateOperation = (
  amount: number,
  price: number,
  type: string,
  cryptoId: string
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!validateAmount(amount)) {
    errors.push('O valor deve ser maior que zero');
  }

  if (!validatePrice(price)) {
    errors.push('O preço deve ser maior que zero');
  }

  if (!validateOperationType(type)) {
    errors.push('Tipo de operação inválido');
  }

  if (!validateCryptoId(cryptoId)) {
    errors.push('Criptomoeda inválida');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validatePortfolio = (portfolio: {
  crypto_id: string;
  crypto_name: string;
  amount: number;
  average_price: number;
  total_invested: number;
}) => {
  const errors: string[] = [];

  if (!portfolio.crypto_id) {
    errors.push('ID da criptomoeda é obrigatório');
  }

  if (!portfolio.crypto_name) {
    errors.push('Nome da criptomoeda é obrigatório');
  }

  if (portfolio.amount < 0) {
    errors.push('Quantidade não pode ser negativa');
  }

  if (portfolio.average_price < 0) {
    errors.push('Preço médio não pode ser negativo');
  }

  if (portfolio.total_invested < 0) {
    errors.push('Total investido não pode ser negativo');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  // Mínimo 8 caracteres, pelo menos uma letra maiúscula, uma minúscula e um número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  return passwordRegex.test(password);
};

export const isValidCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;

  return true;
};

export const isValidDate = (date: string): boolean => {
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(date)) return false;

  const [day, month, year] = date.split('/').map(Number);
  const dateObj = new Date(year, month - 1, day);

  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
};

export const isValidPhone = (phone: string): boolean => {
  // Remove caracteres não numéricos
  phone = phone.replace(/[^\d]/g, '');
  
  // Verifica se tem 10 ou 11 dígitos (com ou sem DDD)
  return phone.length >= 10 && phone.length <= 11;
};

export const isCryptoAmountValid = (amount: number): boolean => {
  return amount > 0 && !isNaN(amount);
};

export const isCryptoPriceValid = (price: number): boolean => {
  return price > 0 && !isNaN(price);
};

export const isDateValid = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const isStringValid = (str: string): boolean => {
  return typeof str === 'string' && str.trim().length > 0;
};

export const isNumberValid = (num: number): boolean => {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
}; 