FROM nginx:alpine

# 复制项目文件到 nginx 默认目录
COPY . /usr/share/nginx/html/

# 复制并设置入口脚本（运行时注入环境变量）
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 暴露端口
EXPOSE 80

# 通过入口脚本启动（替换 __TOKEN__ 占位符后启动 nginx）
ENTRYPOINT ["/docker-entrypoint.sh"]
