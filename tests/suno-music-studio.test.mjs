// 针对 suno-music-studio.html 的功能测试。
// 真实页面 + 真实 DOM，只在网络和定时器上打桩。
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startPage } from './helpers/browser-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let page;

before(async () => {
  page = await startPage(projectRoot);
});

after(async () => {
  await page?.close();
});

beforeEach(async () => {
  await page.open();
  await page.eval('localStorage.clear()');
  await page.open();
  await page.installStubs();
});

const settle = () => page.eval('new Promise((r) => setTimeout(r, 60))');

// 直接按结构取第一张结果卡片的状态/正文，避免把测试绑死在元素 id 规则上
const cardStatus = (selector = '#generateResults .result-card .result-status') =>
  page.eval(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
const cardBody = (selector = '#generateResults .result-card .result-body') =>
  page.eval(`document.querySelector(${JSON.stringify(selector)})?.innerHTML ?? ''`);

describe('页面加载', () => {
  it('加载完成后没有 JS 报错，关键控件都存在', async () => {
    assert.deepEqual(page.pageErrors, []);
    assert.deepEqual(page.consoleErrors, []);

    const missing = await page.eval(`
      ['generateBtn','prompt','title','tags','generateResults','lyricsPrompt','lyricsResult',
       'queryTaskId','queryResult','toolTaskId','uploadFileUrl','historyList','settingsModal',
       'apiKeyInput','apiBaseInput','apiStatusDot','apiStatusText','toastContainer']
        .filter((id) => !document.getElementById(id));
    `);
    assert.deepEqual(missing, []);
  });

  it('未配置 API Key 时状态显示“未配置”，保存设置后显示“已配置”并落盘', async () => {
    assert.equal(await page.eval('config.apiKey'), '');
    assert.equal(await page.eval(`document.getElementById('apiStatusText').textContent`), '未配置 API Key');

    await page.eval(`
      document.getElementById('apiKeyInput').value = 'sk-abc';
      document.getElementById('apiBaseInput').value = 'https://api.example.test/';
      saveSettings();
      true;
    `);

    assert.equal(await page.eval(`document.getElementById('apiStatusText').textContent`), 'API 已配置');
    assert.equal(await page.eval(`localStorage.getItem('suno_api_key')`), 'sk-abc');
    assert.equal(await page.eval('config.apiBase'), 'https://api.example.test/');
    assert.equal(
      await page.eval(`document.getElementById('settingsModal').classList.contains('active')`),
      false
    );
  });

  it('导航切换会把对应页面标记为 active', async () => {
    await page.eval(`switchPage('query')`);
    assert.equal(
      await page.eval(`document.getElementById('page-query').classList.contains('active')`),
      true
    );
    assert.equal(
      await page.eval(`document.getElementById('page-generate').classList.contains('active')`),
      false
    );
  });
});

describe('端点映射 mapApiEndpoint', () => {
  beforeEach(async () => {
    await page.configureApi({ apiBase: 'https://api.example.test' });
  });

  it('生成 / 歌词 / 上传 / 工具端点都映射到网关路径', async () => {
    const cases = [
      ['/api/suno/generate', { url: 'https://api.example.test/suno/submit/music', method: 'POST', newApiModel: 'suno_music' }],
      ['/api/suno/lyrics', { url: 'https://api.example.test/suno/submit/lyrics', method: 'POST', newApiModel: 'suno_lyrics' }],
      ['/api/suno/uploads/audio', { url: 'https://api.example.test/suno/uploads/audio-url', method: 'POST' }],
      ['/api/suno/speed', { url: 'https://api.example.test/suno/submit/speed', method: 'POST' }],
      ['/api/suno/crop', { url: 'https://api.example.test/suno/submit/crop', method: 'POST' }],
      ['/api/suno/wav', { url: 'https://api.example.test/suno/submit/wav', method: 'POST' }],
      ['/api/suno/midi', { url: 'https://api.example.test/suno/submit/midi', method: 'POST' }],
      ['/api/suno/video', { url: 'https://api.example.test/suno/submit/video', method: 'POST' }],
      ['/api/suno/timing', { url: 'https://api.example.test/suno/submit/timing', method: 'POST' }]
    ];
    for (const [endpoint, expected] of cases) {
      assert.deepEqual(await page.eval(`mapApiEndpoint(${JSON.stringify(endpoint)})`), expected, endpoint);
    }
  });

  it('任务查询端点带 task_id 并做 URL 解码', async () => {
    assert.deepEqual(
      await page.eval(`mapApiEndpoint('/api/suno/feed?task_id=abc%2F123&other=1')`),
      { url: 'https://api.example.test/suno/fetch/abc/123', method: 'GET' }
    );
  });

  it('未收录的端点不改写方法，交给调用方决定', async () => {
    assert.deepEqual(
      await page.eval(`mapApiEndpoint('/api/unknown')`),
      { url: 'https://api.example.test/api/unknown', method: null }
    );
  });
});

describe('请求封装 apiRequest', () => {
  it('拼接 URL、带鉴权头，并把 0/1 布尔化、按端点补 model', async () => {
    await page.configureApi();
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 't-1' }] } }]);

    const result = await page.eval(`
      apiRequest('/api/suno/generate', 'POST', { custom_mode: 1, make_instrumental: 0, prompt: 'x' })
    `);

    assert.deepEqual(result, { code: 200, msg: '成功', data: [{ task_id: 't-1' }] });

    const [request] = await page.requests();
    assert.equal(request.url, 'https://api.example.test/suno/submit/music');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer sk-test');
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(request.body), {
      custom_mode: true,
      make_instrumental: false,
      prompt: 'x',
      model: 'suno_music'
    });
  });

  it('不覆盖调用方自己传的 model', async () => {
    await page.configureApi();
    await page.setResponses([{ body: { code: 200, data: 'x' } }]);
    await page.eval(`apiRequest('/api/suno/generate', 'POST', { model: 'custom-model' })`);
    const [request] = await page.requests();
    assert.equal(JSON.parse(request.body).model, 'custom-model');
  });

  it('没有 API Key 时不发请求，弹设置窗并报错', async () => {
    await page.configureApi({ apiKey: '' });
    const outcome = await page.eval(`
      apiRequest('/api/suno/generate', 'POST', { prompt: 'x' })
        .then(() => 'resolved')
        .catch((e) => 'rejected:' + e.message)
    `);
    assert.equal(outcome, 'rejected:No API Key');
    assert.deepEqual(await page.requests(), []);
    assert.equal(
      await page.eval(`document.getElementById('settingsModal').classList.contains('active')`),
      true
    );
  });

  it('把 code=success/1/0/200 都视为成功', async () => {
    const results = await page.eval(`
      [ {code:'success'}, {code:200}, {code:'1'}, {code:0}, {code:'500'}, null, {code:'error'} ]
        .map((r) => isOkResult(r))
    `);
    assert.deepEqual(results, [true, true, true, true, false, false, false]);
  });
});

