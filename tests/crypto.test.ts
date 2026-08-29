import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DecryptionError,
  decryptTranscript,
  destroyedKeyBytes,
  encryptTranscript,
  generateSessionKey,
  isDestroyedKey,
  MasterKeyError,
  sessionAad,
  SessionKeyDestroyedError,
  unwrapSessionKey,
  wrapSessionKey,
} from "@/lib/echo/crypto";

const MASTER_A = randomBytes(32).toString("base64");
const MASTER_B = randomBytes(32).toString("base64");

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const AAD = sessionAad(SESSION_ID, USER_ID);

const SECRET = JSON.stringify({
  v: 1,
  messages: [{ role: "user", content: "something I would not want read back to me" }],
});

beforeEach(() => {
  process.env.SESSION_MASTER_KEY = MASTER_A;
});

describe("master key handling", () => {
  it("refuses to run without a master key", () => {
    delete process.env.SESSION_MASTER_KEY;
    expect(() => wrapSessionKey(generateSessionKey())).toThrow(MasterKeyError);
  });

  it("refuses a master key that is not 32 bytes", () => {
    process.env.SESSION_MASTER_KEY = randomBytes(16).toString("base64");
    expect(() => wrapSessionKey(generateSessionKey())).toThrow(MasterKeyError);
  });
});

describe("payload encryption", () => {
  it("round-trips a transcript", () => {
    const key = generateSessionKey();
    const { nonce, ciphertext } = encryptTranscript(SECRET, key, AAD);
    expect(decryptTranscript(ciphertext, nonce, key, AAD)).toBe(SECRET);
  });

  it("never leaves plaintext in the ciphertext", () => {
    const key = generateSessionKey();
    const { ciphertext } = encryptTranscript(SECRET, key, AAD);
    expect(ciphertext.toString("utf8")).not.toContain("would not want read back");
    expect(ciphertext.toString("latin1")).not.toContain("messages");
  });

  it("uses a fresh nonce for every encryption", () => {
    const key = generateSessionKey();
    const first = encryptTranscript(SECRET, key, AAD);
    const second = encryptTranscript(SECRET, key, AAD);
    expect(first.nonce.equals(second.nonce)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it("rejects the wrong session key", () => {
    const { nonce, ciphertext } = encryptTranscript(SECRET, generateSessionKey(), AAD);
    expect(() => decryptTranscript(ciphertext, nonce, generateSessionKey(), AAD)).toThrow(
      DecryptionError,
    );
  });

  it("rejects a tampered ciphertext", () => {
    const key = generateSessionKey();
    const { nonce, ciphertext } = encryptTranscript(SECRET, key, AAD);
    const tampered = Buffer.from(ciphertext);
    tampered[0] = (tampered[0]! ^ 0xff) & 0xff;
    expect(() => decryptTranscript(tampered, nonce, key, AAD)).toThrow(DecryptionError);
  });

  it("rejects a payload transplanted into another session's row", () => {
    const key = generateSessionKey();
    const { nonce, ciphertext } = encryptTranscript(SECRET, key, AAD);
    const otherRow = sessionAad("33333333-3333-4333-8333-333333333333", USER_ID);
    expect(() => decryptTranscript(ciphertext, nonce, key, otherRow)).toThrow(DecryptionError);
  });

  it("rejects a payload transplanted to another user", () => {
    const key = generateSessionKey();
    const { nonce, ciphertext } = encryptTranscript(SECRET, key, AAD);
    const otherUser = sessionAad(SESSION_ID, "44444444-4444-4444-8444-444444444444");
    expect(() => decryptTranscript(ciphertext, nonce, key, otherUser)).toThrow(DecryptionError);
  });
});

describe("key wrapping", () => {
  it("round-trips a session key", () => {
    const key = generateSessionKey();
    expect(unwrapSessionKey(wrapSessionKey(key)).equals(key)).toBe(true);
  });

  it("does not store the session key in the clear", () => {
    const key = generateSessionKey();
    const wrapped = wrapSessionKey(key);
    expect(wrapped.includes(key)).toBe(false);
  });

  it("cannot be unwrapped with a different master key", () => {
    const wrapped = wrapSessionKey(generateSessionKey());
    process.env.SESSION_MASTER_KEY = MASTER_B;
    expect(() => unwrapSessionKey(wrapped)).toThrow(DecryptionError);
  });

  it("recognises a destroyed key and says so distinctly", () => {
    const wrapped = wrapSessionKey(generateSessionKey());
    const zeroed = destroyedKeyBytes(wrapped.length);
    expect(isDestroyedKey(zeroed)).toBe(true);
    expect(isDestroyedKey(wrapped)).toBe(false);
    expect(() => unwrapSessionKey(zeroed)).toThrow(SessionKeyDestroyedError);
  });
});
