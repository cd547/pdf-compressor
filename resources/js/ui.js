// ui.js —— UI 绑定、tab 切换、拖拽、参数面板、错误弹窗
let selectedFiles = [];

async function pickPdfPaths(multiple = true) {
  const entry = await Neutralino.os.showOpenDialog('选择 PDF', {
    multiple,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

async function pickFolder(title) {
  return await Neutralino.os.showFolderDialog(title);
}

async function pickSavePath(defaultName) {
  const entry = await Neutralino.os.showSaveDialog('保存为', defaultName || 'output.pdf');
  return entry;
}

function showError(e) {
  const m = document.getElementById('errorModal');
  document.getElementById('errorBody').textContent = e.raw || e.message || String(e);
  m.hidden = false;
}

function cycleTheme() {
  const body = document.body;
  const cur = body.dataset.theme || 'auto';
  const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
  body.dataset.theme = next;
  localStorage.setItem('pdfc_theme', next);
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'history') renderHistory();
    });
  });
}

async function bindDropzone() {
  const dz = document.getElementById('dropzone');
  dz.addEventListener('click', async () => {
    const paths = await pickPdfPaths(true);
    if (!paths.length) return;
    selectedFiles = [];
    for (const p of paths) {
      try {
        const stat = await Neutralino.filesystem.getStats(p);
        const name = p.split('\\').pop().split('/').pop();
        selectedFiles.push({ path: p, name, size: stat.size });
      } catch (e) {
        showError(e);
      }
    }
    renderFileList();
  });
}

