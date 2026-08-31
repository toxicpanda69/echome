/**
 * Preflight check. Answers one question: is this app ready to run for real?
 *
 * Run it after filling in .env.local:
 *   npm run doctor
 *
 * It never prints a secret. Keys are reported as present/absent and by length,
 * never by value, so the output is safe to paste into a chat or a ticket.
 */

import { createClient } from "@supabase/supabase-js";

const PASS = "\u001b[32m PASS \u001b[0m";
const FAIL = "\u001b[31m FAIL \u001b[0m";
const WARN = "\u001b[33m WARN \u001b[0m";

let failures = 0;
let warnings = 0;

function report(status, label, detail) {
  if (status === FAIL) failures += 1;
  if (status === WARN) warnings += 1;
  console.log(`${status} ${label}${detail ? `\n         ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

// ---------------------------------------------------------------------------

const LOCAL_MODE = process.env.ECHOME_LOCAL_MODE === "1";

section(LOCAL_MODE ? "Environment (local mode)" : "Environment");

if (LOCAL_MODE) {
  report(
    WARN,
    "Local mode is ON",
    "Authentication is fake and sessions live in .echome-local/. Never deploy this.",
  );
}

// In local mode Supabase is not used at all, so requiring its variables would
// send someone hunting for credentials they do not need.
const REQUIRED = LOCAL_MODE
  ? ["SESSION_MASTER_KEY"]
  : [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "ANTHROPIC_API_KEY",
      "SESSION_MASTER_KEY",
    ];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length === REQUIRED.length && !LOCAL_MODE) {
  report(FAIL, "No environment loaded", "Copy .env.example to .env.local and fill it in.");
} else if (missing.length > 0) {
  report(FAIL, "Missing variables", missing.join(", "));
} else {
  report(PASS, `Required variable${REQUIRED.length === 1 ? "" : "s"} present`);
}

const placeholders = REQUIRED.filter((name) => (process.env[name] ?? "").includes("placeholder"));
if (placeholders.length > 0) {
  report(
    FAIL,
    "Placeholder values still in place",
    `${placeholders.join(", ")} — these are the fakes from scaffolding, not real credentials.`,
  );
}

// SESSION_MASTER_KEY must decode to exactly 32 bytes or AES-256 cannot use it.
const masterKey = process.env.SESSION_MASTER_KEY;
if (masterKey) {
  const decoded = Buffer.from(masterKey, "base64");
  if (decoded.length === 32) {
    report(PASS, "SESSION_MASTER_KEY is 32 bytes");
  } else {
    report(
      FAIL,
      `SESSION_MASTER_KEY decodes to ${decoded.length} bytes, needs 32`,
      `Regenerate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
}

// ---------------------------------------------------------------------------

section("Supabase");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (LOCAL_MODE) {
  report(WARN, "Skipped Supabase checks", "Local mode does not use Supabase.");
} else if (url && serviceKey && anonKey && !placeholders.length) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  // Does the migration exist? Each table is probed with a zero-row count, which
  // touches no data.
  for (const table of ["profiles", "live_sessions", "turn_telemetry"]) {
    const { error } = await admin.from(table).select("*", { count: "exact", head: true });
    if (!error) {
      report(PASS, `table ${table} exists`);
    } else if (error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) {
      report(
        FAIL,
        `table ${table} is missing`,
        "Run supabase/migrations/0001_init.sql in the SQL editor.",
      );
    } else {
      report(FAIL, `table ${table} unreachable`, `${error.code ?? ""} ${error.message}`);
    }
  }

  // The rule that matters: an anon caller must not be able to read a session
  // row, encrypted or not.
  const { data: leak, error: leakError } = await anon.from("live_sessions").select("id").limit(1);
  if (leakError || (Array.isArray(leak) && leak.length === 0)) {
    report(PASS, "live_sessions is unreadable with the anon key", "RLS is doing its job.");
  } else {
    report(FAIL, "live_sessions IS READABLE with the anon key", "RLS is not configured correctly.");
  }

  const { data: telemetryLeak, error: telemetryError } = await anon
    .from("turn_telemetry")
    .select("id")
    .limit(1);
  if (telemetryError || (Array.isArray(telemetryLeak) && telemetryLeak.length === 0)) {
    report(PASS, "turn_telemetry is unreadable with the anon key");
  } else {
    report(FAIL, "turn_telemetry IS READABLE with the anon key");
  }
} else {
  report(WARN, "Skipped Supabase checks", "Fill in the Supabase values first.");
}

// ---------------------------------------------------------------------------

section("Anthropic");

const apiKey = process.env.ANTHROPIC_API_KEY;
if (apiKey && !apiKey.includes("placeholder")) {
  try {
    // A model listing validates the key without spending anything.
    const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });

    if (response.status === 401) {
      report(FAIL, "API key rejected", "Check the key at console.anthropic.com.");
    } else if (!response.ok) {
      report(FAIL, `Model list returned ${response.status}`);
    } else {
      report(PASS, "API key accepted");
      if (LOCAL_MODE) {
        report(PASS, "Replies will come from real Claude, not the local stub");
      }
      const body = await response.json();
      const ids = (body.data ?? []).map((model) => model.id);
      if (ids.includes("claude-opus-5")) {
        report(PASS, "claude-opus-5 is available to this key");
      } else {
        report(
          FAIL,
          "claude-opus-5 is NOT available to this key",
          `Models offered: ${ids.slice(0, 6).join(", ") || "none"}`,
        );
      }
    }
  } catch (error) {
    report(FAIL, "Could not reach api.anthropic.com", error.name);
  }
} else if (LOCAL_MODE) {
  report(
    WARN,
    "No ANTHROPIC_API_KEY — replies will come from the local stub",
    "Add a real key to .env.local and restart to talk to Claude.",
  );
} else {
  report(WARN, "Skipped Anthropic check", "Fill in ANTHROPIC_API_KEY first.");
}

// ---------------------------------------------------------------------------

console.log();
if (failures > 0) {
  console.log(`\u001b[31m${failures} check(s) failed.\u001b[0m Fix those and run again.`);
  process.exit(1);
}
console.log(
  warnings > 0
    ? `\u001b[33mReady, with ${warnings} check(s) skipped.\u001b[0m`
    : "\u001b[32mEverything is ready. Run: npm run dev\u001b[0m",
);
