import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@marinedotsh/upload-sdk",
    "@marinedotsh/better-auth-referral",
  ],
};

const withMDX = createMDX({
  configPath: "./source.config.mjs",
});

export default withMDX(nextConfig);
