import { AuthService, InMemoryEncryptedStorage, InMemorySecureTokenStore } from "@nospoilers/auth";
import { webConfig } from "../config/env";

export const authService = new AuthService(new InMemoryEncryptedStorage(), new InMemorySecureTokenStore(), "web-demo-encryption-key", {
  accessTokenTtlMs: 15 * 60 * 1000,
  refreshTokenTtlMs: 14 * 24 * 60 * 60 * 1000,
  smsCodeTtlMs: 5 * 60 * 1000,
  passwordSalt: "nospoilers-salt",
  transport: {
    apiBaseUrl: webConfig.apiBaseUrl,
    cookieName: "ns_refresh",
    platform: "web",
    enforceSecureStorage: true
  }
});
