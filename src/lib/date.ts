export const getCurrentDate = (): Date => {
  return new Date();
};

export const formatDateToISO = (date: Date): string => {
  return date.toISOString();
};

export const parseISOToDate = (isoString: string): Date => {
  return new Date(isoString);
};

export const isDateValid = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const getDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

export const getMonthStartAndEnd = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
  return { start, end };
};

export const getDateFromString = (dateString: string): Date => {
  return new Date(dateString);
};

export const getDateDifference = (date1: Date, date2: Date): number => {
  return Math.abs(date1.getTime() - date2.getTime());
};

export const getDaysDifference = (date1: Date, date2: Date): number => {
  const diffTime = getDateDifference(date1, date2);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const subtractDays = (date: Date, days: number): Date => {
  return addDays(date, -days);
};

export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date >= startDate && date <= endDate;
};

export const getStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const getEndOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}; 