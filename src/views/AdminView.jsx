import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
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

      const handleDelete = async (id, type) => {
        if (!confirm(`Hapus data ${type} ini?`)) return;
        let endpoint = `delete_${type}`;
        let payload = {};
        payload[`id_${type}`] = id;

        const res = await api(endpoint, payload);
        if (res.status === 'success') {
          await api('create_audit_log', { username: user.username, role: 'admin', action: 'DELETE', target: `${type} (${id})` });
          fetchData(activeTab);
        } else alert(res.message);
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
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
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
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm">Simpan</button>
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
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700">
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
                  <button type="submit" className="px-4 py-2 rounded-lg font-label-md bg-primary text-on-primary hover:bg-primary/90">Simpan</button>
                </div>
              </form>
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
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/20 selection:text-primary">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] rounded-b-[40px] px-6 pt-8 pb-20 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl">admin_panel_settings</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Admin Sekolah</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">NPSN: {user.npsn}</p>
                  </div>
                </div>
                <button className="relative">
                  <span className="material-symbols-outlined text-2xl">notifications</span>
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              </div>
            </div>

            {/* Stats Cards (Overlapping) */}
            <div className="px-6 -mt-12 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-green-500">school</span>
                  </div>
                  <span className="text-xl font-bold text-green-500">{dataSiswa.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Siswa</span>
                  <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-slate-100 dark:border-slate-700">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-blue-500">local_library</span>
                  </div>
                  <span className="text-xl font-bold text-blue-500">{dataGuru.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Guru</span>
                  <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-purple-500">event_note</span>
                  </div>
                  <span className="text-xl font-bold text-purple-500">{dataJadwal.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Jadwal</span>
                  <span className="text-[10px] text-slate-400">Ujian</span>
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              {activeTab === 'dashboard' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Akses Cepat</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <button onClick={() => setActiveTab('siswa')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-500">school</span>
                        </div>
                        <span className="font-bold text-sm">Kelola Siswa</span>
                     </button>
                     <button onClick={() => setActiveTab('guru')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-blue-500">local_library</span>
                        </div>
                        <span className="font-bold text-sm">Kelola Guru</span>
                     </button>
                     <button onClick={() => setActiveTab('jadwal')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-purple-500">event_note</span>
                        </div>
                        <span className="font-bold text-sm">Jadwal Ujian</span>
                     </button>
                     <button onClick={() => setFormModal({ type: 'SEKOLAH' })} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-orange-500">account_balance</span>
                        </div>
                        <span className="font-bold text-sm">Info Sekolah</span>
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
                  <div className="space-y-3">
                    {dataSiswa.slice(0, 10).map((s) => (
                      <div key={s.id_user} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-green-500">school</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{s.nama_lengkap}</h4>
                          <p className="text-xs text-slate-500 truncate">NISN: {s.nisn} | Kls: {s.kelas || '-'}</p>
                        </div>
                      </div>
                    ))}
                    {dataSiswa.length > 10 && <div className="text-center text-xs text-slate-500 mt-2">Buka versi desktop untuk melihat semua data.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'guru' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Guru</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataGuru.length} Guru</span>
                  </div>
                  <div className="space-y-3">
                    {dataGuru.slice(0, 10).map((g) => (
                      <div key={g.id_user} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-blue-500">local_library</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{g.nama_lengkap}</h4>
                          <p className="text-xs text-slate-500 truncate">NIP: {g.nip || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Semua Jadwal Ujian</h3>
                  </div>
                  <div className="space-y-3">
                    {dataJadwal.map((j) => (
                      <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100">
                         <div className="flex justify-between items-start">
                           <h4 className="font-bold text-sm">{j.nama_mapel}</h4>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${j.status_ujian === 'AKTIF' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>{j.status_ujian}</span>
                         </div>
                         <p className="text-xs text-slate-500">Token: <span className="font-mono font-bold text-slate-700">{j.token || '-'}</span></p>
                      </div>
                    ))}
                    {dataJadwal.length === 0 && <div className="text-center text-sm text-slate-500">Tidak ada jadwal.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center">
                   <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                     <span className="material-symbols-outlined text-4xl text-primary">admin_panel_settings</span>
                   </div>
                   <h3 className="font-bold text-xl">{user.nama_lengkap}</h3>
                   <p className="text-slate-500">Admin Sekolah | NPSN: {user.npsn}</p>
                   
                   <div className="w-full mt-8 space-y-3">
                      <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-slate-500">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">Mode Gelap</span>
                        </div>
                        <div className={`w-10 h-6 rounded-full flex items-center p-1 ${isDarkMode ? 'bg-primary' : 'bg-slate-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isDarkMode ? 'translate-x-4' : ''}`}></div>
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
          </div>
        </div>
      );
    };




export default AdminView;

