// 针对 seedance2-api-cdn.html 里 gpt-image 图片模型的测试。
// 真实页面 + 真实 DOM，只在网络与定时器上打桩。
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startPage } from './helpers/browser-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = '/seedance2-api-cdn.html';

let page;

before(async () => {
  page = await startPage(projectRoot);
});

after(async () => {
  await page?.close();
});

beforeEach(async () => {
  await page.open(PAGE);
  await page.eval('localStorage.clear()');
  await page.open(PAGE);
  // 这个页面的图片轮询是真实 setInterval，所以这里用真实定时器
  await page.installStubs({ fakeIntervals: false });
});

// 用本项目里真实可访问的图片地址作为"生成结果"，避免测试里去请求外部域名
// （历史记录会在下次加载时渲染这张图，外部域名解析失败会拖慢页面 load）
const localResultUrl = async () => `${await page.eval('location.origin')}/tests/fixtures/result.svg`;

// 填好一次提交图片所需的表单（含保存配置，便于刷新后仍是同一套设置）
const setupForm = `
  document.getElementById('apiKey').value = 'sk-test';
  document.getElementById('baseUrl').value = 'https://api.example.test';
  document.getElementById('imagePrompt').value = '一只戴墨镜的猫';
  document.getElementById('imageSize').value = '9:16';
  document.getElementById('imageGenerationCount').value = '1';
  document.getElementById('pollInterval').value = '2';
  saveAllConfigs();
  true;
`;

const taskRecords = () => page.eval(`JSON.parse(localStorage.getItem('seedance_task_records') || '[]')`);
const historyRecords = () => page.eval(`JSON.parse(localStorage.getItem('seedance_history') || '[]')`);

async function waitFor(predicate, timeoutMs = 8000, intervalMs = 200) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待条件超时');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe('图片模型列表', () => {
  it('下拉里有 gpt-image-2.5-flare 与 gpt-image-2.5-sunburst', async () => {
    const options = await page.eval(`
      [...document.getElementById('imageModel').options].map((o) => o.value)
    `);
    assert.ok(options.includes('gpt-image-2.5-flare'), `缺少 flare，现有：${options.join(', ')}`);
    assert.ok(options.includes('gpt-image-2.5-sunburst'), `缺少 sunburst，现有：${options.join(', ')}`);
  });

  it('IMAGE_MODEL_OPTIONS 认识这两个模型（配置保存/回填靠它）', async () => {
    const list = await page.eval('IMAGE_MODEL_OPTIONS');
    assert.ok(list.includes('gpt-image-2.5-flare'));
    assert.ok(list.includes('gpt-image-2.5-sunburst'));
  });

  it('选中 flare 才显示 1K/2K/4K 档位选择', async () => {
    await page.eval(`
      document.getElementById('imageModel').value = 'gpt-image-2.5';
      onImageModelChange();
      true;
    `);
    assert.equal(await page.eval(`document.getElementById('imageTierGroup').style.display`), 'none');

    await page.eval(`
      document.getElementById('imageModel').value = 'gpt-image-2.5-flare';
      onImageModelChange();
      true;
    `);
    assert.equal(await page.eval(`document.getElementById('imageTierGroup').style.display`), '');
    assert.equal(await page.eval(`getSelectedImageModel()`), 'gpt-image-2.5-flare');
  });

  it('保存配置后重新加载，模型与档位仍保留', async () => {
    await page.eval(`
      document.getElementById('imageModel').value = 'gpt-image-2.5-sunburst';
      onImageModelChange();
      document.getElementById('imageTier').value = '2K';
      saveAllConfigs();
      true;
    `);

    await page.open(PAGE);
    assert.equal(await page.eval(`document.getElementById('imageModel').value`), 'gpt-image-2.5-sunburst');
    assert.equal(await page.eval(`document.getElementById('imageTier').value`), '2K');
  });
});

