import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assertLocalMode, LOCAL_DATA_DIR } from "@/lib/local/mode";
import {
  SessionConflictError,
  type NewSession,
  type PayloadUpdate,
  type SessionRow,
  type SessionStatus,
  type SessionStore,
} from "@/lib/echo/store";

/**
 * A SessionStore backed by a JSON file, standing in for Postgres.
 *
 * It is on disk rather than in memory for one reason: a conversation is
 * supposed to survive the server going away. An in-memory store would make
 * local mode pass a test the real product has to earn. Restart `npm run dev`
 * and the conversation is still there.
 *
 * It stores exactly what Postgres stores — ciphertext and a wrapped key, as
 * hex. Open .echome-local/sessions.json and look: your words are not in it.
 */

interface StoredRow {
  id: string;
  userId: string;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
  /** Hex, the way PostgREST hands bytea back. */
  encryptedPayload: string;
  wrappedKey: string;
  nonce: string;
}

function filePath(): string {
  return join(process.cwd(), LOCAL_DATA_DIR, "sessions.json");
}

function toRow(stored: StoredRow): SessionRow {
  return {
    ...stored,
    encryptedPayload: Buffer.from(stored.encryptedPayload, "hex"),
    wrappedKey: Buffer.from(stored.wrappedKey, "hex"),
    nonce: Buffer.from(stored.nonce, "hex"),
  };
}

function toStored(row: SessionRow): StoredRow {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
    encryptedPayload: row.encryptedPayload.toString("hex"),
    wrappedKey: row.wrappedKey.toString("hex"),
    nonce: row.nonce.toString("hex"),
  };
}

/**
 * Read and write on every operation rather than caching. The file is tiny, and
 * Next's dev server discards module state on hot reload — a cache would make
 * sessions vanish when you edit a file, which is precisely the bug local mode
 * exists to rule out.
 */
function readAll(): StoredRow[] {
  try {
    return JSON.parse(readFileSync(filePath(), "utf8")) as StoredRow[];
  } catch {
    return [];
  }
}

function writeAll(rows: StoredRow[]): void {
  mkdirSync(join(process.cwd(), LOCAL_DATA_DIR), { recursive: true });
  writeFileSync(filePath(), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

export class LocalFileSessionStore implements SessionStore {
  constructor() {
    assertLocalMode();
  }

  async findOpen(userId: string): Promise<SessionRow | null> {
    const found = readAll().find((row) => row.userId === userId && row.status === "open");
    return found ? toRow(found) : null;
  }

  async find(sessionId: string, userId: string): Promise<SessionRow | null> {
    const found = readAll().find((row) => row.id === sessionId && row.userId === userId);
    return found ? toRow(found) : null;
  }

  async create(session: NewSession): Promise<SessionRow> {
    const rows = readAll();
    // Mirrors the partial unique index that enforces this in Postgres.
    if (rows.some((row) => row.userId === session.userId && row.status === "open")) {
      throw new SessionConflictError();
    }

    const now = new Date().toISOString();
    const row: SessionRow = {
      id: session.id,
      userId: session.userId,
      status: "open",
      createdAt: now,
      lastActiveAt: now,
      encryptedPayload: session.encryptedPayload,
      wrappedKey: session.wrappedKey,
      nonce: session.nonce,
    };
    writeAll([...rows, toStored(row)]);
    return row;
  }

  async savePayload(sessionId: string, userId: string, update: PayloadUpdate): Promise<void> {
    this.mutate(sessionId, userId, (row) => ({
      ...row,
      encryptedPayload: update.encryptedPayload.toString("hex"),
      nonce: update.nonce.toString("hex"),
      lastActiveAt: new Date().toISOString(),
    }));
  }

  async setStatus(sessionId: string, userId: string, status: SessionStatus): Promise<void> {
    this.mutate(sessionId, userId, (row) => ({ ...row, status }));
  }

  async overwriteWrappedKey(sessionId: string, userId: string, bytes: Buffer): Promise<void> {
    this.mutate(sessionId, userId, (row) => ({ ...row, wrappedKey: bytes.toString("hex") }));
  }

  async remove(sessionId: string, userId: string): Promise<void> {
    writeAll(readAll().filter((row) => !(row.id === sessionId && row.userId === userId)));
  }

  private mutate(sessionId: string, userId: string, change: (row: StoredRow) => StoredRow): void {
    const rows = readAll();
    const index = rows.findIndex((row) => row.id === sessionId && row.userId === userId);
    if (index === -1) return;
    rows[index] = change(rows[index]!);
    writeAll(rows);
  }
}
