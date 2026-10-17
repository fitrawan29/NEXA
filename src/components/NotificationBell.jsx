import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchAPI, supabaseClient } from '../api.js';

/**
 * Safely access localStorage without crashing in security-restricted environments
 * (e.g. third-party cookie/storage blocking, private browsing, sandboxed iframes).
 */
const getSafeStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // SecurityError / DOMException
  }
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // SecurityError / DOMException
  }
  return null;
};

// In-memory fallback map for environments where localStorage is restricted or quota exceeded
const memoryStoreFallback = new Map();

// Custom event for immediate intra-window notification state synchronization across multiple mounted bells
const INTRA_WINDOW_SYNC_EVENT = 'nexa_notification_sync';

const broadcastNotificationSync = (detail) => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(INTRA_WINDOW_SYNC_EVENT, { detail }));
    } catch {
      // Ignore in non-browser or restricted environments
    }
  }
};

// Module-level Realtime Channel Pool to prevent duplicate WebSocket channels across mounted instances
const realtimeChannelPool = new Map();

const subscribeRealtimePengumuman = (channelKey, onUpdate) => {
  if (typeof window === 'undefined' || !supabaseClient || typeof supabaseClient.channel !== 'function') {
    return () => {};
  }

  let entry = realtimeChannelPool.get(channelKey);
  if (!entry) {
    let channel = null;
    try {
      const channelName = `realtime_notifs_${channelKey}_${Date.now().toString(36)}`;
      channel = supabaseClient
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pengumuman' },
          () => {
            const cur = realtimeChannelPool.get(channelKey);
            if (cur) {
              cur.subscribers.forEach((cb) => {
                try { cb(); } catch {}
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pengumuman_global' },
          () => {
            const cur = realtimeChannelPool.get(channelKey);
            if (cur) {
              cur.subscribers.forEach((cb) => {
                try { cb(); } catch {}
              });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase realtime subscription error:', err);
    }

    entry = {
      channel,
      subscribers: new Set(),
      refCount: 0
    };
    realtimeChannelPool.set(channelKey, entry);
  }

  entry.subscribers.add(onUpdate);
  entry.refCount++;

  return () => {
    const cur = realtimeChannelPool.get(channelKey);
    if (!cur) return;
    cur.subscribers.delete(onUpdate);
    cur.refCount--;
    if (cur.refCount <= 0) {
      if (cur.channel && supabaseClient && typeof supabaseClient.removeChannel === 'function') {
        try {
          supabaseClient.removeChannel(cur.channel);
        } catch {}
      }
      realtimeChannelPool.delete(channelKey);
    }
  };
};

// Module-level in-flight request deduplicator to coalesce concurrent identical fetches
const inFlightFetches = new Map();

const fetchPengumumanWithDedupe = async (fetcher, action, payload) => {
  let normalizedPayload = payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    normalizedPayload = Object.keys(payload).sort().reduce((acc, k) => {
      acc[k] = payload[k];
      return acc;
    }, {});
  }
  const cacheKey = `${action}_${JSON.stringify(normalizedPayload)}`;
  if (inFlightFetches.has(cacheKey)) {
    return inFlightFetches.get(cacheKey);
  }

  const promise = (async () => {
    try {
      return await fetcher(action, payload);
    } finally {
      inFlightFetches.delete(cacheKey);
    }
  })();

  inFlightFetches.set(cacheKey, promise);
  return promise;
};

const LEGACY_DUMMY_IDS = new Set([
  'adm-1', 'adm-2', 'adm-3',
  'gru-1', 'gru-2', 'gru-3',
  'sis-1', 'sis-2', 'sis-3',
  'sup-1', 'sup-2', 'sup-3',
  'gen-1', 'gen-2', 'gen-3'
]);

const LEGACY_DUMMY_TITLES = new Set([
  'Jadwal Ujian Baru',
  'Verifikasi Siswa Baru',
  'Pencadangan Berhasil',
  'Ujian Sedang Berlangsung',
  'Periksa Jawaban Uraian',
  'Jadwal Ujian Diperbarui',
  'Ujian Mendatang',
  'Hasil Ujian Tersedia',
  'Integritas Ujian CBT',
  'Pendaftaran Sekolah Baru',
  'Pembaruan Server Cloud',
  'Audit Log Sistem',
  'Sistem CBT NEXA Online',
  'Pemberitahuan Sistem',
  'Tips Navigasi'
]);

/**
 * Detect legacy dummy notifications to sanitize localStorage
 */
export const isLegacyDummyNotification = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
  if (item.id === undefined || item.id === null) return true;
  const idStr = String(item.id).trim();
  if (!idStr) return true;

  if (typeof item.title !== 'string' || !item.title.trim()) return true;
  if (item.desc !== undefined && item.desc !== null && typeof item.desc !== 'string') return true;
  if (item.time !== undefined && item.time !== null && typeof item.time !== 'string' && typeof item.time !== 'number') return true;
  if (item.icon !== undefined && item.icon !== null && typeof item.icon !== 'string') return true;

  if (LEGACY_DUMMY_IDS.has(idStr)) return true;
  if (/^(adm|gru|sis|sup|gen)-\d+$/i.test(idStr)) return true;
  if (LEGACY_DUMMY_TITLES.has(item.title.trim())) return true;
  return false;
};

/**
 * Clean legacy dummy cache across known notification keys
 */
export const purgeAllLegacyNotificationCaches = () => {
  try {
    const storage = getSafeStorage();
    if (!storage) return;
    const roles = ['admin', 'super_admin', 'guru', 'siswa', 'generic'];
    const keys = new Set([...roles.map((r) => `nexa_notifications_${r}`), 'nexa_notifications']);
    if (typeof storage.length === 'number' && typeof storage.key === 'function') {
      try {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && typeof k === 'string' && k.startsWith('nexa_notifications')) {
            keys.add(k);
          }
        }
      } catch {
        // Ignore
      }
    }
    keys.forEach((k) => {
      try {
        const raw = storage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((item) => !isLegacyDummyNotification(item));
            if (valid.length > 0) {
              storage.setItem(k, JSON.stringify(valid));
            } else {
              storage.removeItem(k);
            }
          } else {
            storage.removeItem(k);
          }
        }
      } catch {
        try {
          storage.removeItem(k);
        } catch {
          // Ignore
        }
      }
    });
  } catch {
    // Ignore storage quota / access issues
  }
};

