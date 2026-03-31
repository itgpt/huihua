import { showFullVideo } from './modal.js';
import VideoFrameExtractor from './tools/videoFrameExtractor.js';

export function createTaskCard(task, callbacks = {}) {
    const card = document.createElement('div');
    card.className = 'video-task-card';
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-status', task.status);
    
    // 状态文本映射
    const statusTextMap = {
        'queued': '🎨 灵感酝酿中',
        'in_progress': '✨ 魔法进行中',
        'completed': '✅ 杰作已完成',
        'failed': '❌ 创作受阻'
    };
    const statusText = statusTextMap[task.status] || task.status;
    
    const timeText = new Date(task.created_at).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    
    const progress = task.progress || 0;
    
    // 构建 HTML 结构
    card.innerHTML = `
        <div class="task-checkbox">
            <input type="checkbox" class="task-checkbox-input">
        </div>
        <div class="task-preview"></div>
        <div class="task-progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="task-info">
            <div class="task-model" style="font-size: 0.7rem; color: #667eea; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${task.model}">📦 ${task.model}</div>
            <div class="task-id" title="${task.id}">${task.id}</div>
            ${task.status === 'completed' ? `<div class="task-status status-${task.status}">${statusText}</div>` : ''}
            <div class="task-time">${timeText}</div>
        </div>
        <div class="task-actions"></div>
    `;

    // 绑定事件 - 使用类选择器而不是ID选择器，避免特殊字符问题
    const checkbox = card.querySelector('.task-checkbox-input');
    checkbox.onchange = () => {
        card.classList.toggle('selected', checkbox.checked);
    };

    updateCardContent(card, task, callbacks);

    return card;
}

export function updateTaskCard(card, task, callbacks = {}) {
    if (!card) return;
    
    card.setAttribute('data-status', task.status);
    
    const progressFill = card.querySelector('.progress-fill');
    if (progressFill) progressFill.style.width = `${task.progress || 0}%`;
    
    const statusTextMap = {
        'queued': '🎨 灵感酝酿中',
        'in_progress': '✨ 魔法进行中',
        'completed': '✅ 杰作已完成',
        'failed': '❌ 创作受阻'
    };
    const statusText = statusTextMap[task.status] || task.status;
    
    updateCardContent(card, task, callbacks, statusText);
    
    // 更新状态文本显示
    const taskInfo = card.querySelector('.task-info');
    if (taskInfo && task.status === 'completed') {
        let statusElement = taskInfo.querySelector('.task-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = `task-status status-${task.status}`;
            statusElement.textContent = statusText;
            const timeElement = taskInfo.querySelector('.task-time');
            taskInfo.insertBefore(statusElement, timeElement);
        }
    }
}

function updateCardContent(card, task, callbacks, statusText) {
    if (!statusText) {
        const statusTextMap = {
            'queued': '🎨 灵感酝酿中',
            'in_progress': '✨ 魔法进行中',
            'completed': '✅ 杰作已完成',
            'failed': '❌ 创作受阻'
        };
        statusText = statusTextMap[task.status] || task.status;
    }

    const preview = card.querySelector('.task-preview');
    if (preview) {
        preview.innerHTML = ''; // 清空旧内容
        
        if (task.status === 'completed' && task.video_url) {
            // 视频预览
            const video = document.createElement('video');
            video.className = 'task-video';
            video.src = task.video_url;
            video.style.cursor = 'pointer';
            video.onclick = () => showFullVideo(task.video_url);
            
            const overlay = document.createElement('div');
            overlay.className = 'task-play-overlay';
            overlay.style.cursor = 'pointer';
            overlay.innerHTML = '<div class="play-button">▶</div>';
            overlay.onclick = () => showFullVideo(task.video_url);
            
            preview.appendChild(video);
            preview.appendChild(overlay);
        } else if (task.status === 'failed') {
            // 失败显示
            preview.innerHTML = `
                <div class="task-error-placeholder">
                    <div class="error-icon">❌</div>
                    <p>${task.error?.message || '生成失败'}</p>
                </div>
            `;
        } else {
            // 进行中
            preview.innerHTML = `
                <div class="task-loading-placeholder">
                    <div class="loading-spinner"></div>
                    <p>${statusText} ${task.progress || 0}%</p>
                </div>
            `;
        }
    }

    const taskActions = card.querySelector('.task-actions');
    if (taskActions) {
        taskActions.innerHTML = '';
        if (task.status === 'completed' || task.status === 'failed') {
            if (task.status === 'completed') {
                const promptBtn = document.createElement('button');
                promptBtn.className = 'btn-task-action btn-view-prompt';
                promptBtn.title = '查看提示词';
                promptBtn.innerHTML = '<span>📝</span>';
                promptBtn.onclick = () => toggleTaskPrompt(card, task);
                taskActions.appendChild(promptBtn);

                const frameBtn = document.createElement('button');
                frameBtn.className = 'btn-task-action btn-extract-frame-card';
                frameBtn.title = '提取视频帧';
                frameBtn.innerHTML = '<span>🎞️</span>';
                frameBtn.onclick = () => {
                    if (task.video_url) {
                        VideoFrameExtractor.init();
                        VideoFrameExtractor.open(task.video_url);
                    }
                };
                taskActions.appendChild(frameBtn);
            }
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-task-action btn-remove-display';
            removeBtn.title = '移除任务';
            removeBtn.innerHTML = '<span>🗑️</span>';
            removeBtn.onclick = () => {
                if (callbacks.onRemove) callbacks.onRemove(task.id);
            };
            taskActions.appendChild(removeBtn);
        }
    }
}

function toggleTaskPrompt(card, task) {
    const preview = card.querySelector('.task-preview');
    if (!preview) return;
    
    const isShowingPrompt = preview.getAttribute('data-showing-prompt') === 'true';
    const btnSpan = card.querySelector('.btn-view-prompt span');
    
    if (isShowingPrompt) {
        // 切换回视频
        preview.setAttribute('data-showing-prompt', 'false');
        updateCardContent(card, task, {}, null); // 重新渲染内容
        if (btnSpan) btnSpan.textContent = '📝';
    } else {
        // 切换到提示词
        preview.setAttribute('data-showing-prompt', 'true');
        preview.innerHTML = `
            <div class="task-prompt-display">
                <div class="prompt-content">
                    <div class="prompt-section">
                        <strong>原始提示词：</strong>
                        <p>${task.prompt || '无'}</p>
                    </div>
                    ${task.optimizedPrompt && task.optimizedPrompt !== task.prompt ? `
                        <div class="prompt-section">
                            <strong>优化后提示词：</strong>
                            <p>${task.optimizedPrompt}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        if (btnSpan) btnSpan.textContent = '🎬';
    }
}
