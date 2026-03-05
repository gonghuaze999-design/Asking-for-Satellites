# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件并安装
COPY package.json package-lock.json* ./
RUN npm install

# 复制所有源码并构建
COPY . .
RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:alpine

# 复制构建产物到 nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
