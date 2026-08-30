import React, { useState, useEffect, useRef } from 'react';
    const ModalPeriksaUraian = ({ isOpen, logUjian, jawabanUraian, onClose, onSave }) => {
      if (!isOpen) return null;
      
      const [scores, setScores] = useState({});

      const handleSave = (isNext = false) => {
        let totalUraian = 0;
        for (let key in scores) {
          totalUraian += Number(scores[key] || 0);
        }
        onSave(totalUraian, isNext);
      };

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b dark:border-slate-700">
              <h2 className="text-2xl font-bold">Periksa Jawaban Uraian</h2>
              <p className="text-sm text-slate-500">Siswa: {logUjian?.nama_lengkap}</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {jawabanUraian.length === 0 ? (
                <div className="text-center text-slate-500">Tidak ada soal uraian untuk ujian ini.</div>
              ) : (
                jawabanUraian.map((j, idx) => (
                  <div key={idx} className="bg-surface-variant/20 p-4 rounded-xl border border-outline-variant">
                    <div className="font-bold mb-2">Soal {idx + 1}:</div>
                    <div className="text-sm mb-4" dangerouslySetInnerHTML={{ __html: j.pertanyaan }}></div>
                    <div className="font-bold text-primary mb-1">Jawaban Siswa:</div>
                    <div className="bg-surface dark:bg-slate-900 p-3 rounded text-sm mb-4 whitespace-pre-wrap">{j.jawaban_user || '-'}</div>
                    <div className="flex items-center gap-4">
                      <label className="font-bold">Skor Diberikan:</label>
                      <input type="number" min="0" value={scores[j.id_jawaban] !== undefined ? scores[j.id_jawaban] : ''} onChange={(e) => setScores({...scores, [j.id_jawaban]: e.target.value})} className="w-24 p-2 border rounded bg-surface dark:bg-slate-900" placeholder="0" />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-4">
              <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold bg-surface-variant hover:bg-surface-variant/80">Tutup</button>
              <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold bg-gradient-to-r from-primary to-secondary text-on-primary hover:from-primary/90 hover:to-secondary/90">Simpan Nilai Uraian</button>
            </div>
          </div>
        </div>
      );
    };

export default ModalPeriksaUraian;
