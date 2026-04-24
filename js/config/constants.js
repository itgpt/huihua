// 模型配置：定义哪些模型需要强制传图
export const MODEL_CONFIGS = {
    // 视频模型配置
    'grok-imagine-0.9': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 grok-imagine-0.9'
    },
    'grok-imagine-1.0': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 grok-imagine-1.0'
    },
    'doubao-seedance-1-5-pro-251215': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 doubao-seedance-1-5-pro-251215'
    },
    'doubao-seedance-1-0-pro-250528': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 doubao-seedance-1-0-pro-250528'
    },
    // Veo 文生视频模型（不需要传图）
    // 4K 超清
    'veo3.1-landscape-4k': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-landscape-4k'
    },
    'veo3.1-portrait-4k': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-portrait-4k'
    },
    // HD 高清
    'veo3.1-landscape-hd': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-landscape-hd'
    },
    'veo3.1-portrait-hd': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-portrait-hd'
    },
    // 普通画质
    'veo3.1-landscape': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-landscape'
    },
    'veo3.1-portrait': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-portrait'
    },
    // Veo 帧转视频模型 - 强制传图
    // 4K 超清
    'veo3.1-landscape-fl-4k': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转视频模型 必须上传参考图片！'
    },
    'veo3.1-portrait-fl-4k': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转视频模型 必须上传参考图片！'
    },
    // HD 高清
    'veo3.1-landscape-fl-hd': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转视频模型 必须上传参考图片！'
    },
    'veo3.1-portrait-fl-hd': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转视频模型 必须上传参考图片！'
    },
    // 普通画质
    'veo3.1-landscape-fl': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转视频模型 必须上传参考图片！'
    },
    'veo3.1-portrait-fl': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转视频模型 必须上传参考图片！'
    },
    // Veo GIF生成模型（文生GIF不需要传图）
    'veo3.1-landscape-gif': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-landscape-gif'
    },
    'veo3.1-portrait-gif': {
        requiresImage: false,
        type: 'video',
        errorMessage: '视频模型 veo3.1-portrait-gif'
    },
    // Veo GIF生成模型（帧转GIF需要传图）
    'veo3.1-landscape-fl-gif': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转GIF模型 必须上传参考图片！'
    },
    'veo3.1-portrait-fl-gif': {
        requiresImage: true,
        type: 'video',
        errorMessage: 'Veo3.1 帧转GIF模型 必须上传参考图片！'
    },
    // 图片编辑模型配置
    'qwen-image-edit': {
        requiresImage: true,
        type: 'image-edit',
        errorMessage: '图片编辑模型 qwen-image-edit 须上传参考图片！'
    }
};

// Gemini 2.5 Flash 宽高比配置（只支持1K）
export const GEMINI_25_FLASH_ASPECTS = [
    { value: '1:1', label: '1:1 方形', resolution: '1024x1024' },
    { value: '2:3', label: '2:3 纵向', resolution: '832x1248' },
    { value: '3:2', label: '3:2 横向', resolution: '1248x832' },
    { value: '3:4', label: '3:4 纵向', resolution: '864x1184' },
    { value: '4:3', label: '4:3 横向', resolution: '1184x864' },
    { value: '4:5', label: '4:5 纵向', resolution: '896x1152' },
    { value: '5:4', label: '5:4 横向', resolution: '1152x896' },
    { value: '9:16', label: '9:16 纵向', resolution: '768x1344' },
    { value: '16:9', label: '16:9 横向', resolution: '1344x768' },
    { value: '21:9', label: '21:9 超宽', resolution: '1536x672' }
];

// Gemini 3 Pro Image 宽高比配置（支持1K/2K/4K）
export const GEMINI_3_PRO_ASPECTS = [
    { value: '1:1', label: '1:1 方形', resolutions: { '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' } },
    { value: '2:3', label: '2:3 纵向', resolutions: { '1K': '848x1264', '2K': '1696x2528', '4K': '3392x5056' } },
    { value: '3:2', label: '3:2 横向', resolutions: { '1K': '1264x848', '2K': '2528x1696', '4K': '5056x3392' } },
    { value: '3:4', label: '3:4 纵向', resolutions: { '1K': '896x1200', '2K': '1792x2400', '4K': '3584x4800' } },
    { value: '4:3', label: '4:3 横向', resolutions: { '1K': '1200x896', '2K': '2400x1792', '4K': '4800x3584' } },
    { value: '4:5', label: '4:5 纵向', resolutions: { '1K': '928x1152', '2K': '1856x2304', '4K': '3712x4608' } },
    { value: '5:4', label: '5:4 横向', resolutions: { '1K': '1152x928', '2K': '2304x1856', '4K': '4608x3712' } },
    { value: '9:16', label: '9:16 纵向', resolutions: { '1K': '768x1376', '2K': '1536x2752', '4K': '3072x5504' } },
    { value: '16:9', label: '16:9 横向', resolutions: { '1K': '1376x768', '2K': '2752x1536', '4K': '5504x3072' } },
    { value: '21:9', label: '21:9 超宽', resolutions: { '1K': '1584x672', '2K': '3168x1344', '4K': '6336x2688' } }
];

export const HISTORY_MAX_ITEMS = 50;
export const HISTORY_PER_PAGE = 20;
