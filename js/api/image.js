export async function generateImage(client, params, log) {
    const endpoint = '/v1/images/generations';
    
    // 构建日志专用的请求体（不含API Key）
    log.add('info', '生成请求参数（JSON，不含API Key）', { 
        url: `${client.baseUrl}${endpoint}`, 
        body: params 
    });

    try {
        const response = await client.post(endpoint, params, 600000); // 10分钟超时（4K图片需要更长时间）
        const text = await response.text();
        
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }

        log.add('info', `📋 [绘画模型-生成] 完整响应体（${response.status}）`, result);

        if (!response.ok) {
            log.add('error', `❌ [绘画模型-生成] 失败 - 完整响应体`, result);
            throw new Error(`HTTP error! status: ${response.status} - ${text}`);
        }

        return result;
    } catch (error) {
        throw error;
    }
}

export async function editImage(client, params, imageFiles, log) {
    const endpoint = '/v1/images/edits';
    const formData = new FormData();
    
    // ** 修正: 根据API中转逻辑，动态选择 'image' 或 'image[]' **
    const fieldName = imageFiles.length > 1 ? 'image[]' : 'image';
    for (const file of imageFiles) {
        if (file.isFromUrl) {
            // 从公网 URL 下载为 Blob 再上传，避免部分 API 不接受 URL 字符串
            const resp = await fetch(file.originalUrl);
            const blob = await resp.blob();
            const ext = (file.name || 'image.png').split('.').pop() || 'png';
            formData.append(fieldName, blob, file.name || `image.${ext}`);
        } else {
            formData.append(fieldName, file);
        }
    }

    const skipFields = new Set(['mode']);
    for (const [key, value] of Object.entries(params)) {
        if (!skipFields.has(key)) formData.append(key, value);
    }

    const fieldsForLog = { ...params };
    fieldsForLog[fieldName] = `[${imageFiles.length} files]: ${imageFiles.map(f => `${f.name} (${Math.round(f.size/1024)}KB)`).join(', ')}`;

    log.add('info', '编辑请求参数（FormData，不含API Key）', {
        url: `${client.baseUrl}${endpoint}`,
        fields: fieldsForLog
    });

    try {
        const response = await client.postFormData(endpoint, formData, 600000); // 10分钟超时（4K图片需要更长时间）
        const text = await response.text();
        
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }

        log.add('info', `📋 [绘画模型-编辑] 完整响应体（${response.status}）`, result);
        
        if (!response.ok) {
            log.add('error', `❌ [绘画模型-编辑] 失败 - 完整响应体`, result);
            throw new Error(`HTTP error! status: ${response.status} - ${text}`);
        }

        return result;
    } catch (error) {
        throw error;
    }
}
