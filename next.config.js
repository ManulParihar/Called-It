/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The TxLINE worker uses long-lived streaming fetches, so keep server
  // components external packages out of the bundling step.
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
};

module.exports = nextConfig;
