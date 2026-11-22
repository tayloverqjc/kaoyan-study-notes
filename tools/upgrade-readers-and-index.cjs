'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const notesCatalog = JSON.parse(fs.readFileSync(path.join(dist, 'study', 'notes.json'), 'utf8'));
const readerCss = fs.readFileSync(path.join(__dirname, 'reader.css'), 'utf8');
const highlightsCss = fs.readFileSync(path.join(__dirname, 'highlights.css'), 'utf8');
const readerJs = fs.readFileSync(path.join(__dirname, 'reader.js'), 'utf8');
const sidebarCss = fs.readFileSync(path.join(__dirname, 'sidebar.css'), 'utf8');
const sidebarJs = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function extractText($, element) {
  const clone = $(element).clone();
  clone.find('.callout-label,.chevron,figcaption,.table-hint').remove();
  clone.find('.math[data-tex]').each((_, el) => {
    const tex = $(el).attr('data-tex') || '';
    $(el).replaceWith(tex ? ` ${tex.trim()} ` : '');
  });
  return clone.text().replace(/\s+/g, ' ').trim();
}

function buildTocHtml($) {
  const headings = [];
  $('#article').find('h1,h2,h3').each((_, node) => {
    const el = $(node);
    const id = el.attr('id');
    if (!id) return;
    headings.push({ id, level: Number(node.tagName.slice(1)), text: extractText($, el) });
  });
  const tocGroups = [{ label: '阅读准备', items: [] }];
  for (const h of headings) {
    if (h.level === 1) tocGroups.push({ label: h.text, id: h.id, items: [] });
    else tocGroups.at(-1).items.push(h);
  }
  return tocGroups
    .filter(group => group.id || group.items.length)
    .map(group => `<div class="toc-group">${group.id ? `<a class="toc-major" href="#${group.id}">${escape(group.label)}</a>` : `<span class="toc-label">${escape(group.label)}</span>`}${group.items.map(h => `<a class="${h.level === 3 ? 'toc-sub' : 'toc-minor'}" href="#${h.id}">${escape(h.text)}</a>`).join('')}</div>`)
    .join('');
}

function buildChapterNav(chapters, index) {
  const prev = index > 0 ? chapters[index - 1] : null;
  const next = index < chapters.length - 1 ? chapters[index + 1] : null;
  if (!prev && !next) return '';
  return `<nav class="chapter-nav" aria-label="章节切换">${prev ? `<a class="prev-link" href="${escape(prev.url)}"><small>← 上一篇</small><strong>${escape(prev.title)}</strong></a>` : ''}${next ? `<a class="next-link" href="${escape(next.url)}"><small>下一篇 →</small><strong>${escape(next.title)}</strong></a>` : ''}</nav>`;
}

