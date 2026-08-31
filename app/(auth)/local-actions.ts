"use server";

import { redirect } from "next/navigation";

import type { AuthState } from "@/app/(auth)/actions";
import { signInLocal, signOutLocal } from "@/lib/local/auth";
import { assertLocalMode } from "@/lib/local/mode";

/**
 * Local-mode auth actions. Every one calls assertLocalMode() first, so even if
 * a route somehow reached them outside local mode they would throw rather than
 * sign anybody in.
 */

export async function localSignIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  assertLocalMode();

  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { error: "Enter any email address — it just needs to look like one." };
  }

  await signInLocal(email);

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/chat");
}

export async function localSignOut(): Promise<void> {
  assertLocalMode();
  await signOutLocal();
  redirect("/login");
}
