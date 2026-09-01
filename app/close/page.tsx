import { redirect } from "next/navigation";

import { ClosingRitual } from "@/components/close/ClosingRitual";
import { currentUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClosePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/close");
  return <ClosingRitual />;
}
