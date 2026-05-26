import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    devIndicators: false,
    outputFileTracingRoot: path.join(__dirname),
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
