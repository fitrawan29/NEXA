import React, { useEffect } from 'react';

/**
 * ModalPratinjauTandaTangan
 * 
 * High-resolution modal for exam proctor to inspect a student's digital canvas signature,
 * verify identity, and perform single attendance verification (Approve / Reject).
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - student: {
 *     id_absensi, id_siswa, nama_lengkap, nisn, kelas, ruang,
 *     tanda_tangan, status_verifikasi, status_kehadiran, waktu_absen
 *   }
 * - onApprove: (student) => void
 * - onReject: (student) => void
 * - isSubmitting: boolean
 */
const ModalPratinjauTandaTangan = ({
  isOpen,
  onClose,
  student,
  onApprove,
  onReject,
  isSubmitting = false
}) => {
  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !student) return null;

  const nama = student.nama_lengkap || student.nama || 'Peserta Ujian';
  const nisn = student.nisn || '-';
  const kelas = student.kelas || student.target_kelas || '-';
  const ruang = student.ruang || student.nama_ruang || '-';
  const signatureDataUrl = student.tanda_tangan;
  const statusVerifikasi = (student.status_verifikasi || 'MENUNGGU').toUpperCase();

  // Format submission timestamp
  const formatTimestamp = (isoString) => {
    if (!isoString) return 'Belum tercatat';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const renderStatusBadge = () => {
    switch (statusVerifikasi) {
      case 'DISETUJUI':
      case 'TERVERIFIKASI':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            DISETUJUI
          </span>
        );
      case 'DITOLAK':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            DITOLAK
          </span>
        );
      case 'MENUNGGU':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            MENUNGGU VERIFIKASI
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-signature-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">draw</span>
            </div>
            <div>
              <h3 id="modal-signature-title" className="text-base font-bold text-slate-800 dark:text-slate-100">
                Pratinjau Tanda Tangan Siswa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verifikasi keabsahan kehadiran peserta ujian
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup Modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Identity Card */}
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Identitas Siswa
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {nama}
                </h4>
              </div>
              <div>{renderStatusBadge()}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">NISN</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                  {nisn}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">Kelas / Rombel</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {kelas}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">Ruang Ujian</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {ruang}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">Waktu Submit</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatTimestamp(student.waktu_absen)}
                </span>
              </div>
            </div>
          </div>

          {/* Canvas Signature Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">signature</span>
                <span>Coretan Tanda Tangan Digital Siswa</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Format Canvas Base64 PNG
              </span>
            </div>

            <div className="relative rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white p-4 flex items-center justify-center min-h-[170px] shadow-inner overflow-hidden">
              {signatureDataUrl ? (
                <img
                  src={signatureDataUrl}
                  alt={`Tanda tangan ${nama}`}
                  className="max-h-[150px] max-w-full object-contain filter drop-shadow-xs transition-transform duration-200 hover:scale-105"
                />
              ) : (
                <div className="text-center p-4 text-slate-400">
                  <span className="material-symbols-outlined text-4xl block mb-1 text-slate-300">
                    ink_pen
                  </span>
                  <p className="text-xs font-medium">Belum ada rekaman tanda tangan digital</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>Tanda tangan di atas direkam langsung dari kanvas digital saat siswa memasuki sesi ujian.</span>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {onReject && (
              <button
                type="button"
                onClick={() => onReject(student)}
                disabled={isSubmitting || statusVerifikasi === 'DITOLAK'}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Tolak</span>
              </button>
            )}

            {onApprove && (
              <button
                type="button"
                onClick={() => onApprove(student)}
                disabled={isSubmitting || statusVerifikasi === 'DISETUJUI' || !signatureDataUrl}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                )}
                <span>Setujui Kehadiran</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalPratinjauTandaTangan;
