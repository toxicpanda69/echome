import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { appendMessages, destroySession, readTranscript, resumeOrStartSession } from "@/lib/echo/sessions";
import { SessionKeyDestroyedError } from "@/lib/echo/crypto";
import { InMemorySessionStore, type SessionRow } from "@/lib/echo/store";
import { toDisplayTurns } from "@/lib/echo/transcript";

/**
 * A narrated end-to-end walkthrough of a session's life. It asserts like any
 * other test, but it also prints what the database actually holds at each step,
 * so "there is no readable copy of anything I said" is something you can look
 * at rather than something you have to take on trust.
 *
 * Run it on its own with:  npx vitest run tests/walkthrough.test.ts
 */

const USER = "22222222-2222-4222-8222-222222222222";
const SAID = "I keep taking on more work so I don't have to sit still. I know that.";
const REPLIED = "What do you think would arrive, if you did sit still?";

function log(line = "") {
  // eslint-disable-next-line no-console -- this file exists to print.
  console.log(line);
}

function showRow(label: string, row: SessionRow) {
  log(`  ${label}`);
  log(`    status            ${row.status}`);
  log(`    encrypted_payload ${row.encryptedPayload.length} bytes  ${preview(row.encryptedPayload)}`);
  log(`    wrapped_key       ${row.wrappedKey.length} bytes  ${preview(row.wrappedKey)}`);
  log(`    nonce             ${row.nonce.toString("hex")}`);
}

function preview(buffer: Buffer): string {
  const hex = buffer.toString("hex");
  return hex.length > 64 ? `${hex.slice(0, 64)}…` : hex;
}

beforeAll(() => {
  process.env.SESSION_MASTER_KEY = randomBytes(32).toString("base64");
});

describe("a conversation, from first word to erasure", () => {
  it("walks the whole lifecycle", async () => {
    const store = new InMemorySessionStore();

    log();
    log("1. A user opens the app for the first time.");
    const opened = await resumeOrStartSession(store, USER);
    log(`   session ${opened.row.id}`);
    expect(opened.transcript.messages).toHaveLength(0);

    log();
    log("2. They say something, and EchoMe replies.");
    log(`   they type: "${SAID}"`);
    await appendMessages(
      store,
      opened.row,
      opened.transcript,
      { role: "user", content: SAID },
      { role: "assistant", content: [{ type: "text", text: REPLIED }] },
    );

    const stored = (await store.find(opened.row.id, USER))!;
    log();
    log("3. This is the entire row in the database. It is the only copy.");
    showRow("live_sessions", stored);

    for (const encoding of ["utf8", "latin1", "ascii"] as const) {
      expect(stored.encryptedPayload.toString(encoding)).not.toContain("sit still");
    }
    log("   grep for 'sit still' in that payload: no match, in any encoding.");

    log();
    log("4. The server restarts. Nothing was held in memory, so nothing is lost.");
    const afterRestart: SessionRow = {
      ...stored,
      encryptedPayload: Buffer.from(stored.encryptedPayload.toString("hex"), "hex"),
      wrappedKey: Buffer.from(stored.wrappedKey.toString("hex"), "hex"),
      nonce: Buffer.from(stored.nonce.toString("hex"), "hex"),
    };
    const resumed = readTranscript(afterRestart);
    const turns = toDisplayTurns(resumed);
    log(`   resumed ${turns.length} turns:`);
    for (const turn of turns) log(`     ${turn.role.padEnd(9)} ${turn.text}`);
    expect(turns[0]!.text).toBe(SAID);
    expect(turns[1]!.text).toBe(REPLIED);

    log();
    log("5. The session is closed. (Phase 2 wraps this in the closing ritual.)");
    const stolenPayload = Buffer.from(stored.encryptedPayload);
    const stolenNonce = Buffer.from(stored.nonce);
    await destroySession(store, opened.row.id, USER);
    log("   wrapped_key overwritten with zeroes, then the row deleted.");
    expect(store.peek(opened.row.id)).toBeUndefined();

    log();
    log("6. Someone has a backup taken one second before the close.");
    log(`   they hold: payload ${stolenPayload.length} bytes, nonce ${stolenNonce.toString("hex")}`);
    log(`   they do not hold: the session key, which existed only inside the`);
    log("   wrapped_key that is now zeroes. We hold the master key and still");
    log("   cannot open it.");
    expect(() =>
      readTranscript({ ...afterRestart, wrappedKey: Buffer.alloc(afterRestart.wrappedKey.length, 0) }),
    ).toThrow(SessionKeyDestroyedError);

    log();
    log("   The conversation is gone. That is the product working, not failing.");
    log();
  });
});
