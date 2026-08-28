import path from "path";
import type { NextConfig } from "next";

// Security headers applied to every response. Kept permissive on script/style
// (the app relies on Next.js inline hydration scripts and inline styles for
// dynamic theming) but locks down framing, MIME sniffing, and third-party
// browser features - the cheap, high-value wins that don't risk breaking
// canvas/data-URL/blob-heavy rendering used throughout the app.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
    devIndicators: false,
    outputFileTracingRoot: path.join(__dirname),
    eslint: {
        ignoreDuringBuilds: true,
    },
    async headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
