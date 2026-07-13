import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", pathname: "**", hostname: "*.r2.dev" },
      { protocol: "https", pathname: "**", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  serverExternalPackages: ["@neondatabase/serverless"],
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "35mb",
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "connect-src 'self' http://127.0.0.1:8080 http://localhost:8080;", 
          },
        ],
      },
    ];
  },
};

export default nextConfig;
