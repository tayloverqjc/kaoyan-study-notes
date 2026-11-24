(() => {
  'use strict';

  const cfg = window.MINDMAP_CONFIG;
  if (!cfg || !Array.isArray(cfg.tree)) return;

  const IS_RICH = !!cfg.rich;
  const PREFS_KEY = 'personal-notes-reader-prefs';
  const STORAGE_KEY = cfg.storageKey || `notes-network-ch${cfg.chapter}-mindmap-v1`;
  const RETURN_KEY = `mm-return-state:${cfg.pageFile}`;
  const ALL_THEMES = ['paper', 'focus', 'mono', 'glass', 'momo', 'light', 'dark'];
  const DAY_THEMES = ['paper', 'focus', 'mono', 'glass', 'momo', 'light'];
  const WALLPAPERS = ['lake', 'coast', 'forest'];
  const THEME_LABELS = {
    paper: '暖纸',
    focus: '专注',
    mono: '黑白',
    glass: '暮光',
    momo: '墨墨',
    light: '纯白',
    dark: '夜读'
  };
  const THEMES = [
    { id: 'paper', label: '暖纸书' },
    { id: 'focus', label: '专注精读' },
    { id: 'mono', label: '极简黑白' },
    { id: 'glass', label: '暮光玻璃' },
    { id: 'momo', label: '墨墨护眼' },
    { id: 'light', label: '纯白' },
    { id: 'dark', label: '夜读' }
  ];
  const WP_OPTIONS = [
    { id: 'lake', label: '雪山暮色' },
    { id: 'coast', label: '橘海落日' },
    { id: 'forest', label: '松林晨雾' }
  ];
  const THEME_COLORS = {
    paper: '#f5f3ed',
    focus: '#f4f1ea',
    mono: '#ffffff',
    glass: '#0d141e',
    momo: '#f1f6f5',
    light: '#ffffff',
    dark: '#141c18'
  };

  const TREE = cfg.tree;
  const CHAPTERS = cfg.chapters || [];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  // Safe inline rich-text highlighter & formula markup (HTML-escaped first)
  function fmtRich(s) {
    let out = esc(s);
    out = out.replace(/==(.+?)==/g, '<mark class="hl-y">$1</mark>');
    out = out.replace(/!!(.+?)!!/g, '<mark class="hl-r">$1</mark>');
    out = out.replace(/@@(.+?)@@/g, '<mark class="hl-b">$1</mark>');
    out = out.replace(/&amp;&amp;(.+?)&amp;&amp;/g, '<mark class="hl-g">$1</mark>');
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/`([^`]+)`/g, '<code class="mm-code">$1</code>');
    out = out.replace(/\n/g, '<br>');
    return out;
  }

  function stripMarkup(s) {
    return String(s ?? '')
      .replace(/==|!!|@@|&&|\*\*/g, '')
      .replace(/`/g, '');
  }

  const ALL_LEAVES = [];
  const LEAF_PARENTS = new Map();

  function collectLeaves(nodes, trail, parentIds) {
    for (const n of nodes) {
      if (n.children && n.children.length) {
        collectLeaves(n.children, [...trail, n.title], [...parentIds, n.id]);
      } else {
        ALL_LEAVES.push({ ...n, crumbs: trail.join(' › ') });
        LEAF_PARENTS.set(n.id, parentIds);
      }
    }
  }
  collectLeaves(TREE, [], []);
  const LEAF_MAP = new Map(ALL_LEAVES.map(x => [x.id, x]));

  if (IS_RICH) document.body.classList.add('is-rich');

  const chapterLinksHtml = CHAPTERS.length ? `
    <span class="hud-sep"></span>
    <nav class="hud-chapters" aria-label="切换章节导图">
      ${CHAPTERS.map(ch => `<a class="hud-ch" href="${esc(ch.href)}" title="${esc(ch.title)}"${ch.num === cfg.chapter ? ' aria-current="page"' : ''}>${esc(ch.label)}</a>`).join('')}
    </nav>` : '';

  const modeButtonsHtml = IS_RICH ? `
    <button type="button" class="hud-btn" id="btn-skeleton" aria-pressed="false" title="在图文强化白板与极简一屏骨架之间切换">极简骨架</button>
    <button type="button" class="hud-btn" id="btn-exams" aria-pressed="true" title="显示或隐藏考点右侧 408 真题卡">真题卡</button>
  ` : `
    <button type="button" class="hud-btn" id="btn-layout" title="切换双栏全览或单树">切单树</button>
  `;

  document.body.innerHTML = `
    <div class="canvas-vp" id="vp" aria-label="${esc(cfg.title)}思维导图画布">
      <div class="tree-world" id="world"></div>
    </div>

    <div class="hud-tl">
      <a class="hud-btn" href="notes.html">← 书架</a>
      <span class="hud-sep"></span>
      <a class="hud-btn" href="${esc(cfg.noteHref)}">原笔记 ↗</a>
      <a class="hud-btn hud-hub" href="${esc(cfg.hubHref || 'network-0.html')}">总控 ↗</a>
      ${chapterLinksHtml}
      <span class="hud-sep"></span>
      <span class="hud-title">${esc(cfg.title)}</span>
    </div>

    ${IS_RICH ? `
    <nav class="hud-modules" id="hud-modules" aria-label="快速定位核心模块">
      <button type="button" class="hud-mod-btn" data-jump-mod="__root__">总览中心</button>
      ${TREE.map(m => `<button type="button" class="hud-mod-btn" data-jump-mod="${esc(m.id)}">${esc(m.navLabel || m.title)}</button>`).join('')}
    </nav>` : ''}

    <div class="hud-br">
      <span class="hud-stat">掌握 <b id="st-m">0</b>/<span id="st-total">0</span> · 卡壳 <span class="stuck-n" id="st-s">0</span></span>
      <span class="hud-sep"></span>
      <input type="search" class="hud-search" id="search-box" placeholder="搜考点/年份…" aria-label="搜索导图">
      ${modeButtonsHtml}
      <button type="button" class="hud-btn" id="btn-red" aria-pressed="false" title="只高亮真题与错题红线">仅红线</button>
      <button type="button" class="hud-btn" id="btn-blur" aria-pressed="false" title="遮住重点结论自测；第1次点揭晓，第2次点跳原笔记">遮罩自测</button>
      <button type="button" class="hud-btn" id="btn-collapse">折叠到二级</button>
      <span class="hud-sep"></span>
      <button type="button" class="hud-btn" id="btn-zout" title="缩小">−</button>
      <span class="zoom-readout" id="z-val">100%</span>
      <button type="button" class="hud-btn" id="btn-zin" title="放大">＋</button>
      <button type="button" class="hud-btn" id="btn-fit" title="整章全览">全览</button>
      ${IS_RICH ? '<button type="button" class="hud-btn" id="btn-readview" title="回到清晰读图视角">读图</button>' : ''}
      <button type="button" class="hud-btn" id="btn-print" title="打印或另存为 PDF">导出PDF</button>
      <button type="button" class="hud-btn" id="btn-theme" aria-expanded="false" aria-controls="theme-pop" title="切换配色与暮光壁纸（跨全站同步）">主题</button>
    </div>

    <div class="theme-pop" id="theme-pop" role="dialog" aria-label="切换配色与壁纸" hidden>
      <div class="tp-head">全站同步配色</div>
      <div class="tp-grid">
        ${THEMES.map(t => `<button type="button" class="tp-opt" data-tp="${t.id}" aria-pressed="false"><i></i><span>${t.label}</span></button>`).join('')}
      </div>
      <div class="tp-wp-wrap">
        <div class="tp-head">暮光玻璃壁纸</div>
        <div class="tp-wp-grid">
          ${WP_OPTIONS.map(w => `<button type="button" class="tp-wp" data-wp="${w.id}" aria-pressed="false"><span>${w.label}</span></button>`).join('')}
        </div>
      </div>
    </div>

    <div class="mm-lightbox" id="mm-lightbox" role="dialog" aria-modal="true" aria-label="原理图放大预览" hidden>
      <div class="mm-lb-box">
        <div class="mm-lb-bar">
          <span id="mm-lb-cap"></span>
          <button type="button" class="mm-lb-close" id="mm-lb-close">关闭 (Esc)</button>
        </div>
        <img id="mm-lb-img" alt="">
      </div>
    </div>

    <div class="mm-toast" id="mm-toast" role="status" aria-live="polite" hidden></div>
  `;

  let state = loadState();
  let collapsed = new Set();
  let revealed = new Set();
  let layoutMode = IS_RICH ? 'rich' : 'dual';
  let skeletonMode = false;
  let showExams = true;
  let onlyRed = false;
  let recallBlur = false;
  let searchText = '';
  let returnedLeafId = null;

  let zoom = 1;
  let tx = 20;
  let ty = 20;

  const vp = document.getElementById('vp');
  const world = document.getElementById('world');
  const toastEl = document.getElementById('mm-toast');
  const lbEl = document.getElementById('mm-lightbox');
  const lbImg = document.getElementById('mm-lb-img');
  const lbCap = document.getElementById('mm-lb-cap');
  const USE_CSS_ZOOM = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '1.5');
  let bracketRaf = 0;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => { toastEl.hidden = true; }, 1900);
  }

  function openLightbox(src, caption) {
    lbImg.src = src;
    lbImg.alt = caption || '原理图';
    lbCap.textContent = caption || '高清原理图预览';
    lbEl.hidden = false;
  }
  function closeLightbox() {
    lbEl.hidden = true;
    lbImg.removeAttribute('src');
  }
  document.getElementById('mm-lb-close').addEventListener('click', closeLightbox);
  lbEl.addEventListener('click', e => {
    if (e.target === lbEl) closeLightbox();
  });

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (raw && Array.isArray(raw.mastered) && Array.isArray(raw.stuck)) {
        return { mastered: new Set(raw.mastered), stuck: new Set(raw.stuck) };
      }
    } catch {}
    return { mastered: new Set(), stuck: new Set() };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mastered: [...state.mastered],
        stuck: [...state.stuck]
      }));
    } catch {}
  }

  function readPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch { return {}; }
  }

  const themePop = document.getElementById('theme-pop');
  const btnTheme = document.getElementById('btn-theme');

  function syncTheme() {
    const t = ALL_THEMES.includes(document.documentElement.dataset.theme)
      ? document.documentElement.dataset.theme
      : 'paper';
    const w = WALLPAPERS.includes(document.documentElement.dataset.wallpaper)
      ? document.documentElement.dataset.wallpaper
      : 'lake';
    btnTheme.textContent = THEME_LABELS[t] || '主题';
    const mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = THEME_COLORS[t] || '#f5f3ed';
    themePop.querySelectorAll('[data-tp]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.tp === t));
    });
    themePop.querySelectorAll('[data-wp]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.wp === w));
    });
  }

  function applyStoredPrefs() {
    const p = readPrefs();
    const cur = document.documentElement.dataset.theme || 'paper';
    const t = ALL_THEMES.includes(p.theme) ? p.theme : cur;
    const w = WALLPAPERS.includes(p.wallpaper) ? p.wallpaper : (document.documentElement.dataset.wallpaper || 'lake');
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.wallpaper = w;
    syncTheme();
  }

  function setTheme(theme) {
    if (!ALL_THEMES.includes(theme)) theme = 'paper';
    const prefs = readPrefs();
    prefs.theme = theme;
    if (DAY_THEMES.includes(theme)) prefs.dayTheme = theme;
    if (!WALLPAPERS.includes(prefs.wallpaper)) {
      prefs.wallpaper = document.documentElement.dataset.wallpaper || 'lake';
    }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.wallpaper = WALLPAPERS.includes(prefs.wallpaper) ? prefs.wallpaper : 'lake';
    syncTheme();
  }

  function setWallpaper(wp) {
    if (!WALLPAPERS.includes(wp)) wp = 'lake';
    const prefs = readPrefs();
    prefs.wallpaper = wp;
    if (!ALL_THEMES.includes(prefs.theme)) prefs.theme = 'glass';
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
    document.documentElement.dataset.wallpaper = wp;
    syncTheme();
  }

  function toggleThemePop(forceOpen) {
    const open = forceOpen !== undefined ? forceOpen : themePop.hidden;
    themePop.hidden = !open;
    btnTheme.setAttribute('aria-expanded', String(open));
  }

  btnTheme.addEventListener('click', e => {
    e.stopPropagation();
    toggleThemePop();
  });

  themePop.addEventListener('click', e => {
    e.stopPropagation();
    const tpBtn = e.target.closest('[data-tp]');
    if (tpBtn) {
      setTheme(tpBtn.dataset.tp);
      return;
    }
    const wpBtn = e.target.closest('[data-wp]');
    if (wpBtn) {
      setWallpaper(wpBtn.dataset.wp);
      showToast('已切换壁纸：' + wpBtn.textContent.trim());
    }
  });

  document.addEventListener('click', e => {
    if (!themePop.hidden && !e.target.closest('#theme-pop, #btn-theme')) {
      toggleThemePop(false);
    }
  });

  function countLeaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  }

  function renderMediaItem(item) {
    if (!item) return '';
    if (item.type === 'img') {
      const styleW = item.width ? ` style="max-width:${Number(item.width)}px"` : '';
      return `
        <figure class="mm-fig" data-lightbox="${esc(item.src)}" data-cap="${esc(item.caption || '')}"${styleW}>
          <img src="${esc(item.src)}" alt="${esc(item.caption || '原理图')}" loading="eager">
          <figcaption class="mm-fig-cap">
            <span>${esc(item.caption || '')}</span>
            <span>点击放大 🔍</span>
          </figcaption>
        </figure>
      `;
    }
    if (item.type === 'table') {
      return `
        <div class="mm-table-card">
          ${item.title ? `<div class="mm-table-title">${esc(item.title)}</div>` : ''}
          <table class="mm-table">
            ${item.headers ? `<thead><tr>${item.headers.map(h => `<th>${fmtRich(h)}</th>`).join('')}</tr></thead>` : ''}
            <tbody>
              ${(item.rows || []).map(row => `<tr>${row.map(cell => `<td>${fmtRich(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    if (item.type === 'example') {
      return `
        <div class="mm-example-card">
          ${item.title ? `<div class="mm-example-title">${esc(item.title)}</div>` : ''}
          <div>${fmtRich(item.body)}</div>
        </div>
      `;
    }
    return '';
  }

  function renderExamCards(exams) {
    if (!Array.isArray(exams) || !exams.length) return '';
    return `
      <div class="mm-exams">
        ${exams.map(ex => `
          <article class="mm-exam-card${ex.mistake ? ' is-mistake' : ''}">
            <div class="mm-exam-head">
              <div class="mm-exam-badges">
                <span class="mm-exam-yr">${esc(ex.year)}</span>
                ${ex.mistake ? '<span class="mm-exam-flag">🔥 个人错题</span>' : ''}
                ${ex.star ? '<span class="mm-exam-flag is-star">★ 高频母题</span>' : ''}
              </div>
              ${ex.href ? `<button type="button" class="mm-exam-note-btn" data-exam-jump="${esc(ex.href)}" data-exam-node="${esc(ex.nodeId || '')}" data-exam-label="${esc(ex.year)}">原笔记 ↗</button>` : ''}
            </div>
            <div class="mm-exam-q">${fmtRich(ex.q)}</div>
            ${Array.isArray(ex.opts) && ex.opts.length ? `<div class="mm-exam-opts">${ex.opts.map(o => `<span>${fmtRich(o)}</span>`).join('')}</div>` : ''}
            <details class="mm-exam-ans">
              <summary>核对答案与秒杀思路</summary>
              <div class="mm-exam-ans-body">
                <div><strong>答案：${esc(ex.ans)}</strong></div>
                <div>${fmtRich(ex.explain)}</div>
                ${ex.pitfall ? `<div class="mm-exam-pitfall">踩坑复盘：${fmtRich(ex.pitfall)}</div>` : ''}
              </div>
            </details>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderRightRail(node) {
    if (!node.summary && !node.sticky) return '';
    const sumHtml = node.summary ? `
      <div class="mm-summary" data-summary-target="1">
        ${node.summary.title ? `<div class="mm-summary-head">${esc(node.summary.title)}</div>` : ''}
        <div>${fmtRich(node.summary.text)}</div>
      </div>` : '';
    const stickyHtml = node.sticky ? `
      <div class="mm-sticky">
        <div class="mm-sticky-head">📌 ${esc(node.sticky.title || '必背铁律')}</div>
        <div>${fmtRich(node.sticky.text)}</div>
      </div>` : '';
    return `<div class="mm-right-rail">${sumHtml}${stickyHtml}</div>`;
  }

  function renderNode(node, depth) {
    if (node.children && node.children.length) {
      const isCol = collapsed.has(node.id);
      const childGapCls = `gap-${Math.min(depth, 4)}`;
      const leadHtml = (!isCol && IS_RICH && Array.isArray(node.leadMedia) && node.leadMedia.length)
        ? `<div class="mm-lead-media">${node.leadMedia.map(renderMediaItem).join('')}</div>`
        : '';
      const inlineMediaHtml = (!isCol && IS_RICH && Array.isArray(node.media) && node.media.length)
        ? node.media.map(m => `<div class="t-node t-media" data-depth="${depth + 1}">${renderMediaItem(m)}</div>`).join('')
        : '';
      const subHtml = (IS_RICH && node.sub && depth === 1) ? `<span class="br-sub">${esc(node.sub)}</span>` : '';

      return `
        <div class="t-node" data-depth="${depth}" data-node-id="${esc(node.id)}">
          <button type="button" class="node-branch depth-${depth}" data-branch="${esc(node.id)}" title="点击展开/收起分支">
            <span>${esc(node.title)}${isCol ? ` <span class="branch-badge">+${countLeaves(node)}</span>` : ''}</span>
            ${subHtml}
          </button>
          ${leadHtml}
          ${isCol ? '' : `<div class="t-children ${childGapCls}">${inlineMediaHtml}${node.children.map(c => renderNode(c, depth + 1)).join('')}</div>`}
          ${isCol || !IS_RICH ? '' : renderRightRail(node)}
          ${isCol || !IS_RICH ? '' : renderExamCards(node.exams)}
        </div>
      `;
    }

    const q = searchText.trim().toLowerCase();
    const isM = state.mastered.has(node.id);
    const isS = state.stuck.has(node.id);
    const bodyText = (IS_RICH && skeletonMode && node.short) ? node.short : node.text;
    const hay = `${node.bold} ${stripMarkup(node.text)} ${node.short || ''} ${node.tag} ${node.crumbs || ''} ${node.kw || ''}`.toLowerCase();
    const isMatch = q ? hay.includes(q) : false;
    const isDim = (onlyRed && !node.red) || (q && !isMatch);
    const cls = [
      'node-leaf',
      returnedLeafId === node.id ? 'is-returned' : '',
      revealed.has(node.id) ? 'is-revealed' : '',
      isDim ? 'is-dim' : '',
      isMatch ? 'is-match' : ''
    ].filter(Boolean).join(' ');
    const dot = isS ? '<i class="leaf-dot stuck" title="仍卡壳"></i>'
      : isM ? '<i class="leaf-dot mastered" title="已掌握"></i>' : '';
    const formattedBody = IS_RICH ? fmtRich(bodyText) : esc(bodyText);

    return `
      <div class="t-node" data-depth="${depth}">
        <button type="button" class="${cls}" data-leaf="${esc(node.id)}" title="点击跳转原笔记对应小节（右键标记掌握/卡壳）">
          ${dot}<span class="leaf-copy"><strong>${esc(node.bold)}</strong><span class="leaf-plain">：${formattedBody}</span><span class="leaf-tag ${node.red ? 'is-red' : ''}">（${esc(node.tag)}）</span><span class="leaf-jump" aria-hidden="true">↗</span></span>
        </button>
      </div>
    `;
  }

  function renderTree(syncBracketsNow) {
    if (IS_RICH) {
      world.innerHTML = `
        <div class="board-rich" id="board">
          <svg class="tree-svg" id="tree-svg" aria-hidden="true"></svg>
          <div class="t-node" data-depth="0">
            <div class="node-root-rich" id="node-root">
              ${cfg.kicker ? `<div class="rr-kicker">${esc(cfg.kicker)}</div>` : ''}
              <div class="rr-title">${esc(cfg.title)}</div>
              ${cfg.subtitle ? `<div class="rr-sub">${esc(cfg.subtitle)}</div>` : ''}
            </div>
            <div class="t-children gap-root">${TREE.map(n => renderNode(n, 1)).join('')}</div>
          </div>
        </div>
      `;
      // Redraw brackets once any embedded diagram finishes loading
      world.querySelectorAll('.mm-fig img').forEach(img => {
        if (!img.complete) {
          img.addEventListener('load', () => scheduleBrackets(), { once: true });
        }
      });
    } else if (layoutMode === 'dual') {
      const leftNodes = TREE.filter(n => n.col === 'left');
      const rightNodes = TREE.filter(n => n.col === 'right');
      world.innerHTML = `
        <div class="board-dual" id="board">
          <svg class="tree-svg" id="tree-svg" aria-hidden="true"></svg>
          <div class="board-col" data-spine-col="left">${leftNodes.map(n => renderNode(n, 1)).join('')}</div>
          <div class="board-col" data-spine-col="right">${rightNodes.map(n => renderNode(n, 1)).join('')}</div>
        </div>
      `;
    } else {
      world.innerHTML = `
        <div class="board-single" id="board">
          <svg class="tree-svg" id="tree-svg" aria-hidden="true"></svg>
          <div class="t-node" data-depth="0">
            <div class="node-root" id="node-root">${esc(cfg.title)}</div>
            <div class="t-children gap-root">${TREE.map(n => renderNode(n, 1)).join('')}</div>
          </div>
        </div>
      `;
    }

    updateHudStats();
    applyTransform(false);
    if (syncBracketsNow) drawAllBrackets();
    else scheduleBrackets();
  }

  function makeBracketPath(px, py, anchors, radius, clsName) {
    if (!anchors.length) return '';
    const minX = Math.min(...anchors.map(a => a.x));
    const xMid = px + Math.max(10, (minX - px) * 0.45);
    const cls = clsName ? ` class="${clsName}"` : '';
    const out = [`<path${cls} d="M ${px.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${py.toFixed(1)}" />`];

    if (anchors.length === 1) {
      const c = anchors[0];
      if (Math.abs(c.y - py) < 1.5) {
        out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}" />`);
      } else {
        const dir = c.y > py ? 1 : -1;
        const r = Math.min(radius, Math.abs(c.y - py) / 2, Math.max(2, (c.x - xMid) * 0.45));
        out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${(c.y - dir * r).toFixed(1)} Q ${xMid.toFixed(1)} ${c.y.toFixed(1)} ${(xMid + r).toFixed(1)} ${c.y.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}" />`);
      }
      return out.join('');
    }

    const first = anchors[0];
    const last = anchors[anchors.length - 1];

    if (first.y < py - 1) {
      const rT = Math.min(radius, (py - first.y) * 0.48, Math.max(2, (first.x - xMid) * 0.48));
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${(first.y + rT).toFixed(1)} Q ${xMid.toFixed(1)} ${first.y.toFixed(1)} ${(xMid + rT).toFixed(1)} ${first.y.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}" />`);
    } else {
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${first.y.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}" />`);
    }

    if (last.y > py + 1) {
      const rB = Math.min(radius, (last.y - py) * 0.48, Math.max(2, (last.x - xMid) * 0.48));
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${(last.y - rB).toFixed(1)} Q ${xMid.toFixed(1)} ${last.y.toFixed(1)} ${(xMid + rB).toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}" />`);
    } else {
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}" />`);
    }

    if (first.y > py) out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${first.y.toFixed(1)}" />`);
    else if (last.y < py) out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${last.y.toFixed(1)}" />`);

    for (let i = 1; i < anchors.length - 1; i++) {
      const c = anchors[i];
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${c.y.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}" />`);
    }
    return out.join('');
  }

  // Classic BOK26-style right-facing curly brace "}" summarizing sibling children
  function makeRightCurlyBrace(xBase, yTop, yBot, xTip) {
    const h = yBot - yTop;
    if (h < 18) return '';
    const yMid = (yTop + yBot) / 2;
    const xArm = xBase + (xTip - xBase) * 0.52;
    const r = Math.min(11, h * 0.16, (xArm - xBase) * 0.9);
    const d = [
      `M ${xBase.toFixed(1)} ${yTop.toFixed(1)}`,
      `Q ${xArm.toFixed(1)} ${yTop.toFixed(1)} ${xArm.toFixed(1)} ${(yTop + r).toFixed(1)}`,
      `L ${xArm.toFixed(1)} ${(yMid - r).toFixed(1)}`,
      `Q ${xArm.toFixed(1)} ${yMid.toFixed(1)} ${xTip.toFixed(1)} ${yMid.toFixed(1)}`,
      `Q ${xArm.toFixed(1)} ${yMid.toFixed(1)} ${xArm.toFixed(1)} ${(yMid + r).toFixed(1)}`,
      `L ${xArm.toFixed(1)} ${(yBot - r).toFixed(1)}`,
      `Q ${xArm.toFixed(1)} ${yBot.toFixed(1)} ${xBase.toFixed(1)} ${yBot.toFixed(1)}`
    ].join(' ');
    return `<path class="is-summary-brace" d="${d}" />`;
  }

  function makeLeftSpine(anchors, radius) {
    if (anchors.length < 2) return '';
    const xSpine = Math.min(...anchors.map(a => a.x)) - 16;
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    const rT = Math.min(radius, (last.y - first.y) * 0.2, 10);
    const out = [
      `<path class="is-spine" d="M ${first.x.toFixed(1)} ${first.y.toFixed(1)} L ${(xSpine + rT).toFixed(1)} ${first.y.toFixed(1)} Q ${xSpine.toFixed(1)} ${first.y.toFixed(1)} ${xSpine.toFixed(1)} ${(first.y + rT).toFixed(1)} L ${xSpine.toFixed(1)} ${(last.y - rT).toFixed(1)} Q ${xSpine.toFixed(1)} ${last.y.toFixed(1)} ${(xSpine + rT).toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}" />`
    ];
    for (let i = 1; i < anchors.length - 1; i++) {
      const c = anchors[i];
      out.push(`<path class="is-spine" d="M ${xSpine.toFixed(1)} ${c.y.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}" />`);
    }
    return out.join('');
  }

  function drawAllBrackets() {
    const board = document.getElementById('board');
    const svg = document.getElementById('tree-svg');
    if (!board || !svg) return;

    const w = board.scrollWidth;
    const h = board.scrollHeight;
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const bRect = board.getBoundingClientRect();
    const box = el => {
      const r = el.getBoundingClientRect();
      return {
        x: (r.left - bRect.left) / zoom,
        right: (r.right - bRect.left) / zoom,
        top: (r.top - bRect.top) / zoom,
        bottom: (r.bottom - bRect.top) / zoom,
        y: (r.top + r.height / 2 - bRect.top) / zoom
      };
    };

    const paths = [];
    const richVisual = IS_RICH && !skeletonMode;

    board.querySelectorAll('.t-node').forEach(nodeEl => {
      const chWrap = nodeEl.querySelector(':scope > .t-children');
      if (!chWrap) return;
      const pBtn = nodeEl.querySelector(':scope > button, :scope > .node-root, :scope > .node-root-rich');
      if (!pBtn) return;
      const leadEl = richVisual ? nodeEl.querySelector(':scope > .mm-lead-media') : null;
      const p = box(pBtn);
      const childEls = [...chWrap.querySelectorAll(':scope > .t-node > button, :scope > .t-node > .node-root, :scope > .t-node > .mm-fig, :scope > .t-node > .mm-table-card, :scope > .t-node > .mm-example-card')];
      const visibleChildren = childEls.filter(el => el.offsetParent !== null);
      if (!visibleChildren.length) return;

      const depth = Number(nodeEl.dataset.depth || 1);
      const cls = IS_RICH ? (depth === 0 ? 'is-rich-root' : 'is-rich-line') : (depth === 0 ? 'is-spine' : '');
      const childAnchors = visibleChildren.map(el => {
        const cb = box(el);
        return { x: cb.x, y: cb.y };
      });

      if (leadEl && leadEl.offsetParent !== null) {
        const lb = box(leadEl);
        paths.push(`<path class="${cls}" d="M ${p.right.toFixed(1)} ${p.y.toFixed(1)} L ${lb.x.toFixed(1)} ${lb.y.toFixed(1)}" />`);
        paths.push(makeBracketPath(lb.right, lb.y, childAnchors, 9, cls));
      } else {
        paths.push(makeBracketPath(p.right, p.y, childAnchors, depth === 0 ? 11 : 8, cls));
      }

      // Draw right-facing curly brace "}" toward .mm-summary
      if (richVisual) {
        const rightRail = nodeEl.querySelector(':scope > .mm-right-rail');
        const sumEl = rightRail ? rightRail.querySelector('[data-summary-target]') : null;
        if (sumEl && sumEl.offsetParent !== null) {
          const cb = box(chWrap);
          const sb = box(sumEl);
          const xBase = cb.right + 7;
          const xTip = sb.x - 5;
          if (xTip > xBase + 8) {
            paths.push(makeRightCurlyBrace(xBase, cb.top + 6, cb.bottom - 6, xTip));
          }
        }
      }
    });

    board.querySelectorAll('[data-spine-col]').forEach(colEl => {
      const l1Btns = [...colEl.querySelectorAll(':scope > .t-node > .node-branch')];
      const anchors = l1Btns.map(btn => {
        const b = box(btn);
        return { x: b.x, y: b.y };
      });
      paths.push(makeLeftSpine(anchors, 9));
    });

    svg.innerHTML = paths.join('');
  }

  function scheduleBrackets() {
    if (bracketRaf) return;
    bracketRaf = requestAnimationFrame(() => {
      bracketRaf = 0;
      drawAllBrackets();
    });
  }

  function applyTransform(redrawBrackets) {
    document.getElementById('z-val').textContent = `${Math.round(zoom * 100)}%`;
    if (USE_CSS_ZOOM) {
      world.style.left = '0px';
      world.style.top = '0px';
      world.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
      const board = document.getElementById('board');
      if (board) board.style.zoom = String(zoom);
    } else {
      world.style.left = '0px';
      world.style.top = '0px';
      world.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0) scale(${zoom})`;
    }
    if (redrawBrackets) scheduleBrackets();
  }

  function fitToViewport(skipBracketRedraw) {
    const board = document.getElementById('board');
    if (!board) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const bw = board.scrollWidth;
    const bh = board.scrollHeight;
    const topSafe = vw <= 760 ? 50 : 48;
    const botSafe = vw <= 760 ? 94 : 56;
    const padX = vw <= 760 ? 12 : 24;
    const availH = Math.max(200, vh - topSafe - botSafe);
    const fit = Math.min((vw - padX) / bw, availH / bh, 1.05);
    const minZ = IS_RICH ? 0.10 : 0.28;
    zoom = Math.max(minZ, Number(fit.toFixed(3)));
    tx = Math.max(8, (vw - bw * zoom) / 2);
    ty = topSafe + Math.max(0, (availH - bh * zoom) / 2);
    applyTransform(!skipBracketRedraw);
  }

  function offsetInBoard(el, board) {
    let x = 0, y = 0, cur = el;
    while (cur && cur !== board) {
      x += cur.offsetLeft;
      y += cur.offsetTop;
      cur = cur.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  // Comfortable initial reading view for infinite rich whiteboards (centers on target module or first module)
  function focusRichModule(modId, skipBracketRedraw) {
    const board = document.getElementById('board');
    if (!board) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const topSafe = vw <= 760 ? 92 : 94;
    const botSafe = vw <= 760 ? 104 : 62;
    const availH = Math.max(240, vh - topSafe - botSafe);

    if (modId === '__root__') {
      fitToViewport(skipBracketRedraw);
      document.querySelectorAll('.hud-mod-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.jumpMod === '__root__');
      });
      return;
    }

    const targetId = modId || (TREE[0] && TREE[0].id);
    const modEl = targetId ? board.querySelector(`[data-node-id="${targetId}"]`) : null;
    if (!modEl) {
      fitToViewport(skipBracketRedraw);
      return;
    }

    const m = offsetInBoard(modEl, board);
    const fitMod = Math.min((vw - 44) / Math.max(1, m.w), availH / Math.max(1, m.h));
    const minRead = vw <= 760 ? 0.45 : 0.64;
    const maxRead = vw <= 760 ? 0.72 : 0.86;
    zoom = Number(Math.max(minRead, Math.min(maxRead, fitMod)).toFixed(3));
    applyTransform(false);

    const mr = modEl.getBoundingClientRect();
    const targetLeft = vw <= 760 ? 12 : 24;
    const targetTop = topSafe + Math.max(0, (availH - mr.height) / 2);
    tx = Math.round(tx + (targetLeft - mr.left));
    ty = Math.round(ty + (targetTop - mr.top));
    applyTransform(!skipBracketRedraw);

    document.querySelectorAll('.hud-mod-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.jumpMod === targetId);
    });
  }

  function focusRichReadingView(skipBracketRedraw) {
    focusRichModule(TREE[0] && TREE[0].id, skipBracketRedraw);
  }

  function zoomAtPoint(nextZoom, clientX, clientY) {
    const minZ = IS_RICH ? 0.10 : 0.25;
    const maxZ = IS_RICH ? 2.5 : 2.2;
    const clamped = Math.max(minZ, Math.min(maxZ, Number(nextZoom.toFixed(3))));
    const ratio = clamped / zoom;
    tx = clientX - (clientX - tx) * ratio;
    ty = clientY - (clientY - ty) * ratio;
    zoom = clamped;
    applyTransform(true);
  }

  function updateHudStats() {
    document.getElementById('st-m').textContent = state.mastered.size;
    document.getElementById('st-total').textContent = ALL_LEAVES.length;
    document.getElementById('st-s').textContent = state.stuck.size;
    const allL1Collapsed = TREE.every(m => collapsed.has(m.id));
    const allL2Collapsed = !allL1Collapsed && TREE.every(m => (m.children || []).every(g => !(g.children && g.children.length) || collapsed.has(g.id)));
    document.getElementById('btn-collapse').textContent = allL1Collapsed ? '全部展开' : allL2Collapsed ? '折叠到一级' : '折叠到二级';
    const layoutBtn = document.getElementById('btn-layout');
    if (layoutBtn) layoutBtn.textContent = layoutMode === 'dual' ? '切单树' : '双栏全览';
    const skelBtn = document.getElementById('btn-skeleton');
    if (skelBtn) {
      skelBtn.textContent = skeletonMode ? '图文强化' : '极简骨架';
      skelBtn.setAttribute('aria-pressed', String(skeletonMode));
    }
    const examsBtn = document.getElementById('btn-exams');
    if (examsBtn) {
      examsBtn.setAttribute('aria-pressed', String(showExams));
      examsBtn.style.display = skeletonMode ? 'none' : '';
    }
    document.body.classList.toggle('mode-skeleton', skeletonMode);
    document.body.classList.toggle('hide-exams', !showExams);
    document.getElementById('btn-red').setAttribute('aria-pressed', String(onlyRed));
    document.getElementById('btn-blur').setAttribute('aria-pressed', String(recallBlur));
    document.body.classList.toggle('recall-blur', recallBlur);
  }

  function expandAncestors(leafId) {
    const parents = LEAF_PARENTS.get(leafId) || [];
    parents.forEach(id => collapsed.delete(id));
  }

  function ensureLeafVisible(leafId, forceReadableZoom) {
    const el = world.querySelector(`[data-leaf="${leafId}"]`);
    if (!el) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const topSafe = vw <= 760 ? 54 : 52;
    const botSafe = vh - (vw <= 760 ? 96 : 58);
    const leftSafe = 28;
    const rightSafe = vw - 28;

    const r = el.getBoundingClientRect();
    const minReadable = vw <= 760 ? 0.72 : 0.76;
    const isClipped = r.left < leftSafe || r.right > rightSafe || r.top < topSafe || r.bottom > botSafe;

    if (isClipped || (forceReadableZoom && zoom < minReadable)) {
      const nextZoom = forceReadableZoom ? Math.max(zoom, vw <= 760 ? 0.85 : 0.86) : zoom;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const wx = (cx - tx) / zoom;
      const wy = (cy - ty) / zoom;
      const centerY = topSafe + (botSafe - topSafe) / 2;
      zoom = nextZoom;
      tx = vw / 2 - wx * zoom;
      ty = centerY - wy * zoom;
      applyTransform();
      drawAllBrackets();
    }
  }

  function cycleLeafMark(leafId) {
    if (state.mastered.has(leafId)) {
      state.mastered.delete(leafId);
      state.stuck.add(leafId);
      showToast('已标记为：仍卡壳');
    } else if (state.stuck.has(leafId)) {
      state.stuck.delete(leafId);
      showToast('已清除标记');
    } else {
      state.mastered.add(leafId);
      state.stuck.delete(leafId);
      showToast('已标记为：已掌握');
    }
    saveState();
    renderTree();
  }

  function jumpToOriginalNote(href, nodeId, label) {
    try {
      sessionStorage.setItem(RETURN_KEY, JSON.stringify({
        layoutMode,
        skeletonMode,
        showExams,
        zoom,
        tx,
        ty,
        collapsed: [...collapsed],
        onlyRed,
        recallBlur,
        focusId: nodeId || '',
        vw: vp.clientWidth,
        vh: vp.clientHeight,
        ts: Date.now()
      }));
    } catch {}

    const hashIdx = href.indexOf('#');
    const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
    const hash = hashIdx >= 0 ? href.slice(hashIdx + 1) : '';
    const qs = `from=${encodeURIComponent(cfg.pageFile)}&node=${encodeURIComponent(nodeId || '')}&label=${encodeURIComponent(label || cfg.title)}`;
    const sep = base.includes('?') ? '&' : '?';
    window.location.href = `${base}${sep}${qs}${hash ? '#' + hash : ''}`;
  }

  function clearReturnedHighlight() {
    if (!returnedLeafId) return;
    returnedLeafId = null;
    renderTree();
  }

  function initOrRestore(isBackRestore) {
    state = loadState();
    const params = new URLSearchParams(location.search);
    const queryFocus = params.get('focus');

    let saved = null;
    try {
      const raw = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null');
      if (raw && Date.now() - Number(raw.ts || 0) < 6 * 3600 * 1000) {
        saved = raw;
      }
    } catch {}

    const navEntry = performance.getEntriesByType?.('navigation')?.[0];
    const isBackNav = isBackRestore || navEntry?.type === 'back_forward';
    const targetFocus = (queryFocus && LEAF_MAP.has(queryFocus))
      ? queryFocus
      : (isBackNav && saved && LEAF_MAP.has(saved.focusId) ? saved.focusId : null);

    if (targetFocus) {
      if (saved && (saved.focusId === targetFocus || isBackNav)) {
        if (!IS_RICH) layoutMode = saved.layoutMode === 'single' ? 'single' : 'dual';
        if (IS_RICH) {
          skeletonMode = !!saved.skeletonMode;
          showExams = saved.showExams !== false;
        }
        onlyRed = !!saved.onlyRed;
        recallBlur = !!saved.recallBlur;
        collapsed = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
      }
      expandAncestors(targetFocus);
      returnedLeafId = targetFocus;
      revealed.add(targetFocus);
      renderTree(true);

      const sameViewport = saved
        && Number.isFinite(saved.zoom)
        && Number.isFinite(saved.tx)
        && Number.isFinite(saved.ty)
        && Math.abs((saved.vw || 0) - vp.clientWidth) < 40
        && Math.abs((saved.vh || 0) - vp.clientHeight) < 40;

      if (sameViewport) {
        zoom = saved.zoom;
        tx = saved.tx;
        ty = saved.ty;
        applyTransform();
        drawAllBrackets();
        ensureLeafVisible(targetFocus, false);
      } else {
        if (IS_RICH && !skeletonMode) focusRichReadingView(true);
        else fitToViewport(true);
        drawAllBrackets();
        ensureLeafVisible(targetFocus, true);
      }

      if (queryFocus) {
        try {
          const u = new URL(location.href);
          u.searchParams.delete('focus');
          history.replaceState(null, '', u.pathname + u.search + u.hash);
        } catch {}
      }
      return;
    }

    renderTree(true);
    if (IS_RICH && !skeletonMode) focusRichReadingView(false);
    else fitToViewport(false);
  }

  // Pan & Zoom (allows grabbing anywhere inside canvas; suppresses click if dragged > 4px)
  let drag = null;
  let suppressClickUntil = 0;
  vp.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('a, input, summary')) return;
    drag = { sx: e.clientX, sy: e.clientY, tx0: tx, ty0: ty, moved: false };
    vp.classList.add('grabbing');
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    tx = drag.tx0 + dx;
    ty = drag.ty0 + dy;
    applyTransform();
  });
  window.addEventListener('mouseup', e => {
    if (!drag) return;
    const didMove = drag.moved;
    const wasBlankClick = !didMove && !e.target.closest('button, a, summary, .mm-fig');
    drag = null;
    vp.classList.remove('grabbing');
    if (didMove) suppressClickUntil = Date.now() + 120;
    if (wasBlankClick) clearReturnedHighlight();
  });
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAtPoint(zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY);
  }, { passive: false });

  let touchState = null;
  vp.addEventListener('touchstart', e => {
    if (e.target.closest('button, a, summary')) return;
    if (e.touches.length === 1) {
      touchState = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, tx0: tx, ty0: ty };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState = {
        mode: 'pinch',
        dist: Math.hypot(dx, dy),
        zoom0: zoom,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
    }
  }, { passive: true });
  vp.addEventListener('touchmove', e => {
    if (!touchState) return;
    if (touchState.mode === 'pan' && e.touches.length === 1) {
      tx = touchState.tx0 + (e.touches[0].clientX - touchState.x);
      ty = touchState.ty0 + (e.touches[0].clientY - touchState.y);
      applyTransform();
    } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      if (touchState.dist > 10) zoomAtPoint(touchState.zoom0 * (d / touchState.dist), touchState.cx, touchState.cy);
    }
  }, { passive: true });
  vp.addEventListener('touchend', () => { touchState = null; });

  // Redraw SVG brackets whenever an exam answer <details> toggles height
  world.addEventListener('toggle', () => scheduleBrackets(), true);

  world.addEventListener('click', e => {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const fig = e.target.closest('[data-lightbox]');
    if (fig) {
      openLightbox(fig.dataset.lightbox, fig.dataset.cap);
      return;
    }

    const examJump = e.target.closest('[data-exam-jump]');
    if (examJump) {
      jumpToOriginalNote(examJump.dataset.examJump, examJump.dataset.examNode, examJump.dataset.examLabel);
      return;
    }

    const leafBtn = e.target.closest('[data-leaf]');
    if (leafBtn) {
      const leafId = leafBtn.dataset.leaf;
      const leaf = LEAF_MAP.get(leafId);
      if (!leaf) return;

      if (e.shiftKey) {
        cycleLeafMark(leafId);
        return;
      }

      if (recallBlur && !revealed.has(leafId)) {
        revealed.add(leafId);
        renderTree();
        showToast('已揭晓，再点一次跳转原笔记 ↗');
        return;
      }

      jumpToOriginalNote(leaf.href, leaf.id, leaf.bold);
      return;
    }

    const brBtn = e.target.closest('[data-branch]');
    if (brBtn) {
      const id = brBtn.dataset.branch;
      if (collapsed.has(id)) collapsed.delete(id);
      else collapsed.add(id);
      renderTree();
    }
  });

  world.addEventListener('contextmenu', e => {
    const leafBtn = e.target.closest('[data-leaf]');
    if (!leafBtn) return;
    e.preventDefault();
    cycleLeafMark(leafBtn.dataset.leaf);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!lbEl.hidden) closeLightbox();
      toggleThemePop(false);
      clearReturnedHighlight();
    }
  });

  const btnLayout = document.getElementById('btn-layout');
  if (btnLayout) {
    btnLayout.addEventListener('click', () => {
      layoutMode = layoutMode === 'dual' ? 'single' : 'dual';
      renderTree();
      requestAnimationFrame(() => fitToViewport(false));
    });
  }

  const btnSkeleton = document.getElementById('btn-skeleton');
  if (btnSkeleton) {
    btnSkeleton.addEventListener('click', () => {
      skeletonMode = !skeletonMode;
      renderTree(true);
      requestAnimationFrame(() => {
        if (skeletonMode) fitToViewport(false);
        else focusRichReadingView(false);
      });
      showToast(skeletonMode ? '已切至：极简一屏骨架' : '已切至：图文强化白板');
    });
  }

  const btnExams = document.getElementById('btn-exams');
  if (btnExams) {
    btnExams.addEventListener('click', () => {
      showExams = !showExams;
      updateHudStats();
      scheduleBrackets();
      showToast(showExams ? '已展开右侧 408 真题卡' : '已隐藏真题卡');
    });
  }

  const hudMods = document.getElementById('hud-modules');
  if (hudMods) {
    hudMods.addEventListener('click', e => {
      const btn = e.target.closest('[data-jump-mod]');
      if (!btn) return;
      const id = btn.dataset.jumpMod;
      if (id !== '__root__' && collapsed.has(id)) {
        collapsed.delete(id);
        renderTree(true);
      }
      focusRichModule(id, false);
    });
  }

  const btnReadView = document.getElementById('btn-readview');
  if (btnReadView) {
    btnReadView.addEventListener('click', () => {
      if (skeletonMode) {
        skeletonMode = false;
        renderTree(true);
      }
      focusRichReadingView(false);
    });
  }

  document.getElementById('btn-zin').addEventListener('click', () => {
    zoomAtPoint(zoom * 1.15, vp.clientWidth / 2, vp.clientHeight / 2);
  });
  document.getElementById('btn-zout').addEventListener('click', () => {
    zoomAtPoint(zoom * 0.87, vp.clientWidth / 2, vp.clientHeight / 2);
  });
  document.getElementById('btn-fit').addEventListener('click', () => fitToViewport(false));
  document.getElementById('btn-print').addEventListener('click', () => { window.print(); });
  document.getElementById('btn-red').addEventListener('click', () => { onlyRed = !onlyRed; renderTree(); });
  document.getElementById('btn-blur').addEventListener('click', () => {
    recallBlur = !recallBlur;
    if (!recallBlur) revealed.clear();
    updateHudStats();
    renderTree();
  });
  document.getElementById('btn-collapse').addEventListener('click', () => {
    const allL1Collapsed = TREE.every(m => collapsed.has(m.id));
    const allL2Collapsed = !allL1Collapsed && TREE.every(m => (m.children || []).every(g => !(g.children && g.children.length) || collapsed.has(g.id)));
    if (allL1Collapsed) {
      collapsed.clear();
    } else if (allL2Collapsed) {
      TREE.forEach(m => collapsed.add(m.id));
    } else {
      TREE.forEach(m => {
        collapsed.delete(m.id);
        (m.children || []).forEach(g => collapsed.add(g.id));
      });
    }
    renderTree();
    requestAnimationFrame(() => {
      if (IS_RICH && !skeletonMode && !allL1Collapsed) fitToViewport(false);
      else if (IS_RICH && !skeletonMode) focusRichReadingView(false);
      else fitToViewport(false);
    });
  });
  document.getElementById('search-box').addEventListener('input', e => {
    searchText = e.target.value;
    if (searchText.trim()) collapsed.clear();
    renderTree();
  });

  window.addEventListener('resize', () => {
    if (IS_RICH && !skeletonMode) scheduleBrackets();
    else fitToViewport(false);
  });
  window.addEventListener('storage', e => {
    if (e.key === PREFS_KEY) applyStoredPrefs();
  });
  window.addEventListener('pageshow', e => {
    applyStoredPrefs();
    if (e.persisted) initOrRestore(true);
  });

  applyStoredPrefs();
  initOrRestore(false);
})();
