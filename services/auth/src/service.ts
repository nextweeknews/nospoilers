import { randomToken, sha256 } from "./crypto";
import { getEncryptedJson, setEncryptedJson } from "./storage";
import type { AuthPolicy, AuthProvider, AuthUser, EncryptedStorage, PhoneChallenge, ProviderLoginResult, SecureTokenStore, SessionPair } from "./types";

interface PhoneChallengeRecord {
  challengeId: string;
  phone: string;
  codeHash: string;
  expiresAtMs: number;
}

interface RefreshTokenRecord {
  userId: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

const USERS_KEY = "auth:users";
const PHONE_CHALLENGES_KEY = "auth:phone:challenges";
const REFRESH_TOKENS_KEY = "auth:refreshTokens";

export class AuthService {
  constructor(
    private readonly storage: EncryptedStorage,
    private readonly tokenStore: SecureTokenStore,
    private readonly encryptionSecret: string,
    private readonly policy: AuthPolicy
  ) {
    this.validateTransportPolicy();
  }

  async startPhoneLogin(phone: string): Promise<PhoneChallenge & { deliveryCodeForDevOnly: string }> {
    const normalizedPhone = phone.replace(/\s+/g, "");
    const code = `${Math.floor(Math.random() * 900000) + 100000}`;
    const challengeId = randomToken(12);
    const now = Date.now();
    const record: PhoneChallengeRecord = {
      challengeId,
      phone: normalizedPhone,
      codeHash: await sha256(`${code}:${this.policy.passwordSalt}`),
      expiresAtMs: now + this.policy.smsCodeTtlMs
    };

    const challenges = await this.getPhoneChallenges();
    challenges[challengeId] = record;
    await this.savePhoneChallenges(challenges);

    return {
      challengeId,
      expiresAt: new Date(record.expiresAtMs).toISOString(),
      redactedPhone: normalizedPhone.replace(/.(?=.{4})/g, "•"),
      deliveryCodeForDevOnly: code
    };
  }

  async verifyPhoneCode(challengeId: string, code: string): Promise<ProviderLoginResult> {
    const challenges = await this.getPhoneChallenges();
    const challenge = challenges[challengeId];
    if (!challenge) {
      throw new Error("Invalid SMS challenge.");
    }
    if (challenge.expiresAtMs < Date.now()) {
      delete challenges[challengeId];
      await this.savePhoneChallenges(challenges);
      throw new Error("SMS challenge expired.");
    }

    const hash = await sha256(`${code}:${this.policy.passwordSalt}`);
    if (hash !== challenge.codeHash) {
      throw new Error("Incorrect one-time code.");
    }

    delete challenges[challengeId];
    await this.savePhoneChallenges(challenges);

    return this.upsertProviderIdentity("phone", challenge.phone, { primaryPhone: challenge.phone, verified: true });
  }

  async loginWithOAuth(provider: "google" | "apple", oauthSubject: string, emailHint?: string): Promise<ProviderLoginResult> {
    const normalizedEmail = emailHint?.trim().toLowerCase();
    return this.upsertProviderIdentity(provider, oauthSubject, { email: normalizedEmail, verified: true });
  }

  async loginWithEmailPassword(email: string, password: string): Promise<ProviderLoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await this.getUsers();
    const passwordHash = await sha256(`${password}:${this.policy.passwordSalt}`);

    const existing = Object.values(users).find((candidate) => candidate.email === normalizedEmail);
    if (existing) {
      if (existing.passwordHash !== passwordHash) {
        throw new Error("Invalid email or password.");
      }
      return this.createSession(existing, false);
    }

    const user: AuthUser = {
      id: `user_${randomToken(10)}`,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      identities: [{ provider: "email", subject: normalizedEmail, verified: true }]
    };

    users[user.id] = user;
    await this.saveUsers(users);
    return this.createSession(user, true);
  }

  async refreshSession(refreshToken?: string): Promise<SessionPair> {
    const token = refreshToken ?? (await this.tokenStore.getRefreshToken());
    if (!token) {
      throw new Error("Missing refresh token.");
    }

    const refreshRecords = await this.getRefreshTokens();
    const record = refreshRecords[token];
    if (!record || record.expiresAtMs < Date.now()) {
      throw new Error("Refresh token expired.");
    }

    const users = await this.getUsers();
    const user = users[record.userId];
    if (!user) {
      throw new Error("Account no longer exists.");
    }

    delete refreshRecords[token];
    const newSession = await this.issueSession(user.id);
    await this.saveRefreshTokens(refreshRecords);
    return newSession;
  }

