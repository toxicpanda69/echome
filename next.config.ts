import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The chat route decrypts session payloads with node:crypto, so it cannot run
  // on the Edge runtime. Individual routes opt in with `export const runtime`.
  serverExternalPackages: ["@anthropic-ai/sdk"],
  // voice.ts reads skill.md from disk at runtime. Without this it is not traced
  // into the Vercel bundle and the chat route throws ENOENT in production.
  outputFileTracingIncludes: {
    "/api/chat": ["./lib/echo/skill.md"],
  },
};

export default nextConfig;
