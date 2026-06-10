import type { NextConfig } from "next";

const AUTH_BACKEND = process.env.AUTH_BACKEND || "http://localhost:8080";

const nextConfig: NextConfig = {
  output: "standalone",

  // 开发环境 API 代理：/api/* → Go 后端
  // 生产环境 nginx 在更前面已将 /api/* 转发，此规则不会被执行
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${AUTH_BACKEND}/api/:path*`,
      },
    ],
  }),
};

export default nextConfig;