function upgradeShell(filePath, subject, chapter, chapters, index) {
  let html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const tocHtml = buildTocHtml($);
  const chapterLabel = chapter.number === 0 ? '00 · 考前总控' : subject.key === 'math' ? `第${chapter.number}讲` : `第${chapter.number}章`;
  const keyPrefix = subject.key === 'os' ? 'os-reader-v1-ch' : `notes-${subject.key}-ch`;

  html = html.replace(/img-src data:;/g, "img-src 'self' data:;");
  if (!html.includes('study/theme-boot.js')) {
    html = html.replace(/<style>/, () => '<script src="study/theme-boot.js?v=1"></script>\n<style>');
  }

  html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, inner) => {
    const idx = inner.indexOf(':root{--page:');
    if (idx === -1) throw new Error(`Missing :root{--page: in ${chapter.url}`);
    const mathCss = inner.slice(0, idx).trimEnd();
    return `<style>${mathCss}\n${readerCss}\n${highlightsCss}\n.callout-danger{border-left-color:var(--note-priority)}.callout-danger .callout-label,.callout-danger strong{color:var(--note-priority)}</style>`;
  });
  html = html.replace(/<style id="note-highlights">[\s\S]*?<\/style>/, '');
  html = html.replace(/<style id="sidebar-style">[\s\S]*?<\/style>/, () => `<style id="sidebar-style">${sidebarCss}</style>`);
  html = html.replace(/<body data-chapter="(\d+)"(?:\s+data-chapter-label="([^"]*)")?>/, (_, ch, existingLabel) => `<body data-chapter="${ch}" data-chapter-label="${escape(existingLabel || chapterLabel)}">`);
  html = html.replace(/<i><\/i><span>0 幅插图<\/span>/g, '');
  html = html.replace(/<p class="reading-tip">[^<]*<\/p>/, () => '<p class="reading-tip">表格可左右滑动 · 思考模型可展开 · 上滑呼出工具栏</p>');
  html = html.replace(/<nav class="toc">[\s\S]*?<\/nav>/, () => `<nav class="toc">${tocHtml}</nav>`);
  html = html.replace(/<nav class="toc dialog-scroll">[\s\S]*?<\/nav>/, () => `<nav class="toc dialog-scroll">${tocHtml}</nav>`);

  const themeRow = `<div class="setting-row setting-themes"><div><strong>页面配色</strong><small>跨章节与全站同步 · 7 套阅读风格随心切换</small></div><div class="theme-options" aria-label="页面配色"><button type="button" data-theme-choice="paper" aria-label="暖纸书" aria-pressed="true"><i></i><span>暖纸书</span></button><button type="button" data-theme-choice="focus" aria-label="专注精读" aria-pressed="false"><i></i><span>专注精读</span></button><button type="button" data-theme-choice="mono" aria-label="极简黑白" aria-pressed="false"><i></i><span>极简黑白</span></button><button type="button" data-theme-choice="glass" aria-label="暮光玻璃" aria-pressed="false"><i></i><span>暮光玻璃</span></button><button type="button" data-theme-choice="momo" aria-label="墨墨护眼" aria-pressed="false"><i></i><span>墨墨护眼</span></button><button type="button" data-theme-choice="light" aria-label="纯白" aria-pressed="false"><i></i><span>纯白</span></button><button type="button" data-theme-choice="dark" aria-label="夜读" aria-pressed="false"><i></i><span>夜读</span></button></div><div class="wallpaper-picker"><small>暮光玻璃壁纸（本机自动记忆）</small><div class="wallpaper-options" aria-label="选择暮光壁纸"><button type="button" data-wallpaper-choice="lake" aria-pressed="true"><span>雪山暮色</span></button><button type="button" data-wallpaper-choice="coast" aria-pressed="false"><span>橘海落日</span></button><button type="button" data-wallpaper-choice="forest" aria-pressed="false"><span>松林晨雾</span></button></div></div></div>`;
  html = html.replace(/<div class="setting-row(?:\s+setting-themes)?"><div><strong>页面配色<\/strong>[\s\S]*?(?=<p class="storage-note">)/, () => themeRow);

  const navHtml = buildChapterNav(chapters, index);
  html = html.replace(/<footer class="chapter-end">([\s\S]*?)<\/footer>/, (_, inner) => {
    let cleaned = inner.replace(/<nav class="chapter-nav"[\s\S]*?<\/nav>/, '');
    cleaned = cleaned.replace('href="index.html">返回笔记书架', 'href="notes.html">返回笔记书架');
    cleaned = cleaned.replace('<div class="export-note">', () => `${navHtml}<div class="export-note">`);
    return `<footer class="chapter-end">${cleaned}</footer>`;
  });

  const nextJs = readerJs.replace("const key = 'os-reader-v1-ch' + document.body.dataset.chapter;", () => `const key = '${keyPrefix}' + document.body.dataset.chapter;`).replace(/<\/script/gi, '<\\/script');
  html = html.replace(/(<div id="toast"[^>]*><\/div>\s*)<script>[\s\S]*?<\/script>/, (_, prefix) => `${prefix}<script>${nextJs}</script>`);
  html = html.replace(/<script id="sidebar-script">[\s\S]*?<\/script>/, () => `<script id="sidebar-script">${sidebarJs}</script>`);

  fs.writeFileSync(filePath, html, 'utf8');
}

function extractSections(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const article = $('#article');
  const sections = [];
  let current = { id: 'top', heading: '导读与概览', parts: [] };

  article.children().each((_, node) => {
    const el = $(node);
    const tag = node.tagName?.toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      if (current.parts.length) {
        sections.push({ id: current.id, heading: current.heading, text: current.parts.join(' ').replace(/\s+/g, ' ').trim() });
      }
      current = { id: el.attr('id') || 'top', heading: extractText($, el), parts: [] };
      return;
    }
    const text = extractText($, el);
    if (text) current.parts.push(text);
  });
  if (current.parts.length) {
    sections.push({ id: current.id, heading: current.heading, text: current.parts.join(' ').replace(/\s+/g, ' ').trim() });
  }
  return sections;
}

const searchIndex = [];
let upgradedCount = 0;

for (const subject of notesCatalog) {
  subject.chapters.forEach((chapter, index) => {
    const filePath = path.join(dist, chapter.url);
    upgradeShell(filePath, subject, chapter, subject.chapters, index);
    upgradedCount++;
    searchIndex.push({
      key: subject.key,
      subject: subject.title,
      number: chapter.number,
      title: chapter.title,
      url: chapter.url,
      sections: extractSections(filePath)
    });
  });
}

const indexPath = path.join(dist, 'study', 'notes-index.json');
const indexJson = JSON.stringify(searchIndex);
fs.writeFileSync(indexPath, indexJson, 'utf8');
console.log(JSON.stringify({ upgradedShells: upgradedCount, indexedChapters: searchIndex.length, indexKB: Math.round(Buffer.byteLength(indexJson) / 1024) }));
