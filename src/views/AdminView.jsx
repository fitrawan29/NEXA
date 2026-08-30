import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
﻿    const EmptyState = window.EmptyState;
    const AdminView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [activeTab, setActiveTab] = useState('dashboard');
      const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Toggle Sidebar

      const [dashboardData, setDashboardData] = useState(null);
      const [dataSiswa, setDataSiswa] = useState([]);
      const [dataGuru, setDataGuru] = useState([]);
      const [dataJadwal, setDataJadwal] = useState([]);
      const [dataMapel, setDataMapel] = useState([]);
      const [dataKelas, setDataKelas] = useState([]);
      const [dataLog, setDataLog] = useState([]); // monitoring / hasil
      const [dataAudit, setDataAudit] = useState([]);
      const [dataSoal, setDataSoal] = useState([]);
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataAnalisis, setDataAnalisis] = useState([]);
      const [isAnalisisModalOpen, setIsAnalisisModalOpen] = useState(false);
      const [isLoading, setIsLoading] = useState(true);
      const [hasNotification, setHasNotification] = useState(false);

      const [selectedKelas, setSelectedKelas] = useState(null); // Filter kelas
      const [selectedJadwal, setSelectedJadwal] = useState(null); // Filter monitoring/hasil

      // Modal State
      const [formModal, setFormModal] = useState({ isOpen: false, type: '', data: null });
      const [profileModalOpen, setProfileModalOpen] = useState(false);
      const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', id: null, item: null });
      const [importModal, setImportModal] = useState({ isOpen: false, type: '' });
      const [filterKelas, setFilterKelas] = useState('');
      const [filterMapel, setFilterMapel] = useState('');
      const [confirmText, setConfirmText] = useState('');

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
        const res = await api('update_admin_profil', { id_admin: user.id_admin, foto_profil: avatarUrl });
        setIsLoading(false);
        if (res.status === 'success') {
          setIsAvatarModalOpen(false);
          onLogout(); // Force logout to refresh session data
        } else {
          alert(res.message);
        }
      };

      const fetchData = async (tab) => {
        setIsLoading(true);
        if (tab === 'dashboard') {
          const res = await api('get_admin_dashboard_data', {});
          if (res.status === 'success') setDashboardData(res.data);
        } else if (tab === 'siswa' || tab === 'kelas') {
          const res = await api('get_siswa', {});
          if (res.status === 'success') setDataSiswa(res.data);
          const resK = await api('get_kelas', {});
          if (resK.status === 'success') setDataKelas(resK.data);
        } else if (tab === 'guru') {
          const res = await api('get_guru', {});
          if (res.status === 'success') setDataGuru(res.data);
        } else if (tab === 'mapel') {
          const res = await api('get_all_mapel', {});
          if (res.status === 'success') setDataMapel(res.data);
        } else if (tab === 'logs') {
          const res = await api('get_audit_log', {});
          if (res.status === 'success') setDataAudit(res.data);
        } else if (tab === 'soal') {
          const res = await api('get_bank_soal_admin', {});
          if (res.status === 'success') setDataSoal(res.data);
        } else if (tab === 'pengumuman') {
          const res = await api('get_pengumuman', { role: 'admin' });
          if (res.status === 'success') setDataPengumuman(res.data);
        } else if (tab === 'jadwal' || tab === 'monitoring' || tab === 'hasil') {
          const res = await api('get_all_jadwal', {});
          if (res.status === 'success') setDataJadwal(res.data);

          if (selectedJadwal) {
            const endpoint = tab === 'hasil' ? 'get_hasil_ujian' : 'monitoring_ujian';
            const logRes = await api(endpoint, { id_jadwal: selectedJadwal });
            if (logRes.status === 'success') setDataLog(logRes.data);
          } else {
            setDataLog([]);
          }
        }
        setIsLoading(false);
      };

      useEffect(() => {
        fetchData(activeTab);
      }, [activeTab, selectedJadwal]);

      const handleDeleteClick = (id, type, item) => {
        setDeleteModal({ isOpen: true, type, id, item });
      };

      const confirmDelete = async () => {
        setIsSubmitting(true);
        let endpoint = `delete_${deleteModal.type}`;
        let payload = {};
        payload[`id_${deleteModal.type}`] = deleteModal.id;

        const res = await api(endpoint, payload);
        setIsSubmitting(false);
        if (res.status === 'success') {
          await api('create_audit_log', { username: user.username, role: 'admin', action: 'DELETE', target: `${deleteModal.type} (${deleteModal.id})` });
          setDeleteModal({ isOpen: false, type: '', id: null, item: null });
          fetchData(activeTab);
        } else {
          alert(res.message);
        }
      };

      
      const handleResetLogin = async (id_siswa) => {
        if (!confirm('Reset sesi login siswa ini?')) return;
        const res = await fetchAPI('reset_login_siswa', { id_siswa, npsn: user.npsn });
        if (res.status === 'success') {
          alert('Sesi login berhasil direset.');
        } else {
          alert(res.message);
        }
      };
      
      const handleSaveForm = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.target);
        let payload = Object.fromEntries(formData.entries());
        const isEdit = formModal.data != null;

        let endpoint = `create_${formModal.type}`;
        if (isEdit) endpoint = `update_${formModal.type}`;

        if (isEdit && payload.password === '') {
          delete payload.password;
        }

        // Handle Guru mapels checkbox
        if (formModal.type === 'guru') {
          payload.mapels = formData.getAll('mapels');
        }

        // Handle Siswa kelas_gabungan
        if (formModal.type === 'siswa' && payload.kelas_gabungan) {
          const [t, p] = payload.kelas_gabungan.split('|');
          payload.angkatan = t;
          payload.kelas_paralel = p;
          delete payload.kelas_gabungan;
        }

        // Handle Checkboxes for Jadwal
        if (formModal.type === 'jadwal') {
          payload.browser_lockdown = formData.get('browser_lockdown') === 'on';
          payload.acak_soal = formData.get('acak_soal') === 'on';
          payload.acak_opsi = formData.get('acak_opsi') === 'on';
        }

        const res = await api(endpoint, payload);
        setIsSubmitting(false);
        if (res.status === 'success') {
          await api('create_audit_log', { username: user.username, role: 'admin', action: isEdit ? 'UPDATE' : 'CREATE', target: `${formModal.type} (${payload[`id_${formModal.type}`] || 'Baru'})` });
          setFormModal({ isOpen: false, type: '', data: null });
          fetchData(activeTab);
        } else {
          alert(res.message);
        }
      };

      const openCreateModal = async (type) => {
        if (type === 'guru' || type === 'jadwal') {
          const res = await api('get_all_mapel', {});
          if (res.status === 'success') setDataMapel(res.data);
          if (type === 'jadwal') {
            const resG = await api('get_guru', {});
            if (resG.status === 'success') setDataGuru(resG.data);
          }
        }
        setFormModal({ isOpen: true, type, data: null });
      };

      const openEditModal = async (type, item) => {
        if (type === 'guru' || type === 'jadwal') {
          const res = await api('get_all_mapel', {});
          if (res.status === 'success') setDataMapel(res.data);
          if (type === 'jadwal') {
            const resG = await api('get_guru', {});
            if (resG.status === 'success') setDataGuru(resG.data);
          }
        }
        setFormModal({ isOpen: true, type, data: item });
      };

      const handleBlock = async (idLog) => {
        if (!confirm('Blokir siswa ini?')) return;
        await api('catat_pelanggaran', { id_log: idLog });
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'BLOCK', target: `Siswa Log (${idLog})` });
        fetchData(activeTab);
      };

      const handleUnblock = async (idLog) => {
        if (!confirm('Buka blokir siswa ini?')) return;
        await api('buka_blokir', { id_log: idLog });
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'UNBLOCK', target: `Siswa Log (${idLog})` });
        fetchData(activeTab);
      };

      const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            if (data.length === 0) return alert('File kosong atau format salah.');
            
            // VALIDASI DUPLIKAT SEBELUM INSERT
            if (type === 'siswa' || type === 'guru') {
               const existingRes = await api(type === 'siswa' ? 'get_siswa' : 'get_guru');
               if (existingRes.status === 'success') {
                  const existingUsernames = existingRes.data.map(u => String(u.username));
                  const duplicates = data.filter(d => existingUsernames.includes(String(d.username)));
                  if (duplicates.length > 0) {
                     alert(`Gagal Import: Ditemukan ${duplicates.length} data duplikat (Username sudah terdaftar). Contoh duplikat: ${duplicates[0].username}`);
                     e.target.value = null;
                     return;
                  }
               }
            }

            let endpoint = `create_${type}_bulk`;
            
            // Format check (id fields are now auto-generated if missing)
            // if (type === 'siswa' && !data[0].id_siswa) return alert('Format salah. Pastikan ada kolom id_siswa.');
            // if (type === 'guru' && !data[0].id_guru) return alert('Format salah. Pastikan ada kolom id_guru.');
            // if (type === 'mapel' && !data[0].id_mapel) return alert('Format salah. Pastikan ada kolom id_mapel.');
            // if (type === 'jadwal' && !data[0].id_jadwal) return alert('Format salah. Pastikan ada kolom id_jadwal.');


            const res = await api(endpoint, data);
            if (res.status === 'success') {
              alert(`Berhasil menambahkan ${data.length} data ${type}.`);
              fetchData(activeTab);
            } else {
              alert(`Gagal: ${res.message}`);
            }
          } catch (error) {
            console.error(error);
            alert('Gagal memproses file. Pastikan format file sesuai (.xlsx/.csv).');
          }
          e.target.value = null; // Reset input
        };
        reader.readAsBinaryString(file);
      };

      const downloadTemplate = (type) => {
        let sampleData = [];
        let fileName = `Template_Data_${type}.xlsx`;
        
        if (type === 'siswa') {
          sampleData = [{ id_siswa: 'S-001', nama_lengkap: 'Nama Contoh', username: 'siswa01', password: 'password123', angkatan: 'X', kelas_paralel: 'A' }];
        } else if (type === 'guru') {
          sampleData = [{ id_guru: 'G-001', nama_lengkap: 'Guru Contoh', username: 'guru01', password: 'password123' }];
        } else if (type === 'mapel') {
          sampleData = [{ id_mapel: 'M-001', nama_mapel: 'Matematika' }];
        } else if (type === 'jadwal') {
          sampleData = [{ id_jadwal: 'J-001', id_mapel: 'M-001', id_guru: 'G-001', waktu_mulai: '2026-08-25T07:00:00', waktu_selesai: '2026-08-25T09:00:00' }];
        }

        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, fileName);
      };

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
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700 max-h-[90vh] overflow-y-auto flex flex-col">
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
          'Tingkat': l.angkatan,
          'Paralel': l.kelas_paralel,
          'Waktu Login': new Date(l.waktu_login).toLocaleString('id-ID'),
          'Nilai Pilihan Ganda': l.nilai_auto,
          'Nilai Uraian': l.nilai_uraian,
          'Total Nilai': l.total_nilai
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Ujian");
        XLSX.writeFile(workbook, `Hasil_Ujian_${selectedJadwal}.xlsx`);
      };

      const exportDataToExcel = (type) => {
        let exportData = [];
        let fileName = '';
        if (type === 'siswa') {
          if (!dataSiswa || dataSiswa.length === 0) return alert('Tidak ada data siswa untuk di-export');
          exportData = dataSiswa.map((s, i) => ({
            'No': i + 1,
            'ID Siswa': s.id_siswa,
            'Nama Lengkap': s.nama_lengkap,
            'Username': s.username,
            'Tingkat': s.angkatan,
            'Kelas Paralel': s.kelas_paralel,
          }));
          fileName = 'Data_Siswa.xlsx';
        } else if (type === 'guru') {
          if (!dataGuru || dataGuru.length === 0) return alert('Tidak ada data guru untuk di-export');
          exportData = dataGuru.map((g, i) => ({
            'No': i + 1,
            'ID Guru': g.id_guru,
            'Nama Lengkap': g.nama_lengkap,
            'Username': g.username,
            'Mata Pelajaran': g.mapels_list || '-',
          }));
          fileName = 'Data_Guru.xlsx';
        }
        
        if (exportData.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, `Data ${type}`);
          XLSX.writeFile(workbook, fileName);
        }
      };

      // Kelompokkan siswa berdasarkan Angkatan & Paralel
      const groupedClasses = React.useMemo(() => {
        const groups = {};
        dataSiswa.forEach(s => {
          const key = `${s.angkatan || '-'} ${s.kelas_paralel || '-'}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        return groups;
      }, [dataSiswa]);

      const [autoUsername, setAutoUsername] = useState('');

      useEffect(() => {
        if (formModal.isOpen && formModal.data) {
          setAutoUsername(formModal.data.username || '');
        } else if (formModal.isOpen) {
          setAutoUsername('');
        }
      }, [formModal.isOpen, formModal.data]);

      const handleAutoUsernameSiswa = () => {
        const nama = document.getElementById('input_nama_siswa')?.value || '';
        const kelas = document.getElementById('input_kelas_siswa')?.value || '';
        if (!nama || !kelas) return;
        const [t, p] = kelas.split('|');
        const u = `${nama.split(' ')[0].toLowerCase()}_${t.toLowerCase()}_${p.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
        setAutoUsername(u);
      };

      const handleAutoUsernameGuru = () => {
        const nama = document.getElementById('input_nama_guru')?.value || '';
        const mapelEls = document.querySelectorAll('input[name="mapels"]:checked');
        if (!nama || mapelEls.length === 0) return;
        const mapelId = mapelEls[0].value;
        const mapelObj = dataMapel.find(m => m.id_mapel === mapelId);
        if (!mapelObj) return;
        const mapelName = mapelObj.nama_mapel.split(' ')[0].toLowerCase();
        const u = `${nama.split(' ')[0].toLowerCase()}_${mapelName}`;
        setAutoUsername(u);
      };

      const renderFormModal = () => {
        if (!formModal.isOpen) return null;
        const { type, data } = formModal;
        const isEdit = data != null;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-on-surface dark:text-white capitalize">
                {isEdit ? 'Edit Data' : 'Tambah Data'} {type}
              </h2>
              <form onSubmit={handleSaveForm} className="space-y-4">
                {type === 'kelas' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Kelas</label><input name="id_kelas" defaultValue={data?.id_kelas || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Tingkat (Contoh: X, 10, dll)</label><input name="tingkat" defaultValue={data?.tingkat || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Kelas Paralel (Contoh: IPA 1, A, dll)</label><input name="kelas_paralel" defaultValue={data?.kelas_paralel || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                  </>
                )}
                {type === 'mapel' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Mapel</label><input name="id_mapel" defaultValue={data?.id_mapel || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Mapel</label><input name="nama_mapel" defaultValue={data?.nama_mapel || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                  </>
                )}

                {type === 'siswa' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Siswa</label><input name="id_siswa" defaultValue={data?.id_siswa || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Lengkap</label><input id="input_nama_siswa" name="nama_lengkap" defaultValue={data?.nama_lengkap || ''} onChange={handleAutoUsernameSiswa} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Username</label><input name="username" value={autoUsername} onChange={(e) => setAutoUsername(e.target.value)} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password {isEdit && '(Kosongkan jika tidak diubah)'}</label><input name="password" type="password" required={!isEdit} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Kelas</label>
                      <select id="input_kelas_siswa" name="kelas_gabungan" defaultValue={data ? `${data.angkatan}|${data.kelas_paralel}` : ''} onChange={handleAutoUsernameSiswa} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        <option value="">Pilih Kelas</option>
                        {dataKelas.map(k => <option key={k.id_kelas} value={`${k.tingkat}|${k.kelas_paralel}`}>{k.tingkat} {k.kelas_paralel}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {type === 'guru' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Guru</label><input name="id_guru" defaultValue={data?.id_guru || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Lengkap</label><input id="input_nama_guru" name="nama_lengkap" defaultValue={data?.nama_lengkap || ''} onChange={handleAutoUsernameGuru} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Username</label><input name="username" value={autoUsername} onChange={(e) => setAutoUsername(e.target.value)} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password {isEdit && '(Kosongkan jika tidak diubah)'}</label><input name="password" type="password" required={!isEdit} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-slate-300">Mata Pelajaran (Bisa Pilih Lebih dari 1)</label>
                      <div className="max-h-40 overflow-y-auto border border-outline-variant dark:border-slate-600 rounded-md p-2 space-y-1">
                        {dataMapel.map(m => (
                          <label key={m.id_mapel} className="flex items-center space-x-2 text-sm text-on-surface dark:text-slate-300">
                            <input type="checkbox" name="mapels" value={m.id_mapel} defaultChecked={data?.id_mapels?.includes(m.id_mapel)} onChange={handleAutoUsernameGuru} className="rounded text-primary focus:ring-primary" />
                            <span>{m.nama_mapel}</span>
                          </label>
                        ))}
                        {dataMapel.length === 0 && <span className="text-xs text-slate-500">Belum ada mapel, silakan tambahkan di menu mapel.</span>}
                      </div>
                    </div>
                  </>
                )}

                {type === 'jadwal' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Ujian (Jadwal)</label><input name="id_jadwal" defaultValue={data?.id_jadwal || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Mata Pelajaran</label><select name="id_mapel" defaultValue={data?.id_mapel || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option value="">Pilih Mapel</option>{dataMapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Guru Pengawas</label><select name="id_guru" defaultValue={data?.id_guru || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option value="">Pilih Guru</option>{dataGuru.map(g => <option key={g.id_guru} value={g.id_guru}>{g.nama_lengkap}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Tingkat Ujian</label><select name="kelas" defaultValue={data?.kelas || ''} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option value="">Semua Tingkat (Umum)</option>{Array.from(new Set(dataKelas.map(k => k.tingkat))).map(t => <option key={t} value={t}>Tingkat {t}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Waktu Mulai</label><input type="datetime-local" name="waktu_mulai" defaultValue={data?.waktu_mulai ? new Date(data.waktu_mulai).toISOString().slice(0, 16) : ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                      <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Waktu Selesai</label><input type="datetime-local" name="waktu_selesai" defaultValue={data?.waktu_selesai ? new Date(data.waktu_selesai).toISOString().slice(0, 16) : ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    </div>
                    <div className="mt-4 border-t border-outline-variant dark:border-slate-700 pt-4">
                      <label className="block text-sm font-bold mb-2 dark:text-slate-300 text-primary">Pengaturan Keamanan Ujian</label>
                      <label className="flex items-center space-x-2 text-sm text-on-surface dark:text-slate-300 mb-2 cursor-pointer">
                        <input type="checkbox" name="browser_lockdown" defaultChecked={data?.browser_lockdown} className="rounded text-primary focus:ring-primary w-4 h-4" />
                        <span>Gunakan <strong>Browser Lockdown</strong> (Cegah ganti tab/aplikasi)</span>
                      </label>
                      <label className="flex items-center space-x-2 text-sm text-on-surface dark:text-slate-300 mb-2 cursor-pointer">
                        <input type="checkbox" name="acak_soal" defaultChecked={data?.acak_soal} className="rounded text-primary focus:ring-primary w-4 h-4" />
                        <span>Acak Urutan Soal</span>
                      </label>
                      <label className="flex items-center space-x-2 text-sm text-on-surface dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" name="acak_opsi" defaultChecked={data?.acak_opsi} className="rounded text-primary focus:ring-primary w-4 h-4" />
                        <span>Acak Opsi Jawaban (A, B, C, D)</span>
                      </label>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => setFormModal({ isOpen: false, type: '', data: null })} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600">Batal</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-primary to-secondary text-on-primary hover:from-primary/90 hover:to-secondary/90 rounded-lg shadow-sm">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        );
      };

      const renderProfileModal = () => {
        if (!profileModalOpen) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700">
              <h2 className="text-xl font-bold mb-4 text-on-surface dark:text-white">Profil Admin</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const payload = Object.fromEntries(fd.entries());
                if (payload.password && payload.password !== payload.password_confirm) {
                  return alert('Password tidak cocok!');
                }
                const res = await api('update_admin_profil', { id_admin: user.id_admin, password: payload.password, foto_profil: payload.foto_profil });
                if (res.status === 'success') {
                  alert(res.message);
                  setProfileModalOpen(false);
                  onLogout(); // Force logout to reflect changes
                } else {
                  alert(res.message);
                }
              }} className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  {user.foto_profil ? (
                    <img src={user.foto_profil} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-primary/20" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl">{user.nama_lengkap.charAt(0)}</div>
                  )}
                </div>
                <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">URL Foto Profil</label><input name="foto_profil" defaultValue={user.foto_profil || ''} placeholder="https://..." className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password Baru (Kosongkan jika tidak diubah)</label><input name="password" type="password" className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Konfirmasi Password</label><input name="password_confirm" type="password" className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setProfileModalOpen(false)} className="px-4 py-2 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-variant">Batal</button>
                  <button type="submit" className="px-4 py-2 rounded-lg font-label-md bg-gradient-to-r from-primary to-secondary text-on-primary text-on-primary hover:from-primary/90 hover:to-secondary/90">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        );
      };

      const renderDeleteModal = () => {
        if (!deleteModal.isOpen) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up relative p-6 border border-slate-100 dark:border-slate-800">
               <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Konfirmasi Hapus</h3>
               <p className="text-sm text-slate-500 mb-4">Apakah Anda yakin ingin menghapus data ini? Ketik <strong>HAPUS</strong> untuk mengonfirmasi.</p>
               <input 
                 type="text" 
                 placeholder="Ketik HAPUS" 
                 value={confirmText} 
                 onChange={(e) => setConfirmText(e.target.value)} 
                 className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-6 dark:text-white"
               />
               <div className="flex gap-3 justify-end">
                 <button type="button" onClick={() => {setDeleteModal({isOpen:false, type:'', id:null, item:null}); setConfirmText('');}} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
                 <button type="button" onClick={() => { confirmDelete(); setConfirmText(''); }} disabled={confirmText !== 'HAPUS' || isSubmitting} className="px-4 py-2 rounded-lg font-bold text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed">
                   {isSubmitting ? 'Menghapus...' : 'Hapus Data'}
                 </button>
               </div>
            </div>
          </div>
        );
      };

      const handleDownloadTemplate = () => {
        let headers = [];
        let filename = '';
        if (importModal.type === 'siswa') {
          headers = ['nama_lengkap', 'nisn', 'password', 'kelas', 'angkatan', 'kelas_paralel', 'jenis_kelamin'];
          filename = 'Template_Siswa.xlsx';
        } else if (importModal.type === 'guru') {
          headers = ['nama_lengkap', 'nip', 'username', 'password', 'role'];
          filename = 'Template_Guru.xlsx';
        }
        
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, filename);
      };

      const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsSubmitting(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            if (data.length === 0) {
              alert('File kosong atau format salah.');
              setIsSubmitting(false);
              return;
            }

            const endpoint = importModal.type === 'siswa' ? 'create_siswa_bulk' : 'create_guru_bulk';
            const res = await api(endpoint, data);
            
            if (res.status === 'success') {
              alert(`Berhasil mengimpor ${data.length} data ${importModal.type}`);
              await api('create_audit_log', { username: user.username, role: 'admin', action: 'IMPORT', target: `${importModal.type} (${data.length} data)` });
              setImportModal({ isOpen: false, type: '' });
              fetchData(activeTab);
            } else {
              alert(res.message);
            }
          } catch (error) {
            console.error(error);
            alert('Gagal memproses file Excel.');
          } finally {
            setIsSubmitting(false);
          }
        };
        reader.readAsBinaryString(file);
      };

      const renderImportModal = () => {
        if (!importModal.isOpen) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up relative p-6 border border-slate-100 dark:border-slate-800">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Import Data {importModal.type === 'siswa' ? 'Siswa' : 'Guru'}</h3>
                 <button onClick={() => setImportModal({isOpen:false, type:''})} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                   <span className="material-symbols-outlined text-sm">close</span>
                 </button>
               </div>
               
               <p className="text-sm text-slate-500 mb-4">Pastikan format kolom sesuai dengan template. Klik tombol di bawah untuk mengunduh template.</p>
               
               <button onClick={handleDownloadTemplate} className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 font-bold py-3 px-4 rounded-xl mb-4 hover:bg-blue-100 transition-colors">
                 <span className="material-symbols-outlined">download</span> Download Template
               </button>

               <div className="relative w-full">
                 <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} disabled={isSubmitting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                 <div className={`w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-8 ${isSubmitting ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800'} transition-colors`}>
                   <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">upload_file</span>
                   <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{isSubmitting ? 'Memproses...' : 'Pilih atau Tarik File Excel'}</span>
                 </div>
               </div>
            </div>
          </div>
        );
      };

      const SidebarLink = ({ id, icon, label }) => (
        <a onClick={(e) => { e.preventDefault(); setActiveTab(id); setIsSidebarOpen(false); }} className={`flex items-center space-x-sm px-md py-sm rounded-lg font-label-md text-label-md duration-200 ease-in-out cursor-pointer ${activeTab === id ? 'bg-primary-container dark:bg-primary/20 text-on-primary-container dark:text-primary-fixed shadow-sm' : 'text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-highest dark:hover:bg-slate-800 transition-colors'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          <span>{label}</span>
        </a>
      );

      return (
        <>
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/30 selection:text-primary">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] px-6 pt-6 pb-6 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {user.foto_profil ? (
                      <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover bg-white" />
                    ) : (
                      <span className="material-symbols-outlined text-white text-3xl">admin_panel_settings</span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Admin Sekolah</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">NPSN: {user.npsn}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="relative p-1 rounded-full hover:bg-white/20 transition-colors text-white" title="Mode Gelap/Terang">
                    <span className="material-symbols-outlined text-2xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              {activeTab === 'dashboard' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Statistik Sekolah</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-500">school</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{dashboardData?.totalSiswa || 0}</span>
                        <span className="font-medium text-xs text-slate-500">Total Siswa</span>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-blue-500">local_library</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{dashboardData?.totalGuru || 0}</span>
                        <span className="font-medium text-xs text-slate-500">Total Guru</span>
                     </div>
                     <button onClick={() => setActiveTab('mapel')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors active:scale-95 cursor-pointer">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-orange-500">menu_book</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{dashboardData?.totalMapel || 0}</span>
                        <span className="font-medium text-xs text-slate-500">Total Mapel</span>
                     </button>
                     <button onClick={() => setActiveTab('soal')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors active:scale-95 cursor-pointer">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-purple-500">quiz</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{dashboardData?.totalSoal || 0}</span>
                        <span className="font-medium text-xs text-slate-500">Total Soal</span>
                     </button>
                  </div>

                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Jadwal Aktif</h3>
                  <div className="space-y-3">
                    {dataJadwal.filter(j => j.status_ujian === 'AKTIF').slice(0, 2).map((j) => (
                      <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 border-l-primary flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{j.nama_mapel}</h4>
                          <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')} | {j.token || 'Menunggu Token'}</p>
                        </div>
                      </div>
                    ))}
                    {dataJadwal.filter(j => j.status_ujian === 'AKTIF').length === 0 && (
                      <div className="text-center text-sm text-slate-500 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">Tidak ada ujian aktif saat ini.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'siswa' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Siswa</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataSiswa.length} Siswa</span>
                  </div>
                  <div className="mb-4 flex flex-col gap-2">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                      <input type="text" placeholder="Cari nama atau NISN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm dark:text-white" />
                    </div>
                    <div className="flex gap-2">
                      <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:text-white">
                        <option value="">Semua Kelas</option>
                        {[...new Set(dataSiswa.map(s => s.kelas).filter(Boolean))].map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button onClick={() => setImportModal({isOpen: true, type: 'siswa'})} className="flex items-center justify-center gap-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors" title="Import Excel">
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {dataSiswa.filter(s => 
                      (s.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) || s.nisn?.toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (filterKelas === '' || s.kelas === filterKelas)
                    ).map((s) => (
                      <div key={s.id_user} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3 relative">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-green-500">school</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate dark:text-white">{s.nama_lengkap}</h4>
                          <p className="text-xs text-slate-500 truncate">NISN: {s.nisn} | Kls: {s.kelas || '-'}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => openEditModal('siswa', s)} className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors"><span className="material-symbols-outlined text-sm">edit</span></button>
                          <button onClick={() => handleDeleteClick(s.id_siswa, 'siswa', s)} className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                        </div>
                      </div>
                    ))}
                    {dataSiswa.filter(s => (s.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) || s.nisn?.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && <div className="text-center text-xs text-slate-500 mt-4">Data tidak ditemukan.</div>}
                  </div>
                  
                  {/* Floating Action Button (Siswa) */}
                  <button onClick={() => openCreateModal('siswa')} className="absolute bottom-20 right-4 w-10 h-10 bg-gradient-to-tr from-primary to-secondary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all active:scale-95 z-40">
                    <span className="material-symbols-outlined text-xl">add</span>
                  </button>
                </div>
              )}

              {activeTab === 'guru' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Guru</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataGuru.length} Guru</span>
                  </div>
                  <div className="mb-4 flex flex-col gap-2">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                      <input type="text" placeholder="Cari nama atau NIP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm dark:text-white" />
                    </div>
                    <div className="flex gap-2">
                      <select value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:text-white">
                        <option value="">Semua Mapel</option>
                        {dataMapel.map(m => <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>)}
                      </select>
                      <button onClick={() => setImportModal({isOpen: true, type: 'guru'})} className="flex items-center justify-center gap-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors" title="Import Excel">
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {dataGuru.filter(g => 
                      (g.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) || g.nip?.toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (filterMapel === '' || g.mapels_list.includes(filterMapel))
                    ).map((g) => (
                      <div key={g.id_user} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-blue-500">local_library</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate dark:text-white">{g.nama_lengkap}</h4>
                          <p className="text-xs text-slate-500 truncate">NIP: {g.nip || '-'}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => openEditModal('guru', g)} className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors"><span className="material-symbols-outlined text-sm">edit</span></button>
                          <button onClick={() => handleDeleteClick(g.id_guru, 'guru', g)} className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                        </div>
                      </div>
                    ))}
                    {dataGuru.filter(g => (g.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) || g.nip?.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && <div className="text-center text-xs text-slate-500 mt-4">Data tidak ditemukan.</div>}
                  </div>

                  {/* Floating Action Button (Guru) */}
                  <button onClick={() => openCreateModal('guru')} className="absolute bottom-20 right-4 w-10 h-10 bg-gradient-to-tr from-primary to-secondary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all active:scale-95 z-40">
                    <span className="material-symbols-outlined text-xl">add</span>
                  </button>
                </div>
              )}

              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Semua Jadwal Ujian</h3>
                  </div>
                  <div className="mb-4">
                    <select value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:text-white">
                      <option value="">Semua Mapel</option>
                      {dataMapel.map(m => <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {dataJadwal.filter(j => filterMapel === '' || j.nama_mapel === filterMapel).map((j) => (
                      <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                         <div className="flex justify-between items-start">
                           <h4 className="font-bold text-sm dark:text-white">{j.nama_mapel}</h4>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${j.status_ujian === 'AKTIF' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>{j.status_ujian}</span>
                         </div>
                         <p className="text-xs text-slate-500 mb-2">Token: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{j.token || '-'}</span></p>
                         <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                           <button onClick={() => openEditModal('jadwal', j)} className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold hover:bg-blue-100">Edit</button>
                           <button onClick={() => handleDeleteClick(j.id_jadwal, 'jadwal', j)} className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100">Hapus</button>
                         </div>
                      </div>
                    ))}
                    {dataJadwal.length === 0 && <div className="text-center text-sm text-slate-500">Tidak ada jadwal.</div>}
                  </div>

                  {/* Floating Action Button (Jadwal) */}
                  <button onClick={() => openCreateModal('jadwal')} className="absolute bottom-20 right-4 w-10 h-10 bg-gradient-to-tr from-primary to-secondary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all active:scale-95 z-40">
                    <span className="material-symbols-outlined text-xl">add</span>
                  </button>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center">
                   <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                     <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-white dark:border-slate-800 shadow-sm">
                       {user.foto_profil ? (
                         <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover bg-white" />
                       ) : (
                         <span className="material-symbols-outlined text-4xl text-primary">admin_panel_settings</span>
                       )}
                     </div>
                     <div className="absolute bottom-4 right-0 w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow flex items-center justify-center border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                       <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-300">edit</span>
                     </div>
                   </div>
                   <h3 className="font-bold text-xl dark:text-white">{user.nama_lengkap}</h3>
                   <p className="text-slate-500">Admin Sekolah | NPSN: {user.npsn}</p>
                   
                   <div className="w-full mt-8 space-y-3">
                     <button onClick={() => setProfileModalOpen(true)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95 transition-all">
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
                     <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                     <button onClick={onLogout} className="w-full bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex items-center justify-between border border-red-100 dark:border-red-900/30 shadow-sm active:scale-95 transition-all text-red-600">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center"><span className="material-symbols-outlined">logout</span></div>
                         <div className="text-left"><h4 className="font-bold text-sm">Keluar</h4><p className="text-xs opacity-70">Akhiri sesi Anda</p></div>
                       </div>
                     </button>
                   </div>
                </div>
              )}

            {activeTab === 'mapel' && (
              <div className="px-6 mt-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('dashboard')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                    </button>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Mata Pelajaran</h3>
                  </div>
                  <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">{dataMapel.length} Mapel</span>
                </div>
                <div className="space-y-3 pb-24">
                  {dataMapel.map((m) => (
                    <div key={m.id_mapel} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-orange-500">menu_book</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm truncate dark:text-white">{m.nama_mapel}</h4>
                      </div>
                    </div>
                  ))}
                  {dataMapel.length === 0 && <div className="text-center text-xs text-slate-500 mt-4">Belum ada mata pelajaran.</div>}
                </div>
              </div>
            )}

            {activeTab === 'soal' && (
              <div className="px-6 mt-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('dashboard')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                    </button>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Bank Soal (Preview)</h3>
                  </div>
                  <span className="text-sm font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">{dataSoal.length} Soal</span>
                </div>
                <div className="space-y-3 pb-24">
                  {dataSoal.map((s) => (
                    <div key={s.id_soal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-purple-500">{s.mata_pelajaran?.nama_mapel}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{s.tipe_soal}</span>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2" dangerouslySetInnerHTML={{ __html: s.pertanyaan }}></div>
                    </div>
                  ))}
                  {dataSoal.length === 0 && <div className="text-center text-xs text-slate-500 mt-4">Belum ada soal di bank soal.</div>}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="px-6 mt-6 animate-fade-in-up flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setActiveTab('akun')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                  </button>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Log Aktivitas</h3>
                </div>
                <div className="flex-1 overflow-y-auto pb-24 space-y-3">
                  {dataAudit.map((log) => (
                    <div key={log.id_audit} className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="material-symbols-outlined text-amber-500 text-sm">history</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500 mb-1">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                        <h4 className="font-bold text-sm dark:text-white truncate">[{log.action}] {log.username} ({log.role})</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{log.target}</p>
                      </div>
                    </div>
                  ))}
                  {dataAudit.length === 0 && <div className="text-center text-xs text-slate-500 mt-4">Tidak ada log aktivitas.</div>}
                </div>
              </div>
            )}
            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center transition-colors ${activeTab === 'dashboard' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">home</span>
                <span className="text-[10px] font-bold mt-1">Beranda</span>
              </button>
              <button onClick={() => setActiveTab('siswa')} className={`flex flex-col items-center transition-colors ${activeTab === 'siswa' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">school</span>
                <span className="text-[10px] font-bold mt-1">Siswa</span>
              </button>
              <button onClick={() => setActiveTab('guru')} className={`flex flex-col items-center transition-colors ${activeTab === 'guru' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">local_library</span>
                <span className="text-[10px] font-bold mt-1">Guru</span>
              </button>
              <button onClick={() => setActiveTab('jadwal')} className={`flex flex-col items-center transition-colors ${activeTab === 'jadwal' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">event_note</span>
                <span className="text-[10px] font-bold mt-1">Jadwal</span>
              </button>
              <button onClick={() => setActiveTab('akun')} className={`flex flex-col items-center transition-colors ${activeTab === 'akun' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-bold mt-1">Akun</span>
              </button>
            </div>

            {renderFormModal()}
            {renderImportModal()}
            {renderDeleteModal()}
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
                  <button key={idx} onClick={() => handleAvatarSelect(avatar)} className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all ${user.foto_profil === avatar ? 'border-primary ring-4 ring-primary/20 shadow-md scale-105 bg-white' : 'border-slate-100 dark:border-slate-700 hover:border-primary/50 bg-slate-50 dark:bg-slate-800'}`}>
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

export default AdminView;
