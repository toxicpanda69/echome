import type { Metadata, Viewport } from "next";

import { LocalModeBanner } from "@/components/local/LocalModeBanner";
import { LOCAL_MODE } from "@/lib/local/mode";

import "./globals.css";

export const metadata: Metadata = {
  title: "EchoMe",
  description: "A private, reflective conversation.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The composer sits above the keyboard on mobile; let the page own the
  // safe area rather than the browser.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {LOCAL_MODE ? <LocalModeBanner /> : null}
        {children}
      </body>
    </html>
  );
}
