import { createCallLogger } from '../utils/logger.js';
import { maskApiKey } from '../utils/format.js';
import { showSuccess, showError, showVideoSuccessToast } from '../ui/components/toast.js';
import { updateModeIndicator } from '../ui/status.js';
import { isVideoModel, isGeminiModel, isGemini3ProImage, isGPTImageModel, isGrokImageModel } from '../models/modelConfig.js';
import { optimizePrompt } from '../api/optimizer.js';
import { generateImage, editImage } from '../api/image.js';
import { createVideoTask } from '../api/video.js';
import { callGeminiNativeAPI, parseGeminiResponse } from '../api/gemini.js';
import { displayImageResults, displayVideoResults, createImageGeneratingPlaceholder, removeImageGeneratingPlaceholder } from '../ui/display.js';

export class Generator {
    constructor(dom, apiClient, modelSelector, historyManager, videoTaskManager, logger, imagePreviewManager) {
        this.dom = dom;
        this.apiClient = apiClient;
        this.modelSelector = modelSelector;
        this.historyManager = historyManager;
        this.videoTaskManager = videoTaskManager;
        this.logger = logger;
        this.imagePreviewManager = imagePreviewManager;
    }

    async generate() {
        const apiKey = this.dom.apiKey.value.trim();
        // baseUrl 已经在 apiClient 中设置，如果 dom 中有变化需要在 main.js 中更新 client，或者这里重新获取
        // 假设 apiClient 总是最新的
        
        const originalPrompt = this.dom.prompt.value.trim();
        const size = this.dom.size.value;
        const responseFormat = this.dom.response_format.value;
        
        let n = 1;
        if (this.dom.n.value === '__custom__') {
            const customValue = parseInt(this.dom.customNInput.value, 10);
            n = isNaN(customValue) || customValue < 1 ? 1 : customValue;
        } else {
            n = parseInt(this.dom.n.value, 10);
        }

        const imageFiles = this.imagePreviewManager.getFiles();
        const models = this.modelSelector.getSelectedModels();

        // 验证逻辑已经在 validator.js 中处理，这里假设调用前已验证，或者再次验证
        // 这里主要负责执行

        this.dom.generateBtn.disabled = true;
        this.dom.generateBtnText.textContent = '生成中...';
        this.logger.clear();
        this.dom.loading.classList.add('show');
        this.dom.resultImages.innerHTML = '';

        const baseLog = createCallLogger(this.logger);
        baseLog.add('info', `任务开始，Base URL: ${this.apiClient.baseUrl}`);
        baseLog.add('info', `选择模型 (${models.length}): ${models.join(', ')}`);
        baseLog.add('info', `API Key: ${maskApiKey(apiKey)}`);

        const modeTag = imageFiles.length > 0 ? 'edit' : 'generate';

        if (modeTag === 'edit') {
            baseLog.add('info', `模式: 图片编辑, 文件: ${imageFiles.length} 张`);
        } else {
            baseLog.add('info', `模式: 图片生成, 尺寸: ${size}, 格式: ${responseFormat}, 数量: ${n}`);
        }

        try {
            this.dom.generateBtnText.textContent = '正在优化提示词...';
            
            // 提示词优化
            let optimizedPrompt = originalPrompt;
            if (this.dom.enablePromptOptimizer && this.dom.enablePromptOptimizer.checked) {
                const optimizerModel = this.dom.promptOptimizerModel.value === '__custom__' 
                    ? (this.dom.customOptimizerModelInput.value.trim() || 'gpt-4o-mini') 
                    : this.dom.promptOptimizerModel.value;
                const systemPrompt = this.dom.optimizerSystemPrompt.value.trim();
                
                optimizedPrompt = await optimizePrompt(this.apiClient, originalPrompt, optimizerModel, systemPrompt, baseLog);
                this.logger.append('info', '最终使用提示词', optimizedPrompt);
            } else {
                baseLog.add('info', '提示词优化已关闭，使用原始提示词');
            }
            
            this.dom.generateBtnText.textContent = '正在生成...';

            const promises = [];
            const totalCalls = models.length * n;

            for (const model of models) {
                // 为每个模型创建 'n' 个并发请求
                for (let i = 0; i < n; i++) {
                    const callIndex = promises.length + 1;
                    this.logger.append('info', `(${callIndex}/${totalCalls}) 准备调用: ${model} (第 ${i + 1}/${n} 张)`);
                    
                    const promise = this.runImageCall(model, optimizedPrompt, originalPrompt, modeTag, size, responseFormat, imageFiles, baseLog);
                    promises.push(promise);
                }
            }
            
            this.logger.append('info', `总共发起 ${promises.length} 个请求...`);
            const results = await Promise.allSettled(promises);

            const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
            
            if(successCount > 0) showSuccess(`完成 ${successCount}/${totalCalls} 个模型的调用`);
            else showError('所有模型均调用失败，请检查日志');

        } catch (error) {
            this.logger.append('error', '关键步骤失败', String(error));
            showError('生成流程遇到严重错误', error.message);
        } finally {
            this.dom.loading.classList.remove('show');
            this.dom.generateBtn.disabled = false;
            updateModeIndicator(this.dom, imageFiles.length > 0, models);
        }
    }

