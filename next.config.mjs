/** @type {import('next').NextConfig} */
const nextConfig = {
  // On enlève "output: export" car Cloudflare next-on-pages gère le déploiement
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // On s'assure que Next.js ne plante pas sur les routes API pendant le build
  trailingSlash: true,
};

export default nextConfig;