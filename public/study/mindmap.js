(() => {
  'use strict';

  const cfg = window.MINDMAP_CONFIG;
  if (!cfg || !Array.isArray(cfg.tree)) return;

  const PREFS_KEY = 'personal-notes-reader-prefs';
  const STORAGE_KEY = cfg.storageKey || `notes-network-ch${cfg.chapter}-mindmap-v1`;
  const RETURN_KEY = `mm-return-state:${cfg.pageFile}`;
  const DAY_THEMES = ['paper', 'focus', 'mono', 'glass', 'momo', 'light'];
  const THEME_COLORS = {
    paper: '#f5f3ed',
    focus: '#f4f1ea',
    mono: '#ffffff',
    glass: '#0d141e',
    momo: '#f1f6f5',
    light: '#ffffff',
    dark: '#17211b'
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

  // Build full-screen viewport and minimal HUD shells
  const chapterLinksHtml = CHAPTERS.length ? `
    <span class="hud-sep"></span>
    <nav class="hud-chapters" aria-label="切换章节导图">
      ${CHAPTERS.map(ch => `<a class="hud-ch" href="${esc(ch.href)}" title="${esc(ch.title)}"${ch.num === cfg.chapter ? ' aria-current="page"' : ''}>${esc(ch.label)}</a>`).join('')}
    </nav>` : '';

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

    <div class="hud-br">
      <span class="hud-stat">掌握 <b id="st-m">0</b>/<span id="st-total">0</span> · 卡壳 <span class="stuck-n" id="st-s">0</span></span>
      <span class="hud-sep"></span>
      <input type="search" class="hud-search" id="search-box" placeholder="搜考点/年份…" aria-label="搜索导图">
      <button type="button" class="hud-btn" id="btn-layout" title="切换双栏全览或单树">切单树</button>
      <button type="button" class="hud-btn" id="btn-red" aria-pressed="false" title="只高亮真题与错题红线">仅红线</button>
      <button type="button" class="hud-btn" id="btn-blur" aria-pressed="false" title="只留加粗主语，遮住后面结论；第1次点揭晓，第2次点跳原笔记">遮罩自测</button>
      <button type="button" class="hud-btn" id="btn-collapse">折叠到二级</button>
      <span class="hud-sep"></span>
      <button type="button" class="hud-btn" id="btn-zout" title="缩小">−</button>
      <span class="zoom-readout" id="z-val">100%</span>
      <button type="button" class="hud-btn" id="btn-zin" title="放大">＋</button>
      <button type="button" class="hud-btn" id="btn-fit" title="整章全览">全览</button>
      <button type="button" class="hud-btn" id="btn-print" title="打印或另存为 PDF">导出PDF</button>
      <button type="button" class="hud-btn" id="btn-theme">夜读</button>
    </div>

    <div class="mm-toast" id="mm-toast" role="status" aria-live="polite" hidden></div>
  `;

  let state = loadState();
  let collapsed = new Set();
  let revealed = new Set();
  let layoutMode = 'dual';
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

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => { toastEl.hidden = true; }, 1900);
  }

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

  function syncTheme() {
    const t = document.documentElement.dataset.theme || 'paper';
    document.getElementById('btn-theme').textContent = t === 'dark' ? '日间' : '夜读';
    const mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = THEME_COLORS[t] || '#f5f3ed';
  }

  document.getElementById('btn-theme').addEventListener('click', () => {
    const prefs = readPrefs();
    const cur = document.documentElement.dataset.theme || 'paper';
    const next = cur === 'dark' ? (DAY_THEMES.includes(prefs.dayTheme) ? prefs.dayTheme : 'paper') : 'dark';
    if (cur !== 'dark' && DAY_THEMES.includes(cur)) prefs.dayTheme = cur;
    prefs.theme = next;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
    document.documentElement.dataset.theme = next;
    syncTheme();
  });

  function countLeaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  }

  function renderNode(node, depth) {
    if (node.children && node.children.length) {
      const isCol = collapsed.has(node.id);
      const childGapCls = `gap-${Math.min(depth, 3)}`;
      return `
        <div class="t-node" data-depth="${depth}">
          <button type="button" class="node-branch depth-${depth}" data-branch="${esc(node.id)}" title="点击展开/收起">
            <span>${esc(node.title)}</span>
            ${isCol ? `<span class="branch-badge">+${countLeaves(node)}</span>` : ''}
          </button>
          ${isCol ? '' : `<div class="t-children ${childGapCls}">${node.children.map(c => renderNode(c, depth + 1)).join('')}</div>`}
        </div>
      `;
    }

    const q = searchText.trim().toLowerCase();
    const isM = state.mastered.has(node.id);
    const isS = state.stuck.has(node.id);
    const hay = `${node.bold} ${node.text} ${node.tag} ${node.crumbs || ''} ${node.kw || ''}`.toLowerCase();
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

    return `
      <div class="t-node" data-depth="${depth}">
        <button type="button" class="${cls}" data-leaf="${esc(node.id)}" title="点击跳转原笔记对应小节（右键标记掌握/卡壳）">
          ${dot}<span class="leaf-copy"><strong>${esc(node.bold)}</strong><span class="leaf-plain">：${esc(node.text)}</span></span><span class="leaf-tag ${node.red ? 'is-red' : ''}">（${esc(node.tag)}）</span><span class="leaf-jump" aria-hidden="true">↗</span>
        </button>
      </div>
    `;
  }

  function renderTree(syncBracketsNow) {
    if (layoutMode === 'dual') {
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
    if (syncBracketsNow) drawAllBrackets();
    else requestAnimationFrame(drawAllBrackets);
  }

  function makeBracketPath(px, py, anchors, radius, isSpine) {
    if (!anchors.length) return '';
    const minX = Math.min(...anchors.map(a => a.x));
    const xMid = px + Math.max(10, (minX - px) * 0.45);
    const cls = isSpine ? ' class="is-spine"' : '';
    const out = [`<path${cls} d="M ${px.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${py.toFixed(1)}" />`];

    if (anchors.length === 1) {
      const c = anchors[0];
      if (Math.abs(c.y - py) < 1.5) {
        out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}" />`);
      } else {
        const dir = c.y > py ? 1 : -1;
        const r = Math.min(radius, Math.abs(c.y - py) / 2, (c.x - xMid) * 0.45);
        out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${(c.y - dir * r).toFixed(1)} Q ${xMid.toFixed(1)} ${c.y.toFixed(1)} ${(xMid + r).toFixed(1)} ${c.y.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}" />`);
      }
      return out.join('');
    }

    const first = anchors[0];
    const last = anchors[anchors.length - 1];

    if (first.y < py - 1) {
      const rT = Math.min(radius, (py - first.y) * 0.48, (first.x - xMid) * 0.48);
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${py.toFixed(1)} L ${xMid.toFixed(1)} ${(first.y + rT).toFixed(1)} Q ${xMid.toFixed(1)} ${first.y.toFixed(1)} ${(xMid + rT).toFixed(1)} ${first.y.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}" />`);
    } else {
      out.push(`<path${cls} d="M ${xMid.toFixed(1)} ${first.y.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}" />`);
    }

    if (last.y > py + 1) {
      const rB = Math.min(radius, (last.y - py) * 0.48, (last.x - xMid) * 0.48);
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
        y: (r.top + r.height / 2 - bRect.top) / zoom
      };
    };

    const paths = [];

    board.querySelectorAll('.t-node').forEach(nodeEl => {
      const chWrap = nodeEl.querySelector(':scope > .t-children');
      if (!chWrap) return;
      const pBtn = nodeEl.querySelector(':scope > button, :scope > .node-root');
      if (!pBtn) return;
      const p = box(pBtn);
      const childBtns = [...chWrap.querySelectorAll(':scope > .t-node > button, :scope > .t-node > .node-root')];
      if (!childBtns.length) return;
      const depth = Number(nodeEl.dataset.depth || 1);
      const childAnchors = childBtns.map(btn => {
        const cb = box(btn);
        return { x: cb.x, y: cb.y };
      });
      paths.push(makeBracketPath(p.right, p.y, childAnchors, depth === 0 ? 10 : 7, depth === 0));
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

  function applyTransform() {
    world.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${zoom})`;
    document.getElementById('z-val').textContent = `${Math.round(zoom * 100)}%`;
  }

  function fitToViewport(skipBracketRedraw) {
    const board = document.getElementById('board');
    if (!board) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const bw = board.scrollWidth;
    const bh = board.scrollHeight;
    const topSafe = vw <= 760 ? 50 : 44;
    const botSafe = vw <= 760 ? 94 : 52;
    const padX = vw <= 760 ? 10 : 20;
    const availH = Math.max(200, vh - topSafe - botSafe);
    const fit = Math.min((vw - padX) / bw, availH / bh, 1.05);
    zoom = Math.max(0.28, Number(fit.toFixed(3)));
    tx = Math.max(6, (vw - bw * zoom) / 2);
    ty = topSafe + Math.max(0, (availH - bh * zoom) / 2);
    applyTransform();
    if (!skipBracketRedraw) requestAnimationFrame(drawAllBrackets);
  }

  function zoomAtPoint(nextZoom, clientX, clientY) {
    const clamped = Math.max(0.25, Math.min(2.2, Number(nextZoom.toFixed(3))));
    const ratio = clamped / zoom;
    tx = clientX - (clientX - tx) * ratio;
    ty = clientY - (clientY - ty) * ratio;
    zoom = clamped;
    applyTransform();
  }

  function updateHudStats() {
    document.getElementById('st-m').textContent = state.mastered.size;
    document.getElementById('st-total').textContent = ALL_LEAVES.length;
    document.getElementById('st-s').textContent = state.stuck.size;
    const allL1Collapsed = TREE.every(m => collapsed.has(m.id));
    const allL2Collapsed = !allL1Collapsed && TREE.every(m => (m.children || []).every(g => !(g.children && g.children.length) || collapsed.has(g.id)));
    document.getElementById('btn-collapse').textContent = allL1Collapsed ? '全部展开' : allL2Collapsed ? '折叠到一节' : '折叠到二级';
    document.getElementById('btn-layout').textContent = layoutMode === 'dual' ? '切单树' : '双栏全览';
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
    const minReadable = vw <= 760 ? 0.88 : 0.72;
    const isClipped = r.left < leftSafe || r.right > rightSafe || r.top < topSafe || r.bottom > botSafe;

    if (isClipped || (forceReadableZoom && zoom < minReadable)) {
      const nextZoom = forceReadableZoom ? Math.max(zoom, vw <= 760 ? 0.92 : 0.84) : zoom;
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

  function jumpToOriginalNote(leaf) {
    try {
      sessionStorage.setItem(RETURN_KEY, JSON.stringify({
        layoutMode,
        zoom,
        tx,
        ty,
        collapsed: [...collapsed],
        onlyRed,
        recallBlur,
        focusId: leaf.id,
        vw: vp.clientWidth,
        vh: vp.clientHeight,
        ts: Date.now()
      }));
    } catch {}

    const hashIdx = leaf.href.indexOf('#');
    const base = hashIdx >= 0 ? leaf.href.slice(0, hashIdx) : leaf.href;
    const hash = hashIdx >= 0 ? leaf.href.slice(hashIdx + 1) : '';
    const qs = `from=${encodeURIComponent(cfg.pageFile)}&node=${encodeURIComponent(leaf.id)}&label=${encodeURIComponent(leaf.bold)}`;
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
      if (raw && raw.focusId && Date.now() - Number(raw.ts || 0) < 6 * 3600 * 1000) {
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
        layoutMode = saved.layoutMode === 'single' ? 'single' : 'dual';
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
        fitToViewport(true);
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
    fitToViewport(false);
  }

  // Pan & Zoom
  let drag = null;
  vp.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('button, a, input')) return;
    drag = { sx: e.clientX, sy: e.clientY, tx0: tx, ty0: ty, moved: false };
    vp.classList.add('grabbing');
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    tx = drag.tx0 + dx;
    ty = drag.ty0 + dy;
    applyTransform();
  });
  window.addEventListener('mouseup', e => {
    if (!drag) return;
    const wasClick = !drag.moved && !e.target.closest('button, a');
    drag = null;
    vp.classList.remove('grabbing');
    if (wasClick) clearReturnedHighlight();
  });
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAtPoint(zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY);
  }, { passive: false });

  let touchState = null;
  vp.addEventListener('touchstart', e => {
    if (e.target.closest('button, a')) return;
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

  world.addEventListener('click', e => {
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

      jumpToOriginalNote(leaf);
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
    if (e.key === 'Escape') clearReturnedHighlight();
  });

  document.getElementById('btn-layout').addEventListener('click', () => {
    layoutMode = layoutMode === 'dual' ? 'single' : 'dual';
    renderTree();
    requestAnimationFrame(() => fitToViewport(false));
  });
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
    requestAnimationFrame(() => fitToViewport(false));
  });
  document.getElementById('search-box').addEventListener('input', e => {
    searchText = e.target.value;
    if (searchText.trim()) collapsed.clear();
    renderTree();
  });

  window.addEventListener('resize', () => fitToViewport(false));
  window.addEventListener('pageshow', e => {
    if (e.persisted) initOrRestore(true);
  });

  syncTheme();
  initOrRestore(false);
})();
