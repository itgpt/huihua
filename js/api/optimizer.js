import { fetchWithTimeout } from '../utils/http.js';

export async function optimizePrompt(client, prompt, optimizerModel, systemPrompt, log) {
    const endpoint = '/v1/chat/completions';
    log.add('info', `开始使用模型 [${optimizerModel}] 优化提示词...`);

    try {
        const body = {
            model: optimizerModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
        };

        const response = await client.post(endpoint, body, 600000); // 10分钟超时
        const text = await response.text();
        
        let result;
        try { result = JSON.parse(text); } catch { result = { raw: text }; }

        log.add('info', `提示词优化响应（${response.status}）`, result);

        if (!response.ok) throw new Error(`GPT API error! status: ${response.status}, details: ${text}`);
        
        const optimized = result.choices?.[0]?.message?.content?.trim();
        if (!optimized) throw new Error('优化结果为空');
        
        log.add('info', `提示词优化完成 (模型: ${optimizerModel})`);
        return optimized;
    } catch (error) {
        log.add('warn', `提示词优化失败 (模型: ${optimizerModel})，将使用原始提示词`, String(error));
        return prompt;
    }
}
