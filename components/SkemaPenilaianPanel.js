    const SkemaPenilaianPanel = ({ dataSoal, onSave }) => {
      // Find the schema record if it exists
      const skemaRecord = dataSoal.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
      const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
      const currentSkema = skemaRecord && skemaRecord.kunci_jawaban ? { ...defaultSkema, ...JSON.parse(skemaRecord.kunci_jawaban) } : defaultSkema;

      const [skema, setSkema] = useState(currentSkema);

      const hitungTotalPersentase = () => {
        return Object.values(skema).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
      };

      const handleSave = () => {
        const total = hitungTotalPersentase();
        if (total !== 100 && total !== 0) {
          if (!confirm(`Total persentase adalah ${total}%. Apakah Anda yakin ingin menyimpan? Biasanya total harus 100%.`)) {
            return;
          }
        }
        
        let payload = {
          kunci_jawaban: JSON.stringify(skema),
          bobot: 0
        };
        onSave(payload);
      };

      return (
        <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4">Pengaturan Skema Penilaian</h3>
          <p className="text-sm text-slate-500 mb-6">
            Tentukan persentase nilai akhir berdasarkan tipe soal. Misalnya, jika Pilihan Ganda menyumbang 60% dan Uraian 40% dari nilai ujian.
            Biarkan 0 jika tipe soal tersebut tidak digunakan atau dinilai murni secara proporsional dari total bobot poin.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {Object.keys(defaultSkema).map(tipe => (
              <div key={tipe} className="flex items-center gap-4">
                <label className="w-32 font-bold text-sm">Tipe {tipe}</label>
                <div className="relative flex-1">
                  <input 
                    type="number" 
                    value={skema[tipe]} 
                    onChange={(e) => setSkema({ ...skema, [tipe]: e.target.value })}
                    className="w-full p-2 pr-8 border rounded bg-surface dark:bg-slate-900" 
                    min="0" 
                    max="100" 
                  />
                  <span className="absolute right-3 top-2 text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t border-outline-variant pt-6">
            <div className="font-bold">
              Total Persentase: <span className={`${hitungTotalPersentase() === 100 ? 'text-green-600' : 'text-red-600'}`}>{hitungTotalPersentase()}%</span>
            </div>
            <button onClick={handleSave} className="bg-primary text-on-primary hover:bg-primary/90 px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all">
              <span className="material-symbols-outlined">save</span> Simpan Skema
            </button>
          </div>
        </div>
      );
    };
