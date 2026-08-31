import { redirect } from "next/navigation";

import { currentUser } from "@/lib/auth/current-user";

export default async function Home() {
  redirect((await currentUser()) ? "/chat" : "/login");
}
