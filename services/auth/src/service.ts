import { randomToken, sha256 } from "./crypto";
import { getEncryptedJson, setEncryptedJson } from "./storage";
import type {
  AuthPolicy,
  AuthProvider,
  AuthUser,
  AvatarMeta,
  AvatarUploadPlan,
  AvatarUploadRequest,
  EncryptedStorage,
  PhoneChallenge,
  ProviderLoginResult,
  SecureTokenStore,
  SessionPair,
  UsernameAvailability
} from "./types";

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

interface UsernameReservationRecord {
  normalized: string;
  userId: string;
  expiresAtMs: number;
}

interface AvatarUploadRecord {
  uploadId: string;
  objectKey: string;
  userId: string;
  expiresAtMs: number;
  request: AvatarUploadRequest;
}

interface RateLimitBucket {
  count: number;
  windowStartedAtMs: number;
  blockedUntilMs?: number;
}

interface SuspiciousActivityRecord {
  key: string;
  reason: string;
  score: number;
  lastObservedAt: string;
}

export interface AuthAuditEvent {
  id: string;
  action: "otp_send" | "otp_verify" | "email_login" | "oauth_login" | "session_refresh" | "logout";
  status: "success" | "failure";
  userId?: string;
  actorRef?: string;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
}

const USERS_KEY = "auth:users";
const PHONE_CHALLENGES_KEY = "auth:phone:challenges";
const REFRESH_TOKENS_KEY = "auth:refreshTokens";
const USERNAME_INDEX_KEY = "auth:username:index";
const USERNAME_RESERVATIONS_KEY = "auth:username:reservations";
const AVATAR_UPLOADS_KEY = "auth:avatar:uploads";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$/;
const USERNAME_RESERVATION_TTL_MS = 5 * 60 * 1000;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const OTP_SEND_LIMIT = 3;
const OTP_VERIFY_LIMIT = 8;
const LOGIN_LIMIT = 10;
const RATE_LIMIT_BLOCK_MS = 5 * 60 * 1000;
const SUSPICIOUS_SCORE_THRESHOLD = 3;

export class AuthService {
  private readonly rateLimits = new Map<string, RateLimitBucket>();
  private readonly suspiciousActivity = new Map<string, SuspiciousActivityRecord>();
  private readonly auditLog: AuthAuditEvent[] = [];

  constructor(
    private readonly storage: EncryptedStorage,
    private readonly tokenStore: SecureTokenStore,
    private readonly encryptionSecret: string,
    private readonly policy: AuthPolicy
  ) {
    this.validateTransportPolicy();
  }

  async startPhoneLogin(phone: string): Promise<PhoneChallenge & { deliveryCodeForDevOnly: string }> {
    const normalizedPhone = this.normalizePhone(phone);
    this.assertRateLimit(`otp_send:${normalizedPhone}`, OTP_SEND_LIMIT, "OTP send limit exceeded. Try again later.");

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

    this.logAudit({ action: "otp_send", status: "success", actorRef: normalizedPhone, metadata: { challengeId } });

    return {
      challengeId,
      expiresAt: new Date(record.expiresAtMs).toISOString(),
      redactedPhone: normalizedPhone.replace(/.(?=.{4})/g, "•"),
      deliveryCodeForDevOnly: code
    };
  }

