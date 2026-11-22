(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const key = 'os-reader-v1-ch' + document.body.dataset.chapter;
  const prefsKey = 'personal-notes-reader-prefs';
  let state = {};
  let globalPrefs = {};
  let storageAvailable = true;
  try { state = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { storageAvailable = false; }
  try { globalPrefs = JSON.parse(localStorage.getItem(prefsKey) || '{}') || {}; } catch {}
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { storageAvailable = false; } };
  const persistPrefs = () => {
    try { localStorage.setItem(prefsKey, JSON.stringify({ font: state.font, line: state.line, theme: state.theme, dayTheme: state.dayTheme, wallpaper: state.wallpaper })); } catch {}
    persist();
  };
  const toast = message => { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2400); };
  if (typeof state !== 'object' || Array.isArray(state)) state = {};
  if (typeof globalPrefs !== 'object' || Array.isArray(globalPrefs)) globalPrefs = {};
  const rawFont = Number.isFinite(globalPrefs.font) ? globalPrefs.font : state.font;
  const rawLine = globalPrefs.line ?? state.line;
  const rawTheme = globalPrefs.theme ?? state.theme;
  const rawDayTheme = globalPrefs.dayTheme ?? state.dayTheme;
  const rawWallpaper = globalPrefs.wallpaper ?? state.wallpaper;
  state.font = Number.isFinite(rawFont) ? Math.max(15, Math.min(24, rawFont)) : 18;
  state.line = ['1.7', '1.9', '2.1'].includes(String(rawLine)) ? String(rawLine) : '1.9';
  const allThemes = ['paper', 'focus', 'mono', 'glass', 'momo', 'light', 'dark'];
  const dayThemes = ['paper', 'focus', 'mono', 'glass', 'momo', 'light'];
  const wallpapers = ['lake', 'forest', 'coast'];
  const themeColors = { paper: '#f5f3ed', focus: '#f4f1ea', mono: '#ffffff', glass: '#0f1823', momo: '#f1f6f5', light: '#ffffff', dark: '#19211d' };
  state.theme = allThemes.includes(rawTheme) ? rawTheme : 'paper';
  state.wallpaper = wallpapers.includes(rawWallpaper) ? rawWallpaper : 'lake';
  if (dayThemes.includes(rawDayTheme)) state.dayTheme = rawDayTheme;
  const applyPrefs = () => {
    document.documentElement.style.setProperty('--body-size', `${state.font}px`);
    document.documentElement.style.setProperty('--body-line', state.line);
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.wallpaper = state.wallpaper;
    $('#font-value').textContent = state.font;
    $('#font-minus').disabled = state.font <= 15;
    $('#font-plus').disabled = state.font >= 24;
    $('#line-height').value = state.line;
    $('#theme-label').textContent = state.theme === 'dark' ? '日读' : '夜读';
    $('#theme-toggle').setAttribute('aria-pressed', String(state.theme === 'dark'));
    $$('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === state.theme)));
    $$('[data-wallpaper-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wallpaperChoice === state.wallpaper)));
    $('meta[name="theme-color"]').content = themeColors[state.theme] || '#f5f3ed';
  };
  applyPrefs();
  $('#font-minus').addEventListener('click', () => { state.font = Math.max(15, state.font - 1); applyPrefs(); persistPrefs(); });
  $('#font-plus').addEventListener('click', () => { state.font = Math.min(24, state.font + 1); applyPrefs(); persistPrefs(); });
  $('#line-height').addEventListener('change', event => { state.line = event.target.value; applyPrefs(); persistPrefs(); });
  $$('[data-theme-choice]').forEach(button => button.addEventListener('click', () => { state.theme = button.dataset.themeChoice; if (state.theme !== 'dark') state.dayTheme = state.theme; applyPrefs(); persistPrefs(); }));
  const wpNames = { lake: '雪山暮色', coast: '橘海落日', forest: '松林晨雾' };
  $$('[data-wallpaper-choice]').forEach(button => button.addEventListener('click', () => { state.wallpaper = button.dataset.wallpaperChoice; applyPrefs(); persistPrefs(); toast('已切换壁纸：' + (wpNames[state.wallpaper] || state.wallpaper)); }));
  $('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? (state.dayTheme || 'paper') : (state.dayTheme = state.theme, 'dark'); applyPrefs(); persistPrefs(); });
  if (!storageAvailable) $('.storage-note').textContent = '当前浏览器限制本地存储，本次阅读仍可调整偏好。';

  let dialogTrigger = null;
  const openDialog = (id, trigger) => {
    dialogTrigger = trigger || document.activeElement;
    const dialog = document.getElementById(id);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    if (id === 'search-dialog') setTimeout(() => { $('#search-input').focus(); ensureSearchIndex(); }, 30);
    if (id === 'toc-dialog') setTimeout(() => dialog.querySelector('.active')?.scrollIntoView({ block: 'center' }), 30);
  };
  const closeDialog = dialog => {
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    document.body.style.overflow = '';
  };
  $$('[data-open]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.open, button)));
  $$('dialog').forEach(dialog => {
    dialog.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDialog(dialog);
    });
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; dialogTrigger?.focus({ preventScroll: true }); });
  });
  const reveal = element => {
    let parent = element.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  };
  $$('.toc a,.chapter-end a,.brand,.skip-link').forEach(link => link.addEventListener('click', event => {
    const hash = link.getAttribute('href');
    if (!hash?.startsWith('#')) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const dialog = link.closest('dialog');
    if (dialog) closeDialog(dialog);
    reveal(target);
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    try { history.replaceState(null, '', hash); } catch {}
    updateProgress();
  }));
  $('#back-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'instant' }));

  const readableText = element => {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.math[data-tex]').forEach(node => node.replaceWith(' ' + (node.dataset.tex || '').trim() + ' '));
    return clone.textContent.replace(/\s+/g, ' ').trim();
  };
  const headings = $$('#article h1,#article h2,#article h3');
  const anchors = $$('.toc a');
  let currentHeading = null;
  let scrollFrame = 0;
  let saveTimer = 0;
  const oldPosition = state.position && document.getElementById(state.position.id) ? { ...state.position } : null;
  if (oldPosition && oldPosition.ratio > .005) {
    $('#resume-label').textContent = (readableText(document.getElementById(oldPosition.heading || oldPosition.id)) || '上次阅读的位置').slice(0, 65);
    $('#resume').hidden = false;
    $('#resume').addEventListener('click', () => {
      const target = document.getElementById(oldPosition.id);
      reveal(target);
      $('#resume').hidden = true;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + (Number.isFinite(oldPosition.offset) ? oldPosition.offset : -75), behavior: 'instant' });
      updateProgress();
    });
  }
  function readingPosition(ratio) {
    let nearest = currentHeading;
    for (const element of $$('#article [id]')) {
      if (element.getClientRects().length && element.getBoundingClientRect().top <= 110) nearest = element;
    }
    return { id: nearest.id, heading: currentHeading.id, offset: -nearest.getBoundingClientRect().top, ratio };
  }
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    $('#read-percent').textContent = Math.round(ratio * 100);
    $('#progress-fill').style.width = `${ratio * 100}%`;
    let active = headings[0];
    for (const heading of headings) { if (heading.getBoundingClientRect().top <= 110) active = heading; else break; }
    if (active !== currentHeading) {
      currentHeading = active;
      anchors.forEach(anchor => { const isActive = anchor.hash === `#${active.id}`; anchor.classList.toggle('active', isActive); if (isActive) anchor.setAttribute('aria-current', 'location'); else anchor.removeAttribute('aria-current'); });
    }
    const chapterLabel = document.body.dataset.chapterLabel || `第${document.body.dataset.chapter}章`;
    $('#current-section').textContent = window.scrollY < 250 ? `${chapterLabel} · ${document.querySelector('.hero h1').textContent}` : readableText(active);
    clearTimeout(saveTimer);
    if (window.scrollY > 250 && active) saveTimer = setTimeout(() => {
      state.position = readingPosition(ratio);
      persist();
    }, 350);
  }
  const dock = $('.reader-dock');
  let lastY = window.scrollY;
  let lastGestureAt = 0;
  const markGesture = () => { lastGestureAt = Date.now(); };
  window.addEventListener('touchmove', markGesture, { passive: true });
  window.addEventListener('wheel', markGesture, { passive: true });
  const showDock = () => dock?.classList.remove('dock-hidden');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (dock && Date.now() - lastGestureAt < 450 && !$$('dialog[open]').length) {
      const dy = y - lastY;
      if (y < 160 || max - y < 140 || dy < -10) showDock();
      else if (y > 200 && dy > 16) dock.classList.add('dock-hidden');
    } else if (y < 160 || max - y < 140) showDock();
    lastY = y;
    if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { updateProgress(); scrollFrame = 0; });
  }, { passive: true });
  $('#article').addEventListener('click', event => {
    if (!event.target.closest('a,button,summary,input,label,.image-button')) showDock();
  });
  window.addEventListener('resize', updateProgress);
  $('#article').addEventListener('toggle', updateProgress, true);
  window.addEventListener('pagehide', () => {
    if (currentHeading && window.scrollY > 250) { state.position = readingPosition(window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)); persist(); }
  });
  if (location.hash.length > 1) {
    const hashTarget = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (hashTarget) {
      reveal(hashTarget);
      requestAnimationFrame(() => { hashTarget.scrollIntoView({ behavior: 'instant', block: 'start' }); updateProgress(); });
    }
  }
  updateProgress();

  const checks = state.checks && typeof state.checks === 'object' ? state.checks : {};
  $$('[data-check]').forEach(input => {
    input.checked = !!checks[input.dataset.check];
    input.closest('li').classList.toggle('checked', input.checked);
    input.addEventListener('change', () => { checks[input.dataset.check] = input.checked; state.checks = checks; input.closest('li').classList.toggle('checked', input.checked); persist(); });
  });

  // Lazy-build search index so navigating large MathJax pages never deep-clones thousands of SVGs up front.
  let searchIndex = null;
  function ensureSearchIndex() {
    if (searchIndex) return searchIndex;
    let sectionLabel = '本章导读';
    searchIndex = [];
    $$('#article h1,#article h2,#article h3,#article h4,#article summary,#article p,#article td,#article li').forEach(element => {
      if (/^H[12]$/.test(element.tagName)) sectionLabel = readableText(element);
      if (element.tagName === 'LI' && element.querySelector('p,li')) return;
      const text = readableText(element);
      if (!text || element.closest('figure')) return;
      searchIndex.push({ element, text, lower: text.toLowerCase(), section: sectionLabel });
    });
    return searchIndex;
  }
  let searchTimer;
  function search() {
    const query = $('#search-input').value.trim();
    const results = $('#search-results');
    results.replaceChildren();
    if (!query) { $('#search-status').textContent = '搜索正文、表格与折叠内容'; return; }
    const lower = query.toLowerCase();
    const hits = ensureSearchIndex().filter(item => item.lower.includes(lower));
    $('#search-status').textContent = hits.length ? `找到 ${hits.length} 处${hits.length > 40 ? '，显示前 40 处' : ''}` : '没有找到，试试更短的关键词';
    hits.slice(0, 40).forEach(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'search-result';
      const section = document.createElement('small'); section.textContent = item.section; button.append(section);
      const start = Math.max(0, item.lower.indexOf(lower) - 28);
      const snippet = item.text.slice(start, start + 125);
      const at = snippet.toLowerCase().indexOf(lower);
      button.append(document.createTextNode((start ? '…' : '') + snippet.slice(0, at)));
      const mark = document.createElement('mark'); mark.textContent = snippet.slice(at, at + query.length); button.append(mark);
      button.append(document.createTextNode(snippet.slice(at + query.length) + (start + 125 < item.text.length ? '…' : '')));
      button.addEventListener('click', () => {
        closeDialog($('#search-dialog')); reveal(item.element);
        item.element.scrollIntoView({ block: 'center', behavior: 'instant' });
        $$('.search-target').forEach(element => element.classList.remove('search-target'));
        item.element.classList.add('search-target'); setTimeout(() => item.element.classList.remove('search-target'), 3500);
        updateProgress();
      });
      results.append(button);
    });
  }
  $('#search-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 130); });
  $('#search-input').addEventListener('keydown', event => { if (event.key === 'Enter') { clearTimeout(searchTimer); search(); $('#search-results button')?.focus(); } });

  let fitWidth = 0;
  let scale = 1;
  const zoomImage = $('#zoom-image');
  const imageViewport = $('#image-viewport');
  function fitImage() {
    scale = 1;
    zoomImage.style.maxWidth = '100%'; zoomImage.style.maxHeight = '100%'; zoomImage.style.width = 'auto';
    fitWidth = Math.min(imageViewport.clientWidth, imageViewport.clientHeight * zoomImage.naturalWidth / zoomImage.naturalHeight, zoomImage.naturalWidth);
    imageViewport.scrollTop = 0; imageViewport.scrollLeft = 0;
    $('#image-minus').disabled = true;
  }
  function zoom(next) {
    const previous = scale;
    scale = Math.max(1, Math.min(4, next));
    if (scale === 1) { fitImage(); return; }
    zoomImage.style.maxWidth = 'none'; zoomImage.style.maxHeight = 'none'; zoomImage.style.width = `${fitWidth * scale}px`;
    imageViewport.scrollLeft = (imageViewport.scrollLeft + imageViewport.clientWidth / 2) * scale / previous - imageViewport.clientWidth / 2;
    $('#image-minus').disabled = false;
    $('#image-plus').disabled = scale >= 4;
  }
  $$('.image-button').forEach(button => button.addEventListener('click', () => {
    const image = button.querySelector('img');
    $('#image-title').textContent = image.alt || '本章插图';
    zoomImage.alt = image.alt;
    zoomImage.onload = fitImage;
    zoomImage.src = image.src;
    openDialog('image-dialog', button);
    $('#image-plus').disabled = false;
    requestAnimationFrame(fitImage);
  }));
  $('#image-plus').addEventListener('click', () => zoom(scale * 1.6));
  $('#image-minus').addEventListener('click', () => zoom(scale / 1.6));
  $('#image-fit').addEventListener('click', () => { fitImage(); $('#image-plus').disabled = false; });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!$$('dialog[open]').length) openDialog('search-dialog'); }
  });
})();
