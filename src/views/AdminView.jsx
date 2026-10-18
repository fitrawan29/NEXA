import { fetchAPI, getTrueNow, get_default_skema_sekolah, save_default_skema_sekolah, get_pengaturan_sekolah, save_pengaturan_sekolah, getDefaultKopSettings } from '../api.js';
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
  CardContent,
  PasswordInput
} from '../components/UI.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import SkemaPenilaianPanel from '../components/SkemaPenilaianPanel.jsx';
import KartuUjianPrint from '../components/KartuUjianPrint.jsx';
import { compressImageFile } from '../utils/imageHelper.js';

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
  const [defaultSkemaSekolah, setDefaultSkemaSekolah] = useState({
    mode: 'default',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 }
  });
  const [isSkemaLoading, setIsSkemaLoading] = useState(false);
  const [skemaSuccessMsg, setSkemaSuccessMsg] = useState('');

  // School Profile & Kop Settings State
  const [kopSettings, setKopSettings] = useState(() => getDefaultKopSettings(user));
  const [isSavingKop, setIsSavingKop] = useState(false);
  const [kopSuccessMsg, setKopSuccessMsg] = useState('');
  const [kopErrorMsg, setKopErrorMsg] = useState('');

  // Proctor & Room Management State (Requirement 2)
  const [dataRuang, setDataRuang] = useState([]);
  const [dataPengawasRuang, setDataPengawasRuang] = useState([]);
  const [pengawasSubTab, setPengawasSubTab] = useState('penugasan'); // 'penugasan' | 'ruang' | 'alokasi_siswa'
  const [filterRuangJadwal, setFilterRuangJadwal] = useState('ALL');
  const [searchPengawas, setSearchPengawas] = useState('');
  const [searchRuang, setSearchRuang] = useState('');
  const [searchAlokasiSiswa, setSearchAlokasiSiswa] = useState('');
  const [filterAlokasiKelas, setFilterAlokasiKelas] = useState('ALL');
  const [filterAlokasiRuang, setFilterAlokasiRuang] = useState('ALL');
  const [selectedAlokasiSiswa, setSelectedAlokasiSiswa] = useState([]);
  const [targetRuangAlokasi, setTargetRuangAlokasi] = useState('');
  const [selectedKelasAlokasi, setSelectedKelasAlokasi] = useState('');

  // Modals for Proctor & Room
  const [isAssignPengawasModalOpen, setIsAssignPengawasModalOpen] = useState(false);
  const [assignPengawasForm, setAssignPengawasForm] = useState({
    id_ruang: '',
    id_guru: '',
    id_jadwal: '',
    peran: 'PENGAWAS UTAMA'
  });
  const [isRuangModalOpen, setIsRuangModalOpen] = useState(false);
  const [editingRuang, setEditingRuang] = useState(null);
  const [ruangForm, setRuangForm] = useState({
    nama_ruang: '',
    kode_ruang: '',
    kapasitas: 30,
    keterangan: ''
  });

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

  // Print Kartu Peserta & Kartu Meja State (Feature 2)
  const [printKartuModal, setPrintKartuModal] = useState({
    isOpen: false,
    mode: 'peserta', // 'peserta' | 'meja'
    filterKelas: 'ALL',
    filterRuang: 'ALL',
    filterSesi: 'Sesi 1',
    paperSize: 'A4', // 'A4' | 'F4'
    showPassword: true,
    selectedOnly: false,
    tahunAjaran: '2026/2027',
    namaKepalaSekolah: '',
    nipKepalaSekolah: ''
  });
  const [isPrintKartuActive, setIsPrintKartuActive] = useState(false);
  const [printKartuPayload, setPrintKartuPayload] = useState(null);

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

  // Direct file upload replaces Dicebear preset avatars

  const navigateTab = (tabId) => {
    setActiveTab(tabId);
    setIsSidebarOpen(false);
    setIsMobileDrawerOpen(false);
  };

  const loadDefaultSkema = async () => {
    if (!user?.npsn) return;
    setIsSkemaLoading(true);
    try {
      const res = await get_default_skema_sekolah(user.npsn);
      if (res) {
        setDefaultSkemaSekolah(res);
      }
    } catch (err) {
      console.warn('Gagal memuat skema default sekolah:', err);
    } finally {
      setIsSkemaLoading(false);
    }
  };

  const handleSaveDefaultSkema = async (payload) => {
    if (!user?.npsn) return;
    try {
      const res = await save_default_skema_sekolah(user.npsn, payload);
      if (res && res.success) {
        setDefaultSkemaSekolah(res.data);
        setSkemaSuccessMsg('Skema penilaian default sekolah berhasil disimpan dan diperbarui.');
        setTimeout(() => setSkemaSuccessMsg(''), 4000);
        if (typeof logActivity === 'function') {
          logActivity('SKEMA DEFAULT', 'Memperbarui skema penilaian default sekolah');
        }
      }
    } catch (err) {
      showMessage('Gagal', 'Gagal menyimpan skema default sekolah: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    if (user?.npsn) {
      loadDefaultSkema();
    }
  }, [user?.npsn]);

  useEffect(() => {
    if (activeTab === 'skema' && user?.npsn) {
      loadDefaultSkema();
    }
  }, [activeTab]);

  const loadKopSettings = async () => {
    if (!user?.npsn) return;
    try {
      const res = await get_pengaturan_sekolah(user.npsn);
      if (res) {
        setKopSettings(prev => ({ ...prev, ...res }));
      }
    } catch (err) {
      console.warn('Gagal memuat pengaturan kop sekolah:', err);
    }
  };

  useEffect(() => {
    if (user?.npsn) {
      loadKopSettings();
    }
  }, [user?.npsn]);

  useEffect(() => {
    if (activeTab === 'pengaturan' && user?.npsn) {
      loadKopSettings();
    }
  }, [activeTab]);

  const handleSaveKopSettings = async (customPayload = null) => {
    const targetNpsn = user?.npsn || kopSettings.npsn;
    if (!targetNpsn) {
      if (showMessage) showMessage('Perhatian', 'NPSN sekolah harus diisi sebelum menyimpan pengaturan.', 'warning');
      return;
    }
    setIsSavingKop(true);
    setKopSuccessMsg('');
    setKopErrorMsg('');
    try {
      const payloadToSave = customPayload || kopSettings;
      const res = await save_pengaturan_sekolah(targetNpsn, payloadToSave);
      if (res && (res.status === 'success' || res.success)) {
        setKopSettings(res.data || payloadToSave);
        setKopSuccessMsg('Pengaturan logo dan konfigurasi kop berhasil disimpan.');
        setTimeout(() => setKopSuccessMsg(''), 4500);
        const updatedFields = {
          ...payloadToSave,
          nama_sekolah: payloadToSave.nama_sekolah || user.nama_sekolah,
          logo_kiri: payloadToSave.logo_kiri !== undefined ? payloadToSave.logo_kiri : null,
          logo_kanan: payloadToSave.logo_kanan !== undefined ? payloadToSave.logo_kanan : null,
          logo_dinas: payloadToSave.logo_kiri !== undefined ? payloadToSave.logo_kiri : null,
          logo: payloadToSave.logo_kanan !== undefined ? payloadToSave.logo_kanan : null
        };
        if (onUpdateUser) {
          onUpdateUser(updatedFields);
        } else if (user) {
          Object.assign(user, updatedFields);
        }
        if (typeof logActivity === 'function') {
          logActivity('PENGATURAN', 'Memperbarui logo dan konfigurasi kop kartu ujian');
        }
      }
    } catch (err) {
      console.error('Error saving kop settings:', err);
      setKopErrorMsg('Gagal menyimpan pengaturan: ' + (err.message || 'Terjadi kesalahan'));
      if (showMessage) showMessage('Gagal', 'Gagal menyimpan pengaturan: ' + err.message, 'error');
    } finally {
      setIsSavingKop(false);
    }
  };

  const handleUploadLogoKiri = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 240, 240, 0.85);
      setKopSettings(prev => ({
        ...prev,
        logo_kiri: dataUrl,
        show_logo_kiri: true
      }));
    } catch (err) {
      if (showMessage) showMessage('Gagal Mengunggah Logo', err.message, 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleUploadLogoKanan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 240, 240, 0.85);
      setKopSettings(prev => ({
        ...prev,
        logo_kanan: dataUrl,
        show_logo_kanan: true
      }));
    } catch (err) {
      if (showMessage) showMessage('Gagal Mengunggah Logo', err.message, 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleResetLogoKiri = () => {
    const inputEl = document.getElementById('file_input_logo_kiri');
    if (inputEl) inputEl.value = '';
    setKopSettings(prev => ({
      ...prev,
      logo_kiri: null,
      logo_dinas: null
    }));
  };

  const handleResetLogoKanan = () => {
    const inputEl = document.getElementById('file_input_logo_kanan');
    if (inputEl) inputEl.value = '';
    setKopSettings(prev => ({
      ...prev,
      logo_kanan: null,
      logo: null
    }));
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
        showMessage('Berhasil', 'Foto profil berhasil diperbarui.', 'success');
      }
    } else {
      showMessage('Info', res.message, 'info');
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
        const [resMapel, resK] = await Promise.all([
          api('get_all_mapel', {}),
          api('get_kelas', {})
        ]);
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
        if (resK.status === 'success') setDataKelas(resK.data || []);
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
      } else if (tab === 'pengawas') {
        const [resRuang, resPengawas, resGuru, resJadwal, resSiswa, resKelas] = await Promise.all([
          api('get_ruang', {}),
          api('get_pengawas_ruang', {}),
          api('get_guru', {}),
          api('get_all_jadwal', {}),
          api('get_siswa', {}),
          api('get_kelas', {})
        ]);
        if (resRuang?.status === 'success') setDataRuang(resRuang.data || []);
        if (resPengawas?.status === 'success') setDataPengawasRuang(resPengawas.data || []);
        if (resGuru?.status === 'success') setDataGuru(resGuru.data || []);
        if (resJadwal?.status === 'success') setDataJadwal(resJadwal.data || []);
        if (resSiswa?.status === 'success') {
          setDataSiswa((resSiswa.data || []).map(s => ({
            ...s,
            kelas: `${s.angkatan || ''} ${s.kelas_paralel || ''}`.trim()
          })));
        }
        if (resKelas?.status === 'success') setDataKelas(resKelas.data || []);
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
      interval = setInterval(() => fetchData('monitoring'), 15000);
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
      showMessage('Info', res.message, 'info');
    }
  };

  const handleBulkDelete = async (type) => {
    let ids = [];
    if (type === 'siswa') ids = selectedSiswa;
    else if (type === 'guru') ids = selectedGuru;
    else if (type === 'jadwal') ids = selectedJadwalBulk;

    if (!ids || ids.length === 0) { showMessage('Peringatan', 'Pilih data terlebih dahulu.', 'error'); return; }

    setConfirmDialog({ isOpen: true, title: 'Konfirmasi Hapus Bulk', message: `Hapus ${ids.length} data ${type} yang dipilih? Tindakan ini tidak dapat dibatalkan.`, actionText: 'Hapus', icon: 'delete_forever', type: 'delete', onConfirm: null }); return;

    setIsLoading(true);
    const endpoint = `delete_${type}_bulk`;
    const res = await api(endpoint, { ids });
    setIsLoading(false);

    if (res.status === 'success') {
      showMessage('Info', res.message, 'info');
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
      showMessage('Info', res.message, 'info');
    }
  };

  const handleResetLogin = async (id_siswa) => {
    // ponytail: confirm() removed — caller should pass via confirmDialog if needed
    const res = await fetchAPI('reset_login_siswa', { id_siswa, npsn: user.npsn });
    if (res.status === 'success') {
      showMessage('Berhasil', 'Sesi login berhasil direset.', 'success');
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const handleResetAllLoginSiswa = async () => {
    // ponytail: confirm() removed — caller should pass via confirmDialog if needed
    setIsSubmitting(true);
    const res = await fetchAPI('reset_all_login_siswa', { npsn: user.npsn });
    setIsSubmitting(false);
    if (res.status === 'success') {
      showMessage('Berhasil', 'Sesi login seluruh siswa berhasil direset.', 'success');
    } else {
      showMessage('Info', res.message, 'info');
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
      showMessage('Info', res.message, 'info');
    }
  };

  const handleBulkUpdateStatusUjian = async (status_baru) => {
    // ponytail: confirm() removed — caller should pass via confirmDialog if needed
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
    showMessage('Berhasil', `Semua jadwal ujian berhasil diubah menjadi ${status_baru}`, 'success');
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

  const handleOpenPrintKartu = async (initialMode = 'peserta', preselectedKelas = null) => {
    if (dataRuang.length === 0) {
      try {
        const res = await api('get_ruang', {});
        if (res.status === 'success' && Array.isArray(res.data)) setDataRuang(res.data);
      } catch (e) {
        console.warn('Failed to load rooms for print:', e);
      }
    }
    setPrintKartuModal(prev => ({
      ...prev,
      isOpen: true,
      mode: initialMode,
      filterKelas: preselectedKelas || 'ALL',
      selectedOnly: selectedSiswa.length > 0 && !preselectedKelas
    }));
  };

  const handleGeneratePrintKartu = () => {
    let filtered = [...dataSiswa];

    if (printKartuModal.selectedOnly && selectedSiswa.length > 0) {
      filtered = filtered.filter(s => selectedSiswa.includes(s.id_siswa));
    } else {
      if (printKartuModal.filterKelas && printKartuModal.filterKelas !== 'ALL') {
        filtered = filtered.filter(s => s.kelas === printKartuModal.filterKelas);
      }
      if (printKartuModal.filterRuang && printKartuModal.filterRuang !== 'ALL') {
        if (printKartuModal.filterRuang === 'BELUM_ADA') {
          filtered = filtered.filter(s => !s.ruang);
        } else {
          filtered = filtered.filter(s => s.ruang === printKartuModal.filterRuang);
        }
      }
    }

    if (filtered.length === 0) {
      if (showMessage) showMessage('Peringatan', 'Tidak ada siswa yang memenuhi filter yang dipilih.', 'warning');
      return;
    }

    setPrintKartuPayload({
      students: filtered,
      mode: printKartuModal.mode,
      sekolah: {
        nama_sekolah: kopSettings.nama_sekolah || user.nama_sekolah || user.sekolah || 'SEKOLAH INDONESIA',
        npsn: kopSettings.npsn || user.npsn || '',
        alamat: kopSettings.alamat_sekolah || user.alamat_sekolah || user.alamat || '-',
        logo: kopSettings.logo_kanan !== undefined ? kopSettings.logo_kanan : (user.logo || null),
        logo_dinas: kopSettings.logo_kiri !== undefined ? kopSettings.logo_kiri : (user.logo_dinas || null),
        logo_kiri: kopSettings.logo_kiri !== undefined ? kopSettings.logo_kiri : (user.logo_kiri || user.logo_dinas || null),
        logo_kanan: kopSettings.logo_kanan !== undefined ? kopSettings.logo_kanan : (user.logo_kanan || user.logo || null),
        show_logo_kiri: kopSettings.show_logo_kiri !== false,
        show_logo_kanan: kopSettings.show_logo_kanan !== false,
        kop_baris1: kopSettings.kop_baris1 || '',
        kop_baris2: kopSettings.kop_baris2 || kopSettings.nama_sekolah || user.nama_sekolah || 'SEKOLAH INDONESIA',
        kop_baris3: kopSettings.kop_baris3 || 'KARTU PESERTA ASESMEN / CBT',
        kop_baris4: kopSettings.kop_baris4 !== undefined ? kopSettings.kop_baris4 : undefined,
        kartu_peserta_show_logo_kiri: kopSettings.kartu_peserta_show_logo_kiri !== false,
        kartu_peserta_show_logo_kanan: kopSettings.kartu_peserta_show_logo_kanan !== false,
        kop_meja_mode: kopSettings.kop_meja_mode || 'formal',
        kop_meja_baris1: kopSettings.kop_meja_baris1 || kopSettings.nama_sekolah || user.nama_sekolah || 'SEKOLAH INDONESIA',
        kop_meja_baris2: kopSettings.kop_meja_baris2 !== undefined ? kopSettings.kop_meja_baris2 : undefined,
        kartu_meja_show_logo_kiri: kopSettings.kartu_meja_show_logo_kiri !== false,
        kartu_meja_show_logo_kanan: kopSettings.kartu_meja_show_logo_kanan !== false,
        kepala_sekolah: printKartuModal.namaKepalaSekolah || kopSettings.kepala_sekolah || user.kepala_sekolah || '',
        nip_kepala_sekolah: printKartuModal.nipKepalaSekolah || kopSettings.nip_kepala_sekolah || user.nip_kepala_sekolah || ''
      },
      paperSize: printKartuModal.paperSize,
      showPassword: printKartuModal.showPassword,
      tahunAjaran: printKartuModal.tahunAjaran,
      namaKepalaSekolah: printKartuModal.namaKepalaSekolah || kopSettings.kepala_sekolah || user.kepala_sekolah || '',
      nipKepalaSekolah: printKartuModal.nipKepalaSekolah || kopSettings.nip_kepala_sekolah || user.nip_kepala_sekolah || '',
      targetKelas: printKartuModal.filterKelas !== 'ALL' ? printKartuModal.filterKelas : '',
      targetRuang: printKartuModal.filterRuang !== 'ALL' ? printKartuModal.filterRuang : '',
      targetSesi: printKartuModal.filterSesi
    });
    setPrintKartuModal(prev => ({ ...prev, isOpen: false }));
    setIsPrintKartuActive(true);
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
      showMessage('Info', res.message, 'info');
    }
  };

  const openCreateModal = async (type) => {
    if (type === 'guru' || type === 'jadwal' || type === 'mapel') {
      const res = await api('get_all_mapel', {});
      if (res.status === 'success') setDataMapel(res.data || []);
      if (type === 'jadwal') {
        const resG = await api('get_guru', {});
        if (resG.status === 'success') setDataGuru(resG.data || []);
      }
      if (type === 'mapel' || type === 'jadwal') {
        const resK = await api('get_kelas', {});
        if (resK.status === 'success') setDataKelas(resK.data || []);
      }
    }
    setFormModal({ isOpen: true, type, data: null });
  };

  const openEditModal = async (type, item) => {
    if (type === 'guru' || type === 'jadwal' || type === 'mapel') {
      const res = await api('get_all_mapel', {});
      if (res.status === 'success') setDataMapel(res.data || []);
      if (type === 'jadwal') {
        const resG = await api('get_guru', {});
        if (resG.status === 'success') setDataGuru(resG.data || []);
      }
      if (type === 'mapel' || type === 'jadwal') {
        const resK = await api('get_kelas', {});
        if (resK.status === 'success') setDataKelas(resK.data || []);
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
    } else if (importModal.type === 'mapel') {
      headers = ['nama_mapel', 'alokasi_kelas'];
      filename = 'Template_Mata_Pelajaran.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filename);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    setIsSubmitting(true);

    const reader = new FileReader();
    reader.onerror = () => {
      showMessage('Gagal', 'Gagal membaca berkas Excel.', 'error');
      setIsSubmitting(false);
    };
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames && wb.SheetNames.length > 0 ? wb.SheetNames[0] : null;
        const ws = wsname ? wb.Sheets[wsname] : null;
        const rawData = ws ? XLSX.utils.sheet_to_json(ws) : [];

        if (!rawData || rawData.length === 0) {
          showMessage('Peringatan', 'File kosong atau format salah.', 'error');
          setIsSubmitting(false);
          return;
        }

        let endpoint = '';
        let processedData = [];
        let skippedMapelCount = 0;

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
        } else if (importModal.type === 'mapel') {
          endpoint = 'create_mapel_bulk';
          const seenInFile = new Set();
          processedData = rawData
            .map(row => {
              if (!row) return { nama_mapel: '', npsn: user.npsn };
              let rawNama = row.nama_mapel ?? row.Nama_Mapel ?? row.NAMA_MAPEL;
              if (rawNama === undefined || rawNama === null) {
                const matchedKey = Object.keys(row).find(k => {
                  const norm = k.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '_');
                  return norm === 'nama_mapel' || norm === 'mata_pelajaran' || norm === 'mapel' || norm === 'nama_mata_pelajaran';
                });
                rawNama = matchedKey ? row[matchedKey] : '';
              }
              const nama = String(rawNama ?? '').replace(/\s+/g, ' ').trim();
              const rawAlokasi = row.alokasi_kelas ?? row.Alokasi_Kelas ?? row.ALOKASI_KELAS ?? 'Semua Kelas';
              const alokasi = String(rawAlokasi || '').trim() || 'Semua Kelas';
              return {
                nama_mapel: nama,
                alokasi_kelas: alokasi,
                npsn: user.npsn
              };
            })
            .filter(item => {
              if (!item.nama_mapel) return false;
              const key = item.nama_mapel.toLowerCase();
              if (seenInFile.has(key)) return false;
              seenInFile.add(key);
              return true;
            });

          if (processedData.length === 0) {
            showMessage('Peringatan', 'Tidak ada data mata pelajaran valid yang dapat diimpor.', 'error');
            setIsSubmitting(false);
            return;
          }

          let mapelList = dataMapel;
          if (!mapelList || mapelList.length === 0) {
            const mRes = await api('get_all_mapel', {});
            if (mRes.status === 'success') mapelList = mRes.data || [];
          }
          const existingNames = new Set((mapelList || []).map(m => (m.nama_mapel || '').trim().toLowerCase()));
          const newItems = processedData.filter(item => !existingNames.has(item.nama_mapel.toLowerCase()));

          if (newItems.length === 0) {
            showMessage('Info', 'Semua mata pelajaran dalam file sudah terdaftar.', 'info');
            setImportModal({ isOpen: false, type: '' });
            setIsSubmitting(false);
            return;
          }
          skippedMapelCount = processedData.length - newItems.length;
          processedData = newItems;
        }

        const modalType = importModal.type;
        const res = await api(endpoint, processedData);

        if (res.status === 'success') {
          const typeLabel = modalType === 'mapel' ? 'mata pelajaran' : modalType;
          const actualInserted = res.insertedCount !== undefined ? res.insertedCount : processedData.length;
          const apiSkipped = res.insertedCount !== undefined ? Math.max(0, processedData.length - res.insertedCount) : 0;
          const totalSkipped = skippedMapelCount + apiSkipped;

          if (actualInserted === 0 && modalType === 'mapel') {
            showMessage('Info', res.message || 'Semua mata pelajaran sudah terdaftar di database.', 'info');
          } else {
            const successMsg = totalSkipped > 0
              ? `Berhasil mengimpor ${actualInserted} data ${typeLabel} (${totalSkipped} data dilewati karena sudah terdaftar)`
              : `Berhasil mengimpor ${actualInserted} data ${typeLabel}`;
            showMessage('Berhasil', successMsg, 'success');
            await api('create_audit_log', {
              username: user.username,
              role: 'admin',
              action: 'IMPORT',
              target: `${modalType} (${actualInserted} data)`
            });
          }
          setImportModal({ isOpen: false, type: '' });
          fetchData(activeTab);
          if (modalType === 'mapel' && activeTab !== 'mapel') {
            fetchData('mapel');
          }
        } else {
          showMessage('Info', res.message, 'info');
        }
      } catch (error) {
        console.error(error);
        showMessage('Gagal', 'Gagal memproses file Excel: ' + error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const openAnalisisSoal = async () => {
    if (!selectedJadwal) { showMessage('Peringatan', 'Pilih jadwal ujian terlebih dahulu.', 'error'); return; }
    const jadwalObj = dataJadwal.find(j => j.id_jadwal === selectedJadwal);
    if (!jadwalObj) return;
    setIsLoading(true);
    const res = await api('get_analisis_soal', { id_jadwal: selectedJadwal, id_mapel: jadwalObj.id_mapel });
    setIsLoading(false);
    if (res.status === 'success') {
      setDataAnalisis(res.data || []);
      setIsAnalisisModalOpen(true);
    } else {
      showMessage('Gagal', 'Gagal memuat analisis soal: ' + res.message, 'error');
    }
  };

  const exportToExcel = () => {
    if (!dataLog || dataLog.length === 0) { showMessage('Peringatan', 'Tidak ada data untuk di-export', 'error'); return; }
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
      if (!dataSiswa || dataSiswa.length === 0) { showMessage('Peringatan', 'Tidak ada data siswa untuk di-export', 'error'); return; }
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
      if (!dataGuru || dataGuru.length === 0) { showMessage('Peringatan', 'Tidak ada data guru untuk di-export', 'error'); return; }
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
      if (!dataJadwal || dataJadwal.length === 0) { showMessage('Peringatan', 'Tidak ada data jadwal untuk di-export', 'error'); return; }
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

  // Filtered Pengawas (Sub-tab 1)
  const filteredPengawas = useMemo(() => {
    return dataPengawasRuang.filter(p => {
      const matchJadwal = filterRuangJadwal === 'ALL' || p.id_jadwal === filterRuangJadwal;
      if (!matchJadwal) return false;

      if (!searchPengawas.trim()) return true;
      const q = searchPengawas.toLowerCase();
      const guruName = (p.guru?.nama_lengkap || '').toLowerCase();
      const guruNip = (p.guru?.nip || '').toLowerCase();
      const roomName = (p.ruang?.nama_ruang || '').toLowerCase();
      const mapelName = (p.jadwal?.mata_pelajaran?.nama_mapel || '').toLowerCase();
      return guruName.includes(q) || guruNip.includes(q) || roomName.includes(q) || mapelName.includes(q);
    });
  }, [dataPengawasRuang, filterRuangJadwal, searchPengawas]);

  // Pengawas Metrics
  const pengawasMetrics = useMemo(() => {
    const totalRuang = dataRuang.length;
    const totalPenugasan = dataPengawasRuang.length;
    const ruangWithProctors = new Set(dataPengawasRuang.map(p => p.id_ruang).filter(Boolean));
    const ruangBelumAdaPengawas = dataRuang.filter(r => !ruangWithProctors.has(r.id_ruang)).length;
    const uniqueGuruCount = new Set(dataPengawasRuang.map(p => p.id_guru).filter(Boolean)).size;
    const ruangTerisiCount = ruangWithProctors.size;
    return {
      totalRuang,
      totalPenugasan,
      ruangBelumAdaPengawas,
      uniqueGuruCount,
      ruangTerisiCount
    };
  }, [dataRuang, dataPengawasRuang]);

  // Filtered Ruang (Sub-tab 2)
  const filteredRuang = useMemo(() => {
    if (!searchRuang.trim()) return dataRuang;
    const q = searchRuang.toLowerCase();
    return dataRuang.filter(r => {
      return (r.nama_ruang || '').toLowerCase().includes(q) ||
             (r.kode_ruang || '').toLowerCase().includes(q) ||
             (r.keterangan || '').toLowerCase().includes(q);
    });
  }, [dataRuang, searchRuang]);

  // Available classes for Student Room Allocation
  const availableAlokasiClasses = useMemo(() => {
    const clsSet = new Set();
    dataSiswa.forEach(s => {
      const k = (s.kelas || `${s.angkatan || ''} ${s.kelas_paralel || ''}`).trim();
      if (k) clsSet.add(k);
    });
    dataKelas.forEach(k => {
      const clsName = `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim();
      if (clsName) clsSet.add(clsName);
    });
    return Array.from(clsSet).sort();
  }, [dataSiswa, dataKelas]);

  // Filtered Alokasi Siswa (Sub-tab 3)
  const filteredAlokasiSiswa = useMemo(() => {
    return dataSiswa.filter(s => {
      const studentClass = (s.kelas || `${s.angkatan || ''} ${s.kelas_paralel || ''}`).trim();
      const matchKelas = filterAlokasiKelas === 'ALL' || studentClass === filterAlokasiKelas || studentClass.startsWith(filterAlokasiKelas);
      if (!matchKelas) return false;

      const matchRuang = filterAlokasiRuang === 'ALL' ? true :
                         filterAlokasiRuang === 'BELUM' ? (!s.ruang || s.ruang.trim() === '') :
                         (s.ruang === filterAlokasiRuang);
      if (!matchRuang) return false;

      if (!searchAlokasiSiswa.trim()) return true;
      const q = searchAlokasiSiswa.toLowerCase();
      return (s.nama_lengkap || '').toLowerCase().includes(q) ||
             (s.nisn || '').toLowerCase().includes(q) ||
             (s.username || '').toLowerCase().includes(q);
    });
  }, [dataSiswa, filterAlokasiKelas, filterAlokasiRuang, searchAlokasiSiswa]);

  // Handlers for Proctor Assignment
  const handleOpenAssignPengawasModal = () => {
    setAssignPengawasForm({
      id_ruang: dataRuang[0]?.id_ruang || '',
      id_guru: dataGuru[0]?.id_guru || '',
      id_jadwal: '',
      peran: 'PENGAWAS UTAMA'
    });
    setIsAssignPengawasModalOpen(true);
  };

  const handleSaveAssignPengawas = async (e) => {
    e.preventDefault();
    if (!assignPengawasForm.id_ruang) {
      showMessage('Peringatan', 'Pilih ruang ujian terlebih dahulu.', 'error');
      return;
    }
    if (!assignPengawasForm.id_guru) {
      showMessage('Peringatan', 'Pilih guru pengawas terlebih dahulu.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api('assign_pengawas_ruang', {
        id_ruang: assignPengawasForm.id_ruang,
        id_guru: assignPengawasForm.id_guru,
        id_jadwal: assignPengawasForm.id_jadwal || null,
        peran: assignPengawasForm.peran || 'PENGAWAS UTAMA',
        status_tugas: 'AKTIF'
      });

      if (res.status === 'success') {
        const guruObj = dataGuru.find(g => g.id_guru === assignPengawasForm.id_guru);
        const ruangObj = dataRuang.find(r => r.id_ruang === assignPengawasForm.id_ruang);
        await api('create_audit_log', {
          username: user.username,
          role: 'admin',
          action: 'ASSIGN_PENGAWAS',
          target: `${guruObj?.nama_lengkap || assignPengawasForm.id_guru} -> ${ruangObj?.nama_ruang || assignPengawasForm.id_ruang}`
        });
        if (showMessage) {
          showMessage('Sukses', 'Pengawas berhasil ditugaskan ke ruang ujian.', 'success');
        } else {
          showMessage('Berhasil', 'Pengawas berhasil ditugaskan ke ruang ujian.', 'success');
        }
        setIsAssignPengawasModalOpen(false);
        fetchData('pengawas');
      } else {
        showMessage('Gagal', res.message || 'Gagal menugaskan pengawas.', 'error');
      }
    } catch (err) {
      console.error('Error assigning pengawas:', err);
      showMessage('Info', 'Terjadi kesalahan saat menugaskan pengawas.', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignPengawas = async (assignment) => {
    const guruName = assignment.guru?.nama_lengkap || 'Pengawas';
    const roomName = assignment.ruang?.nama_ruang || 'Ruang';
    // ponytail: confirm() removed — caller uses confirmDialog

    setIsLoading(true);
    try {
      const res = await api('delete_pengawas_ruang', { id_penugasan: assignment.id_penugasan });
      if (res.status === 'success') {
        await api('create_audit_log', {
          username: user.username,
          role: 'admin',
          action: 'DELETE_PENGAWAS',
          target: `${guruName} (${roomName})`
        });
        if (showMessage) {
          showMessage('Sukses', 'Penugasan pengawas berhasil dihapus.', 'success');
        } else {
          showMessage('Berhasil', 'Penugasan pengawas berhasil dihapus.', 'success');
        }
        fetchData('pengawas');
      } else {
        showMessage('Gagal', res.message || 'Gagal menghapus penugasan pengawas.', 'error');
      }
    } catch (err) {
      console.error('Error deleting pengawas assignment:', err);
      showMessage('Info', 'Terjadi kesalahan saat menghapus penugasan.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for Ruang CRUD
  const handleOpenRuangModal = (ruang = null) => {
    if (ruang) {
      setEditingRuang(ruang);
      setRuangForm({
        nama_ruang: ruang.nama_ruang || '',
        kode_ruang: ruang.kode_ruang || '',
        kapasitas: ruang.kapasitas || 30,
        keterangan: ruang.keterangan || ''
      });
    } else {
      setEditingRuang(null);
      setRuangForm({
        nama_ruang: '',
        kode_ruang: '',
        kapasitas: 30,
        keterangan: ''
      });
    }
    setIsRuangModalOpen(true);
  };

  const handleSaveRuang = async (e) => {
    e.preventDefault();
    if (!ruangForm.nama_ruang.trim()) {
      showMessage('Peringatan', 'Nama ruang wajib diisi.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (editingRuang) {
        res = await api('update_ruang', {
          id_ruang: editingRuang.id_ruang,
          nama_ruang: ruangForm.nama_ruang.trim(),
          kode_ruang: ruangForm.kode_ruang.trim() || undefined,
          kapasitas: Number(ruangForm.kapasitas) || 30,
          keterangan: ruangForm.keterangan.trim() || null
        });
      } else {
        res = await api('create_ruang', {
          nama_ruang: ruangForm.nama_ruang.trim(),
          kode_ruang: ruangForm.kode_ruang.trim() || undefined,
          kapasitas: Number(ruangForm.kapasitas) || 30,
          keterangan: ruangForm.keterangan.trim() || null
        });
      }

      if (res.status === 'success') {
        await api('create_audit_log', {
          username: user.username,
          role: 'admin',
          action: editingRuang ? 'UPDATE_RUANG' : 'CREATE_RUANG',
          target: ruangForm.nama_ruang.trim()
        });
        if (showMessage) {
          showMessage('Sukses', editingRuang ? 'Ruang ujian berhasil diperbarui.' : 'Ruang ujian berhasil ditambahkan.', 'success');
        } else {
          showMessage('Berhasil', editingRuang ? 'Ruang ujian berhasil diperbarui.' : 'Ruang ujian berhasil ditambahkan.', 'success');
        }
        setIsRuangModalOpen(false);
        fetchData('pengawas');
      } else {
        showMessage('Gagal', res.message || 'Gagal menyimpan ruang ujian.', 'error');
      }
    } catch (err) {
      console.error('Error saving ruang:', err);
      showMessage('Info', 'Terjadi kesalahan saat menyimpan ruang ujian.', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRuang = async (ruang) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete',
      title: 'Hapus Ruang Ujian',
      message: `Hapus ruang "${ruang.nama_ruang}"? Penugasan pengawas terkait akan ikut terhapus.`,
      icon: 'delete_forever',
      actionText: 'Hapus',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, isOpen: false }));
        setIsLoading(true);
        try {
          const res = await api('delete_ruang', { id_ruang: ruang.id_ruang });
          if (res.status === 'success') {
            await api('create_audit_log', {
              username: user.username,
              role: 'admin',
              action: 'DELETE_RUANG',
              target: `${ruang.nama_ruang} (${ruang.id_ruang})`
            });
            showMessage('Berhasil', 'Ruang ujian berhasil dihapus.', 'success');
            fetchData('pengawas');
          } else {
            showMessage('Gagal', res.message || 'Gagal menghapus ruang ujian.', 'error');
          }
        } catch (err) {
          console.error('Error deleting ruang:', err);
          showMessage('Gagal', 'Terjadi kesalahan saat menghapus ruang ujian.', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Handlers for Student Room Allocation
  const handleBulkAssignByClass = async () => {
    if (!selectedKelasAlokasi) {
      showMessage('Berhasil', 'Pilih kelas/rombel yang akan dialokasikan.', 'success');
      return;
    }
    if (!targetRuangAlokasi) {
      showMessage('Peringatan', 'Pilih ruang ujian tujuan.', 'error');
      return;
    }

    const roomObj = dataRuang.find(r => r.nama_ruang === targetRuangAlokasi || r.id_ruang === targetRuangAlokasi);
    const roomName = roomObj?.nama_ruang || targetRuangAlokasi;

    // ponytail: confirm() removed — caller uses confirmDialog

    setIsLoading(true);
    try {
      const res = await api('assign_siswa_ruang_bulk', {
        nama_ruang: roomName,
        target_kelas: selectedKelasAlokasi
      });

      if (res.status === 'success') {
        await api('create_audit_log', {
          username: user.username,
          role: 'admin',
          action: 'ALOKASI_SISWA_KELAS',
          target: `Kelas ${selectedKelasAlokasi} -> ${roomName}`
        });
        if (showMessage) {
          showMessage('Sukses', `Siswa kelas ${selectedKelasAlokasi} berhasil dialokasikan ke ${roomName}.`, 'success');
        } else {
          showMessage('Berhasil', `Siswa kelas ${selectedKelasAlokasi} berhasil dialokasikan ke ${roomName}.`, 'success');
        }
        fetchData('pengawas');
      } else {
        showMessage('Gagal', res.message || 'Gagal mengalokasikan siswa.', 'error');
      }
    } catch (err) {
      console.error('Error bulk assigning students by class:', err);
      showMessage('Info', 'Terjadi kesalahan saat mengalokasikan siswa.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAssignSelectedSiswa = async () => {
    if (selectedAlokasiSiswa.length === 0) {
      showMessage('Peringatan', 'Pilih minimal satu siswa dari tabel terlebih dahulu.', 'error');
      return;
    }
    if (!targetRuangAlokasi) {
      showMessage('Peringatan', 'Pilih ruang ujian tujuan.', 'error');
      return;
    }

    const roomObj = dataRuang.find(r => r.nama_ruang === targetRuangAlokasi || r.id_ruang === targetRuangAlokasi);
    const roomName = roomObj?.nama_ruang || targetRuangAlokasi;

    // ponytail: confirm() removed — caller uses confirmDialog

    setIsLoading(true);
    try {
      const res = await api('assign_siswa_ruang_bulk', {
        nama_ruang: roomName,
        list_id_siswa: selectedAlokasiSiswa
      });

      if (res.status === 'success') {
        await api('create_audit_log', {
          username: user.username,
          role: 'admin',
          action: 'ALOKASI_SISWA_BULK',
          target: `${selectedAlokasiSiswa.length} Siswa -> ${roomName}`
        });
        if (showMessage) {
          showMessage('Sukses', `${selectedAlokasiSiswa.length} siswa berhasil dialokasikan ke ${roomName}.`, 'success');
        } else {
          showMessage('Berhasil', `${selectedAlokasiSiswa.length} siswa berhasil dialokasikan ke ${roomName}.`, 'success');
        }
        setSelectedAlokasiSiswa([]);
        fetchData('pengawas');
      } else {
        showMessage('Gagal', res.message || 'Gagal mengalokasikan siswa.', 'error');
      }
    } catch (err) {
      console.error('Error bulk assigning selected students:', err);
      showMessage('Info', 'Terjadi kesalahan saat mengalokasikan siswa.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleAssignSiswaRuang = async (id_siswa, newRoomName) => {
    if (!newRoomName) return;
    setIsLoading(true);
    try {
      const res = await api('assign_siswa_ruang_bulk', {
        nama_ruang: newRoomName,
        list_id_siswa: [id_siswa]
      });

      if (res.status === 'success') {
        if (showMessage) {
          showMessage('Sukses', 'Ruang siswa berhasil diperbarui.', 'success');
        }
        fetchData('pengawas');
      } else {
        showMessage('Gagal', res.message || 'Gagal memperbarui ruang siswa.', 'error');
      }
    } catch (err) {
      console.error('Error assigning single student room:', err);
      showMessage('Info', 'Terjadi kesalahan saat memperbarui ruang siswa.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const [autoUsername, setAutoUsername] = useState('');
  const [jadwalTargetKelas, setJadwalTargetKelas] = useState('');

  useEffect(() => {
    if (formModal.isOpen && formModal.data) {
      setAutoUsername(formModal.data.username || '');
      if (formModal.type === 'jadwal') {
        setJadwalTargetKelas(formModal.data.target_kelas || '');
      }
    } else if (formModal.isOpen) {
      setAutoUsername('');
      if (formModal.type === 'jadwal') {
        setJadwalTargetKelas('');
      }
    }
  }, [formModal.isOpen, formModal.data, formModal.type]);

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
        { id: 'siswa', label: 'Data Siswa', icon: 'school' },
        { id: 'guru', label: 'Data Guru', icon: 'local_library' },
        { id: 'mapel', label: 'Mata Pelajaran', icon: 'menu_book' },
        { id: 'kelas', label: 'Manajemen Kelas', icon: 'meeting_room' }
      ]
    },
    {
      title: 'Ujian & Pelaksanaan',
      items: [
        { id: 'jadwal', label: 'Jadwal Ujian', icon: 'event_note' },
        { id: 'pengawas', label: 'Pengawas & Ruang', icon: 'badge' },
        { id: 'kontrol', label: 'Kontrol Ujian', icon: 'settings_remote' },
        { id: 'skema', label: 'Skema Penilaian', icon: 'tune' },
        { id: 'soal', label: 'Bank Soal (Preview)', icon: 'quiz' }
      ]
    },
    {
      title: 'Sistem',
      items: [
        { id: 'pengaturan', label: 'Pengaturan / Profil Sekolah', icon: 'settings' },
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
    pengawas: 'Manajemen Pengawas & Ruang Ujian',
    kontrol: 'Kontrol Ujian',
    skema: 'Skema Penilaian Default',
    monitoring: 'Live Monitoring Ujian',
    hasil: 'Rekap Hasil Ujian',
    soal: 'Bank Soal (Preview)',
    pengaturan: 'Pengaturan & Profil Sekolah',
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
              <span className="material-symbols-outlined text-primary dark:text-primary-400">analytics</span>
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
                      <span className="bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 px-2 py-0.5 rounded text-xs font-semibold">
                        {soal.tipe_soal}
                      </span>
                    </td>
                    <td className="p-3 text-center text-primary font-bold">{soal.correct}</td>
                    <td className="p-3 text-center text-rose-600 font-bold">{soal.wrong}</td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        parseFloat(soal.difficulty) > 70 ? 'bg-primary/15 text-primary-700' :
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
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Alokasi Kelas</label>
                  <select
                    name="alokasi_kelas"
                    defaultValue={data?.alokasi_kelas || 'Semua Kelas'}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                  >
                    <option value="Semua Kelas">Semua Kelas (Umum)</option>
                    {data?.alokasi_kelas && data.alokasi_kelas !== 'Semua Kelas' && 
                     !dataKelas.some(k => `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}` === data.alokasi_kelas) &&
                     !dataKelas.some(k => `Tingkat ${String(k.tingkat || '').trim()} (Semua)` === data.alokasi_kelas) && (
                      <option value={data?.alokasi_kelas}>{data?.alokasi_kelas} (Tersimpan)</option>
                    )}
                    <optgroup label="Tingkat / Angkatan (Semua Kelas)">
                      {Array.from(new Set(dataKelas.map(k => String(k.tingkat || '').trim()).filter(Boolean))).map(t => (
                        <option key={`tingkat-${t}`} value={`Tingkat ${t} (Semua)`}>Tingkat {t} (Semua Kelas)</option>
                      ))}
                    </optgroup>
                    <optgroup label="Kelas Paralel Spesifik">
                      {dataKelas.filter(k => k.tingkat && k.kelas_paralel).map(k => {
                        const val = `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}`;
                        return <option key={k.id_kelas} value={val}>{val}</option>;
                      })}
                    </optgroup>
                  </select>
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
                  <PasswordInput name="password" required={!isEdit} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
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
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">NIP (Nomor Induk Pegawai)</label>
                  <input name="nip" defaultValue={data?.nip || ''} placeholder="Contoh: 198501012010011001" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
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
                  <PasswordInput name="password" required={!isEdit} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Mata Pelajaran (Bisa Pilih Lebih dari 1)</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1.5 bg-slate-50 dark:bg-slate-900/40">
                    {dataMapel.map(m => (
                      <label key={m.id_mapel} className="flex items-center space-x-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" name="mapels" value={m.id_mapel} defaultChecked={data?.id_mapels?.includes(m.id_mapel)} onChange={handleAutoUsernameGuru} className="rounded text-primary focus:ring-primary/50" />
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
                  <select
                    name="id_mapel"
                    defaultValue={data?.id_mapel || ''}
                    required
                    onChange={(e) => {
                      const selectedM = dataMapel.find(m => String(m.id_mapel) === String(e.target.value));
                      const alloc = selectedM?.alokasi_kelas;
                      const newTarget = (alloc && alloc !== 'Semua Kelas') ? alloc : '';
                      setJadwalTargetKelas(newTarget);
                      const targetSelect = document.getElementById('input_jadwal_target_kelas');
                      if (targetSelect) targetSelect.value = newTarget;
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                  >
                    <option value="">Pilih Mapel</option>
                    {dataMapel.map(m => (
                      <option key={m.id_mapel} value={m.id_mapel}>
                        {m.nama_mapel} {m.alokasi_kelas && m.alokasi_kelas !== 'Semua Kelas' ? `(${m.alokasi_kelas})` : ''}
                      </option>
                    ))}
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
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Target Kelas / Tingkat Ujian</label>
                  <select
                    id="input_jadwal_target_kelas"
                    name="target_kelas"
                    value={jadwalTargetKelas}
                    onChange={(e) => setJadwalTargetKelas(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                  >
                    <option value="">Semua Tingkat (Umum)</option>
                    {jadwalTargetKelas && 
                     !dataKelas.some(k => `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}` === jadwalTargetKelas) &&
                     !dataKelas.some(k => `Tingkat ${String(k.tingkat || '').trim()} (Semua)` === jadwalTargetKelas) && (
                      <option value={jadwalTargetKelas}>{jadwalTargetKelas} (Tersimpan)</option>
                    )}
                    <optgroup label="Tingkat / Angkatan (Semua Kelas)">
                      {Array.from(new Set(dataKelas.map(k => String(k.tingkat || '').trim()).filter(Boolean))).map(t => (
                        <option key={`tingkat-${t}`} value={`Tingkat ${t} (Semua)`}>Tingkat {t} (Semua)</option>
                      ))}
                    </optgroup>
                    <optgroup label="Kelas Paralel Spesifik">
                      {dataKelas.filter(k => k.tingkat && k.kelas_paralel).map(k => {
                        const val = `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}`;
                        return <option key={k.id_kelas} value={val}>{val}</option>;
                      })}
                    </optgroup>
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
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95"
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
                { showMessage('Info', 'Password tidak cocok!', 'error'); return; }
              }
              const res = await api('update_admin_profil', { id_admin: user.id_admin, password: payload.password, foto_profil: payload.foto_profil });
              if (res.status === 'success') {
                if (payload.foto_profil && onUpdateUser) {
                  onUpdateUser({ foto_profil: payload.foto_profil });
                }
                showMessage('Info', res.message, 'info');
                setProfileModalOpen(false);
              } else {
                showMessage('Info', res.message, 'info');
              }
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-center mb-2">
              {user.foto_profil ? (
                <img id="preview_admin_foto_modal" src={user.foto_profil} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-primary/20" />
              ) : (
                <div id="preview_admin_avatar_placeholder" className="w-20 h-20 rounded-full bg-primary/15 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-3xl">
                  {user.nama_lengkap.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Foto Profil</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  id="admin_profile_photo_file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressImageFile(file);
                      const hiddenInput = document.getElementById('input_admin_foto_profil');
                      if (hiddenInput) hiddenInput.value = dataUrl;
                      const previewImg = document.getElementById('preview_admin_foto_modal');
                      if (previewImg) previewImg.src = dataUrl;
                      const placeholder = document.getElementById('preview_admin_avatar_placeholder');
                      if (placeholder) {
                        placeholder.style.display = 'none';
                        const parent = placeholder.parentElement;
                        const newImg = document.createElement('img');
                        newImg.id = 'preview_admin_foto_modal';
                        newImg.src = dataUrl;
                        newImg.className = 'w-20 h-20 rounded-full object-cover border-4 border-primary/20';
                        parent.appendChild(newImg);
                      }
                    } catch (err) {
                      showMessage('Gagal', err.message, 'error');
                    }
                  }}
                />
                <label
                  htmlFor="admin_profile_photo_file"
                  className="cursor-pointer px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Pilih File Foto</span>
                </label>
                <input id="input_admin_foto_profil" name="foto_profil" defaultValue={user.foto_profil || ''} type="hidden" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Password Baru (Kosongkan jika tidak diubah)</label>
              <PasswordInput name="password" placeholder="Password Baru" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Konfirmasi Password</label>
              <PasswordInput name="password_confirm" placeholder="Konfirmasi Password" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
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
                className="px-5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95"
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
              Import Data {importModal.type === 'siswa' ? 'Siswa' : importModal.type === 'guru' ? 'Guru' : importModal.type === 'mapel' ? 'Mata Pelajaran' : 'Jadwal'}
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
            className="w-full flex items-center justify-center gap-2 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 font-bold py-2.5 px-4 rounded-xl mb-4 hover:bg-primary/15 dark:hover:bg-primary/15 transition-colors text-xs sm:text-sm"
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
            confirmDialog.type === 'unblock' ? 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary-400' :
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
                confirmDialog.type === 'unblock' ? 'bg-primary hover:bg-primary/90' :
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

  const renderAssignPengawasModal = () => {
    if (!isAssignPengawasModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto animate-scale-up">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">assignment_ind</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Tugaskan Pengawas Ruang</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Kaitkan guru pengawas dengan ruang dan jadwal ujian</p>
              </div>
            </div>
            <button
              onClick={() => setIsAssignPengawasModalOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <form onSubmit={handleSaveAssignPengawas} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ruang Ujian <span className="text-rose-500">*</span>
              </label>
              {dataRuang.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>Belum ada data ruang ujian. Buat ruang terlebih dahulu.</span>
                  <button
                    type="button"
                    onClick={() => { setIsAssignPengawasModalOpen(false); setPengawasSubTab('ruang'); handleOpenRuangModal(); }}
                    className="font-bold underline text-primary ml-2 shrink-0"
                  >
                    + Buat Ruang
                  </button>
                </div>
              ) : (
                <select
                  value={assignPengawasForm.id_ruang}
                  onChange={(e) => setAssignPengawasForm(prev => ({ ...prev, id_ruang: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">-- Pilih Ruang Ujian --</option>
                  {dataRuang.map(r => (
                    <option key={r.id_ruang} value={r.id_ruang}>
                      {r.nama_ruang} {r.kode_ruang ? `(${r.kode_ruang})` : ''} - Kapasitas: {r.kapasitas}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Guru Pengawas <span className="text-rose-500">*</span>
              </label>
              <select
                value={assignPengawasForm.id_guru}
                onChange={(e) => setAssignPengawasForm(prev => ({ ...prev, id_guru: e.target.value }))}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">-- Pilih Guru --</option>
                {dataGuru.map(g => (
                  <option key={g.id_guru} value={g.id_guru}>
                    {g.nama_lengkap} {g.nip ? `(NIP: ${g.nip})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Jadwal Ujian (Opsional)
              </label>
              <select
                value={assignPengawasForm.id_jadwal}
                onChange={(e) => setAssignPengawasForm(prev => ({ ...prev, id_jadwal: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Semua Jadwal di Ruangan Ini (Tetap / Permanen)</option>
                {dataJadwal.map(j => (
                  <option key={j.id_jadwal} value={j.id_jadwal}>
                    {j.mata_pelajaran?.nama_mapel || j.id_mapel} - Kelas: {j.target_kelas || 'Semua'} ({j.waktu_mulai ? new Date(j.waktu_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Pilih &quot;Semua Jadwal&quot; jika guru bertugas penuh mengawasi seluruh sesi di ruangan ini.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Peran Penugasan
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { value: 'PENGAWAS UTAMA', label: 'Pengawas Utama', desc: 'Verifikasi tanda tangan & kehadiran' },
                  { value: 'PROKTOR', label: 'Proktor Ruangan', desc: 'Bantuan teknis & anticheat' }
                ].map(role => (
                  <label
                    key={role.value}
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                      assignPengawasForm.peran === role.value
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-400 ring-1 ring-primary'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">{role.label}</span>
                      <input
                        type="radio"
                        name="peran_pengawas"
                        value={role.value}
                        checked={assignPengawasForm.peran === role.value}
                        onChange={(e) => setAssignPengawasForm(prev => ({ ...prev, peran: e.target.value }))}
                        className="text-primary focus:ring-primary"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{role.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAssignPengawasModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || dataRuang.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[40px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    <span>Simpan Penugasan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderRuangModal = () => {
    if (!isRuangModalOpen) return null;
    const isEdit = Boolean(editingRuang);
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto animate-scale-up">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">meeting_room</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                  {isEdit ? 'Edit Ruang Ujian' : 'Tambah Ruang Ujian'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isEdit ? 'Perbarui informasi dan kapasitas ruangan' : 'Tambahkan ruangan baru untuk pelaksanaan ujian'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRuangModalOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <form onSubmit={handleSaveRuang} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Ruang <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={ruangForm.nama_ruang}
                onChange={(e) => setRuangForm(prev => ({ ...prev, nama_ruang: e.target.value }))}
                placeholder="Contoh: Ruang 01, Lab Komputer A"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kode Ruang
                </label>
                <input
                  type="text"
                  value={ruangForm.kode_ruang}
                  onChange={(e) => setRuangForm(prev => ({ ...prev, kode_ruang: e.target.value }))}
                  placeholder="Contoh: R-01, LAB-A"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kapasitas (Kursi) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={ruangForm.kapasitas}
                  onChange={(e) => setRuangForm(prev => ({ ...prev, kapasitas: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Keterangan / Lokasi (Opsional)
              </label>
              <textarea
                rows="3"
                value={ruangForm.keterangan}
                onChange={(e) => setRuangForm(prev => ({ ...prev, keterangan: e.target.value }))}
                placeholder="Contoh: Gedung Timur Lantai 2, dilengkapi 35 PC dan AC"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              ></textarea>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRuangModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[40px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    <span>{isEdit ? 'Perbarui Ruang' : 'Tambah Ruang'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderPrintKartuModal = () => {
    if (!printKartuModal.isOpen) return null;

    // Distinct list of classes
    const availableClasses = Array.from(
      new Set(dataSiswa.map(s => s.kelas).filter(Boolean))
    ).sort();

    // Distinct list of rooms
    const availableRooms = Array.from(
      new Set(
        [
          ...dataRuang.map(r => r.nama_ruang),
          ...dataSiswa.map(s => s.ruang).filter(Boolean)
        ]
      )
    ).sort();

    // Calculate preview count
    let filteredCount = dataSiswa.length;
    if (printKartuModal.selectedOnly && selectedSiswa.length > 0) {
      filteredCount = dataSiswa.filter(s => selectedSiswa.includes(s.id_siswa)).length;
    } else {
      let temp = dataSiswa;
      if (printKartuModal.filterKelas !== 'ALL') {
        temp = temp.filter(s => s.kelas === printKartuModal.filterKelas);
      }
      if (printKartuModal.filterRuang !== 'ALL') {
        if (printKartuModal.filterRuang === 'BELUM_ADA') {
          temp = temp.filter(s => !s.ruang);
        } else {
          temp = temp.filter(s => s.ruang === printKartuModal.filterRuang);
        }
      }
      filteredCount = temp.length;
    }
    const pageCount = Math.ceil(filteredCount / 8);

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 max-h-[92vh] overflow-y-auto animate-scale-up">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">badge</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                  Cetak Kartu Ujian & Meja
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih tipe kartu, filter data, dan pengaturan format kertas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPrintKartuModal(prev => ({ ...prev, isOpen: false }))}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Mode Selector (Kartu Peserta vs Kartu Meja) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipe Dokumen Kartu
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintKartuModal(prev => ({ ...prev, mode: 'peserta' }))}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    printKartuModal.mode === 'peserta'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">badge</span>
                  <div>
                    <div className="text-xs font-bold">Kartu Peserta</div>
                    <div className="text-[10px] text-slate-400">Identitas, Login & Foto</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintKartuModal(prev => ({ ...prev, mode: 'meja' }))}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    printKartuModal.mode === 'meja'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">table_restaurant</span>
                  <div>
                    <div className="text-xs font-bold">Kartu Meja</div>
                    <div className="text-[10px] text-slate-400">Nomor Meja & Info Peserta</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Checkbox: Selected Only (if students are checked in table) */}
            {selectedSiswa.length > 0 && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="selectedOnlyCheck"
                  checked={printKartuModal.selectedOnly}
                  onChange={(e) => setPrintKartuModal(prev => ({ ...prev, selectedOnly: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
                <label htmlFor="selectedOnlyCheck" className="text-xs font-bold text-blue-900 dark:text-blue-200 cursor-pointer">
                  Hanya cetak {selectedSiswa.length} siswa yang ditandai di tabel
                </label>
              </div>
            )}

            {/* Filters (Hidden if selectedOnly is active) */}
            {!printKartuModal.selectedOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Filter Rombel / Kelas
                  </label>
                  <select
                    value={printKartuModal.filterKelas}
                    onChange={(e) => setPrintKartuModal(prev => ({ ...prev, filterKelas: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-900 dark:text-white"
                  >
                    <option value="ALL">Semua Kelas ({dataSiswa.length})</option>
                    {availableClasses.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Filter Ruang Ujian
                  </label>
                  <select
                    value={printKartuModal.filterRuang}
                    onChange={(e) => setPrintKartuModal(prev => ({ ...prev, filterRuang: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-900 dark:text-white"
                  >
                    <option value="ALL">Semua Ruangan</option>
                    {availableRooms.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="BELUM_ADA">Belum Ditentukan Ruang</option>
                  </select>
                </div>
              </div>
            )}

            {/* Sesi & Paper Size Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sesi Ujian
                </label>
                <select
                  value={printKartuModal.filterSesi}
                  onChange={(e) => setPrintKartuModal(prev => ({ ...prev, filterSesi: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-900 dark:text-white font-semibold"
                >
                  <option value="Sesi 1">Sesi 1 (Pagi)</option>
                  <option value="Sesi 2">Sesi 2 (Siang)</option>
                  <option value="Sesi 3">Sesi 3 (Sore)</option>
                  <option value="Sesi Khusus">Sesi Khusus</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ukuran Kertas
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintKartuModal(prev => ({ ...prev, paperSize: 'A4' }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                      printKartuModal.paperSize === 'A4'
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintKartuModal(prev => ({ ...prev, paperSize: 'F4' }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                      printKartuModal.paperSize === 'F4'
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    F4 (Folio)
                  </button>
                </div>
              </div>
            </div>

            {/* Password toggle for Kartu Peserta */}
            {printKartuModal.mode === 'peserta' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="showPasswordCheck"
                  checked={printKartuModal.showPassword}
                  onChange={(e) => setPrintKartuModal(prev => ({ ...prev, showPassword: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
                <label htmlFor="showPasswordCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Cetak password akun siswa secara jelas (clear-text)
                </label>
              </div>
            )}

            {/* Pengaturan Kop & Logo Dokumen */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">image</span>
                  Pengaturan Kop & Logo
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPrintKartuModal(prev => ({ ...prev, isOpen: false }));
                    navigateTab('pengaturan');
                  }}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">tune</span>
                  Atur di Menu Profil
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={kopSettings.show_logo_kiri !== false && (printKartuModal.mode === 'meja' ? kopSettings.kartu_meja_show_logo_kiri !== false : kopSettings.kartu_peserta_show_logo_kiri !== false)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setKopSettings(prev => ({
                        ...prev,
                        show_logo_kiri: checked ? true : prev.show_logo_kiri,
                        [printKartuModal.mode === 'meja' ? 'kartu_meja_show_logo_kiri' : 'kartu_peserta_show_logo_kiri']: checked
                      }));
                    }}
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Logo Kiri</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={kopSettings.show_logo_kanan !== false && (printKartuModal.mode === 'meja' ? kopSettings.kartu_meja_show_logo_kanan !== false : kopSettings.kartu_peserta_show_logo_kanan !== false)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setKopSettings(prev => ({
                        ...prev,
                        show_logo_kanan: checked ? true : prev.show_logo_kanan,
                        [printKartuModal.mode === 'meja' ? 'kartu_meja_show_logo_kanan' : 'kartu_peserta_show_logo_kanan']: checked
                      }));
                    }}
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Logo Kanan</span>
                </label>
              </div>

              {printKartuModal.mode === 'meja' && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-[11px] text-slate-500">Format Kop Meja:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setKopSettings(prev => ({ ...prev, kop_meja_mode: 'formal' }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        kopSettings.kop_meja_mode === 'formal'
                          ? 'bg-primary text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Formal
                    </button>
                    <button
                      type="button"
                      onClick={() => setKopSettings(prev => ({ ...prev, kop_meja_mode: 'minimalis' }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        kopSettings.kop_meja_mode === 'minimalis'
                          ? 'bg-primary text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Minimalis
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Kepala Sekolah & Tahun Ajaran Customizer */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nama Kepala Sekolah / TTD:
                </label>
                <input
                  type="text"
                  placeholder={kopSettings.kepala_sekolah || user.kepala_sekolah || 'Nama Kepala Sekolah'}
                  value={printKartuModal.namaKepalaSekolah}
                  onChange={(e) => setPrintKartuModal(prev => ({ ...prev, namaKepalaSekolah: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  NIP Kepala Sekolah:
                </label>
                <input
                  type="text"
                  placeholder={kopSettings.nip_kepala_sekolah || user.nip_kepala_sekolah || '-'}
                  value={printKartuModal.nipKepalaSekolah}
                  onChange={(e) => setPrintKartuModal(prev => ({ ...prev, nipKepalaSekolah: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Summary Indicator Card */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Target Cetak: {filteredCount} Siswa
                </div>
                <div className="text-[11px] text-slate-500">
                  Estimasi: {pageCount} Lembar Kertas {printKartuModal.paperSize} (8 kartu per lembar)
                </div>
              </div>
              <span className="material-symbols-outlined text-primary text-2xl">print</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setPrintKartuModal(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[40px]"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={filteredCount === 0}
              onClick={handleGeneratePrintKartu}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[40px]"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              <span>Buka Pratinjau & Cetak</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col lg:flex-row w-full selection:bg-primary/20 selection:text-primary-700">

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
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-black text-sm text-slate-800 dark:text-white leading-tight truncate">
                  {user.nama_sekolah || 'NEXA CBT'}
                </h1>
                <p className="text-[11px] font-bold text-primary dark:text-primary-400 truncate">
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
                        ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] shrink-0 ${isActive ? 'text-primary dark:text-primary-400' : ''}`}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
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
              className="w-9 h-9 rounded-lg overflow-hidden border border-primary/40 shrink-0 cursor-pointer"
              title="Ganti Avatar"
            >
              {user.foto_profil ? (
                <img src={user.foto_profil} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/15 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs">
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
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight truncate">
                Admin Sekolah
              </h1>
              <p className="text-[10px] text-primary dark:text-primary-400 font-bold uppercase tracking-wider truncate">
                NPSN: {user.npsn}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationBell role="admin" npsn={user?.npsn} user={user} />
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
            className="w-10 h-10 rounded-xl overflow-hidden border border-primary/40 p-0.5 cursor-pointer shrink-0"
          >
            {user.foto_profil ? (
              <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="w-full h-full bg-primary/15 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs rounded-lg">
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
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black">
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
                            ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-left'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xl shrink-0">{item.icon}</span>
                        <span className="truncate flex-1 text-left">{item.label}</span>
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
                  ? 'text-primary dark:text-primary-400'
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
            <NotificationBell role="admin" npsn={user?.npsn} user={user} />
            <div className="px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30 dark:border-primary/30 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse"></span>
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
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-primary/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
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
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-primary/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
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
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5 cursor-pointer hover:border-primary/50 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
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
                    className="text-xs font-bold text-primary dark:text-primary-400 hover:underline flex items-center gap-1"
                  >
                    Lihat Semua Jadwal <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {dataJadwal.filter(j => j.status_ujian === 'AKTIF').map((j) => (
                    <div
                      key={j.id_jadwal}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700/80 border-l-4 border-l-primary flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h5 className="font-bold text-sm text-slate-800 dark:text-white truncate">{j.nama_mapel}</h5>
                          <StatusBadge status="AKTIF" size="xs" pulse={true} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Guru: {j.guru || '-'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(j.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(j.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {' '}| Token: <strong className="font-mono text-primary dark:text-primary-400">{j.token || 'Menunggu'}</strong>
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <button
                          onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('monitoring'); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 hover:bg-primary/15 transition-colors"
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
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30/60 dark:border-primary/30">
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
                    type="button"
                    onClick={() => handleOpenPrintKartu('peserta')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary dark:text-primary-300 hover:bg-primary/20 transition-all border border-primary/20 min-h-[44px]"
                    title="Cetak Kartu Peserta Ujian & Kartu Meja"
                  >
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    <span className="hidden sm:inline">Cetak Kartu</span>
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50/40 dark:text-white transition-all"
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50/40 dark:text-white"
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
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2 w-10 text-center">#</th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-primary transition-colors"
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
                          className="py-3 px-4 cursor-pointer select-none hover:text-primary transition-colors"
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
                          className="py-3 px-4 cursor-pointer select-none hover:text-primary transition-colors"
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
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs shrink-0 border border-primary/30/60 dark:border-primary/30">
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
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors"
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
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer shrink-0 mr-0.5"
                        />
                        <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs shrink-0 border border-primary/30/60 dark:border-primary/30">
                          {s.nama_lengkap ? s.nama_lengkap.substring(0, 2).toUpperCase() : 'SW'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            <span className="font-mono">{s.nisn || '-'}</span> • <span className="font-semibold text-primary dark:text-primary-400">{s.kelas || '-'}</span>
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
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors"
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
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30 dark:border-primary/20">
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50/40 dark:text-white transition-all"
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50/40 dark:text-white"
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
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2 w-10 text-center">#</th>
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-primary transition-colors"
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
                          className="py-3 px-4 cursor-pointer select-none hover:text-primary transition-colors"
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
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20 dark:border-primary/20">
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
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors"
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
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer shrink-0 mr-0.5"
                        />
                        <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20 dark:border-primary/20">
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
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors"
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
                    type="button"
                    onClick={() => handleOpenPrintKartu('peserta')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary dark:text-primary-300 hover:bg-primary/20 transition-all border border-primary/20 min-h-[44px]"
                    title="Cetak Kartu Peserta Ujian"
                  >
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    <span className="hidden sm:inline">Cetak Kartu</span>
                  </button>
                  <button
                    onClick={() => openCreateModal('jadwal')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
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
                          ? 'bg-primary text-white shadow-xs'
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
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <select
                    value={filterMapel}
                    onChange={(e) => setFilterMapel(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-200 shrink-0"
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
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
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
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
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
                            <td className="py-3 px-4 font-mono font-bold text-primary dark:text-primary-400">
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
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 hover:bg-primary/15 transition-colors"
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
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
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
                                  type="button"
                                  onClick={() => handleOpenPrintKartu('peserta', j.target_kelas)}
                                  className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Cetak Kartu Peserta untuk Kelas Ini"
                                >
                                  <span className="material-symbols-outlined text-[18px]">badge</span>
                                </button>
                                <button
                                  onClick={() => openEditModal('jadwal', j)}
                                  className="p-1 text-primary hover:bg-primary/10 rounded-lg transition-colors"
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
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer shrink-0 mt-0.5 mr-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{j.nama_mapel}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Guru: {j.guru || '-'}</p>
                        </div>
                        <StatusBadge status={j.status_ujian} size="xs" pulse={j.status_ujian === 'AKTIF'} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <span>{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</span>
                        <span>Token: <strong className="font-mono text-primary dark:text-primary-400">#{j.token || '-'}</strong></span>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex-wrap">
                        {j.status_ujian === 'AKTIF' && (
                          <button
                            onClick={() => { setSelectedJadwal(j.id_jadwal); navigateTab('monitoring'); }}
                            className="px-3 py-1.5 bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary-400 rounded-xl text-xs font-bold"
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
                            className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold"
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
                          type="button"
                          onClick={() => handleOpenPrintKartu('peserta', j.target_kelas)}
                          className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="Cetak Kartu untuk Kelas Ini"
                        >
                          <span className="material-symbols-outlined text-[18px]">badge</span>
                        </button>
                        <button
                          onClick={() => openEditModal('jadwal', j)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
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

          {/* ================= TAB: PENGAWAS & RUANG UJIAN ================= */}
          {activeTab === 'pengawas' && (
            <div className="space-y-5 animate-fade-in-up">
              {/* Header Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">
                      Manajemen Pengawas & Ruang Ujian
                    </h3>
                    <StatusBadge variant="neutral" size="xs">
                      {pengawasSubTab === 'penugasan'
                        ? `${filteredPengawas.length} Tugas`
                        : pengawasSubTab === 'ruang'
                        ? `${filteredRuang.length} Ruang`
                        : `${dataSiswa.filter(s => s.ruang).length}/${dataSiswa.length} Siswa`}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Atur master ruang ujian, penugasan pengawas guru, dan alokasi ruangan siswa
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pengawasSubTab === 'penugasan' && (
                    <button
                      onClick={handleOpenAssignPengawasModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      <span>Tugaskan Pengawas</span>
                    </button>
                  )}
                  {pengawasSubTab === 'ruang' && (
                    <button
                      onClick={() => handleOpenRuangModal()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      <span>Tambah Ruang Baru</span>
                    </button>
                  )}
                  {pengawasSubTab === 'alokasi_siswa' && (
                    <button
                      onClick={() => fetchData('pengawas')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                      title="Segarkan Data"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      <span className="hidden sm:inline">Refresh Data</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Tab Navigation Pills */}
              <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-3 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setPengawasSubTab('penugasan')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                    pengawasSubTab === 'penugasan'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                  <span>Penugasan Pengawas</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    pengawasSubTab === 'penugasan' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {dataPengawasRuang.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPengawasSubTab('ruang')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                    pengawasSubTab === 'ruang'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                  <span>Master Ruang Ujian</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    pengawasSubTab === 'ruang' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {dataRuang.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPengawasSubTab('alokasi_siswa')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                    pengawasSubTab === 'alokasi_siswa'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">group_add</span>
                  <span>Alokasi Siswa</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    pengawasSubTab === 'alokasi_siswa' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {dataSiswa.filter(s => s.ruang).length} / {dataSiswa.length}
                  </span>
                </button>
              </div>

              {/* ================= SUB-TAB 1: PENUGASAN PENGAWAS ================= */}
              {pengawasSubTab === 'penugasan' && (
                <div className="space-y-4 animate-fade-in">
                  {/* 4 Metric KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">meeting_room</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 truncate">Total Ruang</p>
                        <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                          {pengawasMetrics.totalRuang}
                        </h4>
                        <span className="text-[10px] text-slate-500">Ruangan terdaftar</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">assignment_ind</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 truncate">Pengawas Ditugaskan</p>
                        <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                          {pengawasMetrics.totalPenugasan}
                        </h4>
                        <span className="text-[10px] text-slate-500">{pengawasMetrics.uniqueGuruCount} guru pengawas</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">check_circle</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 truncate">Ruang Terisi</p>
                        <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                          {pengawasMetrics.ruangTerisiCount} / {pengawasMetrics.totalRuang}
                        </h4>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {pengawasMetrics.totalRuang > 0 ? `${Math.round((pengawasMetrics.ruangTerisiCount / pengawasMetrics.totalRuang) * 100)}% terisi` : '0%'}
                        </span>
                      </div>
                    </div>

                    <div className={`bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border flex items-center gap-3.5 ${
                      pengawasMetrics.ruangBelumAdaPengawas > 0
                        ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20'
                        : 'border-slate-200/80 dark:border-slate-700/80'
                    }`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        pengawasMetrics.ruangBelumAdaPengawas > 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                      }`}>
                        <span className="material-symbols-outlined text-2xl">
                          {pengawasMetrics.ruangBelumAdaPengawas > 0 ? 'warning' : 'verified'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 truncate">Ruang Belum Ada Pengawas</p>
                        <h4 className={`text-xl sm:text-2xl font-black ${
                          pengawasMetrics.ruangBelumAdaPengawas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'
                        }`}>
                          {pengawasMetrics.ruangBelumAdaPengawas}
                        </h4>
                        <span className={`text-[10px] ${
                          pengawasMetrics.ruangBelumAdaPengawas > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500'
                        }`}>
                          {pengawasMetrics.ruangBelumAdaPengawas > 0 ? 'Perlu ditugaskan' : 'Semua ruang terisi'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                      {/* Filter by Jadwal */}
                      <div className="relative min-w-[220px]">
                        <select
                          value={filterRuangJadwal}
                          onChange={(e) => setFilterRuangJadwal(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8 cursor-pointer"
                        >
                          <option value="ALL">Semua Jadwal Ujian</option>
                          {dataJadwal.map(j => (
                            <option key={j.id_jadwal} value={j.id_jadwal}>
                              {j.mata_pelajaran?.nama_mapel || j.id_mapel} ({j.target_kelas || 'Semua Kelas'})
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                          expand_more
                        </span>
                      </div>

                      {/* Search Input */}
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                          search
                        </span>
                        <input
                          type="text"
                          value={searchPengawas}
                          onChange={(e) => setSearchPengawas(e.target.value)}
                          placeholder="Cari nama guru, NIP, atau nama ruangan..."
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {searchPengawas && (
                          <button
                            onClick={() => setSearchPengawas('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleOpenAssignPengawasModal}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Tugaskan Pengawas</span>
                    </button>
                  </div>

                  {/* List / Table of Assignments */}
                  {filteredPengawas.length === 0 ? (
                    <EmptyState
                      icon="badge"
                      title={dataPengawasRuang.length === 0 ? "Belum Ada Penugasan Pengawas" : "Tidak Ada Data yang Cocok"}
                      description={
                        dataPengawasRuang.length === 0
                          ? "Tugaskan guru untuk mengawasi ruang ujian tertentu agar guru dapat memantau dan memverifikasi kehadiran siswa."
                          : "Coba sesuaikan kata kunci pencarian atau filter jadwal ujian Anda."
                      }
                      actionText={dataPengawasRuang.length === 0 ? "+ Tugaskan Pengawas Pertama" : undefined}
                      onAction={dataPengawasRuang.length === 0 ? handleOpenAssignPengawasModal : undefined}
                    />
                  ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <tr>
                              <th className="p-3.5 pl-4 sm:pl-6">Ruang Ujian</th>
                              <th className="p-3.5">Guru Pengawas</th>
                              <th className="p-3.5">Jadwal / Sesi</th>
                              <th className="p-3.5 text-center">Peran</th>
                              <th className="p-3.5 text-center">Status</th>
                              <th className="p-3.5 pr-4 sm:pr-6 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredPengawas.map((p) => {
                              const guruFoto = p.guru?.foto || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.guru?.nama_lengkap || p.id_guru}`;
                              return (
                                <tr key={p.id_penugasan} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                                  {/* Room info */}
                                  <td className="p-3.5 pl-4 sm:pl-6">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-base">meeting_room</span>
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                          <span>{p.ruang?.nama_ruang || 'Ruang Tidak Diketahui'}</span>
                                          {p.ruang?.kode_ruang && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                              {p.ruang.kode_ruang}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[11px] text-slate-400">
                                          Kapasitas: {p.ruang?.kapasitas || 30} kursi
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Guru info */}
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={guruFoto}
                                        alt={p.guru?.nama_lengkap || 'Guru'}
                                        className="w-8 h-8 rounded-full object-cover bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 shrink-0"
                                        onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${p.id_guru}`; }}
                                      />
                                      <div>
                                        <div className="font-bold text-slate-800 dark:text-white">
                                          {p.guru?.nama_lengkap || 'Guru Pengawas'}
                                        </div>
                                        <div className="text-[11px] text-slate-400 font-mono">
                                          {p.guru?.nip ? `NIP. ${p.guru.nip}` : p.guru?.username ? `@${p.guru.username}` : '-'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Jadwal info */}
                                  <td className="p-3.5">
                                    {p.id_jadwal && p.jadwal ? (
                                      <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 block">
                                          {p.jadwal.mata_pelajaran?.nama_mapel || p.jadwal.id_mapel || 'Jadwal Terdaftar'}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                          Kelas: {p.jadwal.target_kelas || 'Semua'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs italic">
                                        <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                                        Semua Jadwal di Ruangan Ini
                                      </span>
                                    )}
                                  </td>

                                  {/* Peran badge */}
                                  <td className="p-3.5 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                      p.peran === 'PROKTOR'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                        : p.peran === 'PENGAWAS CADANGAN'
                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        : 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300'
                                    }`}>
                                      {p.peran || 'PENGAWAS UTAMA'}
                                    </span>
                                  </td>

                                  {/* Status */}
                                  <td className="p-3.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      {p.status_tugas || 'AKTIF'}
                                    </span>
                                  </td>

                                  {/* Action */}
                                  <td className="p-3.5 pr-4 sm:pr-6 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAssignPengawas(p)}
                                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                      title="Hapus Penugasan"
                                    >
                                      <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= SUB-TAB 2: MASTER RUANG UJIAN ================= */}
              {pengawasSubTab === 'ruang' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Header & Search */}
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                        search
                      </span>
                      <input
                        type="text"
                        value={searchRuang}
                        onChange={(e) => setSearchRuang(e.target.value)}
                        placeholder="Cari nama ruang, kode ruang, atau keterangan..."
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {searchRuang && (
                        <button
                          onClick={() => setSearchRuang('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleOpenRuangModal()}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Tambah Ruang</span>
                    </button>
                  </div>

                  {/* Room Cards Grid */}
                  {filteredRuang.length === 0 ? (
                    <EmptyState
                      icon="meeting_room"
                      title={dataRuang.length === 0 ? "Belum Ada Ruang Ujian" : "Tidak Ada Ruang yang Cocok"}
                      description={
                        dataRuang.length === 0
                          ? "Tambahkan master ruangan ujian seperti 'Ruang 01' atau 'Lab Komputer' untuk mengalokasikan siswa dan menugaskan guru pengawas."
                          : "Coba gunakan kata kunci pencarian yang lain."
                      }
                      actionText={dataRuang.length === 0 ? "+ Tambah Ruang Sekarang" : undefined}
                      onAction={dataRuang.length === 0 ? () => handleOpenRuangModal() : undefined}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredRuang.map((r) => {
                        const siswaInRoom = dataSiswa.filter(s => s.ruang === r.nama_ruang || s.ruang === r.id_ruang);
                        const pengawasInRoom = dataPengawasRuang.filter(p => p.id_ruang === r.id_ruang);
                        const kapasitasNum = Number(r.kapasitas) || 30;
                        const fillPercent = Math.min(100, Math.round((siswaInRoom.length / kapasitasNum) * 100));

                        return (
                          <div
                            key={r.id_ruang}
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-4 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
                          >
                            <div>
                              {/* Top Bar: Icon, Name & Code */}
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">meeting_room</span>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-base">
                                      {r.nama_ruang}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {r.kode_ruang && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                          {r.kode_ruang}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-slate-400">
                                        Kapasitas: {kapasitasNum} kursi
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenRuangModal(r)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="Edit Ruangan"
                                  >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRuang(r)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                    title="Hapus Ruangan"
                                  >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                  </button>
                                </div>
                              </div>

                              {/* Capacity & Allocation Progress */}
                              <div className="space-y-1.5 my-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">Siswa Teralokasi:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {siswaInRoom.length} / {kapasitasNum}
                                    <span className="text-[10px] font-normal text-slate-400 ml-1">({fillPercent}%)</span>
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      fillPercent > 100
                                        ? 'bg-rose-500'
                                        : fillPercent >= 80
                                        ? 'bg-amber-500'
                                        : 'bg-primary'
                                    }`}
                                    style={{ width: `${Math.min(100, fillPercent)}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Pengawas Assigned */}
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-2">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm text-slate-400">badge</span>
                                  <span>Pengawas Ditugaskan:</span>
                                </span>
                                <span className={`font-bold ${pengawasInRoom.length > 0 ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}`}>
                                  {pengawasInRoom.length > 0 ? `${pengawasInRoom.length} Guru` : 'Belum Ada'}
                                </span>
                              </div>

                              {r.keterangan && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic line-clamp-2 mt-1">
                                  &quot;{r.keterangan}&quot;
                                </p>
                              )}
                            </div>

                            {/* Card Footer: Quick action to assign proctor */}
                            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                              <button
                                onClick={() => {
                                  setAssignPengawasForm({
                                    id_ruang: r.id_ruang,
                                    id_guru: dataGuru[0]?.id_guru || '',
                                    id_jadwal: '',
                                    peran: 'PENGAWAS UTAMA'
                                  });
                                  setIsAssignPengawasModalOpen(true);
                                }}
                                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">person_add</span>
                                <span>+ Tugaskan Guru</span>
                              </button>

                              <button
                                onClick={() => {
                                  setTargetRuangAlokasi(r.nama_ruang);
                                  setFilterAlokasiRuang('ALL');
                                  setPengawasSubTab('alokasi_siswa');
                                }}
                                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
                              >
                                <span>Alokasi Siswa</span>
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================= SUB-TAB 3: ALOKASI SISWA KE RUANGAN ================= */}
              {pengawasSubTab === 'alokasi_siswa' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Allocation Operations Card */}
                  <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/80">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">groups</span>
                          Distribusi Ruangan Siswa
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Tentukan ruang ujian bagi siswa secara cepat per Rombel/Kelas atau tandai siswa terpilih
                        </p>
                      </div>

                      {/* Room Stats Pill */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary dark:text-primary-400">
                          {dataSiswa.filter(s => s.ruang).length} Siswa Terbagi
                        </span>
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          {dataSiswa.filter(s => !s.ruang).length} Belum Ada Ruang
                        </span>
                      </div>
                    </div>

                    {/* Step 1: Target Room Selector */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">1</span>
                        <span>Pilih Ruangan Ujian Tujuan</span>
                      </label>
                      {dataRuang.length === 0 ? (
                        <div className="text-xs text-rose-500 flex items-center justify-between">
                          <span>Belum ada ruang terdaftar. Silakan buat ruang ujian terlebih dahulu.</span>
                          <button
                            type="button"
                            onClick={() => { setPengawasSubTab('ruang'); handleOpenRuangModal(); }}
                            className="font-bold underline text-primary ml-2"
                          >
                            + Tambah Ruang
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {dataRuang.map(r => {
                            const countInRoom = dataSiswa.filter(s => s.ruang === r.nama_ruang || s.ruang === r.id_ruang).length;
                            const isSelected = targetRuangAlokasi === r.nama_ruang;
                            return (
                              <button
                                key={r.id_ruang}
                                type="button"
                                onClick={() => setTargetRuangAlokasi(r.nama_ruang)}
                                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 dark:bg-primary/20 dark:text-primary-300'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-xs truncate">{r.nama_ruang}</div>
                                  <div className="text-[10px] text-slate-400">
                                    Kapasitas: {r.kapasitas} kursi
                                  </div>
                                </div>
                                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                  countInRoom >= r.kapasitas
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {countInRoom}/{r.kapasitas}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Step 2: Allocation Execution Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Option A: Bulk by Class */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center font-bold">2A</span>
                            <h5 className="font-bold text-xs text-slate-800 dark:text-white">Alokasi Cepat per Rombel / Kelas</h5>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                            Semua siswa dalam satu kelas langsung ditetapkan ke ruangan sasaran di atas.
                          </p>

                          <div className="space-y-2 mb-3">
                            <select
                              value={selectedKelasAlokasi}
                              onChange={(e) => setSelectedKelasAlokasi(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 dark:bg-slate-900 text-xs text-slate-700 dark:text-white"
                            >
                              <option value="">-- Pilih Kelas / Rombel --</option>
                              {availableAlokasiClasses.map(k => {
                                const countInClass = dataSiswa.filter(s => (s.kelas || `${s.angkatan || ''} ${s.kelas_paralel || ''}`).trim() === k).length;
                                return (
                                  <option key={k} value={k}>
                                    {k} ({countInClass} Siswa)
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleBulkAssignByClass}
                          disabled={!targetRuangAlokasi || !selectedKelasAlokasi || isLoading}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                          <span>Tetapkan Seluruh Siswa Kelas Ini</span>
                        </button>
                      </div>

                      {/* Option B: Bulk Selected Students */}
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center font-bold">2B</span>
                            <h5 className="font-bold text-xs text-slate-800 dark:text-white">Alokasi Siswa Tertentu (Multi-Select)</h5>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                            Centang satu atau beberapa siswa pada tabel di bawah lalu tetapkan ke ruangan sasaran.
                          </p>

                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs flex items-center justify-between mb-3">
                            <span className="text-slate-500">Siswa Dipilih di Tabel:</span>
                            <span className="font-bold text-primary dark:text-primary-400">
                              {selectedAlokasiSiswa.length} Siswa
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleBulkAssignSelectedSiswa}
                          disabled={!targetRuangAlokasi || selectedAlokasiSiswa.length === 0 || isLoading}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_box</span>
                          <span>Tugaskan {selectedAlokasiSiswa.length} Siswa Terpilih</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Student Table & Filters */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden space-y-3 p-4">
                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        {/* Search Input */}
                        <div className="relative min-w-[200px] flex-1">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                            search
                          </span>
                          <input
                            type="text"
                            value={searchAlokasiSiswa}
                            onChange={(e) => setSearchAlokasiSiswa(e.target.value)}
                            placeholder="Cari siswa (nama/NISN)..."
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        {/* Filter by Kelas */}
                        <div className="relative">
                          <select
                            value={filterAlokasiKelas}
                            onChange={(e) => setFilterAlokasiKelas(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          >
                            <option value="ALL">Semua Kelas</option>
                            {availableAlokasiClasses.map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>

                        {/* Filter by Ruang */}
                        <div className="relative">
                          <select
                            value={filterAlokasiRuang}
                            onChange={(e) => setFilterAlokasiRuang(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          >
                            <option value="ALL">Semua Status Ruang</option>
                            <option value="BELUM">Belum Ada Ruang</option>
                            {dataRuang.map(r => (
                              <option key={r.id_ruang} value={r.nama_ruang}>{r.nama_ruang}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Select All / Deselect All Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedAlokasiSiswa.length === filteredAlokasiSiswa.length) {
                              setSelectedAlokasiSiswa([]);
                            } else {
                              setSelectedAlokasiSiswa(filteredAlokasiSiswa.map(s => s.id_siswa));
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {selectedAlokasiSiswa.length === filteredAlokasiSiswa.length && filteredAlokasiSiswa.length > 0
                            ? 'Batal Pilih Semua'
                            : 'Pilih Semua di Filter'}
                        </button>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700/80">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="p-3 pl-4 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={filteredAlokasiSiswa.length > 0 && selectedAlokasiSiswa.length === filteredAlokasiSiswa.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAlokasiSiswa(filteredAlokasiSiswa.map(s => s.id_siswa));
                                  } else {
                                    setSelectedAlokasiSiswa([]);
                                  }
                                }}
                                className="rounded text-primary focus:ring-primary"
                              />
                            </th>
                            <th className="p-3">Nama Siswa</th>
                            <th className="p-3">NISN / Username</th>
                            <th className="p-3">Kelas</th>
                            <th className="p-3">Ruang Ujian Saat Ini</th>
                            <th className="p-3 pr-4 text-right">Tugaskan Ruang Cepat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {filteredAlokasiSiswa.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="p-8 text-center text-slate-400">
                                Tidak ada siswa yang sesuai dengan filter.
                              </td>
                            </tr>
                          ) : (
                            filteredAlokasiSiswa.map((s) => {
                              const isChecked = selectedAlokasiSiswa.includes(s.id_siswa);
                              return (
                                <tr
                                  key={s.id_siswa}
                                  className={`transition-colors ${
                                    isChecked ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
                                  }`}
                                >
                                  <td className="p-3 pl-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedAlokasiSiswa(prev => prev.filter(id => id !== s.id_siswa));
                                        } else {
                                          setSelectedAlokasiSiswa(prev => [...prev, s.id_siswa]);
                                        }
                                      }}
                                      className="rounded text-primary focus:ring-primary"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <span className="font-bold text-slate-800 dark:text-white block">
                                      {s.nama_lengkap}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                                    {s.nisn || s.username || '-'}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                      {s.kelas || `${s.angkatan || ''} ${s.kelas_paralel || ''}`.trim() || '-'}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    {s.ruang ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300 border border-primary/20">
                                        <span className="material-symbols-outlined text-[14px]">meeting_room</span>
                                        {s.ruang}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40">
                                        <span className="material-symbols-outlined text-[13px]">help</span>
                                        Belum Diatur
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 pr-4 text-right">
                                    <select
                                      value={s.ruang || ''}
                                      onChange={(e) => handleSingleAssignSiswaRuang(s.id_siswa, e.target.value)}
                                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px]"
                                    >
                                      <option value="">-- Pindah Ruang --</option>
                                      {dataRuang.map(r => (
                                        <option key={r.id_ruang} value={r.nama_ruang}>
                                          {r.nama_ruang}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
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
                    className="flex-1 md:flex-none px-3.5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm min-h-[44px]"
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
                          isAktif ? 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary-400' :
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
                            className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all min-h-[44px]"
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
                      <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl animate-pulse">timer</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Sedang Ujian</p>
                        <h4 className="text-2xl font-black text-primary dark:text-primary-400">{monitoringMetrics.mengerjakan}</h4>
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
                              ? 'bg-primary text-white shadow-xs'
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
                                        <span className={p.is_blocked ? 'text-rose-500 font-bold' : p.status_ujian === 'SELESAI' ? 'text-sky-600 font-bold' : 'text-primary font-bold'}>
                                          {progressPercent}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            p.is_blocked ? 'bg-rose-500' :
                                            p.status_ujian === 'SELESAI' ? 'bg-sky-500' :
                                            'bg-primary-400'
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
                                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 hover:bg-primary/15 transition-colors"
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
                                <span className="font-bold text-primary dark:text-primary-400">{progressPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    p.is_blocked ? 'bg-rose-500' : p.status_ujian === 'SELESAI' ? 'bg-sky-500' : 'bg-primary-400'
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
                                  className="px-3 py-1.5 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 rounded-xl text-xs font-bold"
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
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 min-h-[44px]"
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
                      <div className="font-black text-xl text-primary dark:text-primary-400">
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
                <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                  <button
                    onClick={() => setImportModal({ isOpen: true, type: 'mapel' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Import Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => openCreateModal('mapel')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Tambah Mapel</span>
                  </button>
                </div>
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
                      <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">menu_book</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">{m.nama_mapel}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.alokasi_kelas && m.alokasi_kelas !== 'Semua Kelas'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {m.alokasi_kelas || 'Semua Kelas'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{m.jumlah_soal || 0} Soal Tersedia</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal('mapel', m)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 dark:hover:bg-primary/10"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 self-end sm:self-auto min-h-[44px]"
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
                      <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
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
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 dark:hover:bg-primary/10"
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

          {/* ================= TAB: SKEMA PENILAIAN DEFAULT SEKOLAH ================= */}
          {activeTab === 'skema' && (
            <div className="space-y-6 animate-fade-in-up max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary dark:text-primary-400">tune</span>
                    <span>Skema Penilaian Default Sekolah</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Konfigurasikan acuan standar bobot penilaian ujian yang berlaku untuk seluruh guru dan mata pelajaran di sekolah.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary dark:text-primary-400 border border-primary/20">
                    NPSN: {user?.npsn}
                  </span>
                </div>
              </div>

              {skemaSuccessMsg && (
                <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 flex items-center gap-3 text-xs sm:text-sm text-sky-800 dark:text-sky-200 animate-fade-in">
                  <span className="material-symbols-outlined text-primary dark:text-primary-400 text-xl shrink-0">check_circle</span>
                  <span className="font-semibold">{skemaSuccessMsg}</span>
                </div>
              )}

              {isSkemaLoading ? (
                <div className="p-12 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-4xl animate-spin text-primary mb-3">progress_activity</span>
                  <span className="text-xs sm:text-sm text-slate-500">Memuat konfigurasi skema penilaian default sekolah...</span>
                </div>
              ) : (
                <SkemaPenilaianPanel
                  isSchoolDefault={true}
                  initialSkema={defaultSkemaSekolah}
                  onSave={handleSaveDefaultSkema}
                />
              )}
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
                        <div className="font-semibold text-primary dark:text-primary-400 flex items-center gap-1">
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
                    <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0 mt-0.5">
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

          {/* ================= TAB PENGATURAN / PROFIL SEKOLAH ================= */}
          {activeTab === 'pengaturan' && (
            <div className="space-y-6 animate-fade-in-up pb-12">
              {/* Header Title & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-2xl">settings</span>
                    Pengaturan & Profil Sekolah
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelola data identitas sekolah, logo kop (Dinas & Sekolah), serta konfigurasi cetak Kartu Peserta dan Kartu Meja
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSavingKop}
                  onClick={() => handleSaveKopSettings()}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>{isSavingKop ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>

              {/* Success / Error Alerts */}
              {kopSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5 animate-fade-in">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">check_circle</span>
                  <span className="text-xs sm:text-sm font-semibold">{kopSuccessMsg}</span>
                </div>
              )}
              {kopErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2.5 animate-fade-in">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-xl">error</span>
                  <span className="text-xs sm:text-sm font-semibold">{kopErrorMsg}</span>
                </div>
              )}

              {/* CARD 1: Identitas & Data Pokok Sekolah */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/80">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">domain</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Identitas Sekolah</h4>
                    <p className="text-[11px] text-slate-500">Informasi nama sekolah, NPSN, dan pimpinan</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Nama Sekolah / Lembaga
                    </label>
                    <input
                      type="text"
                      value={kopSettings.nama_sekolah || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, nama_sekolah: e.target.value }))}
                      placeholder="Contoh: SMA NEGERI 1 INDONESIA"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      NPSN (Nomor Pokok Sekolah Nasional)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.npsn !== undefined ? kopSettings.npsn : (user.npsn || '')}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, npsn: e.target.value }))}
                      placeholder="NPSN Sekolah"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Alamat Sekolah / Instansi
                    </label>
                    <input
                      type="text"
                      value={kopSettings.alamat_sekolah || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, alamat_sekolah: e.target.value }))}
                      placeholder="Jalan, Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Nama Kepala Sekolah / Penanggung Jawab
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kepala_sekolah || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kepala_sekolah: e.target.value }))}
                      placeholder="Nama lengkap beserta gelar"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={kopSettings.nip_kepala_sekolah || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, nip_kepala_sekolah: e.target.value }))}
                      placeholder="NIP Kepala Sekolah (atau strip - jika tidak ada)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 2: Pengaturan Logo Kiri & Logo Kanan */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/80">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">image</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Pengaturan Logo Kop (Kiri & Kanan)</h4>
                    <p className="text-[11px] text-slate-500">Unggah berkas logo langsung dari perangkat Anda dan atur visibilitas pada kop</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left Logo Card: Dinas / Pemda */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Logo Kiri (Dinas / Pemda / Lembaga)
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          kopSettings.show_logo_kiri
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {kopSettings.show_logo_kiri ? 'Aktif' : 'Disembunyikan'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Posisi di sisi kiri kop pada dokumen cetak kartu.
                      </p>
                    </div>

                    {/* Logo Preview */}
                    <div className="flex items-center justify-center py-2">
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center p-2.5 overflow-hidden shadow-2xs">
                        {kopSettings.logo_kiri ? (
                          <img src={kopSettings.logo_kiri} alt="Logo Kiri Preview" className="w-full h-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center text-center">
                            <svg className="w-12 h-12 object-contain text-slate-800 dark:text-slate-200" viewBox="0 0 100 100" fill="none">
                              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" fill="#f8fafc" />
                              <polygon points="50,15 80,45 68,85 32,85 20,45" stroke="currentColor" strokeWidth="4" fill="#fbbf24" />
                            </svg>
                            <span className="text-[9px] text-slate-400 mt-1">Default SVG</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload & Reset Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id="file_input_logo_kiri"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadLogoKiri}
                        />
                        <label
                          htmlFor="file_input_logo_kiri"
                          className="flex-1 cursor-pointer px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px]">upload_file</span>
                          <span>{kopSettings.logo_kiri ? 'Ganti Berkas Logo' : 'Pilih Berkas Logo'}</span>
                        </label>

                        {kopSettings.logo_kiri && (
                          <button
                            type="button"
                            onClick={handleResetLogoKiri}
                            className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 dark:bg-slate-700 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Hapus Logo Kiri & Kembali ke Default"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            <span>Reset</span>
                          </button>
                        )}
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={kopSettings.show_logo_kiri !== false}
                          onChange={(e) => setKopSettings(prev => ({ ...prev, show_logo_kiri: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                        />
                        <span>Tampilkan Logo Kiri pada Kop Dokumen</span>
                      </label>
                    </div>
                  </div>

                  {/* Right Logo Card: Sekolah / Yayasan */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Logo Kanan (Sekolah / Yayasan)
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          kopSettings.show_logo_kanan
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {kopSettings.show_logo_kanan ? 'Aktif' : 'Disembunyikan'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Posisi di sisi kanan kop pada dokumen cetak kartu.
                      </p>
                    </div>

                    {/* Logo Preview */}
                    <div className="flex items-center justify-center py-2">
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center p-2.5 overflow-hidden shadow-2xs">
                        {kopSettings.logo_kanan ? (
                          <img src={kopSettings.logo_kanan} alt="Logo Kanan Preview" className="w-full h-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center text-center">
                            <svg className="w-12 h-12 object-contain text-slate-800 dark:text-slate-200" viewBox="0 0 100 100" fill="none">
                              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" fill="#f8fafc" />
                              <polygon points="50,20 75,45 65,80 35,80 25,45" stroke="currentColor" strokeWidth="4" fill="#e2e8f0" />
                              <circle cx="50" cy="50" r="12" fill="#0f172a" />
                            </svg>
                            <span className="text-[9px] text-slate-400 mt-1">Default SVG</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload & Reset Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id="file_input_logo_kanan"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadLogoKanan}
                        />
                        <label
                          htmlFor="file_input_logo_kanan"
                          className="flex-1 cursor-pointer px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px]">upload_file</span>
                          <span>{kopSettings.logo_kanan ? 'Ganti Berkas Logo' : 'Pilih Berkas Logo'}</span>
                        </label>

                        {kopSettings.logo_kanan && (
                          <button
                            type="button"
                            onClick={handleResetLogoKanan}
                            className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 dark:bg-slate-700 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Hapus Logo Kanan & Kembali ke Default"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            <span>Reset</span>
                          </button>
                        )}
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={kopSettings.show_logo_kanan !== false}
                          onChange={(e) => setKopSettings(prev => ({ ...prev, show_logo_kanan: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                        />
                        <span>Tampilkan Logo Kanan pada Kop Dokumen</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: Konfigurasi Kop Kartu Peserta Ujian */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/80">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">badge</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Konfigurasi Kop Kartu Peserta</h4>
                    <p className="text-[11px] text-slate-500">Atur teks baris 1, 2, 3, dan penggunaan logo khusus Kartu Peserta Ujian</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Kop Baris 1 (Pemerintah / Instansi / Yayasan)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kop_baris1 || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kop_baris1: e.target.value }))}
                      placeholder="Contoh: PEMERINTAH PROVINSI / DAERAH"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Kop Baris 2 (Nama Satuan Pendidikan)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kop_baris2 !== undefined ? kopSettings.kop_baris2 : (kopSettings.nama_sekolah || user.nama_sekolah || '')}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kop_baris2: e.target.value }))}
                      placeholder="Nama Sekolah"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Kop Baris 3 (Judul Dokumen Kartu)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kop_baris3 || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kop_baris3: e.target.value }))}
                      placeholder="KARTU PESERTA ASESMEN / CBT"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white font-semibold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Kop Baris 4 (Sub-keterangan / Info Tambahan)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kop_baris4 || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kop_baris4: e.target.value }))}
                      placeholder={`NPSN: ${kopSettings.npsn || user.npsn || '-'} • TP 2026/2027`}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Logo Toggles for Kartu Peserta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/80">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={kopSettings.kartu_peserta_show_logo_kiri !== false}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kartu_peserta_show_logo_kiri: e.target.checked }))}
                      className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Gunakan Logo Kiri pada Kartu Peserta</div>
                      <div className="text-[10px] text-slate-400">Tampilkan logo dinas/lembaga di sebelah kiri kop</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={kopSettings.kartu_peserta_show_logo_kanan !== false}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kartu_peserta_show_logo_kanan: e.target.checked }))}
                      className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Gunakan Logo Kanan pada Kartu Peserta</div>
                      <div className="text-[10px] text-slate-400">Tampilkan logo sekolah/yayasan di sebelah kanan kop</div>
                    </div>
                  </label>
                </div>

                {/* Live Preview Kop Kartu Peserta */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Pratinjau Kop Kartu Peserta:
                  </label>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 max-w-md mx-auto shadow-xs text-black dark:text-white">
                    <div className="border-b border-black dark:border-slate-400 pb-1.5 flex items-center justify-between gap-2">
                      {kopSettings.kartu_peserta_show_logo_kiri !== false && kopSettings.show_logo_kiri !== false && (
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                          {kopSettings.logo_kiri ? (
                            <img src={kopSettings.logo_kiri} alt="Logo" className="w-8 h-8 object-contain" />
                          ) : (
                            <svg className="w-8 h-8 object-contain text-slate-900 dark:text-slate-100" viewBox="0 0 100 100" fill="none">
                              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" fill="#f8fafc" />
                              <polygon points="50,15 80,45 68,85 32,85 20,45" stroke="currentColor" strokeWidth="4" fill="#fbbf24" />
                            </svg>
                          )}
                        </div>
                      )}

                      <div className="flex-1 text-center min-w-0 px-1">
                        {kopSettings.kop_baris1 && (
                          <div className="text-[8px] font-bold uppercase tracking-tight truncate text-slate-500 dark:text-slate-400 leading-none mb-0.5">
                            {kopSettings.kop_baris1}
                          </div>
                        )}
                        <div className="text-[10px] font-black uppercase tracking-tight truncate text-slate-950 dark:text-white leading-tight">
                          {kopSettings.kop_baris2 || kopSettings.nama_sekolah || user.nama_sekolah || 'SEKOLAH INDONESIA'}
                        </div>
                        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 leading-tight">
                          {kopSettings.kop_baris3 || 'KARTU PESERTA ASESMEN / CBT'}
                        </div>
                        {kopSettings.kop_baris4 ? (
                          <div className="text-[7.5px] text-slate-500 leading-none mt-0.5 truncate">
                            {kopSettings.kop_baris4}
                          </div>
                        ) : kopSettings.kop_baris4 === undefined ? (
                          <div className="text-[7.5px] text-slate-500 leading-none mt-0.5 truncate">
                            {`NPSN: ${kopSettings.npsn || user.npsn || '-'} • TP 2026/2027`}
                          </div>
                        ) : null}
                      </div>

                      {kopSettings.kartu_peserta_show_logo_kanan !== false && kopSettings.show_logo_kanan !== false && (
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                          {kopSettings.logo_kanan ? (
                            <img src={kopSettings.logo_kanan} alt="Logo" className="w-8 h-8 object-contain" />
                          ) : (
                            <svg className="w-8 h-8 object-contain text-slate-900 dark:text-slate-100" viewBox="0 0 100 100" fill="none">
                              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" fill="#f8fafc" />
                              <polygon points="50,20 75,45 65,80 35,80 25,45" stroke="currentColor" strokeWidth="4" fill="#e2e8f0" />
                              <circle cx="50" cy="50" r="12" fill="#0f172a" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 4: Konfigurasi Kop Kartu Meja Ujian */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/80">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">table_restaurant</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Konfigurasi Kop Kartu Meja</h4>
                    <p className="text-[11px] text-slate-500">Pilih mode tampilan kop (formal/minimalis) dan pengaturan logo kartu meja</p>
                  </div>
                </div>

                {/* Mode Selector: Formal vs Minimalis */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mode Desain Kop Kartu Meja
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setKopSettings(prev => ({ ...prev, kop_meja_mode: 'formal' }))}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        kopSettings.kop_meja_mode === 'formal'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">view_compact</span>
                      <div>
                        <div className="text-xs font-bold">Format Formal</div>
                        <div className="text-[10px] text-slate-400">Kop lengkap dengan logo</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKopSettings(prev => ({ ...prev, kop_meja_mode: 'minimalis' }))}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        kopSettings.kop_meja_mode === 'minimalis'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">density_small</span>
                      <div>
                        <div className="text-xs font-bold">Format Minimalis</div>
                        <div className="text-[10px] text-slate-400">Ringkas & tanpa logo</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Kop Baris 1 (Nama Sekolah / Lembaga)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kop_meja_baris1 !== undefined ? kopSettings.kop_meja_baris1 : (kopSettings.nama_sekolah || user.nama_sekolah || '')}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kop_meja_baris1: e.target.value }))}
                      placeholder="Nama Sekolah"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white uppercase font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Kop Baris 2 (Sub-judul Kartu Meja)
                    </label>
                    <input
                      type="text"
                      value={kopSettings.kop_meja_baris2 || ''}
                      onChange={(e) => setKopSettings(prev => ({ ...prev, kop_meja_baris2: e.target.value }))}
                      placeholder="KARTU MEJA UJIAN CBT • TP 2026/2027"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 dark:text-white uppercase font-semibold"
                    />
                  </div>
                </div>

                {/* Logo Toggles for Kartu Meja */}
                {kopSettings.kop_meja_mode === 'formal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/80">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={kopSettings.kartu_meja_show_logo_kiri !== false}
                        onChange={(e) => setKopSettings(prev => ({ ...prev, kartu_meja_show_logo_kiri: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Tampilkan Logo Kiri pada Kartu Meja</div>
                        <div className="text-[10px] text-slate-400">Logo dinas/pemda di sebelah kiri judul meja</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={kopSettings.kartu_meja_show_logo_kanan !== false}
                        onChange={(e) => setKopSettings(prev => ({ ...prev, kartu_meja_show_logo_kanan: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Tampilkan Logo Kanan pada Kartu Meja</div>
                        <div className="text-[10px] text-slate-400">Logo sekolah/yayasan di dekat nomor meja</div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Live Preview Kop Kartu Meja */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Pratinjau Kop Kartu Meja (Nomor Meja Tetap Jelas Terbaca):
                  </label>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 max-w-md mx-auto shadow-xs text-black dark:text-white">
                    <div className="border-b border-black dark:border-slate-400 pb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {kopSettings.kop_meja_mode === 'formal' && kopSettings.kartu_meja_show_logo_kiri !== false && kopSettings.show_logo_kiri !== false && (
                          <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                            {kopSettings.logo_kiri ? (
                              <img src={kopSettings.logo_kiri} alt="Logo" className="w-7 h-7 object-contain" />
                            ) : (
                              <svg className="w-7 h-7 object-contain text-slate-900 dark:text-slate-100" viewBox="0 0 100 100" fill="none">
                                <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" fill="#f8fafc" />
                                <polygon points="50,15 80,45 68,85 32,85 20,45" stroke="currentColor" strokeWidth="4" fill="#fbbf24" />
                              </svg>
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black uppercase tracking-tight truncate text-slate-900 dark:text-white leading-tight">
                            {kopSettings.kop_meja_baris1 || kopSettings.nama_sekolah || user.nama_sekolah || 'SEKOLAH INDONESIA'}
                          </div>
                          {kopSettings.kop_meja_baris2 ? (
                            <div className="text-[8px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate leading-tight">
                              {kopSettings.kop_meja_baris2}
                            </div>
                          ) : kopSettings.kop_meja_baris2 === undefined ? (
                            <div className="text-[8px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate leading-tight">
                              KARTU MEJA UJIAN CBT • TP 2026/2027
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {kopSettings.kop_meja_mode === 'formal' && kopSettings.kartu_meja_show_logo_kanan !== false && kopSettings.show_logo_kanan !== false && (
                          <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                            {kopSettings.logo_kanan ? (
                              <img src={kopSettings.logo_kanan} alt="Logo" className="w-7 h-7 object-contain" />
                            ) : (
                              <svg className="w-7 h-7 object-contain text-slate-900 dark:text-slate-100" viewBox="0 0 100 100" fill="none">
                                <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" fill="#f8fafc" />
                                <polygon points="50,20 75,45 65,80 35,80 25,45" stroke="currentColor" strokeWidth="4" fill="#e2e8f0" />
                                <circle cx="50" cy="50" r="12" fill="#0f172a" />
                              </svg>
                            )}
                          </div>
                        )}
                        <div className="bg-slate-900 text-white font-mono font-black text-xs px-2.5 py-1 rounded shadow-xs">
                          MEJA 01
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Save Bar */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isSavingKop}
                  onClick={() => handleSaveKopSettings()}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 min-h-[48px]"
                >
                  <span className="material-symbols-outlined text-xl">save</span>
                  <span>{isSavingKop ? 'Menyimpan Perubahan...' : 'Simpan Pengaturan Sekolah'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 12: PROFIL ADMIN ================= */}
          {activeTab === 'akun' && (
            <div className="max-w-md mx-auto py-6 animate-fade-in-up flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                <div className="w-24 h-24 bg-primary/10 dark:bg-primary/10 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-white dark:border-slate-800 shadow-md">
                  {user.foto_profil ? (
                    <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-primary">admin_panel_settings</span>
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
                    <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-primary dark:text-primary-400">
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
                  onClick={() => navigateTab('pengaturan')}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-200/80 dark:border-slate-700/80 shadow-sm active:scale-95 transition-all min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-primary dark:text-primary-400">
                      <span className="material-symbols-outlined text-xl">settings</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">Pengaturan / Profil Sekolah</h4>
                      <p className="text-xs text-slate-500">Logo kop dinas & sekolah, konfigurasi kartu ujian</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </button>

                <button
                  onClick={() => navigateTab('logs')}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-200/80 dark:border-slate-700/80 shadow-sm active:scale-95 transition-all min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-primary dark:text-primary-400">
                      <span className="material-symbols-outlined text-xl">history</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">Log Aktivitas</h4>
                      <p className="text-xs text-slate-500">Riwayat jejak aksi sistem</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </button>

                <button
                  onClick={() => navigateTab('skema')}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-200/80 dark:border-slate-700/80 shadow-sm active:scale-95 transition-all min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-primary dark:text-primary-400">
                      <span className="material-symbols-outlined text-xl">tune</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">Atur Skema Penilaian Default</h4>
                      <p className="text-xs text-slate-500">Format bobot penilaian acuan sekolah</p>
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
      {renderAssignPengawasModal()}
      {renderRuangModal()}
      {renderPrintKartuModal()}

      {/* Kartu Ujian Print Component (Mounted when isPrintKartuActive is true) */}
      {isPrintKartuActive && printKartuPayload && (
        <KartuUjianPrint
          data={printKartuPayload}
          onClose={() => {
            setIsPrintKartuActive(false);
            setPrintKartuPayload(null);
          }}
        />
      )}

      {/* Avatar Upload Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 animate-scale-up">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">Foto Profil</h3>
                <p className="text-xs text-slate-500">Unggah foto profil dari perangkat Anda</p>
              </div>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="flex flex-col items-center gap-4 py-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                {user.foto_profil ? (
                  <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                )}
              </div>
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95">
                <span className="material-symbols-outlined text-lg">upload</span>
                <span>Pilih Foto dari Perangkat</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressImageFile(file);
                      await handleAvatarSelect(dataUrl);
                    } catch (err) {
                      showMessage('Gagal', err.message, 'error');
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-slate-400 text-center">Format JPEG/PNG, otomatis dikompresi ke resolusi optimal.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
