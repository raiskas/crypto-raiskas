const withPWAFactory = require("@ducanh2912/next-pwa").default;

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"],
    esmExternals: "loose",
  },
};

const isLocalRuntime =
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV &&
  !process.env.CI;

if (process.env.NODE_ENV === "development" || isLocalRuntime) {
  module.exports = nextConfig;
} else {
  const withPWA = withPWAFactory({
    dest: "public",
    register: true,
    skipWaiting: true,
  });

  module.exports = withPWA(nextConfig);
}
