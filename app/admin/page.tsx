import { notFound, redirect } from "next/navigation";

import { currentUser } from "@/lib/auth/current-user";
import { LOCAL_MODE } from "@/lib/local/mode";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The admin list.
 *
 * From the build brief: "a role-gated page listing users, signup date,
 * subscription status, and session counts. Counts only — never conversation
 * content, not even for admins."
 *
 * The second sentence is enforced below the application: this page reads a
 * database view whose every column is an identifier, a date, a status or a
 * count. There is no query an admin could write here that reaches conversation
 * content, because no table holds any.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  email: string;
  signed_up_at: string;
  role: "member" | "admin";
  tier: string;
  subscription_status: string;
  conversations_closed: number;
  open_sessions: number;
  total_tokens: number;
  last_active_at: string | null;
}

/** Roughly, in dollars, from the published per-million rates for opus-5. */
function estimateCost(tokens: number): string {
  const dollars = (tokens / 1_000_000) * 15;
  return dollars < 0.01 ? "<$0.01" : `$${dollars.toFixed(2)}`;
}

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");

  // Local mode has no roles, and this page reads Supabase directly.
  if (LOCAL_MODE) notFound();

  const db = createAdminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  // notFound rather than a 403: an admin page that announces itself to
  // non-admins is an invitation.
  if (profile?.role !== "admin") notFound();

  const { data, error } = await db
    .from("admin_user_summary")
    .select("*")
    .order("signed_up_at", { ascending: false })
    .limit(500)
    .returns<Row[]>();

  if (error) throw error;
  const rows = data ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight">Admin</h1>
        <p className="text-sm text-ink-soft">
          {rows.length} {rows.length === 1 ? "person" : "people"} · counts only, never content
        </p>
      </header>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 text-right font-medium">Closed</th>
              <th className="px-4 py-2.5 text-right font-medium">Open</th>
              <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
              <th className="px-4 py-2.5 text-right font-medium">Est. cost</th>
              <th className="px-4 py-2.5 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  {row.email}
                  {row.role === "admin" ? (
                    <span className="ml-2 text-xs text-ink-soft">admin</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{row.signed_up_at.slice(0, 10)}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {row.tier === "none" ? "—" : `${row.tier} · ${row.subscription_status}`}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.conversations_closed}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.open_sessions}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.total_tokens.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {estimateCost(row.total_tokens)}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {row.last_active_at ? row.last_active_at.slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft">
        There is no way to view a conversation from here, and there never will be. The transcript
        of an open session is encrypted with a key belonging to that session; a closed one no
        longer exists. Cost is estimated from token counts at the published opus-5 rates.
      </p>
    </main>
  );
}
