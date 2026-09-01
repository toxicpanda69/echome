import "server-only";

import type { Distillation } from "@/lib/echo/schema";

/**
 * The xTiles seam.
 *
 * From the build brief: "Put every xTiles call behind one adapter interface
 * with a local fake implementation, so the app is testable and so we can swap
 * the transport if the API turns out to work differently than documented."
 *
 * That last clause is doing real work. We have no xTiles API documentation, so
 * the HTTP implementation below is a shell that refuses rather than a guess
 * that half-works. The interface, the fake, the retry semantics and everything
 * that depends on them are complete and tested. Wiring the real transport is
 * one file.
 */

export interface XTilesIdentity {
  readonly workspaceId: string;
  readonly displayName: string | null;
}

export interface WriteResult {
  /** Where it landed, so a person can find it and we can retry idempotently. */
  readonly ref: string;
  readonly writtenAt: string;
}

export interface XTilesAdapter {
  /** Whether this user has a usable connection right now. */
  isConnected(userId: string): Promise<boolean>;

  identity(userId: string): Promise<XTilesIdentity | null>;

  /** Read back what is already in their workspace, for the ritual to show. */
  readExisting(userId: string): Promise<Distillation>;

  /**
   * Write kept entries into the user's own workspace.
   *
   * MUST be idempotent on `idempotencyKey`. The closing ritual retries, and a
   * retry that duplicates someone's Compass is a bug they will see forever.
   */
  write(
    userId: string,
    distillation: Distillation,
    idempotencyKey: string,
  ): Promise<WriteResult>;
}

/** Raised when the write did not happen. The session must survive this. */
export class XTilesWriteError extends Error {
  override readonly name = "XTilesWriteError";
  constructor(
    readonly reason: string,
    /** Whether trying again might work. A 401 is not worth retrying. */
    readonly retryable: boolean,
  ) {
    super(`xTiles write failed: ${reason}`);
  }
}

export class XTilesNotConnectedError extends Error {
  override readonly name = "XTilesNotConnectedError";
  constructor() {
    super("This account is not connected to an xTiles workspace.");
  }
}
