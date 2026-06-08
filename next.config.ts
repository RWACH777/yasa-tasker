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

  // ✅ Prevent caching issues - force fresh content on each deployment
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "max-age=0, must-revalidate",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },

  experimental: {
    // Enable latest Next.js optimizations
    typedRoutes: true,
    optimizePackageImports: ["lucide-react", "@/components/ui"],
  },
};

export default nextConfig;