describe('异步提交', () => {
  it('flare 有图档位时走 /v1/videos 异步，并带上 image_size', async () => {
    const resultUrl = await localResultUrl();
    await page.setResponses([
      { body: { id: 'task_img_1', status: 'queued' } },
      { body: { id: 'task_img_1', status: 'completed', url: resultUrl } }
    ]);

    await page.eval(`
      ${setupForm}
      document.getElementById('imageModel').value = 'gpt-image-2.5-flare';
      onImageModelChange();
      document.getElementById('imageTier').value = '4K';
      true;
    `);
    await page.eval('submitImageTask()');

    const requests = await page.requests();
    const create = requests.find((r) => r.method === 'POST');
    assert.ok(create, '应当发出提交请求');
    assert.equal(create.url, 'https://api.example.test/v1/videos');
    assert.deepEqual(JSON.parse(create.body), {
      model: 'gpt-image-2.5-flare',
      prompt: '一只戴墨镜的猫',
      aspect_ratio: '9:16',
      image_size: '4K'
    });

    const poll = requests.find((r) => r.method === 'GET');
    assert.ok(poll, '应当轮询任务状态');
    assert.equal(poll.url, 'https://api.example.test/v1/videos/task_img_1');
    assert.equal(
      requests.some((r) => r.url.includes('/v1/images/generations')),
      false,
      '成功路径不应回退同步接口'
    );
  });

  it('sunburst 的请求体与 flare 一致，只换模型名', async () => {
    const resultUrl = await localResultUrl();
    await page.setResponses([
      { body: { id: 'task_img_2', status: 'queued' } },
      { body: { id: 'task_img_2', status: 'completed', url: resultUrl } }
    ]);

    await page.eval(`
      ${setupForm}
      document.getElementById('imageModel').value = 'gpt-image-2.5-sunburst';
      onImageModelChange();
      document.getElementById('imageTier').value = '2K';
      true;
    `);
    await page.eval('submitImageTask()');

    const create = (await page.requests()).find((r) => r.method === 'POST');
    assert.deepEqual(JSON.parse(create.body), {
      model: 'gpt-image-2.5-sunburst',
      prompt: '一只戴墨镜的猫',
      aspect_ratio: '9:16',
      image_size: '2K'
    });
  });

  it('gpt-image-2.5 只出 1K，不带 image_size', async () => {
    const resultUrl = await localResultUrl();
    await page.setResponses([
      { body: { id: 'task_img_3', status: 'queued' } },
      { body: { id: 'task_img_3', status: 'completed', url: resultUrl } }
    ]);

    await page.eval(`
      ${setupForm}
      document.getElementById('imageModel').value = 'gpt-image-2.5';
      onImageModelChange();
      true;
    `);
    await page.eval('submitImageTask()');

    const create = (await page.requests()).find((r) => r.method === 'POST');
    assert.deepEqual(JSON.parse(create.body), {
      model: 'gpt-image-2.5',
      prompt: '一只戴墨镜的猫',
      aspect_ratio: '9:16'
    });
  });
});

