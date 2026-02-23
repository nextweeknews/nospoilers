export type AuthProvider = "phone" | "google" | "apple" | "email";

export type Platform = "web" | "ios" | "android";

export interface AuthTransportPolicy {
  apiBaseUrl: string;
  cookieName: string;
  platform: Platform;
  enforceSecureStorage: boolean;
}

export interface AuthPolicy {
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
  smsCodeTtlMs: number;
  passwordSalt: string;
  transport: AuthTransportPolicy;
}

export interface UserIdentity {
  provider: AuthProvider;
  subject: string;
  verified: boolean;
}

export interface AuthUser {
  id: string;
  primaryPhone?: string;
  email?: string;
  passwordHash?: string;
  identities: UserIdentity[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInMs: number;
}

export interface ProviderLoginResult {
  user: AuthUser;
  session: SessionPair;
  linked: boolean;
}

export interface PhoneChallenge {
  challengeId: string;
  expiresAt: string;
  redactedPhone: string;
}

export interface EncryptedValue {
  iv: string;
  cipherText: string;
}

export interface EncryptedStorage {
  get(key: string): Promise<EncryptedValue | undefined>;
  set(key: string, value: EncryptedValue): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SecureTokenStore {
  setRefreshToken(token: string): Promise<void>;
  getRefreshToken(): Promise<string | undefined>;
  clear(): Promise<void>;
}
