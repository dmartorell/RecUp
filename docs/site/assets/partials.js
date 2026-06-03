/**
 * Shared topbar + sidebar markup injected on every page.
 */
(() => {
  const TOPBAR = `
    <header class="topbar">
      <div class="topbar-brand">
        <button id="sidebar-toggle" class="icon-btn sidebar-toggle" aria-label="Abrir menú">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <a href="./index.html" class="brand-link">
          <img class="brand-logo" src="./assets/logo.png" alt="RecUp" />
          <span>RecUp Wiki</span>
        </a>
      </div>

      <div class="topbar-search">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="search-input"
            type="search"
            placeholder="Buscar en la documentación…"
            autocomplete="off"
            spellcheck="false"
            aria-label="Buscar"
          />
          <kbd class="search-kbd">⌘K</kbd>
        </div>
        <div id="search-results" class="search-results" hidden></div>
      </div>

      <div class="topbar-actions">
        <a class="icon-btn" href="https://github.com/dmartorell/RecUp" target="_blank" rel="noopener" aria-label="GitHub">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"/>
          </svg>
        </a>
        <button id="theme-toggle" class="icon-btn" aria-label="Cambiar tema">
          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
          <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>
    </header>
  `;

  const CHEVRON = `
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;

  const SIDEBAR_SECTIONS = [
    {
      id: 'intro',
      title: 'Inicio',
      items: [
        { label: 'Arquitectura general', href: './architecture.html' },
      ],
    },
    {
      id: 'flows',
      title: 'Flujos',
      items: [
        { label: 'Login y registro', href: './flow-auth.html' },
        { label: 'Grabación → bug report', href: './flow-recording.html' },
        { label: 'Integración IA (summarize)', href: './flow-summarize.html' },
        { label: 'Creación de ticket ClickUp', href: './flow-ticket.html' },
        { label: 'Chrome Extension ↔ Webapp', href: './flow-extension.html' },
      ],
    },
    {
      id: 'security',
      title: 'Seguridad',
      items: [
        { label: 'Token y JWT', href: './token.html' },
        { label: 'Cifrado de API keys', href: './security-encryption.html' },
        { label: 'Threat model y tradeoffs', href: './security-threat-model.html' },
      ],
    },
    {
      id: 'scalability',
      title: 'Escalabilidad',
      items: [
        { label: 'Límites actuales', href: './scalability.html' },
      ],
    },
    {
      id: 'ops',
      title: 'Operación',
      items: [
        { label: 'Despliegue (Render + secrets)', href: './ops-deployment.html' },
        { label: 'Monitorización (Sentry)', href: './monitoring.html' },
      ],
    },
    {
      id: 'reference',
      title: 'Referencia',
      items: [
        { label: 'Endpoints', href: './endpoints.html' },
        { label: 'Middlewares', href: './middlewares.html' },
        { label: 'Base de datos', href: './database.html' },
      ],
    },
  ];

  function renderSidebar() {
    return `
      <aside class="sidebar">
        ${SIDEBAR_SECTIONS.map(
          (s) => `
          <div class="sidebar-section" data-section-id="${s.id}">
            <button class="sidebar-section-title" data-toggle="${s.id}" aria-expanded="true">
              ${CHEVRON}
              <span>${s.title}</span>
            </button>
            <div class="sidebar-section-body">
              ${s.items
                .map(
                  (i) => `
                <a class="sidebar-link${i.disabled ? ' disabled' : ''}" href="${i.href}"
                   ${i.disabled ? 'aria-disabled="true" tabindex="-1"' : ''}>${i.label}</a>
              `,
                )
                .join('')}
            </div>
          </div>
        `,
        ).join('')}
      </aside>
    `;
  }

  // Ejecutado vía `defer`: el parser ya ha llegado a los slots cuando este
  // script corre, así que reemplazamos sincronamente sin esperar a DCL para
  // que el primer paint no sufra reflow.
  const topbarSlot = document.getElementById('topbar-slot');
  const sidebarSlot = document.getElementById('sidebar-slot');
  if (topbarSlot) topbarSlot.outerHTML = TOPBAR;
  if (sidebarSlot) sidebarSlot.outerHTML = renderSidebar();
})();
