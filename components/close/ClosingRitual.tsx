"use client";

import { useEffect, useState } from "react";

import { EchoLoader } from "@/components/EchoLoader";
import { EchoMark } from "@/components/EchoMark";
import { fieldId, filledFields, formatEntryDate, type Distillation } from "@/lib/echo/schema";

/**
 * The closing ritual.
 *
 * Someone is ending a conversation they may have been having for days. The
 * pacing matters more than the pixels: nothing is destroyed until they have
 * seen what was drawn out and said what to keep, and every failure message
 * makes clear the conversation is still there.
 *
 * Everything is opted IN. Nothing is pre-ticked, because a default of "keep it
 * all" is not a choice, and a default of "keep nothing" is a trap.
 */

type Stage = "confirm" | "distilling" | "choosing" | "writing" | "done" | "failed";

interface Proposal {
  sessionId: string;
  distillation: Distillation;
}

export function ClosingRitual() {
  const [stage, setStage] = useState<Stage>("confirm");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);

  // Leaving the page mid-ritual should not leave the conversation stuck in
  // 'closing', unable to accept new turns.
  useEffect(() => {
    if (stage !== "choosing") return;
    const putItBack = () => {
      navigator.sendBeacon?.(
        "/api/close",
        new Blob([JSON.stringify({ action: "abandon" })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", putItBack);
    return () => window.removeEventListener("pagehide", putItBack);
  }, [stage]);

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error ?? "Something went wrong.");
      (error as Error & { retryable?: boolean }).retryable = body.retryable ?? true;
      throw error;
    }
    return body;
  }

  async function begin() {
    setStage("distilling");
    setMessage(null);
    try {
      const result = (await post({ action: "propose" })) as Proposal;
      setProposal(result);
      setStage("choosing");
    } catch (error) {
      setMessage((error as Error).message);
      setRetryable((error as Error & { retryable?: boolean }).retryable ?? true);
      setStage("failed");
    }
  }

  async function commit() {
    if (!proposal) return;
    setStage("writing");
    setMessage(null);
    try {
      await post({
        action: "commit",
        sessionId: proposal.sessionId,
        distillation: proposal.distillation,
        keptIds: [...kept],
        // So the entry is dated on the person's own day, not the server's.
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setStage("done");
    } catch (error) {
      setMessage((error as Error).message);
      setRetryable((error as Error & { retryable?: boolean }).retryable ?? true);
      setStage("failed");
    }
  }

  function toggle(id: string) {
    setKept((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (stage === "confirm") {
    return (
      <Shell title="Finish this conversation?">
        <p className="text-ink-soft">
          I&rsquo;ll read back through it and draw out what seems to matter. You choose what to
          keep — that goes into your own xTiles workspace. Everything else is destroyed, including
          every word either of us wrote.
        </p>
        <p className="text-ink-soft">There is no way to undo that, and no hurry to do it.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Primary onClick={begin}>Show me what you found</Primary>
          <Secondary href="/chat">Not yet</Secondary>
        </div>
      </Shell>
    );
  }

  if (stage === "distilling") {
    return (
      <Shell title="Reading back through it">
        <EchoLoader label="This takes a moment. Nothing has been changed yet." />
      </Shell>
    );
  }

  if (stage === "choosing" && proposal) {
    const entry = proposal.distillation.entry;
    const fields = filledFields(proposal.distillation);
    const nothing = !entry || fields.length === 0;

    return (
      <Shell title="What would you like to keep?">
        {nothing ? (
          <p className="text-ink-soft">
            Nothing stood out clearly enough to carry forward — which happens, and is not a
            failure. You can still end the conversation, or keep going.
          </p>
        ) : (
          <p className="text-ink-soft">
            This is the page I&rsquo;d add to your EchoMap. Tick what you want kept. Anything you
            leave unticked is destroyed with the rest.
          </p>
        )}

        {entry && fields.length > 0 ? (
          <Group
            title={`${formatEntryDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)} — ${entry.title}`}
            subtitle="Your EchoMap entry for this conversation"
          >
            {fields.map((field) => (
              <Choice
                key={field.key}
                id={fieldId(field.key)}
                kind={field.label}
                text={field.text}
                checked={kept.has(fieldId(field.key))}
                onToggle={toggle}
              />
            ))}
            <p className="px-1 text-xs leading-relaxed text-ink-soft">
              The date, the title, and a space marked &ldquo;My Reflection&rdquo; come with whatever
              you keep. That space is yours to write in later; I never do.
            </p>
          </Group>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Primary onClick={commit}>
            {kept.size === 0
              ? "End without keeping anything"
              : `Keep ${kept.size} ${kept.size === 1 ? "part" : "parts"} and end`}
          </Primary>
          <Secondary href="/chat" onNavigate={() => post({ action: "abandon" })}>
            Go back
          </Secondary>
        </div>
      </Shell>
    );
  }

  if (stage === "writing") {
    return (
      <Shell title="Writing to your workspace">
        <EchoLoader label="Your conversation is still here until this succeeds." />
      </Shell>
    );
  }

  if (stage === "done") {
    return (
      <Shell title="It&rsquo;s finished">
        <p className="text-ink-soft">
          {kept.size > 0
            ? "What you kept is in your xTiles workspace. Everything else is gone — the transcript, the key that could read it, all of it."
            : "Everything is gone — the transcript, the key that could read it, all of it. That was your call and it has been honoured."}
        </p>
        <Secondary href="/chat">Start something new</Secondary>
      </Shell>
    );
  }

  return (
    <Shell title="That didn&rsquo;t work">
      <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm leading-relaxed text-ink">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        {retryable ? <Primary onClick={proposal ? commit : begin}>Try again</Primary> : null}
        <Secondary href="/chat">Back to the conversation</Secondary>
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-4 px-5 py-14">
      <span className="mb-2 flex items-center gap-2">
        <EchoMark size={22} />
        <span className="text-sm font-medium tracking-tight text-ink-soft">EchoMe</span>
      </span>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      {children}
    </main>
  );
}

function Group({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 flex flex-col gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="-mt-1 text-xs text-ink-soft">{subtitle}</p>
      <div className="mt-1 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Choice({
  id,
  kind,
  text,
  checked,
  onToggle,
}: {
  id: string;
  kind: string;
  text: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition ${
        checked ? "border-ink bg-raised" : "border-line"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="mt-1 size-4 shrink-0 accent-current"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs uppercase tracking-wide text-ink-soft">{kind}</span>
        <span className="text-base leading-snug">{text}</span>
      </span>
    </label>
  );
}

function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-accent px-6 py-2.5 text-base font-medium text-on-accent transition disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Secondary({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className="rounded-full border border-line px-6 py-2.5 text-base text-ink-soft transition hover:border-accent hover:text-ink"
    >
      {children}
    </a>
  );
}
