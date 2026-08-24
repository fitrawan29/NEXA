    const FormNarasiModal = ({ isOpen, data, onClose, onSave }) => {
      if (!isOpen) return null;
      const [pertanyaan, setPertanyaan] = useState(data ? data.pertanyaan : '');
      const [gambar, setGambar] = useState(data ? data.gambar : null);

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
        if (!pertanyaan && !gambar) return alert('Teks narasi atau gambar tidak boleh kosong.');
        let payload = {
          id_soal: data ? data.id_soal : 'NARASI-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          tipe_soal: 'NARASI',
          pertanyaan: pertanyaan,
          gambar: gambar,
          bobot: 0 // narasi does not have points
        };
        onSave(payload);
      };

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{data ? 'Edit Narasi' : 'Tambah Narasi'}</h2>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 mb-2">Narasi atau teks stimulus bersama dapat digunakan sebagai referensi untuk beberapa soal sekaligus (misalnya, satu wacana untuk soal 1-5).</p>
              <div>
                <label className="block text-sm font-bold mb-1">Teks Narasi</label>
                <div className="bg-surface dark:bg-slate-900 border rounded text-on-surface dark:text-white">
                  <ReactQuill theme="snow" value={pertanyaan} onChange={setPertanyaan} className="h-40 mb-12" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Gambar Pendukung (Opsional)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full p-2 border rounded bg-surface dark:bg-slate-900" />
                {gambar && <img src={gambar} alt="Preview Narasi" className="mt-2 max-h-40 rounded border" />}
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-4">
              <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold bg-surface-variant text-on-surface hover:bg-surface-variant/80">Batal</button>
              <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold bg-primary text-on-primary hover:bg-primary/90">Simpan Narasi</button>
            </div>
          </div>
        </div>
      );
    };
