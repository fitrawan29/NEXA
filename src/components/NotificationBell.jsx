import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Role-tailored default notifications
 */
const DEFAULT_NOTIFICATIONS_BY_ROLE = {
  admin: [
    {
      id: 'adm-1',
      title: 'Jadwal Ujian Baru',
      desc: 'Ujian Akhir Semester Genap telah dijadwalkan untuk 12 kelas.',
      time: '10 menit lalu',
      isRead: false,
      icon: 'event_note'
    },
    {
      id: 'adm-2',
      title: 'Verifikasi Siswa Baru',
      desc: '3 siswa baru memerlukan verifikasi kelengkapan data NISN.',
      time: '35 menit lalu',
      isRead: false,
      icon: 'school'
    },
    {
      id: 'adm-3',
      title: 'Pencadangan Berhasil',
      desc: 'Backup basis data sekolah otomatis telah selesai dibuat.',
      time: '1 jam lalu',
      isRead: false,
      icon: 'cloud_done'
    }
  ],
  guru: [
    {
      id: 'gru-1',
      title: 'Ujian Sedang Berlangsung',
      desc: 'Penilaian Matematika Wajib X-A sedang berlangsung (32 siswa aktif).',
      time: '5 menit lalu',
      isRead: false,
      icon: 'quiz'
    },
    {
      id: 'gru-2',
      title: 'Periksa Jawaban Uraian',
      desc: '5 jawaban uraian Bahasa Indonesia siap untuk dinilai guru.',
      time: '25 menit lalu',
      isRead: false,
      icon: 'assignment_turned_in'
    },
    {
      id: 'gru-3',
      title: 'Jadwal Ujian Diperbarui',
      desc: 'Waktu pelaksanaan Biologi XI dimajukan ke pukul 09:00 WIB.',
      time: '2 jam lalu',
      isRead: false,
      icon: 'update'
    }
  ],
  siswa: [
    {
      id: 'sis-1',
      title: 'Ujian Mendatang',
      desc: 'Ujian Matematika Wajib dimulai dalam 15 menit. Pastikan koneksi stabil.',
      time: '15 menit lalu',
      isRead: false,
      icon: 'timer'
    },
    {
      id: 'sis-2',
      title: 'Hasil Ujian Tersedia',
      desc: 'Nilai Ujian Bahasa Inggris telah dipublikasikan oleh Guru.',
      time: '1 jam lalu',
      isRead: false,
      icon: 'grade'
    },
    {
      id: 'sis-3',
      title: 'Integritas Ujian CBT',
      desc: 'Dilarang berpindah tab atau keluar dari aplikasi selama ujian berlangsung.',
      time: '3 jam lalu',
      isRead: false,
      icon: 'security'
    }
  ],
  super_admin: [
    {
      id: 'sup-1',
      title: 'Pendaftaran Sekolah Baru',
      desc: 'SMAN 1 Garut berhasil didaftarkan ke sistem CBT NEXA.',
      time: '20 menit lalu',
      isRead: false,
      icon: 'domain'
    },
    {
      id: 'sup-2',
      title: 'Pembaruan Server Cloud',
      desc: 'Layanan sinkronisasi database cloud beroperasi dengan latensi rendah.',
      time: '1 jam lalu',
      isRead: false,
      icon: 'dns'
    },
    {
      id: 'sup-3',
      title: 'Audit Log Sistem',
      desc: 'Laporan aktivitas mingguan sistem telah berhasil digenerate.',
      time: '4 jam lalu',
      isRead: false,
      icon: 'fact_check'
    }
  ]
};

const GENERIC_DEFAULT_NOTIFICATIONS = [
  {
    id: 'gen-1',
    title: 'Sistem CBT NEXA Online',
    desc: 'Layanan ujian terhubung ke server utama dengan enkripsi aman.',
    time: 'Baru saja',
    isRead: false,
    icon: 'wifi'
  },
  {
    id: 'gen-2',
    title: 'Pemberitahuan Sistem',
    desc: 'Fitur notifikasi animasi bilah atas telah aktif dan siap digunakan.',
    time: '1 jam lalu',
    isRead: false,
    icon: 'notifications_active'
  },
  {
    id: 'gen-3',
    title: 'Tips Navigasi',
    desc: 'Gunakan mode layar penuh untuk kenyamanan pengerjaan ujian.',
    time: '1 hari lalu',
    isRead: false,
    icon: 'info'
  }
];

