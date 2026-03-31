import { safeStringify } from './format.js';
import { showSuccess, showError } from '../ui/components/toast.js';

export class Logger {
    constructor(domElement) {
        this.domElement = domElement;
    }

    clear() {
        if (this.domElement) {
            this.domElement.innerHTML = '';
            this.domElement.classList.remove('active');
        }
    }

    append(level, text, data) {
        if (!this.domElement) return;

        // 当添加第一条日志时，激活深色背景
        if (!this.domElement.classList.contains('active')) {
            this.domElement.classList.add('active');
        }

        const time = new Date().toLocaleTimeString('zh-CN');
        
        // POSTMAN风格：检测是否为HTTP请求
        const isHttpRequest = /^(GET|POST|PUT|DELETE|PATCH)\s+https?:\/\//i.test(text);
        
        if (isHttpRequest) {
            // HTTP请求样式
            const requestBlock = document.createElement('div');
            requestBlock.className = 'log-request-block';
            
            const requestLine = document.createElement('div');
            requestLine.className = 'log-request-line';
            const [method, url] = text.split(' ');
            requestLine.innerHTML = `<span class="log-method log-method-${method.toLowerCase()}">${method}</span><span class="log-url">${url}</span>`;
            requestBlock.appendChild(requestLine);
            
            if (data !== undefined) {
                const dataBlock = document.createElement('div');
                dataBlock.className = 'log-request-data';
                
                if (typeof data === 'object' && data !== null) {
                    // 格式化显示请求体
                    if (data['Content-Type']) {
                        const headerDiv = document.createElement('div');
                        headerDiv.className = 'log-header-item';
                        headerDiv.textContent = `Content-Type: ${data['Content-Type']}`;
                        dataBlock.appendChild(headerDiv);
                    }
                    
                    if (data.Body) {
                        const bodyTitle = document.createElement('div');
                        bodyTitle.className = 'log-body-title';
                        bodyTitle.textContent = 'Body:';
                        dataBlock.appendChild(bodyTitle);
                        
                        const bodyContent = document.createElement('div');
                        bodyContent.className = 'log-body-content';
                        
                        if (Array.isArray(data.Body)) {
                            data.Body.forEach(param => {
                                const paramDiv = document.createElement('div');
                                paramDiv.className = 'log-param-item';
                                
                                const keySpan = document.createElement('span');
                                keySpan.className = 'log-param-key';
                                keySpan.textContent = param.key;
                                
                                const typeSpan = document.createElement('span');
                                typeSpan.className = 'log-param-type';
                                typeSpan.textContent = `[${param.type}]`;
                                
                                const valueSpan = document.createElement('span');
                                valueSpan.className = 'log-param-value';
                                valueSpan.textContent = param.value;
                                
                                paramDiv.appendChild(keySpan);
                                paramDiv.appendChild(typeSpan);
                                paramDiv.appendChild(valueSpan);
                                bodyContent.appendChild(paramDiv);
                            });
                        } else {
                            bodyContent.textContent = JSON.stringify(data.Body, null, 2);
                        }
                        
                        dataBlock.appendChild(bodyContent);
                    }
                } else {
                    dataBlock.textContent = typeof data === 'string' ? data : safeStringify(data);
                }
                
                requestBlock.appendChild(dataBlock);
            }
            
            this.domElement.appendChild(requestBlock);
        } else if (/^Response\s+\d+/.test(text)) {
            // HTTP响应样式
            const responseBlock = document.createElement('div');
            responseBlock.className = 'log-response-block';
            
            const responseLine = document.createElement('div');
            responseLine.className = 'log-response-line';
            const statusMatch = text.match(/Response\s+(\d+)/);
            const status = statusMatch ? statusMatch[1] : '200';
            const statusClass = status.startsWith('2') ? 'success' : (status.startsWith('4') || status.startsWith('5') ? 'error' : 'info');
            responseLine.innerHTML = `<span class="log-response-label">Response</span><span class="log-status log-status-${statusClass}">${status}</span>`;
            responseBlock.appendChild(responseLine);
            
            if (data !== undefined) {
                const dataBlock = document.createElement('pre');
                dataBlock.className = 'log-response-data';
                dataBlock.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                responseBlock.appendChild(dataBlock);
            }
            
            this.domElement.appendChild(responseBlock);
        } else {
            // 普通日志样式
            const line = document.createElement('div');
            line.className = `log-line log-${level}`;
            line.textContent = `[${time}] ${text}`;
            this.domElement.appendChild(line);
            
            if (data !== undefined) {
                const pre = document.createElement('pre');
                pre.className = `log-data log-${level}`;
                pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                this.domElement.appendChild(pre);
            }
        }
        
        this.domElement.scrollTop = this.domElement.scrollHeight;
    }

    copy() {
        if (!this.domElement) return;
        const text = this.domElement.innerText || this.domElement.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('日志已复制到剪贴板');
        }).catch(() => showError('复制失败'));
    }
}

export function createCallLogger(globalLogger) {
    const logs = []; // {time, level, message, data?}
    const add = (level, message, data) => {
        const time = new Date();
        const item = { time: time.toLocaleString('zh-CN'), level, message };
        if (data !== undefined) item.data = data;
        logs.push(item);
        if (globalLogger) {
            globalLogger.append(level, message, data);
        }
    };
    return { logs, add };
}
