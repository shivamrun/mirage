import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@marinedotsh/upload-sdk"],
};

const withMDX = createMDX({
  configPath: "./source.config.mjs",
});

export default withMDX(nextConfig);
