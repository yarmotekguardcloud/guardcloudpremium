import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ❌ On désactive StrictMode pour éviter le double-mount en dev
  reactStrictMode: false,
  outputFileTracingRoot: __dirname,

  experimental: {
    // garde ton optimisation lucide-react
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
