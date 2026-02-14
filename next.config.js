const { hostname } = require("os");

// <<< Importar a função da biblioteca PWA >>>
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public", // Diretório de saída para os arquivos do service worker
  disable: process.env.NODE_ENV === "development", // Desabilitar PWA no modo de desenvolvimento
  register: true, // Registrar o service worker automaticamente
  skipWaiting: true, // Forçar ativação imediata do novo service worker
  // cacheOnFrontEndNav: true, // Opcional: Cachear navegações no cliente
  // reloadOnOnline: true, // Opcional: Recarregar a página quando voltar a ficar online
});

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

// <<< Envolver a configuração com withPWA >>>
module.exports = withPWA(nextConfig); 