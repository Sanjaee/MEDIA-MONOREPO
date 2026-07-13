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
};

export default nextConfig;
