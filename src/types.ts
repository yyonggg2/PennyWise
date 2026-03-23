export type Currency = 'CAD' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'AUD' | 'CHF' | 'HKD' | 'MXN';

export const CURRENCIES: Currency[] = ['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CHF', 'HKD', 'MXN'];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CAD: 'CA$', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
  CNY: '¥', AUD: 'A$', CHF: 'Fr', HKD: 'HK$', MXN: 'MX$',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  CAD: 'Canadian Dollar', USD: 'US Dollar', EUR: 'Euro',
  GBP: 'British Pound', JPY: 'Japanese Yen', CNY: 'Chinese Yuan',
  AUD: 'Australian Dollar', CHF: 'Swiss Franc',
  HKD: 'Hong Kong Dollar', MXN: 'Mexican Peso',
};

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Card {
  id: string;
  name: string;
  initialBalance: number;
}

export interface InitialFunds {
  cash: number;
  digital: number;
  other: number;
}

export interface VariableExpense {
  id: string;
  amount: number;
  currency: Currency;
  amountInPrimary: number;
  category: string;
  note: string;
  date: string;
  method: string; // 'cash' | 'digital' | 'other' | card.id
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  method: string;
  frequency: Frequency;
  nextDueDate: string;
  lastPaidDate: string | null;
}

export interface AppState {
  primaryCurrency: Currency;
  cards: Card[];
  hasCash: boolean;
  hasDigital: boolean;
  hasOther: boolean;
  initialFunds: InitialFunds;
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  categories: string[];
  isSetupComplete: boolean;
  userEmail: string | null;
  isLoggedIn: boolean;
  avatar: string | null;
  exchangeRates: Record<string, number>;
}
