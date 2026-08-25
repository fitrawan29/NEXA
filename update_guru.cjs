const fs = require('fs');
let content = fs.readFileSync('views/GuruView.js', 'utf-8');

// Add import excel function and preview modal state
const importAndPreviewLogic = `
      // === Import Excel & Preview ===
      const fileInputRef = React.useRef(null);
      const [isPreviewOpen, setIsPreviewOpen] = useState(false);

      const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
            
            const payloadData = rows.map(row => {
              let opsiStr = null;
              if (row.tipe_soal === 'PG' || row.tipe_soal === 'PGK') {
                opsiStr = JSON.stringify([
                  { id: 'A', teks: row.opsi_A || '' },
                  { id: 'B', teks: row.opsi_B || '' },
                  { id: 'C', teks: row.opsi_C || '' },
                  { id: 'D', teks: row.opsi_D || '' },
                  { id: 'E', teks: row.opsi_E || '' }
                ]);
              }
              return {
                id_mapel: selectedMapel,
                npsn: user.npsn,
                tipe_soal: row.tipe_soal || 'PG',
                pertanyaan: row.pertanyaan || '',
                opsi: opsiStr,
                kunci_jawaban: row.kunci_jawaban ? String(row.kunci_jawaban) : '',
                bobot: row.bobot ? parseInt(row.bobot) : 10
              };
            });

            if (payloadData.length === 0) return alert('File Excel kosong atau format tidak sesuai.');
            
            const res = await api('import_soal_bulk', { data: payloadData, npsn: user.npsn });
            if (res.status === 'success') {
              alert(payloadData.length + ' soal berhasil diimpor!');
              fetchData();
            } else {
              alert(res.message);
            }
          } catch (err) {
            alert('Gagal memproses file: ' + err.message);
          }
          e.target.value = '';
        };
        reader.readAsBinaryString(file);
      };

      const renderPreviewModal = () => {
        if (!isPreviewOpen) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-outline-variant/30 dark:border-slate-700">
              <div className="p-4 border-b border-outline-variant dark:border-slate-700 flex justify-between items-center bg-surface-variant/30 dark:bg-slate-800/80">
                <h3 className="font-bold text-lg">Pratinjau Ujian</h3>
                <button onClick={() => setIsPreviewOpen(false)} className="text-on-surface-variant hover:bg-surface-variant rounded-full p-1"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {dataSoal.map((soal, idx) => (
                  <div key={soal.id_soal} className="p-4 border border-outline-variant rounded-xl shadow-sm">
                    <div className="font-bold mb-2 flex justify-between">
                      <span>Soal No. {idx + 1} ({soal.tipe_soal})</span>
                      <span className="text-sm font-normal text-slate-500">Bobot: {soal.bobot}</span>
                    </div>
                    <div className="mb-4 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />
                    {soal.tipe_soal === 'PG' && soal.opsi && (
                      <div className="space-y-2">
                        {soal.opsi.map(opt => (
                          <div key={opt.id} className={\`p-3 rounded-lg border \${soal.kunci_jawaban === opt.id ? 'bg-green-100 border-green-500' : 'border-outline-variant'}\`}>
                            <span className="font-bold mr-2">{opt.id}.</span> <span dangerouslySetInnerHTML={{ __html: opt.teks }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {soal.tipe_soal === 'URAIAN' && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <span className="text-slate-400 italic">Kolom jawaban siswa akan muncul di sini...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      };
      
      const [modalUraian, setModalUraian] = useState({ isOpen: false, logUjian: null, jawabanUraian: [] });`;

content = content.replace("const [modalUraian, setModalUraian] = useState({ isOpen: false, logUjian: null, jawabanUraian: [] });", importAndPreviewLogic);

// Inject buttons in header
const headerTarget = `<div className="flex flex-wrap gap-2">
                            <button onClick={() => setFormSoal({ isOpen: true, data: null })} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow">
                              <span className="material-symbols-outlined text-[18px]">add</span> Tambah Soal
                            </button>
                            <button onClick={() => setFormNarasi({ isOpen: true, data: null })} className="px-4 py-2 bg-secondary text-on-secondary rounded-xl font-bold hover:bg-secondary/90 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow">
                              <span className="material-symbols-outlined text-[18px]">subject</span> Tambah Narasi
                            </button>`;
const newHeaderTarget = `<div className="flex flex-wrap gap-2">
                            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleImportExcel} className="hidden" />
                            <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow">
                              <span className="material-symbols-outlined text-[18px]">upload_file</span> Import Excel
                            </button>
                            <button onClick={() => setIsPreviewOpen(true)} className="px-4 py-2 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow">
                              <span className="material-symbols-outlined text-[18px]">visibility</span> Pratinjau
                            </button>
                            <button onClick={() => setFormSoal({ isOpen: true, data: null })} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow">
                              <span className="material-symbols-outlined text-[18px]">add</span> Tambah Soal
                            </button>
                            <button onClick={() => setFormNarasi({ isOpen: true, data: null })} className="px-4 py-2 bg-secondary text-on-secondary rounded-xl font-bold hover:bg-secondary/90 transition-all flex items-center gap-2 text-sm shadow-sm hover:shadow">
                              <span className="material-symbols-outlined text-[18px]">subject</span> Tambah Narasi
                            </button>`;
content = content.replace(headerTarget, newHeaderTarget);

// Add renderPreviewModal to the end
const endTarget = `{renderAnalisisModal()}
          </main>
        </div>
      );
    };`;
const newEndTarget = `{renderAnalisisModal()}
            {renderPreviewModal()}
          </main>
        </div>
      );
    };`;
content = content.replace(endTarget, newEndTarget);

fs.writeFileSync('views/GuruView.js', content, 'utf-8');
console.log('Update GuruView.js selesai!');
