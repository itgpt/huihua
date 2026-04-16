/**
 * 豆包2.0参数处理器
 * 专门处理豆包2.0的特殊参数格式和功能
 */
import { fileToBase64 } from '../utils/file.js';

export class Doubao20Processor {
    constructor() {
        // 默认参数配置
        this.defaultConfig = {
            seconds: "12",
            ratio: "16:9",
            resolution: "720p",
            generate_audio: true,
            watermark: false,
            camera_fixed: false,
            web_search: false,
            mode: "text2video",
            reference_type: "none"
        };
    }

    /**
     * 从UI收集豆包2.0参数
     * @param {Object} dom - DOM元素集合
     * @returns {Object} 豆包2.0参数对象
     */
    collectParamsFromUI(dom) {
        const params = {
            seconds: dom.doubao20Seconds ? dom.doubao20Seconds.value : this.defaultConfig.seconds,
            ratio: dom.doubao20Ratio ? dom.doubao20Ratio.value : this.defaultConfig.ratio,
            resolution: dom.doubao20Resolution ? dom.doubao20Resolution.value : this.defaultConfig.resolution,
            generate_audio: dom.doubao20GenerateAudio ? dom.doubao20GenerateAudio.value === 'true' : this.defaultConfig.generate_audio,
            watermark: dom.doubao20Watermark ? dom.doubao20Watermark.value === 'true' : this.defaultConfig.watermark,
            camera_fixed: dom.doubao20CameraFixed ? dom.doubao20CameraFixed.value === 'true' : this.defaultConfig.camera_fixed,
            web_search: dom.doubao20WebSearch ? dom.doubao20WebSearch.value === 'true' : this.defaultConfig.web_search,
            mode: dom.doubao20Mode ? dom.doubao20Mode.value : this.defaultConfig.mode,
            reference_type: dom.doubao20ReferenceType ? dom.doubao20ReferenceType.value : this.defaultConfig.reference_type
        };

        console.log('[豆包2.0处理器] 收集的参数:', params);
        return params;
    }

    /**
     * 构建豆包2.0 API请求体
     * @param {Object} baseParams - 基础参数 {model, prompt}
     * @param {Object} doubaoParams - 豆包2.0参数
     * @param {Array} imageFiles - 图片文件数组
     * @returns {Promise<Object>} API请求体
     */
    async buildRequestBody(baseParams, doubaoParams, imageFiles) {
        // 确保参数有默认值
        const safeParams = {
            seconds: doubaoParams.seconds || this.defaultConfig.seconds,
            ratio: doubaoParams.ratio || this.defaultConfig.ratio,
            resolution: doubaoParams.resolution || this.defaultConfig.resolution,
            generate_audio: doubaoParams.generate_audio !== undefined ? doubaoParams.generate_audio : this.defaultConfig.generate_audio,
            watermark: doubaoParams.watermark !== undefined ? doubaoParams.watermark : this.defaultConfig.watermark,
            camera_fixed: doubaoParams.camera_fixed !== undefined ? doubaoParams.camera_fixed : this.defaultConfig.camera_fixed,
            web_search: doubaoParams.web_search !== undefined ? doubaoParams.web_search : this.defaultConfig.web_search,
            mode: doubaoParams.mode || this.defaultConfig.mode,
            reference_type: doubaoParams.reference_type || this.defaultConfig.reference_type
        };
        
        console.log('[豆包2.0处理器] 安全参数:', safeParams);
        
        const requestBody = {
            model: baseParams.model,
            prompt: baseParams.prompt,
            seconds: safeParams.seconds.toString(), // 必须使用字符串类型
            metadata: {
                duration: parseInt(safeParams.seconds),
                ratio: safeParams.ratio,
                resolution: safeParams.resolution,
                generate_audio: safeParams.generate_audio
            }
        };

        // 添加可选参数
        if (safeParams.watermark !== undefined) {
            requestBody.metadata.watermark = safeParams.watermark;
        }
        if (safeParams.camera_fixed !== undefined) {
            requestBody.metadata.camera_fixed = safeParams.camera_fixed;
        }

        // 处理多模态内容
        if (imageFiles && imageFiles.length > 0) {
            await this.addMultimodalContent(requestBody, safeParams, imageFiles);
        }

        // 处理工具（如联网搜索）
        if (safeParams.web_search) {
            if (!requestBody.metadata.tools) requestBody.metadata.tools = [];
            requestBody.metadata.tools.push({ type: 'web_search' });
        }

        // 处理功能模式
        this.applyModeToPrompt(requestBody, safeParams.mode);

        console.log('[豆包2.0处理器] 构建的请求体:', JSON.stringify(requestBody, null, 2));
        return requestBody;
    }

