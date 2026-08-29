"use client";

import { useRef, type FormEvent, type KeyboardEvent } from "react";

interface ComposerProps {
  readonly disabled: boolean;
  readonly onSend: (text: string) => void;
}

export function Composer({ disabled, onSend }: ComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const element = textarea.current;
    if (!element) return;
    const text = element.value.trim();
    if (text.length === 0 || disabled) return;
    element.value = "";
    // Nothing is written to localStorage here or anywhere else in this app. A
    // draft lives in this textarea and in this tab's memory, and nowhere else.
    onSend(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on a physical keyboard; Shift+Enter makes a new line. On
    // touch keyboards Enter always makes a new line, because sending a half
    // finished thought by accident is worse than an extra tap.
    if (event.key !== "Enter" || event.shiftKey) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    submit();
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-line bg-page px-4 pt-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <textarea
        ref={textarea}
        name="message"
        rows={1}
        onKeyDown={onKeyDown}
        placeholder="What's on your mind?"
        aria-label="Your message"
        className="max-h-48 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-raised px-4 py-2.5 text-base leading-relaxed outline-none transition focus:border-ink-soft"
      />
      <button
        type="submit"
        disabled={disabled}
        className="mb-0.5 shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-page transition disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
