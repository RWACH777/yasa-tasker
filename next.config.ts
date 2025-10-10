import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ Ensure Vercel can serve a standalone build
  output: "standalone",

  eslint: {
    // Skip ESLint errors during build
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Skip TS errors during build
    ignoreBuildErrors: true,
  },

  experimental: {
    // Enable latest Next.js optimizations
    typedRoutes: true,
    optimizePackageImports: ["lucide-react", "@/components/ui"],
  },
};

export default nextConfig;