    async runImageCall(modelName, optimizedPrompt, originalPrompt, modeTag, size, responseFormat, imageFiles, baseLog) {
        const log = createCallLogger(this.logger);
        // 继承优化阶段日志（不重复输出到实时面板，因为 createCallLogger 可能会重复输出，这里仅用于记录完整日志）
        // 如果 globalLogger 已经输出了，这里不需要再操作 DOM，只需记录数据
        // 但 createCallLogger 的实现会直接调用 globalLogger.append，所以这里不需要手动继承显示
        
        const taskId = `image-${modelName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
        
        try {
            log.add('info', `开始模型调用: ${modelName}`);
            
            // 为非视频模型创建"图片生成中"占位符
            if (!isVideoModel(modelName)) {
                createImageGeneratingPlaceholder(this.dom, modelName, originalPrompt, optimizedPrompt, taskId);
            }
            
            // ========== 处理 Gemini 原生接口模型 ==========
            if (isGeminiModel(modelName)) {
                const geminiImageSize = this.dom.geminiImageSize ? this.dom.geminiImageSize.value : '1K';
                const geminiResult = await callGeminiNativeAPI(
                    this.apiClient,
                    modelName,
                    optimizedPrompt,
                    imageFiles,
                    size,
                    geminiImageSize,
                    log
                );
                
                // 解析为统一格式
                const parsedResult = parseGeminiResponse(geminiResult, modelName, log);
                
                const params = {
                    model: modelName,
                    size,
                    response_format: 'b64_json',
                    mode: imageFiles && imageFiles.length > 0 ? 'edit' : 'generate',
                    imageSize: isGemini3ProImage(modelName) ? geminiImageSize : undefined
                };

                // 展示结果
                displayImageResults(this.dom, parsedResult, originalPrompt, optimizedPrompt, params);
                
                // 保存历史记录
                // 注意：Gemini 返回的是数组，这里假设 parsedResult.data 是数组
                if (parsedResult.data && parsedResult.data.length > 0) {
                    for (const item of parsedResult.data) {
                        let imageSrc = '';
                        if (item.b64_json) imageSrc = `data:image/png;base64,${item.b64_json}`;
                        else if (item.url) imageSrc = item.url;
                        
                        if (imageSrc) {
                            const meta = {
                                endpoint: 'gemini-native',
                                model: modelName,
                                size: size,
                                response_format: 'b64_json',
                                mode: params.mode,
                                responseModel: parsedResult.model
                            };
                            await this.historyManager.save(imageSrc, originalPrompt, optimizedPrompt, params, log.logs, meta);
                        }
                    }
                }

                removeImageGeneratingPlaceholder(taskId);
                this.logger.append('info', `Gemini 模型完成: ${modelName}`);
                return true;
            }
            
            // ========== 处理视频模型（异步） ==========
            if (isVideoModel(modelName)) {
                log.add('info', `🔍 [诊断] 检测到视频模型: ${modelName}`);
                
                const jimengParams = {};
                if (this.dom.jimengVideoParamsGroup && this.dom.jimengVideoParamsGroup.style.display !== 'none') {
                    jimengParams.seconds = this.dom.jimengSeconds ? this.dom.jimengSeconds.value : null;
                    jimengParams.ratio = this.dom.jimengRatio ? this.dom.jimengRatio.value : null;
                    jimengParams.resolution = this.dom.jimengResolution ? this.dom.jimengResolution.value : null;
                    jimengParams.generate_audio = this.dom.jimengGenerateAudio ? this.dom.jimengGenerateAudio.value : null;
                    jimengParams.watermark = this.dom.jimengWatermark ? this.dom.jimengWatermark.value : null;
                    jimengParams.camera_fixed = this.dom.jimengCameraFixed ? this.dom.jimengCameraFixed.value : null;
                    jimengParams.web_search = this.dom.jimengWebSearch ? this.dom.jimengWebSearch.value === 'true' : false;
                    jimengParams.video_mode = this.dom.jimengVideoMode ? this.dom.jimengVideoMode.value : 'text2video';
                    jimengParams.reference_type = this.dom.jimengReferenceType ? this.dom.jimengReferenceType.value : 'none';
                }

                // 收集 Sora2 专用参数
                const sora2Params = {};
                if (modelName === 'sora-2' || modelName === 'sora-2-pro') {
                    const sora2SecondsEl = document.getElementById('sora2SecondsSelect');
                    const sora2SizeEl = document.getElementById('sora2SizeSelect');
                    sora2Params.seconds = sora2SecondsEl ? sora2SecondsEl.value : '12';
                    sora2Params.size = sora2SizeEl ? sora2SizeEl.value : '720x1280';
                    log.add('info', `Sora2 参数: seconds=${sora2Params.seconds}, size=${sora2Params.size}`);
                }

                // 收集 Grok 视频专用参数
                const grokParams = {};
                if (modelName === 'grok-video') {
                    const grokDurationEl = document.getElementById('grokDurationSelect');
                    const grokAspectRatioEl = document.getElementById('grokAspectRatioSelect');
                    grokParams.duration = grokDurationEl ? parseInt(grokDurationEl.value) : 10;
                    grokParams.aspect_ratio = grokAspectRatioEl ? grokAspectRatioEl.value : '16:9';
                    grokParams.quality = '720p'; // 固定720p

                    // 根据宽高比计算宽度和高度（720p固定）
                    const aspectRatioMap = {
                        '16:9': { width: 1280, height: 720 },
                        '9:16': { width: 720, height: 1280 },
                        '1:1': { width: 720, height: 720 },
                        '2:3': { width: 720, height: 1080 },
                        '3:2': { width: 1080, height: 720 }
                    };

                    const dimensions = aspectRatioMap[grokParams.aspect_ratio] || { width: 1280, height: 720 };
                    grokParams.width = dimensions.width;
                    grokParams.height = dimensions.height;

                    log.add('info', `Grok 视频参数: duration=${grokParams.duration}s, quality=${grokParams.quality}, aspect_ratio=${grokParams.aspect_ratio}, size=${grokParams.width}x${grokParams.height}`);
                }

                // 收集豆包2.0参数（仅当选择豆包2.0模型时）
                const doubao20Params = {};
                const isDoubao20Model = modelName === 'doubao-seedance-2-0-260128' || modelName === 'doubao-seedance-2-0-fast-260128';
                
                if (isDoubao20Model) {
                    console.log('[调试] === 开始收集豆包2.0参数 ===');
                    console.log('[调试] 模型名称:', modelName);
                    console.log('[调试] this.dom对象:', Object.keys(this.dom).filter(key => key.includes('doubao20')));
                    
                    // 检查豆包2.0参数面板是否显示
                    const doubao20Panel = document.getElementById('doubao20VideoParamsGroup');
                    console.log('[调试] 豆包2.0参数面板:', doubao20Panel);
                    
                    // 直接通过ID获取元素
                    const secondsEl = document.getElementById('doubao20Seconds');
                    console.log('[调试] 通过ID获取doubao20Seconds:', secondsEl, '值:', secondsEl ? secondsEl.value : 'undefined');
                    
                    if (secondsEl) {
                        doubao20Params.seconds = secondsEl.value;
                        console.log('[调试] 设置seconds:', doubao20Params.seconds);
                    }
                    // 通过ID获取其他参数
                    const ratioEl = document.getElementById('doubao20Ratio');
                    const resolutionEl = document.getElementById('doubao20Resolution');
                    const generateAudioEl = document.getElementById('doubao20GenerateAudio');
                    const watermarkEl = document.getElementById('doubao20Watermark');
                    const cameraFixedEl = document.getElementById('doubao20CameraFixed');
                    const webSearchEl = document.getElementById('doubao20WebSearch');
                    const modeEl = document.getElementById('doubao20Mode');
                    const referenceTypeEl = document.getElementById('doubao20ReferenceType');
                    
                    if (ratioEl) doubao20Params.ratio = ratioEl.value;
                    if (resolutionEl) doubao20Params.resolution = resolutionEl.value;
                    if (generateAudioEl) doubao20Params.generate_audio = generateAudioEl.value === 'true';
                    if (watermarkEl) doubao20Params.watermark = watermarkEl.value === 'true';
                    if (cameraFixedEl) doubao20Params.camera_fixed = cameraFixedEl.value === 'true';
                    if (webSearchEl) doubao20Params.web_search = webSearchEl.value === 'true';
                    if (modeEl) doubao20Params.mode = modeEl.value;
                    if (referenceTypeEl) doubao20Params.reference_type = referenceTypeEl.value;
                    
                    console.log('[调试] 最终豆包2.0参数:', doubao20Params);
                }
                
                const videoResult = await createVideoTask(this.apiClient, {
                    model: modelName,
                    prompt: optimizedPrompt,
                    jimeng: jimengParams,
                    sora2: sora2Params,
                    grok: grokParams,
                    doubao20: Object.keys(doubao20Params).length > 0 ? doubao20Params : undefined
                }, imageFiles, log);
                
                log.add('info', `🔍 [诊断] createVideoTask返回结果`, {
                    hasId: !!videoResult.id,
                    status: videoResult.status,
                    progress: videoResult.progress,
                    hasImageBase64: !!videoResult._imageBase64
                });
                
                if (videoResult.id) {
                    log.add('info', `🔍 [诊断] 创建任务到TaskManager: ${videoResult.id}`);
                    this.videoTaskManager.createTask(videoResult.id, {
                        status: videoResult.status || 'queued',
                        progress: videoResult.progress || 0,
                        model: modelName,
                        prompt: originalPrompt,
                        optimizedPrompt: optimizedPrompt,
                        imageBase64: videoResult._imageBase64 || null,
                        share_id: videoResult.share_id,
                        seconds: videoResult.seconds || '15',
                        size: videoResult.size || '1920x1080'
                    });
                    
                    log.add('info', `🔍 [诊断] 任务已创建，准备启动轮询`);
                    this.videoTaskManager.startPolling(videoResult.id);
                    log.add('info', `🔍 [诊断] 轮询已启动`);
                    
                    showVideoSuccessToast(videoResult.id);
                    this.logger.append('success', `✅ [诊断] 视频任务创建成功，开始异步生成`, {
                        taskId: videoResult.id,
                        status: videoResult.status,
                        hasImage: !!videoResult._imageBase64
                    });
                } else {
                    log.add('error', `❌ [诊断] videoResult.id不存在`);
                }
                
                return true;
            }
            
            // ========== 处理普通绘画模型 ==========
            let imageResult;
            
            // 为 GPT 和 Grok 模型添加比例参数到提示词末尾
            let finalPrompt = optimizedPrompt;
            if (isGPTImageModel(modelName) || isGrokImageModel(modelName)) {
                // 将比例参数添加到提示词末尾
                const aspectRatio = size || '1:1';
                finalPrompt = `${optimizedPrompt}, aspect ratio ${aspectRatio}`;
                log.add('info', `为 ${modelName} 添加比例参数到提示词: ${aspectRatio}`);
            }
            
            const params = {
                model: modelName,
                size: size,
                response_format: responseFormat,
                mode: modeTag
            };

            if (modeTag === 'edit') {
                params.prompt = finalPrompt;
                params.n = 1; // 强制为 1
                imageResult = await editImage(this.apiClient, params, imageFiles, log);
            } else {
                params.prompt = finalPrompt;
                params.n = 1; // 单次调用生成一张，因为外层循环控制数量
                imageResult = await generateImage(this.apiClient, params, log);
            }

            // 展示结果
            displayImageResults(this.dom, imageResult, originalPrompt, optimizedPrompt, params);

            // 保存历史记录
            const dataArr = Array.isArray(imageResult?.data) ? imageResult.data : [];
            if (dataArr.length > 0) {
                for (const item of dataArr) {
                    let imageSrc = '';
                    if (item.b64_json) imageSrc = `data:image/png;base64,${item.b64_json}`;
                    else if (item.url) imageSrc = item.url;
                    
                    if (imageSrc) {
                        const meta = {
                            endpoint: modeTag === 'edit' ? '/v1/images/edits' : '/v1/images/generations',
                            model: modelName,
                            size: size,
                            response_format: responseFormat,
                            mode: modeTag,
                            responseModel: result?.model, 
                            timings: item?.timings
                        };
                        await this.historyManager.save(imageSrc, originalPrompt, optimizedPrompt, params, log.logs, meta);
                    }
                }
            }

            removeImageGeneratingPlaceholder(taskId);
            this.logger.append('info', `模型完成: ${modelName}`);
            return true;

        } catch (err) {
            removeImageGeneratingPlaceholder(taskId);
            console.error('[错误详情] 模型失败:', modelName, '错误:', err);
            console.error('[错误堆栈]', err.stack);
            this.logger.append('error', `模型失败: ${modelName}`, String(err));
            showError(`模型 ${modelName} 生成失败`, err.message);
            return false;
        }
    }
}
