import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The chat route decrypts session payloads with node:crypto, so it cannot run
  // on the Edge runtime. Individual routes opt in with `export const runtime`.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
