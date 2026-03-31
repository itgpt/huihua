/**
 * 带超时控制的fetch包装函数（统一10分钟超时）
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒），默认10分钟（4K图片生成需要更长时间）
 * @returns {Promise} fetch响应
 */
export async function fetchWithTimeout(url, options = {}, timeout = 600000) {
    // 创建一个AbortController用于取消请求
    const controller = new AbortController();
    const signal = controller.signal;
    
    // 合并signal到options
    const fetchOptions = {
        ...options,
        signal
    };
    
    // 创建超时Promise
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error(`请求超时：超过 ${timeout / 1000} 秒未响应`));
        }, timeout);
    });
    
    try {
        // 竞速：fetch vs timeout
        const response = await Promise.race([
            fetch(url, fetchOptions),
            timeoutPromise
        ]);
        
        return response;
    } catch (error) {
        // 区分超时错误和其他错误
        if (error.name === 'AbortError' || error.message.includes('请求超时')) {
            throw new Error(`⏱️ 请求超时：模型响应时间过长（超过${timeout / 1000}秒），请稍后重试或选择其他模型`);
        }
        
        // 网络错误
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            throw new Error('🌐 网络连接失败：请检查网络连接或API地址是否正确');
        }
        
        throw error;
    }
}
