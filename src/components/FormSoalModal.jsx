import ReactQuill from 'react-quill';
import React, { useState, useEffect, useRef } from 'react';
    const FormSoalModal = ({ isOpen, data, narasiList = [], onClose, onSave }) => {
      const modules = {
        toolbar: [
          [{ 'header': [1, 2, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
          ['link', 'image', 'formula'],
          ['clean']
        ],
      };
      if (!isOpen) return null;
      const savedDraft = !data ? window.safeJSONParse(localStorage.getItem('formSoalDraft'), {}) : {};
      const [tipe, setTipe] = useState(data ? data.tipe_soal : (savedDraft.tipe || 'PG'));
      const [pertanyaan, setPertanyaan] = useState(data ? data.pertanyaan : (savedDraft.pertanyaan || ''));
      const [idNarasi, setIdNarasi] = useState(data && data.id_narasi ? data.id_narasi : (savedDraft.idNarasi || ''));
      const [gambar, setGambar] = useState(data ? data.gambar : null);
      const [bobot, setBobot] = useState(data ? data.bobot : (savedDraft.bobot || 1));
      
      const [opsiPG, setOpsiPG] = useState(data && (data.tipe_soal==='PG' || data.tipe_soal==='PGK') ? window.safeJSONParse(data.opsi, ["","","","",""]) : (savedDraft.opsiPG || ['','','','','']));
      const [kunciPG, setKunciPG] = useState(data && data.tipe_soal==='PG' ? data.kunci_jawaban : (savedDraft.kunciPG || ''));
      const [kunciPGK, setKunciPGK] = useState(data && data.tipe_soal==='PGK' ? window.safeJSONParse(data.kunci_jawaban, []) : (savedDraft.kunciPGK || []));
      const [kunciBS, setKunciBS] = useState(data && data.tipe_soal==='BS' ? data.kunci_jawaban : (savedDraft.kunciBS || 'Benar'));
      
      const defaultPremis = [''];
      const defaultRespon = [''];
      const [premis, setPremis] = useState(data && data.tipe_soal==='JODOH' && data.opsi ? window.safeJSONParse(data.opsi, {}).premis || defaultPremis : (savedDraft.premis || defaultPremis));
      const [respon, setRespon] = useState(data && data.tipe_soal==='JODOH' && data.opsi ? window.safeJSONParse(data.opsi, {}).respon || defaultRespon : (savedDraft.respon || defaultRespon));
      const [kunciJodoh, setKunciJodoh] = useState(data && data.tipe_soal==='JODOH' ? window.safeJSONParse(data.kunci_jawaban, {}) : (savedDraft.kunciJodoh || {}));
      
      const [kunciIsian, setKunciIsian] = useState(data && data.tipe_soal==='ISIAN' ? data.kunci_jawaban : (savedDraft.kunciIsian || ''));
      
      // Auto-save logic
      React.useEffect(() => {
        if (!data) {
          const draft = { tipe, pertanyaan, idNarasi, bobot, opsiPG, kunciPG, kunciPGK, kunciBS, premis, respon, kunciJodoh, kunciIsian };
          localStorage.setItem('formSoalDraft', JSON.stringify(draft));
        }
      }, [tipe, pertanyaan, idNarasi, bobot, opsiPG, kunciPG, kunciPGK, kunciBS, premis, respon, kunciJodoh, kunciIsian, data]);

      const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (upload) => {
            setGambar(upload.target.result);
          };
          reader.readAsDataURL(file);
        }
      };

      const handleSave = () => {
        let payload = {
          id_soal: data ? data.id_soal : null,
          tipe_soal: tipe,
          pertanyaan: pertanyaan,
          id_narasi: idNarasi,
          gambar: gambar,
          bobot: bobot
        };

        if (tipe === 'PG') {
          payload.opsi = JSON.stringify(opsiPG);
          payload.kunci_jawaban = opsiPG[parseInt(kunciPG)];
          if (kunciPG === '') return alert('Pilih kunci jawaban PG.');
        } else if (tipe === 'PGK') {
          payload.opsi = JSON.stringify(opsiPG);
          payload.kunci_jawaban = JSON.stringify(kunciPGK.map(idx => opsiPG[idx]));
          if (kunciPGK.length < 2) return alert('Pilih minimal 2 kunci jawaban untuk PGK.');
        } else if (tipe === 'BS') {
          payload.opsi = JSON.stringify(['Benar', 'Salah']);
          payload.kunci_jawaban = kunciBS;
        } else if (tipe === 'JODOH') {
          payload.opsi = JSON.stringify({ premis, respon });
          payload.kunci_jawaban = JSON.stringify(kunciJodoh);
        } else if (tipe === 'ISIAN') {
          payload.opsi = null;
          payload.kunci_jawaban = kunciIsian;
        } else if (tipe === 'URAIAN') {
          payload.opsi = null;
          payload.kunci_jawaban = null;
        }

        onSave(payload);
        if (!data) localStorage.removeItem('formSoalDraft');
      };

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{data ? 'Edit Soal' : 'Tambah Soal'}</h2>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Tipe Soal</label>
                <select value={tipe} onChange={(e) => setTipe(e.target.value)} disabled={!!data} className="w-full p-2 border rounded bg-white dark:bg-slate-900">
                  <option value="PG">Pilihan Ganda (PG)</option>
                  <option value="PGK">Pilihan Ganda Kompleks (PGK)</option>
                  <option value="BS">Benar / Salah (BS)</option>
                  <option value="JODOH">Menjodohkan</option>
                  <option value="ISIAN">Isian Singkat</option>
                  <option value="URAIAN">Uraian</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Pilih Narasi / Stimulus Bersama (Opsional)</label>
                <select value={idNarasi} onChange={(e) => setIdNarasi(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900">
                  <option value="">-- Tanpa Narasi Bersama --</option>
                  {narasiList.map(n => (
                    <option key={n.id_soal} value={n.id_soal}>ID: {n.id_soal} - {n.pertanyaan.substring(0, 50)}...</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Gunakan ini jika soal ini merujuk pada bacaan/stimulus yang sama dengan soal lain.</p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Pertanyaan / Instruksi Spesifik</label>
                <div className="bg-white dark:bg-slate-900 border rounded text-slate-800 dark:text-white">
                  <ReactQuill theme="snow" value={pertanyaan} onChange={setPertanyaan} modules={modules} className="h-32 mb-12" />
                </div>
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg">
                  <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">functions</span> Tips Menulis Rumus</h4>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Gunakan tombol <strong>fx</strong> di toolbar untuk menulis rumus (KaTeX), atau ketik langsung dengan mengapit rumus menggunakan <code>$$...$$</code> untuk baris baru atau <code>\(...\)</code> untuk rumus menyatu dengan teks (MathJax).</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Gambar (Opsional)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full p-2 border rounded bg-white dark:bg-slate-900" />
                {gambar && <img src={gambar} alt="Preview" className="mt-2 max-h-32 rounded border" />}
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Bobot Nilai</label>
                <input type="number" value={bobot} onChange={(e) => setBobot(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900" min="1" />
              </div>

              {/* PG / PGK */}
              {(tipe === 'PG' || tipe === 'PGK') && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold mb-1">Opsi Jawaban & Kunci</label>
                  {opsiPG.map((o, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      {tipe === 'PG' ? (
                        <input type="radio" name="kunciPG" value={idx} checked={String(kunciPG) === String(idx) || (data && opsiPG[idx] === data.kunci_jawaban)} onChange={() => setKunciPG(idx)} />
                      ) : (
                        <input type="checkbox" checked={kunciPGK.includes(idx) || (data && window.safeJSONParse(data.kunci_jawaban, []).includes(opsiPG[idx]))} onChange={(e) => {
                          if (e.target.checked) setKunciPGK([...kunciPGK, idx]);
                          else setKunciPGK(kunciPGK.filter(i => i !== idx));
                        }} />
                      )}
                      <input type="text" value={o} onChange={(e) => { const newOpsi = [...opsiPG]; newOpsi[idx] = e.target.value; setOpsiPG(newOpsi); }} className="flex-1 p-2 border rounded bg-white dark:bg-slate-900" placeholder={`Opsi ${String.fromCharCode(65+idx)}`} />
                    </div>
                  ))}
                </div>
              )}

              {/* BS */}
              {tipe === 'BS' && (
                <div>
                  <label className="block text-sm font-bold mb-1">Kunci Jawaban</label>
                  <select value={kunciBS} onChange={(e) => setKunciBS(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900">
                    <option value="Benar">Benar</option>
                    <option value="Salah">Salah</option>
                  </select>
                </div>
              )}

              {/* JODOH */}
              {tipe === 'JODOH' && (
                <div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">Premis (Bagian A)</label>
                      {premis.map((p, idx) => (
                        <input key={idx} type="text" value={p} onChange={(e) => { const newP = [...premis]; newP[idx] = e.target.value; setPremis(newP); }} className="w-full p-2 border rounded mb-2 bg-white dark:bg-slate-900" />
                      ))}
                      <button onClick={() => setPremis([...premis, ''])} className="text-sm text-primary">+ Tambah Premis</button>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">Respon (Bagian B)</label>
                      {respon.map((r, idx) => (
                        <input key={idx} type="text" value={r} onChange={(e) => { const newR = [...respon]; newR[idx] = e.target.value; setRespon(newR); }} className="w-full p-2 border rounded mb-2 bg-white dark:bg-slate-900" />
                      ))}
                      <button onClick={() => setRespon([...respon, ''])} className="text-sm text-primary">+ Tambah Respon</button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-bold mb-1">Kunci Pasangan</label>
                    {premis.map((p, idx) => p && (
                      <div key={idx} className="flex gap-2 items-center mb-2">
                        <span className="flex-1">{p}</span>
                        <span>&rarr;</span>
                        <select value={kunciJodoh[p] || ''} onChange={(e) => setKunciJodoh({...kunciJodoh, [p]: e.target.value})} className="flex-1 p-2 border rounded bg-white dark:bg-slate-900">
                          <option value="">Pilih Respon...</option>
                          {respon.map((r, i) => r && <option key={i} value={r}>{r}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ISIAN */}
              {tipe === 'ISIAN' && (
                <div>
                  <label className="block text-sm font-bold mb-1">Kunci Jawaban Isian</label>
                  <input type="text" value={kunciIsian} onChange={(e) => setKunciIsian(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900" />
                </div>
              )}

            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-4">
              <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold bg-white-variant text-slate-800 hover:bg-white-variant/80">Batal</button>
              <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold bg-gradient-to-r from-primary to-secondary text-on-primary text-on-primary hover:from-primary/90 hover:to-secondary/90">Simpan Soal</button>
            </div>
          </div>
        </div>
      );
    };

export default FormSoalModal;

