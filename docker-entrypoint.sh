#!/bin/sh
set -e

# 默认值
WECHAT_ID="${WECHAT_ID:-p7tk19}"
MAIN_SITE_URL="${MAIN_SITE_URL:-https://api.wanwuhuanxin.cn}"
API_BASE_URL="${API_BASE_URL:-https://api.wanwuhuanxin.cn}"

echo "[entrypoint] 注入环境变量..."
echo "  WECHAT_ID     = ${WECHAT_ID}"
echo "  MAIN_SITE_URL  = ${MAIN_SITE_URL}"
echo "  API_BASE_URL   = ${API_BASE_URL}"

# 在 JS/HTML 文件中替换占位符
find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.html" \) \
  -exec sed -i \
    -e "s|__WECHAT_ID__|${WECHAT_ID}|g" \
    -e "s|__MAIN_SITE_URL__|${MAIN_SITE_URL}|g" \
    -e "s|__API_BASE_URL__|${API_BASE_URL}|g" \
    {} +

echo "[entrypoint] 注入完成，启动 Nginx..."
exec nginx -g "daemon off;"
