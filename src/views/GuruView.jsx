import { fetchAPI, getTrueNow } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
import FormSoalModal from '../components/FormSoalModal.jsx';
import FormNarasiModal from '../components/FormNarasiModal.jsx';
import * as XLSX from 'xlsx';
    const GuruView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };

      const logActivity = async (action, target) => {
        try {
          await api('create_audit_log', {
            username: user.username || user.nama_lengkap,
            role: 'guru',
            action,
            target
          });
        } catch (e) {
          console.error('Failed to log activity:', e);
        }
      };

      const [activeTab, setActiveTab] = useState('dashboard');
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
          logActivity('UPDATE AVATAR', 'Memperbarui foto profil avatar akun guru');
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
      
      // Hasil Evaluasi State
      const [filterMapelHasil, setFilterMapelHasil] = useState('ALL');
      const [filterKelasHasil, setFilterKelasHasil] = useState('');
      const [filterParalelHasil, setFilterParalelHasil] = useState([]); // Multi-select array
      const [selectedHasilJadwal, setSelectedHasilJadwal] = useState(null);
      const [dataHasilSiswa, setDataHasilSiswa] = useState([]);
      const [isHasilModalOpen, setIsHasilModalOpen] = useState(false);
      const [filterHasilParalelDetail, setFilterHasilParalelDetail] = useState('ALL');
      const [searchHasilSiswa, setSearchHasilSiswa] = useState('');

      // Log Aktivitas State
      const [activeLogSubTab, setActiveLogSubTab] = useState('aktif'); // 'aktif' | 'arsip'
      const [dataAuditArchive, setDataAuditArchive] = useState([]);
      const [isArchivingLog, setIsArchivingLog] = useState(false);

      const [skemaModal, setSkemaModal] = useState({ isOpen: false, id_mapel: null });
      const [skemaPenilaian, setSkemaPenilaian] = useState([]);
      const [preFormSoal, setPreFormSoal] = useState({ isOpen: false, id_mapel: '', target_kelas: '', target_paralel: [] });
      const [formSoal, setFormSoal] = useState({ isOpen: false, data: null, id_mapel: '' });

      const [formNarasi, setFormNarasi] = useState({ isOpen: false, data: null });
      const [soalSubTab, setSoalSubTab] = useState('soal');
      const [bankSoalPage, setBankSoalPage] = useState(1);
      const itemsPerPage = 10;
      
      
      // === Import Excel & Preview ===
      const fileInputRef = React.useRef(null);
      const [isPreviewOpen, setIsPreviewOpen] = useState(false);

      const downloadTemplateSoal = () => {
        const templateData = [
          {
            wacana: 'Thomas Edison adalah seorang penemu Amerika...',
            tipe_soal: 'PG',
            pertanyaan: 'Siapakah penemu mesin uap?',
            opsi_A: 'James Watt',
            opsi_B: 'Isaac Newton',
            opsi_C: 'Albert Einstein',
            opsi_D: 'Thomas Edison',
            opsi_E: 'Nikola Tesla',
            kunci_jawaban: 'A',
            bobot: 10
          },
          {
            wacana: '',
            tipe_soal: 'PGK',
            pertanyaan: 'Manakah di bawah ini yang merupakan bilangan genap? (Jawaban lebih dari satu)',
            opsi_A: '2',
            opsi_B: '3',
            opsi_C: '4',
            opsi_D: '7',
            opsi_E: '8',
            kunci_jawaban: 'A,C,E',
            bobot: 10
          },
          {
            wacana: '',
            tipe_soal: 'BS',
            pertanyaan: 'Ibukota negara Indonesia adalah Jakarta.',
            opsi_A: '',
            opsi_B: '',
            opsi_C: '',
            opsi_D: '',
            opsi_E: '',
            kunci_jawaban: 'Benar',
            bobot: 5
          },
          {
            wacana: '',
            tipe_soal: 'JODOH',
            pertanyaan: 'Jodohkan negara dengan benuanya!',
            opsi_A: 'Indonesia=Asia',
            opsi_B: 'Jerman=Eropa',
            opsi_C: 'Mesir=Afrika',
            opsi_D: 'Brasil=Amerika',
            opsi_E: '',
            kunci_jawaban: 'Indonesia=Asia, Jerman=Eropa, Mesir=Afrika, Brasil=Amerika',
            bobot: 10
          },
          {
            wacana: '',
            tipe_soal: 'ISIAN',
            pertanyaan: 'Siapakah presiden pertama Indonesia?',
            opsi_A: '',
            opsi_B: '',
            opsi_C: '',
            opsi_D: '',
            opsi_E: '',
            kunci_jawaban: 'Soekarno',
            bobot: 10
          },
          {
            wacana: '',
            tipe_soal: 'URAIAN',
            pertanyaan: 'Jelaskan mengapa langit berwarna biru!',
            opsi_A: '',
            opsi_B: '',
            opsi_C: '',
            opsi_D: '',
            opsi_E: '',
            kunci_jawaban: '-',
            bobot: 20
          }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Soal");
        XLSX.writeFile(wb, "Template_Soal_NEXA.xlsx");
      };

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
              
              let finalPertanyaan = row.pertanyaan || '';
              if (row.wacana) {
                 finalPertanyaan = `<strong>Wacana:</strong><br/>${row.wacana}<br/><br/>${finalPertanyaan}`;
              }

              if (row.tipe_soal === 'PG') {
                if (finalKunci === 'A') finalKunci = row.opsi_A;
                else if (finalKunci === 'B') finalKunci = row.opsi_B;
                else if (finalKunci === 'C') finalKunci = row.opsi_C;
                else if (finalKunci === 'D') finalKunci = row.opsi_D;
                else if (finalKunci === 'E') finalKunci = row.opsi_E;
              } else if (row.tipe_soal === 'PGK') {
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
              } else if (row.tipe_soal === 'JODOH') {
                let premis = [];
                let respon = [];
                let kunci = {};
                const parseJodoh = (val) => {
                  if(!val) return;
                  const parts = String(val).split('=');
                  if (parts.length === 2) {
                     const p = parts[0].trim();
                     const r = parts[1].trim();
                     if(p && !premis.includes(p)) premis.push(p);
                     if(r && !respon.includes(r)) respon.push(r);
                  }
                };
                parseJodoh(row.opsi_A); parseJodoh(row.opsi_B); parseJodoh(row.opsi_C); parseJodoh(row.opsi_D); parseJodoh(row.opsi_E);
                opsiStr = JSON.stringify({ premis, respon });

                if (finalKunci) {
                   String(finalKunci).split(',').forEach(pair => {
                      const parts = pair.split('=');
                      if (parts.length === 2) {
                         kunci[parts[0].trim()] = parts[1].trim();
                      }
                   });
                   finalKunci = JSON.stringify(kunci);
                }
              } else if (row.tipe_soal === 'ISIAN') {
                 if (finalKunci) finalKunci = String(finalKunci).trim();
              }

              return {
                id_mapel: selectedMapel,
                npsn: user.npsn,
                tipe_soal: row.tipe_soal || 'PG',
                pertanyaan: finalPertanyaan,
                opsi: opsiStr,
                kunci_jawaban: finalKunci ? String(finalKunci) : '',
                bobot: row.bobot ? parseInt(row.bobot) : 10
              };
            });

            if (payloadData.length === 0) return alert('File Excel kosong atau format tidak sesuai.');
            
            const res = await api('import_soal_bulk', { data: payloadData, npsn: user.npsn });
            if (res.status === 'success') {
              alert(payloadData.length + ' soal berhasil diimpor!');
              const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
              logActivity('IMPORT SOAL', `Import ${payloadData.length} butir soal Excel pada mapel ${mapelNama}`);
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
        if (res.status === 'success') {
          logActivity('STOP PAKSA SISWA', `Menghentikan paksa ujian siswa pada sesi ${id_log}`);
          fetchData();
        }
        setIsLoading(false);
      };

      const handleResetJawaban = async (id_siswa, resetType) => {
        setIsLoading(true);
        const res = await api(resetType === 'total' ? 'reset_sesi_siswa' : 'reset_login_siswa', { id_siswa, npsn: user.npsn });
        if (res.status === 'success') {
          alert('Berhasil mereset akun peserta.');
          logActivity('RESET SESI SISWA', `Reset sesi peserta (ID Siswa: ${id_siswa}, tipe: ${resetType})`);
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
          const actName = formSoal.data ? 'EDIT SOAL' : 'TAMBAH SOAL';
          const mapelNama = dataMapel.find(m => m.id_mapel === formSoal.id_mapel)?.nama_mapel || formSoal.id_mapel;
          logActivity(actName, `${actName} (${payload.tipe_soal}) pada mapel ${mapelNama}`);
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

        // Selalu muat data kelas untuk filter kelas & paralel
        const resKelas = await api('get_kelas', {});
        if (resKelas.status === 'success') setDataKelas(resKelas.data || []);
        
        if (activeTab === 'jadwal' || activeTab === 'dashboard' || activeTab === 'kontrol') {
          const res = await api('get_jadwal_pengawas', { id_guru: guruId });
          if (res.status === 'success') setDataJadwal(res.data);
          if (activeTab === 'dashboard') {
             const resMapel = await api('get_mapel_guru', { id_guru: guruId });
             if (resMapel.status === 'success') setDataMapel(resMapel.data);
          }
        } else if (activeTab === 'pengumuman') {
          const res = await api('get_pengumuman', { role: 'guru' });
          if (res.status === 'success') setDataPengumuman(res.data);
        } else if (activeTab === 'monitoring' || activeTab === 'hasil') {
          const res = await api('get_jadwal_pengawas', { id_guru: guruId });
          if (res.status === 'success') setDataJadwal(res.data);
          
          const resMapel = await api('get_mapel_guru', { id_guru: guruId });
          if (resMapel.status === 'success') setDataMapel(resMapel.data);

          if (selectedJadwal && activeTab === 'monitoring') {
            const endpoint = 'monitoring_ujian';
            const logRes = await api(endpoint, { id_jadwal: typeof selectedJadwal === 'object' ? selectedJadwal.id_jadwal : selectedJadwal });
            if (logRes.status === 'success') setDataLog(logRes.data);
          }
        
        } else if (activeTab === 'logs') {
          const res = await api('get_audit_log', { username: user.username });
          if (res.status === 'success') setDataAudit(res.data || []);
          const resArc = await api('get_audit_log_archive', { username: user.username });
          if (resArc.status === 'success') setDataAuditArchive(resArc.data || []);
        } else if (activeTab === 'bank_soal') {
          const res = await api('get_mapel_guru', { id_guru: guruId });
          if (res.status === 'success') {
            setDataMapel(res.data);
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
          const mapelNama = dataJadwal.find(j => j.id_jadwal === id_jadwal)?.nama_mapel || id_jadwal;
          logActivity('STATUS UJIAN', `Mengubah status ujian ${mapelNama} menjadi ${status_baru}`);
          fetchData();
        } else {
          alert(res.message);
        }
      };

      const handleGenerateToken = async (id) => {
        const res = await api('get_token', { id_jadwal: id });
        if (res.status === 'success') {
          alert('Token Ujian: ' + res.token);
          logActivity('GENERATE TOKEN', `Membuat token ujian baru untuk jadwal ID ${id}`);
          fetchData();
        } else alert(res.message);
      };

      const handleBlock = async (idLog) => {
        if (!confirm('Blokir siswa ini?')) return;
        await api('catat_pelanggaran', { id_log: idLog });
        logActivity('BLOKIR SISWA', `Memblokir sesi ujian siswa (ID Log: ${idLog})`);
        fetchData();
      };

      const handleUnblock = async (idLog) => {
        if (!confirm('Buka blokir siswa ini?')) return;
        await api('buka_blokir', { id_log: idLog });
        logActivity('BUKA BLOKIR', `Membuka blokir sesi ujian siswa (ID Log: ${idLog})`);
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
          const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
          logActivity(payload.id_soal ? 'EDIT WACANA' : 'TAMBAH WACANA', `Menyimpan wacana/narasi pada mapel ${mapelNama}`);
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
          const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
          logActivity('SKEMA PENILAIAN', `Menyimpan skema bobot penilaian mapel ${mapelNama}`);
          fetchData();
        } else alert(res.message);
      };

      const deleteSoal = async (id) => {
        if (!confirm('Hapus soal ini?')) return;
        const res = await api('delete_soal_mapel', { id_soal: id });
        if (res.status === 'success') {
          logActivity('HAPUS SOAL', `Menghapus soal ID ${id}`);
          fetchData();
        }
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
          logActivity('NILAI URAIAN', `Memberikan nilai uraian siswa pada sesi ${modalUraian.logUjian.id_log} skor ${totalNilai}`);
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
          logActivity('UPDATE PROFIL', 'Memperbarui data profil atau kata sandi guru');
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

      const openAnalisisSoal = async (jadwalId, mapelId) => {
        const jId = jadwalId || (selectedHasilJadwal ? selectedHasilJadwal.id_jadwal : (typeof selectedJadwal === 'object' ? selectedJadwal?.id_jadwal : selectedJadwal));
        if (!jId) return alert('Pilih jadwal ujian terlebih dahulu.');
        const jadwalObj = dataJadwal.find(j => j.id_jadwal === jId) || selectedHasilJadwal;
        const mId = mapelId || (jadwalObj ? jadwalObj.id_mapel : null);
        if (!mId) return alert('ID Mata Pelajaran tidak ditemukan.');
        setIsLoading(true);
        const res = await api('get_analisis_soal', { id_jadwal: jId, id_mapel: mId });
        setIsLoading(false);
        if (res.status === 'success') {
          setDataAnalisis(res.data);
          setIsAnalisisModalOpen(true);
          logActivity('ANALISIS SOAL', `Membuka analisis butir soal mapel ${jadwalObj?.nama_mapel || ''}`);
        } else {
          alert('Gagal memuat analisis butir soal: ' + (res.message || ''));
        }
      };

      const handleOpenHasilDetail = async (jadwal) => {
        setIsLoading(true);
        setSelectedHasilJadwal(jadwal);
        const res = await api('get_hasil_ujian', { id_jadwal: jadwal.id_jadwal });
        setIsLoading(false);
        if (res.status === 'success') {
          setDataHasilSiswa(res.data || []);
          setIsHasilModalOpen(true);
          setFilterHasilParalelDetail('ALL');
          setSearchHasilSiswa('');
          logActivity('LIHAT HASIL', `Melihat rekap nilai ujian mapel ${jadwal.nama_mapel}`);
        } else {
          alert('Gagal memuat rekap nilai: ' + (res.message || ''));
        }
      };

      const exportHasilToExcel = (jadwal, siswaList, paralelFilter) => {
        if (!siswaList || siswaList.length === 0) return alert('Tidak ada data hasil ujian untuk di-export');
        
        let filteredList = [...siswaList];
        if (paralelFilter && paralelFilter !== 'ALL') {
          filteredList = filteredList.filter(s => s.kelas_paralel === paralelFilter);
        }

        const exportData = filteredList.map((l, i) => {
          const nilaiAkhir = Number(l.total_nilai) || 0;
          return {
            'Peringkat': i + 1,
            'NISN': l.nisn || '-',
            'Nama Siswa': l.nama_lengkap,
            'Tingkat': l.angkatan || '-',
            'Kelas Paralel': l.kelas_paralel || '-',
            'Nilai PG': Number(l.nilai_auto) || 0,
            'Nilai Uraian': Number(l.nilai_uraian) || 0,
            'Total Nilai': nilaiAkhir,
            'Status': nilaiAkhir >= 75 ? 'Tuntas' : 'Remedial'
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai Siswa");
        
        const safeMapel = (jadwal?.nama_mapel || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
        const safeKelas = (jadwal?.target_kelas || 'Semua').replace(/[^a-zA-Z0-9]/g, '_');
        const safeParalel = (paralelFilter === 'ALL' ? 'SemuaParalel' : `Paralel_${paralelFilter}`);
        const fileName = `Hasil_Evaluasi_${safeMapel}_${safeKelas}_${safeParalel}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        logActivity('EXPORT NILAI', `Export file Excel hasil evaluasi mapel ${jadwal?.nama_mapel || ''} (${safeKelas} - ${safeParalel})`);
      };

      const handleResetArchiveLog = async () => {
        if (!confirm('Apakah Anda yakin ingin mereset dan mengarsipkan semua log aktif saat ini ke riwayat arsip? Log tidak akan terhapus, melainkan disimpan di Riwayat Arsip.')) return;
        setIsArchivingLog(true);
        const res = await api('reset_and_archive_audit_log', { username: user.username });
        setIsArchivingLog(false);
        if (res.status === 'success') {
          alert(res.message);
          const resAudit = await api('get_audit_log', { username: user.username });
          if (resAudit.status === 'success') setDataAudit(resAudit.data || []);
          const resArc = await api('get_audit_log_archive', { username: user.username });
          if (resArc.status === 'success') setDataAuditArchive(resArc.data || []);
        } else {
          alert(res.message);
        }
      };

      const handleExportLogToExcel = (isArchive = false) => {
        const list = isArchive ? dataAuditArchive : dataAudit;
        if (!list || list.length === 0) return alert('Tidak ada data log untuk diunduh.');
        const exportData = list.map((l, i) => ({
          'No': i + 1,
          'Waktu': new Date(l.created_at).toLocaleString('id-ID'),
          'User': l.username,
          'Peran': l.role,
          'Aksi': l.action,
          'Target / Keterangan': l.target,
          ...(isArchive ? { 'Waktu Diarsipkan': l.archived_at ? new Date(l.archived_at).toLocaleString('id-ID') : '-' } : {})
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        const sheetTitle = isArchive ? 'Arsip Log' : 'Log Aktif';
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
        const filePrefix = isArchive ? 'Arsip_Log_Aktivitas' : 'Log_Aktivitas_Aktif';
        XLSX.writeFile(wb, `${filePrefix}_${user.username}_${new Date().toISOString().slice(0,10)}.xlsx`);
        logActivity('EXPORT LOG', `Mengunduh berkas ${sheetTitle} ke Excel`);
      };

      const renderAnalisisModal = () => {
        if (!isAnalisisModalOpen) return null;
        return (
          <div className="fixed inset-0 bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 z-[200]">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl p-6 relative border border-slate-200 dark:border-slate-800 h-full max-h-[92vh] flex flex-col">
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
              
              
              {activeTab === 'dashboard' && (
                <div className="px-6 mt-6 animate-fade-in-up pb-24">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Dashboard Utama</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><span className="material-symbols-outlined text-6xl">library_books</span></div>
                      <h4 className="text-4xl font-bold mb-1">{dataMapel.length}</h4>
                      <p className="text-blue-100 text-sm font-medium">Mapel Ditugaskan</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><span className="material-symbols-outlined text-6xl">quiz</span></div>
                      <h4 className="text-4xl font-bold mb-1">{dataMapel.reduce((sum, m) => sum + parseInt(m.jumlah_soal || m.total_soal || 0), 0)}</h4>
                      <p className="text-emerald-100 text-sm font-medium">Total Soal Dibuat</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><span className="material-symbols-outlined text-6xl">groups</span></div>
                      <h4 className="text-4xl font-bold mb-1">{dataJadwal.reduce((sum, j) => sum + (j.peserta?.filter(p => p.status === 'SELESAI').length || 0), 0)}</h4>
                      <p className="text-purple-100 text-sm font-medium">Siswa Telah Ujian</p>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">bar_chart</span> Statistik Ujian per Mapel</h4>
                    <div className="space-y-3">
                       {dataMapel.map(m => {
                          const schedulesForMapel = dataJadwal.filter(j => j.id_mapel === m.id_mapel);
                          const totalSelesai = schedulesForMapel.reduce((sum, j) => sum + (j.peserta?.filter(p => p.status === 'SELESAI').length || 0), 0);
                          const totalSiswa = schedulesForMapel.reduce((sum, j) => sum + (j.peserta?.length || 0), 0);
                          return (
                            <div key={m.id_mapel} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{m.nama_mapel}</span>
                                <span className="text-xs text-slate-500">{m.jumlah_soal || m.total_soal || 0} Soal Tersedia di Bank Soal</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-lg font-bold text-primary">{totalSelesai} <span className="text-xs text-slate-500 font-normal">/ {totalSiswa} Siswa Selesai</span></span>
                              </div>
                            </div>
                          );
                       })}
                       {dataMapel.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Belum ada data mata pelajaran.</p>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Jadwal Ujian</h3>
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

              {activeTab === 'kontrol' && (
                <div className="px-6 mt-6 animate-fade-in-up pb-24">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Kontrol Ujian (Mata Pelajaran Anda)</h3>
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
                                <p className="text-xs text-slate-500 truncate mb-1">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')} - {j.target_kelas ? `Tingkat ${j.target_kelas}` : 'Umum'}</p>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAktif ? 'bg-green-500 text-white' : isSelesai ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-600'}`}>{j.status_ujian}</span>
                                  {j.token && <span className="text-[10px] font-mono text-slate-400 font-bold">#{j.token}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col md:flex-row items-end md:items-center gap-2 mt-3 md:mt-0 w-full md:w-auto">
                              {!isAktif && !isSelesai && <button onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'AKTIF')} disabled={isSubmitting} className="w-full md:w-auto px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-bold hover:bg-green-100 disabled:opacity-50">Mulai Ujian</button>}
                              {isAktif && <button onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'SELESAI')} disabled={isSubmitting} className="w-full md:w-auto px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 disabled:opacity-50">Berhentikan</button>}
                              {isSelesai && <button onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'BELUM MULAI')} disabled={isSubmitting} className="w-full md:w-auto px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 disabled:opacity-50">Reset Status</button>}
                            </div>
                          </div>
                       );
                    })}
                    {dataJadwal.length === 0 && <div className="text-center text-sm text-slate-500 py-8 col-span-full">Belum ada mata pelajaran yang diujikan.</div>}
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

              {activeTab === 'hasil' && (() => {
                const tingkatList = Array.from(new Set(dataKelas.map(k => k.tingkat).filter(Boolean)));
                const availableParalels = filterKelasHasil && filterKelasHasil !== 'Umum'
                  ? Array.from(new Set(dataKelas.filter(k => k.tingkat === filterKelasHasil).map(k => k.kelas_paralel).filter(Boolean)))
                  : [];

                const filteredJadwalHasil = dataJadwal.filter(j => {
                  if (j.status_ujian !== 'SELESAI') return false;
                  if (filterMapelHasil && filterMapelHasil !== 'ALL' && j.nama_mapel !== filterMapelHasil) return false;
                  if (filterKelasHasil && filterKelasHasil !== 'Umum') {
                    if (j.target_kelas && j.target_kelas !== 'Umum' && j.target_kelas !== filterKelasHasil && !j.target_kelas.includes(filterKelasHasil)) {
                      return false;
                    }
                  }
                  return true;
                });

                return (
                  <div className="px-6 mt-6 animate-fade-in-up pb-24">
                    <div className="mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Hasil Evaluasi Pembelajaran</h3>
                      <p className="text-xs text-slate-500">Pilih Kelas / Tingkat, pilih satu atau lebih Kelas Paralel, dan Mata Pelajaran untuk melihat rekap nilai.</p>
                    </div>
                    
                    {/* Filter Box */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dropdown Kelas / Tingkat */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-primary">school</span>
                            Kelas / Tingkat
                          </label>
                          <select 
                            value={filterKelasHasil} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setFilterKelasHasil(val);
                              // Default: pilih semua paralel untuk tingkat ini
                              const allP = dataKelas.filter(k => k.tingkat === val).map(k => k.kelas_paralel).filter(Boolean);
                              setFilterParalelHasil(Array.from(new Set(allP)));
                            }} 
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                          >
                            <option value="">-- Pilih Kelas / Tingkat --</option>
                            {tingkatList.map(t => (
                              <option key={t} value={t}>{t.startsWith('Kelas') || t.startsWith('Tingkat') ? t : `Tingkat ${t}`}</option>
                            ))}
                            <option value="Umum">Umum / Semua Tingkat</option>
                          </select>
                        </div>

                        {/* Dropdown Mapel */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-purple-500">auto_stories</span>
                            Mata Pelajaran
                          </label>
                          <select 
                            value={filterMapelHasil} 
                            onChange={(e) => setFilterMapelHasil(e.target.value)} 
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                          >
                            <option value="ALL">Semua Mata Pelajaran</option>
                            {dataMapel.map(m => (
                              <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Multi-Select Kelas Paralel */}
                      {filterKelasHasil && filterKelasHasil !== 'Umum' && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-amber-500">splitscreen</span>
                              Pilih Kelas Paralel <span className="text-[11px] font-normal text-slate-400">(Boleh pilih lebih dari satu)</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <button 
                                type="button" 
                                onClick={() => {
                                  const allP = dataKelas.filter(k => k.tingkat === filterKelasHasil).map(k => k.kelas_paralel).filter(Boolean);
                                  setFilterParalelHasil(Array.from(new Set(allP)));
                                }}
                                className="text-[11px] text-primary hover:underline font-bold"
                              >
                                Pilih Semua
                              </button>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <button 
                                type="button" 
                                onClick={() => setFilterParalelHasil([])}
                                className="text-[11px] text-slate-500 hover:underline font-bold"
                              >
                                Kosongkan
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {availableParalels.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">Tidak ada paralel spesifik pada tingkat ini.</span>
                            ) : (
                              availableParalels.map(p => {
                                const isSelected = filterParalelHasil.includes(p);
                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setFilterParalelHasil(filterParalelHasil.filter(item => item !== p));
                                      } else {
                                        setFilterParalelHasil([...filterParalelHasil, p]);
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                      isSelected 
                                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/25' 
                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[15px]">
                                      {isSelected ? 'check_box' : 'check_box_outline_blank'}
                                    </span>
                                    Paralel {p}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {filterParalelHasil.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-green-500">task_alt</span>
                              Kelas paralel aktif ({filterParalelHasil.length}): <strong className="text-slate-700 dark:text-slate-200">{filterParalelHasil.map(p => `Paralel ${p}`).join(', ')}</strong>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    {!filterKelasHasil ? (
                      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-10 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">assignment</span>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Pilih Kelas / Tingkat Terlebih Dahulu</p>
                        <p className="text-xs text-slate-400 mt-1">Silakan pilih kelas dan kelas paralel di atas untuk menampilkan hasil evaluasi ujian.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Daftar Ujian Selesai ({filteredJadwalHasil.length})
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {filteredJadwalHasil.map((j) => (
                            <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                    SELESAI
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {new Date(j.waktu_mulai).toLocaleDateString('id-ID')}
                                  </span>
                                </div>
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">{j.nama_mapel}</h4>
                                <div className="space-y-1 mb-4 text-xs text-slate-500">
                                  <p>Tingkat: <strong className="text-slate-700 dark:text-slate-300">{j.target_kelas || 'Umum'}</strong></p>
                                  {filterParalelHasil.length > 0 && (
                                    <p className="line-clamp-1">Paralel Ditinjau: <span className="text-primary font-bold">{filterParalelHasil.join(', ')}</span></p>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                                <button 
                                  onClick={() => handleOpenHasilDetail(j)} 
                                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-primary/20"
                                >
                                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                                  Lihat Rekap Nilai
                                </button>
                              </div>
                            </div>
                          ))}

                          {filteredJadwalHasil.length === 0 && (
                            <div className="col-span-full bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700 text-center text-slate-500">
                              <span className="material-symbols-outlined text-3xl opacity-40 mb-1">quiz</span>
                              <p className="text-sm font-medium">Belum ada ujian berstatus selesai untuk filter ini.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeTab === 'bank_soal' && (
                <div className="px-6 mt-6 animate-fade-in-up pb-24">
                  {!selectedMapel ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Pilih Mata Pelajaran</h3>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                         {dataMapel.map((m, idx) => {
                            const color = getMapelColor(idx);
                            return (
                               <button 
                                 key={m.id_mapel} 
                                 onClick={() => setSelectedMapel(m.id_mapel)} 
                                 className={`relative rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-all overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:shadow-md`}
                               >
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color.icon}`}>
                                    <span className="material-symbols-outlined text-2xl">library_books</span>
                                 </div>
                                 <span className="font-bold text-center text-xs leading-tight line-clamp-2">{m.nama_mapel}</span>
                                 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300`}>
                                   {m.jumlah_soal || m.total_soal || 0} Soal
                                 </span>
                               </button>
                            );
                         })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                          <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedMapel(null)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 transition-colors">
                              <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <div>
                              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">{dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel}</h3>
                              <p className="text-xs text-slate-500">{dataSoal.length} Soal tersedia di bank soal</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                            <button onClick={downloadTemplateSoal} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1 text-xs font-bold" title="Unduh Template Excel">
                              <span className="material-symbols-outlined text-[18px]">download</span>
                              <span className="hidden md:inline">Template</span>
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-1 text-xs font-bold" title="Import via Excel">
                              <span className="material-symbols-outlined text-[18px]">upload_file</span>
                              <span className="hidden md:inline">Import Excel</span>
                            </button>
                            <button onClick={() => setFormNarasi({ isOpen: true, data: null })} className="bg-amber-50 text-amber-600 px-3 py-2 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1 text-xs font-bold" title="Tulis Wacana / Narasi Baru">
                              <span className="material-symbols-outlined text-[18px]">article</span>
                              <span>Tambah Narasi</span>
                            </button>
                            <button onClick={() => setPreFormSoal({ isOpen: true, id_mapel: selectedMapel, target_kelas: '' })} className="bg-primary text-white px-3 py-2 rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-1 text-xs font-bold">
                              <span className="material-symbols-outlined text-[18px]">add</span>
                              <span>Tambah Soal</span>
                            </button>
                          </div>
                      </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                    </>
                  )}
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
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setActiveTab('akun')} className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors">
                          <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                        </button>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Log Aktivitas Guru</h3>
                          <p className="text-xs text-slate-500">Riwayat pencatatan aktivitas dan audit sistem.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleExportLogToExcel(activeLogSubTab === 'arsip')}
                          className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                          title="Unduh data log ke Excel"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          Unduh Excel
                        </button>
                        {activeLogSubTab === 'aktif' && (
                          <button
                            onClick={handleResetArchiveLog}
                            disabled={isArchivingLog || dataAudit.length === 0}
                            className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            title="Pindahkan log aktif ke arsip dan mulai siklus baru"
                          >
                            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                            {isArchivingLog ? 'Mengarsipkan...' : 'Arsipkan Sekarang'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notice Banner */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 mb-5 flex items-start gap-3">
                      <span className="material-symbols-outlined text-blue-500 text-xl flex-shrink-0 mt-0.5">auto_schedule</span>
                      <div className="text-xs text-blue-800 dark:text-blue-300">
                        <strong className="font-bold">Rotasi Mingguan Otomatis:</strong> Log aktif disaring untuk <strong>1 minggu (7 hari) terakhir</strong>. Log yang lebih lama otomatis dipindahkan ke <strong>Riwayat Arsip</strong>. Arsip riwayat otomatis dibersihkan setelah <strong>1 bulan (30 hari)</strong> untuk menjaga performa.
                      </div>
                    </div>

                    {/* Subtabs */}
                    <div className="flex gap-2 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                      <button
                        onClick={() => setActiveLogSubTab('aktif')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeLogSubTab === 'aktif'
                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">history</span>
                        Log Aktif Minggu Ini ({dataAudit.length})
                      </button>
                      <button
                        onClick={() => setActiveLogSubTab('arsip')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeLogSubTab === 'arsip'
                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">archive</span>
                        Riwayat Arsip ({dataAuditArchive.length})
                      </button>
                    </div>
                    
                    {/* Log Items List */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                      {(() => {
                        const currentList = activeLogSubTab === 'aktif' ? dataAudit : dataAuditArchive;
                        if (currentList.length === 0) {
                          return (
                            <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                              <span className="material-symbols-outlined text-4xl mb-2 opacity-40">
                                {activeLogSubTab === 'aktif' ? 'history_toggle_off' : 'archive'}
                              </span>
                              <p className="font-semibold text-sm">
                                {activeLogSubTab === 'aktif' ? 'Belum ada aktivitas dalam 7 hari terakhir.' : 'Belum ada log yang diarsipkan.'}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">Aktivitas guru seperti kelola soal, ujian, penilaian, dan profil akan tercatat di sini.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[65vh] overflow-y-auto">
                            {currentList.map((log) => {
                              const act = (log.action || '').toUpperCase();
                              let iconName = 'history';
                              let iconClass = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
                              let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

                              if (act.includes('TAMBAH') || act.includes('CREATE')) {
                                iconName = 'add_circle';
                                iconClass = 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400';
                                badgeClass = 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                              } else if (act.includes('EDIT') || act.includes('UPDATE')) {
                                iconName = 'edit';
                                iconClass = 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
                                badgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
                              } else if (act.includes('HAPUS') || act.includes('DELETE')) {
                                iconName = 'delete';
                                iconClass = 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                                badgeClass = 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                              } else if (act.includes('IMPORT')) {
                                iconName = 'upload_file';
                                iconClass = 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
                                badgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
                              } else if (act.includes('UJIAN') || act.includes('STATUS')) {
                                iconName = 'play_circle';
                                iconClass = 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
                                badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
                              } else if (act.includes('RESET') || act.includes('STOP') || act.includes('BLOKIR')) {
                                iconName = 'restart_alt';
                                iconClass = 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
                                badgeClass = 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
                              } else if (act.includes('EXPORT')) {
                                iconName = 'file_download';
                                iconClass = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
                                badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
                              } else if (act.includes('PROFIL') || act.includes('AVATAR')) {
                                iconName = 'account_circle';
                                iconClass = 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
                                badgeClass = 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
                              }

                              return (
                                <div key={log.id_archive || log.id_audit} className="p-4 flex gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                                    <span className="material-symbols-outlined text-[20px]">{iconName}</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>
                                        {log.action || 'AKTIVITAS'}
                                      </span>
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {log.username || user.username}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        ({log.role || 'guru'})
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 break-words font-medium">
                                      {log.target || '-'}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                                      <span>{new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                      {log.archived_at && (
                                        <span>• Diarsipkan: {new Date(log.archived_at).toLocaleDateString('id-ID')}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}


            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 md:px-12 py-3 flex justify-between md:justify-center md:gap-16 items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              
              <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center transition-colors ${activeTab === 'dashboard' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">dashboard</span>
                <span className="text-[10px] font-bold mt-1">Beranda</span>
              </button>
              <button onClick={() => setActiveTab('jadwal')} className={`flex flex-col items-center transition-colors ${activeTab === 'jadwal' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">event_note</span>
                <span className="text-[10px] font-bold mt-1">Jadwal</span>
              </button>
              <button onClick={() => setActiveTab('kontrol')} className={`flex flex-col items-center transition-colors ${activeTab === 'kontrol' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">settings_remote</span>
                <span className="text-[10px] font-bold mt-1">Kontrol</span>
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
              <button onClick={saveProfile} disabled={profileLoading} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
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

        {/* Modal Detail Hasil Evaluasi & Rekap Nilai Siswa */}
        {isHasilModalOpen && selectedHasilJadwal && (() => {
          // Filter siswa berdasarkan filter paralel yang dipilih di dalam modal
          const uniqueParalelsInResult = Array.from(new Set(dataHasilSiswa.map(s => s.kelas_paralel).filter(Boolean)));
          
          let filteredSiswa = dataHasilSiswa.filter(s => {
            if (filterHasilParalelDetail !== 'ALL' && s.kelas_paralel !== filterHasilParalelDetail) return false;
            // Jika filter awal dari halaman utama memiliki paralel terpilih, saring juga
            if (filterParalelHasil.length > 0 && filterHasilParalelDetail === 'ALL') {
              if (!filterParalelHasil.includes(s.kelas_paralel)) return false;
            }
            if (searchHasilSiswa.trim()) {
              const q = searchHasilSiswa.toLowerCase();
              const nameMatch = (s.nama_lengkap || '').toLowerCase().includes(q);
              const nisnMatch = (s.nisn || '').toLowerCase().includes(q);
              if (!nameMatch && !nisnMatch) return false;
            }
            return true;
          });

          // Urutkan nilai tertinggi ke terendah
          filteredSiswa.sort((a, b) => (Number(b.total_nilai) || 0) - (Number(a.total_nilai) || 0));

          const totalPeserta = filteredSiswa.length;
          const rataNilai = totalPeserta > 0 ? (filteredSiswa.reduce((sum, s) => sum + (Number(s.total_nilai) || 0), 0) / totalPeserta).toFixed(1) : 0;
          const nilaiTertinggi = totalPeserta > 0 ? Math.max(...filteredSiswa.map(s => Number(s.total_nilai) || 0)) : 0;
          const nilaiTerendah = totalPeserta > 0 ? Math.min(...filteredSiswa.map(s => Number(s.total_nilai) || 0)) : 0;
          const tuntasCount = filteredSiswa.filter(s => (Number(s.total_nilai) || 0) >= 75).length;
          const persentaseTuntas = totalPeserta > 0 ? Math.round((tuntasCount / totalPeserta) * 100) : 0;

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-[150] animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Header Modal */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsHasilModalOpen(false)}
                      className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base md:text-lg flex items-center gap-2">
                        <span>Rekap Nilai: {selectedHasilJadwal.nama_mapel}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Tingkat {selectedHasilJadwal.target_kelas || 'Umum'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Waktu Ujian: {new Date(selectedHasilJadwal.waktu_mulai).toLocaleDateString('id-ID')} | Total {dataHasilSiswa.length} Siswa Terdaftar Selesai
                      </p>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={() => exportHasilToExcel(selectedHasilJadwal, filteredSiswa, filterHasilParalelDetail)}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/25 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Unduh Excel
                    </button>
                    <button 
                      onClick={() => openAnalisisSoal(selectedHasilJadwal.id_jadwal, selectedHasilJadwal.id_mapel)}
                      className="px-3 py-2 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">analytics</span>
                      Analisis Butir
                    </button>
                    <button 
                      onClick={() => setIsHasilModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50 dark:bg-slate-900/50">
                  
                  {/* Summary Analytics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm text-center">
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">Peserta</span>
                      <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalPeserta}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Siswa dinilai</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm text-center">
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">Rata-Rata</span>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{rataNilai}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Skor keseluruhan</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm text-center">
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">Tertinggi</span>
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{nilaiTertinggi}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Nilai maks</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm text-center">
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">Terendah</span>
                      <span className="text-2xl font-bold text-rose-500">{nilaiTerendah}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Nilai min</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm text-center col-span-2 sm:col-span-1">
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">Ketuntasan</span>
                      <span className="text-2xl font-bold text-primary">{persentaseTuntas}%</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{tuntasCount} / {totalPeserta} Lulus</span>
                    </div>
                  </div>

                  {/* Filter Kelas Paralel & Pencarian Siswa */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    {/* Pills Paralel */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                      <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 flex-shrink-0">
                        <span className="material-symbols-outlined text-[14px]">filter_alt</span> Paralel:
                      </span>
                      <button
                        onClick={() => setFilterHasilParalelDetail('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                          filterHasilParalelDetail === 'ALL'
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        Semua Paralel ({dataHasilSiswa.length})
                      </button>
                      {uniqueParalelsInResult.map(p => {
                        const countInP = dataHasilSiswa.filter(s => s.kelas_paralel === p).length;
                        return (
                          <button
                            key={p}
                            onClick={() => setFilterHasilParalelDetail(p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                              filterHasilParalelDetail === p
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            Paralel {p} ({countInP})
                          </button>
                        );
                      })}
                    </div>

                    {/* Search Input */}
                    <div className="relative min-w-[200px]">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                      <input
                        type="text"
                        placeholder="Cari siswa atau NISN..."
                        value={searchHasilSiswa}
                        onChange={(e) => setSearchHasilSiswa(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Student Scores Table */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                          <tr>
                            <th className="p-3.5 text-center w-12">#</th>
                            <th className="p-3.5">Nama Siswa</th>
                            <th className="p-3.5">NISN</th>
                            <th className="p-3.5">Kelas & Paralel</th>
                            <th className="p-3.5 text-center">Nilai PG</th>
                            <th className="p-3.5 text-center">Nilai Uraian</th>
                            <th className="p-3.5 text-center font-bold">Total Nilai</th>
                            <th className="p-3.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {filteredSiswa.map((s, idx) => {
                            const total = Number(s.total_nilai) || 0;
                            const isLulus = total >= 75;
                            return (
                              <tr key={s.id_log || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors">
                                <td className="p-3.5 text-center font-bold text-slate-400">
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                </td>
                                <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">
                                  {s.nama_lengkap}
                                </td>
                                <td className="p-3.5 font-mono text-slate-500">
                                  {s.nisn || '-'}
                                </td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                                    {s.angkatan || selectedHasilJadwal.target_kelas || '-'} ({s.kelas_paralel ? `Paralel ${s.kelas_paralel}` : '-'})
                                  </span>
                                </td>
                                <td className="p-3.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                                  {Number(s.nilai_auto) || 0}
                                </td>
                                <td className="p-3.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                                  {Number(s.nilai_uraian) || 0}
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className={`text-sm font-extrabold ${isLulus ? 'text-green-600 dark:text-green-400' : 'text-rose-500'}`}>
                                    {total}
                                  </span>
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    isLulus 
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' 
                                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                  }`}>
                                    {isLulus ? 'Tuntas' : 'Remedial'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredSiswa.length === 0 && (
                            <tr>
                              <td colSpan="8" className="p-8 text-center text-slate-500">
                                Tidak ada siswa yang sesuai dengan filter paralel atau pencarian.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

        {preFormSoal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg mb-4">Pilih Kelas & Mapel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Kelas / Tingkat</label>
                <select 
                  value={preFormSoal.target_kelas} 
                  onChange={(e) => setPreFormSoal({...preFormSoal, target_kelas: e.target.value})} 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none"
                >
                  <option value="">Pilih Tingkat Kelas</option>
                  {Array.from(new Set(dataKelas.map(k => k.tingkat).filter(Boolean))).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="Umum">Umum / Semua Tingkat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Mata Pelajaran</label>
                <select 
                  value={preFormSoal.id_mapel} 
                  onChange={(e) => setPreFormSoal({...preFormSoal, id_mapel: e.target.value})} 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none"
                >
                  <option value="">Pilih Mapel</option>
                  {dataMapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setPreFormSoal({ isOpen: false, id_mapel: '', target_kelas: '', target_paralel: [] })} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={() => {
                if(!preFormSoal.id_mapel || !preFormSoal.target_kelas) return alert('Pilih kelas dan mapel!');
                const chosenMapel = preFormSoal.id_mapel;
                setPreFormSoal({ isOpen: false, id_mapel: '', target_kelas: '', target_paralel: [] });
                setFormSoal({ isOpen: true, data: null, id_mapel: chosenMapel });
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