/**
 * Safely load and sanitize notifications for a given storage key
 */
export const loadSafeNotifications = (key) => {
  try {
    purgeAllLegacyNotificationCaches();
    const storage = getSafeStorage();
    if (!storage) {
      const mem = memoryStoreFallback.get(key);
      return Array.isArray(mem) ? mem.filter(item => !isLegacyDummyNotification(item)) : [];
    }
    const cached = storage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const validNotifications = parsed.filter(item => !isLegacyDummyNotification(item));
        if (validNotifications.length !== parsed.length) {
          try {
            if (validNotifications.length > 0) {
              storage.setItem(key, JSON.stringify(validNotifications));
            } else {
              storage.removeItem(key);
            }
          } catch {
            // ignore
          }
        }
        return validNotifications;
      }
    }
  } catch {
    // ignore
  }
  return [];
};

/**
 * Format badge counter with 99+ overflow
 */
export const formatBadgeCount = (count) => {
  const num = Number(count);
  if (Number.isNaN(num) || num <= 0) return null;
  return num > 99 ? '99+' : String(Math.floor(num));
};

/**
 * Safely format announcement timestamp into readable relative or date time
 */
export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  try {
    let timestamp;
    if (typeof dateInput === 'number') {
      timestamp = dateInput;
    } else if (dateInput instanceof Date) {
      timestamp = dateInput.getTime();
    } else if (typeof dateInput === 'string') {
      timestamp = Date.parse(dateInput);
      if (Number.isNaN(timestamp)) {
        return dateInput;
      }
    } else {
      return '';
    }

    if (Number.isNaN(timestamp)) {
      return typeof dateInput === 'string' ? dateInput : '';
    }
    const diffMs = Date.now() - timestamp;
    if (diffMs < 0) return 'Baru saja';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay < 7) return `${diffDay} hari lalu`;

    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return typeof dateInput === 'string' ? dateInput : '';
  }
};

/**
 * Load persistent read status IDs from storage
 */
export const loadReadIds = (storageKey) => {
  try {
    const storage = getSafeStorage();
    if (storage) {
      const raw = storage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map(String));
        }
      }
    }
  } catch {
    // Ignore storage errors and fall back to memory
  }
  const fallback = memoryStoreFallback.get(storageKey);
  if (fallback && Array.isArray(fallback)) {
    return new Set(fallback.map(String));
  }
  return new Set();
};

