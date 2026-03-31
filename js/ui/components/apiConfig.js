/**
 * API配置折叠管理模块
 * 负责API配置区域的折叠/展开、状态检测和持久化
 */

const ApiConfig = {
    // 配置状态
    isConfigured: false,
    isCollapsed: false,
    
    /**
     * 初始化API配置模块
     */
    init() {
        console.log('[ApiConfig] 初始化API配置模块...');
        
        // 设置折叠/展开事件
        this.setupToggle();
        
        // 检查配置状态
        this.checkConfigStatus();
        
        // 加载折叠状态
        this.loadCollapseState();
        
        // 监听输入变化
        this.setupInputListeners();
        
        console.log('[ApiConfig] API配置模块初始化完成');
    },
    
    /**
     * 检查API配置是否完整
     */
    checkConfigStatus() {
        const apiKey = document.getElementById('apiKey')?.value.trim() || '';
        const apiBaseUrl = document.getElementById('apiBaseUrl')?.value.trim() || '';
        
        this.isConfigured = apiKey.length > 0 && apiBaseUrl.length > 0;
        
        // 更新状态徽章
        this.updateStatusBadge();
        
        // 如果配置完成，自动折叠
        if (this.isConfigured && !this.isCollapsed) {
            this.collapse();
        }
        
        return this.isConfigured;
    },
    
    /**
     * 更新状态徽章显示
     */
    updateStatusBadge() {
        const statusBadge = document.querySelector('.api-status');
        if (!statusBadge) return;
        
        if (this.isConfigured) {
            statusBadge.className = 'api-status configured';
            statusBadge.textContent = '✅ 已配置';
        } else {
            statusBadge.className = 'api-status required';
            statusBadge.textContent = '⚠️ 必填';
        }
    },
    
    /**
     * 设置折叠/展开切换事件
     */
    setupToggle() {
        const header = document.querySelector('.api-config-header');
        if (!header) {
            console.warn('[ApiConfig] 未找到API配置标题栏');
            return;
        }
        
        header.addEventListener('click', () => {
            this.toggle();
        });
    },
    
    /**
     * 设置输入框监听
     */
    setupInputListeners() {
        const apiKey = document.getElementById('apiKey');
        const apiBaseUrl = document.getElementById('apiBaseUrl');
        
        if (apiKey) {
            apiKey.addEventListener('input', () => {
                this.checkConfigStatus();
            });
        }
        
        if (apiBaseUrl) {
            apiBaseUrl.addEventListener('input', () => {
                this.checkConfigStatus();
            });
        }
    },
    
    /**
     * 切换折叠/展开状态
     */
    toggle() {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    },
    
    /**
     * 折叠API配置区域
     */
    collapse() {
        const card = document.querySelector('.api-config-card');
        if (!card) return;
        
        card.classList.add('collapsed');
        this.isCollapsed = true;
        this.saveCollapseState();
        
        console.log('[ApiConfig] API配置已折叠');
    },
    
    /**
     * 展开API配置区域
     */
    expand() {
        const card = document.querySelector('.api-config-card');
        if (!card) return;
        
        card.classList.remove('collapsed');
        this.isCollapsed = false;
        this.saveCollapseState();
        
        console.log('[ApiConfig] API配置已展开');
    },
    
    /**
     * 保存折叠状态到localStorage
     */
    saveCollapseState() {
        try {
            localStorage.setItem('api_config_collapsed', this.isCollapsed ? 'true' : 'false');
        } catch (e) {
            console.warn('[ApiConfig] 保存折叠状态失败:', e);
        }
    },
    
    /**
     * 从localStorage加载折叠状态
     */
    loadCollapseState() {
        try {
            const saved = localStorage.getItem('api_config_collapsed');
            if (saved === 'true') {
                this.collapse();
            }
        } catch (e) {
            console.warn('[ApiConfig] 加载折叠状态失败:', e);
        }
    },
    
    /**
     * 获取API配置
     */
    getConfig() {
        return {
            apiKey: document.getElementById('apiKey')?.value.trim() || '',
            apiBaseUrl: document.getElementById('apiBaseUrl')?.value.trim() || ''
        };
    }
};

export default ApiConfig;
