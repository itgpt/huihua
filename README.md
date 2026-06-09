# 🎨 Huihua - AI 绘画 & 视频 & 音乐工具

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)

**Huihua**（绘画）是一个集成了 AI 绘画、视频生成、音乐创作的前端工具集，支持多种主流 AI 模型，一键 Docker 部署。

## ✨ 功能

### 🎨 AI 绘画
- 文生图，支持 **Gemini 2.5 / 3.1 / 3 Pro**、**GPT Image**、**Qwen Image** 等模型
- 多比例支持（1:1 / 2:3 / 3:2 / 9:16 / 16:9 等）
- 1K / 2K / 4K 分辨率（取决于模型）

### 🎬 视频生成
- **Seedance** 系列（豆包视频模型）
- **Veo 3.1**（横屏/竖屏，4K/HD，文生视频 / 帧转视频 / GIF）
- **Grok Imagine**（xAI 视频模型）
- 图床 / SCDN 秒传，素材库管理

### 🎵 音乐生成
- **Suno** AI 音乐创作

### 🛠️ 实用工具
- ✨ **提示词库** — 管理和复用图片提示词
- ✂️ **图片分割工厂** — 九宫格 / 自定义分割
- 🎞️ **视频帧提取** — 从视频中提取关键帧
- 🎬 **快捷时间线** — 30 秒倒计时提交 + 撤回
- 📐 **分镜设计** — 视频分镜规划
- 💡 **灵感实验室** — 小红书风格图文生成

## 🚀 一键启动

### Docker Compose（推荐）

```bash
# 使用默认配置
docker-compose up -d

# 或通过环境变量自定义（支持系统环境变量 / .env 文件）
WECHAT_ID=myid API_BASE_URL=https://myapi.com docker-compose up -d
```

访问：**http://localhost:8000**

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WECHAT_ID` | `p7tk19` | 公告中显示的微信号 |
| `MAIN_SITE_URL` | `https://api.wanwuhuanxin.cn` | 主站 / 次数站链接 |
| `API_BASE_URL` | `https://api.wanwuhuanxin.cn` | API 接口默认地址 |

> 更详细的 Docker 部署说明见 [README-Docker.md](README-Docker.md)

## 📁 项目结构

```
huihua/
├── index.html                      # 主入口（绘画 + 视频）
├── seedance2.html                  # Seedance 视频生成（标准版）
├── seedance2-api-version.html      # Seedance 视频生成（API 版）
├── seedance2-cdn.html              # Seedance 视频生成（CDN 版）
├── suno.html                       # Suno 音乐生成
├── js/
│   ├── main.js                     # 核心主逻辑
│   ├── page-entry.js               # 页面入口
│   ├── api/                        # API 调用（Gemini / 图片 / 视频 / 优化器）
│   ├── config/                     # 模型配置常量
│   ├── core/                       # 生成器 & 校验器
│   ├── models/                     # 模型选择 & 视频任务管理
│   ├── storage/                    # 历史记录 & 本地存储
│   ├── ui/
│   │   ├── components/             # 工具组件（提示词库 / 图片分割 / 时间线等）
│   │   ├── events.js               # 事件管理
│   │   ├── display.js              # 结果展示
│   │   └── history.js              # 历史记录 UI
│   └── utils/                      # DOM / 文件 / HTTP / 日志 工具
├── css/                            # 样式（基础 / 功能 / 工具）
├── pages/                          # HTML 模板片段
├── tests/                          # Node.js 测试（node:test）
├── scripts/build-index.mjs         # 构建索引脚本
├── docker-compose.yml              # Docker 编排
├── Dockerfile                      # Docker 镜像
└── docker-entrypoint.sh            # 入口脚本（环境变量注入）
```

## 🔧 技术栈

- **前端**：纯 HTML / CSS / ES Module JavaScript（无构建工具依赖）
- **Web 服务器**：Nginx (alpine)
- **部署**：Docker + Docker Compose
- **测试**：Node.js 原生 `node:test`
- **API**：OpenAI 兼容接口（wanwuhuanxin 中转）

## 🏷️ 支持的模型

### 图片生成
`gemini-2.5-flash-image` · `gemini-3.1-flash-image` · `gemini-3-pro-image` · `gpt-image-2-2k` · `gpt-image-2-4k` · `qwen-image-edit`

### 视频生成
`doubao-seedance-1-5-pro-251215` · `doubao-seedance-1-0-pro-250528` · `grok-imagine-0.9` · `grok-imagine-1.0` · `veo3.1-landscape-4k` · `veo3.1-portrait-4k` · `veo3.1-landscape-hd` · `veo3.1-portrait-hd` · `veo3.1-landscape` · `veo3.1-portrait` · `veo3.1-landscape-fl-4k` · `veo3.1-portrait-fl-4k` · `veo3.1-landscape-fl-hd` · `veo3.1-portrait-fl-hd` · `veo3.1-landscape-fl` · `veo3.1-portrait-fl` · `veo3.1-landscape-gif` · `veo3.1-portrait-gif` · `veo3.1-landscape-fl-gif` · `veo3.1-portrait-fl-gif`

## 📄 许可证

MIT © itgpt 团队

## 📞 联系方式

- 📧 邮箱: itgpt1@gmail.com
- 🐛 [问题追踪](https://github.com/itgpt/huihua/issues)
