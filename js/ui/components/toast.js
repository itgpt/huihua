export function showSuccess(message) {
    const successMsg = document.getElementById('successMsg');
    if (!successMsg) return;

    successMsg.textContent = message;
    successMsg.classList.add('show');
    setTimeout(() => successMsg.classList.remove('show'), 3000);
}

export function showError(message, details) {
    const errorMsg = document.getElementById('errorMsg');
    if (!errorMsg) return;

    errorMsg.textContent = message;
    errorMsg.classList.add('show');
    if (details) console.error(message, details);
    setTimeout(() => errorMsg.classList.remove('show'), 5000);
}

export function showAnnouncement() {
    // 检查是否已经存在
    if (document.querySelector('.toast-notification.announcement')) return;

    const message = `
        <div class="toast-content">
            <p class="toast-header">🔔 系统公告</p>
            <div style="height: 15px;"></div>
            
            <div class="toast-section">
                <strong>API 平台推荐:</strong>
                <div class="link-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
                    <a href="https://api.wanwuhuanxin.cn" target="_blank" class="link-card">
                        <span>🚀</span> 主站
                    </a>
                    <a href="https://api.wanwuhuanxin.cn" target="_blank" class="link-card">
                        <span>🔢</span> 次数站
                    </a>
                </div>
            </div>
            
            <div class="toast-section">
                <strong>新增模型:</strong>
                <div class="model-list">
                    <code class="new-model">🔥 Sora-2-Pro</code><br>
                    <code class="new-model">🔥 Gemini 3.1 Flash Image</code><br>
                    <code >🎬 sora-2</code> <code>🎬 grok-imagine-1.0</code>
                </div>
            </div>

            <div class="toast-section">
                <strong>联系微信:</strong>
                <p style="margin-top: 5px;">
                    <span class="wechat-id" title="点击复制" id="wechatId">p7tk19</span>
                    <span style="font-size: 0.85em; color: #718096;">(点击复制 | 获取源码)</span>
                </p>
            </div>

            <div class="toast-section">
                <strong>更新日志:</strong>
                <div style="margin-top: 8px; padding: 8px 10px; background: rgba(102, 126, 234, 0.05); border-radius: 6px; border-left: 3px solid #667eea;">
                    <p style="margin: 0; font-size: 0.85em; color: #4a5568; line-height: 1.6;">
                        <span style="color: #667eea; font-weight: 600;">版本号：v7.2.1</span><br>
                        <span style="color: #718096;">• 优化 Grok 18s视频选择</span><br>
                        <span style="color: #718096;">• 优化 Sora2 20s视频选择</span><br>
                        <span style="color: #718096;">• 支持 提取视频帧、时间线 功能</span><br>
                    </p>
                </div>
            </div>

            <div class="toast-tips">
                <strong>Tips:</strong> 按 Ctrl + Enter 可快速生成图片。
            </div>
        </div>
    `;
    const toast = document.createElement('div');
    toast.className = 'toast announcement'; // 添加标识类
    toast.innerHTML = `${message}
                       <button aria-label="close">
                           <svg aria-hidden="true" viewBox="0 0 14 16" width="14" height="16" fill="currentColor">
                               <path fill-rule="evenodd" d="M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z"></path>
                           </svg>
                       </button>`;

    // 复制微信ID逻辑
    const wechatIdSpan = toast.querySelector('#wechatId');
    if (wechatIdSpan) {
        wechatIdSpan.onclick = () => {
            navigator.clipboard.writeText('p7tk19').then(() => {
                showSuccess('已复制到剪贴板: p7tk19');
            }).catch(() => showError('复制失败'));
        };
    }

    const closeButton = toast.querySelector('button');
    closeButton.onclick = () => {
        toast.classList.remove('show');
    };

    toast.addEventListener('transitionend', () => {
        if (!toast.classList.contains('show')) {
            toast.remove();
        }
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
}

export function showVideoSuccessToast(taskId) {
    const toast = document.getElementById('videoSuccessToast');
    const taskIdSpan = document.getElementById('toastTaskId');

    if (!toast || !taskIdSpan) return;

    taskIdSpan.textContent = taskId;
    taskIdSpan.title = taskId;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 30000);

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            toast.classList.remove('show');
        };
    }
}
