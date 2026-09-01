import "server-only";

import { LOCAL_MODE } from "@/lib/local/mode";
import type { XTilesAdapter } from "@/lib/xtiles/adapter";

/**
 * Picks the xTiles transport. Local mode gets the file-backed fake, so the
 * whole closing ritual can be walked through without an xTiles account.
 */
let cached: XTilesAdapter | null = null;

export async function xtiles(): Promise<XTilesAdapter> {
  if (cached) return cached;
  if (LOCAL_MODE) {
    const { FakeXTiles } = await import("@/lib/xtiles/fake");
    cached = new FakeXTiles("file");
  } else {
    const { XTilesHttpAdapter } = await import("@/lib/xtiles/http");
    cached = new XTilesHttpAdapter();
  }
  return cached;
}
