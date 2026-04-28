/**
 * 工具栏管理模块
 * 负责工具按钮的点击事件和工具模态框的打开
 */

import VideoFrameExtractor from './tools/videoFrameExtractor.js';
import PromptLibrary from './tools/promptLibrary.js';
import ImageSlicer from './tools/imageSlicer.js';
import QuickTimeline from './tools/quickTimeline.js?v=scdn-image-host-20260428';
import Storyboard from './tools/storyboard.js';
import XhsLab from './tools/xhsLab.js';

const ToolsBar = {
    /**
     * 初始化工具栏
     */
    init() {
        this.setupButtons();
        
        // 预初始化已实现的工具
        VideoFrameExtractor.init();
        PromptLibrary.init();
        Storyboard.init();
        XhsLab.init();
    },
    
    /**
     * 设置工具按钮点击事件
     */
    setupButtons() {
        const buttons = document.querySelectorAll('.tool-button');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // 向上查找 .tool-button，防止点击到内部元素时找不到 dataset
                const target = e.target.closest('.tool-button');
                if (!target) return;
                
                const toolName = target.dataset.tool;
                
                if (!toolName) {
                    console.warn('[ToolsBar] 工具按钮缺少data-tool属性');
                    return;
                }
                
                this.openTool(toolName);
            });
        });
        
    },
    
    /**
     * 打开指定工具
     * @param {string} toolName - 工具名称
     */
    openTool(toolName) {
        switch(toolName) {
            case 'videoFrames':
                VideoFrameExtractor.open();
                break;
            case 'promptLibrary':
                PromptLibrary.open();
                break;
            case 'imageSlicer':
                ImageSlicer.open();
                break;
            case 'timeline':
                QuickTimeline.open();
                break;
            case 'storyboard':
                Storyboard.open();
                break;
            case 'xhsLab':
                XhsLab.open();
                break;
            default:
                // 显示提示信息
                this.showToolMessage(toolName);
                break;
        }
    },
    
    /**
     * 显示工具提示信息（临时实现）
     * @param {string} toolName - 工具名称
     */
    showToolMessage(toolName) {
        const toolNames = {
            promptLibrary: '图片提示词库',
            imageSlicer: '图片分割工厂',
            videoFrames: '视频帧提取',
            timeline: '时间线',
            storyboard: '分镜设计',
            xhsLab: '灵感实验室'
        };
        
        const name = toolNames[toolName] || toolName;
        alert(`${name} 功能正在开发中，敬请期待！`);
    }
};

export default ToolsBar;
