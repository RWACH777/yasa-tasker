/**
 * walletEncryption.ts
 * Server-side only — never import in client components.
 *
 * AES-256-GCM symmetric encryption for Pi wallet addresses.
 * Requires env var: WALLET_ENCRYPTION_KEY (64 hex chars = 32 bytes)
 * Generate with: openssl rand -hex 32
 *
 * Encrypted format: "enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Plain (legacy/Pi-SDK) values are returned as-is.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY || "";
  if (hex.length !== 64) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypts a Pi wallet address. Returns "enc:<iv>:<tag>:<ciphertext>" */
export function encryptWallet(plainAddress: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainAddress, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    iv.toString("hex") +
    ":" +
    authTag.toString("hex") +
    ":" +
    encrypted.toString("hex")
  );
}

/** Decrypts a wallet address. Passes through plain (legacy) values unchanged. */
export function decryptWallet(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) {
    return stored; // Legacy Pi-SDK value — plain text, return as-is
  }

  const key = getKey();
  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted wallet format");
  }

  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Returns true if the string is an encrypted wallet value. */
export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

/** Validates a Pi (Stellar) wallet address format: starts with G, 56 alphanumeric chars. */
export function isValidPiWallet(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

/** Returns a masked version for display: G****...****SM */
export function maskWallet(address: string): string {
  if (!address || address.length < 8) return "****";
  return address.slice(0, 4) + "****..." + address.slice(-4);
}