/**
 * Save persistent read status IDs to storage
 */
export const saveReadIds = (storageKey, readSet) => {
  const arr = readSet && readSet.size > 0 ? Array.from(readSet) : [];
  if (arr.length > 0) {
    memoryStoreFallback.set(storageKey, arr);
  } else {
    memoryStoreFallback.delete(storageKey);
  }

  try {
    const storage = getSafeStorage();
    if (!storage) return;
    if (arr.length > 0) {
      try {
        storage.setItem(storageKey, JSON.stringify(arr));
      } catch {
        purgeAllLegacyNotificationCaches();
        try {
          storage.setItem(storageKey, JSON.stringify(arr));
        } catch {
          // Quota full: preserved in memoryStoreFallback
        }
      }
    } else {
      storage.removeItem(storageKey);
    }
  } catch {
    // Ignore storage errors
  }
};

/**
 * Map real announcement record from backend into notification schema
 */
export const mapAnnouncementToNotification = (item, isReadDefault = false) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const rawId = item.id_pengumuman ?? item.id;
  if (rawId === undefined || rawId === null) return null;
  const idStr = String(rawId).trim();
  if (!idStr) return null;

  const rawTitle = item.judul ?? item.title;
  if (rawTitle === undefined || rawTitle === null) return null;
  const title = String(rawTitle).trim();
  if (!title) return null;

  const rawDesc = item.isi ?? item.desc ?? '';
  const desc = typeof rawDesc === 'string'
    ? rawDesc.trim()
    : (typeof rawDesc === 'object' && rawDesc !== null ? '' : String(rawDesc));

  const rawTipe = typeof item.tipe === 'string' ? item.tipe.trim().toLowerCase() : 'info';

  let icon = 'campaign';
  if (typeof item.icon === 'string' && item.icon.trim()) {
    icon = item.icon.trim();
  } else if (rawTipe.includes('warn') || rawTipe.includes('peringatan') || rawTipe.includes('himbau')) {
    icon = 'warning';
  } else if (rawTipe.includes('danger') || rawTipe.includes('urgent') || rawTipe.includes('penting') || rawTipe.includes('darurat') || rawTipe.includes('error')) {
    icon = 'error';
  } else if (rawTipe.includes('success') || rawTipe.includes('berhasil') || rawTipe.includes('sukses')) {
    icon = 'check_circle';
  } else if (rawTipe.includes('jadwal') || rawTipe.includes('ujian') || rawTipe.includes('event')) {
    icon = 'event_note';
  } else {
    icon = 'campaign';
  }

  let timeStr = '';
  if (item.created_at) {
    timeStr = formatRelativeTime(item.created_at);
  } else if (item.time) {
    timeStr = typeof item.time === 'number' || item.time instanceof Date ? formatRelativeTime(item.time) : String(item.time);
  }

  const isRead = typeof item.isRead === 'boolean' ? item.isRead : Boolean(isReadDefault);

  return {
    id: idStr,
    id_pengumuman: item.id_pengumuman || idStr,
    title,
    desc,
    tipe: rawTipe,
    icon,
    time: timeStr,
    created_at: item.created_at || null,
    isRead
  };
};

/**
 * Top Navbar Animated Notification Icon Component
 * Features:
 * - Real backend announcements integration (get_pengumuman & get_pengumuman_global)
 * - Persistent read/unread tracking per role/user
 * - Realtime push update listener & periodic fallback refresh
 * - In-popover manual refresh / retry capability
 * - bell-shake CSS animation when unread notifications exist
 * - Red dot/badge with counter and radar pulse effect
 * - Popover dropdown with notifications list
 * - Clean empty state ("Tidak ada notifikasi saat ini") when no notifications
 * - "Tandai Semua Dibaca" button
 * - Keyboard (Escape) & click-outside dismiss handlers
 * - Dynamic theme tokens (text-primary, bg-primary, focus:ring-primary)
 * - Safe handling of undefined/null role
 */
