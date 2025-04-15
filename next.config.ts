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
  }
};

export default nextConfig;
