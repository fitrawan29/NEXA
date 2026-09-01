import { fetchAPI, getTrueNow } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
﻿    const GuruView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [activeTab, setActiveTab] = useState('beranda');
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
    const [dataDashboard, setDataDashboard] = useState({ totalJadwal: 0, totalSelesai: 0, rataNilai: 0 });
    const [dataAudit, setDataAudit] = useState([]);
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
        
        if (activeTab === 'beranda') {
          const res = await api('get_guru_dashboard_data', { id_guru: guruId });
          if (res.status === 'success') setDataDashboard(res.data);
        } else if (activeTab === 'jadwal') {
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
            <div className="bg-[#3ecf8e] rounded-b-[40px] px-6 pt-8 pb-20 relative text-white shadow-md z-0">
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

            {/* Stats Cards (Overlapping) */}
            <div className="px-6 -mt-12 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-green-500">event_note</span>
                  </div>
                  <span className="text-xl font-bold text-green-500">{dataJadwal.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Jadwal</span>
                  <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-slate-100 dark:border-slate-700">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-blue-500">task_alt</span>
                  </div>
                  <span className="text-xl font-bold text-blue-500">{dataJadwal.filter(j => j.status_ujian === 'SELESAI').length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Selesai</span>
                  <span className="text-[10px] text-slate-400">Ujian</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-purple-500">analytics</span>
                  </div>
                  <span className="text-xl font-bold text-purple-500">{(dataJadwal.reduce((acc, curr) => acc + (curr.peserta?.length || 0), 0) / (dataJadwal.length || 1)).toFixed(0)}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Avg</span>
                  <span className="text-[10px] text-slate-400">Peserta</span>
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              
              {activeTab === 'beranda' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Dashboard Guru</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                        <span className="material-symbols-outlined text-2xl">event_note</span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">Total Jadwal</p>
                        <h4 className="text-2xl font-bold dark:text-white">{dataDashboard.totalJadwal}</h4>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-500">
                        <span className="material-symbols-outlined text-2xl">task_alt</span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">Selesai Ujian</p>
                        <h4 className="text-2xl font-bold dark:text-white">{dataDashboard.totalSelesai} <span className="text-sm font-normal text-slate-400">Siswa</span></h4>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-500">
                        <span className="material-symbols-outlined text-2xl">monitoring</span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">Rata-rata Nilai</p>
                        <h4 className="text-2xl font-bold dark:text-white">{dataDashboard.rataNilai}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Hasil Evaluasi</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {dataJadwal.filter(j => j.status_ujian === 'SELESAI').map((j) => (
                       <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                          <h4 className="font-bold text-sm mb-1">{j.nama_mapel}</h4>
                          <p className="text-xs text-slate-500 mb-3">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')} | Kelas: {j.target_kelas ? `Tingkat ${j.target_kelas}` : 'Umum'}</p>
                          <div className="flex gap-2">
                             <button onClick={() => { setSelectedJadwal(j); setActiveTab('monitoring'); }} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:from-primary hover:to-secondary/20 transition-colors">
                               Lihat Nilai
                             </button>
                             <button className="py-2 px-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                               <span className="material-symbols-outlined text-[16px]">download</span>
                             </button>
                          </div>
                       </div>
                    ))}
                    {dataJadwal.filter(j => j.status_ujian === 'SELESAI').length === 0 && <div className="text-center text-sm text-slate-500 py-4">Belum ada hasil ujian.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'bank_soal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Bank Soal</h3>
                      <button onClick={() => setFormSoal({ isOpen: true, data: null })} className="bg-primary text-white p-2 rounded-xl hover:bg-primary-dark transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">add</span>
                      </button>
                    </div>
                    
                    <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
                       <button onClick={() => setSelectedMapel('all')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${selectedMapel === 'all' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>Semua Mapel</button>
                       {dataMapel.map(m => (
                          <button key={m.id_mapel} onClick={() => setSelectedMapel(m.id_mapel)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${selectedMapel === m.id_mapel ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>{m.nama_mapel}</button>
                       ))}
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
                               <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${s.tipe === 'PG' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{s.tipe === 'PG' ? 'Pilihan Ganda' : 'Uraian'}</span>
                               <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => setFormSoal({ isOpen: true, data: s })} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                                 <button onClick={() => handleDeleteSoal(s.id_soal)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                               </div>
                             </div>
                             <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-2">{s.pertanyaan?.replace(/<[^>]*>?/gm, '')}</p>
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
              
              <button onClick={() => setActiveTab('beranda')} className={`flex flex-col items-center transition-colors ${activeTab === 'beranda' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                  <span className="material-symbols-outlined">dashboard</span>
                  <span className="text-[10px] font-bold mt-1">Beranda</span>
              </button>
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
                 {/* Modal Header */}
                 <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <button onClick={() => setSelectedJadwal(null)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{selectedJadwal.nama_mapel}</h3>
                      <p className="text-xs text-slate-500">Pemantauan Peserta</p>
                    </div>
                 </div>
                 
                 {/* Modal Content */}
                 <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-4">
                       <h4 className="font-bold text-sm">Status Peserta Ujian</h4>
                       <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{selectedJadwal.peserta?.length || 0} Siswa</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-20">
                      {selectedJadwal.peserta?.map((p, idx) => {
                         const studentDetail = dataSiswa.find(s => s.id_user === p.id_siswa) || { nama_lengkap: 'Siswa ' + p.id_siswa, kelas: '-' };
                         const isSelesai = p.status === 'SELESAI';
                         const isAktif = p.status === 'AKTIF';
                         const pBadge = isAktif ? 'bg-green-100 text-green-600' : isSelesai ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600';
                         
                         return (
                           <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                   <span className="material-symbols-outlined text-slate-400">person</span>
                                 </div>
                                 <div>
                                    <h5 className="font-bold text-sm">{studentDetail.nama_lengkap}</h5>
                                    <p className="text-[10px] text-slate-500">Nilai: <strong className="text-slate-700 dark:text-slate-300">{p.nilai !== null ? p.nilai : '-'}</strong> | Jawaban: {p.jawaban ? Object.keys(p.jawaban).length : 0}</p>
                                 </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${pBadge}`}>{p.status}</span>
                           </div>
                         );
                      })}
                      {(!selectedJadwal.peserta || selectedJadwal.peserta.length === 0) && (
                        <div className="text-center text-sm text-slate-500 py-8 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">Belum ada peserta yang tergabung dalam ujian ini.</div>
                      )}
                    </div>
                 </div>
              </div>
            )}
            
          </div>
        </div>

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
        </>
      );
    };

export default GuruView;



