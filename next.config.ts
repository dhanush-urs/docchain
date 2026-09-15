import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  allowedDevOrigins: [
    "unsenile-subtransversally-julien.ngrok-free.dev",
    "localhost:3000"
  ],
  experimental: {
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'development' 
        ? ["localhost:3000", "unsenile-subtransversally-julien.ngrok-free.dev"] 
        : [process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || ""]
    }
  }
};

export default nextConfig;