describe('图片任务后台轮询', () => {
  const submitWithModel = (model = 'gpt-image-2.5') => `
    ${setupForm}
    document.getElementById('imageModel').value = ${JSON.stringify(model)};
    onImageModelChange();
    void submitImageTask();
    'submitted';
  `;

  const submitButtonState = () => page.eval(`
    (() => {
      const btn = document.getElementById('imageSubmitBtn');
      return { disabled: btn.disabled, label: btn.innerHTML.trim().replace(/\\s+/g, ' ') };
    })()
  `);

  it('提交成功后按钮立刻恢复可用，不再等到出图', async () => {
    await page.setResponses([
      { body: { id: 'task_bg_1', status: 'queued' } },
      { body: { id: 'task_bg_1', status: 'in_progress', progress: 30 } },
      { body: { id: 'task_bg_1', status: 'in_progress', progress: 60 } }
    ]);

    await page.eval(submitWithModel());

    await waitFor(async () => (await submitButtonState()).disabled === false, 3000, 50);
    const state = await submitButtonState();
    assert.equal(state.label, '🎨 生成图片', '按钮文案应恢复');

    const running = (await taskRecords()).filter((r) => r.status === 'running');
    assert.equal(running.length, 1, '任务应挂在右侧任务栏继续跑');
    assert.ok(running[0].params?.remoteTaskId, '任务记录里要保存上游任务 ID');
  });

  it('后台轮询完成后卡片变成功，并写入历史', async () => {
    const resultUrl = await localResultUrl();
    await page.setResponses([
      { body: { id: 'task_bg_2', status: 'queued' } },
      { body: { id: 'task_bg_2', status: 'in_progress', progress: 50 } },
      { body: { id: 'task_bg_2', status: 'completed', url: resultUrl } }
    ]);

    await page.eval(submitWithModel());

    const succeeded = await waitFor(async () => {
      const records = await taskRecords();
      return records.find((r) => r.status === 'succeeded');
    }, 10000);
    assert.equal(succeeded.kind, 'image_generate');
    assert.equal(succeeded.progress, 100);

    const history = await waitFor(async () => {
      const items = await historyRecords();
      return items.length ? items : null;
    }, 5000);
    assert.equal(history[0].kind, 'image_generate');
    assert.match(history[0].imageUrl, /result\.svg$/);
  });

  it('连开两张图时两个任务各自完成', async () => {
    const resultUrl = await localResultUrl();
    await page.eval(`
      window.__seq = 0;
      window.__route = (url) => {
        if (url.endsWith('/v1/videos')) {
          window.__seq += 1;
          return { ok: true, status: 200, body: { id: 'task_multi_' + window.__seq, status: 'queued' } };
        }
        if (url.includes('/v1/videos/task_multi_')) {
          return { ok: true, status: 200, body: { id: url.split('/').pop(), status: 'completed', url: ${JSON.stringify(resultUrl)} } };
        }
        return null;
      };
      true;
    `);

    await page.eval(submitWithModel());
    await page.eval(submitWithModel('gpt-image-2.5-flare'));

    const succeeded = await waitFor(async () => {
      const records = (await taskRecords()).filter((r) => r.status === 'succeeded');
      return records.length === 2 ? records : null;
    }, 12000);
    assert.equal(succeeded.length, 2);
    const models = succeeded.map((r) => r.params?.model).sort();
    assert.deepEqual(models, ['gpt-image-2.5', 'gpt-image-2.5-flare']);

    const history = await waitFor(async () => {
      const items = await historyRecords();
      return items.length === 2 ? items : null;
    }, 5000);
    assert.equal(history.length, 2);
  });

  it('刷新页面后未完成的图片任务会继续轮询并完成', async () => {
    const resultUrl = await localResultUrl();
    await page.useStubsOnNewDocument();
    await page.setResponses([
      { body: { id: 'task_resume_1', status: 'queued' } },
      { body: { id: 'task_resume_1', status: 'in_progress', progress: 20 } }
    ]);

    await page.eval(submitWithModel());
    await waitFor(async () => (await taskRecords()).some((r) => r.status === 'running'), 4000);

    // 刷新页面：任务记录还在，轮询应当续接而不是被标记为中断
    await page.open(PAGE);
    const afterReload = await waitFor(async () => {
      const records = (await taskRecords()).filter((r) => r.status === 'running');
      return records.length ? records : null;
    }, 4000);
    assert.equal(afterReload[0].params?.remoteTaskId, 'task_resume_1');

    await page.eval(`
      window.__route = (url) => {
        if (url.includes('/v1/videos/task_resume_1')) {
          return { ok: true, status: 200, body: { id: 'task_resume_1', status: 'completed', url: ${JSON.stringify(resultUrl)} } };
        }
        return null;
      };
      true;
    `);

    const done = await waitFor(async () => {
      const records = await taskRecords();
      return records.find((r) => r.status === 'succeeded');
    }, 12000);
    assert.equal(done.id, afterReload[0].id);
  });

  it('异步提交失败时回退同步接口，当场出图', async () => {
    const resultUrl = await localResultUrl();
    await page.setResponses([
      { ok: false, status: 503, body: { error: { message: '异步接口暂不可用' } } },
      { body: { data: [{ url: resultUrl }] } }
    ]);

    await page.eval(submitWithModel());

    const succeeded = await waitFor(async () => {
      const records = await taskRecords();
      return records.find((r) => r.status === 'succeeded');
    }, 6000);
    assert.equal(succeeded.kind, 'image_generate');

    const urls = (await page.requests()).map((r) => `${r.method} ${r.url}`);
    assert.deepEqual(urls, [
      'POST https://api.example.test/v1/videos',
      'POST https://api.example.test/v1/images/generations'
    ]);
    const history = await historyRecords();
    assert.equal(history.length, 1);
    assert.match(history[0].imageUrl, /result\.svg$/);
  });
});
