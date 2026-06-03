(() => {
  const root = document.documentElement;
  const THEME_KEY = 'recup-docs-theme';
  const COLLAPSED_KEY = 'recup-docs-collapsed';
  const SIDEBAR_SCROLL_KEY = 'recup-docs-sidebar-scroll';

  // ---------- THEME ----------
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch {}
    if (saved === 'light' || saved === 'dark') return applyTheme(saved);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  function bindThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ---------- SIDEBAR (mobile + collapsible sections) ----------
  function bindSidebarToggle() {
    const btn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (!btn || !sidebar) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return;
      if (sidebar.contains(e.target) || btn.contains(e.target)) return;
      sidebar.classList.remove('open');
    });
  }

  function getCollapsed() {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function saveCollapsed(set) {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set])); } catch {}
  }

  function bindCollapsibleSections() {
    const collapsed = getCollapsed();
    document.querySelectorAll('.sidebar-section').forEach((section) => {
      const id = section.dataset.sectionId;
      if (collapsed.has(id)) section.classList.add('collapsed');
    });
    document.querySelectorAll('.sidebar-section-title').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.sidebar-section');
        const id = section.dataset.sectionId;
        const isOpen = !section.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', String(isOpen));
        const current = getCollapsed();
        if (isOpen) current.delete(id); else current.add(id);
        saveCollapsed(current);
      });
    });
  }

  // Persiste el scroll del sidebar entre navegaciones (multi-page reload).
  // sessionStorage para que dure mientras la pestaña esté abierta y se
  // resetee al cerrarla.
  function bindSidebarScrollMemory() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    try {
      const saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      if (saved) sidebar.scrollTop = parseInt(saved, 10) || 0;
    } catch {}

    let raf = 0;
    sidebar.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sidebar.scrollTop)); } catch {}
      });
    }, { passive: true });
  }

  function markActiveSidebar() {
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-link').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || a.classList.contains('disabled')) return;
      // Resolvemos el href contra location para tolerar `./flow-auth.html`,
      // `flow-auth.html` o rutas absolutas indistintamente.
      let target;
      try {
        target = new URL(href, location.href).pathname.split('/').pop() || 'index.html';
      } catch {
        target = href.split('#')[0].replace(/^\.\//, '') || 'index.html';
      }
      if (target === here) {
        a.classList.add('active');
        const section = a.closest('.sidebar-section');
        if (section && section.classList.contains('collapsed')) {
          section.classList.remove('collapsed');
          section.querySelector('.sidebar-section-title')?.setAttribute('aria-expanded', 'true');
        }
      }
    });
  }

  // ---------- TOC ----------
  // Resalta el link del TOC correspondiente al heading visible.
  // Sirve tanto para TOCs autogenerados (#toc-list) como para los hardcoded.
  function trackActiveTOC() {
    const aside = document.querySelector('.toc');
    if (!aside) return;
    const links = Array.from(aside.querySelectorAll('a[href^="#"]'));
    if (links.length === 0) return;

    const headings = links
      .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
          }
        });
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
  }

  function buildTOC() {
    const toc = document.getElementById('toc-list');
    if (toc) {
      const headings = document.querySelectorAll('.content h2[id], .content h3[id]');
      if (headings.length === 0) {
        const aside = toc.closest('.toc');
        if (aside) aside.style.display = 'none';
      } else {
        const frag = document.createDocumentFragment();
        headings.forEach((h) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = `#${h.id}`;
          a.textContent = h.textContent;
          if (h.tagName === 'H3') a.classList.add('toc-h3');
          li.appendChild(a);
          frag.appendChild(li);
        });
        toc.appendChild(frag);
      }
    }
    trackActiveTOC();
  }

  // ---------- SEARCH ----------
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Normaliza para búsqueda: lowercase + strip diacríticos (NFD).
  // "Telemetría" → "telemetria", "PROD" → "prod".
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Regex letra-a-letra que tolera acentos en el texto buscado.
  // Permite que `telemetria` resalte `telemetría` en los resultados.
  const ACCENT_CLASS = {
    a: '[aáàâäãå]',
    e: '[eéèêë]',
    i: '[iíìîï]',
    o: '[oóòôöõ]',
    u: '[uúùûü]',
    n: '[nñ]',
    c: '[cç]',
  };
  function accentInsensitivePattern(term) {
    return term
      .split('')
      .map((ch) => ACCENT_CLASS[ch] || escapeRe(ch))
      .join('');
  }

  function scoreEntry(entry, terms) {
    const title = norm(entry.title);
    const section = norm(entry.section);
    const keywords = norm(entry.keywords);
    const hay = `${title} ${section} ${keywords}`;
    let score = 0;
    for (const t of terms) {
      if (!t) continue;
      if (title.includes(t)) score += 6;
      if (section.includes(t)) score += 2;
      if (keywords.includes(t)) score += 1;
      if (!hay.includes(t)) return -1;
    }
    return score;
  }

  function highlight(text, terms) {
    let out = text;
    for (const t of terms) {
      if (!t) continue;
      out = out.replace(new RegExp(`(${accentInsensitivePattern(t)})`, 'ig'), '<mark>$1</mark>');
    }
    return out;
  }

  function renderResults(container, results, terms) {
    if (results.length === 0) {
      container.innerHTML = '<div class="search-empty">Sin resultados</div>';
      return;
    }
    container.innerHTML = results
      .map(
        (r, i) => `
        <a class="search-result${i === 0 ? ' selected' : ''}" href="${r.url}" data-idx="${i}">
          <div class="search-result-section">${r.section}</div>
          <div class="search-result-title">${highlight(r.title, terms)}</div>
        </a>
      `,
      )
      .join('');
  }

  function bindSearch() {
    const input = document.getElementById('search-input');
    const box = document.getElementById('search-results');
    if (!input || !box) return;
    const index = window.RECUP_SEARCH_INDEX || [];

    function close() { box.hidden = true; }
    function open() { box.hidden = false; }

    function run() {
      const q = norm(input.value.trim());
      if (!q) { close(); return; }
      const terms = q.split(/\s+/).filter(Boolean);
      const scored = index
        .map((e) => ({ e, s: scoreEntry(e, terms) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 30)
        .map((x) => x.e);
      renderResults(box, scored, terms);
      open();
    }

    input.addEventListener('input', run);
    input.addEventListener('focus', () => { if (input.value.trim()) open(); });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.topbar-search')) return;
      close();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === 'Escape' && document.activeElement === input) {
        input.blur(); close();
      }
    });

    input.addEventListener('keydown', (e) => {
      const items = Array.from(box.querySelectorAll('.search-result'));
      if (items.length === 0) return;
      const idx = items.findIndex((el) => el.classList.contains('selected'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[Math.min(idx + 1, items.length - 1)];
        items.forEach((el) => el.classList.remove('selected'));
        next.classList.add('selected');
        next.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[Math.max(idx - 1, 0)];
        items.forEach((el) => el.classList.remove('selected'));
        prev.classList.add('selected');
        prev.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        const target = items[idx] || items[0];
        if (target) {
          e.preventDefault();
          window.location.href = target.getAttribute('href');
        }
      }
    });
  }

  // Con `defer`, partials.js ya ha inyectado topbar/sidebar antes de que
  // este script corra. Ejecutamos sincronamente para que el primer paint
  // ya tenga el link activo, el TOC y los bindings.
  initTheme();
  bindThemeToggle();
  bindSidebarToggle();
  bindCollapsibleSections();
  markActiveSidebar();
  bindSidebarScrollMemory();
  buildTOC();
  bindSearch();
})();
