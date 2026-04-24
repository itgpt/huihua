export class DOMManager {
    constructor() {
        this.elements = {};
    }

    init() {
        // 映射 ID 到属性名
        const idMap = {
            apiKey: 'apiKey',
            apiBaseUrl: 'apiBaseUrl',
            enablePromptOptimizer: 'enablePromptOptimizer',
            optimizerModelGroup: 'optimizerModelGroup',
            optimizerSystemPromptGroup: 'optimizerSystemPromptGroup',
            promptOptimizerModel: 'promptOptimizerModel',
            customOptimizerModelInput: 'customOptimizerModelInput',
            optimizerSystemPrompt: 'optimizerSystemPrompt',
            prompt: 'prompt',
            customImageModelInput: 'customImageModelInput',
            customVideoModelInput: 'customVideoModelInput',
            useCustomImageModel: 'useCustomImageModel',
            useCustomVideoModel: 'useCustomVideoModel',
            size: 'size',
            response_format: 'response_format',
            n: 'n',
            customNInput: 'customNInput',
            imageFile: 'imageFile',
            imageUrls: 'imageUrls',
            loadUrlsBtn: 'loadUrlsBtn',
            imagePreviewContainer: 'imagePreviewContainer',
            generateBtnText: 'generateBtnText',
            modeIndicator: 'modeIndicator',
            currentMode: 'currentMode',
            errorMsg: 'errorMsg',
            successMsg: 'successMsg',
            loading: 'loading',
            resultImages: 'resultImages',
            liveLogs: 'liveLogs',
            historyGrid: 'historyGrid',
            geminiImageSize: 'geminiImageSize',
            geminiResolutionGroup: 'geminiResolutionGroup',
            responseFormatGroup: 'responseFormatGroup',
            sizeParamGroup: 'size-param-group',
            jimengVideoParamsGroup: 'jimengVideoParamsGroup',
            jimengSeconds: 'jimengSeconds',
            jimengRatio: 'jimengRatio',
            jimengResolution: 'jimengResolution',
            jimengGenerateAudio: 'jimengGenerateAudio',
            jimengWatermark: 'jimengWatermark',
            jimengCameraFixed: 'jimengCameraFixed'
        };

        for (const [key, id] of Object.entries(idMap)) {
            const element = document.getElementById(id);
            if (element) {
                this.elements[key] = element;
            }
        }
        
        // 特殊处理 class 选择器
        this.elements.fileUploadLabel = document.querySelector('.file-upload-label');
        this.elements.generateBtn = document.querySelector('.btn-primary');
        
        // 绑定到实例属性，方便直接访问
        Object.assign(this, this.elements);
    }

    get(key) {
        return this.elements[key];
    }
}
