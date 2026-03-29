import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Keep heavy ONNX/transformers packages out of the webpack bundle;
  // they are only used in Node.js API routes.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
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
