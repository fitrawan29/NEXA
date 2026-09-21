import { fetchAPI, getTrueNow } from '../api.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  EmptyState,
  TableSkeleton,
  CardSkeleton,
  StatusBadge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '../components/UI.jsx';

const AdminView = ({ user, onLogout, onUpdateUser, showMessage, isDarkMode, setIsDarkMode }) => {
  const api = (action, p = {}) => {
    if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
    return fetchAPI(action, { ...p, npsn: user.npsn });
  };

  // Navigation & Shell State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Backward compat & mobile drawer
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Data Collections State
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

  // Selection & Filter State
  const [selectedKelas, setSelectedKelas] = useState(null);
  const [selectedJadwal, setSelectedJadwal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  const [filterJadwalStatus, setFilterJadwalStatus] = useState('ALL');

  // Multi-Select Bulk State
  const [selectedSiswa, setSelectedSiswa] = useState([]);
  const [selectedGuru, setSelectedGuru] = useState([]);
  const [selectedJadwalBulk, setSelectedJadwalBulk] = useState([]);

  // Sorting State
  const [sortConfigSiswa, setSortConfigSiswa] = useState({ key: 'nama_lengkap', direction: 'asc' });
  const [sortConfigGuru, setSortConfigGuru] = useState({ key: 'nama_lengkap', direction: 'asc' });
  const [sortConfigJadwal, setSortConfigJadwal] = useState({ key: 'waktu_mulai', direction: 'desc' });

  // Live Monitoring Filters
  const [monitoringFilterStatus, setMonitoringFilterStatus] = useState('ALL');
  const [monitoringFilterKelas, setMonitoringFilterKelas] = useState('ALL');
  const [monitoringSearch, setMonitoringSearch] = useState('');

  // Modals State
  const [formModal, setFormModal] = useState({ isOpen: false, type: '', data: null });
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', id: null, item: null });
  const [importModal, setImportModal] = useState({ isOpen: false, type: '' });
  const [confirmText, setConfirmText] = useState('');

  // Confirmation Dialog State (for proctor interventions)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'unblock',
    title: '',
    message: '',
    icon: 'info',
    actionText: 'Konfirmasi',
    onConfirm: null
  });

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

  const navigateTab = (tabId) => {
    setActiveTab(tabId);
    setIsSidebarOpen(false);
    setIsMobileDrawerOpen(false);
  };

  const handleAvatarSelect = async (avatarUrl) => {
    setIsLoading(true);
    const res = await api('update_admin_profil', { id_admin: user.id_admin, foto_profil: avatarUrl });
    setIsLoading(false);
    if (res.status === 'success') {
      setIsAvatarModalOpen(false);
      if (onUpdateUser) {
        onUpdateUser({ foto_profil: avatarUrl });
      } else {
        user.foto_profil = avatarUrl;
      }
      if (showMessage) {
        showMessage('Sukses', 'Foto profil berhasil diperbarui.', 'success');
      } else {
        alert('Foto profil berhasil diperbarui.');
      }
    } else {
      alert(res.message);
    }
  };

  const fetchData = async (tab) => {
    setIsLoading(true);
    try {
      if (tab === 'dashboard') {
        const res = await api('get_admin_dashboard_data', {});
        if (res.status === 'success') setDashboardData(res.data);
        const resJ = await api('get_all_jadwal', {});
        if (resJ.status === 'success') setDataJadwal(resJ.data || []);
      } else if (tab === 'siswa' || tab === 'kelas') {
        const res = await api('get_siswa', {});
        if (res.status === 'success') {
          setDataSiswa((res.data || []).map(s => ({
            ...s,
            kelas: `${s.angkatan || ''} ${s.kelas_paralel || ''}`.trim()
          })));
        }
        const resK = await api('get_kelas', {});
        if (resK.status === 'success') setDataKelas(resK.data || []);
      } else if (tab === 'guru') {
        const res = await api('get_guru', {});
        if (res.status === 'success') setDataGuru(res.data || []);
        const resMapel = await api('get_all_mapel', {});
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
      } else if (tab === 'mapel') {
        const res = await api('get_all_mapel', {});
        if (res.status === 'success') setDataMapel(res.data || []);
      } else if (tab === 'logs') {
        const res = await api('get_audit_log', {});
        if (res.status === 'success') setDataAudit(res.data || []);
      } else if (tab === 'soal') {
        const res = await api('get_bank_soal_admin', {});
        if (res.status === 'success') setDataSoal(res.data || []);
        const resMapel = await api('get_all_mapel', {});
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
      } else if (tab === 'pengumuman') {
        const res = await api('get_pengumuman', { role: 'admin' });
        if (res.status === 'success') setDataPengumuman(res.data || []);
      } else if (tab === 'jadwal' || tab === 'monitoring' || tab === 'hasil' || tab === 'kontrol') {
        const res = await api('get_all_jadwal', {});
        if (res.status === 'success') setDataJadwal(res.data || []);
        const resMapel = await api('get_all_mapel', {});
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
        const resKelas = await api('get_kelas', {});
        if (resKelas.status === 'success') setDataKelas(resKelas.data || []);
        const resGuru = await api('get_guru', {});
        if (resGuru.status === 'success') setDataGuru(resGuru.data || []);

        if (selectedJadwal) {
          const endpoint = tab === 'hasil' ? 'get_hasil_ujian' : 'monitoring_ujian';
          const logRes = await api(endpoint, { id_jadwal: selectedJadwal });
          if (logRes.status === 'success') setDataLog(logRes.data || []);
        } else {
          setDataLog([]);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
    let interval;
    if (activeTab === 'monitoring' && selectedJadwal) {
      interval = setInterval(() => fetchData('monitoring'), 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab, selectedJadwal]);

  const handleDeleteClick = (id, type, item) => {
    setDeleteModal({ isOpen: true, type, id, item });
  };

  const confirmDelete = async () => {
    setIsSubmitting(true);
    let endpoint = deleteModal.type === 'soal' ? 'delete_soal_mapel' : `delete_${deleteModal.type}`;
    let payload = {};
    payload[`id_${deleteModal.type}`] = deleteModal.id;

    const res = await api(endpoint, payload);
    setIsSubmitting(false);
    if (res.status === 'success') {
      await api('create_audit_log', {
        username: user.username,
        role: 'admin',
        action: 'DELETE',
        target: `${deleteModal.type} (${deleteModal.id})`
      });
      setDeleteModal({ isOpen: false, type: '', id: null, item: null });
      fetchData(activeTab);
    } else {
      alert(res.message);
    }
  };

  const handleBulkDelete = async (type) => {
    let ids = [];
    if (type === 'siswa') ids = selectedSiswa;
    else if (type === 'guru') ids = selectedGuru;
    else if (type === 'jadwal') ids = selectedJadwalBulk;

    if (!ids || ids.length === 0) return alert('Pilih data terlebih dahulu.');

    if (!confirm(`Apakah Anda yakin ingin menghapus ${ids.length} data ${type} yang dipilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsLoading(true);
    const endpoint = `delete_${type}_bulk`;
    const res = await api(endpoint, { ids });
    setIsLoading(false);

    if (res.status === 'success') {
      alert(res.message);
      await api('create_audit_log', {
        username: user.username,
        role: 'admin',
        action: 'DELETE_BULK',
        target: `${type} (${ids.length} item)`
      });
      if (type === 'siswa') setSelectedSiswa([]);
      else if (type === 'guru') setSelectedGuru([]);
      else if (type === 'jadwal') setSelectedJadwalBulk([]);
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

  const handleResetAllLoginSiswa = async () => {
    if (!confirm('Anda yakin ingin mereset sesi login SELURUH siswa secara massal? Ini akan mengeluarkan semua siswa yang sedang login.')) return;
    setIsSubmitting(true);
    const res = await fetchAPI('reset_all_login_siswa', { npsn: user.npsn });
    setIsSubmitting(false);
    if (res.status === 'success') {
      alert('Sesi login seluruh siswa berhasil direset.');
    } else {
      alert(res.message);
    }
  };

  const handleUpdateStatusUjian = async (id_jadwal, status_baru) => {
    setIsSubmitting(true);
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
    setIsSubmitting(false);
    if (res.status === 'success') {
      fetchData(activeTab);
    } else {
      alert(res.message);
    }
  };

  const handleBulkUpdateStatusUjian = async (status_baru) => {
    if (!confirm(`Apakah Anda yakin ingin mengatur SEMUA ujian menjadi ${status_baru}?`)) return;
    setIsSubmitting(true);
    const now = await getTrueNow();

    const updates = dataJadwal.map(j => {
      let updateObj = { id_jadwal: j.id_jadwal };
      if (status_baru === 'AKTIF') {
        updateObj.waktu_mulai = new Date(now.getTime() - 60000).toISOString();
        if (j.waktu_selesai && new Date(j.waktu_selesai) > now) {
          updateObj.waktu_selesai = j.waktu_selesai;
        } else {
          updateObj.waktu_selesai = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        }
      } else if (status_baru === 'SELESAI') {
        updateObj.waktu_selesai = new Date(now.getTime() - 60000).toISOString();
      } else if (status_baru === 'BELUM MULAI') {
        updateObj.waktu_mulai = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        updateObj.waktu_selesai = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();
      }
      return api('update_jadwal', updateObj);
    });

    await Promise.all(updates);
    setIsSubmitting(false);
    alert(`Semua jadwal ujian berhasil diubah menjadi ${status_baru}`);
    fetchData('jadwal');
  };

  // Proctor Actions with Confirmation Dialogs
  const handleBlock = (idLog) => {
    setConfirmDialog({
      isOpen: true,
      type: 'block',
      title: 'Blokir Peserta Ujian',
      message: 'Apakah Anda yakin ingin memblokir peserta ini dari ujian?',
      icon: 'gpp_bad',
      actionText: 'Blokir Peserta',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        await api('catat_pelanggaran', { id_log: idLog });
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'BLOCK', target: `Siswa Log (${idLog})` });
        setIsLoading(false);
        fetchData('monitoring');
      }
    });
  };

  const handleUnblock = (studentOrLog) => {
    const idLog = typeof studentOrLog === 'object' ? studentOrLog.id_log : studentOrLog;
    const idSiswa = typeof studentOrLog === 'object' ? studentOrLog.id_siswa : null;

    setConfirmDialog({
      isOpen: true,
      type: 'unblock',
      title: 'Buka Blokir Peserta',
      message: 'Apakah Anda yakin ingin membuka blokir siswa ini agar dapat melanjutkan ujian?',
      icon: 'lock_open',
      actionText: 'Buka Blokir',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        // Supports both { id_log } and proctor intervention contract { p_id_siswa, p_id_jadwal }
        await api('buka_blokir', {
          id_log: idLog,
          id_siswa: idSiswa,
          id_jadwal: selectedJadwal,
          p_id_siswa: idSiswa,
          p_id_jadwal: selectedJadwal
        });
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'UNBLOCK', target: `Siswa Log (${idLog || idSiswa})` });
        setIsLoading(false);
        fetchData('monitoring');
      }
    });
  };

  const handleResetSesiUjian = (studentOrLog) => {
    const idSiswa = typeof studentOrLog === 'object' ? studentOrLog.id_siswa : studentOrLog;
    const idLog = typeof studentOrLog === 'object' ? studentOrLog.id_log : null;

    setConfirmDialog({
      isOpen: true,
      type: 'reset',
      title: 'Reset Sesi Ujian Siswa',
      message: 'Sesi ujian siswa akan direset sehingga siswa dapat masuk kembali ke ujian ini. Lanjutkan?',
      icon: 'restart_alt',
      actionText: 'Reset Sesi',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        await api('reset_sesi_siswa', {
          id_siswa: idSiswa,
          id_jadwal: selectedJadwal,
          p_id_siswa: idSiswa,
          p_id_jadwal: selectedJadwal,
          id_log: idLog
        });
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'RESET_SESI', target: `Siswa Sesi (${idSiswa})` });
        setIsLoading(false);
        fetchData('monitoring');
      }
    });
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

    if (formModal.type === 'guru') {
      payload.mapels = formData.getAll('mapels');
    }

    if (formModal.type === 'siswa' && payload.kelas_gabungan) {
      const [t, p] = payload.kelas_gabungan.split('|');
      payload.angkatan = t;
      payload.kelas_paralel = p;
      delete payload.kelas_gabungan;
    }

    if (formModal.type === 'jadwal') {
      payload.browser_lockdown = true;
      payload.acak_soal = true;
      payload.acak_opsi = true;

      if (payload.tanggal && payload.waktu_mulai_time && payload.waktu_selesai_time) {
        payload.waktu_mulai = `${payload.tanggal}T${payload.waktu_mulai_time}`;
        payload.waktu_selesai = `${payload.tanggal}T${payload.waktu_selesai_time}`;
        delete payload.tanggal;
        delete payload.waktu_mulai_time;
        delete payload.waktu_selesai_time;
      }
    }

    const res = await api(endpoint, payload);
    setIsSubmitting(false);
    if (res.status === 'success') {
      await api('create_audit_log', {
        username: user.username,
        role: 'admin',
        action: isEdit ? 'UPDATE' : 'CREATE',
        target: `${formModal.type} (${payload[`id_${formModal.type}`] || 'Baru'})`
      });
      setFormModal({ isOpen: false, type: '', data: null });
      fetchData(activeTab);
    } else {
      alert(res.message);
    }
  };

  const openCreateModal = async (type) => {
    if (type === 'guru' || type === 'jadwal') {
      const res = await api('get_all_mapel', {});
      if (res.status === 'success') setDataMapel(res.data || []);
      if (type === 'jadwal') {
        const resG = await api('get_guru', {});
        if (resG.status === 'success') setDataGuru(resG.data || []);
      }
    }
    setFormModal({ isOpen: true, type, data: null });
  };

  const openEditModal = async (type, item) => {
    if (type === 'guru' || type === 'jadwal') {
      const res = await api('get_all_mapel', {});
      if (res.status === 'success') setDataMapel(res.data || []);
      if (type === 'jadwal') {
        const resG = await api('get_guru', {});
        if (resG.status === 'success') setDataGuru(resG.data || []);
      }
    }
    setFormModal({ isOpen: true, type, data: item });
  };

  const handleDownloadTemplate = () => {
    let headers = [];
    let filename = '';
    if (importModal.type === 'siswa') {
      headers = ['nama_lengkap', 'nisn', 'username', 'password', 'kelas', 'angkatan', 'kelas_paralel'];
      filename = 'Template_Siswa.xlsx';
    } else if (importModal.type === 'guru') {
      headers = ['nama_lengkap', 'nip', 'username', 'password', 'mata_pelajaran', 'role'];
      filename = 'Template_Guru.xlsx';
    } else if (importModal.type === 'jadwal') {
      headers = ['nama_mapel', 'nama_guru_atau_nip', 'tanggal', 'jam_mulai', 'jam_selesai', 'durasi_menit', 'target_kelas', 'token'];
      filename = 'Template_Jadwal.xlsx';
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
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (!rawData || rawData.length === 0) {
          alert('File kosong atau format salah.');
          setIsSubmitting(false);
          return;
        }

        let endpoint = '';
        let processedData = [];

        if (importModal.type === 'siswa') {
          endpoint = 'create_siswa_bulk';
          processedData = rawData.map(row => {
            const r = { ...row };
            delete r.jenis_kelamin;
            const nisnStr = String(r.nisn || '').trim();
            if (!r.username || String(r.username).trim() === '') {
              r.username = nisnStr;
            }
            if (!r.password || String(r.password).trim() === '') {
              r.password = 'Nexa123!';
            }
            return r;
          });
        } else if (importModal.type === 'guru') {
          endpoint = 'create_guru_bulk';
          let mapelList = dataMapel;
          if (!mapelList || mapelList.length === 0) {
            const mRes = await api('get_all_mapel', {});
            if (mRes.status === 'success') mapelList = mRes.data || [];
          }

          processedData = rawData.map(row => {
            const r = { ...row };
            if (!r.role || String(r.role).trim() === '') {
              r.role = 'guru';
            }
            if (!r.password || String(r.password).trim() === '') {
              r.password = 'Nexa123!';
            }
            if (!r.username || String(r.username).trim() === '') {
              r.username = r.nip ? String(r.nip).trim() : `guru_${Math.random().toString(36).substring(2, 7)}`;
            }
            if (r.mata_pelajaran) {
              const mpNames = String(r.mata_pelajaran).split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
              const matchedMapels = mapelList.filter(m =>
                mpNames.includes((m.nama_mapel || '').toLowerCase()) ||
                mpNames.includes((m.kode_mapel || '').toLowerCase())
              ).map(m => m.id_mapel);
              r.mapels = matchedMapels;
            } else {
              r.mapels = [];
            }
            return r;
          });
        } else if (importModal.type === 'jadwal') {
          endpoint = 'create_jadwal_bulk';
          let mapelList = dataMapel;
          if (!mapelList || mapelList.length === 0) {
            const mRes = await api('get_all_mapel', {});
            if (mRes.status === 'success') mapelList = mRes.data || [];
          }
          let guruList = dataGuru;
          if (!guruList || guruList.length === 0) {
            const gRes = await api('get_guru', {});
            if (gRes.status === 'success') guruList = gRes.data || [];
          }

          processedData = rawData.map(row => {
            const mapelQuery = String(row.nama_mapel || '').trim().toLowerCase();
            const matchedMapel = mapelList.find(m =>
              (m.nama_mapel || '').toLowerCase() === mapelQuery ||
              (m.kode_mapel || '').toLowerCase() === mapelQuery ||
              m.id_mapel === row.nama_mapel
            );
            const id_mapel = matchedMapel ? matchedMapel.id_mapel : (mapelList[0]?.id_mapel || null);

            const guruQuery = String(row.nama_guru_atau_nip || row.guru || '').trim().toLowerCase();
            const matchedGuru = guruList.find(g =>
              (g.nama_lengkap || '').toLowerCase() === guruQuery ||
              (g.nip && String(g.nip).toLowerCase() === guruQuery) ||
              (g.username && g.username.toLowerCase() === guruQuery) ||
              g.id_guru === row.nama_guru_atau_nip
            );
            const id_guru = matchedGuru ? matchedGuru.id_guru : null;

            let tgl = row.tanggal ? String(row.tanggal).trim() : new Date().toISOString().split('T')[0];
            let jamM = row.jam_mulai ? String(row.jam_mulai).trim() : '08:00';
            let jamS = row.jam_selesai ? String(row.jam_selesai).trim() : '10:00';
            if (jamM.length === 5) jamM += ':00';
            if (jamS.length === 5) jamS += ':00';

            const waktu_mulai = `${tgl}T${jamM}`;
            const waktu_selesai = `${tgl}T${jamS}`;
            const durasi_menit = parseInt(row.durasi_menit, 10) || 90;
            const target_kelas = row.target_kelas ? String(row.target_kelas).trim() : '';
            const rawToken = row.token ? String(row.token).trim().toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();

            return {
              id_mapel,
              id_guru,
              waktu_mulai,
              waktu_selesai,
              durasi_menit,
              target_kelas,
              token_aktif: rawToken,
              last_update_token: new Date().toISOString(),
              browser_lockdown: true,
              acak_soal: true,
              acak_opsi: true
            };
          });
        }

        const res = await api(endpoint, processedData);

        if (res.status === 'success') {
          alert(`Berhasil mengimpor ${processedData.length} data ${importModal.type}`);
          await api('create_audit_log', {
            username: user.username,
            role: 'admin',
            action: 'IMPORT',
            target: `${importModal.type} (${processedData.length} data)`
          });
          setImportModal({ isOpen: false, type: '' });
          fetchData(activeTab);
        } else {
          alert(res.message);
        }
      } catch (error) {
        console.error(error);
        alert('Gagal memproses file Excel: ' + error.message);
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const openAnalisisSoal = async () => {
    if (!selectedJadwal) return alert('Pilih jadwal ujian terlebih dahulu.');
    const jadwalObj = dataJadwal.find(j => j.id_jadwal === selectedJadwal);
    if (!jadwalObj) return;
    setIsLoading(true);
    const res = await api('get_analisis_soal', { id_jadwal: selectedJadwal, id_mapel: jadwalObj.id_mapel });
    setIsLoading(false);
    if (res.status === 'success') {
      setDataAnalisis(res.data || []);
      setIsAnalisisModalOpen(true);
    } else {
      alert('Gagal memuat analisis soal: ' + res.message);
    }
  };

  const exportToExcel = () => {
    if (!dataLog || dataLog.length === 0) return alert('Tidak ada data untuk di-export');
    const exportData = dataLog.map((l, i) => ({
      'No': i + 1,
      'ID Siswa': l.id_siswa,
      'Nama Siswa': l.nama_lengkap,
      'Tingkat': l.angkatan || '-',
      'Paralel': l.kelas_paralel || '-',
      'Waktu Login': l.waktu_login ? new Date(l.waktu_login).toLocaleString('id-ID') : '-',
      'Nilai Pilihan Ganda': l.nilai_auto !== null ? l.nilai_auto : 0,
      'Nilai Uraian': l.nilai_uraian !== null ? l.nilai_uraian : 0,
      'Total Nilai': l.total_nilai !== null ? l.total_nilai : ((Number(l.nilai_auto) || 0) + (Number(l.nilai_uraian) || 0))
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');
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
        'NISN': s.nisn || '-',
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
        'NIP': g.nip || '-',
        'Username': g.username,
        'Mata Pelajaran': g.mapels_list || '-',
      }));
      fileName = 'Data_Guru.xlsx';
    } else if (type === 'jadwal') {
      if (!dataJadwal || dataJadwal.length === 0) return alert('Tidak ada data jadwal untuk di-export');
      exportData = dataJadwal.map((j, i) => {
        const mapelObj = dataMapel.find(m => m.id_mapel === j.id_mapel);
        const guruObj = dataGuru.find(g => g.id_guru === j.id_guru);
        const tgl = j.waktu_mulai ? j.waktu_mulai.split('T')[0] : '';
        const jamMulai = j.waktu_mulai ? (j.waktu_mulai.split('T')[1] || '').substring(0, 5) : '';
        const jamSelesai = j.waktu_selesai ? (j.waktu_selesai.split('T')[1] || '').substring(0, 5) : '';
        return {
          'No': i + 1,
          'Mata Pelajaran': mapelObj ? mapelObj.nama_mapel : (j.nama_mapel || j.id_mapel || '-'),
          'Guru': guruObj ? guruObj.nama_lengkap : (j.guru || j.id_guru || '-'),
          'Tanggal': tgl,
          'Jam Mulai': jamMulai,
          'Jam Selesai': jamSelesai,
          'Durasi (Menit)': j.durasi_menit || 90,
          'Target Kelas': j.target_kelas || 'Semua Kelas',
          'Token': j.token_aktif || j.token || '-'
        };
      });
      fileName = 'Data_Jadwal.xlsx';
    }

    if (exportData.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Data ${type}`);
      XLSX.writeFile(workbook, fileName);
    }
  };

  // Memoized Filtered and Sorted Data
  const sortedFilteredSiswa = useMemo(() => {
    let list = dataSiswa.filter(s => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q || (s.nama_lengkap || '').toLowerCase().includes(q) || (s.nisn || '').includes(q);
      const matchesKelas = !filterKelas || s.kelas === filterKelas;
      return matchesQuery && matchesKelas;
    });

    if (sortConfigSiswa.key) {
      list = [...list].sort((a, b) => {
        const valA = (a[sortConfigSiswa.key] || '').toString().toLowerCase();
        const valB = (b[sortConfigSiswa.key] || '').toString().toLowerCase();
        return sortConfigSiswa.direction === 'asc'
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      });
    }
    return list;
  }, [dataSiswa, searchQuery, filterKelas, sortConfigSiswa]);

  const sortedFilteredGuru = useMemo(() => {
    let list = dataGuru.filter(g => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q || (g.nama_lengkap || '').toLowerCase().includes(q) || (g.nip || '').includes(q);
      const matchesMapel = !filterMapel || (g.mapels_list || '').includes(filterMapel);
      return matchesQuery && matchesMapel;
    });

    if (sortConfigGuru.key) {
      list = [...list].sort((a, b) => {
        const valA = (a[sortConfigGuru.key] || '').toString().toLowerCase();
        const valB = (b[sortConfigGuru.key] || '').toString().toLowerCase();
        return sortConfigGuru.direction === 'asc'
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      });
    }
    return list;
  }, [dataGuru, searchQuery, filterMapel, sortConfigGuru]);

  const sortedFilteredJadwal = useMemo(() => {
    let list = dataJadwal.filter(j => {
      const matchesMapel = !filterMapel || j.nama_mapel === filterMapel;
      const matchesStatus = filterJadwalStatus === 'ALL' || j.status_ujian === filterJadwalStatus;
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q || (j.nama_mapel || '').toLowerCase().includes(q) || (j.guru || '').toLowerCase().includes(q) || (j.token || '').toLowerCase().includes(q);
      return matchesMapel && matchesStatus && matchesQuery;
    });

    if (sortConfigJadwal.key) {
      list = [...list].sort((a, b) => {
        const valA = a[sortConfigJadwal.key] || '';
        const valB = b[sortConfigJadwal.key] || '';
        return sortConfigJadwal.direction === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return list;
  }, [dataJadwal, filterMapel, filterJadwalStatus, searchQuery, sortConfigJadwal]);

  // Live Monitoring Computed Metrics and Filtered List
  const { monitoringMetrics, filteredMonitoringLogs } = useMemo(() => {
    const total = dataLog.length;
    const mengerjakans = dataLog.filter(l => !l.is_blocked && l.status_ujian !== 'SELESAI');
    const selesais = dataLog.filter(l => l.status_ujian === 'SELESAI');
    const terblokirs = dataLog.filter(l => l.is_blocked);

    const filtered = dataLog.filter(l => {
      const matchesStatus = monitoringFilterStatus === 'ALL'
        ? true
        : monitoringFilterStatus === 'TERBLOKIR'
          ? l.is_blocked
          : monitoringFilterStatus === 'SEDANG KERJA'
            ? (!l.is_blocked && l.status_ujian !== 'SELESAI')
            : l.status_ujian === monitoringFilterStatus;

      const kelas = `${l.angkatan || ''} ${l.kelas_paralel || ''}`.trim();
      const matchesKelas = monitoringFilterKelas === 'ALL' || !monitoringFilterKelas || kelas === monitoringFilterKelas;

      const q = monitoringSearch.toLowerCase();
      const matchesSearch = !q || (l.nama_lengkap || '').toLowerCase().includes(q) || (l.nisn || '').includes(q);

      return matchesStatus && matchesKelas && matchesSearch;
    });

    return {
      monitoringMetrics: {
        total,
        mengerjakan: mengerjakans.length,
        selesai: selesais.length,
        terblokir: terblokirs.length
      },
      filteredMonitoringLogs: filtered
    };
  }, [dataLog, monitoringFilterStatus, monitoringFilterKelas, monitoringSearch]);

  // Available classes for monitoring
  const availableMonitoringClasses = useMemo(() => {
    const classes = new Set();
    dataLog.forEach(l => {
      const k = `${l.angkatan || ''} ${l.kelas_paralel || ''}`.trim();
      if (k) classes.add(k);
    });
    return Array.from(classes);
  }, [dataLog]);

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

  // Navigation Structure Taxonomy
  const navGroups = [
    {
      title: 'Utama',
      items: [
        { id: 'dashboard', label: 'Beranda', icon: 'dashboard' }
      ]
    },
    {
      title: 'Data Master',
      items: [
        { id: 'siswa', label: 'Data Siswa', icon: 'school', badge: dataSiswa.length },
        { id: 'guru', label: 'Data Guru', icon: 'local_library', badge: dataGuru.length },
        { id: 'mapel', label: 'Mata Pelajaran', icon: 'menu_book', badge: dataMapel.length },
        { id: 'kelas', label: 'Manajemen Kelas', icon: 'meeting_room', badge: dataKelas.length }
      ]
    },
    {
      title: 'Ujian & Pelaksanaan',
      items: [
        { id: 'jadwal', label: 'Jadwal Ujian', icon: 'event_note', badge: dataJadwal.length },
        { id: 'kontrol', label: 'Kontrol Ujian', icon: 'settings_remote' },
        { id: 'soal', label: 'Bank Soal (Preview)', icon: 'quiz' }
      ]
    },
    {
      title: 'Sistem',
      items: [
        { id: 'logs', label: 'Log Aktivitas', icon: 'history' },
        { id: 'akun', label: 'Profil Admin', icon: 'person' }
      ]
    }
  ];

  const bottomBarItems = [
    { id: 'dashboard', label: 'Beranda', icon: 'home' },
    { id: 'siswa', label: 'Siswa', icon: 'school' },
    { id: 'guru', label: 'Guru', icon: 'local_library' },
    { id: 'jadwal', label: 'Jadwal', icon: 'event_note' },
    { id: '_drawer', label: 'Menu', icon: 'menu', isDrawerTrigger: true }
  ];

  const tabTitleMap = {
    dashboard: 'Beranda Admin',
    siswa: 'Master Data Siswa',
    guru: 'Master Data Guru',
    mapel: 'Mata Pelajaran',
    kelas: 'Manajemen Kelas',
    jadwal: 'Jadwal Ujian',
    kontrol: 'Kontrol Ujian',
    monitoring: 'Live Monitoring Ujian',
    hasil: 'Rekap Hasil Ujian',
    soal: 'Bank Soal (Preview)',
    logs: 'Log Aktivitas Sistem',
    akun: 'Profil Admin'
  };

  // ================= MODALS RENDERERS (PHANTOM FREE) =================

  const renderAnalisisModal = () => {
    if (!isAnalisisModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto flex flex-col animate-scale-up">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">analytics</span>
              Analisis Butir Soal
            </h2>
            <button
              onClick={() => setIsAnalisisModalOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">ID Soal</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-1/2">Pertanyaan</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Tipe</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Benar</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Salah</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">Tingkat Kesukaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {dataAnalisis.length > 0 ? dataAnalisis.map((soal, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-3 font-mono">{soal.id_soal}</td>
                    <td className="p-3 truncate max-w-[200px]" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}></td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-semibold">
                        {soal.tipe_soal}
                      </span>
                    </td>
                    <td className="p-3 text-center text-emerald-600 font-bold">{soal.correct}</td>
                    <td className="p-3 text-center text-rose-600 font-bold">{soal.wrong}</td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        parseFloat(soal.difficulty) > 70 ? 'bg-emerald-100 text-emerald-700' :
                        parseFloat(soal.difficulty) < 30 ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {soal.difficulty}%
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-500">
                      Belum ada data pengerjaan untuk dianalisis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderFormModal = () => {
    if (!formModal.isOpen) return null;
    const { type, data } = formModal;
    const isEdit = data != null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto animate-scale-up">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white capitalize">
              {isEdit ? 'Edit Data' : 'Tambah Data'} {type}
            </h2>
            <button
              onClick={() => setFormModal({ isOpen: false, type: '', data: null })}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <form onSubmit={handleSaveForm} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {type === 'kelas' && (
              <>
                {isEdit && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ID Kelas</label>
                    <input name="id_kelas" defaultValue={data?.id_kelas || ''} readOnly={isEdit} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm bg-slate-50" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tingkat (Contoh: X, 10, dll)</label>
                  <input name="tingkat" defaultValue={data?.tingkat || ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Kelas Paralel (Contoh: IPA 1, A, dll)</label>
                  <input name="kelas_paralel" defaultValue={data?.kelas_paralel || ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
              </>
            )}

            {type === 'mapel' && (
              <>
                {isEdit && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ID Mapel</label>
                    <input name="id_mapel" defaultValue={data?.id_mapel || ''} readOnly={isEdit} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm bg-slate-50" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Mapel</label>
                  <input name="nama_mapel" defaultValue={data?.nama_mapel || ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
              </>
            )}

            {type === 'siswa' && (
              <>
                {isEdit && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ID Siswa</label>
                    <input name="id_siswa" defaultValue={data?.id_siswa || ''} readOnly={isEdit} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm bg-slate-50" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">NISN</label>
                  <input name="nisn" defaultValue={data?.nisn || ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Lengkap</label>
                  <input id="input_nama_siswa" name="nama_lengkap" defaultValue={data?.nama_lengkap || ''} onChange={handleAutoUsernameSiswa} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Username</label>
                  <input name="username" value={autoUsername} onChange={(e) => setAutoUsername(e.target.value)} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Password {isEdit && '(Kosongkan jika tidak diubah)'}</label>
                  <input name="password" type="password" required={!isEdit} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Kelas</label>
                  <select id="input_kelas_siswa" name="kelas_gabungan" defaultValue={data ? `${data.angkatan}|${data.kelas_paralel}` : ''} onChange={handleAutoUsernameSiswa} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white">
                    <option value="">Pilih Kelas</option>
                    {dataKelas.map(k => (
                      <option key={k.id_kelas} value={`${k.tingkat}|${k.kelas_paralel}`}>
                        {k.tingkat} {k.kelas_paralel}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {type === 'guru' && (
              <>
                {isEdit && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ID Guru</label>
                    <input name="id_guru" defaultValue={data?.id_guru || ''} readOnly={isEdit} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm bg-slate-50" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Lengkap</label>
                  <input id="input_nama_guru" name="nama_lengkap" defaultValue={data?.nama_lengkap || ''} onChange={handleAutoUsernameGuru} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Username</label>
                  <input name="username" value={autoUsername} onChange={(e) => setAutoUsername(e.target.value)} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Password {isEdit && '(Kosongkan jika tidak diubah)'}</label>
                  <input name="password" type="password" required={!isEdit} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Mata Pelajaran (Bisa Pilih Lebih dari 1)</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1.5 bg-slate-50 dark:bg-slate-900/40">
                    {dataMapel.map(m => (
                      <label key={m.id_mapel} className="flex items-center space-x-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" name="mapels" value={m.id_mapel} defaultChecked={data?.id_mapels?.includes(m.id_mapel)} onChange={handleAutoUsernameGuru} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span>{m.nama_mapel}</span>
                      </label>
                    ))}
                    {dataMapel.length === 0 && <span className="text-xs text-slate-400">Belum ada mapel, silakan tambahkan di menu mapel.</span>}
                  </div>
                </div>
              </>
            )}

            {type === 'jadwal' && (
              <>
                {isEdit && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ID Ujian (Jadwal)</label>
                    <input name="id_jadwal" defaultValue={data?.id_jadwal || ''} readOnly={isEdit} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm bg-slate-50" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Mata Pelajaran</label>
                  <select name="id_mapel" defaultValue={data?.id_mapel || ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white">
                    <option value="">Pilih Mapel</option>
                    {dataMapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Guru Pengampu</label>
                  <select name="id_guru" defaultValue={data?.id_guru || ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white">
                    <option value="">Pilih Guru</option>
                    {dataGuru.map(g => <option key={g.id_guru} value={g.id_guru}>{g.nama_lengkap}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tingkat Ujian</label>
                  <select name="target_kelas" defaultValue={data?.target_kelas || ''} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white">
                    <option value="">Semua Tingkat (Umum)</option>
                    {Array.from(new Set(dataKelas.map(k => k.tingkat))).map(t => <option key={t} value={t}>Tingkat {t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tanggal Ujian</label>
                  <input type="date" name="tanggal" defaultValue={data?.waktu_mulai ? new Date(data.waktu_mulai).toISOString().slice(0, 10) : ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Jam Mulai</label>
                    <input type="time" name="waktu_mulai_time" defaultValue={data?.waktu_mulai ? new Date(data.waktu_mulai).toISOString().slice(11, 16) : ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Jam Selesai</label>
                    <input type="time" name="waktu_selesai_time" defaultValue={data?.waktu_selesai ? new Date(data.waktu_selesai).toISOString().slice(11, 16) : ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                  </div>
                </div>
              </>
            )}

            <div className="col-span-1 md:col-span-2 xl:col-span-3 flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFormModal({ isOpen: false, type: '', data: null })}
                className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderProfileModal = () => {
    if (!profileModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Profil Admin</h2>
            <button
              onClick={() => setProfileModalOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const payload = Object.fromEntries(fd.entries());
              if (payload.password && payload.password !== payload.password_confirm) {
                return alert('Password tidak cocok!');
              }
              const res = await api('update_admin_profil', { id_admin: user.id_admin, password: payload.password, foto_profil: payload.foto_profil });
              if (res.status === 'success') {
                if (payload.foto_profil && onUpdateUser) {
                  onUpdateUser({ foto_profil: payload.foto_profil });
                }
                alert(res.message);
                setProfileModalOpen(false);
              } else {
                alert(res.message);
              }
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-center mb-2">
              {user.foto_profil ? (
                <img src={user.foto_profil} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-emerald-500/20" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-3xl">
                  {user.nama_lengkap.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">URL Foto Profil</label>
              <input name="foto_profil" defaultValue={user.foto_profil || ''} placeholder="https://..." className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Password Baru (Kosongkan jika tidak diubah)</label>
              <input name="password" type="password" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Konfirmasi Password</label>
              <input name="password_confirm" type="password" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderDeleteModal = () => {
    if (!deleteModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative p-5 sm:p-6 border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-2xl">delete</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Konfirmasi Hapus</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Apakah Anda yakin ingin menghapus data ini? Ketik <strong>HAPUS</strong> untuk mengonfirmasi.
          </p>
          <input
            type="text"
            placeholder="Ketik HAPUS"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 mb-5 dark:text-white"
          />
          <div className="flex gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => { setDeleteModal({ isOpen: false, type: '', id: null, item: null }); setConfirmText(''); }}
              className="px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => { confirmDelete(); setConfirmText(''); }}
              disabled={confirmText !== 'HAPUS' || isSubmitting}
              className="px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Menghapus...' : 'Hapus Data'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderImportModal = () => {
    if (!importModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative p-5 sm:p-6 border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Import Data {importModal.type === 'siswa' ? 'Siswa' : importModal.type === 'guru' ? 'Guru' : 'Jadwal'}
            </h3>
            <button
              onClick={() => setImportModal({ isOpen: false, type: '' })}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Pastikan format kolom sesuai dengan template Excel yang disediakan.
          </p>

          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold py-2.5 px-4 rounded-xl mb-4 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-lg">download</span> Download Template Excel
          </button>

          <div className="relative w-full">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportFile}
              disabled={isSubmitting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className={`w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-8 ${isSubmitting ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800'} transition-colors`}>
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">upload_file</span>
              <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                {isSubmitting ? 'Memproses File...' : 'Pilih atau Tarik File Excel'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
            confirmDialog.type === 'unblock' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' :
            confirmDialog.type === 'block' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' :
            'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
          }`}>
            <span className="material-symbols-outlined text-2xl">{confirmDialog.icon}</span>
          </div>
          <h4 className="font-bold text-base text-slate-800 dark:text-white mb-1">{confirmDialog.title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">{confirmDialog.message}</p>
          <div className="flex gap-2.5 justify-end">
            <button
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={confirmDialog.onConfirm}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95 ${
                confirmDialog.type === 'unblock' ? 'bg-emerald-600 hover:bg-emerald-700' :
                confirmDialog.type === 'block' ? 'bg-rose-600 hover:bg-rose-700' :
                'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {confirmDialog.actionText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col lg:flex-row w-full selection:bg-emerald-500/20 selection:text-emerald-700">

      {/* ================================================================= */}
      {/* DESKTOP PERSISTENT COLLAPSIBLE SIDEBAR (lg: and above)           */}
      {/* ================================================================= */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 h-full z-30 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64 xl:w-72'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <div className={`flex items-center gap-3 min-w-0 ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-black text-sm text-slate-800 dark:text-white leading-tight truncate">
                  {user.nama_sekolah || 'NEXA CBT'}
                </h1>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  Admin Sekolah
                </p>
              </div>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Sembunyikan Sidebar"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span>
            </button>
          )}
        </div>

        {isSidebarCollapsed && (
          <div className="py-2 flex justify-center border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Perluas Sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">keyboard_double_arrow_right</span>
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isSidebarCollapsed && (
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTab(item.id)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all min-h-[44px] ${
                      isSidebarCollapsed ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: User Chip, Theme Toggle, Logout */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div
              onClick={() => setIsAvatarModalOpen(true)}
              className="w-9 h-9 rounded-lg overflow-hidden border border-emerald-500/40 shrink-0 cursor-pointer"
              title="Ganti Avatar"
            >
              {user.foto_profil ? (
                <img src={user.foto_profil} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  {(user.nama_lengkap || 'A').charAt(0)}
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{user.nama_lengkap}</p>
                <p className="text-[10px] text-slate-400 truncate">NPSN: {user.npsn}</p>
              </div>
            )}
          </div>

          <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-1' : 'justify-between'}`}>
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px]"
              title="Ganti Mode Gelap/Terang"
              aria-label="Toggle Dark Mode"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className={`flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors min-h-[44px] ${
                isSidebarCollapsed ? 'w-10 h-10 justify-center' : 'px-3 py-2 text-xs font-bold'
              }`}
              title="Keluar Akun"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              {!isSidebarCollapsed && <span>Keluar</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* MOBILE STICKY TOPBAR (< 1024px)                                   */}
      {/* ================================================================= */}
      <header className="lg:hidden flex-shrink-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => { setIsMobileDrawerOpen(true); setIsSidebarOpen(true); }}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all min-w-[44px] min-h-[44px]"
            aria-label="Buka Menu Navigasi"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight truncate">
                Admin Sekolah
              </h1>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider truncate">
                NPSN: {user.npsn}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px]"
            aria-label="Toggle Dark Mode"
          >
            <span className="material-symbols-outlined text-xl">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <div
            onClick={() => setIsAvatarModalOpen(true)}
            className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/40 p-0.5 cursor-pointer shrink-0"
          >
            {user.foto_profil ? (
              <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="w-full h-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs rounded-lg">
                {(user.nama_lengkap || 'A').charAt(0)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MOBILE OFF-CANVAS SLIDE-OVER DRAWER (< 1024px)                     */}
      {/* ================================================================= */}
      {(isMobileDrawerOpen || isSidebarOpen) && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => { setIsMobileDrawerOpen(false); setIsSidebarOpen(false); }}
            aria-hidden="true"
          />
          <div className="relative w-80 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-800 z-10 animate-fade-in-up">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight">NEXA CBT</h2>
                  <p className="text-[10px] text-slate-400">Navigasi Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsSidebarOpen(false); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px]"
                aria-label="Tutup Navigasi"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-5">
              {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] ${
                          isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-left'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xl shrink-0">{item.icon}</span>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                size="md"
                icon="logout"
                onClick={onLogout}
                className="w-full min-h-[44px]"
              >
                Keluar Akun
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MOBILE BOTTOM QUICK BAR (< 1024px)                                */}
      {/* ================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {bottomBarItems.map((tab) => {
          const isActive = activeTab === tab.id;
          const isTrigger = tab.isDrawerTrigger;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (isTrigger) {
                  setIsMobileDrawerOpen(true);
                  setIsSidebarOpen(true);
                } else {
                  navigateTab(tab.id);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] min-w-[44px] transition-colors ${
                isActive && !isTrigger
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              <span className="text-[10px] font-bold mt-0.5 truncate max-w-[60px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ================================================================= */}
      {/* MAIN DOCUMENT CONTAINER & CONTENT AREA                            */}
      {/* ================================================================= */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Desktop Sticky Header Bar */}
        <header className="hidden lg:flex flex-shrink-0 z-20 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 xl:px-8 items-center justify-between">
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white capitalize">
              {tabTitleMap[activeTab] || activeTab}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola dan pantau seluruh data administrasi CBT NEXA
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sistem Online</span>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12">

          {/* ================= TAB 1: DASHBOARD ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Header Title */}
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Ringkasan Statistik Sekolah</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Metrik master data dan status pelaksanaan ujian</p>
              </div>

              {/* 4 Metric KPI Tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div
                  onClick={() => navigateTab('siswa')}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-emerald-500/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">school</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 truncate">Total Siswa</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                      {dashboardData?.totalSiswa || dataSiswa.length || 0}
                    </h4>
                  </div>
                </div>

                <div
                  onClick={() => navigateTab('guru')}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-blue-500/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">local_library</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 truncate">Total Guru</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                      {dashboardData?.totalGuru || dataGuru.length || 0}
                    </h4>
                  </div>
                </div>

                <div
                  onClick={() => navigateTab('mapel')}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-amber-500/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">menu_book</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 truncate">Mata Pelajaran</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                      {dashboardData?.totalMapel || dataMapel.length || 0}
                    </h4>
                  </div>
                </div>

                <div
                  onClick={() => navigateTab('soal')}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-purple-500/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">quiz</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 truncate">Bank Soal</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                      {dashboardData?.totalSoal || dataSoal.length || 0}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Status Jadwal Ujian Overview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">Jadwal Ujian Aktif & Berlangsung</h4>
                  <button
                    onClick={() => navigateTab('jadwal')}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    Lihat Semua Jadwal <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {dataJadwal.filter(j => j.status_ujian === 'AKTIF').map((j) => (
                    <div
                      key={j.id_jadwal}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700/80 border-l-4 border-l-emerald-500 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h5 className="font-bold text-sm text-slate-800 dark:text-white truncate">{j.nama_mapel}</h5>
                          <StatusBadge status="AKTIF" size="xs" pulse={true} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Guru: {j.guru || '-'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(j.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(j.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {' '}| Token: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{j.token || 'Menunggu'}</strong>
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <button
                          onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('monitoring'); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                        >
                          Monitoring Live
                        </button>
                      </div>
                    </div>
                  ))}

                  {dataJadwal.filter(j => j.status_ujian === 'AKTIF').length === 0 && (
                    <div className="col-span-full">
                      <EmptyState
                        compact={true}
                        icon="timer_off"
                        title="Tidak Ada Ujian Berlangsung"
                        description="Saat ini belum ada jadwal ujian yang aktif. Buka menu Jadwal untuk mengaktifkan ujian."
                        action={{ label: 'Ke Menu Jadwal', onClick: () => navigateTab('jadwal'), icon: 'event_note' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: MASTER DATA SISWA ================= */}
          {activeTab === 'siswa' && (
            <div className="space-y-4 animate-fade-in-up">
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Master Data Siswa</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                      {sortedFilteredSiswa.length} Siswa
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola data login, NISN, dan rombongan belajar</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleResetAllLoginSiswa}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 hover:bg-amber-100 transition-colors disabled:opacity-50 min-h-[44px]"
                    title="Reset Semua Sesi Siswa"
                  >
                    <span className="material-symbols-outlined text-[18px]">phonelink_erase</span>
                    <span className="hidden sm:inline">Reset Sesi Masal</span>
                  </button>
                  <button
                    onClick={() => setImportModal({ isOpen: true, type: 'siswa' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Import Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => exportDataToExcel('siswa')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Export Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    onClick={() => openCreateModal('siswa')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>Tambah Siswa</span>
                  </button>
                </div>
              </div>

              {/* Controls Filter Bar */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative w-full sm:flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Cari berdasarkan nama lengkap atau NISN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-white transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
                <div className="w-full sm:w-56 shrink-0">
                  <select
                    value={filterKelas}
                    onChange={(e) => setFilterKelas(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-white"
                  >
                    <option value="">Semua Kelas ({dataSiswa.length})</option>
                    {[...new Set(dataSiswa.map(s => s.kelas).filter(Boolean))].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Siswa Bulk Action Bar */}
              {selectedSiswa.length > 0 && (
                <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    <span className="material-symbols-outlined text-[18px]">check_box</span>
                    <span>{selectedSiswa.length} siswa dipilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSiswa([])}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleBulkDelete('siswa')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Hapus Terpilih ({selectedSiswa.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* DESKTOP HIGH-DENSITY SMART TABLE (hidden md:block) */}
              <div className="hidden md:block w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            aria-label="Pilih Semua Siswa"
                            checked={sortedFilteredSiswa.length > 0 && selectedSiswa.length === sortedFilteredSiswa.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSiswa(sortedFilteredSiswa.map(s => s.id_siswa));
                              } else {
                                setSelectedSiswa([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2 w-10 text-center">#</th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                          onClick={() => setSortConfigSiswa(prev => ({ key: 'nama_lengkap', direction: prev.key === 'nama_lengkap' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          <div className="flex items-center gap-1">
                            <span>Nama Siswa</span>
                            <span className="material-symbols-outlined text-[14px]">
                              {sortConfigSiswa.key === 'nama_lengkap' ? (sortConfigSiswa.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          </div>
                        </th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                          onClick={() => setSortConfigSiswa(prev => ({ key: 'nisn', direction: prev.key === 'nisn' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          <div className="flex items-center gap-1">
                            <span>NISN</span>
                            <span className="material-symbols-outlined text-[14px]">
                              {sortConfigSiswa.key === 'nisn' ? (sortConfigSiswa.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          </div>
                        </th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                          onClick={() => setSortConfigSiswa(prev => ({ key: 'kelas', direction: prev.key === 'kelas' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          <div className="flex items-center gap-1">
                            <span>Kelas</span>
                            <span className="material-symbols-outlined text-[14px]">
                              {sortConfigSiswa.key === 'kelas' ? (sortConfigSiswa.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          </div>
                        </th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs sm:text-sm">
                      {isLoading ? (
                        <TableSkeleton rows={6} cols={6} asTableRows={true} hasAvatar={true} />
                      ) : sortedFilteredSiswa.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6">
                            <EmptyState
                              compact={true}
                              icon="search_off"
                              title="Data Siswa Tidak Ditemukan"
                              description={searchQuery || filterKelas ? 'Tidak ada siswa yang sesuai dengan filter pencarian.' : 'Belum ada master data siswa terdaftar.'}
                              action={(searchQuery || filterKelas) ? { label: 'Reset Filter', onClick: () => { setSearchQuery(''); setFilterKelas(''); } } : null}
                            />
                          </td>
                        </tr>
                      ) : (
                        sortedFilteredSiswa.map((s, idx) => (
                          <tr key={s.id_siswa || s.id_user || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors group">
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Pilih ${s.nama_lengkap}`}
                                checked={selectedSiswa.includes(s.id_siswa)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSiswa(prev => [...prev, s.id_siswa]);
                                  } else {
                                    setSelectedSiswa(prev => prev.filter(id => id !== s.id_siswa));
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                                  {s.nama_lengkap ? s.nama_lengkap.substring(0, 2).toUpperCase() : 'SW'}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs">{s.nama_lengkap}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{s.nisn || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                                {s.kelas || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleResetLogin(s.id_siswa)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                  title="Reset Sesi Login"
                                >
                                  <span className="material-symbols-outlined text-[18px]">phonelink_erase</span>
                                </button>
                                <button
                                  onClick={() => openEditModal('siswa', s)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                  title="Edit"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(s.id_siswa, 'siswa', s)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Hapus"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE COMPACT CARD-ROWS (md:hidden - 375px optimized) */}
              <div className="md:hidden space-y-2.5">
                {isLoading ? (
                  <TableSkeleton rows={4} cols={3} asTableRows={false} hasAvatar={true} />
                ) : sortedFilteredSiswa.length === 0 ? (
                  <EmptyState
                    compact={true}
                    icon="search_off"
                    title="Data Tidak Ditemukan"
                    description="Tidak ada siswa yang sesuai kriteria pencarian."
                    action={(searchQuery || filterKelas) ? { label: 'Reset Filter', onClick: () => { setSearchQuery(''); setFilterKelas(''); } } : null}
                  />
                ) : (
                  sortedFilteredSiswa.map((s, idx) => (
                    <div
                      key={s.id_siswa || s.id_user || idx}
                      className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedSiswa.includes(s.id_siswa)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSiswa(prev => [...prev, s.id_siswa]);
                            } else {
                              setSelectedSiswa(prev => prev.filter(id => id !== s.id_siswa));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 mr-0.5"
                        />
                        <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                          {s.nama_lengkap ? s.nama_lengkap.substring(0, 2).toUpperCase() : 'SW'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            <span className="font-mono">{s.nisn || '-'}</span> • <span className="font-semibold text-emerald-600 dark:text-emerald-400">{s.kelas || '-'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleResetLogin(s.id_siswa)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                          title="Reset Sesi"
                        >
                          <span className="material-symbols-outlined text-[18px]">phonelink_erase</span>
                        </button>
                        <button
                          onClick={() => openEditModal('siswa', s)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(s.id_siswa, 'siswa', s)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Hapus"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 3: MASTER DATA GURU ================= */}
          {activeTab === 'guru' && (
            <div className="space-y-4 animate-fade-in-up">
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Master Data Guru</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                      {sortedFilteredGuru.length} Guru
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola akun pendidik dan penugasan mata pelajaran</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setImportModal({ isOpen: true, type: 'guru' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Import Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => exportDataToExcel('guru')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Export Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    onClick={() => openCreateModal('guru')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>Tambah Guru</span>
                  </button>
                </div>
              </div>

              {/* Controls Filter Bar */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative w-full sm:flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Cari berdasarkan nama guru atau NIP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-white transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
                <div className="w-full sm:w-56 shrink-0">
                  <select
                    value={filterMapel}
                    onChange={(e) => setFilterMapel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-white"
                  >
                    <option value="">Semua Mapel</option>
                    {dataMapel.map(m => (
                      <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Guru Bulk Action Bar */}
              {selectedGuru.length > 0 && (
                <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    <span className="material-symbols-outlined text-[18px]">check_box</span>
                    <span>{selectedGuru.length} guru dipilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedGuru([])}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleBulkDelete('guru')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Hapus Terpilih ({selectedGuru.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* DESKTOP HIGH-DENSITY GURU TABLE (hidden md:block) */}
              <div className="hidden md:block w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            aria-label="Pilih Semua Guru"
                            checked={sortedFilteredGuru.length > 0 && selectedGuru.length === sortedFilteredGuru.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGuru(sortedFilteredGuru.map(g => g.id_guru));
                              } else {
                                setSelectedGuru([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2 w-10 text-center">#</th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                          onClick={() => setSortConfigGuru(prev => ({ key: 'nama_lengkap', direction: prev.key === 'nama_lengkap' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          <div className="flex items-center gap-1">
                            <span>Nama Guru</span>
                            <span className="material-symbols-outlined text-[14px]">
                              {sortConfigGuru.key === 'nama_lengkap' ? (sortConfigGuru.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          </div>
                        </th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                          onClick={() => setSortConfigGuru(prev => ({ key: 'nip', direction: prev.key === 'nip' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          <div className="flex items-center gap-1">
                            <span>NIP</span>
                            <span className="material-symbols-outlined text-[14px]">
                              {sortConfigGuru.key === 'nip' ? (sortConfigGuru.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          </div>
                        </th>
                        <th className="py-3 px-4">Mata Pelajaran Diampu</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs sm:text-sm">
                      {isLoading ? (
                        <TableSkeleton rows={5} cols={6} asTableRows={true} hasAvatar={true} />
                      ) : sortedFilteredGuru.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6">
                            <EmptyState
                              compact={true}
                              icon="search_off"
                              title="Data Guru Tidak Ditemukan"
                              description={searchQuery || filterMapel ? 'Tidak ada guru yang sesuai dengan filter pencarian.' : 'Belum ada master data guru terdaftar.'}
                              action={(searchQuery || filterMapel) ? { label: 'Reset Filter', onClick: () => { setSearchQuery(''); setFilterMapel(''); } } : null}
                            />
                          </td>
                        </tr>
                      ) : (
                        sortedFilteredGuru.map((g, idx) => (
                          <tr key={g.id_guru || g.id_user || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors group">
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Pilih ${g.nama_lengkap}`}
                                checked={selectedGuru.includes(g.id_guru)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGuru(prev => [...prev, g.id_guru]);
                                  } else {
                                    setSelectedGuru(prev => prev.filter(id => id !== g.id_guru));
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200/60 dark:border-blue-800/60">
                                  {g.nama_lengkap ? g.nama_lengkap.substring(0, 2).toUpperCase() : 'GR'}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs">{g.nama_lengkap}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{g.nip || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                                {g.mapels_list || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditModal('guru', g)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                  title="Edit"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(g.id_guru, 'guru', g)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Hapus"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE COMPACT CARD-ROWS GURU (md:hidden - 375px) */}
              <div className="md:hidden space-y-2.5">
                {isLoading ? (
                  <TableSkeleton rows={4} cols={3} asTableRows={false} hasAvatar={true} />
                ) : sortedFilteredGuru.length === 0 ? (
                  <EmptyState
                    compact={true}
                    icon="search_off"
                    title="Data Tidak Ditemukan"
                    description="Tidak ada guru yang sesuai kriteria pencarian."
                    action={(searchQuery || filterMapel) ? { label: 'Reset', onClick: () => { setSearchQuery(''); setFilterMapel(''); } } : null}
                  />
                ) : (
                  sortedFilteredGuru.map((g, idx) => (
                    <div
                      key={g.id_guru || g.id_user || idx}
                      className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedGuru.includes(g.id_guru)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGuru(prev => [...prev, g.id_guru]);
                            } else {
                              setSelectedGuru(prev => prev.filter(id => id !== g.id_guru));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 mr-0.5"
                        />
                        <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200/60 dark:border-blue-800/60">
                          {g.nama_lengkap ? g.nama_lengkap.substring(0, 2).toUpperCase() : 'GR'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{g.nama_lengkap}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            <span className="font-mono">NIP: {g.nip || '-'}</span> • {g.mapels_list || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal('guru', g)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(g.id_guru, 'guru', g)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Hapus"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: JADWAL UJIAN ================= */}
          {activeTab === 'jadwal' && (
            <div className="space-y-4 animate-fade-in-up">
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Jadwal Pelaksanaan Ujian</h3>
                    <StatusBadge variant="neutral" size="xs">{sortedFilteredJadwal.length} Jadwal</StatusBadge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Atur token, waktu pengerjaan, dan kontrol status sesi</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setImportModal({ isOpen: true, type: 'jadwal' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Import Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => exportDataToExcel('jadwal')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Export Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    onClick={() => openCreateModal('jadwal')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Buat Jadwal Baru</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs & Controls */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Status Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  {[
                    { id: 'ALL', label: 'Semua Status' },
                    { id: 'AKTIF', label: 'Aktif (Berlangsung)' },
                    { id: 'BELUM MULAI', label: 'Akan Datang' },
                    { id: 'SELESAI', label: 'Selesai' }
                  ].map(st => (
                    <button
                      key={st.id}
                      onClick={() => setFilterJadwalStatus(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] ${
                        filterJadwalStatus === st.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 md:max-w-md">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                    <input
                      type="text"
                      placeholder="Cari mapel / token..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <select
                    value={filterMapel}
                    onChange={(e) => setFilterMapel(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 dark:text-slate-200 shrink-0"
                  >
                    <option value="">Semua Mapel</option>
                    {dataMapel.map(m => (
                      <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Jadwal Bulk Action Bar */}
              {selectedJadwalBulk.length > 0 && (
                <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    <span className="material-symbols-outlined text-[18px]">check_box</span>
                    <span>{selectedJadwalBulk.length} jadwal dipilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedJadwalBulk([])}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleBulkDelete('jadwal')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Hapus Terpilih ({selectedJadwalBulk.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* DESKTOP JADWAL TABLE (hidden md:block) */}
              <div className="hidden md:block w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            aria-label="Pilih Semua Jadwal"
                            checked={sortedFilteredJadwal.length > 0 && selectedJadwalBulk.length === sortedFilteredJadwal.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJadwalBulk(sortedFilteredJadwal.map(j => j.id_jadwal));
                              } else {
                                setSelectedJadwalBulk([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2 w-10 text-center">#</th>
                        <th className="py-3 px-4">Mata Pelajaran & Ujian</th>
                        <th className="py-3 px-4">Guru Pengampu</th>
                        <th className="py-3 px-4">Waktu Mulai</th>
                        <th className="py-3 px-4">Token</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Kontrol & Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {isLoading ? (
                        <TableSkeleton rows={5} cols={8} asTableRows={true} />
                      ) : sortedFilteredJadwal.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6">
                            <EmptyState
                              compact={true}
                              icon="event_busy"
                              title="Tidak Ada Jadwal Ujian"
                              description={searchQuery || filterMapel || filterJadwalStatus !== 'ALL' ? 'Tidak ada jadwal sesuai filter.' : 'Belum ada jadwal ujian dibuat.'}
                              action={{ label: 'Buat Jadwal', onClick: () => openCreateModal('jadwal'), icon: 'add' }}
                            />
                          </td>
                        </tr>
                      ) : (
                        sortedFilteredJadwal.map((j, idx) => (
                          <tr key={j.id_jadwal || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Pilih ${j.nama_mapel}`}
                                checked={selectedJadwalBulk.includes(j.id_jadwal)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedJadwalBulk(prev => [...prev, j.id_jadwal]);
                                  } else {
                                    setSelectedJadwalBulk(prev => prev.filter(id => id !== j.id_jadwal));
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-slate-400 text-xs">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800 dark:text-slate-100 block">{j.nama_mapel}</span>
                              <span className="text-[11px] text-slate-400">Target: {j.target_kelas ? `Tingkat ${j.target_kelas}` : 'Umum'}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{j.guru || '-'}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <span className="block font-semibold">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(j.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(j.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {j.token || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <StatusBadge status={j.status_ujian} pulse={j.status_ujian === 'AKTIF'} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {j.status_ujian === 'AKTIF' && (
                                  <button
                                    onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('monitoring'); }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                                  >
                                    Monitoring
                                  </button>
                                )}
                                {j.status_ujian === 'SELESAI' && (
                                  <button
                                    onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('hasil'); }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                  >
                                    Hasil
                                  </button>
                                )}
                                {j.status_ujian !== 'AKTIF' && j.status_ujian !== 'SELESAI' && (
                                  <button
                                    onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'AKTIF')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                  >
                                    Mulai
                                  </button>
                                )}
                                {j.status_ujian === 'AKTIF' && (
                                  <button
                                    onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'SELESAI')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                  >
                                    Akhiri
                                  </button>
                                )}
                                {j.status_ujian === 'SELESAI' && (
                                  <button
                                    onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'BELUM MULAI')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                                  >
                                    Reset
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditModal('jadwal', j)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(j.id_jadwal, 'jadwal', j)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Hapus"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE COMPACT JADWAL CARDS (md:hidden - 375px) */}
              <div className="md:hidden space-y-3">
                {isLoading ? (
                  <TableSkeleton rows={3} cols={3} asTableRows={false} />
                ) : sortedFilteredJadwal.length === 0 ? (
                  <EmptyState
                    compact={true}
                    icon="event_busy"
                    title="Tidak Ada Jadwal"
                    description="Belum ada jadwal ujian yang cocok."
                  />
                ) : (
                  sortedFilteredJadwal.map((j) => (
                    <div
                      key={j.id_jadwal}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedJadwalBulk.includes(j.id_jadwal)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedJadwalBulk(prev => [...prev, j.id_jadwal]);
                            } else {
                              setSelectedJadwalBulk(prev => prev.filter(id => id !== j.id_jadwal));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 mt-0.5 mr-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{j.nama_mapel}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Guru: {j.guru || '-'}</p>
                        </div>
                        <StatusBadge status={j.status_ujian} size="xs" pulse={j.status_ujian === 'AKTIF'} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <span>{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</span>
                        <span>Token: <strong className="font-mono text-emerald-600 dark:text-emerald-400">#{j.token || '-'}</strong></span>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex-wrap">
                        {j.status_ujian === 'AKTIF' && (
                          <button
                            onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('monitoring'); }}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl text-xs font-bold"
                          >
                            Monitoring
                          </button>
                        )}
                        {j.status_ujian === 'SELESAI' && (
                          <button
                            onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('hasil'); }}
                            className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold"
                          >
                            Hasil
                          </button>
                        )}
                        {j.status_ujian !== 'AKTIF' && j.status_ujian !== 'SELESAI' && (
                          <button
                            onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'AKTIF')}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                          >
                            Mulai Ujian
                          </button>
                        )}
                        {j.status_ujian === 'AKTIF' && (
                          <button
                            onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'SELESAI')}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl text-xs font-bold"
                          >
                            Akhiri
                          </button>
                        )}
                        {j.status_ujian === 'SELESAI' && (
                          <button
                            onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'BELUM MULAI')}
                            className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold"
                          >
                            Reset
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal('jadwal', j)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(j.id_jadwal, 'jadwal', j)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 5: KONTROL UJIAN (BATCH) ================= */}
          {activeTab === 'kontrol' && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Pusat Kontrol Ujian</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Operasi massal untuk memulai, menghentikan, atau mereset seluruh ujian serentak</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                  <button
                    onClick={() => handleBulkUpdateStatusUjian('AKTIF')}
                    disabled={isSubmitting}
                    className="flex-1 md:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    <span>Mulai Semua</span>
                  </button>
                  <button
                    onClick={() => handleBulkUpdateStatusUjian('SELESAI')}
                    disabled={isSubmitting}
                    className="flex-1 md:flex-none px-3.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">stop</span>
                    <span>Hentikan Semua</span>
                  </button>
                  <button
                    onClick={() => handleBulkUpdateStatusUjian('BELUM MULAI')}
                    disabled={isSubmitting}
                    className="flex-1 md:flex-none px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    <span>Reset Semua</span>
                  </button>
                </div>
              </div>

              {/* Schedules Control List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {dataJadwal.map((j) => {
                  const isAktif = j.status_ujian === 'AKTIF';
                  const isSelesai = j.status_ujian === 'SELESAI';
                  return (
                    <div
                      key={j.id_jadwal}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          isAktif ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          isSelesai ? 'bg-slate-100 text-slate-500 dark:bg-slate-700' :
                          'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          <span className="material-symbols-outlined text-2xl">
                            {isAktif ? 'play_circle' : isSelesai ? 'check_circle' : 'schedule'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">{j.nama_mapel}</h4>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{j.guru || '-'} • Token: #{j.token || '-'}</p>
                          <div className="mt-1">
                            <StatusBadge status={j.status_ujian} size="xs" pulse={isAktif} />
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {!isAktif && !isSelesai && (
                          <button
                            onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'AKTIF')}
                            disabled={isSubmitting}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all min-h-[44px]"
                          >
                            Mulai
                          </button>
                        )}
                        {isAktif && (
                          <button
                            onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'SELESAI')}
                            disabled={isSubmitting}
                            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all min-h-[44px]"
                          >
                            Hentikan
                          </button>
                        )}
                        {isSelesai && (
                          <button
                            onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'BELUM MULAI')}
                            disabled={isSubmitting}
                            className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all min-h-[44px]"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 6: REAL-TIME LIVE MONITORING HUD ================= */}
          {activeTab === 'monitoring' && (
            <div className="space-y-5 animate-fade-in-up">
              {/* Monitoring Navigation Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedJadwal(null); navigateTab('jadwal'); }}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                    title="Kembali ke Jadwal"
                  >
                    <span className="material-symbols-outlined text-xl">arrow_back</span>
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-white truncate">
                      {dataJadwal.find(j => j.id_jadwal === selectedJadwal)?.nama_mapel || 'Monitoring Ujian Real-Time'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Live Proctoring HUD & Intervensi Peserta
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <select
                    value={selectedJadwal || ''}
                    onChange={(e) => setSelectedJadwal(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    <option value="">Pilih Jadwal Ujian</option>
                    {dataJadwal.map(j => (
                      <option key={j.id_jadwal} value={j.id_jadwal}>
                        {j.nama_mapel} ({j.status_ujian})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => fetchData('monitoring')}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                    title="Refresh Data"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                  </button>
                </div>
              </div>

              {!selectedJadwal ? (
                <EmptyState
                  icon="visibility"
                  title="Pilih Jadwal Ujian"
                  description="Silakan pilih salah satu jadwal ujian aktif di atas untuk memulai pemantauan sesi peserta secara langsung."
                />
              ) : (
                <>
                  {/* 4 Summary Metric KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">groups</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Total Peserta</p>
                        <h4 className="text-2xl font-black text-slate-800 dark:text-white">{monitoringMetrics.total}</h4>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl animate-pulse">timer</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Sedang Ujian</p>
                        <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{monitoringMetrics.mengerjakan}</h4>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">task_alt</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Selesai</p>
                        <h4 className="text-2xl font-black text-sky-600 dark:text-sky-400">{monitoringMetrics.selesai}</h4>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">gpp_bad</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Terblokir</p>
                        <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400">{monitoringMetrics.terblokir}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                      {['ALL', 'SEDANG KERJA', 'SELESAI', 'TERBLOKIR'].map(st => (
                        <button
                          key={st}
                          onClick={() => setMonitoringFilterStatus(st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] ${
                            monitoringFilterStatus === st
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {st === 'ALL' ? 'Semua Status' : st === 'SEDANG KERJA' ? 'Sedang Ujian' : st === 'SELESAI' ? 'Selesai' : 'Terblokir'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={monitoringFilterKelas}
                        onChange={(e) => setMonitoringFilterKelas(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3 py-2 outline-none text-slate-700 dark:text-slate-200"
                      >
                        <option value="ALL">Semua Kelas</option>
                        {availableMonitoringClasses.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>

                      <div className="relative flex-1 sm:w-56">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          value={monitoringSearch}
                          onChange={(e) => setMonitoringSearch(e.target.value)}
                          placeholder="Cari siswa..."
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP MONITORING TABLE (hidden md:block) */}
                  <div className="hidden md:block w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="py-3 px-4 w-10 text-center">#</th>
                            <th className="py-3 px-4">Nama Siswa</th>
                            <th className="py-3 px-4">Kelas</th>
                            <th className="py-3 px-4 w-52">Progress Pengerjaan</th>
                            <th className="py-3 px-4 text-center">Pelanggaran</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Aksi Proctor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {filteredMonitoringLogs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-6">
                                <EmptyState
                                  compact={true}
                                  icon="person_off"
                                  title="Tidak Ada Peserta Terdata"
                                  description="Belum ada siswa yang bergabung pada sesi ujian ini."
                                />
                              </td>
                            </tr>
                          ) : (
                            filteredMonitoringLogs.map((p, idx) => {
                              const totalDijawab = p.total_dijawab !== undefined ? p.total_dijawab : (p.jawaban_count || (p.nilai_auto !== null ? 40 : 0));
                              const totalSoal = p.total_soal || 40;
                              const progressPercent = Math.min(100, Math.round((totalDijawab / totalSoal) * 100));

                              return (
                                <tr
                                  key={p.id_log || idx}
                                  className={`transition-colors ${p.is_blocked ? 'bg-rose-50/30 dark:bg-rose-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/40'}`}
                                >
                                  <td className="py-3 px-4 text-center font-mono text-slate-400 text-xs">{idx + 1}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                        p.is_blocked ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' :
                                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                      }`}>
                                        <span className="material-symbols-outlined text-sm">{p.is_blocked ? 'block' : 'person'}</span>
                                      </div>
                                      <div>
                                        <h5 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate max-w-xs">{p.nama_lengkap}</h5>
                                        <p className="text-[10px] text-slate-400 font-mono">NISN: {p.nisn || '-'}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    {p.angkatan} {p.kelas_paralel}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="w-full">
                                      <div className="flex justify-between items-center text-[11px] mb-1 font-semibold">
                                        <span className="text-slate-500 dark:text-slate-400">{totalDijawab} / {totalSoal} Soal</span>
                                        <span className={p.is_blocked ? 'text-rose-500 font-bold' : p.status_ujian === 'SELESAI' ? 'text-sky-600 font-bold' : 'text-emerald-600 font-bold'}>
                                          {progressPercent}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            p.is_blocked ? 'bg-rose-500' :
                                            p.status_ujian === 'SELESAI' ? 'bg-sky-500' :
                                            'bg-emerald-500'
                                          }`}
                                          style={{ width: `${progressPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                      (p.pelanggaran || 0) >= 3 ? 'bg-rose-100 text-rose-700' :
                                      (p.pelanggaran || 0) > 0 ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                      {p.pelanggaran || 0}/3
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <StatusBadge
                                      status={p.is_blocked ? 'TERBLOKIR' : (p.status_ujian || 'AKTIF')}
                                      pulse={!p.is_blocked && p.status_ujian !== 'SELESAI'}
                                    />
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {p.is_blocked ? (
                                        <button
                                          onClick={() => handleUnblock(p)}
                                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                                          title="Buka Blokir"
                                        >
                                          Buka Blokir
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleBlock(p.id_log)}
                                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                          title="Blokir Peserta"
                                        >
                                          Blokir
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleResetSesiUjian(p)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                                        title="Reset Sesi Pengerjaan"
                                      >
                                        Reset Sesi
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE COMPACT MONITORING CARD-ROWS (md:hidden - 375px) */}
                  <div className="md:hidden space-y-3">
                    {filteredMonitoringLogs.length === 0 ? (
                      <EmptyState
                        compact={true}
                        icon="person_off"
                        title="Tidak Ada Peserta"
                        description="Belum ada siswa dalam sesi ujian ini."
                      />
                    ) : (
                      filteredMonitoringLogs.map((p, idx) => {
                        const totalDijawab = p.total_dijawab !== undefined ? p.total_dijawab : (p.jawaban_count || (p.nilai_auto !== null ? 40 : 0));
                        const totalSoal = p.total_soal || 40;
                        const progressPercent = Math.min(100, Math.round((totalDijawab / totalSoal) * 100));

                        return (
                          <div
                            key={p.id_log || idx}
                            className={`rounded-2xl p-4 border shadow-sm space-y-3 ${
                              p.is_blocked
                                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                                : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <h5 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">{p.nama_lengkap}</h5>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {p.angkatan} {p.kelas_paralel} • Pelanggaran: <strong className={p.pelanggaran >= 3 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}>{p.pelanggaran || 0}/3</strong>
                                </p>
                              </div>
                              <StatusBadge
                                status={p.is_blocked ? 'TERBLOKIR' : (p.status_ujian || 'AKTIF')}
                                size="xs"
                                pulse={!p.is_blocked && p.status_ujian !== 'SELESAI'}
                              />
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full">
                              <div className="flex justify-between items-center text-[11px] mb-1 font-semibold">
                                <span className="text-slate-500 dark:text-slate-400">{totalDijawab} / {totalSoal} Soal</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{progressPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    p.is_blocked ? 'bg-rose-500' : p.status_ujian === 'SELESAI' ? 'bg-sky-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                              {p.is_blocked ? (
                                <button
                                  onClick={() => handleUnblock(p)}
                                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold"
                                >
                                  Buka Blokir
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBlock(p.id_log)}
                                  className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold"
                                >
                                  Blokir
                                </button>
                              )}
                              <button
                                onClick={() => handleResetSesiUjian(p)}
                                className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold"
                              >
                                Reset Sesi
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================= TAB 7: HASIL REKAP UJIAN ================= */}
          {activeTab === 'hasil' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedJadwal(null); navigateTab('jadwal'); }}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                  >
                    <span className="material-symbols-outlined text-xl">arrow_back</span>
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white truncate">
                      {dataJadwal.find(j => j.id_jadwal === selectedJadwal)?.nama_mapel || 'Rekap Hasil Nilai Ujian'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Daftar perolehan skor siswa</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={openAnalisisSoal}
                    className="flex items-center gap-1.5 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">analytics</span>
                    <span>Analisis Butir Soal</span>
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>

              {/* Hasil List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {dataLog.map((l, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">{l.nama_lengkap}</h5>
                      <p className="text-xs text-slate-500 mt-0.5">Kelas {l.angkatan} {l.kelas_paralel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Skor</div>
                      <div className="font-black text-xl text-emerald-600 dark:text-emerald-400">
                        {l.total_nilai !== null ? l.total_nilai : l.nilai_auto}
                      </div>
                    </div>
                  </div>
                ))}
                {dataLog.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      compact={true}
                      icon="assessment"
                      title="Belum Ada Hasil"
                      description="Belum ada data nilai ujian terkumpul untuk jadwal ini."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 8: MATA PELAJARAN ================= */}
          {activeTab === 'mapel' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Mata Pelajaran</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar kurikulum mata pelajaran</p>
                </div>
                <button
                  onClick={() => openCreateModal('mapel')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 self-end sm:self-auto min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>Tambah Mapel</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {dataMapel.map((m) => (
                  <div
                    key={m.id_mapel}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div
                      onClick={() => { setActiveTab('soal'); setFilterMapel(m.nama_mapel); fetchData('soal'); }}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">menu_book</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">{m.nama_mapel}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{m.jumlah_soal || 0} Soal Tersedia</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal('mapel', m)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(m.id_mapel, 'mapel', m)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Hapus"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}

                {dataMapel.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      compact={true}
                      icon="menu_book"
                      title="Belum Ada Mata Pelajaran"
                      description="Tambahkan mata pelajaran untuk memulai penyusunan soal."
                      action={{ label: 'Tambah Mapel', onClick: () => openCreateModal('mapel'), icon: 'add' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 9: MANAJEMEN KELAS ================= */}
          {activeTab === 'kelas' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Manajemen Kelas & Rombel</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola struktur tingkat dan kelas paralel</p>
                </div>
                <button
                  onClick={() => openCreateModal('kelas')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 self-end sm:self-auto min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>Tambah Kelas</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {dataKelas.map((k) => (
                  <div
                    key={k.id_kelas}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">meeting_room</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
                          {k.tingkat} {k.kelas_paralel}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">ID: {k.id_kelas}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal('kelas', k)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(k.id_kelas, 'kelas', k)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Hapus"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}

                {dataKelas.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      compact={true}
                      icon="meeting_room"
                      title="Belum Ada Kelas"
                      description="Tambahkan data kelas dan rombel siswa."
                      action={{ label: 'Tambah Kelas', onClick: () => openCreateModal('kelas'), icon: 'add' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 10: BANK SOAL PREVIEW ================= */}
          {activeTab === 'soal' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Bank Soal (Preview)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Peninjauan butir soal dari seluruh mata pelajaran</p>
                </div>
                <div className="w-full sm:w-60">
                  <select
                    value={filterMapel}
                    onChange={(e) => setFilterMapel(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-white"
                  >
                    <option value="">Semua Mata Pelajaran</option>
                    {dataMapel.map(m => (
                      <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {dataSoal.filter(s => filterMapel ? s.mata_pelajaran?.nama_mapel === filterMapel : true).map((s) => (
                  <div key={s.id_soal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{s.mata_pelajaran?.nama_mapel}</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{s.tipe_soal}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteClick(s.id_soal, 'soal', s)}
                          className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center"
                          title="Hapus Soal"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-3" dangerouslySetInnerHTML={{ __html: s.pertanyaan }} />
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      {s.jawaban_benar ? (
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          Kunci: {s.jawaban_benar}
                        </div>
                      ) : (
                        <div className="font-semibold text-amber-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">warning</span>
                          Kunci Belum Ditentukan
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {dataSoal.filter(s => filterMapel ? s.mata_pelajaran?.nama_mapel === filterMapel : true).length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      compact={true}
                      icon="quiz"
                      title="Belum Ada Soal"
                      description="Belum ada soal terdaftar untuk mata pelajaran yang dipilih."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 11: LOG AKTIVITAS ================= */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Log Aktivitas Sistem</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Riwayat audit jejak tindakan di portal CBT</p>
                </div>
                <button
                  onClick={() => fetchData('logs')}
                  className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {dataAudit.map((log) => (
                  <div key={log.id_audit} className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-lg">history</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
                          [{log.action}] {log.username} ({log.role})
                        </h5>
                        <span className="text-[11px] text-slate-400">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{log.target}</p>
                    </div>
                  </div>
                ))}

                {dataAudit.length === 0 && (
                  <EmptyState
                    compact={true}
                    icon="history"
                    title="Tidak Ada Log Aktivitas"
                    description="Belum ada rekaman log pada sistem."
                  />
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 12: PROFIL ADMIN ================= */}
          {activeTab === 'akun' && (
            <div className="max-w-md mx-auto py-6 animate-fade-in-up flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-white dark:border-slate-800 shadow-md">
                  {user.foto_profil ? (
                    <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-emerald-600">admin_panel_settings</span>
                  )}
                </div>
                <div className="absolute bottom-4 right-0 w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow flex items-center justify-center border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-300">edit</span>
                </div>
              </div>

              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{user.nama_lengkap}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Admin Sekolah | NPSN: {user.npsn}</p>

              <div className="w-full mt-8 space-y-3">
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-200/80 dark:border-slate-700/80 shadow-sm active:scale-95 transition-all min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                      <span className="material-symbols-outlined text-xl">person</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">Edit Profil</h4>
                      <p className="text-xs text-slate-500">Ubah foto dan password akun</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </button>

                <button
                  onClick={() => navigateTab('logs')}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-200/80 dark:border-slate-700/80 shadow-sm active:scale-95 transition-all min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
                      <span className="material-symbols-outlined text-xl">history</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">Log Aktivitas</h4>
                      <p className="text-xs text-slate-500">Riwayat jejak aksi sistem</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </button>

                <div className="w-full h-px bg-slate-200/80 dark:border-slate-800 my-2"></div>

                <button
                  onClick={onLogout}
                  className="w-full bg-rose-50 dark:bg-rose-950/30 p-4 rounded-2xl flex items-center justify-between border border-rose-200/60 dark:border-rose-900/40 shadow-sm active:scale-95 transition-all text-rose-600 dark:text-rose-400 min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">logout</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-sm">Keluar Akun</h4>
                      <p className="text-xs opacity-80">Akhiri sesi portal admin</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modals & Dialogs */}
      {renderFormModal()}
      {renderImportModal()}
      {renderDeleteModal()}
      {renderProfileModal()}
      {renderAnalisisModal()}
      {renderConfirmDialog()}

      {/* Avatar Picker Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 animate-scale-up">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">Pilih Avatar</h3>
                <p className="text-xs text-slate-500">Pilih karakter foto profil Anda</p>
              </div>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-2">
              {PRESET_AVATARS.map((avatar, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAvatarSelect(avatar)}
                  className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                    user.foto_profil === avatar
                      ? 'border-emerald-600 ring-4 ring-emerald-500/20 shadow-md scale-105 bg-white'
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 bg-slate-50 dark:bg-slate-900'
                  }`}
                >
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover p-2" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
