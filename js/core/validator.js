import { showError } from '../ui/components/toast.js';
import { validateModels as validateModelConfig } from '../models/modelConfig.js';

export function validateInputs(apiKey, prompt, models, imageFiles) {
    if (!apiKey) {
        showError('❌ 请先填写 API 秘钥（KEY）', '在"API 配置"卡片中填写你的API KEY后再试');
        return false;
    }

    if (!prompt) { 
        showError('请输入绘画或视频提示词'); 
        return false; 
    }
    
    if (models.length === 0) { 
        showError('请选择至少一个绘画模型，或在"自定义..."中输入模型名称'); 
        return false; 
    }
    
    try {
        validateModelConfig(models, imageFiles);
    } catch (error) {
        showError(error.message);
        return false;
    }

    return true;
}
