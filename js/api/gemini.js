import { fetchWithTimeout } from '../utils/http.js';
import { blobToBase64, fileToBase64 } from '../utils/file.js';
import { isGemini3ProImage } from '../models/modelConfig.js';

// Gemini 宽高比格式转换（支持新旧格式）
function mapSizeToAspectRatio(size) {
    if (size.includes(':')) {
        return size;
    }
    const mapping = {
        '1024x1024': '1:1',
        '1792x1024': '16:9',
        '1024x1792': '9:16',
        '1024x768': '4:3',
        '768x1024': '3:4',
        '1344x768': '16:9',
        '768x1344': '9:16',
        '1248x832': '3:2',
        '832x1248': '2:3',
        '1184x864': '4:3',
        '864x1184': '3:4',
        '1152x896': '5:4',
        '896x1152': '4:5',
        '1536x672': '21:9'
    };
    return mapping[size] || '1:1';
}

export async function callGeminiNativeAPI(client, modelName, prompt, imageFiles, size, geminiImageSize, log) {
    log.add('info', `开始 Gemini 原生接口调用: ${modelName}`);
    
    // 构建请求体的 parts 数组
    const parts = [];
    parts.push({ text: prompt });
    
    // 如果有图片，添加 inline_data
    if (imageFiles && imageFiles.length > 0) {
        for (const file of imageFiles) {
            try {
                let base64Data;
                let mimeType;
                
                if (file.isFromUrl) {
                    log.add('info', `正在下载 URL 图片: ${file.originalUrl}`);
                    const response = await fetchWithTimeout(file.originalUrl, {}, 600000);
                    const blob = await response.blob();
                    mimeType = blob.type || 'image/jpeg';
                    base64Data = await blobToBase64(blob);
                } else {
                    mimeType = file.type;
                    base64Data = await fileToBase64(file);
                }
                
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
                
                log.add('info', `已添加图片: ${file.name || file.originalUrl} (${mimeType})`);
            } catch (error) {
                log.add('error', `图片处理失败: ${file.name || file.originalUrl}`, error.message);
                throw error;
            }
        }
    }
    
    // 构建 generationConfig
    const generationConfig = {
        responseModalities: ["IMAGE"]
    };
    
    const aspectRatio = mapSizeToAspectRatio(size);
    generationConfig.imageConfig = {
        aspectRatio: aspectRatio
    };
    
    if (isGemini3ProImage(modelName)) {
        generationConfig.imageConfig.imageSize = geminiImageSize || '1K';
        log.add('info', `Gemini 3 Pro 分辨率设置: ${generationConfig.imageConfig.imageSize}`);
    }
    
    const requestBody = {
        contents: [{
            parts: parts
        }],
        generationConfig: generationConfig
    };
    
    const endpoint = `/v1beta/models/${modelName}:generateContent`;
    
    // 构建日志专用的请求体
    const logRequestBody = {
        contents: [{
            parts: parts.map(part => {
                if (part.text) return { text: part.text };
                if (part.inline_data) return {
                    inline_data: {
                        mime_type: part.inline_data.mime_type,
                        data: "[base64_data_omitted]"
                    }
                };
                return part;
            })
        }],
        generationConfig: generationConfig
    };
    
    log.add('info', 'Gemini 原生请求体（可直接POST）', {
        url: `${client.baseUrl}${endpoint}`,
        headers: {
            'x-goog-api-key': '[YOUR_API_KEY]',
            'Content-Type': 'application/json'
        },
        body: logRequestBody
    });
    
    try {
        // 使用标准的 Authorization Bearer token 以避免 CORS 问题
        // 代理服务器应该支持标准的 Authorization 头
        
        const response = await fetchWithTimeout(`${client.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${client.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody),
            mode: 'cors',
            credentials: 'omit'
        }, 600000); // 10分钟超时（4K图片需要更长时间）
        
        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }
        
        log.add('info', `Gemini 接口响应（${response.status}）`, result);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${text}`);
        }
        
        return result;
    } catch (error) {
        log.add('error', 'Gemini 接口调用失败', error.message);
        throw error;
    }
}

export function parseGeminiResponse(result, modelName, log) {
    try {
        const candidates = result.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('响应中没有 candidates');
        }
        
        const parts = candidates[0].content.parts;
        if (!parts || parts.length === 0) {
            throw new Error('响应中没有 parts');
        }
        
        const images = [];
        for (const part of parts) {
            if (part.inlineData) {
                const base64Data = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                
                images.push({
                    b64_json: base64Data,
                    mimeType: mimeType
                });
                
                const sizeInMB = Math.round((base64Data.length * 3 / 4) / 1024 / 1024 * 100) / 100;
                log.add('info', `提取到图片 (${mimeType}, 大小: ${sizeInMB}MB)`);
            }
            else if (part.text) {
                const base64Pattern = /!\[.*?\]\(data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)\)/g;
                let match;
                while ((match = base64Pattern.exec(part.text)) !== null) {
                    const mimeType = `image/${match[1]}`;
                    const base64Data = match[2];
                    images.push({ b64_json: base64Data, mimeType: mimeType });
                    const sizeInMB = Math.round((base64Data.length * 3 / 4) / 1024 / 1024 * 100) / 100;
                    log.add('info', `从 Markdown Base64 提取到图片 (${mimeType}, 大小: ${sizeInMB}MB)`);
                }
                
                const urlPattern = /\[image\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp)[^\s)]*)\)/gi;
                while ((match = urlPattern.exec(part.text)) !== null) {
                    const imageUrl = match[1];
                    images.push({ url: imageUrl, mimeType: 'image/jpeg' });
                    log.add('info', `从 Markdown URL 提取到图片: ${imageUrl}`);
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('响应中没有图片数据');
        }
        
        return {
            data: images,
            model: result.modelVersion || modelName,
            usage: result.usageMetadata
        };
    } catch (error) {
        log.add('error', '解析 Gemini 响应失败', error.message);
        throw error;
    }
}
