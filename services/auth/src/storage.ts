import { decryptValue, encryptValue } from "./crypto";
import type { EncryptedStorage, EncryptedValue, SecureTokenStore } from "./types";

export class InMemoryEncryptedStorage implements EncryptedStorage {
  private readonly data = new Map<string, EncryptedValue>();

  async get(key: string): Promise<EncryptedValue | undefined> {
    return this.data.get(key);
  }

  async set(key: string, value: EncryptedValue): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export class InMemorySecureTokenStore implements SecureTokenStore {
  private refreshToken?: string;

  async setRefreshToken(token: string): Promise<void> {
    this.refreshToken = token;
  }

  async getRefreshToken(): Promise<string | undefined> {
    return this.refreshToken;
  }

  async clear(): Promise<void> {
    this.refreshToken = undefined;
  }
}

export const setEncryptedJson = async <T>(storage: EncryptedStorage, key: string, value: T, secret: string): Promise<void> => {
  const encrypted = await encryptValue(JSON.stringify(value), secret);
  await storage.set(key, encrypted);
};

export const getEncryptedJson = async <T>(storage: EncryptedStorage, key: string, secret: string): Promise<T | undefined> => {
  const encrypted = await storage.get(key);
  if (!encrypted) return undefined;

  const plaintext = await decryptValue(encrypted, secret);
  return JSON.parse(plaintext) as T;
};
