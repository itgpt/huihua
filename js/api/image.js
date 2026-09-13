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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 从异步图片任务响应中提取图片地址
 * 完成态地址在顶层 url，同时也会写在 metadata.image_url / metadata.image，三者同值
 * @param {Object} result - 任务查询响应
 * @returns {string|null} 图片地址或 null
 */
export function extractImageUrlFromTask(result) {
    if (!result) return null;
    return result.url
        || result.metadata?.image_url
        || result.metadata?.image
        || result.output?.url
        || null;
}

/**
 * 创建异步图片任务（gpt-image-2 异步接口，复用 /v1/videos）
 * @param {APIClient} client - API 客户端
 * @param {Object} body - 请求体（model / prompt / aspect_ratio / size / image_size / images ...）
 * @param {Object} log - 日志器
 * @returns {Promise<Object>} 含任务 ID 的响应
 */
export async function createImageTask(client, body, log) {
    const endpoint = '/v1/videos';

    log.add('info', '创建图片任务（异步，POST /v1/videos）', {
        url: `${client.baseUrl}${endpoint}`,
        body
    });

    const response = await client.post(endpoint, body, 600000);
    const text = await response.text();

    let result;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }

    log.add('info', `📋 [图片任务-创建] 完整响应体（${response.status}）`, result);

    if (!response.ok) {
        log.add('error', `❌ [图片任务-创建] 失败 - 完整响应体`, result);
        throw new Error(`HTTP error! status: ${response.status} - ${text}`);
    }
    if (!result.id) {
        throw new Error('API未返回有效的任务ID');
    }
    return result;
}

/**
 * 查询异步图片任务状态（GET /v1/videos/{task_id}）
 * @param {APIClient} client - API 客户端
 * @param {string} taskId - 任务 ID
 * @param {Object} log - 日志器
 * @returns {Promise<Object>} 任务状态响应
 */
export async function queryImageTask(client, taskId, log) {
    const endpoint = `/v1/videos/${encodeURIComponent(taskId)}`;

    const response = await client.get(endpoint, 300000);
    const text = await response.text();

    let result;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }

    if (!response.ok) {
        log.add('error', `❌ [图片任务-查询] 失败（${response.status}）`, result);
        throw new Error(`HTTP error! status: ${response.status} - ${text}`);
    }
    return result;
}

/**
 * 轮询图片任务直到完成 / 失败 / 超时
 * @param {APIClient} client - API 客户端
 * @param {string} taskId - 任务 ID
 * @param {Object} log - 日志器
 * @param {Object} [options]
 * @param {number} [options.intervalMs=3000] - 轮询间隔（文档建议 2~5 秒）
 * @param {number} [options.timeoutMs=600000] - 超时时间
 * @returns {Promise<Object>} 完成态响应（保证含 url 字段）
 */
export async function pollImageTask(client, taskId, log, { intervalMs = 3000, timeoutMs = 10 * 60 * 1000 } = {}) {
    const start = Date.now();
    let attempt = 0;

    while (true) {
        attempt += 1;
        const result = await queryImageTask(client, taskId, log);
        const status = result.status || '';

        log.add('info', `🔄 [图片任务] 第 ${attempt} 次查询 ${taskId}：${status || '未知'}${result.progress != null ? ` (${result.progress}%)` : ''}`, result);

        if (status === 'completed') {
            const url = extractImageUrlFromTask(result);
            if (!url) throw new Error('任务已完成但未返回图片地址');
            return { ...result, url };
        }
        if (status === 'failed') {
            throw new Error(result.error?.message || '图片任务失败');
        }
        if (Date.now() - start > timeoutMs) {
            throw new Error(`图片任务超时（${Math.round(timeoutMs / 1000)} 秒未完成）`);
        }

        await sleep(intervalMs);
    }
}
