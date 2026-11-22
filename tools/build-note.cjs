'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MarkdownIt = require('markdown-it');
const texmath = require('markdown-it-texmath');
const cheerio = require('cheerio');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || '');
const subject = process.argv[3];
if (!['os', 'network', 'architecture', 'ds', 'math', 'linear'].includes(subject)) {
  throw new Error('缺少有效科目参数');
}
const subjectMeta = {
  os: {
    filePrefix: 'chapter',
    storagePrefix: 'os-reader-v1-ch',
    subjectName: '操作系统 · 408',
    ruleSub: 'OPERATING SYSTEMS',
    searchPlaceholder: '输入关键词，如进程、死锁、页表',
    unit: '章',
    stripTitle: t => t.replace(/^第\s*\d+\s*章\s*/, '')
  },
  network: {
    filePrefix: 'network',
    storagePrefix: 'notes-network-ch',
    subjectName: '计算机网络 · 408',
    ruleSub: 'COMPUTER NETWORKS',
    searchPlaceholder: '输入关键词，如TCP、路由、滑动窗口',
    unit: '章',
    stripTitle: t => t.replace(/^第\s*\d+\s*章\s*/, '')
  },
  architecture: {
    filePrefix: 'architecture',
    storagePrefix: 'notes-architecture-ch',
    subjectName: '计算机组成原理 · 408',
    ruleSub: 'COMPUTER ORGANIZATION',
    searchPlaceholder: '输入关键词，如Cache、流水线、中断',
    unit: '章',
    stripTitle: t => t.replace(/^第\s*\d+\s*章\s*/, '').replace(/知识点整理$/, '')
  },
  ds: {
    filePrefix: 'ds',
    storagePrefix: 'notes-ds-ch',
    subjectName: '数据结构 · 408',
    ruleSub: 'DATA STRUCTURES',
    searchPlaceholder: '输入关键词，如二叉树、图、KMP、排序',
    unit: '章',
    stripTitle: t => t.replace(/^第\s*\d+\s*章\s*/, '')
  },
  math: {
    filePrefix: 'math',
    storagePrefix: 'notes-math-ch',
    subjectName: '高等数学 · 强化',
    ruleSub: 'MATHEMATICS',
    searchPlaceholder: '输入关键词，如极限、积分',
    unit: '讲',
    stripTitle: t => t.replace(/^第\s*\d+\s*讲\s*/, '')
  },
  linear: {
    filePrefix: 'linear',
    storagePrefix: 'notes-linear-ch',
    subjectName: '线性代数 · 强化',
    ruleSub: 'LINEAR ALGEBRA',
    searchPlaceholder: '输入关键词，如矩阵、特征值、二次型',
    unit: '讲',
    stripTitle: t => t.replace(/^(?:线性代数)?第\s*\d+(?:\s*[～—\-]\s*\d+)?\s*讲[\s｜|]*/, '')
  }
}[subject];

const linearMeta = {
  '线性代数第1～2讲｜二轮强化复盘.md': { number: 1, kicker: '第 1～2 讲', label: '第1～2讲', shortTitle: '行列式与余子式｜二轮强化复盘' },
  '第3—4讲 矩阵运算与矩阵的秩｜二轮强化复盘.md': { number: 2, kicker: '第 3—4 讲', label: '第3—4讲' },
  '第5—6讲_线性方程组与向量组｜二轮强化复盘.md': { number: 3, kicker: '第 5—6 讲', label: '第5—6讲' },
  '第7—8讲 特征值与相似理论｜二轮强化复盘合集.md': { number: 4, kicker: '第 7—8 讲', label: '第7—8讲' },
  '第9讲 二次型｜二轮强化复盘（定稿）.md': { number: 5, kicker: '第 9 讲', label: '第9讲' }
};

