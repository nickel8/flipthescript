import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships as ESM-only; tell webpack not to try to parse it
  serverExternalPackages: ["pdfjs-dist"],
  // Vercel output file tracing doesn't detect the dynamically-loaded worker;
  // include it explicitly so it's present in the serverless function bundle.
  outputFileTracingIncludes: {
    "/api/parse-script": ["./node_modules/pdfjs-dist/legacy/build/**"],
  },
};

export default nextConfig;
