    const GuruView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [activeTab, setActiveTab] = useState('jadwal');
      const [dataJadwal, setDataJadwal] = useState([]);
      const [selectedJadwal, setSelectedJadwal] = useState(null);
      const [dataLog, setDataLog] = useState([]);
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataAnalisis, setDataAnalisis] = useState([]);
      const [isAnalisisModalOpen, setIsAnalisisModalOpen] = useState(false);
      const [isLoading, setIsLoading] = useState(false);
      const [hasNotification, setHasNotification] = useState(false);
      
      const [dataMapel, setDataMapel] = useState([]);
      const [selectedMapel, setSelectedMapel] = useState(null);
      const [dataSoal, setDataSoal] = useState([]);
      const [formSoal, setFormSoal] = useState({ isOpen: false, data: null });
      const [formNarasi, setFormNarasi] = useState({ isOpen: false, data: null });
      const [soalSubTab, setSoalSubTab] = useState('soal');
      const [bankSoalPage, setBankSoalPage] = useState(1);
      const itemsPerPage = 10;
      
      
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
              let finalKunci = row.kunci_jawaban;
              if (row.tipe_soal === 'PG') {
                if (finalKunci === 'A') finalKunci = row.opsi_A;
                else if (finalKunci === 'B') finalKunci = row.opsi_B;
                else if (finalKunci === 'C') finalKunci = row.opsi_C;
                else if (finalKunci === 'D') finalKunci = row.opsi_D;
                else if (finalKunci === 'E') finalKunci = row.opsi_E;
              } else if (row.tipe_soal === 'PGK') {
                // PGK kunci could be "A,B". Need to convert to JSON array of strings
                try {
                   let keys = finalKunci.split(',').map(k => k.trim());
                   let mappedKeys = keys.map(k => {
                      if (k === 'A') return row.opsi_A;
                      if (k === 'B') return row.opsi_B;
                      if (k === 'C') return row.opsi_C;
                      if (k === 'D') return row.opsi_D;
                      if (k === 'E') return row.opsi_E;
                      return k;
                   });
                   finalKunci = JSON.stringify(mappedKeys);
                } catch(e) {}
              }
              if (row.tipe_soal === 'PG' || row.tipe_soal === 'PGK') {
                opsiStr = JSON.stringify([
                  row.opsi_A || '',
                  row.opsi_B || '',
                  row.opsi_C || '',
                  row.opsi_D || '',
                  row.opsi_E || ''
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
                    {soal.tipe_soal === 'PG' && soal.opsi && Array.isArray(soal.opsi) && (
                      <div className="space-y-2">
                        {soal.opsi.map((opt, oIdx) => (
                          <div key={oIdx} className={`p-3 rounded-lg border ${soal.kunci_jawaban === opt ? 'bg-green-100 border-green-500 dark:bg-green-900/40' : 'border-outline-variant dark:border-slate-700'}`}>
                            <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span> <span dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : opt.teks }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {soal.tipe_soal === 'PGK' && soal.opsi && Array.isArray(soal.opsi) && (
                      <div className="space-y-2">
                        {soal.opsi.map((opt, oIdx) => {
                           const isChecked = soal.kunci_jawaban && soal.kunci_jawaban.includes(opt);
                           return (
                              <div key={oIdx} className={`p-3 rounded-lg border ${isChecked ? 'bg-green-100 border-green-500 dark:bg-green-900/40' : 'border-outline-variant dark:border-slate-700'}`}>
                                <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span> <span dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : opt.teks }} />
                              </div>
                           );
                        })}
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
      
      const [modalUraian, setModalUraian] = useState({ isOpen: false, logUjian: null, jawabanUraian: [] });

      // === Profil State ===
      const [showProfileModal, setShowProfileModal] = useState(false);
      const [profileForm, setProfileForm] = useState({ password: '', foto: user.foto || '' });
      const [profileLoading, setProfileLoading] = useState(false);

      const guruId = user.id_guru || user.id_user;

      const fetchData = async () => {
        setIsLoading(true);
        if (activeTab === 'jadwal') {
          const res = await api('get_jadwal_pengawas', { id_guru: guruId });
          if (res.status === 'success') setDataJadwal(res.data);
        } else if (activeTab === 'pengumuman') {
          const res = await api('get_pengumuman', { role: 'guru' });
          if (res.status === 'success') setDataPengumuman(res.data);
        } else if (activeTab === 'monitoring' || activeTab === 'hasil') {
          const res = await api('get_jadwal_pengawas', { id_guru: guruId });
          if (res.status === 'success') setDataJadwal(res.data);
          if (selectedJadwal) {
            const endpoint = activeTab === 'hasil' ? 'get_hasil_ujian' : 'monitoring_ujian';
            const logRes = await api(endpoint, { id_jadwal: selectedJadwal });
            if (logRes.status === 'success') setDataLog(logRes.data);
          }
        } else if (activeTab === 'bank_soal') {
          const res = await api('get_mapel_guru', { id_guru: guruId });
          if (res.status === 'success') setDataMapel(res.data);
          
          if (selectedMapel) {
            const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
            if (soalRes.status === 'success') setDataSoal(soalRes.data);
          }
        }
        setIsLoading(false);
      };

      useEffect(() => {
        fetchData();
        let interval;
        if (activeTab === 'monitoring' && selectedJadwal) {
          interval = setInterval(fetchData, 5000);
        }
        return () => clearInterval(interval);
      }, [activeTab, selectedJadwal, selectedMapel]);

      useEffect(() => {
        if (window.MathJax) {
          setTimeout(() => {
            window.MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
          }, 100);
        }
      }, [dataSoal, activeTab, bankSoalPage, selectedMapel, modalUraian.isOpen, formSoal.isOpen, isAnalisisModalOpen]);

      const handleGenerateToken = async (id) => {
        const res = await api('get_token', { id_jadwal: id });
        if (res.status === 'success') {
          alert('Token Ujian: ' + res.token);
          fetchData();
        } else alert(res.message);
      };

      const handleBlock = async (idLog) => {
        if (!confirm('Blokir siswa ini?')) return;
        await api('catat_pelanggaran', { id_log: idLog });
        fetchData();
      };

      const handleUnblock = async (idLog) => {
        if (!confirm('Buka blokir siswa ini?')) return;
        await api('buka_blokir', { id_log: idLog });
        fetchData();
      };

      const saveSoal = async (payload) => {
        const endpoint = payload.id_soal ? 'update_soal_mapel' : 'create_soal_mapel';
        if (!payload.id_soal) {
          payload.id_soal = 'S-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        }
        payload.id_mapel = selectedMapel;
        const res = await api(endpoint, payload);
        if (res.status === 'success') {
          setFormSoal({ isOpen: false, data: null });
          setFormNarasi({ isOpen: false, data: null });
          fetchData();
        } else alert(res.message);
      };

      const saveSkema = async (payload) => {
        let skemaRecord = dataSoal.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
        payload.id_soal = skemaRecord ? skemaRecord.id_soal : 'SKEMA-' + selectedMapel;
        payload.tipe_soal = 'SKEMA_PENILAIAN';
        payload.id_mapel = selectedMapel;
        payload.pertanyaan = 'Skema Penilaian';
        
        const endpoint = skemaRecord ? 'update_soal_mapel' : 'create_soal_mapel';
        const res = await api(endpoint, payload);
        if (res.status === 'success') {
          alert('Skema penilaian berhasil disimpan.');
          fetchData();
        } else alert(res.message);
      };

      const deleteSoal = async (id) => {
        if (!confirm('Hapus soal ini?')) return;
        const res = await api('delete_soal_mapel', { id_soal: id });
        if (res.status === 'success') fetchData();
        else alert(res.message);
      };

      const openPeriksaUraian = async (logData) => {
        const res = await api('get_jawaban_uraian', { id_log: logData.id_log });
        if (res.status === 'success') {
          setModalUraian({ isOpen: true, logUjian: logData, jawabanUraian: res.data });
        } else {
          alert('Gagal mengambil jawaban uraian: ' + res.message);
        }
      };

      const saveNilaiUraian = async (totalNilai) => {
        const res = await api('update_nilai_uraian', { id_log: modalUraian.logUjian.id_log, nilai_uraian_total: totalNilai });
        if (res.status === 'success') {
          setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] });
          fetchData();
        } else alert(res.message);
      };

      // === Profil Handlers ===
      const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('Ukuran file maksimal 2MB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setProfileForm(prev => ({ ...prev, foto: ev.target.result }));
        reader.readAsDataURL(file);
      };

      const saveProfile = async () => {
        setProfileLoading(true);
        const updatePayload = { id_guru: guruId };
        if (profileForm.password.trim()) updatePayload.password = profileForm.password.trim();
        if (profileForm.foto) updatePayload.foto = profileForm.foto;
        
        const res = await api('update_profil_guru', updatePayload);
        setProfileLoading(false);
        if (res.status === 'success') {
          alert('Profil berhasil diperbarui!');
          setShowProfileModal(false);
          if (profileForm.foto) user.foto = profileForm.foto;
        } else {
          alert('Gagal memperbarui profil: ' + res.message);
        }
      };

      // === Color scheme for mapel cards by tingkatan ===
      const mapelCardColors = [
        { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'bg-blue-500/10 text-blue-500', border: 'border-blue-200 dark:border-blue-800' },
        { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'bg-emerald-500/10 text-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
        { bg: 'from-violet-500 to-violet-600', light: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', icon: 'bg-violet-500/10 text-violet-500', border: 'border-violet-200 dark:border-violet-800' },
        { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', icon: 'bg-amber-500/10 text-amber-500', border: 'border-amber-200 dark:border-amber-800' },
        { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', icon: 'bg-rose-500/10 text-rose-500', border: 'border-rose-200 dark:border-rose-800' },
        { bg: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', icon: 'bg-cyan-500/10 text-cyan-500', border: 'border-cyan-200 dark:border-cyan-800' },
      ];

      const getMapelColor = (index) => mapelCardColors[index % mapelCardColors.length];

      const openAnalisisSoal = async () => {
        if (!selectedJadwal) return alert('Pilih jadwal ujian terlebih dahulu.');
        const jadwalObj = dataJadwal.find(j => j.id_jadwal === selectedJadwal);
        if (!jadwalObj) return;
        setIsLoading(true);
        const res = await api('get_analisis_soal', { id_jadwal: selectedJadwal, id_mapel: jadwalObj.id_mapel });
        setIsLoading(false);
        if (res.status === 'success') {
          setDataAnalisis(res.data);
          setIsAnalisisModalOpen(true);
        } else {
          alert('Gagal memuat analisis soal: ' + res.message);
        }
      };

      const renderAnalisisModal = () => {
        if (!isAnalisisModalOpen) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700 max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-on-surface dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">analytics</span> Analisis Butir Soal</h2>
                <button onClick={() => setIsAnalisisModalOpen(false)} className="text-on-surface-variant hover:bg-surface-variant rounded-full p-1"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="flex-1 overflow-auto rounded-xl border border-outline-variant dark:border-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-variant/50 dark:bg-slate-900 sticky top-0 z-10">
                    <tr><th className="p-3 border-b border-outline-variant dark:border-slate-700">ID Soal</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 w-1/2">Pertanyaan</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-center">Tipe</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-center">Benar</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-center">Salah</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-right">Tingkat Kesukaran</th></tr>
                  </thead>
                  <tbody>
                    {dataAnalisis.length > 0 ? dataAnalisis.map((soal, idx) => (
                      <tr key={idx} className="border-b border-outline-variant/50 dark:border-slate-700/50 hover:bg-surface-variant/20 dark:hover:bg-slate-800">
                        <td className="p-3 text-sm">{soal.id_soal}</td>
                        <td className="p-3 text-sm truncate max-w-[200px]" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}></td>
                        <td className="p-3 text-center text-xs"><span className="bg-primary/10 text-primary px-2 py-1 rounded">{soal.tipe_soal}</span></td>
                        <td className="p-3 text-center text-green-600 font-bold">{soal.correct}</td>
                        <td className="p-3 text-center text-error font-bold">{soal.wrong}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${parseFloat(soal.difficulty) > 70 ? 'bg-green-100 text-green-700' : parseFloat(soal.difficulty) < 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {soal.difficulty}%
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6" className="p-6 text-center text-slate-500">Belum ada data pengerjaan untuk dianalisis.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      };

      const exportToExcel = () => {
        if (!dataLog || dataLog.length === 0) return alert('Tidak ada data untuk di-export');
        const exportData = dataLog.map((l, i) => ({
          'No': i + 1,
          'ID Siswa': l.id_siswa,
          'Nama Siswa': l.nama_lengkap,
          'Kelas': `${l.angkatan} ${l.kelas_paralel}`,
          'Status Ujian': l.status_ujian,
          'Pelanggaran': l.pelanggaran,
          'Nilai PG': l.nilai_auto,
          'Nilai Uraian': l.nilai_uraian,
          'Total Nilai': l.total_nilai
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hasil Ujian");
        const fileName = `Hasil_Ujian_${selectedJadwal}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);
      };

      return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/20 selection:text-primary">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] rounded-b-[40px] px-6 pt-8 pb-20 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl">school</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Guru</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">NIP : {user.id_user}</p>
                  </div>
                </div>
                <button className="relative">
                  <span className="material-symbols-outlined text-2xl">notifications</span>
                  {hasNotification && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-[#3ecf8e] rounded-full"></span>}
                </button>
              </div>
            </div>

            {/* Stats Cards (Overlapping) */}
            <div className="px-6 -mt-12 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-green-500">groups</span>
                  </div>
                  <span className="text-xl font-bold text-green-500">{dataJadwal.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Jadwal</span>
                  <span className="text-[10px] text-slate-400">Aktif</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-slate-100 dark:border-slate-700">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-blue-500">assignment</span>
                  </div>
                  <span className="text-xl font-bold text-blue-500">{dataMapel.length || 0}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Bank Soal</span>
                  <span className="text-[10px] text-slate-400">Tersedia</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-purple-500">analytics</span>
                  </div>
                  <span className="text-xl font-bold text-purple-500">{dataLog.length || 0}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Hasil</span>
                  <span className="text-[10px] text-slate-400">Ujian</span>
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Jadwal Ujian</h3>
                    <button onClick={fetchData} className="text-sm font-medium text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">refresh</span> Refresh</button>
                  </div>
                  <div className="space-y-3">
                      {dataJadwal.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada jadwal ujian saat ini.</div>
                      ) : (
                        dataJadwal.map((j, index) => {
                          let statusBtnClass = "bg-primary text-white";
                          let statusText = "Aktif";
                          if (j.status_ujian === 'SELESAI') {
                            statusBtnClass = "bg-slate-400 text-white cursor-not-allowed";
                            statusText = "Selesai";
                          } else {
                            statusBtnClass = "bg-green-500 text-white";
                            statusText = "Aktif";
                          }
                          
                          let iconClass = "text-primary bg-primary/10";
                          let iconName = "computer";
                          if (index % 3 === 1) { iconClass = "text-red-500 bg-red-500/10"; iconName = "menu_book"; }
                          if (index % 3 === 2) { iconClass = "text-blue-500 bg-blue-500/10"; iconName = "language"; }

                          return (
                            <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 }>
                                  <span className="material-symbols-outlined">{iconName}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{j.nama_mapel}</h4>
                                  <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                  {new Date(j.waktu_mulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(j.waktu_selesai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <span className={px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider }>
                                  {statusText}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                  </div>
                </div>
              )}

              {activeTab === 'monitoring' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Monitoring Ujian</h3>
                  <p className="text-sm text-slate-500 mb-4">Gunakan versi desktop untuk memantau ujian secara detail.</p>
                  <select className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 mb-4 text-sm font-bold text-slate-700" value={selectedJadwal || ''} onChange={(e) => setSelectedJadwal(e.target.value)}>
                    <option value="">-- Pilih Jadwal --</option>
                    {dataJadwal.map(j => (
                      <option key={j.id_jadwal} value={j.id_jadwal}>{j.nama_mapel}</option>
                    ))}
                  </select>
                  
                  {selectedJadwal && (
                     <div className="space-y-3">
                        {dataLog.map((log) => (
                          <div key={log.id_log} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                               <h4 className="font-bold text-sm">{log.siswa?.nama_lengkap}</h4>
                               <p className="text-xs text-slate-500">{log.siswa?.id_siswa}</p>
                            </div>
                            <div className={px-3 py-1 rounded-full text-[10px] font-bold uppercase }>
                               {log.status}
                            </div>
                          </div>
                        ))}
                        {dataLog.length === 0 && <div className="text-center text-sm text-slate-500">Belum ada siswa yang mengerjakan.</div>}
                     </div>
                  )}
                </div>
              )}

              {activeTab === 'hasil' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Hasil Ujian</h3>
                  <select className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 mb-4 text-sm font-bold text-slate-700" value={selectedJadwal || ''} onChange={(e) => setSelectedJadwal(e.target.value)}>
                    <option value="">-- Pilih Jadwal --</option>
                    {dataJadwal.map(j => (
                      <option key={j.id_jadwal} value={j.id_jadwal}>{j.nama_mapel}</option>
                    ))}
                  </select>

                  {selectedJadwal && (
                     <div className="space-y-3">
                        {dataLog.map((log) => (
                          <div key={log.id_log} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                               <h4 className="font-bold text-sm">{log.siswa?.nama_lengkap}</h4>
                               <p className="text-xs text-slate-500">{log.siswa?.id_siswa}</p>
                            </div>
                            <div className="font-bold text-lg text-primary">
                               {log.total_nilai}
                            </div>
                          </div>
                        ))}
                        {dataLog.length === 0 && <div className="text-center text-sm text-slate-500">Belum ada hasil ujian.</div>}
                     </div>
                  )}
                </div>
              )}

              {activeTab === 'bank_soal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Bank Soal</h3>
                  <p className="text-sm text-slate-500 mb-4">Buka di desktop untuk mengelola Bank Soal secara lengkap.</p>
                  <div className="space-y-3">
                    {dataMapel.map((m, idx) => (
                       <div key={m.id_mapel} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-blue-500">folder</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm">{m.nama_mapel}</h4>
                            <p className="text-xs text-slate-500">Mapel ID: {m.id_mapel}</p>
                          </div>
                       </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center">
                   <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                     <span className="material-symbols-outlined text-4xl text-primary">person</span>
                   </div>
                   <h3 className="font-bold text-xl">{user.nama_lengkap}</h3>
                   <p className="text-slate-500">{user.id_user}</p>
                   
                   <div className="w-full mt-8 space-y-3">
                      <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-slate-500">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">Mode Gelap</span>
                        </div>
                        <div className={w-10 h-6 rounded-full flex items-center p-1 }>
                          <div className={w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform }></div>
                        </div>
                      </button>
                      <button onClick={onLogout} className="w-full bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex items-center gap-3 shadow-sm text-red-500">
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-bold">Keluar</span>
                      </button>
                   </div>
                </div>
              )}

            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              <button onClick={() => setActiveTab('jadwal')} className={lex flex-col items-center transition-colors }>
                <span className="material-symbols-outlined">schedule</span>
                <span className="text-[10px] font-bold mt-1">Jadwal</span>
              </button>
              <button onClick={() => setActiveTab('monitoring')} className={lex flex-col items-center transition-colors }>
                <span className="material-symbols-outlined">visibility</span>
                <span className="text-[10px] font-bold mt-1">Monitor</span>
              </button>
              <button onClick={() => setActiveTab('hasil')} className={lex flex-col items-center transition-colors }>
                <span className="material-symbols-outlined">assessment</span>
                <span className="text-[10px] font-bold mt-1">Hasil</span>
              </button>
              <button onClick={() => setActiveTab('bank_soal')} className={lex flex-col items-center transition-colors }>
                <span className="material-symbols-outlined">folder</span>
                <span className="text-[10px] font-bold mt-1">Soal</span>
              </button>
              <button onClick={() => setActiveTab('akun')} className={lex flex-col items-center transition-colors }>
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-bold mt-1">Akun</span>
              </button>
            </div>
            
            {renderPreviewModal()}
            {renderAnalisisModal()}
          </div>
        </div>
      );
    };

    export default GuruView;
