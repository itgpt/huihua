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
