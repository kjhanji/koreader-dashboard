import path from "node:path";
import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
