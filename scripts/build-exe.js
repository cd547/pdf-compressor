// build-exe.js —— 一键打包 Windows exe：neu build --release + 随包分发 gs/
// 产物：dist/pdf-compressor/pdf-compressor-win_x64.exe（双击即用）
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distApp = path.join(root, 'dist', 'pdf-compressor');

// 1. 标准构建（binaries + resources.neu）
execSync('neu build --release', { cwd: root, stdio: 'inherit' });

// 2. gs-bridge.js 运行时按 <exe目录>\gs\gswin64c.exe 优先查找，gs/ 必须随包分发
const gsDest = path.join(distApp, 'gs');
fs.rmSync(gsDest, { recursive: true, force: true });
fs.cpSync(path.join(root, 'gs'), gsDest, { recursive: true });

// 3. Ghostscript AGPL 许可声明随包分发
fs.copyFileSync(path.join(root, 'LICENSE-NOTICE.txt'), path.join(distApp, 'LICENSE-NOTICE.txt'));

// 4. 去掉 Windows 控制台黑窗口：PE 头 subsystem 由 CONSOLE(3) 改为 GUI(2)
const exePath = path.join(distApp, 'pdf-compressor-win_x64.exe');
patchGuiSubsystem(exePath);

function patchGuiSubsystem(exePath) {
  const buf = fs.readFileSync(exePath);
  const peOff = buf.readUInt32LE(0x3c);            // DOS 头中的 PE 偏移
  const subOff = peOff + 0x5c;                     // PE 可选头 subsystem 字段
  if (buf.readUInt16LE(subOff) === 3) {            // IMAGE_SUBSYSTEM_CONSOLE
    buf.writeUInt16LE(2, subOff);                  // IMAGE_SUBSYSTEM_WINDOWS_GUI
    fs.writeFileSync(exePath, buf);
  }
}

console.log('[build] 完成: ' + distApp);
console.log('[build] 双击 pdf-compressor-win_x64.exe 即可运行');
