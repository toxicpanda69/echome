/**
 * Always on screen while local mode is running. It is deliberately loud: the
 * one failure this whole feature has to avoid is somebody believing they are
 * looking at the real, authenticated app.
 */
export function LocalModeBanner() {
  return (
    <div className="border-b border-amber-400/50 bg-amber-100 px-4 py-2 text-center text-xs leading-relaxed text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/60 dark:text-amber-100">
      <strong className="font-semibold">Local mode.</strong> Sign-in is fake and there is no
      database — sessions live in <code className="font-mono">.echome-local/</code>. Encryption is
      real.
    </div>
  );
}
