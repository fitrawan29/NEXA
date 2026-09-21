import React, { useState, useEffect } from 'react';

const SkemaPenilaianPanel = ({ dataSoal = [], onSave }) => {
  const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
  const [mode, setMode] = useState('default'); // 'default' | 'custom'
  const [skema, setSkema] = useState(defaultSkema);

  useEffect(() => {
    const skemaRecord = dataSoal?.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
    if (skemaRecord && skemaRecord.kunci_jawaban) {
      let parsed = null;
      try {
        parsed = typeof window !== 'undefined' && window.safeJSONParse
          ? window.safeJSONParse(skemaRecord.kunci_jawaban, null)
          : JSON.parse(skemaRecord.kunci_jawaban);
      } catch {
        parsed = null;
      }
      if (parsed) {
        if (parsed.mode) {
          setMode(parsed.mode);
          if (parsed.skema) {
            setSkema({ ...defaultSkema, ...parsed.skema });
          }
        } else {
          // Legacy format where parsed object directly maps question types to numbers
          const hasCustomWeights = Object.values(parsed).some(v => parseFloat(v) > 0);
          setMode(hasCustomWeights ? 'custom' : 'default');
          setSkema({ ...defaultSkema, ...parsed });
        }
      }
    }
  }, [dataSoal]);

  const hitungTotalPersentase = () => {
    return Object.values(skema).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  };

  const handleSave = () => {
    if (mode === 'custom') {
      const total = hitungTotalPersentase();
      if (total !== 100) {
        alert(`Total persentase bobot skema khusus harus tepat 100%. Saat ini: ${total}%. Silakan sesuaikan kembali.`);
        return;
      }
      const payload = {
        kunci_jawaban: JSON.stringify({
          mode: 'custom',
          skema
        }),
        bobot: 1
      };
      onSave(payload);
    } else {
      const payload = {
        kunci_jawaban: JSON.stringify({
          mode: 'default',
          skema: defaultSkema
        }),
        bobot: 0
      };
      onSave(payload);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm p-5 sm:p-6">
      <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white mb-2">
        Pengaturan Skema Penilaian
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
        Pilih model perhitungan nilai akhir ujian: gunakan format default sekolah / admin atau skema bobot khusus mata pelajaran.
      </p>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setMode('default')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
            mode === 'default'
              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`material-symbols-outlined text-lg ${mode === 'default' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {mode === 'default' ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
            <span className="font-bold text-xs sm:text-sm">Format Default Sekolah / Admin</span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-80">
            Proporsional Poin Murni (Pure Proportional Points). Nilai akhir dihitung otomatis berdasarkan akumulasi perolehan bobot setiap butir soal tanpa persentase tipe soal.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
            mode === 'custom'
              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`material-symbols-outlined text-lg ${mode === 'custom' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {mode === 'custom' ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
            <span className="font-bold text-xs sm:text-sm">Skema Khusus Mata Pelajaran</span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-80">
            Atur bobot persentase custom untuk setiap tipe soal (PG, PGK, BS, JODOH, ISIAN, URAIAN). Total akumulasi wajib 100%.
          </p>
        </button>
      </div>

      {mode === 'default' ? (
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 mb-6 flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl shrink-0 mt-0.5">info</span>
          <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <p className="font-bold mb-0.5">Mode Default Sekolah Aktif</p>
            <p className="opacity-90">
              Input persentase dinonaktifkan. Seluruh tipe soal akan dinilai secara proporsional sesuai perolehan skor dan bobot poin yang ditentukan pada masing-masing butir soal.
            </p>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 transition-opacity ${mode === 'default' ? 'opacity-40 pointer-events-none' : ''}`}>
        {Object.keys(defaultSkema).map((tipe) => (
          <div key={tipe} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="w-28 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200">
              Tipe {tipe}
            </label>
            <div className="relative flex-1">
              <input
                type="number"
                disabled={mode === 'default'}
                value={skema[tipe]}
                onChange={(e) => setSkema({ ...skema, [tipe]: e.target.value })}
                className="w-full px-3 py-2 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                min="0"
                max="100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                %
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/80 dark:border-slate-700 pt-5">
        <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
          {mode === 'custom' ? (
            <>
              Total Persentase:{' '}
              <span className={`font-mono text-base ml-1 ${hitungTotalPersentase() === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {hitungTotalPersentase()}%
              </span>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Mode: Proporsional Poin Murni (Default Sekolah)
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          <span>Simpan Skema</span>
        </button>
      </div>
    </div>
  );
};

export default SkemaPenilaianPanel;
