import { extractVideoUrlFromResult } from '../api/video.js';
import { fetchWithTimeout } from '../utils/http.js';
import { normalizeUrl } from '../utils/format.js';
import { showSuccess, showError } from '../ui/components/toast.js';

const ACTIVE_VIDEO_STATUSES = new Set(['queued', 'in_progress', 'pending', 'processing', 'running', 'created', 'submitted']);
const COMPLETED_VIDEO_STATUSES = new Set(['completed', 'succeeded', 'success', 'finished', 'done']);
const FAILED_VIDEO_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled', 'timeout']);

function normalizeVideoTaskStatus(status, videoUrl = '') {
    const normalized = String(status || '').trim().toLowerCase();
    if (COMPLETED_VIDEO_STATUSES.has(normalized) || (videoUrl && !FAILED_VIDEO_STATUSES.has(normalized))) return 'completed';
    if (FAILED_VIDEO_STATUSES.has(normalized)) return 'failed';
    if (ACTIVE_VIDEO_STATUSES.has(normalized)) return normalized === 'queued' ? 'queued' : 'in_progress';
    return videoUrl ? 'completed' : 'in_progress';
}

function shouldResumeVideoTask(task) {
    return task.status === 'queued' || task.status === 'in_progress';
}

/**
 * 视频任务管理器类
 * 负责管理异步视频生成任务的创建、轮询、状态更新和持久化
 */
export class VideoTaskManager {
    constructor(dom, apiClient, logger, storage) {
        this.dom = dom;
        this.apiClient = apiClient; // 注意：apiClient 需要在 init 时可能才准备好，或者动态获取
        this.logger = logger;
        this.storage = storage; // LocalStorageManager

        // 任务存储（使用Map提高查询效率）
        this.tasks = new Map();

        // 轮询定时器存储
        this.pollingTimers = new Map();

        // 配置参数
        this.config = {
            maxTasks: 50,              // 最多缓存50个任务
            pollIntervalSlow: 5000,    // 初始阶段：5秒
            pollIntervalMedium: 3000,  // 处理阶段：3秒
            pollIntervalFast: 2000,    // 完成阶段：2秒
            maxRetries: 3,             // 最大重试次数
            timeout: 1200000,          // 超时时间：20分钟
            retryDelay: 5000           // 重试延迟：5秒
        };

        // LocalStorage键名
        this.storageKey = 'video_tasks';

        // UI 更新回调（将在 main.js 中设置）
        this.onTaskUpdate = null;
        this.onTaskCreate = null;
        this.onTaskRemove = null;
    }

    /**
     * 创建新的视频任务
     * @param {string} taskId - 任务ID（从API返回）
     * @param {Object} params - 任务参数
     */
    createTask(taskId, params) {
        const task = {
            // 基础信息
            id: taskId,
            status: normalizeVideoTaskStatus(params.status || 'queued', params.video_url),
            progress: params.progress || 0,

            // 请求参数
            model: params.model,
            prompt: params.prompt,
            optimizedPrompt: params.optimizedPrompt || params.prompt,
            imageBase64: params.imageBase64 || null,

            // 时间戳
            created_at: Date.now(),
            updated_at: Date.now(),
            completed_at: null,

            // 结果
            video_url: params.video_url || null,
            share_id: params.share_id || null,

            // 元数据
            seconds: params.seconds || '15',
            size: params.size || '1920x1080',
            error: null,

            // 轮询控制
            isPolling: false,
            retryCount: 0
        };

        this.tasks.set(taskId, task);
        this.saveTasks();

        this.logger.append('info', `✅ [诊断] 任务已创建: ${taskId}`, {
            status: task.status,
            progress: task.progress,
            hasImage: !!task.imageBase64
        });

        if (this.onTaskCreate) {
            this.onTaskCreate(task);
        }

        return task;
    }

    /**
     * 开始轮询任务状态
     * @param {string} taskId - 任务ID
     */
    startPolling(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            this.logger.append('error', `❌ [诊断] 任务不存在: ${taskId}`);
            return;
        }

        if (task.isPolling) {
            return;
        }

        task.isPolling = true;
        this.updateTask(taskId, { isPolling: true });
        this.logger.append('info', `🔄 [诊断] 开始轮询任务: ${taskId}`);

