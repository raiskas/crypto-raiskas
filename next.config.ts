import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      "assets.coincap.io",
      "coin-images.coingecko.com",
      "assets.coingecko.com",
      "cryptoicons.org",
      "assets.coingecko.org"
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.coingecko.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cryptoicons.org',
        pathname: '/**',
      }
    ]
  },
  eslint: {
    ignoreDuringBuilds: true, // Ignora erros de lint no build do Vercel
  },
  typescript: {
    ignoreBuildErrors: true, // Ignora erros de tipo do TypeScript
  },
  experimental: {
    serverComponentsExternalPackages: ['bcrypt']
  }
};

export default nextConfig;
