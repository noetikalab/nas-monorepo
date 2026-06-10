# ============================================================
# NAS Web 管理后台 — 多阶段构建
# Stage 1: 依赖安装 + 构建
# Stage 2: 运行时（Next.js standalone + nginx 反代）
# ============================================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 先复制依赖文件，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --ignore-scripts

# 复制源码并构建
COPY . .
RUN pnpm build

# --- Stage 2: Runtime ---
FROM node:22-alpine AS runner
WORKDIR /app

# 安装 nginx
RUN apk add --no-cache nginx

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# 复制 Next.js standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制 nginx 配置和启动脚本
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