  async logout(): Promise<void> {
    const refreshToken = await this.tokenStore.getRefreshToken();
    if (refreshToken) {
      const refreshRecords = await this.getRefreshTokens();
      delete refreshRecords[refreshToken];
      await this.saveRefreshTokens(refreshRecords);
    }
    await this.tokenStore.clear();
  }

  private async upsertProviderIdentity(
    provider: AuthProvider,
    subject: string,
    options: { primaryPhone?: string; email?: string; verified: boolean }
  ): Promise<ProviderLoginResult> {
    const users = await this.getUsers();
    const normalizedSubject = subject.trim().toLowerCase();

    let user = Object.values(users).find((candidate) =>
      candidate.identities.some((identity) => identity.provider === provider && identity.subject === normalizedSubject)
    );

    if (!user && options.email) {
      user = Object.values(users).find((candidate) => candidate.email === options.email);
    }

    if (!user && options.primaryPhone) {
      user = Object.values(users).find((candidate) => candidate.primaryPhone === options.primaryPhone);
    }

    let linked = false;
    if (!user) {
      user = {
        id: `user_${randomToken(10)}`,
        email: options.email,
        primaryPhone: options.primaryPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        identities: []
      };
      linked = true;
    }

    const identityExists = user.identities.some((identity) => identity.provider === provider && identity.subject === normalizedSubject);
    if (!identityExists) {
      user.identities.push({ provider, subject: normalizedSubject, verified: options.verified });
      linked = true;
    }

    if (options.email && !user.email) {
      user.email = options.email;
      linked = true;
    }
    if (options.primaryPhone && !user.primaryPhone) {
      user.primaryPhone = options.primaryPhone;
      linked = true;
    }

    user.updatedAt = new Date().toISOString();
    users[user.id] = user;
    await this.saveUsers(users);

    return this.createSession(user, linked);
  }

  private async createSession(user: AuthUser, linked: boolean): Promise<ProviderLoginResult> {
    const session = await this.issueSession(user.id);
    return { user, linked, session };
  }

  private async issueSession(userId: string): Promise<SessionPair> {
    const accessToken = `at_${randomToken(24)}`;
    const refreshToken = `rt_${randomToken(36)}`;
    const now = Date.now();

    const refreshRecords = await this.getRefreshTokens();
    refreshRecords[refreshToken] = {
      userId,
      issuedAtMs: now,
      expiresAtMs: now + this.policy.refreshTokenTtlMs
    };
    await this.saveRefreshTokens(refreshRecords);
    await this.tokenStore.setRefreshToken(refreshToken);

    return {
      tokenType: "Bearer",
      accessToken,
      refreshToken,
      expiresInMs: this.policy.accessTokenTtlMs
    };
  }

  private validateTransportPolicy(): void {
    if (!this.policy.transport.apiBaseUrl.startsWith("https://")) {
      throw new Error("Auth API transport must use TLS (https://).");
    }

    if (!this.policy.transport.enforceSecureStorage) {
      throw new Error("Secure token storage must be enabled on this platform.");
    }
  }

  private async getUsers(): Promise<Record<string, AuthUser>> {
    return (await getEncryptedJson<Record<string, AuthUser>>(this.storage, USERS_KEY, this.encryptionSecret)) ?? {};
  }

  private async saveUsers(users: Record<string, AuthUser>): Promise<void> {
    await setEncryptedJson(this.storage, USERS_KEY, users, this.encryptionSecret);
  }

  private async getPhoneChallenges(): Promise<Record<string, PhoneChallengeRecord>> {
    return (await getEncryptedJson<Record<string, PhoneChallengeRecord>>(this.storage, PHONE_CHALLENGES_KEY, this.encryptionSecret)) ?? {};
  }

  private async savePhoneChallenges(challenges: Record<string, PhoneChallengeRecord>): Promise<void> {
    await setEncryptedJson(this.storage, PHONE_CHALLENGES_KEY, challenges, this.encryptionSecret);
  }

  private async getRefreshTokens(): Promise<Record<string, RefreshTokenRecord>> {
    return (await getEncryptedJson<Record<string, RefreshTokenRecord>>(this.storage, REFRESH_TOKENS_KEY, this.encryptionSecret)) ?? {};
  }

  private async saveRefreshTokens(refreshTokens: Record<string, RefreshTokenRecord>): Promise<void> {
    await setEncryptedJson(this.storage, REFRESH_TOKENS_KEY, refreshTokens, this.encryptionSecret);
  }
}
