import "server-only";

import type { MapPage } from "@/lib/echo/schema";
import { readTokens } from "@/lib/xtiles/tokens";
import {
  XTilesNotConnectedError,
  XTilesWriteError,
  type WriteResult,
  type XTilesAdapter,
  type XTilesIdentity,
} from "@/lib/xtiles/adapter";

/**
 * The real xTiles transport.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  NOT IMPLEMENTED — WE HAVE NO XTILES API DOCUMENTATION.
 *
 *  Every method below throws a clear error rather than guessing at endpoints,
 *  payload shapes or auth. That is deliberate: a plausible-looking client
 *  written against an imagined API fails at the worst possible moment — the
 *  first time a real person closes a real conversation — and it fails silently,
 *  because it will happily 404 and look like a network blip.
 *
 *  What IS finished and tested around this file:
 *    - the adapter interface it satisfies       lib/xtiles/adapter.ts
 *    - a working fake with idempotency          lib/xtiles/fake.ts
 *    - encrypted token storage                  lib/xtiles/tokens.ts
 *    - the OAuth connect/callback routes        app/api/xtiles/*
 *    - the closing ritual and its retry path    lib/echo/ritual.ts
 *
 *  TO FINISH THIS FILE you need, from xTiles:
 *    1. the OAuth authorise and token URLs, and the scope needed to write
 *    2. the endpoint that creates or updates a view, and its payload shape
 *    3. whether it honours an idempotency key header — and if not, what to
 *       query to make `write` idempotent by hand
 *    4. the refresh-token semantics and token lifetime
 *
 *  Fill in the four methods. Nothing else in the codebase needs to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const NOT_IMPLEMENTED =
  "The xTiles HTTP transport is not implemented — see the note at the top of " +
  "lib/xtiles/http.ts for exactly what is needed from their API.";

export class XTilesHttpAdapter implements XTilesAdapter {
  async isConnected(userId: string): Promise<boolean> {
    // This much works today: a connection exists if we hold usable tokens.
    const tokens = await readTokens(userId);
    return tokens !== null && (tokens.expiresAt === null || tokens.expiresAt > new Date());
  }

  async identity(userId: string): Promise<XTilesIdentity | null> {
    const tokens = await readTokens(userId);
    if (!tokens) return null;
    throw new Error(NOT_IMPLEMENTED);
  }

  async readExisting(userId: string): Promise<readonly MapPage[]> {
    if (!(await this.isConnected(userId))) throw new XTilesNotConnectedError();
    throw new Error(NOT_IMPLEMENTED);
  }

  async write(userId: string): Promise<WriteResult> {
    if (!(await this.isConnected(userId))) throw new XTilesNotConnectedError();
    // Reported as retryable so the ritual keeps the session alive rather than
    // treating this as a permanent failure and giving up on the conversation.
    throw new XTilesWriteError(NOT_IMPLEMENTED, true);
  }
}