    /**
     * 添加多模态内容
     */
    async addMultimodalContent(requestBody, doubaoParams, imageFiles) {
        if (!requestBody.metadata.content) requestBody.metadata.content = [];

        const referenceType = doubaoParams.reference_type;
        
        // 根据参考类型处理
        switch (referenceType) {
            case 'reference_image':
                await this.addImageReferences(requestBody, imageFiles, 'reference_image');
                break;
            case 'reference_video':
                await this.addVideoReferences(requestBody, imageFiles, 'reference_video');
                break;
            case 'reference_audio':
                await this.addAudioReferences(requestBody, imageFiles, 'reference_audio');
                break;
            case 'first_frame':
                await this.addFirstFrame(requestBody, imageFiles);
                break;
            case 'last_frame':
                await this.addLastFrame(requestBody, imageFiles);
                break;
            case 'first_last_frame':
                await this.addFirstLastFrames(requestBody, imageFiles);
                break;
            case 'multimodal':
                await this.addMultimodalCombination(requestBody, imageFiles);
                break;
        }
    }

    /**
     * 添加图片参考
     */
    async addImageReferences(requestBody, imageFiles, role) {
        for (const file of imageFiles.slice(0, 5)) {
            if (file.isFromUrl) {
                requestBody.metadata.content.push({
                    type: 'image_url',
                    image_url: { url: file.originalUrl },
                    role: role
                });
            } else {
                const base64 = await fileToBase64(file);
                requestBody.metadata.content.push({
                    type: 'image_url',
                    image_url: { url: base64 },
                    role: role
                });
            }
        }
    }

    /**
     * 添加视频参考
     */
    async addVideoReferences(requestBody, imageFiles, role) {
        // 假设第一个文件是视频
        if (imageFiles.length > 0) {
            const file = imageFiles[0];
            if (file.isFromUrl) {
                requestBody.metadata.content.push({
                    type: 'video_url',
                    video_url: { url: file.originalUrl },
                    role: role
                });
            } else {
                const base64 = await fileToBase64(file);
                requestBody.metadata.content.push({
                    type: 'video_url',
                    video_url: { url: base64 },
                    role: role
                });
            }
        }
    }

    /**
     * 添加音频参考
     */
    async addAudioReferences(requestBody, imageFiles, role) {
        // 假设第一个文件是音频
        if (imageFiles.length > 0) {
            const file = imageFiles[0];
            if (file.isFromUrl) {
                requestBody.metadata.content.push({
                    type: 'audio_url',
                    audio_url: { url: file.originalUrl },
                    role: role
                });
            } else {
                const base64 = await fileToBase64(file);
                requestBody.metadata.content.push({
                    type: 'audio_url',
                    audio_url: { url: base64 },
                    role: role
                });
            }
        }
    }

    /**
     * 添加首帧
     */
    async addFirstFrame(requestBody, imageFiles) {
        if (imageFiles.length > 0) {
            const file = imageFiles[0];
            const base64 = await fileToBase64(file);
            requestBody.metadata.content.push({
                type: 'image_url',
                image_url: { url: base64 },
                role: 'first_frame'
            });
        }
    }

