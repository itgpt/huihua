import { fileToBase64 } from '../utils/file.js';
import { isDoubaoVideoModel } from '../models/modelConfig.js';

/**
 * 从API响应中提取视频URL（兼容多种返回格式）
 * @param {Object} result - API返回的结果对象
 * @returns {string|null} 视频URL或null
 */
export function extractVideoUrlFromResult(result) {
    if (!result) return null;
    
    // 方式1: 直接在顶层 (Sora等模型)
    if (result.video_url) {
        console.log('[视频URL提取] 从 result.video_url 提取:', result.video_url);
        return result.video_url;
    }
    
    // 方式2: 在content对象中 (即梦等模型)
    if (result.content && result.content.video_url) {
        console.log('[视频URL提取] 从 result.content.video_url 提取:', result.content.video_url);
        return result.content.video_url;
    }
    
    // 方式3: 在data对象中 (某些API可能使用)
    if (result.data && result.data.video_url) {
        console.log('[视频URL提取] 从 result.data.video_url 提取:', result.data.video_url);
        return result.data.video_url;
    }
    
    // 方式4: 在output对象中
    if (result.output && result.output.video_url) {
        console.log('[视频URL提取] 从 result.output.video_url 提取:', result.output.video_url);
        return result.output.video_url;
    }
    
    console.warn('[视频URL提取] 未找到视频URL，返回格式:', JSON.stringify(result, null, 2).substring(0, 500));
    return null;
}

// 从返回内容中提取视频URL (Markdown或HTML)
export function extractVideoUrl(content) {
    if (!content) return null;
    
    // 尝试多种视频标签格式，优先匹配 sora 的 markdown 格式
    const patterns = [
        /!\[[^\]]*\]\((https?:\/\/[^\s)'"]+\.mp4[^\s)'"]*)\)/i, // For ![Generated Video](URL) - 排除引号
        /\[[^\]]*\]\((https?:\/\/[^\s)'"]+\.mp4[^\s)'"]*)\)/i, // For [download video](URL) - 排除引号
        /<video[^>]*src=["']([^"']+)["'][^>]*>/i,
        /<video[^>]*>\s*<source[^>]*src=["']([^"']+)["'][^>]*>/i,
        /https?:\/\/[^\s<>"']+\.mp4[^\s<>"']*/i  // 排除引号
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            return match[1] || match[0];
        }
    }
    
    return null;
}


export async function createVideoTask(client, params, imageFiles, log) {
    // 准备请求体
    const requestBody = {
        model: params.model,
        prompt: params.prompt
    };
    
    // 处理即梦视频模型的专用参数
    if (params.jimeng) {
        if (params.jimeng.seconds) {
            requestBody.seconds = params.jimeng.seconds;
        }
        
        let paramSuffix = '';
        if (params.jimeng.ratio) {
            paramSuffix += ` -ratio=${params.jimeng.ratio}`;
        }
        if (params.jimeng.resolution) {
            paramSuffix += ` -resolution=${params.jimeng.resolution}`;
        }
        if (params.jimeng.generate_audio !== undefined) {
            paramSuffix += ` -generate_audio=${params.jimeng.generate_audio}`;
        }
        if (params.jimeng.watermark !== undefined) {
            paramSuffix += ` -watermark=${params.jimeng.watermark}`;
        }
        if (params.jimeng.camera_fixed !== undefined) {
            paramSuffix += ` -camera_fixed=${params.jimeng.camera_fixed}`;
        }
        
        if (paramSuffix) {
            requestBody.prompt = params.prompt + paramSuffix;
        }
    }
    
    // 处理 Sora2 专用参数（seconds 和 size）
    if (params.sora2 && (params.model === 'sora-2' || params.model === 'sora-2-pro')) {
        if (params.sora2.seconds) {
            requestBody.seconds = params.sora2.seconds;
        }
        if (params.sora2.size) {
            requestBody.size = params.sora2.size;
        }
    }

    // 处理 Grok 视频专用参数（seconds、resolution、aspect_ratio）
    if (params.grok && (params.model === 'grok-imagine-0.9' || params.model === 'grok-imagine-1.0')) {
        if (params.grok.seconds) {
            requestBody.seconds = params.grok.seconds;
        }
        if (params.grok.resolution) {
            requestBody.resolution = params.grok.resolution;
        }
        if (params.grok.aspect_ratio) {
            requestBody.aspect_ratio = params.grok.aspect_ratio;
        }
    }
    
    // 统一使用FormData格式（无论是否有图片）
    let imageBase64 = null;
    const formData = new FormData();
    
    // 添加基本参数
    formData.append('model', requestBody.model);
    formData.append('prompt', requestBody.prompt);
    if (requestBody.seconds) {
        formData.append('seconds', requestBody.seconds);
    }
    if (requestBody.size) {
        formData.append('size', requestBody.size);
    }
    if (requestBody.resolution) {
        formData.append('resolution', requestBody.resolution);
    }
    if (requestBody.aspect_ratio) {
        formData.append('aspect_ratio', requestBody.aspect_ratio);
    }
    
    // 处理图片参数（如果有）
    if (imageFiles && imageFiles.length > 0) {
        // grok 视频模型支持最多7张图，其他模型最多2张
        const isGrokVideo = params.model === 'grok-imagine-0.9' || params.model === 'grok-imagine-1.0';
        const maxImages = isGrokVideo ? 7 : 2;
        const filesToProcess = imageFiles.slice(0, maxImages);
        
        // 添加图片文件
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            try {
                if (file.isFromUrl) {
                    // URL图片直接作为字符串添加
                    formData.append('input_reference', file.originalUrl);
                } else {
                    // 直接添加文件到FormData
                    formData.append('input_reference', file, file.name || `image_${i}.jpg`);
                    if (i === 0) {
                        // 保存第一张图片的base64用于任务存储
                        imageBase64 = await fileToBase64(file);
                    }
                }
            } catch (error) {
                log.add('error', `图片 ${i + 1} 处理失败: ${error.message}`);
                throw error;
            }
        }
    }
    
    const endpoint = '/v1/videos';
    const fullUrl = `${client.baseUrl}${endpoint}`;
    
    // 构建POSTMAN风格的请求日志
    const formDataParams = [];
    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            formDataParams.push({
                key: key,
                type: 'file',
                value: `${value.name} (${(value.size / 1024).toFixed(2)} KB)`
            });
        } else {
            formDataParams.push({
                key: key,
                type: 'text',
                value: value
            });
        }
    }
    
    log.add('info', `POST ${fullUrl}`, {
        'Content-Type': 'multipart/form-data',
        'Body': formDataParams
    });

    try {
        // 统一使用FormData格式发送
        const response = await client.postFormData(endpoint, formData, 600000);
        const text = await response.text();
        
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }
        
        log.add('info', `Response ${response.status}`, result);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${text}`);
        }
        
        if (!result.id) {
            throw new Error('API未返回有效的任务ID');
        }
        
        return {
            ...result,
            _imageBase64: imageBase64
        };
    } catch (error) {
        log.add('error', '请求失败', error.message);
        throw error;
    }
}

export async function getVideoTaskStatus(client, taskId, log) {
    const endpoint = `/v1/videos/${taskId}`;
    const fullUrl = `${client.baseUrl}${endpoint}`;
    
    log.add('info', `GET ${fullUrl}`);
    
    try {
        const response = await client.get(endpoint, 600000);
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        
        const result = await response.json();
        
        log.add('info', `Response ${response.status}`, result);
        
        return result;
    } catch (error) {
        throw error;
    }
}
