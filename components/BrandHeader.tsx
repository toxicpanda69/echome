import { EchoMark } from "@/components/EchoMark";

/** The mark plus wordmark, used at the top of every screen that isn't the
    card-based auth shell (which carries its own smaller version). */
export function BrandHeader({ trailing }: { trailing?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-4 py-3">
      <span className="flex items-center gap-2">
        <EchoMark size={24} />
        <span className="text-sm font-medium tracking-tight">EchoMe</span>
      </span>
      {trailing}
    </header>
  );
}
