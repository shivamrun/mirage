import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@marinedotsh/upload-sdk"],
  rewrites() {
    return {
      beforeFiles: [
        {
          source: "/stats.js",
          destination: "https://cloud.umami.is/script.js",
        },
        {
          source: "/api/send",
          destination: "https://gateway.umami.is/api/send",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

const withMDX = createMDX({
  configPath: "./source.config.mjs",
});

export default withMDX(nextConfig);
