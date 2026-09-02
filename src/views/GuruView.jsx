import { fetchAPI, getTrueNow } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
import FormSoalModal from '../components/FormSoalModal.jsx';
import FormNarasiModal from '../components/FormNarasiModal.jsx';
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
      
      const [fotoProfil, setFotoProfil] = useState(user.foto || '');
      const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

      const PRESET_AVATARS = [
        'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Mimi',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Buster',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Jasper',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Bandit',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Cali',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Gizmo',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Sammy'
      ];

      const handleAvatarSelect = async (avatarUrl) => {
        setIsLoading(true);
        const res = await api('update_guru', { id_guru: user.id_guru, npsn: user.npsn, foto: avatarUrl });
        setIsLoading(false);
        if (res.status === 'success') {
          setFotoProfil(avatarUrl);
          setIsAvatarModalOpen(false);
        } else {
          alert(res.message);
        }
      };
      
      const [dataMapel, setDataMapel] = useState([]);
      const [dataKelas, setDataKelas] = useState([]);
    const [dataDashboard, setDataDashboard] = useState({ totalJadwal: 0, totalSelesai: 0, rataNilai: 0 });
    const [dataAudit, setDataAudit] = useState([]);
      const [selectedMapel, setSelectedMapel] = useState(null);
      const [dataSoal, setDataSoal] = useState([]);
      
      const [resetModal, setResetModal] = useState(null);
      const [monitoringPage, setMonitoringPage] = useState(1);
      const [filterMapelHasil, setFilterMapelHasil] = useState('');
      const [filterKelasHasil, setFilterKelasHasil] = useState('');
      const [skemaModal, setSkemaModal] = useState({ isOpen: false, id_mapel: null });
      const [skemaPenilaian, setSkemaPenilaian] = useState([]);
      const [preFormSoal, setPreFormSoal] = useState({ isOpen: false, id_mapel: '', target_kelas: '' });
      const [formSoal, setFormSoal] = useState({ isOpen: false, data: null, id_mapel: '' });

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

      const handleForceStop = async (id_log) => {
        if (!confirm('Anda yakin ingin menghentikan ujian peserta ini secara paksa?')) return;
        setIsLoading(true);
        const res = await api('force_stop_ujian', { id_log });
        if (res.status === 'success') fetchData();
        setIsLoading(false);
      };

      const handleResetJawaban = async (id_siswa, resetType) => {
        setIsLoading(true);
        const res = await api(resetType === 'total' ? 'reset_sesi_siswa' : 'reset_login_siswa', { id_siswa, npsn: user.npsn });
        if (res.status === 'success') {
          alert('Berhasil mereset akun peserta.');
          fetchData();
        } else {
          alert('Gagal: ' + res.message);
        }
        setIsLoading(false);
        setResetModal(null);
      };

      const handleSaveSoal = async (soalData) => {
        setIsLoading(true);
        let endpoint = formSoal.data ? 'update_soal_mapel' : 'create_soal_mapel';
        let payload = {
          ...soalData,
          npsn: user.npsn,
          id_mapel: formSoal.id_mapel,
        };
        if (formSoal.data) {
          payload.id_soal = formSoal.data.id_soal;
        } else {
          payload.id_soal = 'SOAL-' + Math.random().toString(36).substr(2, 9);
        }
        
        const res = await api(endpoint, payload);
        setIsLoading(false);
        if (res.status === 'success') {
          setFormSoal({ isOpen: false, data: null, id_mapel: '' });
          fetchData(); // refresh bank soal
        } else {
          alert('Gagal menyimpan soal: ' + res.message);
        }
      };
      
      const renderResetModal = () => {
         if (!resetModal) return null;
         return (
           <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-xl">
               <h3 className="font-bold text-lg mb-2">Pilih Metode Reset</h3>
               <p className="text-sm text-slate-500 mb-6">Pilih "Reset Login" jika siswa hanya terkeluar dari aplikasi. Pilih "Reset Total" untuk mengulang seluruh sesi dan menghapus jawaban siswa.</p>
               <div className="flex flex-col gap-3">
                 <button onClick={() => handleResetJawaban(resetModal.id_siswa, 'login')} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors">Reset Login Saja</button>
                 <button onClick={() => handleResetJawaban(resetModal.id_siswa, 'total')} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors">Reset Total (Hapus Jawaban)</button>
                 <button onClick={() => setResetModal(null)} className="w-full py-3 mt-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Batal</button>
               </div>
             </div>
           </div>
         );
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
        
        } else if (activeTab === 'logs') {
          const res = await api('get_audit_log', { filterGuru: guruId });
          if (res.status === 'success') setDataAudit(res.data);
        } else if (activeTab === 'bank_soal') {
          const res = await api('get_mapel_guru', { id_guru: guruId });
          if (res.status === 'success') {
            setDataMapel(res.data);
            if (!selectedMapel && res.data.length > 0) setSelectedMapel(res.data[0].id_mapel);
          }
          
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

      const handleUpdateStatusUjian = async (id_jadwal, status_baru) => {
        setIsLoading(true);
        let updates = {};
        const now = await getTrueNow();
        if (status_baru === 'AKTIF') {
          updates.waktu_mulai = new Date(now.getTime() - 60000).toISOString();
          const jadwal = dataJadwal.find(j => j.id_jadwal === id_jadwal);
          if (jadwal && new Date(jadwal.waktu_selesai) > now) {
            updates.waktu_selesai = jadwal.waktu_selesai;
          } else {
            updates.waktu_selesai = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
          }
        } else if (status_baru === 'SELESAI') {
          updates.waktu_selesai = new Date(now.getTime() - 60000).toISOString();
        } else if (status_baru === 'BELUM MULAI') {
          updates.waktu_mulai = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
          updates.waktu_selesai = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();
        }
        
        const res = await api('update_jadwal', { id_jadwal, ...updates });
        setIsLoading(false);
        if (res.status === 'success') {
          fetchData();
        } else {
          alert(res.message);
        }
      };

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
        <>
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/30 selection:text-primary">
          <div className="w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] px-6 pt-6 pb-6 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {fotoProfil ? (
                      <img src={fotoProfil} className="w-full h-full object-cover bg-white" />
                    ) : (
                      <span className="material-symbols-outlined text-white text-3xl">local_library</span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Portal Guru</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">NIP: {user.nip || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="relative p-1 rounded-full hover:bg-white/20 transition-colors" title="Mode Gelap/Terang">
                    <span className="material-symbols-outlined text-2xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                  </button>
                  
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              
              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Jadwal Mengawas</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {dataJadwal.map((j) => {
                       const isSelesai = j.status_ujian === 'SELESAI';
                       const isAktif = j.status_ujian === 'AKTIF';
                       const iconName = isAktif ? 'play_circle' : isSelesai ? 'check_circle' : 'schedule';
                       
                       return (
                          <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isAktif ? 'bg-green-100 text-green-500' : isSelesai ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-500'}`}>
                                <span className="material-symbols-outlined">{iconName}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className={`font-bold text-sm truncate ${isSelesai ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{j.nama_mapel}</h4>
                                <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')} - {j.target_kelas ? `Tingkat ${j.target_kelas}` : 'Umum'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 mt-3 md:mt-0">
                               <div className="flex gap-2">
                                 {j.status_ujian !== 'AKTIF' && j.status_ujian !== 'SELESAI' && <button onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'AKTIF')} className="px-3 py-1 bg-green-50 text-green-600 rounded text-xs font-bold hover:bg-green-100">Mulai Ujian</button>}
                                 {j.status_ujian === 'AKTIF' && <button onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'SELESAI')} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold hover:bg-slate-200">Akhiri Ujian</button>}
                                 {j.status_ujian === 'SELESAI' && <button onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'BELUM MULAI')} className="px-3 py-1 bg-orange-50 text-orange-600 rounded text-xs font-bold hover:bg-orange-100">Reset Status</button>}
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isAktif ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : isSelesai ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-600'}`}>
                                   {j.status_ujian}
                                 </span>
                                 {j.token && <span className="text-[10px] font-mono text-slate-400 font-bold">#{j.token}</span>}
                               </div>
                            </div>
                          </div>
                       );
                    })}
                    {dataJadwal.length === 0 && <div className="text-center text-sm text-slate-500 py-8">Belum ada jadwal mengawas.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'monitoring' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">Monitoring Ujian</h3>
                  <p className="text-xs text-slate-500 mb-4">Pilih jadwal ujian aktif untuk memantau status siswa yang sedang mengerjakan ujian secara real-time.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {dataJadwal.filter(j => j.status_ujian === 'AKTIF').map((j) => (
                       <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-primary/20 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-r from-primary to-secondary text-on-primary"></div>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">{j.nama_mapel}</h4>
                              <p className="text-xs text-slate-500">{j.target_kelas ? `Tingkat ${j.target_kelas}` : 'Umum'} | Token: <strong className="text-primary font-mono">{j.token}</strong></p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary flex items-center gap-1`}>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gradient-to-r from-primary to-secondary text-on-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r from-primary to-secondary text-on-primary"></span>
                              </span>
                              LIVE
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex justify-between items-center mb-4">
                             <div className="text-center flex-1">
                                <span className="block text-xl font-bold text-slate-700 dark:text-slate-200">{j.peserta?.length || 0}</span>
                                <span className="text-[10px] text-slate-500">Total Peserta</span>
                             </div>
                             <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                             <div className="text-center flex-1">
                                <span className="block text-xl font-bold text-green-500">{j.peserta?.filter(p => p.status === 'SELESAI').length || 0}</span>
                                <span className="text-[10px] text-slate-500">Selesai</span>
                             </div>
                          </div>
                          <button onClick={() => setSelectedJadwal(j)} className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors flex justify-center items-center gap-1">
                             Detail Monitoring <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </button>
                       </div>
                    ))}
                    {dataJadwal.filter(j => j.status_ujian === 'AKTIF').length === 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-2xl p-6 text-center">
                        <span className="material-symbols-outlined text-orange-400 text-4xl mb-2">monitoring</span>
                        <p className="text-sm font-bold text-orange-600 dark:text-orange-400">Tidak Ada Ujian Aktif</p>
                        <p className="text-xs text-orange-500/80 mt-1">Ujian aktif akan otomatis muncul di sini untuk dimonitoring.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'hasil' && (
                <div className="px-6 mt-6 animate-fade-in-up pb-24">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Hasil Evaluasi</h3>
                  
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4">
                     <select value={filterKelasHasil} onChange={(e) => setFilterKelasHasil(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-sm outline-none">
                       <option value="">-- Pilih Kelas --</option>
                       <option value="10">Kelas 10</option>
                       <option value="11">Kelas 11</option>
                       <option value="12">Kelas 12</option>
                       <option value="Umum">Umum</option>
                     </select>
                     <select value={filterMapelHasil} onChange={(e) => setFilterMapelHasil(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-sm outline-none">
                       <option value="">-- Pilih Mapel --</option>
                       {dataMapel.map(m => <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>)}
                     </select>
                  </div>

                  {!filterKelasHasil || !filterMapelHasil ? (
                    <div className="text-center text-slate-500 py-10">Silakan pilih Kelas dan Mata Pelajaran terlebih dahulu.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {dataJadwal.filter(j => j.status_ujian === 'SELESAI' && j.nama_mapel === filterMapelHasil && (j.target_kelas === filterKelasHasil || (!j.target_kelas && filterKelasHasil === 'Umum'))).map((j) => (
                         <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                            <h4 className="font-bold text-sm mb-1">{j.nama_mapel}</h4>
                            <p className="text-xs text-slate-500 mb-3">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')} | Kelas: {j.target_kelas || 'Umum'}</p>
                            <div className="flex gap-2">
                               <button onClick={() => { setSelectedJadwal(j); setActiveTab('monitoring'); }} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                                 Lihat Nilai
                               </button>
                               <button onClick={() => openAnalisisSoal(j.id_jadwal, j.id_mapel)} className="flex-1 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors">
                                 Analisis Butir
                               </button>
                            </div>
                         </div>
                      ))}
                      {dataJadwal.filter(j => j.status_ujian === 'SELESAI' && j.nama_mapel === filterMapelHasil && (j.target_kelas === filterKelasHasil || (!j.target_kelas && filterKelasHasil === 'Umum'))).length === 0 && <div className="col-span-full text-center text-sm text-slate-500 py-4">Belum ada hasil ujian untuk filter tersebut.</div>}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bank_soal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Bank Soal</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setFormNarasi({ isOpen: true, data: null })} className="bg-amber-50 text-amber-600 p-2 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1 text-sm font-bold" title="Tulis Wacana / Narasi Baru">
                          <span className="material-symbols-outlined text-xl">article</span>
                          <span className="hidden sm:inline">Tambah Narasi</span>
                        </button>
                        <button onClick={() => setPreFormSoal({ isOpen: true, id_mapel: '', target_kelas: '' })} className="bg-primary text-white p-2 rounded-xl hover:bg-primary-dark transition-colors flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">add</span>
                        </button>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                     {dataMapel.map((m, idx) => {
                        const isSelected = selectedMapel === m.id_mapel;
                        const color = getMapelColor(idx);
                        return (
                           <button 
                             key={m.id_mapel} 
                             onClick={() => setSelectedMapel(m.id_mapel)} 
                             className={`relative aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-all overflow-hidden ${isSelected ? `bg-gradient-to-br ${color.bg} text-white shadow-lg ring-4 ring-primary/30 scale-[1.02]` : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:shadow-md'}`}
                           >
                             <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-1 ${isSelected ? 'bg-white/20' : color.icon}`}>
                                <span className="material-symbols-outlined text-3xl">library_books</span>
                             </div>
                             <span className="font-bold text-center text-sm leading-tight">{m.nama_mapel}</span>
                             <span className={`text-xs px-3 py-1 rounded-full font-bold ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                               {isSelected ? dataSoal.length : (m.jumlah_soal || m.total_soal || 0)} Soal
                             </span>
                           </button>
                        );
                     })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-24">
                     {dataSoal.length === 0 ? (
                       <div className="col-span-full py-10 text-center text-slate-500">
                         <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                         <p className="text-sm">Belum ada soal untuk mata pelajaran ini</p>
                       </div>
                     ) : (
                       dataSoal.map((s, idx) => (
                         <div key={s.id_soal} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                           <div className="flex justify-between items-start mb-2">
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600`}>{s.tipe_soal || s.tipe}</span>
                             <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                               <button onClick={() => setFormSoal({ isOpen: true, data: s, id_mapel: s.id_mapel })} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                               <button onClick={() => deleteSoal(s.id_soal)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                             </div>
                           </div>
                           <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-2" dangerouslySetInnerHTML={{__html: s.pertanyaan}}></p>
                           <div className="text-xs text-slate-500 flex justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-2 mt-2">
                             <span className="truncate max-w-[150px]">{s.mata_pelajaran?.nama_mapel}</span>
                             <span>No. {(bankSoalPage - 1) * 20 + idx + 1}</span>
                           </div>
                         </div>
                       ))
                     )}
                  </div>
                </div>
              )}


               {activeTab === 'akun' && (
                  <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center pb-24">
                     <div className="relative group cursor-pointer mb-4" onClick={() => setIsAvatarModalOpen(true)}>
                       <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white shadow-lg overflow-hidden">
                         {fotoProfil ? <img src={fotoProfil} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-4xl text-slate-400 w-full h-full flex items-center justify-center">person</span>}
                       </div>
                       <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="material-symbols-outlined text-white">photo_camera</span>
                       </div>
                     </div>
                     <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1">{user.nama_lengkap}</h3>
                     <p className="text-sm text-slate-500 mb-6 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{user.nip || 'Guru'}</p>

                     <div className="w-full max-w-md flex flex-col gap-3">
                       <button onClick={() => setShowProfileModal(true)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95 transition-all">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500"><span className="material-symbols-outlined">person</span></div>
                           <div className="text-left"><h4 className="font-bold text-sm dark:text-white">Edit Profil</h4><p className="text-xs text-slate-500">Ubah foto dan password</p></div>
                         </div>
                         <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                       </button>

                       <button onClick={() => setActiveTab('logs')} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95 transition-all">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500"><span className="material-symbols-outlined">history</span></div>
                           <div className="text-left"><h4 className="font-bold text-sm dark:text-white">Log Aktivitas</h4><p className="text-xs text-slate-500">Riwayat aksi pada sistem</p></div>
                         </div>
                         <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                       </button>

                       <button onClick={() => {
                          const initialMapel = dataMapel.length > 0 ? dataMapel[0].id_mapel : null;
                          let skemaRecord = dataSoal.find(s => s.id_mapel === initialMapel && s.tipe_soal === 'SKEMA_PENILAIAN');
                          let initialSkema = { PG: 40, PGK: 30, BS: 10, JODOH: 10, URAIAN: 10 };
                          if(skemaRecord && skemaRecord.pertanyaan) {
                            try { initialSkema = JSON.parse(skemaRecord.pertanyaan); } catch(e){}
                          }
                          setSkemaPenilaian(initialSkema);
                          setSkemaModal({ isOpen: true, id_mapel: initialMapel });
                        }} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95 transition-all">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-500"><span className="material-symbols-outlined">grading</span></div>
                           <div className="text-left"><h4 className="font-bold text-sm dark:text-white">Skema Penilaian Khusus</h4><p className="text-xs text-slate-500">Atur bobot tipe soal</p></div>
                         </div>
                         <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                       </button>
                     </div>

                     <div className="w-full max-w-md mt-6">
                        <button onClick={onLogout} className="w-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm active:scale-95 transition-all border border-red-100 dark:border-red-900/30">
                          <span className="material-symbols-outlined">logout</span>
                          Keluar dari Akun
                        </button>
                     </div>
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div className="px-6 mt-6 animate-fade-in-up pb-24">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setActiveTab('akun')} className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors">
                          <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Log Aktivitas</h3>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                      {dataAudit.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                          <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history_toggle_off</span>
                          <p>Belum ada aktivitas yang dicatat.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[60vh] overflow-y-auto">
                          {dataAudit.map((log) => (
                            <div key={log.id_audit} className="p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-slate-500">
                                <span className="material-symbols-outlined text-[20px]">
                                  {log.aksi.toLowerCase().includes('login') ? 'login' :
                                   log.aksi.toLowerCase().includes('hapus') ? 'delete' :
                                   log.aksi.toLowerCase().includes('ubah') ? 'edit' :
                                   log.aksi.toLowerCase().includes('tambah') ? 'add_circle' : 'info'}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{log.aksi}</p>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{log.keterangan}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}


            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 md:px-12 py-3 flex justify-between md:justify-center md:gap-16 items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              
              
              <button onClick={() => setActiveTab('jadwal')} className={`flex flex-col items-center transition-colors ${activeTab === 'jadwal' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">event_note</span>
                <span className="text-[10px] font-bold mt-1">Jadwal</span>
              </button>
              <button onClick={() => setActiveTab('monitoring')} className={`flex flex-col items-center transition-colors ${activeTab === 'monitoring' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">visibility</span>
                <span className="text-[10px] font-bold mt-1">Pantau</span>
              </button>
              <button onClick={() => setActiveTab('hasil')} className={`flex flex-col items-center transition-colors ${activeTab === 'hasil' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">task</span>
                <span className="text-[10px] font-bold mt-1">Hasil</span>
              </button>
              <button onClick={() => setActiveTab('bank_soal')} className={`flex flex-col items-center transition-colors ${activeTab === 'bank_soal' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">dataset</span>
                <span className="text-[10px] font-bold mt-1">Soal</span>
              </button>
              <button onClick={() => setActiveTab('akun')} className={`flex flex-col items-center transition-colors ${activeTab === 'akun' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-bold mt-1">Akun</span>
              </button>
            </div>

            {/* Monitoring Modal */}
            {selectedJadwal && activeTab === 'monitoring' && (
              <div className="absolute inset-0 z-[60] bg-white dark:bg-slate-900 flex flex-col h-full animate-fade-in-up">
                 <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <button onClick={() => setSelectedJadwal(null)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{selectedJadwal.nama_mapel}</h3>
                      <p className="text-xs text-slate-500">Token Ujian: <span className="font-bold text-primary">{selectedJadwal.token}</span></p>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 pb-24">
                    <div className="flex justify-between items-center mb-4">
                       <h4 className="font-bold text-sm">Peserta Ujian ({dataLog.length})</h4>
                    </div>
                    
                    <div className="space-y-3">
                       {dataLog.length === 0 ? (
                         <div className="text-center text-slate-500 py-10">Belum ada siswa yang sedang mengerjakan.</div>
                       ) : (
                         dataLog.slice((monitoringPage - 1) * 20, monitoringPage * 20).map((log) => (
                           <div key={log.id_log} className="bg-white dark:bg-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-3 shadow-sm border border-slate-100 dark:border-slate-700">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold uppercase">{log.siswa?.nama_lengkap?.substring(0,2)}</div>
                               <div>
                                 <h5 className="font-bold text-sm dark:text-white">{log.siswa?.nama_lengkap}</h5>
                                 <p className="text-[10px] text-slate-500">Mulai: {new Date(log.waktu_mulai).toLocaleTimeString('id-ID')} | Status: <span className={`font-bold ${log.status_ujian === 'SELESAI' ? 'text-green-500' : 'text-blue-500'}`}>{log.status_ujian}</span></p>
                               </div>
                             </div>
                             {log.status_ujian === 'SEDANG KERJA' && (
                               <div className="flex gap-2 mt-3 md:mt-0">
                                 <button onClick={() => setResetModal({ id_log: log.id_log, id_siswa: log.id_siswa })} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">restart_alt</span> Reset</button>
                                 <button onClick={() => handleForceStop(log.id_log)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">stop_circle</span> Stop Paksa</button>
                               </div>
                             )}
                           </div>
                         ))
                       )}
                    </div>
                    {dataLog.length > 20 && (
                      <div className="flex justify-center mt-6 gap-2">
                        <button disabled={monitoringPage === 1} onClick={() => setMonitoringPage(monitoringPage - 1)} className="p-2 bg-white rounded-lg border border-slate-200 disabled:opacity-50"><span className="material-symbols-outlined">chevron_left</span></button>
                        <span className="px-4 py-2 font-bold text-sm">{monitoringPage} / {Math.ceil(dataLog.length / 20)}</span>
                        <button disabled={monitoringPage === Math.ceil(dataLog.length / 20)} onClick={() => setMonitoringPage(monitoringPage + 1)} className="p-2 bg-white rounded-lg border border-slate-200 disabled:opacity-50"><span className="material-symbols-outlined">chevron_right</span></button>
                      </div>
                    )}
                 </div>
              </div>
            )}
            
          </div>
        </div>

        
        {/* Profile Edit Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-lg dark:text-white">Edit Profil</h3>
                  <p className="text-xs text-slate-500">Ubah profil akun Anda</p>
                </div>
                <button onClick={() => setShowProfileModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Password Baru</label>
                  <input type="password" placeholder="Kosongkan jika tidak ingin diubah" value={profileForm.password} onChange={(e) => setProfileForm({...profileForm, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white" />
                </div>
              </div>
              <button onClick={handleProfileUpdate} disabled={profileLoading} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                {profileLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        )}

        {/* Avatar Modal */}
        {isAvatarModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="font-bold text-lg dark:text-white">Pilih Avatar</h3>
                   <p className="text-xs text-slate-500">Pilih karakter untuk foto profil Anda</p>
                </div>
                <button onClick={() => setIsAvatarModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-2">
                {PRESET_AVATARS.map((avatar, idx) => (
                  <button key={idx} onClick={() => handleAvatarSelect(avatar)} className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all ${fotoProfil === avatar ? 'border-primary ring-4 ring-primary/20 shadow-md scale-105 bg-white' : 'border-slate-100 dark:border-slate-700 hover:border-primary/50 bg-slate-50 dark:bg-slate-800'}`}>
                    <img src={avatar} className="w-full h-full object-cover p-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {renderAnalisisModal && typeof renderAnalisisModal === 'function' ? renderAnalisisModal() : null}
        {renderResetModal && typeof renderResetModal === 'function' ? renderResetModal() : null}
        {preFormSoal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg mb-4">Pilih Kelas & Mapel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Kelas</label>
                <select value={preFormSoal.target_kelas} onChange={(e) => setPreFormSoal({...preFormSoal, target_kelas: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <option value="">Pilih Kelas</option>
                  <option value="10">Kelas 10</option>
                  <option value="11">Kelas 11</option>
                  <option value="12">Kelas 12</option>
                  <option value="Umum">Umum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Mata Pelajaran</label>
                <select value={preFormSoal.id_mapel} onChange={(e) => setPreFormSoal({...preFormSoal, id_mapel: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <option value="">Pilih Mapel</option>
                  {dataMapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setPreFormSoal({ isOpen: false, id_mapel: '', target_kelas: '' })} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={() => {
                if(!preFormSoal.id_mapel || !preFormSoal.target_kelas) return alert('Pilih kelas dan mapel!');
                setPreFormSoal({ isOpen: false, id_mapel: '', target_kelas: '' });
                setFormSoal({ isOpen: true, data: null, id_mapel: preFormSoal.id_mapel });
              }} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark">Lanjut</button>
            </div>
          </div>
        </div>
        )}
        {skemaModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">Pengaturan Skema Penilaian</h3>
            <p className="text-sm text-slate-500 mb-4">Pengaturan ini akan dipisahkan dari tabel soal dan digunakan saat kalkulasi nilai akhir.</p>
            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-bold mb-1">Mata Pelajaran</label>
                 <select value={skemaModal.id_mapel} onChange={(e) => setSkemaModal({...skemaModal, id_mapel: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                   {dataMapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
                 </select>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Bobot PG (%)</label>
                   <input type="number" value={skemaPenilaian.PG || 40} onChange={e => setSkemaPenilaian({...skemaPenilaian, PG: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Bobot PGK (%)</label>
                   <input type="number" value={skemaPenilaian.PGK || 30} onChange={e => setSkemaPenilaian({...skemaPenilaian, PGK: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Bobot Benar/Salah (%)</label>
                   <input type="number" value={skemaPenilaian.BS || 10} onChange={e => setSkemaPenilaian({...skemaPenilaian, BS: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Bobot Menjodohkan (%)</label>
                   <input type="number" value={skemaPenilaian.JODOH || 10} onChange={e => setSkemaPenilaian({...skemaPenilaian, JODOH: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Bobot Uraian (%)</label>
                   <input type="number" value={skemaPenilaian.URAIAN || 10} onChange={e => setSkemaPenilaian({...skemaPenilaian, URAIAN: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg" />
                 </div>
               </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setSkemaModal({ isOpen: false, id_mapel: null })} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={() => saveSkema(skemaPenilaian)} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark">Simpan Skema</button>
            </div>
          </div>
        </div>
        )}
        <FormSoalModal isOpen={formSoal.isOpen} data={formSoal.data} narasiList={[]} onClose={() => setFormSoal({ isOpen: false, data: null, id_mapel: '' })} onSave={handleSaveSoal} />
        <FormNarasiModal isOpen={formNarasi.isOpen} data={formNarasi.data} onClose={() => setFormNarasi({ isOpen: false, data: null })} onSave={saveSoal} />
        </>
      );
    };

export default GuruView;





