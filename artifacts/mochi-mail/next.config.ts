import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingRoot: path.resolve(__dirname),
  },
};

export default nextConfig;
