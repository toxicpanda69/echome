/**
 * Always on screen while local mode is running. It is deliberately loud: the
 * one failure this whole feature has to avoid is somebody believing they are
 * looking at the real, authenticated app.
 */
export function LocalModeBanner() {
  return (
    <div className="border-b border-warn/40 bg-warn-soft px-4 py-2 text-center text-xs leading-relaxed text-ink">
      <strong className="font-semibold">Local mode.</strong> Sign-in is fake and there is no
      database — sessions live in <code className="font-mono">.echome-local/</code>. Encryption is
      real.
    </div>
  );
}
