// gs-bridge.js —— Ghostscript 调用封装
window.GS = (function () {
  let binPath = null;
  const handlers = new Map();

  // Neutralino 5.4 execCommand 在 stdout 为空的命令上会永久挂起（如 where 找不到目标时），
  // 统一加超时兜底，避免 GS.detect() 卡死导致整个 UI 无法初始化
  function execSafe(cmd, ms = 5000) {
    return Promise.race([
      Neutralino.os.execCommand(cmd),
      new Promise((_, reject) => setTimeout(() => reject(new Error('exec 超时: ' + cmd)), ms)),
    ]);
  }

  async function detect() {
    if (binPath) return binPath;

    // 1. 应用打包目录（gs/ 子目录，避开 Neutralino 自身 bin/）
    try {
      // Neutralino v5 无 os.getPath('app')（NE_OS_INVKNPT），用 NL_PATH；dev 下为相对路径时结合 NL_CWD
      let base = window.NL_PATH || '.';
      if (!/^[A-Za-z]:[\\/]/.test(base) && !base.startsWith('\\\\')) {
        base = (window.NL_CWD || '.').replace(/\//g, '\\') + '\\' + base;
      }
      const appPath = base.replace(/\//g, '\\');
      const packed = `${appPath}\\gs\\gswin64c.exe`;
      // 注意：结果字段是 stdOut/stdErr（不是 stdout/stderr）
      const r = await execSafe(`"${packed}" -v`);
      const out = (r.stdOut || '') + (r.stdErr || '');
      if (out.includes('Ghostscript')) {
        binPath = packed;
        return packed;
      }
    } catch (e) { /* 继续 */ }

    // 2. 系统 PATH
    for (const name of ['gswin64c', 'gswin32c', 'gs']) {
      try {
        const r = await execSafe(`where ${name}`);
        const line = (r.stdOut || '').split(/\r?\n/).find((x) => x.trim());
        if (line) {
          binPath = line.trim();
          return binPath;
        }
      } catch (e) {}
    }
    return null;
  }

  function parseTotal(line) {
    const m = line.match(/Processing pages\s+(\d+)\s+through\s+(\d+)/);
    return m ? parseInt(m[2], 10) : null;
  }

  function parsePage(line) {
    const matches = line.match(/Page\s+(\d+)/g) || [];
    let max = 0;
    for (const m of matches) {
      const n = parseInt(m.match(/Page\s+(\d+)/)[1], 10);
      if (n > max) max = n;
    }
    return max || null;
  }

  function run(args, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!binPath) await detect();
        if (!binPath) {
          const err = new Error('未找到 Ghostscript');
          err.raw = 'GS not found';
          throw err;
        }
        const cmd = `"${binPath}" ${args.join(' ')}`;
        // v5 spawnProcess 返回 {id, pid}；事件里的 id 即 proc.id，用它做 key 才能匹配事件
        const proc = await Neutralino.os.spawnProcess(cmd);
        const state = {
          resolve, reject,
          stdout: '', stderr: '', total: 0,
          onProgress: options.onProgress,
          onStdout: options.onStdout,
          onStderr: options.onStderr,
        };
        handlers.set(proc.id, state);
      } catch (e) {
        reject(e);
      }
    });
  }

  let registered = false;
  function ensureHandler() {
    if (registered) return;
    registered = true;
    Neutralino.events.on('spawnedProcess', (e) => {
      const d = e.detail || {};
      const state = handlers.get(d.id);
      if (!state) return;

      if (d.action === 'stdOut') {
        state.stdout += d.data || '';
        if (state.onStdout) state.onStdout(d.data || '');
        const t = parseTotal(d.data || '');
        if (t) state.total = t;
        const cur = parsePage(d.data || '');
        if (cur && state.onProgress) state.onProgress(cur, state.total || cur);
      } else if (d.action === 'stdErr') {
        state.stderr += d.data || '';
        if (state.onStderr) state.onStderr(d.data || '');
      } else if (d.action === 'exit') {
        // v5 退出码在 d.data（兼容旧字段名）
        const code = d.exitCode !== undefined ? d.exitCode : d.data;
        handlers.delete(d.id);
        if (code === 0) {
          state.resolve({ exitCode: 0, stdout: state.stdout, stderr: state.stderr });
        } else {
          const err = new Error(`gs 退出码 ${code}`);
          err.raw = state.stderr || state.stdout || '无输出';
          err.exitCode = code;
          state.reject(err);
        }
      }
    });
  }

  function init() { ensureHandler(); }

  function quote(p) {
    if (p.startsWith('"') && p.endsWith('"')) return p;
    return `"${p}"`;
  }

  return { detect, run, init, quote, parsePage, parseTotal };
})();
