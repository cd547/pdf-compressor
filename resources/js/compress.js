// compress.js —— PDF 压缩逻辑
window.Compress = (function () {
  const presets = {
    screen:   { pdfSettings: '/screen',   dpi: 72,  jpeg: 60 },
    ebook:    { pdfSettings: '/ebook',    dpi: 150, jpeg: 80 },
    printer:  { pdfSettings: '/printer',  dpi: 300, jpeg: 90 },
    prepress: { pdfSettings: '/prepress', dpi: 300, jpeg: 100 },
  };

  function parsePageRange(str) {
    if (!str) return null;
    str = str.trim();
    if (!str) return null;
    if (str.includes(',')) return 'multi';
    const m = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return { first: +m[1], last: +m[2] };
    const single = str.match(/^(\d+)$/);
    if (single) return { first: +single[1], last: +single[1] };
    return null;
  }

  function buildArgs(opts) {
    const p = presets[opts.preset] || presets.ebook;
    const args = [
      '-sDEVICE=pdfwrite',
      `-dCompatibilityLevel=${opts.compat || '1.4'}`,
      `-dPDFSETTINGS=${p.pdfSettings}`,
      '-dNOPAUSE', '-dBATCH',
      '-dAutoRotatePages=/PageByPage',
      `-dColorImageResolution=${opts.dpi || p.dpi}`,
      `-dJPEGQuality=${opts.jpeg || p.jpeg}`,
    ];

    if (opts.color === 'gray') {
      args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray');
    } else if (opts.color === 'mono') {
      args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray',
        '-dMonoImageDownsampleType=/Bicubic');
    }

    if (opts.downsample && opts.downsample !== 'none') {
      const type = opts.downsample === 'bicubic' ? '/Bicubic' : '/Bilinear';
      args.push(
        '-dDownsampleColorImages=true', `-dColorImageDownsampleType=${type}`,
        '-dDownsampleGrayImages=true', `-dGrayImageDownsampleType=${type}`,
        '-dDownsampleMonoImages=true', `-dMonoImageDownsampleType=${type}`
      );
    }

    if (opts.subsetFonts) args.push('-dSubsetFonts=true');
    if (opts.noAnnot) args.push('-dPreserveAnnots=false');
    if (opts.noMeta) args.push('-c', '(%stdout) (w) file pop', '-f');
    if (opts.noForm) args.push('-dPreserveAcroForm=false');
    if (opts.noAttach) args.push('-dPreserveMarkedContent=false');
    if (opts.linearize) args.push('-dLinearize=true');

    if (opts.range && opts.range !== 'multi' && opts.range !== null) {
      args.push(`-dFirstPage=${opts.range.first}`, `-dLastPage=${opts.range.last}`);
    }

    if (opts.encrypt) {
      args.push(
        '-dEncryptionR=6',
        `-sOwnerPassword=${opts.pwdPerms || ''}`,
        `-sUserPassword=${opts.pwdOpen || ''}`,
        `-dPermissions=${opts.perms || 0}`
      );
    }

    args.push(`-sOutputFile=${GS.quote(opts.output)}`, GS.quote(opts.input));
    return args;
  }

  async function mergeParts(parts, output) {
    const out = await PDFLib.PDFDocument.create();
    for (const p of parts) {
      try {
        const b64 = await Neutralino.filesystem.readFile(p);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(doc, doc.getPageIndices());
        pages.forEach((pg) => out.addPage(pg));
      } catch (e) { continue; }
    }
    const outBytes = await out.save();
    const b64 = btoa(String.fromCharCode(...outBytes));
    await Neutralino.filesystem.writeFile(output, b64);
  }

  async function compressOne({ input, output, opts, onProgress }) {
    const range = parsePageRange(opts.pages);
    let finalOutput = output;

    if (range === 'multi') {
      const ranges = opts.pages.split(',').map((s) => s.trim()).filter(Boolean);
      const parts = [];
      for (let i = 0; i < ranges.length; i++) {
        const r = parsePageRange(ranges[i]);
        if (!r || r === 'multi') continue;
        const partOut = `${output}.part${i}.pdf`;
        const args = buildArgs({ ...opts, range: r, output: partOut, input });
        await GS.run(args, {
          onProgress: (c, t) => onProgress && onProgress(c, t, i),
        });
        parts.push(partOut);
      }
      await mergeParts(parts, output);
      for (const p of parts) {
        try { await Neutralino.filesystem.remove(p); } catch (e) {}
      }
    } else {
      const args = buildArgs({ ...opts, range, input, output });
      await GS.run(args, { onProgress });
    }

    const before = (await Neutralino.filesystem.getStats(input)).size;
    const after = (await Neutralino.filesystem.getStats(finalOutput)).size;
    return {
      success: true,
      before, after,
      saved: before - after,
      ratio: before > 0 ? ((after / before) * 100).toFixed(1) : 0,
    };
  }

  return { presets, parsePageRange, buildArgs, compressOne, mergeParts };
})();
