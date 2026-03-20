import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    // Make @svgr/webpack handle .svg files, returning them as React components
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
