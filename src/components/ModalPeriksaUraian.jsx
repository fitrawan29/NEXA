import React, { useState, useEffect } from 'react';

const ModalPeriksaUraian = ({ isOpen, logUjian, jawabanUraian = [], onClose, onSave }) => {
  if (!isOpen) return null;

  const [scores, setScores] = useState({});

  useEffect(() => {
    if (jawabanUraian && jawabanUraian.length > 0) {
      const initialScores = {};
      jawabanUraian.forEach((j) => {
        const key = j.id_jawaban || j.id_soal;
        initialScores[key] = j.skor !== undefined && j.skor !== null 
          ? j.skor 
          : (j.nilai !== undefined && j.nilai !== null ? j.nilai : '');
      });
      setScores(initialScores);
    } else {
      setScores({});
    }
  }, [jawabanUraian]);

  const handleScoreChange = (id, val) => {
    setScores(prev => ({
      ...prev,
      [id]: val
    }));
  };

  const handleSave = (isNext = false) => {
    let totalUraian = 0;
    for (let key in scores) {
      totalUraian += Number(scores[key] || 0);
    }
    onSave(totalUraian, isNext);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-700 animate-scale-up">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">Periksa Jawaban Uraian</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Siswa: <span className="font-semibold text-slate-700 dark:text-slate-200">{logUjian?.nama_lengkap || 'Peserta'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {jawabanUraian.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">description</span>
              Tidak ada soal uraian untuk ujian ini.
            </div>
          ) : (
            jawabanUraian.map((j, idx) => {
              const itemKey = j.id_jawaban || j.id_soal || idx;
              return (
                <div key={itemKey} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200">Soal {idx + 1}</span>
                    {j.bobot !== undefined && (
                      <span className="text-[11px] font-semibold text-slate-400">Maks. Bobot: {j.bobot}</span>
                    )}
                  </div>
                  <div 
                    className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed" 
                    dangerouslySetInnerHTML={{ __html: j.pertanyaan || j.soal || '-' }}
                  />
                  <div>
                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1 uppercase tracking-wider">
                      Jawaban Siswa:
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                      {j.jawaban_user || j.jawaban || '-'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Skor Diberikan:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={j.bobot || 100}
                      value={scores[itemKey] !== undefined ? scores[itemKey] : ''}
                      onChange={(e) => handleScoreChange(itemKey, e.target.value)}
                      className="w-24 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="0"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={() => handleSave(false)}
            className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Simpan Nilai Uraian</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalPeriksaUraian;
