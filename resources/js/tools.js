// tools.js —— 合并/拆分/转图片/图片转 PDF
window.Tools = (function () {
  async function merge(files, output, options = {}) {
    const args = [
      '-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH',
      '-dCompatibilityLevel=1.6', '-dPDFSETTINGS=/prepress',
      '-dAutoRotatePages=/PageByPage',
      `-sOutputFile=${GS.quote(output)}`,
    ];
    files.forEach((f) => args.push(GS.quote(f)));
    await GS.run(args, {
      onStdout: () => options.onProgress && options.onProgress('indeterminate'),
    });
    return { success: true, output };
  }

  async function split(input, outputDir, options = {}) {
    let total = 0;
    await GS.run(['-sDEVICE=nullpage', '-dNOPAUSE', '-dBATCH', GS.quote(input)], {
      onStdout: (s) => {
        const cur = GS.parsePage(s);
        if (cur && cur > total) total = cur;
      },
    });
    if (!total) {
      const err = new Error('无法获取页数');
      err.raw = '解析页数失败';
      throw err;
    }

    const results = [];
    for (let i = 1; i <= total; i++) {
      const out = `${outputDir}\\page-${String(i).padStart(4, '0')}.pdf`;
      const args = [
        '-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH',
        `-dFirstPage=${i}`, `-dLastPage=${i}`,
        '-dAutoRotatePages=/PageByPage',
        `-sOutputFile=${GS.quote(out)}`, GS.quote(input),
      ];
      await GS.run(args, {});
      options.onProgress && options.onProgress(i, total);
      results.push(out);
    }
    return { success: true, pages: total, files: results };
  }

  async function toImages(input, outputDir, options = {}) {
    const format = options.format || 'png';
    const dpi = options.dpi || 150;
    const device = format === 'jpeg' ? 'jpeg' : 'png16m';
    const args = [
      `-sDEVICE=${device}`, '-dNOPAUSE', '-dBATCH',
      `-r${dpi}`,
      `-sOutputFile=${GS.quote(`${outputDir}\\page-%03d.${format}`)}`,
      GS.quote(input),
    ];
    await GS.run(args, {
      onProgress: options.onProgress,
      onStdout: (s) => {
        const cur = GS.parsePage(s);
        if (cur && options.onProgress) options.onProgress(cur, 0);
      },
    });
    return { success: true };
  }

  async function imagesToPdf(images, output, options = {}) {
    const args = [
      '-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH',
      '-dCompatibilityLevel=1.4',
      '-dAutoRotatePages=/PageByPage',
      `-sOutputFile=${GS.quote(output)}`,
    ];
    images.forEach((f) => args.push(GS.quote(f)));
    await GS.run(args, {
      onStdout: () => options.onProgress && options.onProgress('indeterminate'),
    });
    return { success: true, output };
  }

  return { merge, split, toImages, imagesToPdf };
})();
