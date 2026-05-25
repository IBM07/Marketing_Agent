export const DAILY_EMAIL_LIMIT = 100;

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}
