import { fileToBase64 } from '../utils/file.js';
import { isDoubaoVideoModel } from '../models/modelConfig.js';
import { Doubao20Processor } from '../models/doubao20Processor.js';

/**
 * 从API响应中提取视频URL（兼容多种返回格式）
 * @param {Object} result - API返回的结果对象
 * @returns {string|null} 视频URL或null
 */
export function extractVideoUrlFromResult(result) {
    if (!result) return null;

    // 方式1: Grok新API在data.data.url (new-api包装后)
    if (result.data?.data?.url) {
        console.log('[视频URL提取] 从 result.data.data.url 提取:', result.data.data.url);
        return result.data.data.url;
    }

    // 方式2: Grok新API在data.url
    if (result.data?.url) {
        console.log('[视频URL提取] 从 result.data.url 提取:', result.data.url);
        return result.data.url;
    }

    // 方式3: 直接在顶层
    if (result.url) {
        console.log('[视频URL提取] 从 result.url 提取:', result.url);
        return result.url;
    }

    // 方式4: 直接在顶层 (Sora等模型)
    if (result.video_url) {
        console.log('[视频URL提取] 从 result.video_url 提取:', result.video_url);
        return result.video_url;
    }

    // 方式5: 在content对象中 (即梦等模型)
    if (result.content?.video_url) {
        console.log('[视频URL提取] 从 result.content.video_url 提取:', result.content.video_url);
        return result.content.video_url;
    }

    // 方式6: 在data对象中
    if (result.data?.video_url) {
        console.log('[视频URL提取] 从 result.data.video_url 提取:', result.data.video_url);
        return result.data.video_url;
    }

    // 方式7: 在output对象中
    if (result.output?.video_url) {
        console.log('[视频URL提取] 从 result.output.video_url 提取:', result.output.video_url);
        return result.output.video_url;
    }

    // 方式8: 豆包2.0格式 - 在data.data.content.video_url
    if (result.data?.data?.content?.video_url) {
        console.log('[视频URL提取] 从 result.data.data.content.video_url 提取:', result.data.data.content.video_url);
        return result.data.data.content.video_url;
    }

    // 方式9: 豆包2.0格式 - 在data.result_url
    if (result.data?.result_url) {
        console.log('[视频URL提取] 从 result.data.result_url 提取:', result.data.result_url);
        return result.data.result_url;
    }

    // 方式10: 豆包2.0格式 - 在data.data.video_url
    if (result.data?.data?.video_url) {
        console.log('[视频URL提取] 从 result.data.data.video_url 提取:', result.data.data.video_url);
        return result.data.data.video_url;
    }

    // 方式11: 豆包2.0格式 - 在data.data.content.video_url
    if (result.data?.data?.content?.video_url) {
        console.log('[视频URL提取] 从 result.data.data.content.video_url 提取:', result.data.data.content.video_url);
        return result.data.data.content.video_url;
    }

    // 方式12: 豆包2.0格式 - 在data.result_url
    if (result.data?.result_url) {
        console.log('[视频URL提取] 从 result.data.result_url 提取:', result.data.result_url);
        return result.data.result_url;
    }

    // 方式13: 豆包2.0格式 - 在data.data.result_url
    if (result.data?.data?.result_url) {
        console.log('[视频URL提取] 从 result.data.data.result_url 提取:', result.data.data.result_url);
        return result.data.data.result_url;
    }

    // 方式14: 豆包2.0格式 - 在data.url
    if (result.data?.url) {
        console.log('[视频URL提取] 从 result.data.url 提取:', result.data.url);
        return result.data.url;
    }

    // 方式15: 豆包2.0格式 - 在data.data.url
    if (result.data?.data?.url) {
        console.log('[视频URL提取] 从 result.data.data.url 提取:', result.data.data.url);
        return result.data.data.url;
    }

    // 方式16: 豆包2.0格式 - 在metadata.url（实际返回格式）
    if (result.metadata?.url) {
        console.log('[视频URL提取] 从 result.metadata.url 提取:', result.metadata.url);
        return result.metadata.url;
    }

    // 方式17: 豆包2.0格式 - 在data.metadata.url
    if (result.data?.metadata?.url) {
        console.log('[视频URL提取] 从 result.data.metadata.url 提取:', result.data.metadata.url);
        return result.data.metadata.url;
    }

    // 调试：打印完整的返回结构
    console.log('[视频URL提取调试] ========== 开始调试 ==========');
    console.log('[视频URL提取调试] 完整返回结构:', JSON.stringify(result, null, 2));
    
    // 打印所有可能的视频URL字段
    console.log('[视频URL提取调试] 检查所有可能的视频URL字段:');
    const checkPaths = [
        'data.data.content.video_url',
        'data.result_url',
        'data.data.video_url',
        'data.data.url',
        'data.url',
        'url',
        'video_url',
        'content.video_url',
        'output.video_url'
    ];
    
    checkPaths.forEach(path => {
        const value = getValueByPath(result, path);
        if (value) {
            console.log(`[视频URL提取调试] 找到 ${path}:`, value);
        }
    });
    
    console.log('[视频URL提取调试] ========== 结束调试 ==========');
    
    // 辅助函数：通过路径获取对象值
    function getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
    
    // 尝试查找任何包含mp4的URL
    const findVideoUrlInObject = (obj, depth = 0) => {
        if (depth > 5) return null; // 防止无限递归
        
        if (typeof obj === 'string' && obj.includes('.mp4')) {
            return obj;
        }
        
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                const value = obj[key];
                const found = findVideoUrlInObject(value, depth + 1);
                if (found) return found;
            }
        }
        
        return null;
    };
    
    const foundUrl = findVideoUrlInObject(result);
    if (foundUrl) {
        console.log('[视频URL提取] 通过深度搜索找到视频URL:', foundUrl);
        return foundUrl;
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
    let requestBody = {
        model: params.model,
        prompt: params.prompt
    };

    // 判断是否为豆包2.0模型
    const isDoubao20Model = params.model === 'doubao-seedance-2-0-260128' || params.model === 'doubao-seedance-2-0-fast-260128';

    if (params.jimeng && !isDoubao20Model) {
        // 旧版豆包模型处理（1.0, 1.5等）
        if (params.jimeng.seconds) {
            requestBody.seconds = params.jimeng.seconds;
        }
        let paramSuffix = '';
        if (params.jimeng.ratio) paramSuffix += ` -ratio=${params.jimeng.ratio}`;
        if (params.jimeng.resolution) paramSuffix += ` -resolution=${params.jimeng.resolution}`;
        if (params.jimeng.generate_audio !== undefined) paramSuffix += ` -generate_audio=${params.jimeng.generate_audio}`;
        if (params.jimeng.watermark !== undefined) paramSuffix += ` -watermark=${params.jimeng.watermark}`;
        if (params.jimeng.camera_fixed !== undefined) paramSuffix += ` -camera_fixed=${params.jimeng.camera_fixed}`;
        if (paramSuffix) requestBody.prompt = params.prompt + paramSuffix;
    }

    if (params.sora2 && (params.model === 'sora-2' || params.model === 'sora-2-pro')) {
        if (params.sora2.seconds) requestBody.seconds = params.sora2.seconds;
        if (params.sora2.size) requestBody.size = params.sora2.size;
    }

    const isGrokVideo = params.model === 'grok-video';
    if (params.grok && isGrokVideo) {
        if (params.grok.duration) requestBody.duration = parseInt(params.grok.duration);
        if (params.grok.width) requestBody.width = parseInt(params.grok.width);
        if (params.grok.height) requestBody.height = parseInt(params.grok.height);
        if (params.grok.aspect_ratio || params.grok.quality) {
            requestBody.metadata = {};
            if (params.grok.aspect_ratio) requestBody.metadata.aspect_ratio = params.grok.aspect_ratio;
            if (params.grok.quality) requestBody.metadata.quality = params.grok.quality;
        }
    }

    // 豆包2.0特殊处理：使用专门的处理器
    if (isDoubao20Model) {
        const doubaoProcessor = new Doubao20Processor();
        
        // 收集豆包2.0参数
        // 注意：这里需要从DOM获取参数，因为params中可能没有豆包2.0专用参数
        let doubaoParams = {};
        
        // 尝试从DOM获取豆包2.0参数
        try {
            // 这里需要访问DOM，但在API模块中无法直接访问
            // 参数应该在调用createVideoTask之前从UI收集并传入params.doubao20
            if (params.doubao20) {
                doubaoParams = params.doubao20;
            } else if (params.jimeng) {
                // 兼容旧参数格式转换
                doubaoParams = {
                    seconds: params.jimeng.seconds,
                    ratio: params.jimeng.ratio,
                    resolution: params.jimeng.resolution,
                    generate_audio: params.jimeng.generate_audio === 'true',
                    watermark: params.jimeng.watermark === 'true',
                    camera_fixed: params.jimeng.camera_fixed === 'true',
                    web_search: params.jimeng.web_search === 'true',
                    mode: params.jimeng.video_mode || 'text2video',
                    reference_type: params.jimeng.reference_type || 'none'
                };
            }
        } catch (error) {
            console.warn('[豆包2.0] 获取参数失败，使用默认值:', error);
        }
        
        // 验证参数
        const errors = doubaoProcessor.validateParams(doubaoParams, imageFiles);
        if (errors.length > 0) {
            throw new Error(`豆包2.0参数错误: ${errors.join('; ')}`);
        }
        
        // 使用处理器构建请求体
        requestBody = await doubaoProcessor.buildRequestBody(
            { model: params.model, prompt: params.prompt },
            doubaoParams,
            imageFiles
        );
    }

    const endpoint = isGrokVideo ? '/v1/video/generations' : '/v1/videos';
    const fullUrl = `${client.baseUrl}${endpoint}`;
    let imageBase64 = null;

    if (isGrokVideo) {
        if (imageFiles && imageFiles.length > 0) {
            const imageUrls = [];
            for (const file of imageFiles.slice(0, 7)) {
                if (file.isFromUrl) {
                    imageUrls.push(file.originalUrl);
                } else {
                    const base64 = await fileToBase64(file);
                    imageUrls.push(base64);
                    if (!imageBase64) imageBase64 = base64;
                }
            }
            if (imageUrls.length > 0) {
                if (!requestBody.metadata) requestBody.metadata = {};
                requestBody.metadata.image_urls = imageUrls;
            }
        }
        log.add('info', `POST ${fullUrl}`, { 'Content-Type': 'application/json', 'Body': requestBody });
        try {
            console.log('[调试] 发送API请求:', { endpoint, requestBody: JSON.stringify(requestBody) });
            const response = await client.post(endpoint, requestBody, 600000);
            const text = await response.text();
            console.log('[调试] API响应状态:', response.status, '响应文本:', text);
            
            let result;
            try { 
                result = JSON.parse(text); 
                console.log('[调试] 解析后的结果:', result);
            } catch (e) { 
                console.log('[调试] JSON解析失败，使用原始文本');
                result = { raw: text }; 
            }
            
            log.add('info', `Response ${response.status}`, result);
            
            if (!response.ok) {
                console.log('[调试] HTTP错误:', response.status, text);
                throw new Error(`HTTP error! status: ${response.status} - ${text}`);
            }
            
            if (!result.id) {
                console.log('[调试] 结果中没有id字段，完整结果:', result);
                // 检查是否有其他可能的任务ID字段
                const possibleIdFields = ['task_id', 'taskId', 'request_id', 'requestId', 'job_id', 'jobId'];
                for (const field of possibleIdFields) {
                    if (result[field]) {
                        console.log(`[调试] 找到替代ID字段 ${field}:`, result[field]);
                        result.id = result[field];
                        break;
                    }
                }
                
                if (!result.id) {
                    console.log('[调试] 没有找到任何任务ID字段');
                    throw new Error('API未返回有效的任务ID');
                }
            }
            
            console.log('[调试] 返回结果，id:', result.id);
            return { ...result, _imageBase64: imageBase64 };
        } catch (error) {
            console.error('[调试] 请求失败:', error);
            log.add('error', '请求失败', error.message);
            throw error;
        }
    }

    // 其他模型使用 FormData 格式
    const formData = new FormData();
    formData.append('model', requestBody.model);
    formData.append('prompt', requestBody.prompt);
    if (requestBody.seconds) formData.append('seconds', requestBody.seconds);
    if (requestBody.size) formData.append('size', requestBody.size);

    if (imageFiles && imageFiles.length > 0) {
        const filesToProcess = imageFiles.slice(0, 2);
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            try {
                if (file.isFromUrl) {
                    formData.append('input_reference', file.originalUrl);
                } else {
                    formData.append('input_reference', file, file.name || `image_${i}.jpg`);
                    if (i === 0) imageBase64 = await fileToBase64(file);
                }
            } catch (error) {
                log.add('error', `图片 ${i + 1} 处理失败: ${error.message}`);
                throw error;
            }
        }
    }

    const formDataParams = [];
    for (const [key, value] of formData.entries()) {
        formDataParams.push({ key, type: value instanceof File ? 'file' : 'text', value: value instanceof File ? `${value.name} (${(value.size / 1024).toFixed(2)} KB)` : value });
    }
    log.add('info', `POST ${fullUrl}`, { 'Content-Type': 'multipart/form-data', 'Body': formDataParams });

    try {
        const response = await client.postFormData(endpoint, formData, 600000);
        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }
        log.add('info', `Response ${response.status}`, result);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${text}`);
        if (!result.id) throw new Error('API未返回有效的任务ID');
        return { ...result, _imageBase64: imageBase64 };
    } catch (error) {
        log.add('error', '请求失败', error.message);
        throw error;
    }
}

export async function getVideoTaskStatus(client, taskId, log, model) {
    const isGrokVideo = model === 'grok-video';
    const endpoint = isGrokVideo ? `/v1/video/generations/${taskId}` : `/v1/videos/${taskId}`;
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