describe('响应归一化', () => {
  it('任务查询响应把 New API 状态翻译成前端 state', async () => {
    const cases = [
      ['NOT_START', 'pending'],
      ['QUEUED', 'pending'],
      ['IN_PROGRESS', 'running'],
      ['SUCCESS', 'succeeded'],
      ['FAILURE', 'failed']
    ];
    for (const [status, expected] of cases) {
      const result = await page.eval(`
        normalizeApiResponse('/api/suno/feed?task_id=t', { code: 200, data: { task_id: 't', status: '${status}' } })
      `);
      assert.equal(result.code, 200, status);
      assert.equal(result.data.state, expected, status);
    }
  });

  it('提交类响应把字符串 / 数字 / 对象 / 数组统一成 task_id 列表', async () => {
    const cases = [
      ['"abc"', 'abc'],
      ['12345', '12345'],
      ['{ "task_id": "obj-1" }', 'obj-1'],
      ['[ { "task_id": "arr-1" } ]', 'arr-1']
    ];
    for (const [payload, expected] of cases) {
      const ids = await page.eval(`
        extractTaskIds(normalizeApiResponse('/api/suno/generate', { code: 200, data: ${payload} }))
      `);
      assert.deepEqual(ids, [expected], payload);
    }
  });

  it('task id 只会是字符串（它们会被直接拼进请求 URL）', async () => {
    const ids = await page.eval(`
      extractTaskIds(normalizeApiResponse('/api/suno/generate', { code: 200, data: [ { id: 'clip-1' } ] }))
    `);
    assert.deepEqual(ids.filter((id) => typeof id !== 'string'), []);
  });
});

