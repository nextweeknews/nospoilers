export type AuthProvider = "phone" | "google" | "email";

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

export interface AvatarMeta {
  width: number;
  height: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  bytes: number;
}

export interface AvatarUploadRequest {
  fileName: string;
  contentType: AvatarMeta["contentType"];
  bytes: number;
  width: number;
  height: number;
}

export interface AvatarUploadPlan {
  uploadId: string;
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface UsernameAvailability {
  requested: string;
  normalized: string;
  available: boolean;
  reason?: "invalid" | "taken" | "reserved";
  reservedUntil?: string;
}

export interface UserPreferences {
  themePreference?: "system" | "light" | "dark";
}

export interface AuthUser {
  id: string;
  primaryPhone?: string;
  email?: string;
  passwordHash?: string;
  identities: UserIdentity[];
  username?: string;
  usernameNormalized?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: UserPreferences;
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


export interface DeleteAccountResult {
  deletedUserId: string;
  revokedSessionCount: number;
  clearedIdentityCount: number;
  clearedProfile: boolean;
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