function renderFileList() {
  const ul = document.getElementById('fileList');
  ul.innerHTML = '';
  selectedFiles.forEach((f, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${f.name}  ${Info.fmtSize(f.size)}`;
    ul.appendChild(li);
  });
}

function bindPresetButtons() {
  document.querySelectorAll('.preset-row button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.preset-row button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const p = Compress.presets[b.dataset.preset];
      document.getElementById('dpi').value = p.dpi;
      document.getElementById('dpiVal').textContent = p.dpi;
      document.getElementById('jpeg').value = p.jpeg;
      document.getElementById('jpegVal').textContent = p.jpeg;
    });
  });
}

function bindRangeSliders() {
  ['dpi', 'jpeg', 'imgDpi'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = document.getElementById(id + 'Val');
    el.addEventListener('input', () => { if (val) val.textContent = el.value; });
  });
}

function bindEncryptToggle() {
  const cb = document.getElementById('encrypt');
  cb.addEventListener('change', () => {
    document.querySelectorAll('.enc-row').forEach((el) => el.classList.toggle('show', cb.checked));
  });
}

function collectOpts() {
  return {
    preset: document.querySelector('.preset-row button.active').dataset.preset,
    dpi: +document.getElementById('dpi').value,
    jpeg: +document.getElementById('jpeg').value,
    color: document.getElementById('color').value,
    compat: document.getElementById('compat').value,
    pages: document.getElementById('pages').value.trim(),
    downsample: document.getElementById('downsample').value,
    subsetFonts: document.getElementById('subsetFonts').checked,
    noAnnot: document.getElementById('noAnnot').checked,
    noMeta: document.getElementById('noMeta').checked,
    noForm: document.getElementById('noForm').checked,
    noAttach: document.getElementById('noAttach').checked,
    linearize: document.getElementById('linearize').checked,
    encrypt: document.getElementById('encrypt').checked,
    pwdOpen: document.getElementById('pwdOpen').value,
    pwdPerms: document.getElementById('pwdPerms').value,
    perms: document.getElementById('perms').value,
  };
}

function bindCompress() {
  document.getElementById('compressBtn').addEventListener('click', async () => {
    if (!selectedFiles.length) {
      showError(new Error('请先选择 PDF'));
      return;
    }
    const outDir = await pickFolder('选择输出目录');
    if (!outDir) return;

    const opts = collectOpts();
    const results = [];
    const prog = document.getElementById('progress');
    const progTxt = document.getElementById('progressText');
    prog.value = 0; progTxt.textContent = '0%';

    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      const baseName = f.name.replace(/\.pdf$/i, '');
      const outPath = `${outDir}\\${baseName}.compressed.pdf`;
      try {
        const r = await Compress.compressOne({
          input: f.path, output: outPath, opts,
          onProgress: (cur, total) => {
            const pct = total ? Math.round((cur / total) * 100) : 0;
            prog.value = pct;
            progTxt.textContent = `${pct}% (${i + 1}/${selectedFiles.length})`;
          },
        });
        results.push({ name: f.name, ok: true, ...r });
        History.add({
          type: '压缩', input: f.path, output: outPath,
          ratio: r.ratio, ok: true,
        });
      } catch (e) {
        results.push({ name: f.name, ok: false, error: e.message });
        showError(e);
        History.add({ type: '压缩', input: f.path, ok: false, error: e.message });
      }
    }
    renderResults(results);
    History.backup();
  });
}

function renderResults(results) {
  const ul = document.getElementById('resultList');
  ul.innerHTML = '';
  results.forEach((r) => {
    const li = document.createElement('li');
    if (r.ok) {
      li.className = 'ok';
      li.textContent = `${r.name}: ${Info.fmtSize(r.before)} → ${Info.fmtSize(r.after)}  节省 ${Info.fmtSize(r.saved)} (${r.ratio}%)`;
    } else {
      li.className = 'err';
      li.textContent = `${r.name}: 失败 - ${r.error}`;
    }
    ul.appendChild(li);
  });
}

function bindMergeSplit() {
  document.getElementById('mergeBtn').addEventListener('click', async () => {
    const paths = await pickPdfPaths(true);
    if (!paths.length) return;
    const out = await pickSavePath('merged.pdf');
    if (!out) return;
    const prog = document.getElementById('msProgress');
    prog.value = 0;
    try {
      await Tools.merge(paths, out, {
        onProgress: () => { prog.value = 50; },
      });
      prog.value = 100;
      const li = document.createElement('li');
      li.className = 'ok';
      li.textContent = `合并完成: ${out}`;
      document.getElementById('msResult').appendChild(li);
      History.add({ type: '合并', output: out, ok: true });
    } catch (e) {
      showError(e);
      History.add({ type: '合并', ok: false, error: e.message });
    }
    History.backup();
  });

  document.getElementById('splitBtn').addEventListener('click', async () => {
    const paths = await pickPdfPaths(false);
    if (!paths.length) return;
    const inPath = paths[0];
    const dir = await pickFolder('选择输出目录');
    if (!dir) return;
    const prog = document.getElementById('msProgress');
    prog.value = 0;
    try {
      const r = await Tools.split(inPath, dir, {
        onProgress: (cur, total) => {
          prog.value = Math.round((cur / total) * 100);
        },
      });
      const li = document.createElement('li');
      li.className = 'ok';
      li.textContent = `拆分完成: ${r.pages} 页 → ${dir}\\page-0001.pdf 等`;
      document.getElementById('msResult').appendChild(li);
      History.add({ type: '拆分', input: inPath, pages: r.pages, ok: true });
    } catch (e) {
      showError(e);
      History.add({ type: '拆分', ok: false, error: e.message });
    }
    History.backup();
  });
}

function bindToImage() {
  document.getElementById('toImgBtn').addEventListener('click', async () => {
    const paths = await pickPdfPaths(false);
    if (!paths.length) return;
    const inPath = paths[0];
    const dir = await pickFolder('选择输出目录');
    if (!dir) return;
    const fmt = document.getElementById('imgFmt').value;
    const dpi = +document.getElementById('imgDpi').value;
    const prog = document.getElementById('imgProgress');
    prog.value = 0;
    try {
      await Tools.toImages(inPath, dir, {
        format: fmt, dpi,
        onProgress: (cur, total) => {
          if (total) prog.value = Math.round((cur / total) * 100);
        },
      });
      prog.value = 100;
      History.add({ type: '转图片', input: inPath, ok: true });
    } catch (e) {
      showError(e);
      History.add({ type: '转图片', ok: false, error: e.message });
    }
    History.backup();
  });
}

function bindImg2Pdf() {
  document.getElementById('img2pdfBtn').addEventListener('click', async () => {
    const entry = await Neutralino.os.showOpenDialog('选择图片', {
      multiple: true,
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff'] },
      ],
    });
    if (!entry) return;
    const paths = Array.isArray(entry) ? entry : [entry];
    if (!paths.length) return;
    const out = await pickSavePath('images.pdf');
    if (!out) return;
    try {
      await Tools.imagesToPdf(paths, out, {});
      History.add({ type: '图片转PDF', output: out, ok: true });
      alert('已生成: ' + out);
    } catch (e) {
      showError(e);
      History.add({ type: '图片转PDF', ok: false, error: e.message });
    }
    History.backup();
  });
}

function bindInfo() {
  document.getElementById('infoBtn').addEventListener('click', async () => {
    const paths = await pickPdfPaths(false);
    if (!paths.length) return;
    const out = document.getElementById('infoOutput');
    out.textContent = '解析中…';
    try {
      const info = await Info.get(paths[0]);
      out.textContent = JSON.stringify(info, null, 2);
      History.add({ type: '信息', input: paths[0], ok: true });
    } catch (e) {
      out.textContent = '错误: ' + (e.raw || e.message);
      showError(e);
    }
    History.backup();
  });
}

function renderHistory() {
  const list = History.load();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  list.slice().reverse().forEach((e) => {
    const tr = document.createElement('tr');
    const result = e.ok
      ? (e.ratio ? `${e.ratio}%` : 'OK')
      : `失败: ${e.error || ''}`;
    tr.innerHTML = `<td class="time">${e.time}</td>` +
      `<td>${e.type}</td>` +
      `<td title="${e.input || e.output || ''}">${(e.input || e.output || '').split('\\').pop().split('/').pop()}</td>` +
      `<td>${result}</td>`;
    tbody.appendChild(tr);
  });
}

function bindHistory() {
  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (confirm('确认清空历史记录？')) {
      History.clear();
      renderHistory();
    }
  });
}

function bindErrorModal() {
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('errorModal').hidden = true;
  });
  document.getElementById('errorModal').addEventListener('click', (e) => {
    if (e.target.id === 'errorModal') {
      document.getElementById('errorModal').hidden = true;
    }
  });
  document.getElementById('copyErr').addEventListener('click', () => {
    const text = document.getElementById('errorBody').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyErr');
      const orig = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  });
}

function bindWindowClose() {
  Neutralino.events.on('windowClose', () => {
    try { Neutralino.app.exit(); } catch (e) {}
  });
}

async function init() {
  try {
    await Neutralino.init();
  } catch (e) {
    document.getElementById('gsStatus').textContent = 'Neutralino init 失败';
    return;
  }

  GS.init();

  const savedTheme = localStorage.getItem('pdfc_theme') || 'auto';
  document.body.dataset.theme = savedTheme;

  try {
    const p = await GS.detect();
    document.getElementById('gsStatus').textContent = p ? `GS: ${p}` : 'GS 未找到，请放 gs/gswin64c.exe';
  } catch (e) {
    document.getElementById('gsStatus').textContent = 'GS 检测失败';
  }

  bindTabs();
  bindDropzone();
  bindPresetButtons();
  bindRangeSliders();
  bindEncryptToggle();
  bindCompress();
  bindMergeSplit();
  bindToImage();
  bindImg2Pdf();
  bindInfo();
  bindHistory();
  bindErrorModal();
  bindWindowClose();
  document.getElementById('themeToggle').addEventListener('click', cycleTheme);

  renderHistory();
}

document.addEventListener('DOMContentLoaded', init);
