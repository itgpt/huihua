import { showError, showSuccess } from './toast.js';

export class ImagePreviewManager {
    constructor(dom, onUpdate) {
        this.dom = dom;
        this.onUpdate = onUpdate; // 回调函数，用于更新模式指示器等
        this.uploadedFiles = [];
    }

    // 从URL加载图片
    async loadImagesFromUrls() {
        const urls = this.dom.imageUrls.value.trim().split('\n').filter(url => url.trim());
        if (urls.length === 0) {
            showError('请输入至少一个图片URL');
            return;
        }
        
        this.dom.loadUrlsBtn.disabled = true;
        this.dom.loadUrlsBtn.classList.add('loading');
        this.dom.loadUrlsBtn.textContent = '加载中...';
        
        const newUrlImages = [];
        const errors = [];
        
        for (const url of urls) {
            const trimmedUrl = url.trim();
            if (!trimmedUrl) continue;
            
            try {
                // 验证URL格式
                if (!/^https?:\/\//i.test(trimmedUrl)) {
                    errors.push(`无效的URL格式: ${trimmedUrl}`);
                    continue;
                }
                
                // 创建一个虚拟的File对象来表示URL图片
                const fileName = trimmedUrl.split('/').pop() || 'url-image.jpg';
                const urlFile = {
                    name: fileName,
                    size: 0,
                    type: 'image/jpeg',
                    isFromUrl: true,
                    originalUrl: trimmedUrl
                };
                
                newUrlImages.push(urlFile);
            } catch (error) {
                errors.push(`处理失败 ${trimmedUrl}: ${error.message}`);
            }
        }
        
        if (newUrlImages.length > 0) {
            // 合并到uploadedFiles中
            this.uploadedFiles = [...this.uploadedFiles.filter(f => !f.isFromUrl), ...newUrlImages];
            this.render();
            showSuccess(`成功添加 ${newUrlImages.length} 个图片URL`);
        }
        
        if (errors.length > 0) {
            showError('部分URL处理失败', errors.join('\n'));
        }
        
        this.dom.loadUrlsBtn.disabled = false;
        this.dom.loadUrlsBtn.classList.remove('loading');
        this.dom.loadUrlsBtn.textContent = '加载图片';
    }

    addFiles(files) {
        const combinedFiles = [...this.uploadedFiles];
        
        files.forEach(newFile => {
            if (!this.uploadedFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)) {
                combinedFiles.push(newFile);
            }
        });
        
        this.uploadedFiles = combinedFiles;
        this.updateInputFiles();
        this.render();
    }

    deleteImage(indexToDelete) {
        this.uploadedFiles.splice(indexToDelete, 1);
        this.updateInputFiles();
        this.render();

        if (this.uploadedFiles.length === 0) {
            this.dom.fileUploadLabel.textContent = '点击选择图片文件 (支持多选, 将自动转为Base64)';
            if (this.onUpdate) this.onUpdate(false);
            showSuccess('所有图片已清除');
        }
    }
    
    updateInputFiles() {
        const dataTransfer = new DataTransfer();
        this.uploadedFiles.forEach(file => {
            if (!file.isFromUrl) {
                dataTransfer.items.add(file);
            }
        });
        this.dom.imageFile.files = dataTransfer.files;
    }

    render() {
        // 释放旧的 Object URL，防止内存泄漏
        const oldImgs = this.dom.imagePreviewContainer.querySelectorAll('img[data-object-url]');
        oldImgs.forEach(img => URL.revokeObjectURL(img.src));

        this.dom.imagePreviewContainer.innerHTML = '';
        
        if (this.uploadedFiles.length === 0) {
            this.dom.imagePreviewContainer.style.display = 'none';
            if (this.onUpdate) this.onUpdate(false);
            return;
        }

        this.dom.imagePreviewContainer.style.display = 'flex';
        if (this.onUpdate) this.onUpdate(true);

        let urlCount = 0;
        
        this.uploadedFiles.forEach((file, index) => {
            const previewWrapper = document.createElement('div');
            previewWrapper.style.position = 'relative';
            
            const img = document.createElement('img');
            // 使用懒加载属性，视口外图片延迟解码
            img.loading = 'lazy';
            img.decoding = 'async';
            
            if (file.isFromUrl) {
                img.src = file.originalUrl;
                urlCount++;
                
                const urlBadge = document.createElement('div');
                urlBadge.style.cssText = `
                    position: absolute; top: 6px; left: 6px;
                    background: rgba(99, 102, 241, 0.9); color: white;
                    padding: 3px 6px; border-radius: 6px; font-size: 10px;
                    font-weight: 600; backdrop-filter: blur(2px);
                `;
                urlBadge.textContent = 'URL';
                previewWrapper.appendChild(urlBadge);
            } else {
                // 【优化】使用 URL.createObjectURL 替代 FileReader.readAsDataURL
                // 原因：readAsDataURL 会将整个文件转为 base64 字符串，大图会长时间占用主线程
                // createObjectURL 只创建一个轻量级的内存引用，浏览器按需解码，不阻塞主线程
                const objectUrl = URL.createObjectURL(file);
                img.src = objectUrl;
                img.dataset.objectUrl = '1'; // 标记需要在销毁时 revoke
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-image-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = '删除此图片';
            deleteBtn.onclick = () => {
                // 删除时主动释放 Object URL
                if (img.dataset.objectUrl) URL.revokeObjectURL(img.src);
                this.deleteImage(index);
            };

            previewWrapper.appendChild(img);
            previewWrapper.appendChild(deleteBtn);
            this.dom.imagePreviewContainer.appendChild(previewWrapper);
        });
        
        this.dom.fileUploadLabel.textContent = this.uploadedFiles.length > 0 ? `已选择 ${this.uploadedFiles.length} 张` : '点击选择图片 (支持多选)';
    }
    
    getFiles() {
        return this.uploadedFiles;
    }
}