const subjectCrossUrls = {
  os: {
    '00_408操作系统｜考前急救与真题落点总控': 'chapter-0.html',
    '第1章 计算机系统概述': 'chapter-1.html',
    '第2章 进程与线程': 'chapter-2.html',
    '第3章 内存管理': 'chapter-3.html',
    '第4章 文件管理': 'chapter-4.html',
    '第5章 输入_输出管理': 'chapter-5.html'
  },
  network: {
    '00_408计网｜考前急救与真题落点总控': 'network-0.html',
    '第1章 计算机网络体系结构': 'network-1.html',
    '第2章 物理层': 'network-2.html',
    '第3章 数据链路层': 'network-3.html',
    '第4章 网络层': 'network-4.html',
    '第5章 传输层': 'network-5.html',
    '第6章 应用层': 'network-6.html'
  },
  architecture: {
    '00_408计组｜考前急救与真题落点总控': 'architecture-0.html',
    '第1章 计算机系统概述': 'architecture-1.html',
    '第2章 数据的表示和运算': 'architecture-2.html',
    '第3章 存储系统': 'architecture-3.html',
    '第4章 指令系统': 'architecture-4.html',
    '第5章 中央处理器': 'architecture-5.html',
    '第6章 总线': 'architecture-6.html',
    '第7章 输入输出系统': 'architecture-7.html'
  },
  ds: {
    '00_408数据结构｜考前急救与真题落点总控': 'ds-0.html',
    '第1章 绪论': 'ds-1.html',
    '第2章 线性表': 'ds-2.html',
    '第3章 栈、队列和数组': 'ds-3.html',
    '第4章 串': 'ds-4.html',
    '第5章 树与二叉树': 'ds-5.html',
    '第6章 图': 'ds-6.html',
    '第7章 查找': 'ds-7.html',
    '第8章 排序': 'ds-8.html'
  },
  math: {
    '00_考研数二高数｜考前急救红线与真题落点总控': 'math-0.html',
    '第1讲 函数极限与连续': 'math-1.html',
    '第2讲 数列极限': 'math-2.html',
    '第3讲 一元函数微分学的概念': 'math-3.html',
    '第4讲 一元函数微分学的计算': 'math-4.html',
    '第5讲 一元函数微分学的应用（一）——几何应用': 'math-5.html',
    '第6讲 一元函数微分学的应用（二）——中值定理、微分等式与微分不等式': 'math-6.html',
    '第7讲 一元函数微分学的应用（三）——物理应用与相关变化率': 'math-7.html',
    '第8讲 一元函数积分学的概念与性质': 'math-8.html',
    '第9讲 一元函数积分学的计算｜二轮强化复盘': 'math-9.html',
    '第10讲 一元函数积分学的应用（一）——几何应用｜二轮强化复盘': 'math-10.html',
    '第11讲 一元函数积分学的应用（二）——积分等式与积分不等式': 'math-11.html',
    '第12讲 物理应用': 'math-12.html',
    '第13讲 多元函数微分学｜二轮强化复盘': 'math-13.html',
    '第14讲 二重积分｜二轮强化复盘': 'math-14.html',
    '第15讲 微分方程｜二轮强化复盘': 'math-15.html'
  },
  linear: {
    '00_考研数二线代｜考前急救红线与真题落点总控': 'linear-0.html',
    '线性代数第1～2讲｜二轮强化复盘': 'linear-1.html',
    '第3—4讲 矩阵运算与矩阵的秩｜二轮强化复盘': 'linear-2.html',
    '第5—6讲_线性方程组与向量组｜二轮强化复盘': 'linear-3.html',
    '第7—8讲 特征值与相似理论｜二轮强化复盘合集': 'linear-4.html',
    '第9讲 二次型｜二轮强化复盘（定稿）': 'linear-5.html'
  }
};
const globalCrossUrls = {};
for (const map of Object.values(subjectCrossUrls)) {
  for (const [name, url] of Object.entries(map)) {
    if (name === '第1章 计算机系统概述') continue;
    globalCrossUrls[name] = url;
  }
}

