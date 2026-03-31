# 🎨 AI 绘画&视频工具 - Docker 部署指南

## 快速启动

### 方式一：使用 Docker Compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问地址：http://localhost:8000

### 方式二：使用 Docker 命令

```bash
# 构建镜像
docker build -t ai-drawing-tool .

# 运行容器
docker run -d \
  --name ai-drawing-tool \
  -p 8000:80 \
  ai-drawing-tool

# 查看日志
docker logs -f ai-drawing-tool

# 停止容器
docker stop ai-drawing-tool

# 删除容器
docker rm ai-drawing-tool
```

## 端口说明

- 默认端口：8000
- 可以通过修改 `docker-compose.yml` 中的 `ports` 配置更改端口
- 例如改为 3000 端口：`"3000:80"`

## 开发模式

如果需要实时修改代码并查看效果，使用 volume 挂载：

```bash
docker-compose up -d
```

docker-compose.yml 已配置了 volume 挂载，修改本地文件会立即生效。

## 注意事项

1. 首次访问需要配置 API Key 和接口地址
2. 数据存储在浏览器本地（localStorage/IndexedDB）
3. 容器重启不会丢失用户数据（存储在客户端）
4. 确保 Docker 和 Docker Compose 已安装

## 技术栈

- 基础镜像：nginx:alpine
- Web 服务器：Nginx
- 前端：纯静态 HTML/CSS/JavaScript