describe('状态判断', () => {
  it('isFailedStatus 只在明确失败时为真', async () => {
    const cases = [
      [`isFailedStatus('0', 'pending')`, false],
      [`isFailedStatus('0', undefined)`, true],
      [`isFailedStatus('2', 'running')`, false],
      [`isFailedStatus('3', 'succeeded')`, false],
      [`isFailedStatus('2', 'failed')`, true],
      [`isFailedStatus('1', undefined)`, false]
    ];
    for (const [expr, expected] of cases) {
      assert.equal(await page.eval(expr), expected, expr);
    }
  });

  it('isCompleted 覆盖完成与失败，未完成继续轮询', async () => {
    const cases = [
      [`isCompleted('3', undefined)`, true],
      [`isCompleted(3, undefined)`, true],
      [`isCompleted('2', 'succeeded')`, true],
      [`isCompleted('0', 'pending')`, false],
      [`isCompleted('1', 'running')`, false],
      [`isCompleted('0', 'failed')`, true]
    ];
    for (const [expr, expected] of cases) {
      assert.equal(await page.eval(expr), expected, expr);
    }
  });

  it('状态文案与样式类映射一致', async () => {
    assert.equal(await page.eval(`getStatusText('3')`), '已完成');
    assert.equal(await page.eval(`getStatusText('0')`), '失败');
    assert.equal(await page.eval(`getStatusText('IN_PROGRESS')`), '生成中');
    assert.equal(await page.eval(`getStatusClass('3')`), 'success');
    assert.equal(await page.eval(`getStatusClass('2')`), 'running');
    assert.equal(await page.eval(`getStatusClass('1')`), 'pending');
  });
});

describe('生成音乐', () => {
  beforeEach(async () => {
    await page.configureApi();
  });

  it('灵感模式：描述走 gpt_description_prompt，不塞进 prompt', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'gen-1' }] } }]);

    await page.eval(`
      setMode(0);
      setInstrumental(0);
      document.getElementById('prompt').value = '夏日清新的流行歌';
      generateMusic();
      true;
    `);
    await settle();

    const request = (await page.requests())[0];
    const body = JSON.parse(request.body);
    assert.equal(request.url, 'https://api.example.test/suno/submit/music');
    assert.equal(body.gpt_description_prompt, '夏日清新的流行歌');
    assert.equal(body.prompt, undefined);
    assert.equal(body.custom_mode, false);
    assert.equal(body.make_instrumental, false);
    assert.equal(body.mv, 'chirp-v3-5');
  });

  it('自定义模式：歌词走 prompt，custom_mode 为 true', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'gen-2' }] } }]);

    await page.eval(`
      setMode(1);
      setInstrumental(1);
      document.getElementById('prompt').value = '[Verse]\\n夜晚的风';
      document.getElementById('title').value = '夜风';
      document.getElementById('tags').value = 'pop';
      generateMusic();
      true;
    `);
    await settle();

    const body = JSON.parse((await page.requests())[0].body);
    assert.equal(body.prompt, '[Verse]\n夜晚的风');
    assert.equal(body.custom_mode, true);
    assert.equal(body.make_instrumental, true);
    assert.equal(body.title, '夜风');
    assert.equal(body.tags, 'pop');
    assert.equal(body.gpt_description_prompt, undefined);
  });

  it('描述为空时提示用户且不发请求', async () => {
    await page.eval(`setMode(0); document.getElementById('prompt').value = ''; generateMusic(); true;`);
    await settle();
    assert.deepEqual(await page.requests(), []);
    assert.match(
      await page.eval(`document.getElementById('toastContainer').textContent`),
      /请输入音乐描述/
    );
  });

  it('选了声音性别时带上 metadata 控制参数', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'gen-3' }] } }]);
    await page.eval(`
      document.getElementById('prompt').value = 'x';
      document.getElementById('vocal_gender').value = 'f';
      document.getElementById('create_mode').value = 'custom';
      document.getElementById('style_weight').value = '0.5';
      generateMusic();
      true;
    `);
    await settle();

    const body = JSON.parse((await page.requests())[0].body);
    assert.equal(body.metadata.vocal_gender, 'f');
    assert.equal(body.metadata.create_mode, 'custom');
    assert.deepEqual(body.metadata.control_sliders, {
      style_weight: 0.5,
      weirdness_constraint: 0.75,
      audio_weight: 0.89
    });
    assert.deepEqual(body.metadata.can_control_sliders, ['style_weight', 'weirdness_constraint', 'audio_weight']);
  });

  it('提交成功后渲染结果卡片并写入历史记录', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'gen-4' }] } }]);
    await page.eval(`
      document.getElementById('prompt').value = '测试歌曲';
      document.getElementById('tags').value = 'lofi';
      generateMusic();
      true;
    `);
    await settle();

    assert.match(
      await page.eval(`document.getElementById('generateResults').innerHTML`),
      /gen-4/
    );
    const history = await page.eval(`JSON.parse(localStorage.getItem('suno_history'))`);
    assert.equal(history.length, 1);
    assert.equal(history[0].task_id, 'gen-4');
    assert.equal(history[0].title, '测试歌曲');
    assert.equal(history[0].status, 'pending');
  });

  it('提交失败时显示失败卡片且不写历史', async () => {
    await page.setResponses([{ body: { code: 500, message: '额度不足' } }]);
    await page.eval(`document.getElementById('prompt').value = 'x'; generateMusic(); true;`);
    await settle();

    assert.match(await page.eval(`document.getElementById('generateResults').innerHTML`), /额度不足/);
    assert.equal(await page.eval(`localStorage.getItem('suno_history')`), null);
  });
});