const baseName = path.basename(source);
const fileMeta = /^00_/.test(baseName)
  ? { number: 0, kicker: '总控 00', label: '00 · 考前总控' }
  : (subject === 'linear' ? linearMeta[baseName] : null);
const argChapter = process.argv[4] !== undefined && process.argv[4] !== '' ? Number(process.argv[4]) : null;
const regexChapter = (baseName.match(/^第(\d+)[讲章]/) || [])[1];
const chapterNumber = Number.isInteger(argChapter) ? argChapter : (fileMeta ? fileMeta.number : (regexChapter !== undefined ? Number(regexChapter) : null));
if (!Number.isInteger(chapterNumber) || chapterNumber < 0) throw new Error('无法识别章节');

const subjectName = subjectMeta.subjectName;
const vaultRoot = subject === 'linear' ? path.dirname(source) : path.resolve(path.dirname(source), '..');
const distDir = path.join(root, 'dist');
const reportDir = path.join(distDir, '.build-reports');
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
const output = path.join(distDir, `${subjectMeta.filePrefix}-${chapterNumber}.html`);
const original = fs.readFileSync(source, 'utf8');
const hash = crypto.createHash('sha256').update(original).digest('hex');
const wikiLinks = [];

function findAttachment(name) {
  for (const candidate of [path.resolve(path.dirname(source), name), path.resolve(vaultRoot, name)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  const matches = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase() === path.basename(name).toLowerCase()) matches.push(full);
    }
  }
  walk(vaultRoot);
  if (matches.length !== 1) throw new Error(`图片无法唯一定位: ${name}; 找到 ${matches.length} 个`);
  return matches[0];
}

const content = original
  .replace('端点 =0, 1$', '端点 $x=0, 1$')
  .replace(/^\uFEFF/, '')
  .replace(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '')
  .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const relative = path.relative(path.dirname(source), findAttachment(target)).split(path.sep).join('/');
    const alt = label && !/^\d+(?:x\d+)?$/.test(label) ? label : path.basename(target);
    return `![${alt.replace(/[\[\]]/g, '')}](<${relative}>)`;
  })
  .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    if (!target.startsWith('#')) {
      const [pageName] = target.split('#');
      const k = pageName.trim();
      const mapped = (subjectCrossUrls[subject] && subjectCrossUrls[subject][k]) || globalCrossUrls[k];
      if (mapped) return `[${label || target}](${mapped})`;
      return label || target;
    }
    const id = wikiLinks.push(target.slice(1)) - 1;
    return `[${label || target.slice(1)}](#wikilink-${id})`;
  });

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const svg = new SVG({ fontCache: 'local' });
const mathDoc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: svg });
const mathErrors = [];
const equations = [];
texmath.katex = null;

const md = new MarkdownIt({ html: true, linkify: false, typographer: false })
  .use(require('markdown-it-task-lists'), { enabled: true, label: true })
  .use(require('markdown-it-footnote'))
  .use(require('markdown-it-cjk-friendly').default)
  .use(texmath, {
    delimiters: 'dollars',
    engine: {
      renderToString(tex, options) {
        tex = tex.replace('\\frac{1}{x\\mathrm{d}u', '\\frac{1}{x}\\mathrm{d}u');
        equations.push({ tex, display: options.displayMode });
        const node = mathDoc.convert(
          tex.replace(/\\text\{([^{}]*)\}/g, (_, text) => '\\text{' + text.replace(/(?<!\\)_/g, '\\_') + '}'),
          { display: options.displayMode, em: 18, ex: 9, containerWidth: 42 * 18 }
        );
        const rendered = adaptor.outerHTML(node);
        if (/data-mjx-error|<merror/.test(rendered)) mathErrors.push(tex);
        const tag = options.displayMode ? 'div' : 'span';
        return `<${tag} class="math ${options.displayMode ? 'math-display' : 'math-inline'}" role="math" aria-label="${escape(tex)}" data-tex="${escape(tex)}">${rendered}</${tag}>`;
      }
    }
  });

