import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@doppio/core", "@doppio/db", "@doppio/stt", "@doppio/ai"],
  // Chromium for PDF export + ffmpeg for audio transcode resolve their binaries
  // at runtime — keep external so the binaries get file-traced, not webpack-mangled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "ffmpeg-static"],
  // Force the ffmpeg binary into the ingest function's trace (it's a data file,
  // not a JS import, so nft won't pick it up automatically in a pnpm monorepo).
  outputFileTracingIncludes: {
    "/api/sessions/[id]/ingest": ["../../node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg*"],
  },
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
