/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@doppio/core", "@doppio/db", "@doppio/stt", "@doppio/ai"],
  // Keep Prisma out of the webpack bundle so its query-engine binary is
  // resolved from node_modules at runtime (and traced into the lambda).
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
