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

// 判断是否为 gpt-image-2.5 系列模型
export function isGPTImage25Model(modelName) {
    if (!modelName) return false;
    return isGPTImageModel(modelName) && modelName.toLowerCase().includes('2.5');
}

// 判断是否为可用参数选档的 gpt-image 模型（flare / sunburst 通过参数选 1K/2K/4K）
export function isGPTImageTierSelectable(modelName) {
    if (!modelName) return false;
    const lower = modelName.toLowerCase();
    return isGPTImageModel(modelName) && (lower.includes('flare') || lower.includes('sunburst'));
}

// 返回模型固定的分辨率档位；可参数选档（flare / sunburst）返回 null
export function gptImageModelTier(modelName) {
    if (!modelName) return '1K';
    if (isGPTImageTierSelectable(modelName)) return null;
    const lower = modelName.toLowerCase();
    if (lower.includes('4k')) return '4K';
    if (lower.includes('2k')) return '2K';
    return '1K';
}

// 走异步 /v1/videos 的 gpt-image 模型：大写 2K/4K 后缀与 2.5；
// 其余（如 gpt-image-2）在网关上是同步模型，走 /v1/images/generations
export function isAsyncGPTImageModel(modelName) {
    if (!isGPTImageModel(modelName)) return false;
    const name = String(modelName);
    return /-(2K|4K)$/.test(name) || /2\.5/.test(name);
}

// gpt-image 系列「宽高比 → 像素尺寸」对照表（依据「gpt-image-2（异步）」接口文档）
export const GPT_IMAGE_PIXEL_SIZES = {
    '1K': {
        '1:1': '1024x1024',
        '16:9': '1280x720',
        '9:16': '720x1280',
        '3:2': '1248x832',
        '2:3': '832x1248',
        '4:3': '1152x864',
        '3:4': '864x1152',
        '5:4': '1120x896',
        '4:5': '896x1120',
        '21:9': '1456x624',
    },
    '2K': {
        '1:1': '2048x2048',
        '16:9': '2560x1440',
        '9:16': '1440x2560',
        '3:2': '2496x1664',
        '2:3': '1664x2496',
        '4:3': '2304x1728',
        '3:4': '1728x2304',
        '5:4': '2240x1792',
        '4:5': '1792x2240',
        '21:9': '3024x1296',
    },
    '4K': {
        '1:1': '2880x2880',
        '16:9': '3840x2160',
        '9:16': '2160x3840',
        '3:2': '3504x2336',
        '2:3': '2336x3504',
        '4:3': '3264x2448',
        '3:4': '2448x3264',
        '5:4': '3200x2560',
        '4:5': '2560x3200',
        '21:9': '3696x1584',
    },
};

// 将宽高比映射为像素尺寸（gpt-image-2 系列，默认 1K 档）
export function mapAspectRatioToPixelSize(aspectRatio, tier = '1K') {
    const table = GPT_IMAGE_PIXEL_SIZES[tier] || GPT_IMAGE_PIXEL_SIZES['1K'];
    return table[aspectRatio] || table['1:1'];
}

// 2K 档像素尺寸
export function mapAspectRatioToPixelSize2K(aspectRatio) {
    return mapAspectRatioToPixelSize(aspectRatio, '2K');
}

// 4K 档像素尺寸
export function mapAspectRatioToPixelSize4K(aspectRatio) {
    return mapAspectRatioToPixelSize(aspectRatio, '4K');
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
