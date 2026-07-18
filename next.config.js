/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The TxLINE worker uses long-lived streaming fetches, so keep server
  // components external packages out of the bundling step.
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
    // The replay simulator reads recorded match logs from disk at runtime.
    // On a serverless host those files are only shipped with the function if
    // they are traced in, so pull the whole data directory into the simulate
    // route's bundle. The glob also covers any replays pulled later, so a
    // freshly pulled fixture works without another config change.
    outputFileTracingIncludes: {
      "/api/rooms/[code]/simulate": ["./data/**/*.jsonl"],
    },
  },
};

module.exports = nextConfig;
