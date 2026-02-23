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

const USERS_KEY = "auth:users";
const PHONE_CHALLENGES_KEY = "auth:phone:challenges";
const REFRESH_TOKENS_KEY = "auth:refreshTokens";
const USERNAME_INDEX_KEY = "auth:username:index";
const USERNAME_RESERVATIONS_KEY = "auth:username:reservations";
const AVATAR_UPLOADS_KEY = "auth:avatar:uploads";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$/;
const USERNAME_RESERVATION_TTL_MS = 5 * 60 * 1000;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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

    const now = new Date().toISOString();
    const user: AuthUser = {
      id: `user_${randomToken(10)}`,
      email: normalizedEmail,
      passwordHash,
      displayName: normalizedEmail.split("@")[0],
      createdAt: now,
      updatedAt: now,
      identities: [{ provider: "email", subject: normalizedEmail, verified: true }]
    };

    users[user.id] = user;
    await this.saveUsers(users);
    return this.createSession(user, true);
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

      user.username = updates.username.trim();
      user.usernameNormalized = normalizedUsername;
      usernameIndex[normalizedUsername] = userId;
      delete reservations[normalizedUsername];
    }

    if (typeof updates.displayName === "string") {
      user.displayName = updates.displayName.trim();
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