    /**
     * 添加尾帧
     */
    async addLastFrame(requestBody, imageFiles) {
        if (imageFiles.length > 0) {
            const file = imageFiles[0];
            const base64 = await fileToBase64(file);
            requestBody.metadata.content.push({
                type: 'image_url',
                image_url: { url: base64 },
                role: 'last_frame'
            });
        }
    }

    /**
     * 添加首尾帧
     */
    async addFirstLastFrames(requestBody, imageFiles) {
        if (imageFiles.length >= 2) {
            // 第一张图片作为首帧
            const firstFile = imageFiles[0];
            const firstBase64 = await fileToBase64(firstFile);
            requestBody.metadata.content.push({
                type: 'image_url',
                image_url: { url: firstBase64 },
                role: 'first_frame'
            });
            
            // 第二张图片作为尾帧
            const lastFile = imageFiles[1];
            const lastBase64 = await fileToBase64(lastFile);
            requestBody.metadata.content.push({
                type: 'image_url',
                image_url: { url: lastBase64 },
                role: 'last_frame'
            });
        }
    }

    /**
     * 添加多模态组合
     */
    async addMultimodalCombination(requestBody, imageFiles) {
        // 简单实现：前3个文件分别作为图片、视频、音频参考
        if (imageFiles.length >= 3) {
            // 图片参考
            const imageFile = imageFiles[0];
            const imageBase64 = await fileToBase64(imageFile);
            requestBody.metadata.content.push({
                type: 'image_url',
                image_url: { url: imageBase64 },
                role: 'reference_image'
            });

            // 视频参考
            const videoFile = imageFiles[1];
            const videoBase64 = await fileToBase64(videoFile);
            requestBody.metadata.content.push({
                type: 'video_url',
                video_url: { url: videoBase64 },
                role: 'reference_video'
            });

            // 音频参考
            const audioFile = imageFiles[2];
            const audioBase64 = await fileToBase64(audioFile);
            requestBody.metadata.content.push({
                type: 'audio_url',
                audio_url: { url: audioBase64 },
                role: 'reference_audio'
            });
        }
    }

    /**
     * 根据功能模式修改提示词
     */
    applyModeToPrompt(requestBody, mode) {
        switch (mode) {
            case 'video_edit':
                requestBody.prompt = `编辑视频: ${requestBody.prompt}`;
                break;
            case 'video_extend':
                requestBody.prompt = `延长视频: ${requestBody.prompt}`;
                break;
            case 'image2video':
                requestBody.prompt = `基于图片生成视频: ${requestBody.prompt}`;
                break;
            // text2video 和 multimodal 不需要修改
        }
    }

    /**
     * 验证豆包2.0参数
     */
    validateParams(doubaoParams, imageFiles) {
        const errors = [];
        
        // 使用安全参数
        const safeParams = {
            seconds: doubaoParams.seconds || this.defaultConfig.seconds,
            resolution: doubaoParams.resolution || this.defaultConfig.resolution,
            reference_type: doubaoParams.reference_type || this.defaultConfig.reference_type
        };

        // 验证时长
        const seconds = parseInt(safeParams.seconds);
        if (isNaN(seconds) || seconds < 4 || seconds > 15) {
            errors.push('豆包2.0视频时长必须在4-15秒之间');
        }

        // 验证分辨率
        if (safeParams.resolution !== '480p' && safeParams.resolution !== '720p') {
            errors.push('豆包2.0只支持480p和720p分辨率');
        }

        // 验证参考类型和文件
        const referenceType = safeParams.reference_type;
        if (referenceType !== 'none' && (!imageFiles || imageFiles.length === 0)) {
            errors.push(`参考类型 "${referenceType}" 需要上传参考文件`);
        }

        // 验证首尾帧需要至少2个文件
        if (referenceType === 'first_last_frame' && imageFiles && imageFiles.length < 2) {
            errors.push('首尾帧参考需要至少2个图片文件');
        }

        // 验证多模态需要至少3个文件
        if (referenceType === 'multimodal' && imageFiles && imageFiles.length < 3) {
            errors.push('多模态参考需要至少3个文件（图片、视频、音频各一）');
        }

        return errors;
    }
}