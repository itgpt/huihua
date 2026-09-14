// 测试脚手架：把真实的 suno-music-studio.html 加载进无头 Chrome。
// 只在网络边界（window.fetch）和定时器上打桩，DOM / 渲染 / 业务逻辑都是真实执行。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

class CdpConnection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
        return;
      }
      const listeners = this.handlers.get(message.method);
      if (listeners) listeners.forEach((fn) => fn(message.params));
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, new Set());
    this.handlers.get(method).add(fn);
  }

  waitFor(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeoutMs);
      const handler = (params) => {
        clearTimeout(timer);
        this.handlers.get(method).delete(handler);
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

function startStaticServer(root) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
        return;
      }
      const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }).end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.trim()) return content;
    } catch {
      // 文件还没生成，继续等
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Chrome 未在 ${timeoutMs}ms 内就绪（缺少 ${filePath}）`);
}

async function waitForPageTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // DevTools 还没起来
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('未找到可用的页面调试目标');
}

export class SunoPage {
  constructor({ cdp, chrome, server, userDataDir, baseUrl }) {
    this.cdp = cdp;
    this.chrome = chrome;
    this.server = server;
    this.userDataDir = userDataDir;
    this.baseUrl = baseUrl;
    this.consoleErrors = [];
    this.pageErrors = [];
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        this.consoleErrors.push(params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      this.pageErrors.push(params.exceptionDetails.exception?.description
        || params.exceptionDetails.text
        || 'unknown page error');
    });
  }

  static async launch({ root, chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome' }) {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suno-chrome-'));
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank'
    ], { stdio: 'ignore' });

    const portFile = path.join(userDataDir, 'DevToolsActivePort');
    const [port] = (await waitForFile(portFile, 20000)).split('\n');
    const target = await waitForPageTarget(port.trim(), 20000);

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP 连接失败')), { once: true });
    });

    const cdp = new CdpConnection(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    const { server, port: httpPort } = await startStaticServer(root);
    const baseUrl = `http://127.0.0.1:${httpPort}`;
    return new SunoPage({ cdp, chrome, server, userDataDir, baseUrl });
  }

  get url() {
    return `${this.baseUrl}/suno-music-studio.html`;
  }

  async open(pagePath = '/suno-music-studio.html') {
    this.consoleErrors = [];
    this.pageErrors = [];
    const loaded = this.cdp.waitFor('Page.loadEventFired');
    await this.cdp.send('Page.navigate', { url: `${this.baseUrl}${pagePath}` });
    await loaded;
    return this.eval('document.readyState');
  }

  async eval(expression) {
    const source = typeof expression === 'function' ? `(${expression.toString()})()` : expression;
    const result = await this.cdp.send('Runtime.evaluate', {
      expression: source,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || 'evaluate failed';
      throw new Error(detail);
    }
    return result.result.value;
  }

  // 在页面里安装测试替身：fetch 队列 + 可控定时器。
  // 只替换网络与时钟这两处外部依赖，其余逻辑保持真实。
  async installStubs() {
    await this.eval(() => {
      window.__requests = [];
      window.__responses = [];
      window.__intervals = new Map();
      window.__intervalSeq = 0;
      window.setInterval = (fn, ms) => {
        const id = ++window.__intervalSeq;
        window.__intervals.set(id, { fn, ms });
        return id;
      };
      window.clearInterval = (id) => window.__intervals.delete(id);
      window.__tick = async () => {
        const fns = [...window.__intervals.values()].map((v) => v.fn);
        for (const fn of fns) await fn();
        return fns.length;
      };
      window.fetch = async (url, options = {}) => {
        window.__requests.push({
          url: String(url),
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body ? String(options.body) : null
        });
        const next = window.__responses.length
          ? window.__responses.shift()
          : { ok: true, status: 200, body: { code: 200, data: [] } };
        const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
        return {
          ok: next.ok !== false,
          status: next.status || 200,
          statusText: next.statusText || '',
          json: async () => JSON.parse(text),
          text: async () => text
        };
      };
    });
  }

  async setResponses(responses) {
    await this.eval(`window.__responses = ${JSON.stringify(responses)}`);
  }

  async pushResponse(response) {
    await this.eval(`window.__responses.push(${JSON.stringify(response)})`);
  }

  requests() {
    return this.eval('window.__requests');
  }

  async configureApi({ apiKey = 'sk-test', apiBase = 'https://api.example.test' } = {}) {
    await this.eval(`
      localStorage.setItem('suno_api_key', ${JSON.stringify(apiKey)});
      localStorage.setItem('suno_api_base', ${JSON.stringify(apiBase)});
      config.apiKey = ${JSON.stringify(apiKey)};
      config.apiBase = ${JSON.stringify(apiBase)};
      true;
    `);
  }

  async close() {
    try {
      await this.cdp.send('Browser.close');
    } catch {
      // 忽略：可能已经退出
    }
    this.chrome.kill('SIGKILL');
    this.server.close();
    fs.rmSync(this.userDataDir, { recursive: true, force: true });
  }
}

export async function startSunoPage(root) {
  return SunoPage.launch({ root: root || path.resolve(process.cwd()) });
}
