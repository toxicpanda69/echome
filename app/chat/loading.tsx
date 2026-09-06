import { EchoLoader } from "@/components/EchoLoader";

/** Shown while the server resumes or starts the session — decryption and
    session setup happen before anything streams to the browser. */
export default function ChatLoading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5">
      <EchoLoader label="Opening your conversation" />
    </main>
  );
}
