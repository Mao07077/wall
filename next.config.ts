import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack to avoid potential experimental build issues with fonts
  turbo: {
    resolve: {
      experimental: {
        turbopack: false, // Force Webpack instead of Turbopack
      },
    },
  },
  // Additional config options can be added here if needed
};

export default nextConfig;