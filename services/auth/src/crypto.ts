import type { EncryptedValue } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const toBase64 = (bytes: Uint8Array): string => {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    output += base64Chars[(triple >> 18) & 63];
    output += base64Chars[(triple >> 12) & 63];
    output += i + 1 < bytes.length ? base64Chars[(triple >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? base64Chars[triple & 63] : "=";
  }
  return output;
};

const fromBase64 = (encoded: string): Uint8Array => {
  const clean = encoded.replace(/[^A-Za-z0-9+/=]/g, "");
  const length = (clean.length * 3) / 4 - (clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(length);
  let byteOffset = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const a = base64Chars.indexOf(clean[i] ?? "A");
    const b = base64Chars.indexOf(clean[i + 1] ?? "A");
    const c = base64Chars.indexOf(clean[i + 2] ?? "A");
    const d = base64Chars.indexOf(clean[i + 3] ?? "A");
    const triple = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);

    if (byteOffset < bytes.length) bytes[byteOffset++] = (triple >> 16) & 0xff;
    if (clean[i + 2] !== "=" && byteOffset < bytes.length) bytes[byteOffset++] = (triple >> 8) & 0xff;
    if (clean[i + 3] !== "=" && byteOffset < bytes.length) bytes[byteOffset++] = triple & 0xff;
  }

  return bytes;
};


const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const requireWebCrypto = (): Crypto => {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is required for auth operations.");
  }

  return globalThis.crypto;
};

const deriveAesKey = async (secret: string): Promise<CryptoKey> => {
  const cryptoRef = requireWebCrypto();
  const material = await cryptoRef.subtle.importKey("raw", textEncoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return cryptoRef.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textEncoder.encode("nospoilers-auth-metadata"),
      iterations: 150_000,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const sha256 = async (value: string): Promise<string> => {
  const digest = await requireWebCrypto().subtle.digest("SHA-256", textEncoder.encode(value));
  return toBase64(new Uint8Array(digest));
};

export const randomToken = (byteLength = 32): string => {
  const bytes = new Uint8Array(byteLength);
  requireWebCrypto().getRandomValues(bytes);
  return toBase64(bytes);
};

export const encryptValue = async (plaintext: string, secret: string): Promise<EncryptedValue> => {
  const cryptoRef = requireWebCrypto();
  const iv = cryptoRef.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret);
  const encrypted = await cryptoRef.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));
  return {
    iv: toBase64(iv),
    cipherText: toBase64(new Uint8Array(encrypted))
  };
};

export const decryptValue = async (encryptedValue: EncryptedValue, secret: string): Promise<string> => {
  const key = await deriveAesKey(secret);
  const plainBuffer = await requireWebCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(fromBase64(encryptedValue.iv)) },
    key,
    asArrayBuffer(fromBase64(encryptedValue.cipherText))
  );
  return textDecoder.decode(plainBuffer);
};