        // 立即执行一次轮询
        this.pollTaskStatus(taskId);
    }

    /**
     * 停止轮询任务
     * @param {string} taskId - 任务ID
     */
    stopPolling(taskId) {
        const timer = this.pollingTimers.get(taskId);
        if (timer) {
            clearTimeout(timer);
            this.pollingTimers.delete(taskId);
        }

        const task = this.tasks.get(taskId);
        if (task) {
            task.isPolling = false;
            this.updateTask(taskId, { isPolling: false });
        }

        this.logger.append('info', `停止轮询任务: ${taskId}`);
    }

    /**
     * 轮询任务状态（核心逻辑）
     * @param {string} taskId - 任务ID
     */
    async pollTaskStatus(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        // 检查超时
        if (this.checkTimeout(task)) {
            this.stopPolling(taskId);
            return;
        }

        try {
            // 获取当前的 API 配置（可能已更新）
            const apiKey = this.dom.get('apiKey').value.trim();
            const rawUrl = this.dom.get('apiBaseUrl').value.trim() || 'https://api.wanwuhuanxin.cn';
            const baseUrl = normalizeUrl(rawUrl);

            // 根据模型类型选择正确的端点
            const isGrokVideo = task.model === 'grok-video';
            const endpoint = isGrokVideo
                ? `${baseUrl}/v1/video/generations/${taskId}`
                : `${baseUrl}/v1/videos/${taskId}`;

            // POSTMAN风格日志 - 请求
            this.logger.append('info', `GET ${endpoint}`);

            const startTime = Date.now();
            const response = await fetchWithTimeout(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            }, 300000); // 5分钟超时

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // POSTMAN风格日志 - 响应
            this.logger.append('info', `Response ${response.status}`, result);

            // Grok视频API返回的是包装结构 {code, data: {data: {status, url, ...}}}
            const taskData = task.model === 'grok-video' && result.data?.data ? result.data.data : result;

            // 更新任务信息
            const extractedVideoUrl = extractVideoUrlFromResult(result);
            const normalizedStatus = normalizeVideoTaskStatus(taskData.status, extractedVideoUrl || task.video_url);
            const updateData = {
                status: normalizedStatus,
                progress: taskData.progress || task.progress,
                video_url: extractedVideoUrl || task.video_url,
                share_id: taskData.share_id || task.share_id,
                updated_at: Date.now(),
                retryCount: 0
            };

            this.updateTask(taskId, updateData);

            // 根据状态决定下一步
            if (normalizedStatus === 'completed') {
                this.handleTaskCompleted(taskId, result);
            } else if (normalizedStatus === 'failed') {
                this.handleTaskFailed(taskId, result);
            } else {
                this.scheduleNextPoll(taskId);
            }

        } catch (error) {
            this.logger.append('error', `❌ [诊断] 轮询出错: ${taskId}`, error.message);
            this.handlePollingError(taskId, error);
        }
    }

    /**
     * 处理任务完成
     * @param {string} taskId - 任务ID
     * @param {Object} result - API返回结果
     */
    handleTaskCompleted(taskId, result) {
        const extractedVideoUrl = extractVideoUrlFromResult(result);

        this.logger.append('success', `✅ [视频模型] 任务完成: ${taskId}`);
        this.updateTask(taskId, {
            status: 'completed',
            progress: 100,
            video_url: extractedVideoUrl,
            completed_at: Date.now(),
            successResponse: result
        });

        this.stopPolling(taskId);

        // 自动保存到历史记录逻辑应在外部处理（通过事件或直接调用 HistoryManager）
        // 为了简化，这里仅触发事件
        if (this.onTaskCompleted) {
            this.onTaskCompleted(taskId, result);
        }

        showSuccess(`视频生成完成！任务ID: ${taskId.substring(0, 16)}...`);
    }

    /**
     * 处理任务失败
     * @param {string} taskId - 任务ID
     * @param {Object} result - API返回结果
     */
    handleTaskFailed(taskId, result) {
        const errorMsg = result.error?.message || '视频生成失败';

        this.updateTask(taskId, {
            status: 'failed',
            error: result.error || { message: errorMsg },
            completed_at: Date.now(),
            failureResponse: result
        });

        this.stopPolling(taskId);

        this.logger.append('error', `❌ [视频模型] 任务失败: ${taskId}`, errorMsg);
        showError(`视频生成失败: ${errorMsg}`);
    }

    /**
     * 处理轮询错误（网络错误、超时等）
     */
    handlePollingError(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.retryCount = (task.retryCount || 0) + 1;

        if (task.retryCount < this.config.maxRetries) {
            this.logger.append('warn', `网络错误，${this.config.retryDelay / 1000}秒后重试 (${task.retryCount}/${this.config.maxRetries})...`);

            setTimeout(() => {
                if (task.isPolling) {
                    this.pollTaskStatus(taskId);
                }
            }, this.config.retryDelay);
        } else {
            this.updateTask(taskId, {
                status: 'failed',
                error: {
                    type: 'network_error',
                    message: '网络连接失败，已达到最大重试次数'
                },
                completed_at: Date.now()
            });

            this.stopPolling(taskId);
            showError(`任务 ${taskId} 轮询失败：网络连接问题`);
        }
    }

    scheduleNextPoll(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || !task.isPolling) return;

        const interval = task.model === 'grok-video' ? 5000 : this.getPollingInterval(task.progress);

        const timer = setTimeout(() => {
            if (task.isPolling) {
                this.pollTaskStatus(taskId);
            }
        }, interval);

        this.pollingTimers.set(taskId, timer);
    }

    getPollingInterval(progress) {
        if (progress < 10) {
            return this.config.pollIntervalSlow;
        } else if (progress < 90) {
            return this.config.pollIntervalMedium;
        } else {
            return this.config.pollIntervalFast;
        }
    }

    checkTimeout(task) {
        const elapsed = Date.now() - task.created_at;

        if (elapsed > this.config.timeout) {
            this.updateTask(task.id, {
                status: 'failed',
                error: {
                    type: 'timeout',
                    message: `任务超时（超过${this.config.timeout / 60000}分钟）`
                },
                completed_at: Date.now()
            });

            this.logger.append('error', `任务超时: ${task.id}`);
            showError(`任务 ${task.id} 已超时`);

            return true;
        }

        return false;
    }

    updateTask(taskId, updates) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        Object.assign(task, updates);
        task.updated_at = Date.now();

        this.saveTasks();

        if (this.onTaskUpdate && (updates.status || updates.progress !== undefined)) {
            this.onTaskUpdate(task);
        }
    }

    removeTask(taskId) {
        this.stopPolling(taskId);

        const deleted = this.tasks.delete(taskId);

        if (deleted) {
            this.logger.append('info', `✅ 任务已移除: ${taskId}`);
            if (this.onTaskRemove) {
                this.onTaskRemove(taskId);
            }
        }

        return deleted;
    }

    getTask(taskId) {
        return this.tasks.get(taskId);
    }

    getAllTasks() {
        return Array.from(this.tasks.values());
    }

    saveTasks() {
        try {
            const tasksArray = this.getAllTasks();
            const tasksToSave = tasksArray.map(task => ({
                id: task.id,
                status: task.status,
                progress: task.progress,
                model: task.model,
                prompt: task.prompt,
                optimizedPrompt: task.optimizedPrompt,
                imageBase64: task.imageBase64,
                created_at: task.created_at,
                updated_at: task.updated_at,
                completed_at: task.completed_at,
                video_url: task.video_url,
                share_id: task.share_id,
                seconds: task.seconds,
                size: task.size,
                error: task.error,
                retryCount: task.retryCount
            }));

            const tasksToStore = tasksToSave.slice(0, this.config.maxTasks);

            const data = {
                tasks: tasksToStore,
                config: {
                    maxTasks: this.config.maxTasks,
                    lastSave: new Date().toISOString()
                }
            };

            this.storage.setJSON(this.storageKey, data);
        } catch (error) {
            console.error('保存任务到LocalStorage失败:', error);
        }
    }

    loadTasks() {
        try {
            const data = this.storage.getJSON(this.storageKey);
            if (!data) return;

            const tasks = data.tasks || [];

            this.logger.append('info', `📦 [诊断] 从缓存加载了 ${tasks.length} 个任务`);

            tasks.forEach(task => {
                // 超时检查逻辑
                task.status = normalizeVideoTaskStatus(task.status, task.video_url);

                if (shouldResumeVideoTask(task)) {
                    const elapsed = Date.now() - task.created_at;
                    if (elapsed > this.config.timeout) {
                        task.status = 'failed';
                        task.error = { type: 'timeout', message: '任务超时' };
                        task.isPolling = false;
                    } else {
                        task.isPolling = false; // 重置轮询
                    }
                } else {
                    task.isPolling = false;
                }

                this.tasks.set(task.id, task);

                // 恢复 UI
                if (this.onTaskCreate) {
                    this.onTaskCreate(task);
                }
            });

            // 恢复轮询
            const unfinishedTasks = tasks.filter(shouldResumeVideoTask);

            if (unfinishedTasks.length > 0) {
                this.logger.append('info', `🔄 [诊断] 恢复 ${unfinishedTasks.length} 个未完成任务的轮询`);
                unfinishedTasks.forEach(task => this.startPolling(task.id));
            }

        } catch (error) {
            this.logger.append('error', '❌ [诊断] 加载任务失败', error.message);
        }
    }
}
