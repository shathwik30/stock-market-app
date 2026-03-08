import type {
  IPortfolio,
  IWatchlist,
  IWatchlistStock,
  INote,
  UserPublic,
  StockStats,
  Stock,
} from './index';

// =====================================
// Generic API Response Types
// =====================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// =====================================
// Auth API Types
// =====================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: true;
  message: string;
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterResponse {
  success: true;
  message: string;
  user: Pick<UserPublic, 'id' | 'username' | 'email'>;
}

// =====================================
// Portfolio API Types
// =====================================

export interface GetPortfolioRequest {
  marketCondition: string;
}

export interface GetPortfolioResponse {
  success: true;
  portfolio: IPortfolio | null;
}

export interface UpdatePortfolioRequest {
  marketCondition: string;
  strategies: IPortfolio['strategies'];
}

export interface UpdatePortfolioResponse {
  success: true;
  message: string;
  portfolio: IPortfolio;
}

// =====================================
// Watchlist API Types
// =====================================

export interface GetWatchlistResponse {
  success: true;
  watchlist: IWatchlist;
}

export interface AddStockRequest {
  stock: Omit<IWatchlistStock, 'id' | 'addedAt'>;
}

export interface AddStockResponse {
  success: true;
  message: string;
  watchlist: IWatchlist;
}

export interface RemoveStockRequest {
  stockId: string;
}

export interface RemoveStockResponse {
  success: true;
  message: string;
  watchlist: IWatchlist;
}

// =====================================
// Notes API Types
// =====================================

export interface GetNotesResponse {
  success: true;
  notes: INote[];
}

export interface CreateNoteRequest {
  title: string;
  content?: string;
  color?: INote['color'];
  tags?: string[];
}

export interface CreateNoteResponse {
  success: true;
  message: string;
  note: INote;
}

export interface UpdateNoteRequest {
  id: string;
  title?: string;
  content?: string;
  color?: INote['color'];
  isPinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteResponse {
  success: true;
  message: string;
  note: INote;
}

export interface DeleteNoteRequest {
  id: string;
}

export interface DeleteNoteResponse {
  success: true;
  message: string;
}

// =====================================
// Stocks API Types
// =====================================

export interface GetStatsResponse {
  success: true;
  stats: StockStats;
}

export interface GetGainersResponse {
  success: true;
  message: string;
  count: number;
  data: Stock[];
}

export interface GetLosersResponse {
  success: true;
  message: string;
  count: number;
  data: Stock[];
}