md.renderer.rules.math_inline = (tokens, i) => texmath.render(tokens[i].content, false, {});
md.renderer.rules.math_inline_double = (tokens, i) => texmath.render(tokens[i].content, true, {});
md.renderer.rules.math_block = (tokens, i) => texmath.render(tokens[i].content, true, {});
md.renderer.rules.math_block_eqno = (tokens, i) => texmath.render(tokens[i].content, true, {});

const tokens = md.parse(content, {});
const $ = cheerio.load(`<article id="article" class="article">${md.renderer.render(tokens, md.options, {})}</article>`, { decodeEntities: false });
const article = $('#article');
const originalHeading = article.find('h1').first();
const title = originalHeading.text();
const shortTitle = (fileMeta && fileMeta.shortTitle) || (chapterNumber === 0 ? title.replace(/^(?:00｜[^·]+·|408\s*[^｜]+｜)/, '').trim() : subjectMeta.stripTitle(title));
originalHeading.remove();

const bodyCheck = article.clone();
bodyCheck.find('blockquote').each((_, node) => {
  const first = $(node).children('p').first();
  const h = first.html() || '';
  const m = h.match(/^\[!([a-z]+)\]([+-]?)[ \t]*/i);
  if (m) first.html(h.slice(m[0].length));
});
const bodyBefore = bodyCheck.text().replace(/\s/g, '');

const calloutLabels = { abstract: '思考模型', tip: '提示', important: '核心考点', warning: '易错提醒', danger: '重点提醒', example: '例题', question: '问题', todo: '练习补充', note: '笔记' };
article.find('blockquote').get().reverse().forEach(node => {
  const block = $(node);
  const first = block.children('p').first();
  const match = (first.html() || '').match(/^\[!([a-z]+)\]([+-]?)[ \t]*([^\n]*)(?:\n|$)/i);
  if (!match) return;
  const [, type, fold, heading] = match;
  const remaining = first.html().slice(match[0].length);
  if (remaining.trim()) first.html(remaining); else first.remove();
  const isModel = type === 'abstract';
  const open = fold === '+' || (fold !== '-' && !isModel);
  block.replaceWith(`<details class="callout callout-${escape(type)}"${open ? ' open' : ''}><summary><span class="callout-label">${escape(calloutLabels[type] || '笔记')}</span><span class="callout-title">${heading}</span><span class="chevron" aria-hidden="true"></span></summary><div class="callout-body">${block.html()}</div></details>`);
});

function dimensions(bytes, ext) {
  if (ext === '.png') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (ext === '.jpg' || ext === '.jpeg') {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 255) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker === 216 || marker === 217) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      offset += 2 + length;
    }
  }
  throw new Error(`无法识别图片尺寸：${ext}`);
}

const images = [];
article.find('img').each((i, node) => {
  const image = $(node);
  const relative = decodeURIComponent(image.attr('src'));
  if (/^(?:https?:|data:)/i.test(relative)) throw new Error(`需先处理远程图片：${relative}`);
  const candidatePath = path.resolve(path.dirname(source), relative);
  const imagePath = fs.existsSync(candidatePath) ? candidatePath : findAttachment(relative);
  const bytes = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const size = dimensions(bytes, ext);
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  image.attr({ src: `data:${mime};base64,${bytes.toString('base64')}`, width: size.width, height: size.height, loading: 'lazy', decoding: 'async' });
  image.attr('data-image-index', i);
  images.push({ path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), ...size });
});
article.find('p').each((_, node) => {
  const p = $(node);
  if (p.find('img').length && !p.clone().find('img').remove().end().text().trim()) p.replaceWith(p.html());
});
article.find('img').each((i, node) => {
  const image = $(node);
  const alt = image.attr('alt') || `本章插图 ${i + 1}`;
  image.wrap(`<figure class="note-figure"></figure>`);
  image.wrap(`<button type="button" class="image-button" aria-label="放大图片：${escape(alt)}"></button>`);
  image.parent().after(`<figcaption><span>${escape(alt)}</span><span class="image-hint">点击放大 ↗</span></figcaption>`);
});
article.find('table').each((i, node) => {
  const table = $(node);
  const cols = table.find('thead th').length;
  table.attr('data-columns', cols);
  table.wrap(`<div class="table-scroll" role="region" tabindex="0" aria-label="表格 ${i + 1}，可左右滑动"></div>`);
  table.parent().wrap('<div class="table-block"></div>');
  table.parent().before('<div class="table-hint" aria-hidden="true">对照表 <span>左右滑动查看 ↔</span></div>');
});
article.find('input[type="checkbox"]').each((i, node) => $(node).attr({ 'data-check': i, 'aria-label': $(node).closest('li').text().trim() }));
article.find('p,li,figure,.table-block,.callout').each((i, node) => $(node).attr('id', `reading-block-${i + 1}`));