describe('轮询任务状态', () => {
  beforeEach(async () => {
    await page.configureApi();
  });

  it('立即查询一次，完成后停止轮询并渲染结果', async () => {
    await page.eval(`document.getElementById('generateResults').innerHTML = createResultCard('t-poll', '标题', 1, 'gen-t-poll');`);
    await page.setResponses([
      { body: { code: 200, data: { task_id: 't-poll', status: '2', state: 'running' } } },
      { body: { code: 200, data: { task_id: 't-poll', status: '3', audio_url: 'https://cdn.test/a.mp3' } } }
    ]);

    await page.eval(`startPolling('t-poll', 'gen-t-poll'); true;`);
    await settle();
    assert.equal(await cardStatus(), '生成中');
    assert.equal(await page.eval('window.__intervals.size'), 1);

    await page.eval('window.__tick()');
    await settle();
    assert.equal(await cardStatus(), '已完成');
    assert.equal(await page.eval('window.__intervals.size'), 0);
    assert.match(await cardBody(), /a\.mp3/);
  });

  it('任务失败且配置了重试时会自动重新提交', async () => {
    await page.eval(`document.getElementById('generateResults').innerHTML = createResultCard('t-retry', '标题', 1, 'gen-t-retry');`);
    await page.setResponses([
      { body: { code: 200, data: { task_id: 't-retry', status: '0' } } },
      { body: { code: 200, data: [{ task_id: 't-retry-2' }] } },
      { body: { code: 200, data: { task_id: 't-retry-2', status: '2', state: 'running' } } }
    ]);

    await page.eval(`
      startPolling('t-retry', 'gen-t-retry', { params: { prompt: 'x' }, useJson: true, attempt: 1, maxAttempt: 3 });
      true;
    `);
    await settle();

    const urls = (await page.requests()).map((r) => r.url);
    assert.equal(urls.filter((u) => u.endsWith('/suno/submit/music')).length, 1, '应重新提交一次');
    // 重试提交的新任务要接着更新同一张卡片（而不是把卡片丢在原地）
    assert.equal(await cardStatus(), '生成中');
    assert.match(await cardBody(), /t-retry-2/);
    assert.equal(await page.eval('window.__intervals.size'), 1, '应继续轮询新任务');
  });

  it('超过轮询上限时标记为超时', async () => {
    await page.eval(`document.getElementById('generateResults').innerHTML = createResultCard('t-slow', '标题', 1, 'gen-t-slow');`);
    await page.setResponses(Array.from({ length: 200 }, () => ({
      body: { code: 200, data: { task_id: 't-slow', status: '2', state: 'running' } }
    })));

    await page.eval(`startPolling('t-slow', 'gen-t-slow'); true;`);
    await settle();
    for (let i = 0; i < 121; i++) await page.eval('window.__tick()');
    await settle();

    assert.equal(await cardStatus(), '轮询超时');
    assert.equal(await page.eval('window.__intervals.size'), 0);
  });

  it('状态更新函数会作用到真实渲染出来的卡片元素上', async () => {
    await page.eval(`
      document.getElementById('generateResults').innerHTML = createResultCard('t-x', '标题', 1, 'gen-t-x');
      updateCardStatus('gen-t-x', 'failed', '失败');
      true;
    `);
    assert.equal(await cardStatus(), '失败');
  });

  it('查询失败时卡片状态应当变为“查询失败”', async () => {
    await page.eval(`document.getElementById('generateResults').innerHTML = createResultCard('t-fail', '标题', 1, 'query-t-fail');`);
    await page.setResponses([{ body: { code: 500, message: '上游错误' } }]);
    await page.eval(`fetchTaskStatus('t-fail', 'query-t-fail'); true;`);
    await settle();
    assert.equal(await cardStatus(), '查询失败');
  });

  it('任务详情响应里没有 task_id 时，卡片照样更新', async () => {
    await page.eval(`document.getElementById('generateResults').innerHTML = createResultCard('t-nokey', '标题', 1, 'gen-t-nokey');`);
    await page.setResponses([{ body: { code: 200, data: { status: '3', audio_url: 'https://cdn.test/b.mp3' } } }]);
    await page.eval(`fetchTaskStatus('t-nokey', 'gen-t-nokey'); true;`);
    await settle();
    assert.equal(await cardStatus(), '已完成');
    assert.match(await cardBody(), /b\.mp3/);
  });
});

