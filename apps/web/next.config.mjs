import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@doppio/core", "@doppio/db", "@doppio/stt", "@doppio/ai"],
  // Chromium for PDF export resolves its binary at runtime — keep it external
  // so the .br binary gets file-traced instead of webpack-mangled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  webpack: (config, { isServer }) => {
    // Copies Prisma's query-engine binary next to the server bundle — required
    // in pnpm monorepos on Vercel (engine lives in the .pnpm store otherwise).
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