function headingText(heading) {
  const clone = heading.clone();
  clone.find('.math').each((_, el) => {
    const tex = $(el).attr('data-tex') || '';
    $(el).replaceWith(tex ? ` ${tex.trim()} ` : '');
  });
  return clone.text().replace(/\s+/g, ' ').trim();
}
const headings = [];
article.find('h1,h2,h3,h4').each((i, node) => {
  const heading = $(node);
  const level = Number(node.tagName.slice(1));
  const id = `section-${i + 1}`;
  heading.attr('id', id);
  if (level === 1) heading.addClass('chapter-section');
  headings.push({ id, level, text: headingText(heading) });
});
const unresolvedLinks = [];
const normalizeHeading = value => value.replace(/\s+/g, '').replace(/[\\`*_]/g, '').toLowerCase();
article.find('a[href^="#wikilink-"]').each((_, node) => {
  const a = $(node), targetText = wikiLinks[Number(a.attr('href').slice('#wikilink-'.length))];
  const matched = headings.find(h => normalizeHeading(h.text) === normalizeHeading(targetText));
  if (matched) a.attr('href', '#' + matched.id);
  else { unresolvedLinks.push(targetText); a.replaceWith(a.html()); }
});
const tocGroups = [{ label: '阅读准备', items: [] }];
for (const h of headings.filter(h => h.level <= 3)) {
  if (h.level === 1) tocGroups.push({ label: h.text, id: h.id, items: [] });
  else tocGroups.at(-1).items.push(h);
}
const toc = tocGroups.filter(group => group.id || group.items.length).map(group => `<div class="toc-group">${group.id ? `<a class="toc-major" href="#${group.id}">${escape(group.label)}</a>` : `<span class="toc-label">${escape(group.label)}</span>`}${group.items.map(h => `<a class="${h.level === 3 ? 'toc-sub' : 'toc-minor'}" href="#${h.id}">${escape(h.text)}</a>`).join('')}</div>`).join('');

const svgIcons = {
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z"/><path d="M13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3"/>',
  menu: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
  text: '<path d="M3 18 9 4l6 14M5 13h8M16 9h6M19 9v9"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M6 12h12m-5-5 5 5-5 5"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>'
};
const icon = name => `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgIcons[name]}</svg>`;
const closeButton = `<button class="icon-button close-dialog" type="button" aria-label="关闭">${icon('close')}</button>`;
const tableCount = article.find('table').length;
const wordCount = article.text().replace(/\s/g, '').length;
const contentCheck = article.clone();
contentCheck.find('.callout-label,.chevron,figcaption,.table-hint').remove();
const bodyAfter = contentCheck.text().replace(/\s/g, '');
if (bodyBefore !== bodyAfter) {
  let offset = 0; while (offset < bodyBefore.length && bodyBefore[offset] === bodyAfter[offset]) offset++;
  throw new Error(`呈现转换改变了正文文本：${JSON.stringify({before:bodyBefore.slice(offset,offset+100),after:bodyAfter.slice(offset,offset+100)})}`);
}
const unrendered = contentCheck.clone(); unrendered.find('code,pre').remove();
if (unrendered.text().includes('**')) { const t = unrendered.text(); const i = t.indexOf('**'); throw new Error(`未转换的加粗：${t.slice(i-80,i+120)}`); }

const css = fs.readFileSync(path.join(__dirname, 'reader.css'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'highlights.css'), 'utf8') + '\n.callout-danger{border-left-color:var(--note-priority)}.callout-danger .callout-label,.callout-danger strong{color:var(--note-priority)}';
const chapterChars = ['','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五'];
const chapterKicker = (fileMeta && fileMeta.kicker) || `第 ${chapterChars[chapterNumber]} ${subjectMeta.unit}`;
const chapterLabel = (fileMeta && fileMeta.label) || `第${chapterNumber}${subjectMeta.unit}`;
const js = fs.readFileSync(path.join(__dirname, 'reader.js'), 'utf8')
  .replace("const key = 'os-reader-v1-ch' + document.body.dataset.chapter;", () => `const key = '${subjectMeta.storagePrefix}' + document.body.dataset.chapter;`);

const notesJsonPath = path.join(distDir, 'study', 'notes.json');
const notesCatalog = fs.existsSync(notesJsonPath) ? JSON.parse(fs.readFileSync(notesJsonPath, 'utf8')) : [];
const subjectChapters = notesCatalog.find(s => s.key === subject)?.chapters || [];
const currentIndex = subjectChapters.findIndex(c => c.number === chapterNumber);
const prevChapter = currentIndex > 0 ? subjectChapters[currentIndex - 1] : null;
const nextChapter = currentIndex >= 0 && currentIndex < subjectChapters.length - 1 ? subjectChapters[currentIndex + 1] : null;
const chapterNav = (prevChapter || nextChapter)
  ? `<nav class="chapter-nav" aria-label="章节切换">${prevChapter ? `<a class="prev-link" href="${escape(prevChapter.url)}"><small>← 上一篇</small><strong>${escape(prevChapter.title)}</strong></a>` : ''}${nextChapter ? `<a class="next-link" href="${escape(nextChapter.url)}"><small>下一篇 →</small><strong>${escape(nextChapter.title)}</strong></a>` : ''}</nav>`
  : '';
const mathCss = adaptor.textContent(svg.styleSheet(mathDoc));
const mathLicense = fs.readFileSync(require.resolve('mathjax-full/LICENSE'), 'utf8');
const moduleCount = headings.filter(h => h.level === 2).length;
const topicCount = headings.filter(h => h.level === 3).length;
const selfTest = headings.find(h => h.text.includes('自测清单'));

const html = `<!doctype html>
<!-- Formula SVG output generated with MathJax 3.2.2. License notice:\n${mathLicense.replace(/-->/g, '-- >')}\n-->
<html lang="zh-CN" data-theme="paper"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f5f3ed"><meta name="color-scheme" content="light dark">
<meta name="description" content="${escape(title)}，手机阅读版。">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'">
<title>${escape(title)} · 手机阅读</title>
<script src="study/theme-boot.js?v=1"></script>
<style>${mathCss}\n${css}</style>
</head><body data-chapter="${chapterNumber}" data-chapter-label="${escape(chapterLabel)}">
<a class="skip-link" href="#main">跳到正文</a>
<header class="topbar"><a class="brand" href="notes.html" aria-label="返回笔记书架">${icon('book')}<span>复习手册</span></a><div class="current-location"><span id="current-section">${escape(chapterLabel)} · ${escape(shortTitle)}</span></div><div class="progress-label"><span id="read-percent">0</span><small>%</small></div><div class="progress-track"><div id="progress-fill"></div></div></header>
<div class="layout" id="top">
<aside class="sidebar" aria-label="章节导航"><div class="sidebar-heading"><span>本章目录</span><small>CONTENTS</small></div><nav class="toc">${toc}</nav><div class="sidebar-footer">${subjectName} <span>／</span> ${escape(chapterKicker)}</div></aside>
<main id="main">
<section class="hero" aria-labelledby="page-title"><div class="hero-overline"><span class="subject-dot"></span>${subjectName}<span class="overline-separator">／</span>章节复盘</div><div class="hero-heading"><div><p class="chapter-kicker">${escape(chapterKicker)}</p><h1 id="page-title">${escape(shortTitle)}</h1></div><span class="chapter-numeral" aria-hidden="true">${String(chapterNumber).padStart(2,'0')}</span></div><div class="hero-meta"><span>${topicCount ? `${moduleCount} 个模块 · ${topicCount} 个专题` : `${moduleCount} 个知识模块`}</span>${images.length ? `<i></i><span>${images.length} 幅插图</span>` : ''}<i></i><span>${tableCount} 张对照表</span></div><div class="hero-rule"><span>CHAPTER NOTES</span><span>${subjectMeta.ruleSub}</span></div><button id="resume" class="resume-button" type="button" hidden><span><small>接着上次的位置</small><span id="resume-label"></span></span>${icon('arrow')}</button><p class="reading-tip">表格可左右滑动 · 思考模型可展开 · 上滑呼出工具栏</p></section>
${$.html(article)}
<footer class="chapter-end"><span class="end-mark">◇</span><h2>这一章，先读到这里。</h2><p>回到自测清单，试着不用笔记回答一次。</p>${selfTest ? `<a href="#${selfTest.id}">前往自测清单 ${icon('arrow')}</a>` : `<a href="notes.html">返回笔记书架 ${icon('arrow')}</a>`}${chapterNav}<div class="export-note">根据原笔记生成 · 图片与公式已内置</div></footer>
</main></div>
<nav class="reader-dock" aria-label="阅读工具"><button type="button" data-open="toc-dialog">${icon('menu')}<span>目录</span></button><button type="button" data-open="search-dialog">${icon('search')}<span>查找</span></button><button type="button" data-open="settings-dialog">${icon('text')}<span>字号</span></button><button type="button" id="theme-toggle" aria-pressed="false">${icon('moon')}<span id="theme-label">夜读</span></button><button type="button" id="back-top">${icon('up')}<span>顶部</span></button></nav>
<dialog id="toc-dialog" class="panel-dialog"><div class="dialog-heading"><div><small>CONTENTS</small><h2>本章目录</h2></div>${closeButton}</div><nav class="toc dialog-scroll">${toc}</nav></dialog>
<dialog id="search-dialog" class="panel-dialog"><div class="dialog-heading"><div><small>FIND IN CHAPTER</small><h2>查找本章</h2></div>${closeButton}</div><div class="search-field">${icon('search')}<input id="search-input" type="search" placeholder="${escape(subjectMeta.searchPlaceholder)}" aria-label="搜索本章内容" autocomplete="off"></div><p id="search-status" class="search-status" aria-live="polite">搜索正文、表格与折叠内容</p><div id="search-results" class="search-results dialog-scroll"></div></dialog>
<dialog id="settings-dialog" class="panel-dialog settings-dialog"><div class="dialog-heading"><div><small>READING PREFERENCES</small><h2>读得舒服一点</h2></div>${closeButton}</div><div class="setting-row"><div><strong>正文字号</strong><small>跟着你的阅读习惯调整</small></div><div class="stepper"><button type="button" id="font-minus" aria-label="减小字号">${icon('minus')}</button><output id="font-value">18</output><button type="button" id="font-plus" aria-label="增大字号">${icon('plus')}</button></div></div><div class="setting-row"><div><strong>行间距</strong><small>宽松一点，读得从容</small></div><select id="line-height" aria-label="正文行间距"><option value="1.7">紧凑</option><option value="1.9" selected>适中</option><option value="2.1">宽松</option></select></div><div class="setting-row setting-themes"><div><strong>页面配色</strong><small>跨章节与全站同步 · 7 套阅读风格随心切换</small></div><div class="theme-options" aria-label="页面配色"><button type="button" data-theme-choice="paper" aria-label="暖纸书" aria-pressed="true"><i></i><span>暖纸书</span></button><button type="button" data-theme-choice="focus" aria-label="专注精读" aria-pressed="false"><i></i><span>专注精读</span></button><button type="button" data-theme-choice="mono" aria-label="极简黑白" aria-pressed="false"><i></i><span>极简黑白</span></button><button type="button" data-theme-choice="glass" aria-label="暮光玻璃" aria-pressed="false"><i></i><span>暮光玻璃</span></button><button type="button" data-theme-choice="momo" aria-label="墨墨护眼" aria-pressed="false"><i></i><span>墨墨护眼</span></button><button type="button" data-theme-choice="light" aria-label="纯白" aria-pressed="false"><i></i><span>纯白</span></button><button type="button" data-theme-choice="dark" aria-label="夜读" aria-pressed="false"><i></i><span>夜读</span></button></div><div class="wallpaper-picker"><small>暮光玻璃壁纸（本机自动记忆）</small><div class="wallpaper-options" aria-label="选择暮光壁纸"><button type="button" data-wallpaper-choice="lake" aria-pressed="true"><span>雪山暮色</span></button><button type="button" data-wallpaper-choice="coast" aria-pressed="false"><span>橘海落日</span></button><button type="button" data-wallpaper-choice="forest" aria-pressed="false"><span>松林晨雾</span></button></div></div></div><p class="storage-note">阅读位置、自测勾选和偏好保存在当前浏览器中。</p></dialog>
<dialog id="image-dialog" class="image-dialog"><div class="image-toolbar"><span id="image-title">本章插图</span>${closeButton}</div><div id="image-viewport" class="image-viewport"><img id="zoom-image" alt=""></div><div class="image-controls"><button type="button" id="image-minus" aria-label="缩小图片">${icon('minus')}</button><button type="button" id="image-fit">适应屏幕</button><button type="button" id="image-plus" aria-label="放大图片">${icon('plus')}</button></div><p class="image-help">放大后可拖动查看；也可用浏览器双指缩放</p></dialog>
<div id="toast" role="status" class="toast" hidden></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;

if (mathErrors.length) throw new Error(`公式渲染错误：${JSON.stringify(mathErrors)}`);
const sidebarCss = fs.readFileSync(path.join(__dirname, 'sidebar.css'), 'utf8');
const sidebarJs = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
const finalHtml = html.replace('</head>', () => `<style id="sidebar-style">${sidebarCss}</style></head>`).replace('</body>', () => `<script id="sidebar-script">${sidebarJs}</script></body>`);
fs.writeFileSync(output, finalHtml, 'utf8');

const report = {
  subject, chapterNumber, title, shortTitle, fileName: path.basename(output),
  source: path.relative(root, source), sourceSha256: hash, output, outputBytes: Buffer.byteLength(finalHtml),
  headings: headings.length + 1, navigationEntries: headings.filter(h => h.level <= 3).length,
  tables: tableCount, images: images.length, uniqueImages: new Set(images.map(i => i.path)).size,
  equations: equations.length, displayEquations: equations.filter(e => e.display).length,
  callouts: article.find('.callout').length, selfTests: article.find('[data-check]').length,
  characterCount: wordCount, contentPreserved: bodyBefore === bodyAfter, mathErrors, imageManifest: images, unresolvedLinks,
  generatedAt: new Date().toISOString()
};
const reportPath = path.join(reportDir, `report-${subject}-${chapterNumber}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({
  output, reportPath, MB: (report.outputBytes / 1024 / 1024).toFixed(2),
  headings: report.headings, tables: report.tables, images: report.images,
  equations: report.equations, callouts: report.callouts, mathErrors
}, null, 2));
