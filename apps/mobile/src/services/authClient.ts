import { AuthService, InMemoryEncryptedStorage, InMemorySecureTokenStore } from "@nospoilers/auth";
import { mobileConfig } from "../config/env";

export const authService = new AuthService(
  new InMemoryEncryptedStorage(),
  new InMemorySecureTokenStore(),
  "mobile-demo-encryption-key",
  {
    accessTokenTtlMs: 15 * 60 * 1000,
    refreshTokenTtlMs: 14 * 24 * 60 * 60 * 1000,
    smsCodeTtlMs: 5 * 60 * 1000,
    passwordSalt: "nospoilers-salt",
    transport: {
      apiBaseUrl: mobileConfig.apiBaseUrl,
      cookieName: "ns_refresh",
      platform: "ios",
      enforceSecureStorage: true
    }
  }
);
