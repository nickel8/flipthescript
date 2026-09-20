import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships as ESM-only; tell webpack not to try to parse it
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
