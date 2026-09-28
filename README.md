# PDF 压缩工具

基于 NeutralinoJS + Ghostscript 的桌面 PDF 工具箱。

## 功能

- **压缩**：4 档预设（极致/标准/高质量/无损）+ 自定义 DPI/JPEG 质量/颜色/兼容版本/页面范围/子集化字体/移除注释元数据/线性化/加密
- **合并/拆分**：多 PDF 合并、单 PDF 拆分单页
- **转图片**：PDF 转 PNG/JPEG
- **图片转 PDF**：扫描件拼合
- **信息查看**：页数/版本/加密状态/元数据/大小
- **历史记录**：localStorage 最近 20 条，24 小时制时间戳

## 环境准备

### 1. 安装 Neutralino CLI

```powershell
npm install -g @neutralinojs/neu
```

### 2. 安装项目依赖

```powershell
cd d:\pdf-compressor
npm install
```

### 3. 拉取 Neutralino client/binary

```powershell
neu update
```

### 4. 复制 pdf-lib 到本地 vendor（不走 CDN）

```powershell
node scripts/copy-vendor.js
```

### 5. 下载并放置 Ghostscript 二进制

从 https://ghostscript.com/releases/gsdnld.html 下载 `gs10000w64.exe` 安装，然后从安装目录（通常 `C:\Program Files\gs\gs10.x\`）复制以下文件到本项目 `gs\` 子目录（**注意：不是 bin/，bin/ 被 Neutralino 自身 binaries 占用**）：

```
gs\
├── gswin64c.exe       # 必需（console 版，不是 w 版）
├── gsdll64.dll        # 必需
└── Resource\          # 必需（整目录：字体 + 初始化文件 + CID 映射）
```

**注意**：必须用 `gswin64c.exe`（c = console），不要用 `gswin64w.exe`（w 版会弹独立 GUI 窗口，无法捕获 stdout）。

## 运行

```powershell
neu run
```

## 打包

```powershell
neu build --release
# 输出在 build\pdf-compressor-win_x64\
# 确认 bin\gswin64c.exe 和 bin\Resource\ 在输出目录
```

打包后必须把 `build\pdf-compressor-win_x64\` 复制到没装 Ghostscript 的机器验证，确认走打包的 gs 而非系统 PATH。

## 协议

本软件基于 Ghostscript (AGPL v3) 构建。详见 [LICENSE-NOTICE.txt](LICENSE-NOTICE.txt)。

商业分发需购买 Artifex 商业许可。