  async verifyPhoneCode(challengeId: string, code: string): Promise<ProviderLoginResult> {
    this.assertRateLimit(`otp_verify:${challengeId}`, OTP_VERIFY_LIMIT, "Too many code verification attempts.");

    const challenges = await this.getPhoneChallenges();
    const challenge = challenges[challengeId];
    if (!challenge) {
      this.recordSuspicious(`otp_verify:${challengeId}`, "missing_challenge");
      this.logAudit({ action: "otp_verify", status: "failure", actorRef: challengeId, metadata: { reason: "missing_challenge" } });
      throw new Error("Invalid SMS challenge.");
    }
    if (challenge.expiresAtMs < Date.now()) {
      delete challenges[challengeId];
      await this.savePhoneChallenges(challenges);
      this.recordSuspicious(`otp_verify:${challenge.phone}`, "expired_challenge");
      this.logAudit({ action: "otp_verify", status: "failure", actorRef: challenge.phone, metadata: { reason: "expired" } });
      throw new Error("SMS challenge expired.");
    }

    const hash = await sha256(`${code}:${this.policy.passwordSalt}`);
    if (hash !== challenge.codeHash) {
      this.recordSuspicious(`otp_verify:${challenge.phone}`, "otp_mismatch");
      this.logAudit({ action: "otp_verify", status: "failure", actorRef: challenge.phone, metadata: { reason: "mismatch" } });
      throw new Error("Incorrect one-time code.");
    }

    delete challenges[challengeId];
    await this.savePhoneChallenges(challenges);

    const result = await this.upsertProviderIdentity("phone", challenge.phone, { primaryPhone: challenge.phone, verified: true });
    this.logAudit({ action: "otp_verify", status: "success", actorRef: challenge.phone, userId: result.user.id });
    return result;
  }

  async loginWithOAuth(provider: "google", oauthSubject: string, emailHint?: string): Promise<ProviderLoginResult> {
    const normalizedEmail = this.normalizeEmail(emailHint);
    const subject = this.normalizeSubject(oauthSubject);
    this.assertRateLimit(`oauth_login:${provider}:${subject}`, LOGIN_LIMIT, "Too many login attempts.");

    const result = await this.upsertProviderIdentity(provider, subject, { email: normalizedEmail, verified: true });
    this.logAudit({
      action: "oauth_login",
      status: "success",
      userId: result.user.id,
      actorRef: `${provider}:${subject}`
    });
    return result;
  }

