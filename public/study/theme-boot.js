/* Pre-paint theme, wallpaper, font, and sidebar bootstrap for static GitHub Pages. */
(() => {
  'use strict';
  const ALL_THEMES = ['paper', 'focus', 'mono', 'glass', 'momo', 'light', 'dark'];
  const WALLPAPERS = ['lake', 'coast', 'forest'];
  const THEME_COLORS = {
    paper: '#f5f3ed',
    focus: '#f4f1ea',
    mono: '#ffffff',
    glass: '#0d141e',
    momo: '#f1f6f5',
    light: '#ffffff',
    dark: '#17211b'
  };
  function applyEarlyTheme() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem('personal-notes-reader-prefs') || '{}') || {}; } catch {}
    let t = ALL_THEMES.includes(p.theme) ? p.theme : '';
    if (!t) {
      try {
        const e = JSON.parse(localStorage.getItem('personal-study-english-v1') || 'null');
        if (e && e.theme === 'dark') t = 'dark';
      } catch {}
    }
    if (!t) t = 'paper';
    const w = WALLPAPERS.includes(p.wallpaper) ? p.wallpaper : 'lake';
    const root = document.documentElement;
    root.dataset.theme = t;
    root.dataset.wallpaper = w;
    if (Number.isFinite(p.font)) {
      root.style.setProperty('--body-size', Math.max(15, Math.min(24, p.font)) + 'px');
    }
    if (['1.7', '1.9', '2.1'].includes(String(p.line))) {
      root.style.setProperty('--body-line', String(p.line));
    }
    let collapsed = false;
    try { collapsed = localStorage.getItem('personal-notes-sidebar-collapsed') === '1'; } catch {}
    root.classList.toggle('sidebar-collapsed', collapsed);
    const mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = THEME_COLORS[t] || '#f5f3ed';
    if (t === 'glass' && document.head && !document.querySelector(`link[data-wp-preload="${w}"]`)) {
      const l = document.createElement('link');
      l.rel = 'preload';
      l.as = 'image';
      l.href = `./study/wallpapers/${w}.webp?v=2`;
      l.dataset.wpPreload = w;
      document.head.appendChild(l);
    }
  }
  applyEarlyTheme();
  document.addEventListener('DOMContentLoaded', applyEarlyTheme, { once: true });
})();
