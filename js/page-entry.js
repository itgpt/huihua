import { loadPageInto } from './utils/pageLoader.js';

function showLoadError(error) {
    console.error('页面加载失败:', error);

    const container = document.createElement('div');
    container.className = 'page-load-error';

    const title = document.createElement('h1');
    title.textContent = '页面加载失败';

    const message = document.createElement('p');
    message.textContent = error instanceof Error ? error.message : '请刷新后重试';

    container.append(title, message);
    document.body.replaceChildren(container);
}

try {
    await loadPageInto(document.body, 'pages/main/layout.html');
    await import('./main.js?v=timeline-preview-fit-20260424');
} catch (error) {
    showLoadError(error);
}
