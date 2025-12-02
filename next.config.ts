import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,

  // ✅ On désactive ESLint pendant les builds de prod
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ On laisse passer les erreurs TypeScript pendant le build
  typescript: {
    ignoreBuildErrors: true,
  },

  // ✅ Nécessaire pour `next export` (Cloudflare Pages statique)
  images: {
    unoptimized: true,
  },

  // ✅ On génère un site full static pour Cloudflare Pages
  output: "export",
};

export default nextConfig;
