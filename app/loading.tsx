import { EchoLoader } from "@/components/EchoLoader";

/** Fallback for any route that doesn't define its own loading UI. */
export default function RootLoading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5">
      <EchoLoader />
    </main>
  );
}