export default function NotificationBell({
  role,
  npsn,
  user,
  fetchAPI: customFetchAPI,
  className = '',
  variant = 'default'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});

  // Normalize role string safely, inferring from user if role is omitted
  const rawRole = role || user?.role || user?.tipe || '';
  const normalizedRole = useMemo(() => {
    if (!rawRole || typeof rawRole !== 'string') return 'generic';
    const r = rawRole.toLowerCase().replace(/[- ]/g, '_');
    if (r.includes('super')) return 'super_admin';
    if (r.includes('admin')) return 'admin';
    if (r.includes('guru') || r.includes('teacher')) return 'guru';
    if (r.includes('siswa') || r.includes('student')) return 'siswa';
    return 'generic';
  }, [rawRole]);

  // Account identifier for user-level persistent read status
  const accountId = useMemo(() => {
    if (!user) return '';
    if (typeof user === 'string' || typeof user === 'number') return String(user).trim();
    return String(
      user.id_admin ||
      user.id_guru ||
      user.id_siswa ||
      user.id_super_admin ||
      user.id_user ||
      user.id ||
      user.username ||
      user.nisn ||
      user.nip ||
      ''
    ).trim();
  }, [user]);

  const effectiveNpsn = useMemo(() => {
    if (npsn !== undefined && npsn !== null && String(npsn).trim()) return String(npsn).trim();
    if (user?.npsn !== undefined && user?.npsn !== null && String(user.npsn).trim()) return String(user.npsn).trim();
    return null;
  }, [npsn, user]);

  const storageKey = `nexa_notifications_${normalizedRole}`;
  const readKey = accountId
    ? `nexa_read_notifs_${normalizedRole}_${accountId}`
    : `nexa_read_notifs_${normalizedRole}`;

  // Purge any residual legacy dummy cache across all roles on mount
  useEffect(() => {
    purgeAllLegacyNotificationCaches();
  }, []);

  // Helper to re-hydrate notifications with user-isolated read status
  const hydrateWithReadStatus = useCallback((items, currentReadKey, currentAccountId) => {
    const readIds = loadReadIds(currentReadKey);
    return items.map(item => {
      const isRead = currentAccountId
        ? readIds.has(String(item.id))
        : Boolean(readIds.has(String(item.id)) || (readIds.size === 0 && item.isRead));
      return { ...item, isRead };
    });
  }, []);

  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  const [prevReadKey, setPrevReadKey] = useState(readKey);
  const [notifications, setNotifications] = useState(() => {
    const cached = loadSafeNotifications(storageKey);
    return hydrateWithReadStatus(cached, readKey, accountId);
  });

  // If role or user changes dynamically while mounted, adjust state immediately during render
  if (storageKey !== prevStorageKey || readKey !== prevReadKey) {
    setPrevStorageKey(storageKey);
    setPrevReadKey(readKey);
    const cached = loadSafeNotifications(storageKey);
    setNotifications(hydrateWithReadStatus(cached, readKey, accountId));
  }

  // Ref tracking active storageKey and fetch request ID to prevent race conditions and out-of-sync writes
  const activeStorageKeyRef = useRef(storageKey);
  activeStorageKeyRef.current = storageKey;
  const fetchIdRef = useRef(0);

  // Sync state changes to localStorage
  useEffect(() => {
    if (activeStorageKeyRef.current !== storageKey) return;
    try {
      const storage = getSafeStorage();
      if (!storage) return;
      if (notifications.length > 0) {
        storage.setItem(storageKey, JSON.stringify(notifications));
      } else {
        storage.removeItem(storageKey);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [notifications, storageKey]);

  // Listen for storage events (cross-tab sync) and intra-window sync events (multi-bell sync on same tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      const isStorage = Boolean(e && e.type === 'storage');
      const targetKey = isStorage ? e.key : (e?.detail?.readKey || e?.detail?.storageKey);
      if (e.key === storageKey || e.key === readKey || targetKey === storageKey || targetKey === readKey || (!targetKey && !isStorage)) {
        const cached = loadSafeNotifications(storageKey);
        setNotifications(hydrateWithReadStatus(cached, readKey, accountId));
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener(INTRA_WINDOW_SYNC_EVENT, handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener(INTRA_WINDOW_SYNC_EVENT, handleStorageChange);
      };
    }
  }, [storageKey, readKey, accountId, hydrateWithReadStatus]);

  // Fetch real notifications from backend with request coalescing and response race guard
  const fetchRealNotifications = useCallback(async () => {
    const activeFetch = customFetchAPI || (typeof window !== 'undefined' && window.fetchAPI ? window.fetchAPI : fetchAPI);
    if (typeof activeFetch !== 'function') return;

    const currentFetchId = ++fetchIdRef.current;

    try {
      setIsLoading(true);
      let res = null;
      if (normalizedRole === 'super_admin') {
        res = await fetchPengumumanWithDedupe(activeFetch, 'get_pengumuman_global', {});
      } else if (effectiveNpsn) {
        res = await fetchPengumumanWithDedupe(activeFetch, 'get_pengumuman', { role: normalizedRole, npsn: effectiveNpsn });
      } else {
        res = await fetchPengumumanWithDedupe(activeFetch, 'get_pengumuman_global', {});
      }

      if (currentFetchId !== fetchIdRef.current) return;

      let dataList = null;
      if (Array.isArray(res)) {
        dataList = res;
      } else if (res && !res.error && res.status !== 'error') {
        if (Array.isArray(res.data)) {
          dataList = res.data;
        }
      }

      if (dataList) {
        const readIds = loadReadIds(readKey);
        const seenIds = new Set();
        const freshList = [];

        for (const ann of dataList) {
          const mapped = mapAnnouncementToNotification(ann);
          if (!mapped) continue;
          // Reject mock IDs if any leaked into payload
          if (LEGACY_DUMMY_IDS.has(mapped.id) || /^(adm|gru|sis|sup|gen)-\d+$/i.test(mapped.id)) {
            continue;
          }
          // Deduplicate items by ID to avoid React key collisions
          if (seenIds.has(mapped.id)) {
            continue;
          }
          seenIds.add(mapped.id);

          const isRead = accountId
            ? readIds.has(mapped.id)
            : Boolean(readIds.has(mapped.id) || (readIds.size === 0 && mapped.isRead));

          freshList.push({ ...mapped, isRead });
        }

        if (currentFetchId === fetchIdRef.current) {
          setNotifications(freshList);
          broadcastNotificationSync({ storageKey, readKey });
        }
      }
    } catch (err) {
      console.warn('Gagal memuat notifikasi pengumuman:', err);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [customFetchAPI, normalizedRole, effectiveNpsn, readKey, accountId, storageKey]);

  // Automatically fetch real notifications on mount and when role, npsn, or user changes
  useEffect(() => {
    fetchRealNotifications();
  }, [fetchRealNotifications]);

  // Auto-refresh notifications periodically and when tab becomes active
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchRealNotifications();
    }, 60000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchRealNotifications();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchRealNotifications]);

  // Real-time Supabase push subscription for pengumuman tables using shared pooled channel
  useEffect(() => {
    const channelKey = `${normalizedRole}_${effectiveNpsn || 'global'}`;
    const unsubscribe = subscribeRealtimePengumuman(channelKey, () => {
      fetchRealNotifications();
    });

    return () => {
      unsubscribe();
    };
  }, [normalizedRole, effectiveNpsn, fetchRealNotifications]);

  // Derived unread status and count
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  // Viewport edge collision detection to prevent mobile screen clipping
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const updatePosition = () => {
      if (!containerRef.current || typeof window === 'undefined') return;
      try {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 360;
        const margin = 12; // 0.75rem safety margin
        const maxAllowedWidth = Math.min(384, Math.max(260, viewportWidth - margin * 2));

        const wouldBeLeft = rect.right - maxAllowedWidth;

        if (wouldBeLeft < margin) {
          const shiftX = margin - wouldBeLeft;
          setPopoverStyle({
            transform: `translateX(${Math.round(shiftX)}px)`,
            maxWidth: `${viewportWidth - margin * 2}px`
          });
        } else if (rect.right + margin > viewportWidth) {
          const overflowRight = (rect.right + margin) - viewportWidth;
          setPopoverStyle({
            transform: `translateX(-${Math.round(overflowRight)}px)`,
            maxWidth: `${viewportWidth - margin * 2}px`
          });
        } else {
          setPopoverStyle({
            transform: 'none',
            maxWidth: `${viewportWidth - margin * 2}px`
          });
        }
      } catch {
        // Ignore in restricted environments
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Dismiss on Escape key and outside click with focus restoration
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        if (triggerRef.current) {
          triggerRef.current.focus();
        }
      }
    };

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Toggle button click handler with propagation stop to protect parent navbar
  const handleToggleOpen = (e) => {
    e.stopPropagation();
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        fetchRealNotifications();
      }
      return next;
    });
  };

  // Mark all notifications as read
  const markAllAsRead = (e) => {
    if (e) e.stopPropagation();
    const readIds = loadReadIds(readKey);
    notifications.forEach(n => readIds.add(String(n.id)));
    saveReadIds(readKey, readIds);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    broadcastNotificationSync({ storageKey, readKey });
  };

  // Mark single item as read or toggle
  const toggleItemRead = (id, e) => {
    if (e) e.stopPropagation();
    const idStr = String(id);
    const readIds = loadReadIds(readKey);
    const target = notifications.find(n => String(n.id) === idStr);
    const willBeRead = !target?.isRead;

    if (willBeRead) {
      readIds.add(idStr);
    } else {
      readIds.delete(idStr);
    }
    saveReadIds(readKey, readIds);

    setNotifications(prev =>
      prev.map(n => (String(n.id) === idStr ? { ...n, isRead: willBeRead } : n))
    );
    broadcastNotificationSync({ storageKey, readKey });
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleOpen}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-w-[40px] min-h-[40px] ${
          variant === 'white'
            ? 'text-white hover:bg-white/20 focus:ring-white/40'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        aria-label="Pemberitahuan Sistem"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={hasUnread ? `${unreadCount} pemberitahuan belum dibaca` : 'Pemberitahuan'}
      >
        {/* Animated Bell Icon */}
        <span
          className={`material-symbols-outlined text-2xl transition-transform ${
            hasUnread ? 'animate-bell-shake text-primary' : 'text-slate-600 dark:text-slate-300'
          } ${variant === 'white' ? (hasUnread ? '!text-amber-300' : '!text-white') : ''}`}
        >
          notifications
        </span>

        {/* Red Unread Indicator Badge */}
        {hasUnread && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-xs">
            <span className="absolute inset-0 rounded-full bg-rose-400 opacity-75 animate-ping"></span>
            <span className="relative z-10">{formatBadgeCount(unreadCount)}</span>
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={popoverStyle}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200/90 dark:border-slate-700/90 z-50 overflow-hidden animate-fade-in-up"
          role="dialog"
          aria-label="Daftar Notifikasi"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                Notifikasi
              </span>
              {hasUnread && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {unreadCount} Baru
                </span>
              )}
              {isLoading && (
                <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin ml-1" title="Memuat..."></span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  if (e) e.stopPropagation();
                  fetchRealNotifications();
                }}
                className="p-1 text-slate-400 hover:text-primary dark:hover:text-primary transition-colors rounded-lg flex items-center justify-center min-w-[28px] min-h-[28px]"
                title="Segarkan Notifikasi"
                aria-label="Segarkan Notifikasi"
              >
                <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
              {hasUnread && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-primary hover:underline transition-all"
                >
                  Tandai Semua Dibaca
                </button>
              )}
            </div>
          </div>

          {/* Notifications Scrollable List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-3xl mb-1 text-slate-300 dark:text-slate-600">
                  notifications_off
                </span>
                <p className="text-xs font-semibold">Tidak ada notifikasi saat ini.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.title}. ${item.desc ? item.desc + '. ' : ''}${item.time ? item.time + '. ' : ''}Status: ${item.isRead ? 'Sudah dibaca' : 'Belum dibaca'}`}
                  onClick={(e) => toggleItemRead(item.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleItemRead(item.id, e);
                    }
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                    !item.isRead
                      ? 'bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 opacity-75'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      !item.isRead
                        ? (item.tipe === 'warning' || item.tipe === 'peringatan'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : item.tipe === 'danger' || item.tipe === 'urgent' || item.tipe === 'penting' || item.tipe === 'error'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : item.tipe === 'success' || item.tipe === 'berhasil'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : item.tipe === 'event' || item.tipe === 'jadwal' || item.tipe === 'ujian'
                            ? 'bg-indigo-500 text-white shadow-xs'
                            : 'bg-primary text-white shadow-xs')
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {typeof item.icon === 'string' && item.icon ? item.icon : 'notifications'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          !item.isRead
                            ? 'font-black text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {typeof item.title === 'string' ? item.title : String(item.title || '')}
                      </h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {typeof item.time === 'string' ? item.time : (typeof item.time === 'number' ? String(item.time) : '')}
                      </span>
                    </div>
                    {item.desc && typeof item.desc === 'string' && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {item.desc}
                      </p>
                    )}
                  </div>
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" title="Belum dibaca"></span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Popover Footer */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Status: <span className="font-bold text-slate-700 dark:text-slate-200">{notifications.length === 0 ? 'Tidak Ada Notifikasi' : (hasUnread ? `${unreadCount} Belum Dibaca` : 'Semua Dibaca')}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { NotificationBell };
