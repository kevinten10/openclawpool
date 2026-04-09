import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone build for optimized deployment
  output: "standalone",
  
  // Image optimization configuration
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
  },
  
  // Experimental features for performance
  experimental: {
    // Enable optimistic client cache
    optimisticClientCache: true,
  },
  
  // Headers for global cache control
  async headers() {
    return [
      {
        source: "/api/v1/agents",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/api/v1/pools",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
