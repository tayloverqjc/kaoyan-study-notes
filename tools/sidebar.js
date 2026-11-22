(() => {
  'use strict';
  const sidebar = document.querySelector('.sidebar');
  const heading = document.querySelector('.sidebar-heading');
  const topbar = document.querySelector('.topbar');
  const location = document.querySelector('.current-location');
  if (!sidebar || !heading || !topbar || !location) return;

  const preferenceKey = 'personal-notes-sidebar-collapsed';
  const icon = direction => `<svg class="icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="${direction === 'left' ? 'm16 9-3 3 3 3' : 'm13 9 3 3-3 3'}"/></svg>`;
  sidebar.id = 'side-navigation';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'sidebar-toggle sidebar-collapse';
  close.setAttribute('aria-controls', sidebar.id);
  close.setAttribute('aria-label', '收起左侧目录');
  close.title = '收起目录';
  close.innerHTML = icon('left');
  heading.append(close);

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'sidebar-toggle sidebar-restore';
  open.setAttribute('aria-controls', sidebar.id);
  open.setAttribute('aria-label', '展开左侧目录');
  open.title = '展开目录';
  open.innerHTML = icon('right');
  topbar.insertBefore(open, location);

  const setCollapsed = (collapsed, save) => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    close.setAttribute('aria-expanded', String(!collapsed));
    open.setAttribute('aria-expanded', String(!collapsed));
    if (save) { try { localStorage.setItem(preferenceKey, collapsed ? '1' : '0'); } catch {} }
  };
  let collapsed = false;
  try { collapsed = localStorage.getItem(preferenceKey) === '1'; } catch {}
  setCollapsed(collapsed, false);
  close.addEventListener('click', () => { setCollapsed(true, true); open.focus({ preventScroll: true }); });
  open.addEventListener('click', () => { setCollapsed(false, true); close.focus({ preventScroll: true }); });
})();
