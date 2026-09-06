import type { Metadata, Viewport } from "next";

import { CustomCursor } from "@/components/CustomCursor";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Karla:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <CustomCursor />
        {LOCAL_MODE ? <LocalModeBanner /> : null}
        {children}
      </body>
    </html>
  );
}
