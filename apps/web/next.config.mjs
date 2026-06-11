/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@doppio/core", "@doppio/db", "@doppio/stt", "@doppio/ai"],
};

export default nextConfig;