describe('音频工具与歌词', () => {
  beforeEach(async () => {
    await page.configureApi();
  });

  it('音频处理工具按动作映射端点并带 task_id', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'tool-1' }] } }]);
    await page.eval(`document.getElementById('toolTaskId').value = 'src-1'; toolAction('wav'); true;`);
    await settle();

    const [request] = await page.requests();
    assert.equal(request.url, 'https://api.example.test/suno/submit/wav');
    assert.deepEqual(JSON.parse(request.body), { task_id: 'src-1' });
  });

  it('变速参数带上倍速、音高与标题', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'sp-1' }] } }]);
    await page.eval(`
      document.getElementById('toolTaskId').value = 'src-2';
      document.getElementById('speedMultiplier').value = '1.5';
      document.getElementById('keepPitch').value = 'true';
      document.getElementById('speedTitle').value = '快版';
      adjustSpeed();
      true;
    `);
    await settle();

    assert.deepEqual(JSON.parse((await page.requests())[0].body), {
      task_id: 'src-2',
      speed_multiplier: 1.5,
      keep_pitch: true,
      title: '快版'
    });
  });

  it('裁剪参数带上起止时间', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'crop-1' }] } }]);
    await page.eval(`
      document.getElementById('toolTaskId').value = 'src-3';
      document.getElementById('cropStart').value = '5';
      document.getElementById('cropEnd').value = '20';
      document.getElementById('cropRemove').value = 'true';
      cropMusic();
      true;
    `);
    await settle();

    assert.deepEqual(JSON.parse((await page.requests())[0].body), {
      task_id: 'src-3',
      crop_start_s: 5,
      crop_end_s: 20,
      is_crop_remove: true
    });
  });

  it('缺少 Task ID 时工具不会发请求', async () => {
    await page.eval(`document.getElementById('toolTaskId').value = ''; toolAction('wav'); true;`);
    await settle();
    assert.deepEqual(await page.requests(), []);
  });

  it('歌词生成成功后展示歌词并记住结果', async () => {
    await page.setResponses([
      { body: { code: 200, data: 'ly-1' } },
      { body: { code: 200, data: { task_id: 'ly-1', state: 'succeeded', data: { ret_a: { text: '[Verse]\n风', title: '风' } } } } }
    ]);
    await page.eval(`document.getElementById('lyricsPrompt').value = '关于风'; generateLyrics(); true;`);
    await page.eval('new Promise((r) => setTimeout(r, 5200))');

    assert.equal(await page.eval('window._lastLyrics'), '[Verse]\n风');
    assert.equal(await page.eval('window._lastLyricsTitle'), '风');
    assert.match(await page.eval(`document.getElementById('lyricsResult').innerHTML`), /\[Verse\]/);
  });
});

