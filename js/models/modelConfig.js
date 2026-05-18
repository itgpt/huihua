import { MODEL_CONFIGS } from '../config/constants.js';

// 判断是否为视频模型
export function isVideoModel(modelName) {
    if (!modelName) return false;

    // 增加对视频模型的通用名称判断
    if (modelName.includes('video')) {
        return true;
    }
    const config = MODEL_CONFIGS[modelName];
    return config && config.type === 'video';
}

// 判断模型是否需要强制传图
function modelRequiresImage(modelName) {
    const config = MODEL_CONFIGS[modelName];
    // 如果没有配置，默认不需要传图
    return config ? config.requiresImage : false;
}

// 判断是否为 Gemini 模型
export function isGeminiModel(modelName) {
    if (!modelName) return false;
    return modelName.toLowerCase().startsWith('gemini');
}

// 判断是否为 Gemini 2.5 Flash 模型
export function isGemini25Flash(modelName) {
    if (!modelName) return false;
    return modelName.toLowerCase().includes('gemini-2.5-flash');
}

// 判断是否为 Gemini 3.1 Flash Image 模型
export function isGemini31FlashImage(modelName) {
    if (!modelName) return false;
    return modelName.toLowerCase().includes('gemini-3.1-flash-image');
}

// 判断是否为 Gemini 3 Pro Image 模型
export function isGemini3ProImage(modelName) {
    if (!modelName) return false;
    return modelName.toLowerCase().includes('gemini-3-pro-image');
}

// 判断是否为 GPT 绘画模型
export function isGPTImageModel(modelName) {
    if (!modelName) return false;
    return modelName.toLowerCase().startsWith('gpt-') && modelName.toLowerCase().includes('image');
}

// 判断是否为 GPT 2K 绘画模型
export function isGPTImageModel2K(modelName) {
    if (!modelName) return false;
    return isGPTImageModel(modelName) && modelName.toLowerCase().includes('2k');
}

// 判断是否为 GPT 4K 绘画模型
export function isGPTImageModel4K(modelName) {
    if (!modelName) return false;
    return isGPTImageModel(modelName) && modelName.toLowerCase().includes('4k');
}

// 将宽高比映射为像素尺寸（gpt-image-2 API 使用像素尺寸）
export function mapAspectRatioToPixelSize(aspectRatio) {
    const map = {
        '1:1': '1024x1024',
        '16:9': '1792x1024',
        '9:16': '1024x1792',
        '4:3': '1536x1024',
        '3:4': '1024x1536',
        '3:2': '1536x1024',
        '2:3': '1024x1536',
        '5:4': '1280x1024',
        '4:5': '1024x1280',
        '21:9': '1792x768',
    };
    return map[aspectRatio] || '1024x1024';
}

// 将宽高比映射为 2K 像素尺寸（gpt-image-2-2k 使用，基准 2048）
export function mapAspectRatioToPixelSize2K(aspectRatio) {
    // 所有尺寸满足：max edge ≤ 2048, 均为 16px 倍数, px ≤ 8,294,400
    const map = {
        '1:1': '2048x2048',      // API 枚举值
        '16:9': '2048x1152',     // API 枚举值
        '9:16': '1152x2048',
        '4:3': '2048x1536',
        '3:4': '1536x2048',
        '3:2': '2048x1360',      // 2048x1360=2,785,280
        '2:3': '1360x2048',
        '5:4': '2048x1632',      // 2048x1632=3,342,336
        '4:5': '1632x2048',
        '21:9': '2048x880',      // 2048x880=1,802,240
    };
    return map[aspectRatio] || '2048x2048';
}

// 将宽高比映射为 4K 像素尺寸（gpt-image-2-4k 使用，基准 3840）
export function mapAspectRatioToPixelSize4K(aspectRatio) {
    // 所有尺寸满足：max edge ≤ 3840, 均为 16px 倍数, px ≤ 8,294,400
    const map = {
        '1:1': '2880x2880',      // 2880x2880=8,294,400 ← 像素上限
        '16:9': '3840x2160',     // API 枚举值 4K 横向
        '9:16': '2160x3840',     // API 枚举值 4K 纵向
        '4:3': '3264x2448',      // 3264x2448=7,990,272
        '3:4': '2448x3264',
        '3:2': '3504x2336',      // 3504x2336=8,185,344
        '2:3': '2336x3504',
        '5:4': '3200x2560',      // 3200x2560=8,192,000
        '4:5': '2560x3200',
        '21:9': '3840x1648',     // 3840x1648=6,328,320
    };
    return map[aspectRatio] || '2880x2880';
}

// 判断是否为 Grok 绘画模型
export function isGrokImageModel(modelName) {
    if (!modelName) return false;
    return modelName.toLowerCase().startsWith('grok-') && modelName.toLowerCase().includes('image');
}

// 验证模型的必需条件
export function validateModels(models, imageFiles) {
    const errors = [];
    
    for (const model of models) {
        if (modelRequiresImage(model) && imageFiles.length === 0) {
            const config = MODEL_CONFIGS[model];
            const errorMsg = config ? config.errorMessage : `模型 ${model} 需要上传参考图片！`;
            errors.push(errorMsg);
        }
    }
    
    if (errors.length > 0) {
        // 只显示第一个错误，避免过多提示
        throw new Error(errors[0]);
    }
}