  async loginWithEmailPassword(email: string, password: string): Promise<ProviderLoginResult> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new Error("Email is required.");
    }

    this.assertRateLimit(`email_login:${normalizedEmail}`, LOGIN_LIMIT, "Too many login attempts.");

    const users = await this.getUsers();
    const passwordHash = await sha256(`${password}:${this.policy.passwordSalt}`);

    const existing = Object.values(users).find((candidate) => candidate.email === normalizedEmail);
    if (existing) {
      if (existing.passwordHash !== passwordHash) {
        this.recordSuspicious(`email_login:${normalizedEmail}`, "password_mismatch");
        this.logAudit({ action: "email_login", status: "failure", actorRef: normalizedEmail, metadata: { reason: "invalid_password" } });
        throw new Error("Invalid email or password.");
      }
      const result = await this.createSession(existing, false);
      this.logAudit({ action: "email_login", status: "success", userId: existing.id, actorRef: normalizedEmail });
      return result;
    }

    const now = new Date().toISOString();
    const user: AuthUser = {
      id: `user_${randomToken(10)}`,
      email: normalizedEmail,
      passwordHash,
      displayName: this.encodeForOutput(normalizedEmail.split("@")[0]),
      createdAt: now,
      updatedAt: now,
      identities: [{ provider: "email", subject: normalizedEmail, verified: true }]
    };

    users[user.id] = user;
    await this.saveUsers(users);
    const result = await this.createSession(user, true);
    this.logAudit({ action: "email_login", status: "success", userId: user.id, actorRef: normalizedEmail, metadata: { created: true } });
    return result;
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.requireUser(userId);
    return { ...user };
  }

  async updateProfile(
    userId: string,
    updates: { displayName?: string; username?: string; themePreference?: "system" | "light" | "dark" }
  ): Promise<AuthUser> {
    const users = await this.getUsers();
    const usernameIndex = await this.getUsernameIndex();
    const reservations = await this.getUsernameReservations();

    const user = users[userId];
    if (!user) {
      throw new Error("Unknown user.");
    }

    if (typeof updates.username === "string") {
      const normalizedUsername = this.normalizeUsername(updates.username);
      if (!normalizedUsername || !USERNAME_PATTERN.test(normalizedUsername)) {
        throw new Error("Invalid username format.");
      }

      const reservation = reservations[normalizedUsername];
      if (reservation && reservation.userId !== userId && reservation.expiresAtMs > Date.now()) {
        throw new Error("Username is currently reserved.");
      }

      const existingOwner = usernameIndex[normalizedUsername];
      if (existingOwner && existingOwner !== userId) {
        throw new Error("Username already taken.");
      }

      if (user.usernameNormalized && user.usernameNormalized !== normalizedUsername) {
        delete usernameIndex[user.usernameNormalized];
      }

      user.username = this.encodeForOutput(updates.username.trim());
      user.usernameNormalized = normalizedUsername;
      usernameIndex[normalizedUsername] = userId;
      delete reservations[normalizedUsername];
    }

    if (typeof updates.displayName === "string") {
      const sanitizedDisplayName = this.sanitizeFreeText(updates.displayName, 80);
      if (!sanitizedDisplayName) {
        throw new Error("Display name cannot be empty.");
      }
      user.displayName = this.encodeForOutput(sanitizedDisplayName);
    }

    if (typeof updates.themePreference === "string") {
      user.preferences = {
        ...(user.preferences ?? {}),
        themePreference: updates.themePreference
      };
    }

    user.updatedAt = new Date().toISOString();
    users[user.id] = user;

    await this.saveUsers(users);
    await this.saveUsernameIndex(usernameIndex);
    await this.saveUsernameReservations(reservations);
    return { ...user };
  }

  async checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
    const normalized = this.normalizeUsername(username);
    if (!normalized || !USERNAME_PATTERN.test(normalized)) {
      return { requested: username, normalized: normalized ?? "", available: false, reason: "invalid" };
    }

    const usernameIndex = await this.getUsernameIndex();
    if (usernameIndex[normalized]) {
      return { requested: username, normalized, available: false, reason: "taken" };
    }

    const reservations = await this.getUsernameReservations();
    const reservation = reservations[normalized];
    if (reservation && reservation.expiresAtMs > Date.now()) {
      return {
        requested: username,
        normalized,
        available: false,
        reason: "reserved",
        reservedUntil: new Date(reservation.expiresAtMs).toISOString()
      };
    }

    return { requested: username, normalized, available: true };
  }

  async reserveUsername(username: string, userId: string): Promise<UsernameAvailability> {
    const availability = await this.checkUsernameAvailability(username);
    if (!availability.available) {
      return availability;
    }

    const reservations = await this.getUsernameReservations();
    const expiresAtMs = Date.now() + USERNAME_RESERVATION_TTL_MS;
    reservations[availability.normalized] = {
      normalized: availability.normalized,
      userId,
      expiresAtMs
    };
    await this.saveUsernameReservations(reservations);

    return {
      ...availability,
      available: false,
      reason: "reserved",
      reservedUntil: new Date(expiresAtMs).toISOString()
    };
  }

  async createAvatarUploadPlan(userId: string, request: AvatarUploadRequest): Promise<AvatarUploadPlan> {
    await this.requireUser(userId);
    this.validateAvatarMeta(request);

    const uploadId = `upl_${randomToken(16)}`;
    const objectKey = `avatars/${userId}/${uploadId}-${request.fileName.replace(/\s+/g, "-").toLowerCase()}`;
    const expiresAtMs = Date.now() + 10 * 60 * 1000;

    const uploads = await this.getAvatarUploads();
    uploads[uploadId] = {
      uploadId,
      objectKey,
      userId,
      expiresAtMs,
      request
    };
    await this.saveAvatarUploads(uploads);

    return {
      uploadId,
      objectKey,
      uploadUrl: `${this.policy.transport.apiBaseUrl}/uploads/${uploadId}/signed-put`,
      expiresAt: new Date(expiresAtMs).toISOString(),
      requiredHeaders: {
        "content-type": request.contentType,
        "x-nospoilers-upload-token": uploadId
      }
    };
  }

  async finalizeAvatarUpload(userId: string, uploadId: string, metadata: AvatarMeta): Promise<AuthUser> {
    const users = await this.getUsers();
    const uploads = await this.getAvatarUploads();
    const upload = uploads[uploadId];
    if (!upload || upload.userId !== userId || upload.expiresAtMs < Date.now()) {
      throw new Error("Avatar upload has expired or is invalid.");
    }

    this.validateAvatarMeta(metadata);
    if (metadata.contentType !== upload.request.contentType) {
      throw new Error("Avatar MIME type mismatch.");
    }

    const user = users[userId];
    if (!user) {
      throw new Error("Unknown user.");
    }

    user.avatarUrl = `${this.policy.transport.apiBaseUrl}/cdn/${upload.objectKey}`;
    user.updatedAt = new Date().toISOString();

    delete uploads[uploadId];
    users[userId] = user;
    await this.saveAvatarUploads(uploads);
    await this.saveUsers(users);

    return { ...user };
  }

  async refreshSession(refreshToken?: string): Promise<SessionPair> {
    const token = refreshToken ?? (await this.tokenStore.getRefreshToken());
    if (!token) {
      throw new Error("Missing refresh token.");
    }

    const refreshRecords = await this.getRefreshTokens();
    const record = refreshRecords[token];
    if (!record || record.expiresAtMs < Date.now()) {
      this.logAudit({ action: "session_refresh", status: "failure", actorRef: "refresh_token", metadata: { reason: "expired" } });
      throw new Error("Refresh token expired.");
    }

    const users = await this.getUsers();
    const user = users[record.userId];
    if (!user) {
      this.logAudit({ action: "session_refresh", status: "failure", actorRef: record.userId, metadata: { reason: "user_missing" } });
      throw new Error("Account no longer exists.");
    }

    delete refreshRecords[token];
    const newSession = await this.issueSession(user.id);
    await this.saveRefreshTokens(refreshRecords);
    this.logAudit({ action: "session_refresh", status: "success", userId: user.id });
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
    this.logAudit({ action: "logout", status: "success" });
  }

  getAuthAuditLog(limit = 250): AuthAuditEvent[] {
    return this.auditLog.slice(-Math.max(1, limit));
  }

  getSuspiciousActivity(limit = 100): SuspiciousActivityRecord[] {
    return Array.from(this.suspiciousActivity.values())
      .sort((a, b) => (a.lastObservedAt < b.lastObservedAt ? 1 : -1))
      .slice(0, Math.max(1, limit));
  }

  private async upsertProviderIdentity(
    provider: AuthProvider,
    subject: string,
    options: { primaryPhone?: string; email?: string; verified: boolean }
  ): Promise<ProviderLoginResult> {
    const users = await this.getUsers();
    const normalizedSubject = this.normalizeSubject(subject);

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
      const now = new Date().toISOString();
      user = {
        id: `user_${randomToken(10)}`,
        email: options.email,
        primaryPhone: options.primaryPhone,
        displayName: options.email?.split("@")[0],
        createdAt: now,
        updatedAt: now,
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

  private validateAvatarMeta(meta: AvatarMeta): void {
    if (!["image/jpeg", "image/png", "image/webp"].includes(meta.contentType)) {
      throw new Error("Unsupported avatar content type.");
    }
    if (meta.width < 128 || meta.height < 128) {
      throw new Error("Avatar image must be at least 128x128.");
    }
    if (meta.bytes <= 0 || meta.bytes > MAX_AVATAR_BYTES) {
      throw new Error("Avatar image size is invalid.");
    }
  }

  private normalizeUsername(input: string): string | undefined {
    const trimmed = input.trim().toLowerCase();
    return trimmed.length ? trimmed : undefined;
  }

  private normalizePhone(phone: string): string {
    const normalized = phone.replace(/[^0-9+]/g, "");
    if (!normalized || normalized.length < 7) {
      throw new Error("Phone number is invalid.");
    }
    return normalized;
  }

  private normalizeSubject(subject: string): string {
    const normalized = subject.trim().toLowerCase();
    if (!normalized) {
      throw new Error("Provider subject is required.");
    }
    return normalized;
  }

  private normalizeEmail(email?: string): string | undefined {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Email format is invalid.");
    }
    return normalized;
  }

  private sanitizeFreeText(text: string, maxLength: number): string {
    return text.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
  }

  private encodeForOutput(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private assertRateLimit(key: string, maxRequests: number, message: string): void {
    const now = Date.now();
    const existing = this.rateLimits.get(key);
    if (!existing) {
      this.rateLimits.set(key, { count: 1, windowStartedAtMs: now });
      return;
    }

    if (existing.blockedUntilMs && existing.blockedUntilMs > now) {
      this.recordSuspicious(key, "rate_limited");
      throw new Error(message);
    }

    if (now - existing.windowStartedAtMs > RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(key, { count: 1, windowStartedAtMs: now });
      return;
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      existing.blockedUntilMs = now + RATE_LIMIT_BLOCK_MS;
      this.recordSuspicious(key, "rate_limit_exceeded");
      throw new Error(message);
    }

    this.rateLimits.set(key, existing);
  }

  private recordSuspicious(key: string, reason: string): void {
    const existing = this.suspiciousActivity.get(key);
    const score = (existing?.score ?? 0) + 1;
    const event: SuspiciousActivityRecord = {
      key,
      reason,
      score,
      lastObservedAt: new Date().toISOString()
    };
    this.suspiciousActivity.set(key, event);

    if (score >= SUSPICIOUS_SCORE_THRESHOLD) {
      this.logAudit({
        action: "email_login",
        status: "failure",
        actorRef: key,
        metadata: { suspicious: true, reason, score }
      });
    }
  }

  private logAudit(event: Omit<AuthAuditEvent, "id" | "timestamp">): void {
    this.auditLog.push({
      id: `audit_${randomToken(10)}`,
      timestamp: new Date().toISOString(),
      ...event
    });

    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  private async requireUser(userId: string): Promise<AuthUser> {
    const users = await this.getUsers();
    const user = users[userId];
    if (!user) {
      throw new Error("Unknown user.");
    }
    return user;
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

  private async getUsernameIndex(): Promise<Record<string, string>> {
    return (await getEncryptedJson<Record<string, string>>(this.storage, USERNAME_INDEX_KEY, this.encryptionSecret)) ?? {};
  }

  private async saveUsernameIndex(index: Record<string, string>): Promise<void> {
    await setEncryptedJson(this.storage, USERNAME_INDEX_KEY, index, this.encryptionSecret);
  }

  private async getUsernameReservations(): Promise<Record<string, UsernameReservationRecord>> {
    const all =
      (await getEncryptedJson<Record<string, UsernameReservationRecord>>(this.storage, USERNAME_RESERVATIONS_KEY, this.encryptionSecret)) ??
      {};
    const now = Date.now();
    for (const [key, value] of Object.entries(all)) {
      if (value.expiresAtMs < now) {
        delete all[key];
      }
    }
    return all;
  }

  private async saveUsernameReservations(reservations: Record<string, UsernameReservationRecord>): Promise<void> {
    await setEncryptedJson(this.storage, USERNAME_RESERVATIONS_KEY, reservations, this.encryptionSecret);
  }

  private async getAvatarUploads(): Promise<Record<string, AvatarUploadRecord>> {
    return (await getEncryptedJson<Record<string, AvatarUploadRecord>>(this.storage, AVATAR_UPLOADS_KEY, this.encryptionSecret)) ?? {};
  }

  private async saveAvatarUploads(uploads: Record<string, AvatarUploadRecord>): Promise<void> {
    await setEncryptedJson(this.storage, AVATAR_UPLOADS_KEY, uploads, this.encryptionSecret);
  }
}
