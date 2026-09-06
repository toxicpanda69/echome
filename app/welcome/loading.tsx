import { EchoLoader } from "@/components/EchoLoader";

export default function WelcomeLoading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5">
      <EchoLoader />
    </main>
  );
}
