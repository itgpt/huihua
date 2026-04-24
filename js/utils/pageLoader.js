const includePattern = /^[ \t]*<!--\s*include:\s*([^>]+?)\s*-->[ \t]*(?:\r?\n)?/gm;

function resolveInclude(includeTarget, parentUrl) {
    const target = includeTarget.trim();
    const baseUrl = target.startsWith('./') || target.startsWith('../')
        ? parentUrl
        : document.baseURI;

    return new URL(target, baseUrl);
}

async function renderFromUrl(url, stack = []) {
    if (url.origin !== window.location.origin) {
        throw new Error(`拒绝加载跨源页面片段: ${url.href}`);
    }

    if (stack.includes(url.href)) {
        throw new Error(`页面片段存在循环引用: ${[...stack, url.href].join(' -> ')}`);
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`页面片段加载失败: ${url.pathname}`);
    }

    const source = await response.text();
    let output = '';
    let lastIndex = 0;

    for (const match of source.matchAll(includePattern)) {
        output += source.slice(lastIndex, match.index);
        output += await renderFromUrl(resolveInclude(match[1], url), [...stack, url.href]);
        lastIndex = match.index + match[0].length;
    }

    return output + source.slice(lastIndex);
}

export function renderPage(partialPath) {
    return renderFromUrl(new URL(partialPath, document.baseURI));
}

export async function loadPageInto(target, partialPath) {
    target.innerHTML = await renderPage(partialPath);
}
