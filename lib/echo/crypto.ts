import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for live session transcripts.
 *
 * Two layers:
 *   1. Each session gets its own random 32-byte data key. That key, and only
 *      that key, ever touches the transcript.
 *   2. The data key is itself encrypted ("wrapped") under SESSION_MASTER_KEY
 *      and the wrapped form is what the database stores.
 *
 * The master key therefore never encrypts a transcript directly, and destroying
 * one session's wrapped key destroys exactly one conversation and nothing else.
 *
 * Both layers are AES-256-GCM. GCM is authenticated, so a tampered or
 * transplanted ciphertext fails loudly rather than decrypting to garbage.
 */

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const ALGORITHM = "aes-256-gcm";

/** Domain separation, so a wrapped key can never be replayed as a payload. */
const KEY_WRAP_AAD = Buffer.from("echome:key-wrap:v1", "utf8");

/**
 * Raised when a payload will not decrypt: wrong key, corrupted bytes, or a
 * payload moved between rows. Deliberately carries no detail — the message is
 * seen by logs, and the inputs are conversation material.
 */
export class DecryptionError extends Error {
  override readonly name = "DecryptionError";
  constructor(stage: "payload" | "key-unwrap") {
    super(`Unable to decrypt (${stage}).`);
  }
}

/**
 * Raised when the wrapped key is all zeroes — the signature of a session that
 * went through destroySession(). This is a successful erasure, not a fault, and
 * callers should say so to the user rather than reporting an error.
 */
export class SessionKeyDestroyedError extends Error {
  override readonly name = "SessionKeyDestroyedError";
  constructor() {
    super("This session's key has been destroyed. The transcript is unrecoverable.");
  }
}

/** Thrown at boot rather than at first use, so a bad key fails fast. */
export class MasterKeyError extends Error {
  override readonly name = "MasterKeyError";
}

function masterKey(): Buffer {
  const raw = process.env.SESSION_MASTER_KEY;
  if (!raw) {
    throw new MasterKeyError(
      "SESSION_MASTER_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new MasterKeyError(
      `SESSION_MASTER_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`,
    );
  }
  return key;
}

/**
 * Additional authenticated data binding a payload to the row it lives in.
 * Copying ciphertext from one session (or one user) to another produces a row
 * that will not decrypt, because the AAD no longer matches.
 */
export function sessionAad(sessionId: string, userId: string): Buffer {
  return Buffer.from(`echome:session:v1:${sessionId}:${userId}`, "utf8");
}

export function generateSessionKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

function seal(plaintext: Buffer, key: Buffer, aad: Buffer): { nonce: Buffer; ciphertext: Buffer } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  // Tag is appended rather than stored separately: one blob, one column.
  return { nonce, ciphertext: Buffer.concat([body, cipher.getAuthTag()]) };
}

function open(nonce: Buffer, ciphertext: Buffer, key: Buffer, aad: Buffer): Buffer {
  const TAG_BYTES = 16;
  if (ciphertext.length < TAG_BYTES) throw new DecryptionError("payload");
  const body = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/**
 * Wrap a session data key under the master key.
 * Layout: nonce(12) ‖ ciphertext ‖ tag(16) — self-contained, so the schema needs
 * only the one `nonce` column, which belongs to the payload.
 */
export function wrapSessionKey(sessionKey: Buffer): Buffer {
  const { nonce, ciphertext } = seal(sessionKey, masterKey(), KEY_WRAP_AAD);
  return Buffer.concat([nonce, ciphertext]);
}

export function unwrapSessionKey(wrapped: Buffer): Buffer {
  if (isDestroyedKey(wrapped)) throw new SessionKeyDestroyedError();
  if (wrapped.length <= NONCE_BYTES) throw new DecryptionError("key-unwrap");
  const nonce = wrapped.subarray(0, NONCE_BYTES);
  const ciphertext = wrapped.subarray(NONCE_BYTES);
  try {
    return open(nonce, ciphertext, masterKey(), KEY_WRAP_AAD);
  } catch {
    throw new DecryptionError("key-unwrap");
  }
}

/**
 * The byte pattern destroySession() writes over a wrapped key. Same length as
 * the original, so the overwrite replaces the value in place.
 */
export function destroyedKeyBytes(length: number): Buffer {
  return Buffer.alloc(length, 0);
}

export function isDestroyedKey(wrapped: Buffer): boolean {
  return wrapped.length > 0 && wrapped.every((byte) => byte === 0);
}

export function encryptTranscript(
  plaintext: string,
  sessionKey: Buffer,
  aad: Buffer,
): { nonce: Buffer; ciphertext: Buffer } {
  return seal(Buffer.from(plaintext, "utf8"), sessionKey, aad);
}

export function decryptTranscript(
  ciphertext: Buffer,
  nonce: Buffer,
  sessionKey: Buffer,
  aad: Buffer,
): string {
  try {
    return open(nonce, ciphertext, sessionKey, aad).toString("utf8");
  } catch {
    throw new DecryptionError("payload");
  }
}