/**
 * Format badge counter with 99+ overflow
 */
export const formatBadgeCount = (count) => {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
};

/**
 * Top Navbar Animated Notification Icon Component
 * Features:
 * - bell-shake CSS animation when unread notifications exist
 * - Red dot/badge with counter and radar pulse effect
 * - Popover dropdown with simulated notifications list
 * - "Simulasikan Belum Dibaca" toggle button for testing & user simulation
 * - "Tandai Semua Dibaca" button
 * - Keyboard (Escape) & click-outside dismiss handlers
 * - Dynamic theme tokens (text-primary, bg-primary, focus:ring-primary)
 * - Safe handling of undefined/null role
 */
export default function NotificationBell({ role, className = '', variant = 'default' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize role string safely
  const normalizedRole = useMemo(() => {
    if (!role || typeof role !== 'string') return 'generic';
    const r = role.toLowerCase().replace(/[- ]/g, '_');
    if (r.includes('admin') && !r.includes('super')) return 'admin';
    if (r.includes('super')) return 'super_admin';
    if (r.includes('guru') || r.includes('teacher')) return 'guru';
    if (r.includes('siswa') || r.includes('student')) return 'siswa';
    return 'generic';
  }, [role]);

  const storageKey = `nexa_notifications_${normalizedRole}`;

  // Initialize notifications from localStorage or defaults
  const [notifications, setNotifications] = useState(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    const initialList = DEFAULT_NOTIFICATIONS_BY_ROLE[normalizedRole] || GENERIC_DEFAULT_NOTIFICATIONS;
    return initialList.map(item => ({ ...item }));
  });

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {
      // ignore storage quota errors
    }
  }, [notifications, storageKey]);

  // Derived unread status and count
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  // Dismiss on Escape key and outside click
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
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
    setIsOpen(prev => !prev);
  };

  // Mark all notifications as read
  const markAllAsRead = (e) => {
    if (e) e.stopPropagation();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Toggle or simulate unread state (for interactive testing & evaluation)
  const handleSimulateToggle = (e) => {
    if (e) e.stopPropagation();
    setNotifications(prev => {
      const anyUnread = prev.some(n => !n.isRead);
      if (anyUnread) {
        // If there are unread items, mark all as read
        return prev.map(n => ({ ...n, isRead: true }));
      } else {
        // If all are read, restore unread status on the first 3 items (or create one)
        if (prev.length === 0) {
          const fresh = DEFAULT_NOTIFICATIONS_BY_ROLE[normalizedRole] || GENERIC_DEFAULT_NOTIFICATIONS;
          return fresh.map(item => ({ ...item, isRead: false }));
        }
        return prev.map((n, idx) => idx < 3 ? { ...n, isRead: false } : n);
      }
    });
  };

  // Mark single item as read or toggle
  const toggleItemRead = (id, e) => {
    if (e) e.stopPropagation();
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-w-[40px] min-h-[40px] ${
          variant === 'white'
            ? 'text-white hover:bg-white/20 focus:ring-white/40'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        aria-label="Pemberitahuan Sistem"
        aria-expanded={isOpen}
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
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200/90 dark:border-slate-700/90 z-50 overflow-hidden animate-fade-in-up"
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
            </div>
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
                  onClick={(e) => toggleItemRead(item.id, e)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    !item.isRead
                      ? 'bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 opacity-75'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      !item.isRead
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {item.icon || 'notifications'}
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
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" title="Belum dibaca"></span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Popover Footer with Interactive Simulation Toggle */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Status: <span className="font-bold text-slate-700 dark:text-slate-200">{hasUnread ? `${unreadCount} Belum Dibaca` : 'Semua Dibaca'}</span>
            </span>
            <button
              type="button"
              onClick={handleSimulateToggle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90 active:scale-95 transition-all shadow-xs"
              title="Uji coba animasi getar dan lencana merah"
            >
              <span className="material-symbols-outlined text-sm">
                {hasUnread ? 'check_circle' : 'notifications_active'}
              </span>
              <span>Simulasikan Belum Dibaca</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { NotificationBell };