describe('历史记录', () => {
  it('最多保存 100 条', async () => {
    await page.eval(`
      for (let i = 0; i < 130; i++) saveToHistory('id-' + i, '标题 ' + i, '');
      true;
    `);
    const history = await page.eval(`JSON.parse(localStorage.getItem('suno_history'))`);
    assert.equal(history.length, 100);
    assert.equal(history[0].task_id, 'id-129');
  });

  it('状态更新只影响对应任务', async () => {
    await page.eval(`
      saveToHistory('a', 'A', '');
      saveToHistory('b', 'B', '');
      updateHistoryStatus('a', 'completed');
      true;
    `);
    const history = await page.eval(`JSON.parse(localStorage.getItem('suno_history'))`);
    const a = history.find((h) => h.task_id === 'a');
    const b = history.find((h) => h.task_id === 'b');
    assert.equal(a.status, 'completed');
    assert.equal(b.status, 'pending');
  });

  it('渲染历史时转义标题，避免 HTML 注入', async () => {
    await page.eval(`
      localStorage.setItem('suno_history', JSON.stringify([
        { task_id: 'x', title: '<img src=x onerror=alert(1)>', tags: '', status: 'pending', created_at: new Date().toISOString() }
      ]));
      renderHistory();
      true;
    `);
    const html = await page.eval(`document.getElementById('historyList').innerHTML`);
    assert.equal(html.includes('<img src=x'), false);
    assert.match(html, /&lt;img/);
  });
});

describe('翻唱与上传', () => {
  beforeEach(async () => {
    await page.configureApi();
  });

  it('点击翻唱按钮会带着原曲 ID 与模式提交', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'cover-2' }] } }]);
    await page.eval(`
      setCoverMode(0);
      switchPage('cover');
      document.getElementById('cover_clip_id_input').value = 'clip-2';
      document.getElementById('cover_prompt').value = '摇滚风';
      document.querySelector('#page-cover button[onclick="generateCover()"]').click();
      true;
    `);
    await settle();

    const [request] = await page.requests();
    assert.equal(request.url, 'https://api.example.test/suno/submit/music');
    const body = JSON.parse(request.body);
    assert.equal(body.cover_clip_id, 'clip-2');
    assert.equal(body.prompt, '摇滚风');
    assert.equal(body.custom_mode, false);
    assert.equal(body.make_instrumental, false);
    assert.equal(body.mv, 'chirp-v3-5');
    assert.equal(await page.eval(`document.getElementById('coverResults').innerHTML.includes('cover-2')`), true);
  });

  it('翻唱提交走 JSON body（网关 sunoapi 插件要求 JSON）', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'cover-1' }] } }]);
    await page.eval(`
      document.getElementById('cover_clip_id_input').value = 'clip-1';
      document.getElementById('cover_prompt').value = '爵士风';
      document.getElementById('cover_mv').value = 'chirp-v3-5';
      document.querySelector('#page-cover button[onclick="generateCover()"]').click();
      true;
    `);
    await settle();

    const [request] = await page.requests();
    assert.ok(request, '应当发出请求');
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.doesNotThrow(() => JSON.parse(request.body), 'body 必须是 JSON');
  });

  it('翻唱的高级参数与生成音乐保持同一结构（不能双重编码成字符串）', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'cover-3' }] } }]);
    await page.eval(`
      document.getElementById('cover_clip_id_input').value = 'clip-3';
      document.getElementById('cover_prompt').value = '摇滚风';
      document.getElementById('cover_vocal_gender').value = 'f';
      document.querySelector('#page-cover button[onclick="generateCover()"]').click();
      true;
    `);
    await settle();

    assert.ok((await page.requests()).length, '应当发出请求');
    const body = JSON.parse((await page.requests())[0].body);
    assert.equal(typeof body.metadata, 'object', 'metadata 应当是对象，与生成音乐一致');
    assert.equal(body.metadata.vocal_gender, 'f');
  });

  it('翻唱提交不依赖全局 event（非点击触发也要能跑）', async () => {
    await page.setResponses([{ body: { code: 200, data: [{ task_id: 'cover-4' }] } }]);
    const outcome = await page.eval(`
      (async () => {
        document.getElementById('cover_clip_id_input').value = 'clip-4';
        document.getElementById('cover_prompt').value = '风格';
        try { await generateCover(); return 'ok'; } catch (e) { return 'threw: ' + e.message; }
      })()
    `);
    assert.equal(outcome, 'ok');
  });

  it('上传音频接口带文件 URL 与扩展名', async () => {
    await page.setResponses([{ body: { code: 200, data: { task_id: 'up-1' } } }]);
    await page.eval(`
      document.getElementById('uploadFileUrl').value = 'https://cdn.test/a.mp3';
      document.getElementById('uploadExtension').value = 'mp3';
      uploadAudio();
      true;
    `);
    await settle();

    const [request] = await page.requests();
    assert.equal(request.url, 'https://api.example.test/suno/uploads/audio-url');
    assert.deepEqual(JSON.parse(request.body), { file: 'https://cdn.test/a.mp3', extension: 'mp3' });
  });
});
