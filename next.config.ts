import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Disable server-side telemetry
  experimental: {
    // Future experimental features can go here
  },

  // Enable React strict mode for development
  reactStrictMode: true,
};

export default nextConfig;
