import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/server";

export default async function Home() {
  redirect((await getUser()) ? "/chat" : "/login");
}
