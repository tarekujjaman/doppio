import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@doppio/core", "@doppio/db", "@doppio/stt", "@doppio/ai"],
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
