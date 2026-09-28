// info.js —— PDF 信息查看
window.Info = (function () {
  function fmtDate(d) {
    if (!d) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function fmtSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  async function get(inPath) {
    const result = {
      file: inPath.split('\\').pop().split('/').pop(),
      path: inPath,
      size: 0,
      sizeText: '',
      pages: 0,
      encrypted: false,
      gsVersion: '',
    };

    try {
      const stat = await Neutralino.filesystem.getStats(inPath);
      result.size = stat.size;
      result.sizeText = fmtSize(stat.size);
    } catch (e) {
      result.sizeText = '未知';
    }

    if (result.size > 50 * 1024 * 1024) {
      result.metaError = '文件 > 50MB，跳过元数据解析';
    } else {
      try {
        const b64 = await Neutralino.filesystem.readFile(inPath);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        result.pages = doc.getPageCount();
        result.title = doc.getTitle() || '';
        result.author = doc.getAuthor() || '';
        result.subject = doc.getSubject() || '';
        result.creator = doc.getCreator() || '';
        result.producer = doc.getProducer() || '';
        result.creation = fmtDate(doc.getCreationDate());
        result.modified = fmtDate(doc.getModificationDate());
        result.encrypted = doc.isEncrypted;
      } catch (e) {
        result.encrypted = /encrypt|password/i.test(e.message || '');
        result.metaError = String(e.message || e);
      }
    }

    try {
      let gsPages = 0;
      let gsVersion = '';
      const r = await GS.run(['-sDEVICE=nullpage', '-dNOPAUSE', '-dBATCH', GS.quote(inPath)], {
        onStdout: (s) => {
          const cur = GS.parsePage(s);
          if (cur && cur > gsPages) gsPages = cur;
          const vm = s.match(/GPL Ghostscript\s+([\d.]+)/);
          if (vm) gsVersion = vm[1];
        },
      });
      if (!gsVersion) {
        const vm = r.stderr.match(/GPL Ghostscript\s+([\d.]+)/);
        if (vm) gsVersion = vm[1];
      }
      if (gsPages) result.pages = gsPages;
      if (gsVersion) result.gsVersion = gsVersion;
    } catch (e) {
      result.gsError = e.raw || e.message;
      if (/encrypt|password/i.test(e.raw || '')) result.encrypted = true;
    }

    return result;
  }

  return { get, fmtDate, fmtSize };
})();
