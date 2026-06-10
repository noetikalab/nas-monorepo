#!/bin/sh
# ============================================================
# NAS Web 容器启动脚本
# 启动 Next.js standalone server + nginx 反代
# ============================================================

# 启动 Next.js（后台运行）
node server.js &

# 等待 Next.js 就绪
sleep 1

# 启动 nginx（前台运行，保持容器存活）
nginx -g "daemon off;"
