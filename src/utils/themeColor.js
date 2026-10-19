/**
 * Utility for dynamic PWA and mobile status bar theme-color synchronization.
 *
 * Requirements:
 * - R1: PWA & Mobile Status Bar Color Alignment (Emerald identity #10b981)
 * - R2: Dynamic Status Bar Synchronization (Real-time sync with UI & Dark Mode)
 * - R3: Minimalist & Native Platform Implementation (Zero third-party libs)
 */

export const THEME_COLORS = {
  dark: '#0f172a',       // Tailwind slate-900 (dark mode background & dark sticky headers)
  emerald: '#10b981',    // Brand Emerald 500 (Login header, Siswa mobile header, PWA manifest)
  white: '#ffffff',      // Pure White (GuruView, AdminView, ExamRoom light headers)
  superAdmin: '#7c3aed', // Brand Violet (SuperAdmin header)
  guru: '#f59e0b',       // Brand Amber (Guru login header)
  admin: '#3b82f6',      // Brand Blue (Admin login header)
};

/**
 * Resolves the status bar / theme-color matching the active UI context.
 *
 * @param {Object} [state={}]
 * @param {boolean} [state.isDarkMode=false]
 * @param {boolean} [state.isExamActive=false]
 * @param {string} [state.role='siswa']
 * @param {boolean} [state.isLoggedIn]
 * @param {Object|null} [state.user]
 * @returns {string} Hex color string
 */
export function getStatusBarColor(state = {}) {
  const safeState = state || {};

  // Dark mode always takes precedence: match app dark background/header (#0f172a)
  if (safeState.isDarkMode) {
    return THEME_COLORS.dark;
  }

  const rawRole = safeState.role || 'siswa';
  const role = typeof rawRole === 'string' ? rawRole.toLowerCase() : 'siswa';
  const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
  const isLoggedIn = safeState.isLoggedIn !== undefined 
    ? Boolean(safeState.isLoggedIn) 
    : (safeState.user !== undefined ? Boolean(safeState.user) : true);

  // If on login/unauthenticated screen (not logged into a dashboard view):
  if (!isLoggedIn) {
    if (role === 'guru') return THEME_COLORS.guru;
    if (role === 'admin') return THEME_COLORS.admin;
    if (isSuperAdmin) return THEME_COLORS.superAdmin;
    return THEME_COLORS.emerald;
  }

  // Active exam in ExamRoom has a white header in light mode (only when logged in)
  if (safeState.isExamActive) {
    return THEME_COLORS.white;
  }

  // Guru and Admin dashboards have white sticky headers on mobile in light mode
  if (role === 'guru' || role === 'admin') {
    return THEME_COLORS.white;
  }

  // Super Admin dashboard has violet header in light mode
  if (isSuperAdmin) {
    return THEME_COLORS.superAdmin;
  }

  // Siswa dashboard and default views use emerald in light mode
  return THEME_COLORS.emerald;
}

/**
 * Dynamically updates the <meta name="theme-color"> and Apple status bar meta elements in DOM head.
 * If the tag does not exist, it is created natively.
 *
 * @param {Object} [state={}]
 * @returns {string|null} The applied hex color, or null if outside browser DOM
 */
export function syncThemeColor(state = {}) {
  if (typeof document === 'undefined') return null;

  const color = getStatusBarColor(state);
  const getDocHead = () => document.head || (typeof document.getElementsByTagName === 'function' && document.getElementsByTagName('head')[0]) || document.documentElement;

  // Update all meta[name="theme-color"] tags in document head
  if (typeof document.querySelectorAll === 'function') {
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas && metas.length > 0) {
      metas.forEach((meta) => meta.setAttribute('content', color));
    } else {
      let meta = typeof document.querySelector === 'function' ? document.querySelector('meta[name="theme-color"]') : null;
      const head = getDocHead();
      if (!meta && typeof document.createElement === 'function' && head && typeof head.appendChild === 'function') {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        head.appendChild(meta);
      }
      if (meta) meta.setAttribute('content', color);
    }
  } else if (typeof document.querySelector === 'function') {
    let meta = document.querySelector('meta[name="theme-color"]');
    const head = getDocHead();
    if (!meta && typeof document.createElement === 'function' && head && typeof head.appendChild === 'function') {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      head.appendChild(meta);
    }
    if (meta) meta.setAttribute('content', color);
  }

  // Synchronize iOS Safari status bar style for optimal contrast:
  // 'default' provides dark icons for white headers, 'black-translucent' provides light icons for dark/colored headers
  const appleStyle = color === THEME_COLORS.white ? 'default' : 'black-translucent';
  if (typeof document.querySelectorAll === 'function') {
    const appleMetas = document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMetas && appleMetas.length > 0) {
      appleMetas.forEach((meta) => meta.setAttribute('content', appleStyle));
    } else {
      let appleMeta = typeof document.querySelector === 'function' ? document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') : null;
      const head = getDocHead();
      if (!appleMeta && typeof document.createElement === 'function' && head && typeof head.appendChild === 'function') {
        appleMeta = document.createElement('meta');
        appleMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        head.appendChild(appleMeta);
      }
      if (appleMeta) appleMeta.setAttribute('content', appleStyle);
    }
  } else if (typeof document.querySelector === 'function') {
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    const head = getDocHead();
    if (!appleMeta && typeof document.createElement === 'function' && head && typeof head.appendChild === 'function') {
      appleMeta = document.createElement('meta');
      appleMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      head.appendChild(appleMeta);
    }
    if (appleMeta) {
      appleMeta.setAttribute('content', appleStyle);
    }
  }

  return color;
}
