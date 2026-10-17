import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * DigitalSignatureModal
 * 
 * Native HTML5 Canvas digital signature modal with:
 * - Zero external dependencies
 * - Touch & Pointer Events with CSS touch-action: none (prevents mobile page scroll)
 * - Pointer capture for uninterrupted drawing across borders
 * - High-DPI / Retina display resolution scaling via window.devicePixelRatio
 * - Stroke & pixel-density blank canvas rejection
 * - Base64 PNG export (data:image/png;base64,...)
 * - Student identity & integrity pledge display
 */
const DigitalSignatureModal = ({
  isOpen = true,
  studentInfo = {},
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef([]); // Array of strokes: [ [{x, y}, ...], ... ]
  const currentStrokeRef = useRef([]);
  const lastPointRef = useRef(null);

  const [hasSignature, setHasSignature] = useState(false);
  const [strokeStats, setStrokeStats] = useState({ strokeCount: 0, pointCount: 0 });
  const [canvasReady, setCanvasReady] = useState(false);

  // Initialize and resize canvas with High-DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Use container dimensions, fallback if zero during mount
    const width = Math.max(rect.width, 300);
    const height = Math.max(rect.height, 180);

    // Save existing strokes to restore after scale
    const existingStrokes = [...strokesRef.current];

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a'; // slate-900

    // Redraw existing strokes if canvas resized
    if (existingStrokes.length > 0) {
      existingStrokes.forEach(stroke => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
    }

    setCanvasReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure modal DOM container is fully measured
    const timer = setTimeout(() => {
      setupCanvas();
    }, 50);

    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, setupCanvas]);

  // Genuine non-blank signature verification algorithm
  const verifySignatureGenuine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    // 1. Stroke count and coordinate count check
    const totalStrokes = strokesRef.current.length;
    let totalPoints = 0;
    strokesRef.current.forEach(s => {
      totalPoints += s.length;
    });

    if (totalStrokes < 1 || totalPoints < 8) {
      return false;
    }

    // 2. Pixel verification via getImageData (Fail-safe for blank/trivial touches)
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let nonBlankPixels = 0;

      // Sample every 4th pixel for high performance
      for (let i = 3; i < data.length; i += 16) {
        if (data[i] > 30) { // Alpha channel > 30
          nonBlankPixels++;
          if (nonBlankPixels >= 35) {
            return true;
          }
        }
      }
      return nonBlankPixels >= 35;
    } catch (e) {
      // Fallback to stroke tracking if security policy restricts getImageData
      return totalStrokes >= 1 && totalPoints >= 10;
    }
  }, []);

  // Pointer event coordinate extractor
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e) => {
    if (isSubmitting) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {}

    isDrawingRef.current = true;
    const pt = getCoordinates(e);
    lastPointRef.current = pt;
    currentStrokeRef.current = [pt];

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || isSubmitting) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pt = getCoordinates(e);
    const last = lastPointRef.current;

    if (!last) {
      lastPointRef.current = pt;
      return;
    }

    // Distance threshold to filter micro-jitter
    const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
    if (dist < 1.5) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
    currentStrokeRef.current.push(pt);
  };

  const finishDrawing = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (e && e.pointerId) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current]);
      currentStrokeRef.current = [];
    }

    lastPointRef.current = null;

    // Update stats and check if signature meets genuine threshold
    const totalStrokes = strokesRef.current.length;
    let totalPoints = 0;
    strokesRef.current.forEach(s => { totalPoints += s.length; });

    setStrokeStats({ strokeCount: totalStrokes, pointCount: totalPoints });

    const isValid = verifySignatureGenuine();
    setHasSignature(isValid);
  };

  const handlePointerUp = (e) => {
    finishDrawing(e);
  };

  const handlePointerCancel = (e) => {
    finishDrawing(e);
  };

  // Clear canvas action
  const handleClear = () => {
    if (isSubmitting) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.resetTransform?.();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';

    strokesRef.current = [];
    currentStrokeRef.current = [];
    lastPointRef.current = null;
    isDrawingRef.current = false;

    setHasSignature(false);
    setStrokeStats({ strokeCount: 0, pointCount: 0 });
  };

  // Submit action
  const handleSubmit = () => {
    if (!hasSignature || isSubmitting) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Double check authenticity
    if (!verifySignatureGenuine()) {
      setHasSignature(false);
      return;
    }

    // Export crisp Base64 PNG data URL
    const signatureDataUrl = canvas.toDataURL('image/png');

    if (onSubmit) {
      onSubmit(signatureDataUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 select-none animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-dialog-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-in my-auto transition-all">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 sm:p-6 text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
              <span className="material-symbols-outlined text-2xl text-white">draw</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="signature-dialog-title" className="text-base sm:text-lg font-black tracking-tight leading-snug">
                Konfirmasi Kehadiran & Pakta Integritas
              </h2>
              <p className="text-xs text-emerald-100 font-medium truncate mt-0.5">
                Bubuhkan tanda tangan digital Anda untuk membuka sesi ujian
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          
          {/* Student Identity Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Nama Siswa</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate block mt-0.5">
                {studentInfo.nama || 'Peserta Ujian'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-medium block">NISN</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate block mt-0.5">
                {studentInfo.nisn || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Kelas / Rombel</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate block mt-0.5">
                {studentInfo.kelas || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Mata Pelajaran</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm truncate block mt-0.5">
                {studentInfo.nama_mapel || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Ruang Ujian</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate block mt-0.5">
                {studentInfo.ruang || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-medium block">Pengawas</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate block mt-0.5">
                {studentInfo.nama_guru || 'Pengawas Ruangan'}
              </span>
            </div>
          </div>

          {/* Integrity Pledge */}
          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">
              verified_user
            </span>
            <p className="text-[11px] sm:text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              <strong>Pakta Integritas:</strong> Saya menyatakan hadir secara sah dan berjanji akan mengerjakan ujian ini secara jujur, mandiri, mematuhi tata tertib, serta tidak melakukan segala bentuk kecurangan.
            </p>
          </div>

          {/* Canvas Signature Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <span>Coretan Tanda Tangan Siswa</span>
                <span className="text-rose-500 font-black">*</span>
              </label>

              <button
                type="button"
                onClick={handleClear}
                disabled={strokeStats.strokeCount === 0 || isSubmitting}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed py-1 px-2.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                <span>Bersihkan Coretan</span>
              </button>
            </div>

            {/* Canvas Box with Touch Isolation and High-DPI support */}
            <div 
              ref={containerRef}
              className="relative w-full h-44 sm:h-52 bg-white rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden shadow-inner flex items-center justify-center group transition-colors"
            >
              {/* Background Guide Watermark */}
              <div 
                className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300 ${
                  strokeStats.strokeCount > 0 ? 'opacity-0' : 'opacity-60'
                }`}
              >
                <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 dark:text-slate-600 mb-1">
                  edit_note
                </span>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Sentuh atau seret kursor untuk menandatangani di sini
                </span>
                <div className="w-3/4 border-b border-dashed border-slate-200 dark:border-slate-700 mt-4" />
              </div>

              {/* Native HTML5 Canvas Element */}
              <canvas
                ref={canvasRef}
                style={{ touchAction: 'none' }}
                className="w-full h-full cursor-crosshair touch-none relative z-10"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              />

              {/* Status Badge inside Canvas Box */}
              <div className="absolute bottom-2.5 right-2.5 z-20 pointer-events-none">
                {hasSignature ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold shadow-sm backdrop-blur-sm border border-emerald-200/80 dark:border-emerald-800">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    <span>Tanda Tangan Terisi</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100/90 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-bold shadow-sm backdrop-blur-sm border border-amber-200/80 dark:border-amber-800">
                    <span className="material-symbols-outlined text-xs">edit</span>
                    <span>Wajib Ditandatangani</span>
                  </span>
                )}
              </div>
            </div>
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">info</span>
              <span>Dukung sentuhan jari, stylus pen tablet, maupun kursor mouse desktop.</span>
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {hasSignature ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-base">verified</span>
                <span>Tanda tangan siap diverifikasi oleh pengawas.</span>
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">
                Silakan tanda tangani canvas di atas untuk mengaktifkan tombol mulai.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                Batal
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasSignature || isSubmitting}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none min-h-[44px] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  <span>Menyimpan Kehadiran...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">how_to_reg</span>
                  <span>Kirim Kehadiran & Mulai Ujian</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DigitalSignatureModal;
