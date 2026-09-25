import { EchoMark } from "@/components/EchoMark";

/** The mark plus wordmark, used at the top of every screen that isn't the
    card-based auth shell (which carries its own smaller version). */
export function BrandHeader({ trailing }: { trailing?: React.ReactNode }) {
  return (
    // pl-14 leaves room for the fixed theme toggle in the top-left corner.
    <header className="flex items-center justify-between border-b border-line py-3 pl-14 pr-4">
      <span className="flex items-center gap-2">
        <EchoMark size={24} />
        <span className="text-sm font-medium tracking-tight">EchoMe</span>
      </span>
      {trailing}
    </header>
  );
}
