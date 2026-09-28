// 复制 pdf-lib UMD bundle 到本地 vendor 目录，避免运行时 CDN 调用
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js');
const destDir = path.join(__dirname, '..', 'js', 'vendor');
const dest = path.join(destDir, 'pdf-lib.min.js');

if (!fs.existsSync(src)) {
  console.error('[copy-vendor] 源文件不存在，请先运行 npm install：', src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-vendor] 已复制 pdf-lib.min.js →', dest);
