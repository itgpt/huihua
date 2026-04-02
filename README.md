# Huihua - 智能绘画与图像处理工具

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)

**Huihua**（绘画）是一个现代化的智能绘画与图像处理工具，提供丰富的绘画功能和图像处理能力。

## ✨ 特性

- 🎨 **智能绘画** - AI辅助的绘画和草图生成
- 🖼️ **图像处理** - 高级滤镜、特效和图像编辑
- 🔧 **画布工具** - 多种画笔、颜色和图层管理
- 🤖 **AI集成** - 集成主流AI绘画模型
- 📱 **响应式设计** - 支持桌面和移动端
- 🚀 **高性能** - 基于Canvas和WebGL的优化渲染

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 运行测试
```bash
npm test
```

## 📁 项目结构

```
huihua/
├── src/                    # 源代码目录
│   ├── core/              # 核心引擎
│   ├── canvas/            # 画布工具
│   ├── filters/           # 图像滤镜
│   ├── ai/                # AI集成模块
│   └── utils/             # 工具函数
├── public/                # 静态资源
├── tests/                 # 测试文件
├── docs/                  # 文档
├── package.json           # 项目配置
├── README.md              # 项目说明
└── LICENSE                # MIT许可证
```

## 🎨 使用示例

### 基本绘画
```javascript
import { Painter } from 'huihua';

const painter = new Painter({
  canvas: '#myCanvas',
  width: 800,
  height: 600
});

// 设置画笔
painter.setBrush({
  type: 'pencil',
  size: 5,
  color: '#3498db'
});

// 开始绘画
painter.startDrawing();
```

### 图像处理
```javascript
import { ImageProcessor } from 'huihua';

const processor = new ImageProcessor('myImage.jpg');

// 应用滤镜
processor.applyFilter('grayscale');
processor.applyFilter('blur', { radius: 3 });

// 保存处理后的图像
processor.save('processed-image.png');
```

### AI绘画
```javascript
import { AIPainter } from 'huihua/ai';

const aiPainter = new AIPainter({
  model: 'stable-diffusion',
  apiKey: 'your-api-key'
});

// 生成图像
const image = await aiPainter.generate('a beautiful sunset over mountains');
```

## 🔧 配置

创建 `config.json` 文件：

```json
{
  "canvas": {
    "defaultWidth": 800,
    "defaultHeight": 600,
    "backgroundColor": "#ffffff"
  },
  "ai": {
    "enabled": true,
    "defaultModel": "stable-diffusion",
    "apiEndpoint": "https://api.example.com"
  },
  "export": {
    "formats": ["png", "jpg", "svg"],
    "defaultQuality": 90
  }
}
```

## 📚 API 文档

详细API文档请参考 [API文档](docs/api.md)。

### 核心类
- `Painter` - 主绘画类
- `CanvasTool` - 画布工具
- `BrushManager` - 画笔管理
- `LayerManager` - 图层管理
- `ImageProcessor` - 图像处理

### AI模块
- `AIPainter` - AI绘画
- `StyleTransfer` - 风格迁移
- `ImageEnhancer` - 图像增强

## 🤝 贡献

我们欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解如何参与项目开发。

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👥 作者

- **itgpt团队** - 项目创建者
- **贡献者们** - 感谢所有贡献者

## 🙏 致谢

- 感谢所有开源绘画库和图像处理工具
- 感谢AI绘画模型的发展
- 感谢社区的支持和反馈

## 📞 支持

- 📧 邮箱: itgpt1@gmail.com
- 🐛 [问题追踪](https://github.com/itgpt/huihua/issues)
- 💬 [讨论区](https://github.com/itgpt/huihua/discussions)

---

**Huihua** - 让创作更简单，让艺术更智能 🎨