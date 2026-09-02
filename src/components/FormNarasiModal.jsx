import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';

const FormNarasiModal = ({ isOpen, data, onClose, onSave }) => {
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
  const [pertanyaan, setPertanyaan] = useState(data ? data.pertanyaan : '');
  
  const handleSave = () => {
    if (!pertanyaan.trim()) return alert('Isi wacana/narasi tidak boleh kosong.');
    onSave({
      tipe_soal: 'NARASI',
      pertanyaan: pertanyaan,
      bobot: 0,
      kunci_jawaban: '-',
      opsi: '[]',
      gambar: null,
      id_narasi: null
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{data ? 'Edit Wacana' : 'Tambah Wacana'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Isi Wacana / Narasi</label>
            <div className="bg-white dark:bg-slate-900 border rounded text-slate-800 dark:text-white">
              <ReactQuill theme="snow" value={pertanyaan} onChange={setPertanyaan} modules={modules} className="h-64 mb-12" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Wacana ini tidak akan dinilai (bobot 0) dan akan muncul sebagai stimulus/bacaan bersama bagi soal-soal yang terhubung kepadanya.</p>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg">
              <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">functions</span> Tips Menulis Rumus</h4>
              <p className="text-xs text-blue-600 dark:text-blue-400">Untuk mata pelajaran eksak, gunakan tombol <strong>fx</strong> di toolbar atas untuk memasukkan rumus dengan format KaTeX/LaTeX (contoh: <code>\sqrt{x^2+1}</code>). Anda juga dapat mengetik rumus langsung di editor dengan mengapitnya menggunakan <code>$$...$$</code> untuk rumus di baris baru, atau <code>\(...\)</code> untuk rumus menyatu dengan teks (MathJax).</p>
            </div>
          </div>
        </div>
        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold bg-slate-100 text-slate-800 hover:bg-slate-200">Batal</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold bg-gradient-to-r from-primary to-secondary text-on-primary hover:opacity-90">Simpan Wacana</button>
        </div>
      </div>
    </div>
  );
};

export default FormNarasiModal;
