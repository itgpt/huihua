import { extractVideoUrlFromResult } from '../api/video.js';
import { fetchWithTimeout } from '../utils/http.js';
import { normalizeUrl } from '../utils/format.js';
import { showSuccess, showError } from '../ui/components/toast.js';

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
            pollIntervalSlow: 10000,   // 初始阶段：10秒
            pollIntervalMedium: 10000, // 处理阶段：10秒
            pollIntervalFast: 10000,   // 完成阶段：10秒
            maxRetries: 3,             // 最大重试次数
            timeout: 1200000,          // 超时时间：20分钟
            retryDelay: 10000          // 重试延迟：10秒
        };

        // LocalStorage键名
        this.storageKey = 'sora_video_tasks';

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
        console.log(`[诊断] 创建任务: ${taskId}`, params);

        const task = {
            // 基础信息
            id: taskId,
            status: params.status || 'queued',
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
            video_url: null,
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
            
            // 调试：打印完整的API响应
            console.log(`[视频任务调试] ========== 任务 ${taskId} API响应 ==========`);
            console.log(`[视频任务调试] 模型: ${task.model}`);
            console.log(`[视频任务调试] 完整响应:`, JSON.stringify(result, null, 2));
            console.log(`[视频任务调试] 响应状态码: ${response.status}`);
            
            // 检查常见的视频任务状态字段
            const statusPaths = ['status', 'data.status', 'data.data.status'];
            statusPaths.forEach(path => {
                const value = getValueByPath(result, path);
                if (value) {
                    console.log(`[视频任务调试] 状态字段 ${path}: ${value}`);
                }
            });
            
            // Grok视频API返回的是包装结构 {code, data: {data: {status, url, ...}}}
            const taskData = task.model === 'grok-video' && result.data?.data ? result.data.data : result;
            
            // 辅助函数：通过路径获取对象值
            function getValueByPath(obj, path) {
                return path.split('.').reduce((current, key) => {
                    return current && current[key] !== undefined ? current[key] : undefined;
                }, obj);
            }

            // 更新任务信息
            const extractedVideoUrl = extractVideoUrlFromResult(result);
            console.log('[视频任务调试] 提取的视频URL:', extractedVideoUrl);
            console.log('[视频任务调试] 任务数据状态:', taskData.status);
            console.log('[视频任务调试] 完整返回结果:', result);
            
            const updateData = {
                status: taskData.status,
                progress: taskData.progress || task.progress,
                video_url: extractedVideoUrl || task.video_url,
                share_id: taskData.share_id || task.share_id,
                updated_at: Date.now(),
                retryCount: 0
            };

            this.updateTask(taskId, updateData);

            // 根据状态决定下一步
            if (taskData.status === 'completed') {
                this.handleTaskCompleted(taskId, result);
            } else if (taskData.status === 'failed') {
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
     * 直接从LocalStorage读取并显示所有任务（用于调试）
     */
    debugLocalStorageTasks() {
        console.log('[视频任务调试] ========== 直接从LocalStorage读取任务 ==========');
        
        try {
            const rawData = localStorage.getItem(this.storageKey);
            console.log('[视频任务调试] LocalStorage原始数据:', rawData);
            
            if (!rawData) {
                console.log('[视频任务调试] LocalStorage中没有找到任务数据');
                return [];
            }
            
            const data = JSON.parse(rawData);
            console.log('[视频任务调试] 解析后的数据:', data);
            
            // 处理不同的数据结构
            if (Array.isArray(data)) {
                // 直接是数组
                console.log(`[视频任务调试] 找到 ${data.length} 个任务（直接数组）:`);
                data.forEach((task, index) => {
                    console.log(`[视频任务调试] 任务 ${index + 1}:`, {
                        id: task.id,
                        status: task.status,
                        model: task.model,
                        progress: task.progress,
                        video_url: task.video_url,
                        prompt: task.prompt ? task.prompt.substring(0, 50) + '...' : '无',
                        created_at: task.created_at ? new Date(task.created_at).toLocaleString() : '未知'
                    });
                });
                return data;
            } else if (data.tasks && Array.isArray(data.tasks)) {
                // 嵌套在 tasks 字段中
                console.log(`[视频任务调试] 找到 ${data.tasks.length} 个任务（嵌套在tasks字段）:`);
                data.tasks.forEach((task, index) => {
                    console.log(`[视频任务调试] 任务 ${index + 1}:`, {
                        id: task.id,
                        status: task.status,
                        model: task.model,
                        progress: task.progress,
                        video_url: task.video_url,
                        prompt: task.prompt ? task.prompt.substring(0, 50) + '...' : '无',
                        created_at: task.created_at ? new Date(task.created_at).toLocaleString() : '未知'
                    });
                });
                
                // 显示配置信息
                if (data.config) {
                    console.log(`[视频任务调试] 配置信息:`, data.config);
                }
                
                return data.tasks;
            } else {
                console.log('[视频任务调试] 未知数据结构:', typeof data, data);
                return [];
            }
        } catch (error) {
            console.error('[视频任务调试] 读取LocalStorage失败:', error);
            return [];
        }
    }

    /**
     * 列出所有视频任务（用于调试）
     */
    listAllTasks() {
        console.log('[视频任务调试] ========== 所有视频任务列表 ==========');
        
        if (this.tasks.size === 0) {
            console.log('[视频任务调试] 没有找到任何视频任务');
            return [];
        }
        
        const taskList = [];
        for (const [taskId, task] of this.tasks) {
            console.log(`[视频任务调试] 任务ID: ${taskId}`, {
                状态: task.status,
                模型: task.model,
                进度: task.progress + '%',
                视频URL: task.video_url || '无',
                提示词: task.prompt.substring(0, 50) + '...',
                创建时间: new Date(task.created_at).toLocaleString(),
                更新时间: new Date(task.updated_at).toLocaleString()
            });
            taskList.push(task);
        }
        
        console.log(`[视频任务调试] 总共 ${taskList.length} 个任务`);
        return taskList;
    }

    /**
     * 重新查询特定任务并显示原始API响应
     * @param {string} taskId - 任务ID
     */
    recheckTaskWithDetails(taskId) {
        console.log(`[详细调试] 重新查询任务: ${taskId}`);
        
        const task = this.tasks.get(taskId);
        if (!task) {
            console.log(`[详细调试] 任务 ${taskId} 不存在`);
            return;
        }
        
        console.log(`[详细调试] 任务信息:`, {
            id: task.id,
            model: task.model,
            status: task.status,
            video_url: task.video_url,
            prompt: task.prompt
        });
        
        // 重新查询任务状态
        return this.pollTaskStatus(taskId).then(result => {
            console.log(`[详细调试] 任务 ${taskId} 重新查询结果:`, result);
            return result;
        }).catch(error => {
            console.error(`[详细调试] 重新查询失败:`, error);
            throw error;
        });
    }

    /**
     * 重新查询所有已完成但未显示视频的任务
     * 用于调试视频URL提取问题
     */
    recheckCompletedTasks() {
        console.log('[视频任务调试] 开始重新查询已完成任务');
        
        let recheckedCount = 0;
        for (const [taskId, task] of this.tasks) {
            if (task.status === 'completed' && !task.video_url) {
                console.log(`[视频任务调试] 重新查询任务: ${taskId}`, {
                    model: task.model,
                    prompt: task.prompt,
                    created: new Date(task.created_at).toLocaleString()
                });
                
                // 重新查询任务状态
                this.pollTaskStatus(taskId).catch(error => {
                    console.error(`[视频任务调试] 重新查询失败: ${taskId}`, error);
                });
                
                recheckedCount++;
            }
        }
        
        console.log(`[视频任务调试] 总共重新查询了 ${recheckedCount} 个任务`);
        return recheckedCount;
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

        // 所有模型都使用统一的10秒轮询间隔
        const interval = this.getPollingInterval(task.progress);

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
                if (task.status !== 'completed' && task.status !== 'failed') {
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
            const unfinishedTasks = tasks.filter(t =>
                t.status === 'queued' || t.status === 'in_progress'
            );

            if (unfinishedTasks.length > 0) {
                this.logger.append('info', `🔄 [诊断] 恢复 ${unfinishedTasks.length} 个未完成任务的轮询`);
                unfinishedTasks.forEach(task => this.startPolling(task.id));
            }

        } catch (error) {
            this.logger.append('error', '❌ [诊断] 加载任务失败', error.message);
        }
    }
}
