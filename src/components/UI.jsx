import React from 'react';

/**
 * Utility: Safe JSON Parser (Backward & Forward Compatibility)
 */
export const safeJSONParse = (str, fallback) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn("JSON parse error:", e);
    return fallback;
  }
};

/**
 * Helper: IconRenderer
 * Mendukung nama Material Symbol (string) maupun elemen React/SVG kustom.
 */
const renderIcon = (icon, className = "text-2xl") => {
  if (!icon) return null;
  if (typeof icon === 'string') {
    return <span className={`material-symbols-outlined select-none ${className}`}>{icon}</span>;
  }
  return icon;
};

/**
 * EmptyState
 * Komponen modern untuk menampilkan kondisi data kosong, pencarian nihil,
 * atau belum ada aktivitas dengan dukungan penuh mode gelap.
 */
export const EmptyState = ({
  icon = 'folder_open',
  title = 'Belum Ada Data',
  description,
  message,
  action,
  actionText,
  onAction,
  secondaryAction,
  compact = false,
  className = '',
}) => {
  const finalDesc = description || message || 'Belum ada data yang dapat ditampilkan di sini.';

  const renderActionButton = () => {
    // 1. React Node langsung
    if (React.isValidElement(action)) {
      return action;
    }
    // 2. Konfigurasi objek action { label, onClick, icon }
    if (action && typeof action === 'object' && action.label && action.onClick) {
      return (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 active:scale-[0.98] text-white shadow-sm hover:shadow transition-all"
        >
          {action.icon && renderIcon(action.icon, 'text-[18px]')}
          <span>{action.label}</span>
        </button>
      );
    }
    // 3. Dukungan backward compatibility: actionText + onAction
    if (actionText && onAction) {
      return (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 active:scale-[0.98] text-white shadow-sm hover:shadow transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>{actionText}</span>
        </button>
      );
    }
    return null;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 transition-all animate-fade-in-up ${
        compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'
      } ${className}`}
    >
      <div
        className={`rounded-2xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center border border-primary/20 dark:border-primary/20 shadow-inner ${
          compact ? 'w-14 h-14 mb-3' : 'w-20 h-20 mb-5'
        }`}
      >
        {renderIcon(icon, compact ? 'text-3xl' : 'text-4xl sm:text-5xl')}
      </div>

      <h3
        className={`font-bold text-slate-800 dark:text-slate-100 mb-1.5 ${
          compact ? 'text-base' : 'text-lg sm:text-xl'
        }`}
      >
        {title}
      </h3>

      <p
        className={`text-slate-500 dark:text-slate-400 max-w-sm sm:max-w-md mx-auto leading-relaxed ${
          compact ? 'text-xs mb-4' : 'text-xs sm:text-sm mb-6'
        }`}
      >
        {finalDesc}
      </p>

      {(action || (actionText && onAction) || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {renderActionButton()}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all active:scale-[0.98]"
            >
              {secondaryAction.icon && renderIcon(secondaryAction.icon, 'text-[18px]')}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * TableSkeleton
 * Skeleton baris tabel berdenyut halus dengan lebar kolom yang dapat disesuaikan.
 */
export const TableSkeleton = ({
  rows = 5,
  cols,
  columns = 4,
  columnWidths,
  asTableRows = false,
  showHeader = true,
  hasAvatar = false,
  className = '',
}) => {
  const colCount = columnWidths ? columnWidths.length : (cols || columns);

  const getDefaultWidth = (cIndex) => {
    if (columnWidths && columnWidths[cIndex]) return columnWidths[cIndex];
    if (cIndex === 0) return 'w-10 sm:w-12';
    if (cIndex === 1) return 'w-40 sm:w-56';
    if (cIndex === 2) return 'w-28 sm:w-36';
    if (cIndex === 3) return 'w-24';
    return 'w-20';
  };

  // Digunakan langsung di dalam elemen <tbody>
  if (asTableRows) {
    return (
      <>
        {Array.from({ length: rows }).map((_, r) => (
          <tr
            key={`skel-row-${r}`}
            className="border-b border-slate-100 dark:border-slate-700/60 last:border-none animate-pulse"
          >
            {Array.from({ length: colCount }).map((_, c) => (
              <td key={`skel-cell-${r}-${c}`} className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  {c === 1 && hasAvatar && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                  )}
                  <div
                    className={`h-4 bg-slate-200 dark:bg-slate-700/80 rounded-md ${getDefaultWidth(c)}`}
                  ></div>
                </div>
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  }

  // Standalone skeleton container
  return (
    <div
      className={`w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm animate-pulse ${className}`}
    >
      {showHeader && (
        <div className="flex items-center gap-4 px-6 py-4 bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
          {Array.from({ length: colCount }).map((_, i) => (
            <div
              key={`skel-th-${i}`}
              className={`h-4 bg-slate-200 dark:bg-slate-700 rounded-md ${getDefaultWidth(i)}`}
            ></div>
          ))}
        </div>
      )}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`skel-tr-${r}`} className="flex items-center gap-4 px-6 py-4">
            {Array.from({ length: colCount }).map((_, c) => (
              <div key={`skel-td-${r}-${c}`} className="flex items-center gap-3">
                {c === 1 && hasAvatar && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                )}
                <div
                  className={`h-4 bg-slate-100 dark:bg-slate-700/50 rounded-md ${getDefaultWidth(c)}`}
                ></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * CardSkeleton
 * Modern card skeleton untuk dasbor metrik statistik, kartu jadwal ujian, dan kartu umum.
 */
export const CardSkeleton = ({
  count = 3,
  variant = 'stat',
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6',
  className = '',
}) => {
  const cards = Array.from({ length: count });

  const renderCardContent = () => {
    switch (variant) {
      case 'stat':
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
              <div className="w-16 h-5 rounded-full bg-slate-100 dark:bg-slate-700/50"></div>
            </div>
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2"></div>
            <div className="h-4 w-36 bg-slate-100 dark:bg-slate-700/50 rounded-md"></div>
          </>
        );

      case 'exam':
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="w-20 h-5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
              <div className="w-16 h-4 rounded-md bg-slate-100 dark:bg-slate-700/50"></div>
            </div>
            <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md mb-2"></div>
            <div className="h-4 w-1/2 bg-slate-100 dark:bg-slate-700/50 rounded-md mb-4"></div>
            <div className="space-y-2 py-3 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-3 w-32 bg-slate-100 dark:bg-slate-700/50 rounded"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-3 w-24 bg-slate-100 dark:bg-slate-700/50 rounded"></div>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-end">
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            </div>
          </>
        );

      case 'simple':
      default:
        return (
          <>
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mb-4"></div>
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded w-1/2"></div>
          </>
        );
    }
  };

  return (
    <div className={gridClassName}>
      {cards.map((_, i) => (
        <div
          key={`card-skel-${i}`}
          className={`bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm animate-pulse flex flex-col justify-between ${className}`}
        >
          {renderCardContent()}
        </div>
      ))}
    </div>
  );
};

/**
 * Status to Variant Map
 */
const STATUS_VARIANT_MAP = {
  // Success (Emerald)
  'AKTIF': 'success',
  'ACTIVE': 'success',
  'SELESAI': 'success',
  'SUDAH_SELESAI': 'success',
  'DONE': 'success',
  'TERJAWAB': 'success',
  'ANSWERED': 'success',
  'LULUS': 'success',
  'SUKSES': 'success',
  'SUCCESS': 'success',
  'APPROVED': 'success',
  'HADIR': 'success',
  'ONLINE': 'success',

  // Warning (Amber)
  'SEDANG KERJA': 'warning',
  'SEDANG_UJIAN': 'warning',
  'IN_PROGRESS': 'warning',
  'MENGERJAKAN': 'warning',
  'RAGU': 'warning',
  'RAGU-RAGU': 'warning',
  'DOUBTFUL': 'warning',
  'PENDING': 'warning',
  'MENUNGGU': 'warning',
  'SUSULAN': 'warning',
  'WARNING': 'warning',

  // Neutral (Slate)
  'BELUM MULAI': 'neutral',
  'BELUM': 'neutral',
  'UNANSWERED': 'neutral',
  'IDLE': 'neutral',
  'DRAFT': 'neutral',
  'NONAKTIF': 'neutral',
  'TUTUP': 'neutral',
  'NEUTRAL': 'neutral',

  // Danger (Rose)
  'TERBLOKIR': 'danger',
  'BLOCKED': 'danger',
  'PELANGGARAN': 'danger',
  'VIOLATION': 'danger',
  'GAGAL': 'danger',
  'FAILED': 'danger',
  'ERROR': 'danger',
  'BATAL': 'danger',
  'DANGER': 'danger',
  'DISKUALIFIKASI': 'danger',
  'TIDAK HADIR': 'danger',

  // Info (Sky)
  'INFO': 'info',
  'JADWAL': 'info',
  'TERJADWAL': 'info',

  // Purple
  'HASIL': 'purple',
  'ANALISIS': 'purple',
  'EVALUASI': 'purple',
};

/**
 * StatusBadge
 * Indikator status terpadu untuk ujian, progres siswa, jadwal, dan proctoring.
 */
export const StatusBadge = ({
  status,
  children,
  label,
  variant,
  size = 'sm',
  dot = true,
  pulse = false,
  icon,
  pill = true,
  className = '',
}) => {
  const content = label !== undefined ? label : (status !== undefined ? status : children);
  const contentStr = typeof content === 'string' ? content.trim().toUpperCase() : '';

  const resolvedVariant = variant || STATUS_VARIANT_MAP[contentStr] || 'neutral';

  const sizeStyles = {
    xs: 'text-[10px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-xs sm:text-sm px-3 py-1.5 gap-2',
    lg: 'text-sm px-4 py-2 gap-2.5',
  }[size] || 'text-xs px-2.5 py-1 gap-1.5';

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }[size] || 'w-2 h-2';

  const variantStyles = {
    success: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
      ping: 'bg-emerald-400',
    },
    warning: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dot: 'bg-amber-500',
      ping: 'bg-amber-400',
    },
    neutral: {
      badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400 dark:bg-slate-500',
      ping: 'bg-slate-300',
    },
    danger: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dot: 'bg-rose-500',
      ping: 'bg-rose-400',
    },
    info: {
      badge: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
      dot: 'bg-sky-500',
      ping: 'bg-sky-400',
    },
    purple: {
      badge: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
      dot: 'bg-purple-500',
      ping: 'bg-purple-400',
    },
  }[resolvedVariant] || {
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    ping: 'bg-slate-300',
  };

  const isLivePulse = pulse || (dot && (contentStr === 'AKTIF' || contentStr === 'SEDANG KERJA' || contentStr === 'SEDANG_UJIAN'));

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide border transition-colors select-none ${
        pill ? 'rounded-full' : 'rounded-lg'
      } ${sizeStyles} ${variantStyles.badge} ${className}`}
    >
      {dot && (
        <span className="relative flex shrink-0 items-center justify-center">
          {isLivePulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${variantStyles.ping}`}
            ></span>
          )}
          <span className={`relative inline-flex rounded-full ${dotSizes} ${variantStyles.dot}`}></span>
        </span>
      )}

      {icon && (
        <span className="shrink-0 flex items-center">
          {renderIcon(icon, size === 'xs' ? 'text-[14px]' : 'text-[16px]')}
        </span>
      )}

      <span className="truncate">{content || 'Status'}</span>
    </span>
  );
};

/**
 * Standardized Card Primitives
 */
export const Card = ({ children, className = '', ...props }) => (
  <div
    className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-all ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...props }) => (
  <div
    className={`p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }) => (
  <h3
    className={`text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight ${className}`}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }) => (
  <div
    className={`p-5 sm:p-6 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl flex items-center justify-between gap-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

/**
 * Standardized Button Primitive
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  rightIcon,
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2.5 rounded-xl gap-2',
    lg: 'text-sm sm:text-base px-5 py-3 rounded-xl gap-2.5',
  }[size] || 'text-xs sm:text-sm px-4 py-2.5 rounded-xl gap-2';

  const variantStyles = {
    primary: 'bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',
    outline: 'bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-rose-500/20',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
  }[variant] || 'bg-emerald-600 hover:bg-emerald-700 text-white';

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      ) : (
        icon && renderIcon(icon, size === 'sm' ? 'text-[16px]' : 'text-[18px]')
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && renderIcon(rightIcon, size === 'sm' ? 'text-[16px]' : 'text-[18px]')}
    </button>
  );
};

// Aliases
export const Badge = StatusBadge;

// Global Attachments for Backward Compatibility
if (typeof window !== 'undefined') {
  window.EmptyState = EmptyState;
  window.TableSkeleton = TableSkeleton;
  window.CardSkeleton = CardSkeleton;
  window.StatusBadge = StatusBadge;
  window.Badge = StatusBadge;
  window.Card = Card;
  window.CardHeader = CardHeader;
  window.CardTitle = CardTitle;
  window.CardDescription = CardDescription;
  window.CardContent = CardContent;
  window.CardFooter = CardFooter;
  window.Button = Button;
  window.safeJSONParse = window.safeJSONParse || safeJSONParse;
}

export default {
  EmptyState,
  TableSkeleton,
  CardSkeleton,
  StatusBadge,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  safeJSONParse,
};
