import { fetchAPI, getTrueNow, get_default_skema_sekolah, save_default_skema_sekolah, isClassMatching, splitCompoundTargets } from '../api.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  decodeNexaBundle,
  verifyNexaBundleChecksum,
  cloneExamSchedule,
  generateRandomToken
} from '../utils/nexaBundle.js';
import {
  EmptyState,
  TableSkeleton,
  StatusBadge,
  Button,
  PasswordInput,
  TokenCountdown
} from '../components/UI.jsx';
import SkemaPenilaianPanel from '../components/SkemaPenilaianPanel.jsx';
import KartuUjianPrint from '../components/KartuUjianPrint.jsx';
import FormSoalModal from '../components/FormSoalModal.jsx';
import FormNarasiModal from '../components/FormNarasiModal.jsx';
import { compressImageFile } from '../utils/imageHelper.js';

const isUniversalAlloc = (alloc) => {
  if (!alloc) return true;
  const s = String(alloc).trim();
  const up = s.toUpperCase();
  return (
    s === '' ||
    up === 'SEMUA' ||
    s === 'Semua' ||
    s === 'Semua Kelas' ||
    s === 'Semua Kelas (Umum)' ||
    s === 'Semua Tingkat' ||
    s === 'Semua Tingkat (Umum)' ||
    s === 'Semua Rombel' ||
    s === 'Semua Siswa' ||
    s === 'Umum' ||
    s === 'ALL' ||
    s === 'GLOBAL' ||
    s === '-' ||
    s === '*' ||
    /^SEMUA(\s+(KELAS|TINGKAT|ROMBEL|SISWA)?)?(\s*\(UMUM\))?$/i.test(s) ||
    /^UMUM(\s*\(SEMUA\))?$/i.test(s)
  );
};

const formatJadwalTarget = (target) => {
  if (!target || isUniversalAlloc(target)) return 'Umum';
  const s = String(target).trim();
  if (/^tingkat/i.test(s) || /[,;|\n\r]/.test(s) || /\s/.test(s)) return s;
  return `Tingkat ${s}`;
};

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
  const [dataLog, setDataLog] = useState([]); // monitoring
  const [dataAudit, setDataAudit] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultSkemaSekolah, setDefaultSkemaSekolah] = useState({
    mode: 'default',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 }
  });
  const [isSkemaLoading, setIsSkemaLoading] = useState(false);
  const [skemaSuccessMsg, setSkemaSuccessMsg] = useState('');

  // Selection & Filter State
  const [selectedJadwal, setSelectedJadwal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  const [filterJadwalStatus, setFilterJadwalStatus] = useState('ALL');

  // Multi-Select Bulk State
  const [selectedSiswa, setSelectedSiswa] = useState([]);
  const [selectedGuru, setSelectedGuru] = useState([]);
  const [selectedJadwalBulk, setSelectedJadwalBulk] = useState([]);

  // Data Kelas & Data Mapel Filter, Search & Bulk States (R2)
  const [searchQueryKelas, setSearchQueryKelas] = useState('');
  const [filterTingkatKelas, setFilterTingkatKelas] = useState('');
  const [selectedKelasBulk, setSelectedKelasBulk] = useState([]);

  const [searchQueryMapel, setSearchQueryMapel] = useState('');
  const [filterAlokasiMapel, setFilterAlokasiMapel] = useState('');
  const [selectedMapelBulk, setSelectedMapelBulk] = useState([]);

  // Print Kartu Peserta & KOP Persisten State
  const savedKop = (() => {
    try { return JSON.parse(localStorage.getItem('nexa_kop_' + (user?.npsn || 'default')) || '{}'); } catch { return {}; }
  })();
  const [kopSettings, setKopSettings] = useState({
    nama_sekolah: savedKop.nama_sekolah || user?.nama_sekolah || '',
    alamat_sekolah: savedKop.alamat_sekolah || user?.alamat || '',
    tahun_ajaran: savedKop.tahun_ajaran || '2026/2027',
    nama_kepsek: savedKop.nama_kepsek || '',
    nip_kepsek: savedKop.nip_kepsek || ''
  });
  // SOP 3: Google Drive Webhook state (Zero-Egress Image Pipeline)
  const [gasDriveWebhook, setGasDriveWebhook] = useState(user?.gas_drive_webhook || (typeof window !== 'undefined' ? localStorage.getItem('nexa_gas_drive_webhook') : '') || '');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [dataRekapHasil, setDataRekapHasil] = useState([]);
  const [dataPengumuman, setDataPengumuman] = useState([]);
  const [pengumumanForm, setPengumumanForm] = useState({ judul: '', isi: '' });

  const [printKartuModal, setPrintKartuModal] = useState({
    isOpen: false,
    filterKelas: 'ALL',
    filterRuang: 'ALL',
    filterSesi: 'Sesi 1',
    paperSize: 'A4', // 'A4' | 'F4'
    showPassword: true,
    selectedOnly: false,
    tahunAjaran: savedKop.tahun_ajaran || '2026/2027',
    namaKepalaSekolah: savedKop.nama_kepsek || '',
    nipKepalaSekolah: savedKop.nip_kepsek || ''
  });
  const [isPrintKartuActive, setIsPrintKartuActive] = useState(false);
  const [printKartuPayload, setPrintKartuPayload] = useState(null);

  // Sorting State
  const [sortConfigSiswa, setSortConfigSiswa] = useState({ key: 'nama_lengkap', direction: 'asc' });
  const [sortConfigGuru, setSortConfigGuru] = useState({ key: 'nama_lengkap', direction: 'asc' });
  const [sortConfigJadwal] = useState({ key: 'waktu_mulai', direction: 'desc' });

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

  // M3 Features: Clone Jadwal, Offline Answer Import (.nexa), Backup CBT
  const [cloneModal, setCloneModal] = useState({ isOpen: false, source: null, targetKelas: '', token: '' });
  const [nexaImportModal, setNexaImportModal] = useState({ isOpen: false, file: null, bundle: null, status: null, error: null });
  const [isBackingUp, setIsBackingUp] = useState(false);

  // R2: Question Bank Management State for Admin
  const [selectedMapel, setSelectedMapel] = useState(null);
  const [dataSoal, setDataSoal] = useState([]);
  const [isSoalLoading, setIsSoalLoading] = useState(false);
  const [formSoal, setFormSoal] = useState({ isOpen: false, data: null, id_mapel: '' });
  const [formNarasi, setFormNarasi] = useState({ isOpen: false, data: null });
  const [bankSoalPage, setBankSoalPage] = useState(1);
  const [filterTipeSoal, setFilterTipeSoal] = useState('ALL');
  const [searchQuerySoal, setSearchQuerySoal] = useState('');
  const [skemaModal, setSkemaModal] = useState({ isOpen: false, id_mapel: null });
  const [adminMapelSkemaData, setAdminMapelSkemaData] = useState([]);
  const [isAdminMapelSkemaLoading, setIsAdminMapelSkemaLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);

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

  // Modal Detail Rincian Hasil & Nilai Siswa
  const [detailHasilModal, setDetailHasilModal] = useState({
    isOpen: false,
    jadwal: null,
    data: [],
    isLoading: false
  });

  // Direct file upload replaces Dicebear preset avatars

  const navigateTab = (tabId) => {
    setActiveTab(tabId);
    setSearchQuery('');
    setFilterKelas('');
    setFilterMapel('');
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
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'SKEMA_DEFAULT', target: 'Skema penilaian default sekolah' });
      } else {
        showMessage('Gagal', res?.message || 'Gagal menyimpan skema default sekolah.', 'error');
      }
    } catch (err) {
      showMessage('Gagal', 'Gagal menyimpan skema default sekolah: ' + err.message, 'error');
    }
  };

  const handleSaveAdminMapelSkema = async (payload, applyToAll = false) => {
    try {
      const targetMapelIds = applyToAll
        ? (dataMapel || []).map(m => m.id_mapel).filter(Boolean)
        : [skemaModal.id_mapel];

      if (targetMapelIds.length === 0) {
        showMessage('Peringatan', 'Mata pelajaran tidak valid.', 'error');
        return;
      }

      const res = await api('save_skema_penilaian', {
        role: 'admin',
        id_mapels: targetMapelIds,
        npsn: user?.npsn,
        mode: payload.mode,
        skema: payload.skema,
        kunci_jawaban: payload.kunci_jawaban,
        bobot: payload.bobot
      });

      if (res?.status === 'success') {
        showMessage('Berhasil', res.message || 'Skema penilaian berhasil disimpan.', 'success');
        setSkemaModal({ isOpen: false, id_mapel: null });
        if (selectedMapel && targetMapelIds.includes(selectedMapel)) {
          fetchSoal(selectedMapel);
        }
        await api('create_audit_log', {
          username: user.username,
          role: 'admin',
          action: 'SKEMA_MAPEL',
          target: `Skema bobot AKM mapel: ${targetMapelIds.join(', ')}`
        });
      } else {
        showMessage('Gagal', res?.message || 'Gagal menyimpan skema penilaian.', 'error');
      }
    } catch (err) {
      showMessage('Error', err.message || 'Terjadi kesalahan sistem.', 'error');
    }
  };

  useEffect(() => {
    if (skemaModal.isOpen && skemaModal.id_mapel) {
      let isMounted = true;
      setIsAdminMapelSkemaLoading(true);
      api('get_soal_mapel', { id_mapel: skemaModal.id_mapel, npsn: user?.npsn }).then(res => {
        if (!isMounted) return;
        const soals = res?.data || [];
        const adminRow = soals.find(s => s.id_soal === 'SKEMA_ADMIN_' + skemaModal.id_mapel) ||
                         soals.find(s => s.tipe_soal === 'SKEMA_PENILAIAN' && String(s.id_soal).startsWith('SKEMA_ADMIN_'));
        if (adminRow) {
          setAdminMapelSkemaData([adminRow]);
        } else {
          let localCached = null;
          if (typeof localStorage !== 'undefined' && user?.npsn) {
            try {
              const raw = localStorage.getItem(`nexa_admin_skema_${user.npsn}_${skemaModal.id_mapel}`);
              if (raw) localCached = JSON.parse(raw);
            } catch {}
          }
          if (localCached) {
            setAdminMapelSkemaData([{
              id_soal: 'SKEMA_ADMIN_' + skemaModal.id_mapel,
              tipe_soal: 'SKEMA_PENILAIAN',
              id_mapel: skemaModal.id_mapel,
              kunci_jawaban: JSON.stringify(localCached)
            }]);
          } else {
            setAdminMapelSkemaData([]);
          }
        }
      }).catch(() => {
        if (isMounted) setAdminMapelSkemaData([]);
      }).finally(() => {
        if (isMounted) setIsAdminMapelSkemaLoading(false);
      });
      return () => { isMounted = false; };
    }
  }, [skemaModal.isOpen, skemaModal.id_mapel]);

  useEffect(() => {
    if (user?.npsn) {
      loadDefaultSkema();
      api('get_sekolah', { npsn: user.npsn }).then(res => {
        const sch = Array.isArray(res?.data) ? res.data.find(s => s.npsn === user.npsn) : res?.data;
        if (res?.status === 'success' && sch?.nama_sekolah) {
          setKopSettings(prev => ({
            ...prev,
            nama_sekolah: prev.nama_sekolah || sch.nama_sekolah
          }));
        }
      }).catch(() => {});
    }
  }, [user?.npsn]);

  useEffect(() => {
    if (activeTab === 'skema' && user?.npsn) {
      loadDefaultSkema();
    }
  }, [activeTab]);

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
        if (selectedMapel) {
          const resSoal = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
          if (resSoal.status === 'success') setDataSoal(resSoal.data || []);
        }
      } else if (tab === 'logs') {
        const res = await api('get_audit_log', {});
        if (res.status === 'success') setDataAudit(res.data || []);
      } else if (tab === 'hasil') {
        const res = await api('get_rekap_koreksi_admin', { npsn: user.npsn });
        if (res.status === 'success') setDataRekapHasil(res.data || []);
      } else if (tab === 'pengumuman') {
        const res = await api('get_pengumuman', { npsn: user.npsn });
        if (res.status === 'success') setDataPengumuman(res.data || []);
      } else if (tab === 'jadwal' || tab === 'monitoring') {
        const res = await api('get_all_jadwal', {});
        if (res.status === 'success') setDataJadwal(res.data || []);
        const resMapel = await api('get_all_mapel', {});
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
        const resKelas = await api('get_kelas', {});
        if (resKelas.status === 'success') setDataKelas(resKelas.data || []);
        const resGuru = await api('get_guru', {});
        if (resGuru.status === 'success') setDataGuru(resGuru.data || []);

        if (selectedJadwal) {
          const logRes = await api('monitoring_ujian', { id_jadwal: selectedJadwal });
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

  const refreshMonitoringLogs = async (jadwalId = selectedJadwal) => {
    if (!jadwalId) return;
    try {
      const logRes = await api('monitoring_ujian', { id_jadwal: jadwalId });
      if (logRes.status === 'success') setDataLog(logRes.data || []);
    } catch (err) {
      console.error('Monitoring refresh error:', err);
    }
  };

  // SOP 1: Monitoring pengawas menggunakan penyegaran manual on-demand (Auto-polling 15s dinonaktifkan demi mencegah kebocoran egress Supabase)
  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, selectedJadwal]);

  // R2: Fetch questions when selectedMapel is active
  useEffect(() => {
    if (selectedMapel && activeTab === 'mapel') {
      setIsSoalLoading(true);
      api('get_soal_by_mapel', { id_mapel: selectedMapel })
        .then(res => {
          if (res.status === 'success') setDataSoal(res.data || []);
        })
        .finally(() => setIsSoalLoading(false));
    }
  }, [selectedMapel, activeTab]);

  const isSelectedMapelActive = Boolean(
    selectedMapel && (dataJadwal || []).some(j => String(j.id_mapel) === String(selectedMapel) && j.status_ujian === 'AKTIF')
  );

  const stripHtml = (html) => {
    if (!html) return '-';
    return html.replace(/<[^>]*>?/gm, '').trim();
  };

  const normalizeTipeSoal = (raw) => {
    const s = String(raw || '').trim().toUpperCase();
    if (s.startsWith('PGK') || s.includes('KOMPLEKS')) return 'PGK';
    if (s.startsWith('PG') || s.includes('GANDA')) return 'PG';
    if (s === 'BS' || s.includes('BENAR') || s.includes('SALAH')) return 'BS';
    if (s.includes('JODOH') || s.includes('PASANG')) return 'JODOH';
    if (s.includes('ISIAN') || s.includes('SINGKAT')) return 'ISIAN';
    if (s.includes('URAIAN') || s.includes('ESSAY')) return 'URAIAN';
    if (s.includes('NARASI') || s.includes('WACANA')) return 'NARASI';
    return 'PG';
  };

  const getTipeBadge = (tipe) => {
    const t = (tipe || 'PG').toUpperCase();
    switch (t) {
      case 'PG':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60">PG</span>;
      case 'PGK':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30/70 dark:border-primary/30">PGK</span>;
      case 'BS':
      case 'BENAR_SALAH':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200/70 dark:border-teal-800/60">BENAR / SALAH</span>;
      case 'JODOH':
      case 'MENJODOHKAN':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/60">JODOH</span>;
      case 'ISIAN':
      case 'ISIAN_SINGKAT':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/70 dark:border-cyan-800/60">ISIAN SINGKAT</span>;
      case 'URAIAN':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/70 dark:border-purple-800/60">URAIAN</span>;
      case 'NARASI':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/60">NARASI</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{t}</span>;
    }
  };

  const filteredSoal = useMemo(() => {
    return dataSoal.filter(s => {
      if (s.tipe_soal === 'SKEMA_PENILAIAN' || s.tipe_soal === 'SKEMA_DEFAULT' || s.tipe_soal === 'MAPEL_ALLOC') return false;
      const q = (searchQuerySoal || '').toLowerCase();
      const matchQuery = !q || (s.pertanyaan || '').toLowerCase().includes(q) || (s.tipe_soal || '').toLowerCase().includes(q);
      const matchTipe = filterTipeSoal === 'ALL' || (s.tipe_soal || s.tipe) === filterTipeSoal;
      return matchQuery && matchTipe;
    });
  }, [dataSoal, searchQuerySoal, filterTipeSoal]);

  const itemsPerPageSoal = 10;
  const totalSoalPages = Math.ceil(filteredSoal.length / itemsPerPageSoal) || 1;
  const paginatedSoal = useMemo(() => {
    const start = (bankSoalPage - 1) * itemsPerPageSoal;
    return filteredSoal.slice(start, start + itemsPerPageSoal);
  }, [filteredSoal, bankSoalPage]);

  const handleSaveSoal = async (soalData) => {
    setIsSubmitting(true);
    const endpoint = formSoal.data ? 'update_soal_mapel' : 'create_soal_mapel';
    const payload = {
      ...soalData,
      npsn: user.npsn,
      id_mapel: formSoal.id_mapel || selectedMapel,
      id_soal: formSoal.data ? formSoal.data.id_soal : ('SOAL-' + Math.random().toString(36).substr(2, 9).toUpperCase())
    };
    const res = await api(endpoint, payload);
    setIsSubmitting(false);
    if (res.status === 'success') {
      setFormSoal({ isOpen: false, data: null, id_mapel: '' });
      const refresh = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
      if (refresh.status === 'success') setDataSoal(refresh.data || []);
      fetchData('mapel');
      return true;
    } else {
      showMessage('Gagal', 'Gagal menyimpan soal: ' + res.message, 'error');
      return false;
    }
  };

  const saveSoal = async (payload) => {
    const endpoint = payload.id_soal ? 'update_soal_mapel' : 'create_soal_mapel';
    if (!payload.id_soal) {
      payload.id_soal = 'S-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    payload.id_mapel = selectedMapel;
    const res = await api(endpoint, payload);
    if (res.status === 'success') {
      setFormNarasi({ isOpen: false, data: null });
      const refresh = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
      if (refresh.status === 'success') setDataSoal(refresh.data || []);
      fetchData('mapel');
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const deleteSoal = async (id) => {
    if (isSelectedMapelActive) {
      showMessage('Soal Terkunci', 'Tidak dapat menghapus soal karena jadwal ujian mapel ini sedang AKTIF.', 'error');
      return;
    }
    if (!confirm('Hapus butir soal ini?')) return;
    const res = await api('delete_soal_mapel', { id_soal: id });
    if (res.status === 'success') {
      const refresh = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
      if (refresh.status === 'success') setDataSoal(refresh.data || []);
      fetchData('mapel');
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const downloadTemplateSoal = () => {
    const templateData = [
      { no: 1, tipe_soal: 'NARASI', pertanyaan: 'Bacalah teks wacana/stimulus berikut untuk menjawab soal nomor selanjutnya...', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: '-', bobot: 0, kd: '3.1', narasi_soal: '', id_narasi: 'N-DEMO-01' },
      { no: 2, tipe_soal: 'PG',    pertanyaan: 'Hasil dari 5 + 7 adalah...', opsi_A: '10', opsi_B: '11', opsi_C: '12', opsi_D: '13', opsi_E: '14', kunci_jawaban: 'C', bobot: 10, kd: '3.1', narasi_soal: '', id_narasi: 'N-DEMO-01' },
      { no: 3, tipe_soal: 'PGK',   pertanyaan: 'Manakah yang merupakan bilangan prima genap?', opsi_A: '2', opsi_B: '4', opsi_C: '6', opsi_D: '8', opsi_E: '10', kunci_jawaban: 'A,B', bobot: 10, kd: '3.1', narasi_soal: '', id_narasi: '' },
      { no: 4, tipe_soal: 'BS',    pertanyaan: 'Bumi mengelilingi Matahari.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Benar', bobot: 5, kd: '3.1', narasi_soal: '', id_narasi: '' },
      { no: 5, tipe_soal: 'JODOH', pertanyaan: 'Pasangkan ibukota negara berikut:', opsi_A: 'Indonesia = Jakarta', opsi_B: 'Jepang = Tokyo', opsi_C: 'Inggris = London', opsi_D: '', opsi_E: '', kunci_jawaban: 'Indonesia=Jakarta, Jepang=Tokyo, Inggris=London', bobot: 15, kd: '3.2', narasi_soal: '', id_narasi: '' },
      { no: 6, tipe_soal: 'ISIAN', pertanyaan: 'Ibukota Indonesia adalah...', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Jakarta', bobot: 10, kd: '3.2', narasi_soal: '', id_narasi: '' },
      { no: 7, tipe_soal: 'URAIAN', pertanyaan: 'Jelaskan hukum kekekalan energi secara singkat.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Energi tidak dapat diciptakan atau dimusnahkan, hanya berubah bentuk.', bobot: 20, kd: '3.3', narasi_soal: '', id_narasi: '' },
    ];
    const petunjukData = [
      { Kolom: 'tipe_soal',     Keterangan: 'Wajib. Isi dengan: NARASI, PG, PGK, BS, JODOH, ISIAN, atau URAIAN' },
      { Kolom: 'pertanyaan',    Keterangan: 'Wajib. Teks pertanyaan / narasi stimulus.' },
      { Kolom: 'opsi_A - E',   Keterangan: 'Untuk PG/PGK: teks pilihan. Untuk JODOH: format "Premis = Respon". Kosongkan untuk NARASI.' },
      { Kolom: 'kunci_jawaban', Keterangan: 'PG: huruf A/B/C/D/E. PGK: pisah koma (A,B). BS: Benar/Salah. JODOH: "P=R, P2=R2". ISIAN/URAIAN: teks kunci. NARASI: strip (-).' },
      { Kolom: 'bobot',         Keterangan: 'Angka bobot soal (default 10 jika kosong; otomatis 0 untuk NARASI).' },
      { Kolom: 'kd',            Keterangan: 'Kode Dasar / KD, contoh: 3.1 (opsional).' },
      { Kolom: 'narasi_soal',   Keterangan: 'Teks wacana tambahan (opsional).' },
      { Kolom: 'id_narasi',     Keterangan: 'ID stimulus narasi untuk mengaitkan butir soal dengan teks narasi (opsional).' },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateData), 'Template Soal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(petunjukData), 'Petunjuk');
    XLSX.writeFile(wb, 'Template_Soal_NEXA_CBT.xlsx');
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (isSelectedMapelActive) {
      showMessage('Soal Terkunci', 'Tidak dapat mengimpor soal karena jadwal ujian mapel ini sedang AKTIF berlangsung.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        if (!rawData.length) {
          showMessage('Peringatan', 'File Excel kosong atau format tidak sesuai template.', 'error');
          return;
        }

        let activeNarasiId = null;

        const payloadData = rawData.map((row, idx) => {
          const rawTipe = String(row.tipe_soal || '').trim().toUpperCase();
          const isNarasi = rawTipe === 'NARASI' || (!row.pertanyaan && row.narasi_soal);
          const tipe = isNarasi ? 'NARASI' : normalizeTipeSoal(row.tipe_soal || 'PG');
          let finalKunci = row.kunci_jawaban ? String(row.kunci_jawaban).trim() : (isNarasi ? '-' : '');
          let opsiStr = null;
          let finalPertanyaan = isNarasi ? (row.pertanyaan || row.narasi_soal || '') : (row.pertanyaan || '');

          if (row.id_narasi) {
            activeNarasiId = String(row.id_narasi).trim();
          }

          if (isNarasi) {
            opsiStr = '[]';
            finalKunci = '-';
          } else if (tipe === 'PG') {
            const map = { A: row.opsi_A, B: row.opsi_B, C: row.opsi_C, D: row.opsi_D, E: row.opsi_E };
            finalKunci = map[finalKunci.toUpperCase()] || finalKunci;
          } else if (tipe === 'PGK') {
            try {
              const mapped = finalKunci.split(',').map(k => ({ A: row.opsi_A, B: row.opsi_B, C: row.opsi_C, D: row.opsi_D, E: row.opsi_E }[k.trim().toUpperCase()] || k.trim()));
              finalKunci = JSON.stringify(mapped);
            } catch (_) {}
          } else if (tipe === 'JODOH') {
            const premis = [], respon = [];
            ['opsi_A','opsi_B','opsi_C','opsi_D','opsi_E'].forEach(k => {
              if (!row[k]) return;
              const [p, r] = row[k].split('=').map(s => s.trim());
              if (p && !premis.includes(p)) premis.push(p);
              if (r && !respon.includes(r)) respon.push(r);
            });
            opsiStr = JSON.stringify({ premis, respon });
            if (finalKunci) {
              const kunciObj = {};
              finalKunci.split(',').forEach(pair => {
                const [p, r] = pair.split('=').map(s => s.trim());
                if (p) kunciObj[p] = r;
              });
              finalKunci = JSON.stringify(kunciObj);
            }
          }

          if ((tipe === 'PG' || tipe === 'PGK') && !opsiStr) {
            opsiStr = JSON.stringify([row.opsi_A || '', row.opsi_B || '', row.opsi_C || '', row.opsi_D || '', row.opsi_E || '']);
          } else if (tipe === 'BS' && !opsiStr) {
            opsiStr = JSON.stringify(['Benar', 'Salah']);
          }

          const parsedBobot = isNarasi ? 0 : ((row.bobot !== undefined && row.bobot !== '' && !isNaN(Number(row.bobot)))
            ? Number(row.bobot)
            : 10);

          const uniqueId = `SOAL-${selectedMapel}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}-${idx}`;
          if (isNarasi && !row.id_narasi) {
            activeNarasiId = uniqueId;
          }

          return {
            id_soal: uniqueId,
            id_mapel: selectedMapel,
            npsn: user.npsn,
            tipe_soal: tipe,
            pertanyaan: finalPertanyaan,
            opsi: opsiStr,
            kunci_jawaban: finalKunci ? String(finalKunci) : '',
            bobot: parsedBobot,
            id_narasi: isNarasi ? (row.id_narasi ? String(row.id_narasi).trim() : uniqueId) : (row.id_narasi ? String(row.id_narasi).trim() : (activeNarasiId || null))
          };
        });

        setIsLoading(true);
        const res = await api('import_soal_bulk', { data: payloadData, npsn: user.npsn });
        setIsLoading(false);
        if (res.status === 'success') {
          showMessage('Berhasil', `${payloadData.length} soal berhasil diimpor!`, 'success');
          const refresh = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
          if (refresh.status === 'success') setDataSoal(refresh.data || []);
          fetchData('mapel');
        } else {
          showMessage('Info', res.message, 'info');
        }
      } catch (err) {
        setIsLoading(false);
        showMessage('Gagal', 'Gagal memproses file: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

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
    else if (type === 'kelas') ids = selectedKelasBulk;
    else if (type === 'mapel') ids = selectedMapelBulk;

    if (!ids || ids.length === 0) { showMessage('Peringatan', 'Pilih data terlebih dahulu.', 'error'); return; }

    setConfirmDialog({
      isOpen: true,
      title: 'Konfirmasi Hapus Bulk',
      message: `Hapus ${ids.length} data ${type} yang dipilih? Tindakan ini tidak dapat dibatalkan.`,
      actionText: 'Hapus',
      icon: 'delete_forever',
      type: 'delete',
      onConfirm: async () => {
        setIsLoading(true);
        const res = await api(`delete_${type}_bulk`, { ids, npsn: user.npsn });
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
          else if (type === 'kelas') setSelectedKelasBulk([]);
          else if (type === 'mapel') setSelectedMapelBulk([]);
          fetchData(activeTab);
        } else {
          showMessage('Info', res.message, 'info');
        }
      }
    });
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

  const handleResetAllLoginSiswa = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Semua Sesi Login',
      message: 'Yakin ingin mereset sesi login seluruh siswa di sekolah ini?',
      actionText: 'Reset Semua',
      icon: 'lock_reset',
      type: 'warning',
      onConfirm: async () => {
        setIsSubmitting(true);
        const res = await fetchAPI('reset_all_login_siswa', { npsn: user.npsn });
        setIsSubmitting(false);
        if (res.status === 'success') {
          showMessage('Berhasil', 'Sesi login seluruh siswa berhasil direset.', 'success');
        } else {
          showMessage('Info', res.message, 'info');
        }
      }
    });
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

  const handleBulkUpdateStatusUjian = (status_baru) => {
    setConfirmDialog({
      isOpen: true,
      title: `Ubah Semua Jadwal ke ${status_baru}`,
      message: `Yakin ingin mengubah status seluruh jadwal (${dataJadwal.length} jadwal) menjadi ${status_baru}?`,
      actionText: 'Ya, Ubah Semua',
      icon: 'warning',
      type: 'warning',
      onConfirm: async () => {
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
      }
    });
  };

  const handleCopyToken = (tokenText) => {
    if (!tokenText || tokenText === '-') return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(tokenText).then(() => {
        showMessage('Sukses', `Token ${tokenText} disalin ke clipboard`, 'success');
      }).catch(() => {
        showMessage('Info', `Token: ${tokenText}`, 'info');
      });
    } else {
      showMessage('Info', `Token: ${tokenText}`, 'info');
    }
  };

  const handleRilisToken = async (id_jadwal) => {
    setIsSubmitting(true);
    try {
      const now = await getTrueNow();
      const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
      const nowIso = now.toISOString();
      const res = await api('update_jadwal', {
        id_jadwal,
        token_aktif: newToken,
        last_update_token: nowIso
      });
      if (res.status === 'success') {
        setDataJadwal(prev => prev.map(j => j.id_jadwal === id_jadwal ? {
          ...j,
          token_aktif: newToken,
          last_update_token: nowIso
        } : j));
        showMessage('Sukses', `Token ujian baru berhasil dirilis: ${newToken}`, 'success');
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'RILIS_TOKEN', target: `Token ${newToken} untuk jadwal ${id_jadwal}` });
      } else {
        showMessage('Gagal', res.message || 'Gagal merilis token', 'error');
      }
    } catch (err) {
      showMessage('Error', err.message || 'Terjadi kesalahan saat merilis token', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLockdown = async (id_jadwal, currentLockState) => {
    setIsSubmitting(true);
    try {
      const nextState = !currentLockState;
      const res = await api('update_jadwal', { id_jadwal, browser_lockdown: nextState });
      if (res.status === 'success') {
        setDataJadwal(prev => prev.map(j => j.id_jadwal === id_jadwal ? { ...j, browser_lockdown: nextState } : j));
        showMessage('Info', `Mode Kunci Darurat (Browser Lockdown) ${nextState ? 'DIAKTIFKAN' : 'DINONAKTIFKAN'}.`, nextState ? 'warning' : 'info');
        await api('create_audit_log', { username: user.username, role: 'admin', action: 'EMERGENCY_LOCK', target: `${nextState ? 'Aktifkan' : 'Nonaktifkan'} lockdown ${id_jadwal}` });
      } else {
        showMessage('Gagal', res.message || 'Gagal mengubah status lockdown', 'error');
      }
    } catch (err) {
      showMessage('Error', err.message || 'Terjadi kesalahan saat mengubah status lockdown', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Schedule Cloning Handlers (M3 / R4)
  const handleOpenCloneModal = (source) => {
    const newToken = generateRandomToken(6);
    setCloneModal({
      isOpen: true,
      source,
      targetKelas: '',
      token: newToken
    });
  };

  const handleExecuteCloneJadwal = async () => {
    if (!cloneModal.targetKelas || !cloneModal.targetKelas.trim()) {
      showMessage('Target Kelas Wajib Diisi', 'Silakan tentukan rombel/kelas target untuk jadwal yang diduplikasi.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const source = cloneModal.source;
      const res = await api('clone_jadwal', {
        id_jadwal_sumber: source.id_jadwal,
        target_kelas: cloneModal.targetKelas.trim(),
        token_baru: cloneModal.token || generateRandomToken(6)
      });

      if (res && res.status === 'success') {
        showMessage('Jadwal Berhasil Diduplikasi', `Jadwal untuk kelas ${cloneModal.targetKelas} berhasil dibuat dengan token ${res.data?.token_aktif || cloneModal.token}.`, 'success');
        setCloneModal({ isOpen: false, source: null, targetKelas: '', token: '' });
        await fetchData('jadwal');
      } else {
        showMessage('Gagal Duplikasi Jadwal', res?.message || 'Terjadi kesalahan saat menduplikasi jadwal', 'error');
      }
    } catch (err) {
      console.error('Error cloning jadwal:', err);
      showMessage('Gagal Duplikasi', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Companion Offline Answer Import (.nexa) Handlers (M3 / R4)
  const handleOpenNexaImportModal = () => {
    setNexaImportModal({
      isOpen: true,
      file: null,
      bundle: null,
      status: null,
      error: null
    });
  };

  const handleNexaFileSelected = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const logMatch = String(file.name || '').match(/(LOG-[A-Za-z0-9]+)/i);
      const idLogHint = logMatch ? logMatch[1] : '';
      const decoded = decodeNexaBundle(text, 'NEXA_SECRET_SALT', user?.npsn || '', idLogHint);
      const integrity = verifyNexaBundleChecksum(decoded);

      if (!integrity.valid) {
        setNexaImportModal(prev => ({
          ...prev,
          file,
          bundle: decoded,
          status: 'invalid',
          error: integrity.error || 'Checksum tidak valid. Berkas rusak atau terkorupsi.'
        }));
        return;
      }

      setNexaImportModal({
        isOpen: true,
        file,
        bundle: decoded,
        status: 'valid',
        error: null
      });
    } catch (err) {
      console.error('Nexa decode error:', err);
      setNexaImportModal(prev => ({
        ...prev,
        file,
        bundle: null,
        status: 'error',
        error: 'Berkas .nexa tidak dapat dibaca: ' + err.message
      }));
    }
  };

  const handleExecuteNexaImport = async () => {
    if (!nexaImportModal.bundle) return;
    setIsSubmitting(true);
    try {
      const res = await api('import_jawaban_offline', {
        bundle: nexaImportModal.bundle
      });

      if (res && res.status === 'success') {
        showMessage(
          'Jawaban Offline Berhasil Diimpor',
          `Siswa: ${nexaImportModal.bundle.nama_siswa || nexaImportModal.bundle.nisn} | Skor PG/Objektif: ${res.nilai_auto} | Status: SELESAI`,
          'success'
        );
        setNexaImportModal({ isOpen: false, file: null, bundle: null, status: null, error: null });
        await fetchData('monitoring');
        await fetchData('jadwal');
      } else {
        showMessage('Gagal Impor Jawaban', res?.message || 'Terjadi kesalahan saat memproses jawaban offline', 'error');
      }
    } catch (err) {
      console.error('Error importing offline answers:', err);
      showMessage('Gagal Impor', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click CBT Backup & Archive Handlers (M3 / R4)
  const handleExportBackupArchive = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const effectiveNpsn = user?.npsn;
      if (!effectiveNpsn) {
        showMessage('Gagal Backup', 'NPSN sekolah tidak ditemukan.', 'error');
        return;
      }

      const res = await api('get_cbt_backup_data', {});
      if (!res || res.status !== 'success' || !res.data) {
        showMessage('Gagal Mengambil Data Backup', res?.message || 'Tidak dapat memuat tabel CBT dari server.', 'error');
        return;
      }

      const { soal_ujian, jadwal, log_ujian, jawaban_siswa } = res.data;
      const zip = new JSZip();
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.slice(0, 10);

      const manifest = {
        app: 'NEXA CBT',
        version: '2.0.0',
        export_type: 'FULL_BACKUP_ARCHIVE',
        npsn: String(effectiveNpsn),
        nama_sekolah: user?.nama_sekolah || 'SEKOLAH',
        created_at: timestamp,
        tables: {
          soal_ujian: { record_count: (soal_ujian || []).length },
          jadwal: { record_count: (jadwal || []).length },
          log_ujian: { record_count: (log_ujian || []).length },
          jawaban_siswa: { record_count: (jawaban_siswa || []).length }
        }
      };

      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file('soal_ujian.json', JSON.stringify(soal_ujian || [], null, 2));
      zip.file('jadwal.json', JSON.stringify(jadwal || [], null, 2));
      zip.file('log_ujian.json', JSON.stringify(log_ujian || [], null, 2));
      zip.file('jawaban_siswa.json', JSON.stringify(jawaban_siswa || [], null, 2));

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const fileName = `NEXA_CBT_BACKUP_${effectiveNpsn}_${dateStr}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRows = (manifest.tables.soal_ujian.record_count + manifest.tables.jadwal.record_count + manifest.tables.log_ujian.record_count + manifest.tables.jawaban_siswa.record_count);
      showMessage(
        'Backup CBT Berhasil Diunduh',
        `Arsip data ujian (${totalRows} baris data dari 4 tabel) berhasil dibundel ke ${fileName}.`,
        'success'
      );
    } catch (err) {
      console.error('Backup export error:', err);
      showMessage('Gagal Backup', err.message, 'error');
    } finally {
      setIsBackingUp(false);
    }
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
        await api('catat_pelanggaran', { id_log: idLog, force_block: true });
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

  const handleOpenPrintKartu = async (preselectedKelas = null) => {
    if (!dataKelas || dataKelas.length === 0) {
      try {
        const resK = await api('get_kelas', {});
        if (resK.status === 'success') setDataKelas(resK.data || []);
      } catch (err) {
        console.error('Fetch get_kelas error:', err);
      }
    }
    setPrintKartuModal(prev => ({
      ...prev,
      isOpen: true,
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
        filtered = filtered.filter(s => isClassMatching(printKartuModal.filterKelas, s));
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
      sekolah: {
        nama_sekolah: kopSettings.nama_sekolah || user?.nama_sekolah || user?.sekolah || 'SEKOLAH INDONESIA',
        npsn: user?.npsn || '',
        alamat: kopSettings.alamat_sekolah || user?.alamat_sekolah || user?.alamat || '-',
        kepala_sekolah: printKartuModal.namaKepalaSekolah || kopSettings.nama_kepsek || user?.kepala_sekolah || '',
        nip_kepala_sekolah: printKartuModal.nipKepalaSekolah || kopSettings.nip_kepsek || user?.nip_kepala_sekolah || ''
      },
      paperSize: printKartuModal.paperSize,
      showPassword: printKartuModal.showPassword,
      tahunAjaran: printKartuModal.tahunAjaran || kopSettings.tahun_ajaran,
      namaKepalaSekolah: printKartuModal.namaKepalaSekolah || kopSettings.nama_kepsek || user?.kepala_sekolah || '',
      nipKepalaSekolah: printKartuModal.nipKepalaSekolah || kopSettings.nip_kepsek || user?.nip_kepala_sekolah || '',
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
      payload.kelas = `${t} ${p}`.trim();
      delete payload.kelas_gabungan;
    }

    if (formModal.type === 'jadwal') {
      if (!formModal.data) {
        payload.browser_lockdown = true;
        payload.acak_soal = true;
        payload.acak_opsi = true;
      }
      if (payload.durasi_menit !== undefined) {
        payload.durasi_menit = parseInt(payload.durasi_menit, 10) || 90;
      }
      if (payload.durasi_token_menit !== undefined) {
        payload.durasi_token_menit = parseInt(payload.durasi_token_menit, 10) || 5;
      }
      if (payload.batas_pelanggaran !== undefined) {
        payload.batas_pelanggaran = parseInt(payload.batas_pelanggaran, 10) || 3;
      }

      if (payload.tanggal && payload.waktu_mulai_time && payload.waktu_selesai_time) {
        const mulaiDt = new Date(`${payload.tanggal}T${payload.waktu_mulai_time}`);
        const selesaiDt = new Date(`${payload.tanggal}T${payload.waktu_selesai_time}`);
        if (isNaN(mulaiDt.getTime()) || isNaN(selesaiDt.getTime()) || selesaiDt <= mulaiDt) {
          setIsSubmitting(false);
          showMessage('Validasi Waktu', 'Jam selesai harus lebih besar dari jam mulai.', 'error');
          return;
        }
        payload.waktu_mulai = mulaiDt.toISOString();
        payload.waktu_selesai = selesaiDt.toISOString();
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
    if (type === 'siswa') {
      if (!dataKelas || dataKelas.length === 0) {
        const resK = await api('get_kelas', {});
        if (resK.status === 'success') setDataKelas(resK.data || []);
      }
    } else if (type === 'guru' || type === 'jadwal' || type === 'mapel') {
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
    if (type === 'siswa') {
      if (!dataKelas || dataKelas.length === 0) {
        const resK = await api('get_kelas', {});
        if (resK.status === 'success') setDataKelas(resK.data || []);
      }
    } else if (type === 'guru' || type === 'jadwal' || type === 'mapel') {
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
      headers = ['nama_lengkap', 'nisn', 'username', 'password', 'kelas', 'angkatan', 'kelas_paralel', 'agama'];
      filename = 'Template_Siswa.xlsx';
    } else if (importModal.type === 'guru') {
      headers = ['nama_lengkap', 'nip', 'username', 'password', 'mata_pelajaran', 'role'];
      filename = 'Template_Guru.xlsx';
    } else if (importModal.type === 'jadwal') {
      headers = ['nama_mapel', 'nama_guru_atau_nip', 'tanggal', 'jam_mulai', 'jam_selesai', 'durasi_menit', 'target_kelas', 'token'];
      filename = 'Template_Jadwal.xlsx';
    } else if (importModal.type === 'mapel') {
      headers = ['nama_mapel', 'alokasi_kelas', 'agama'];
      filename = 'Template_Mata_Pelajaran.xlsx';
    } else if (importModal.type === 'kelas') {
      headers = ['tingkat', 'kelas_paralel'];
      filename = 'Template_Kelas.xlsx';
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
          let kelasList = dataKelas;
          if (!kelasList || kelasList.length === 0) {
            const kRes = await api('get_kelas', {});
            if (kRes.status === 'success') {
              kelasList = kRes.data || [];
              setDataKelas(kelasList);
            }
          }

          if (!kelasList || kelasList.length === 0) {
            showMessage('Validasi Gagal', 'Belum ada data master kelas. Harap daftarkan kelas terlebih dahulu di Tab Kelas sebelum mengimpor siswa.', 'error');
            setIsSubmitting(false);
            return;
          }

          const normalizeClass = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
          const masterClassMap = new Map();
          kelasList.forEach(k => {
            const full = normalizeClass(`${k.tingkat || ''} ${k.kelas_paralel || ''}`);
            if (full) masterClassMap.set(full, k);
          });

          const invalidClassRows = [];
          processedData = rawData.map((row, idx) => {
            const r = { ...row };
            delete r.jenis_kelamin;
            const nisnStr = String(r.nisn || '').trim();
            if (!r.username || String(r.username).trim() === '') {
              r.username = nisnStr;
            }
            if (!r.password || String(r.password).trim() === '') {
              r.password = 'Nexa123!';
            }

            const rawClass = normalizeClass(r.kelas || `${r.angkatan || ''} ${r.kelas_paralel || ''}`);
            const matchedK = masterClassMap.get(rawClass);
            if (!matchedK) {
              invalidClassRows.push({ row: idx + 2, nama: r.nama_lengkap || `Baris ${idx + 2}`, kelas: r.kelas || `${r.angkatan || ''} ${r.kelas_paralel || ''}`.trim() || '(Kosong)' });
            } else {
              r.angkatan = matchedK.tingkat;
              r.kelas_paralel = matchedK.kelas_paralel;
              r.kelas = `${matchedK.tingkat} ${matchedK.kelas_paralel}`.trim();
            }
            return r;
          });

          if (invalidClassRows.length > 0) {
            const sample = invalidClassRows.slice(0, 3).map(ir => `Baris ${ir.row} (${ir.nama}): "${ir.kelas}"`).join(', ');
            const more = invalidClassRows.length > 3 ? ` dan ${invalidClassRows.length - 3} baris lainnya` : '';
            showMessage('Validasi Gagal', `Terdapat ${invalidClassRows.length} siswa dengan kelas yang tidak sesuai Master Data Kelas: ${sample}${more}. Harap pastikan kelas sudah terdaftar di Tab Kelas.`, 'error');
            setIsSubmitting(false);
            return;
          }
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
            let rawMapel = row.nama_mapel ?? row.Nama_Mapel ?? row.NAMA_MAPEL;
            if (rawMapel === undefined || rawMapel === null) {
              const matchedKey = Object.keys(row).find(k => {
                const norm = k.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '_');
                return norm === 'nama_mapel' || norm === 'mapel' || norm === 'mata_pelajaran';
              });
              rawMapel = matchedKey ? row[matchedKey] : '';
            }
            const mapelQuery = String(rawMapel || '').trim().toLowerCase();
            const matchedMapel = mapelQuery ? mapelList.find(m =>
              (m.nama_mapel && m.nama_mapel.toLowerCase() === mapelQuery) ||
              (m.kode_mapel && String(m.kode_mapel).toLowerCase() === mapelQuery) ||
              (m.id_mapel && m.id_mapel === rawMapel)
            ) : null;
            const id_mapel = matchedMapel ? matchedMapel.id_mapel : null;

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

            const mDt = new Date(`${tgl}T${jamM}`);
            const sDt = new Date(`${tgl}T${jamS}`);
            const waktu_mulai = !isNaN(mDt.getTime()) ? mDt.toISOString() : `${tgl}T${jamM}`;
            const waktu_selesai = !isNaN(sDt.getTime()) ? sDt.toISOString() : `${tgl}T${jamS}`;
            const durasi_menit = parseInt(row.durasi_menit, 10) || 90;

            let rawTarget = row.target_kelas ?? row.Target_Kelas ?? row.TARGET_KELAS;
            if (rawTarget === undefined || rawTarget === null) {
              const matchedKey = Object.keys(row).find(k => {
                const norm = k.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '_');
                return norm === 'target_kelas' || norm === 'target' || norm === 'kelas' || norm === 'alokasi_kelas';
              });
              rawTarget = matchedKey ? row[matchedKey] : undefined;
            }

            let target_kelas = '';
            if (rawTarget !== undefined && rawTarget !== null && String(rawTarget).trim() !== '') {
              const tStr = String(rawTarget).trim();
              if (isUniversalAlloc(tStr)) {
                target_kelas = '';
              } else {
                target_kelas = splitCompoundTargets(tStr).join(', ');
              }
            } else if (matchedMapel?.alokasi_kelas && !isUniversalAlloc(matchedMapel.alokasi_kelas)) {
              target_kelas = splitCompoundTargets(matchedMapel.alokasi_kelas).join(', ');
            }

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

          const unassignedMapelRows = [];
          processedData.forEach((item, idx) => {
            if (!item.id_mapel) {
              const row = rawData[idx] || {};
              const rawMapel = row.nama_mapel ?? row.Nama_Mapel ?? row.NAMA_MAPEL ?? row.mapel ?? row.mata_pelajaran ?? '(Kosong)';
              unassignedMapelRows.push({ row: idx + 2, mapel: String(rawMapel || '').trim() || '(Kosong)' });
            }
          });

          if (unassignedMapelRows.length > 0) {
            const sample = unassignedMapelRows.slice(0, 3).map(r => `Baris ${r.row} ("${r.mapel}")`).join(', ');
            const more = unassignedMapelRows.length > 3 ? ` dan ${unassignedMapelRows.length - 3} baris lainnya` : '';
            showMessage('Validasi Gagal', `Terdapat ${unassignedMapelRows.length} jadwal dengan mata pelajaran yang tidak ditemukan di Master Data: ${sample}${more}. Harap pastikan nama mata pelajaran sudah terdaftar di Tab Mata Pelajaran.`, 'error');
            setIsSubmitting(false);
            return;
          }
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

              let rawAlokasi = row.alokasi_kelas ?? row.Alokasi_Kelas ?? row.ALOKASI_KELAS;
              if (rawAlokasi === undefined || rawAlokasi === null) {
                const matchedKey = Object.keys(row).find(k => {
                  const norm = k.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '_');
                  return norm === 'alokasi_kelas' || norm === 'alokasi' || norm === 'target_kelas' || norm === 'kelas' || norm === 'target';
                });
                rawAlokasi = matchedKey ? row[matchedKey] : 'Semua Kelas';
              }
              let alokasi = String(rawAlokasi || '').trim();
              if (!alokasi || isUniversalAlloc(alokasi)) {
                alokasi = 'Semua Kelas';
              } else {
                alokasi = splitCompoundTargets(alokasi).join(', ');
                if (!alokasi) alokasi = 'Semua Kelas';
              }

              let rawAgama = row.agama ?? row.Agama ?? row.AGAMA;
              let agama = rawAgama ? String(rawAgama).trim() : null;
              if (agama === 'Semua/Umum' || agama === 'Semua' || agama === 'Umum' || !agama) agama = null;

              return {
                nama_mapel: nama,
                alokasi_kelas: alokasi,
                agama,
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
        } else if (importModal.type === 'kelas') {
          endpoint = 'create_kelas_bulk';
          const seenInFile = new Set();
          processedData = rawData.map(row => {
            const tingkat = String(row.tingkat ?? row.Tingkat ?? row.TINGKAT ?? '').trim();
            const kelas_paralel = String(row.kelas_paralel ?? row.paralel ?? row.Kelas_Paralel ?? row.KELAS_PARALEL ?? row.kelas ?? '').trim();
            return {
              tingkat,
              kelas_paralel,
              npsn: user.npsn
            };
          }).filter(item => {
            if (!item.tingkat || !item.kelas_paralel) return false;
            const key = `${item.tingkat}_${item.kelas_paralel}`.toLowerCase();
            if (seenInFile.has(key)) return false;
            seenInFile.add(key);
            return true;
          });

          if (processedData.length === 0) {
            showMessage('Peringatan', 'Tidak ada data kelas valid yang dapat diimpor.', 'error');
            setIsSubmitting(false);
            return;
          }

          const existingKeys = new Set((dataKelas || []).map(k => `${String(k.tingkat || '').trim()}_${String(k.kelas_paralel || '').trim()}`.toLowerCase()));
          const newClasses = processedData.filter(k => !existingKeys.has(`${k.tingkat}_${k.kelas_paralel}`.toLowerCase()));
          if (newClasses.length === 0) {
            showMessage('Info', 'Semua kelas dalam file sudah terdaftar.', 'info');
            setImportModal({ isOpen: false, type: '' });
            setIsSubmitting(false);
            return;
          }
          processedData = newClasses;
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
    } else if (type === 'kelas') {
      if (!dataKelas || dataKelas.length === 0) { showMessage('Peringatan', 'Tidak ada data kelas untuk di-export', 'error'); return; }
      exportData = dataKelas.map((k, i) => ({
        'No': i + 1,
        'ID Kelas': k.id_kelas,
        'Tingkat': k.tingkat,
        'Kelas Paralel': k.kelas_paralel,
      }));
      fileName = 'Data_Kelas.xlsx';
    } else if (type === 'mapel') {
      if (!dataMapel || dataMapel.length === 0) { showMessage('Peringatan', 'Tidak ada data mata pelajaran untuk di-export', 'error'); return; }
      exportData = dataMapel.map((m, i) => ({
        'No': i + 1,
        'ID Mapel': m.id_mapel,
        'Nama Mata Pelajaran': m.nama_mapel,
        'Alokasi Kelas': m.alokasi_kelas || 'Semua Kelas',
        'Agama': m.agama || 'Semua/Umum',
        'Jumlah Soal': m.jumlah_soal || 0
      }));
      fileName = 'Data_Mata_Pelajaran.xlsx';
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
      const matchesKelas = !filterKelas || isClassMatching(filterKelas, s);
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
      const matchesQuery = !q || (g.nama_lengkap || '').toLowerCase().includes(q) || String(g.nip || '').includes(q);
      const matchesMapel = !filterMapel || (g.mapels_list || '').split(',').map(s => s.trim()).includes(filterMapel);
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

  const sortedFilteredKelas = useMemo(() => {
    return (dataKelas || []).filter(k => {
      const q = (searchQueryKelas || '').trim().toLowerCase();
      const tingkat = String(k.tingkat || '').toLowerCase();
      const paralel = String(k.kelas_paralel || '').toLowerCase();
      const full = `${tingkat} ${paralel}`;
      const matchesQuery = !q || tingkat.includes(q) || paralel.includes(q) || full.includes(q);
      const matchesTingkat = !filterTingkatKelas || k.tingkat === filterTingkatKelas;
      return matchesQuery && matchesTingkat;
    });
  }, [dataKelas, searchQueryKelas, filterTingkatKelas]);

  const sortedFilteredMapel = useMemo(() => {
    return (dataMapel || []).filter(m => {
      const q = (searchQueryMapel || '').trim().toLowerCase();
      const nama = String(m.nama_mapel || '').toLowerCase();
      const alokasi = String(m.alokasi_kelas || '').toLowerCase();
      const agama = String(m.agama || '').toLowerCase();
      const matchesQuery = !q || nama.includes(q) || alokasi.includes(q) || agama.includes(q);
      const matchesAlokasi = !filterAlokasiMapel || (
        filterAlokasiMapel === 'Semua'
          ? (isUniversalAlloc(m.alokasi_kelas))
          : (m.alokasi_kelas && m.alokasi_kelas.includes(filterAlokasiMapel))
      );
      return matchesQuery && matchesAlokasi;
    });
  }, [dataMapel, searchQueryMapel, filterAlokasiMapel]);

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

  const selectedJadwalObj = useMemo(() => {
    return (dataJadwal || []).find(j => j.id_jadwal === selectedJadwal) || null;
  }, [dataJadwal, selectedJadwal]);

  // Available classes for monitoring sourced from canonical master dataKelas
  const availableMonitoringClasses = useMemo(() => {
    const classes = new Set();
    (dataKelas || []).forEach(k => {
      const name = `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim();
      if (name) classes.add(name);
    });
    return Array.from(classes).sort();
  }, [dataKelas]);

  const [autoUsername, setAutoUsername] = useState('');
  const [jadwalTargetKelas, setJadwalTargetKelas] = useState('');
  const [jadwalGuruId, setJadwalGuruId] = useState('');
  const [mapelAlokasiKelas, setMapelAlokasiKelas] = useState([]);
  const [isMapelSemuaKelas, setIsMapelSemuaKelas] = useState(true);

  useEffect(() => {
    if (formModal.isOpen && formModal.data) {
      setAutoUsername(formModal.data.username || '');
      if (formModal.type === 'jadwal') {
        setJadwalTargetKelas(formModal.data.target_kelas || '');
        setJadwalGuruId(formModal.data.id_guru || '');
      }
      if (formModal.type === 'mapel') {
        const rawAlloc = formModal.data.alokasi_kelas;
        if (isUniversalAlloc(rawAlloc)) {
          setIsMapelSemuaKelas(true);
          setMapelAlokasiKelas([]);
        } else {
          setIsMapelSemuaKelas(false);
          const parts = splitCompoundTargets(rawAlloc);
          const normalizedParts = parts.map(p => {
            const m = String(p).trim().match(/^(?:tingkat\s+|kelas\s+)?([0-9]+|[ivxlcdm]+)\|([a-z0-9_-]+(?:\s+[a-z0-9_-]+)*)$/i);
            return m ? `${m[1]} ${m[2]}` : p;
          });
          setMapelAlokasiKelas(Array.from(new Set(normalizedParts)));
        }
      }
    } else if (formModal.isOpen) {
      setAutoUsername('');
      if (formModal.type === 'jadwal') {
        setJadwalTargetKelas('');
        setJadwalGuruId('');
      }
      if (formModal.type === 'mapel') {
        setIsMapelSemuaKelas(true);
        setMapelAlokasiKelas([]);
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
        { id: 'kelas', label: 'Data Kelas', icon: 'meeting_room' },
        { id: 'mapel', label: 'Data Ujian / Mapel', icon: 'menu_book' }
      ]
    },
    {
      title: 'Rangkaian Ujian',
      items: [
        { id: 'jadwal', label: 'Jadwal Ujian', icon: 'event_note' },
        { id: 'hasil', label: 'Hasil & Leger Nilai', icon: 'leaderboard' },
        { id: 'pengumuman', label: 'Pengumuman', icon: 'campaign' }
      ]
    },
    {
      title: 'Sistem',
      items: [
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
    hasil: 'Hasil & Leger Nilai Sekolah',
    pengumuman: 'Pengumuman Sekolah',
    skema: 'Skema Penilaian Default',
    monitoring: 'Live Monitoring Ujian',
    logs: 'Log Aktivitas Sistem',
    akun: 'Profil Admin'
  };

  // ================= MODALS RENDERERS (PHANTOM FREE) =================

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

            {type === 'mapel' && (() => {
              const allTingkat = Array.from(new Set(dataKelas.map(k => String(k.tingkat || '').trim()).filter(Boolean)));
              const sortedTingkat = allTingkat.sort((a, b) => {
                const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
                const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
              });
              const mapelAllocVal = isMapelSemuaKelas || mapelAlokasiKelas.length === 0 ? 'Semua Kelas' : mapelAlokasiKelas.join(', ');
              const knownClasses = new Set(dataKelas.filter(k => k.tingkat && k.kelas_paralel).map(k => `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}`));
              const orphanClasses = mapelAlokasiKelas.filter(c => !knownClasses.has(c));

              return (
                <>
                  {isEdit && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ID Mapel</label>
                      <input name="id_mapel" defaultValue={data?.id_mapel || ''} readOnly={isEdit} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm bg-slate-50" />
                    </div>
                  )}
                  <div className={isEdit ? 'col-span-1 md:col-span-1' : 'col-span-1 md:col-span-2'}>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Mapel</label>
                    <input name="nama_mapel" defaultValue={data?.nama_mapel || ''} required placeholder="Contoh: Matematika Wajib" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Batasan Agama Peserta</label>
                    <select
                      name="agama"
                      defaultValue={data?.agama || 'Semua/Umum'}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                    >
                      <option value="Semua/Umum">Semua Agama / Umum</option>
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Konghucu">Konghucu</option>
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-2 xl:col-span-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                          Alokasi Kelas Paralel
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Pilih satu atau lebih kelas paralel yang berhak mengikuti mata pelajaran ini
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isMapelSemuaKelas || mapelAlokasiKelas.length === 0
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-primary/10 text-primary dark:text-primary-400'
                      }`}>
                        {isMapelSemuaKelas || mapelAlokasiKelas.length === 0
                          ? 'Semua Kelas (Umum)'
                          : `${mapelAlokasiKelas.length} kelas dipilih`}
                      </span>
                    </div>

                    <input
                      type="hidden"
                      name="alokasi_kelas"
                      value={mapelAllocVal}
                    />

                    {/* Opsi Global: Semua Kelas (Umum) */}
                    <div
                      onClick={() => {
                        setIsMapelSemuaKelas(true);
                        setMapelAlokasiKelas([]);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        (isMapelSemuaKelas || mapelAlokasiKelas.length === 0)
                          ? 'bg-primary/5 border-primary/40 dark:bg-primary/10 dark:border-primary/50'
                          : 'bg-slate-50 hover:bg-slate-100/70 dark:bg-slate-900/40 dark:hover:bg-slate-900/60 border-slate-200 dark:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="checkbox_mapel_semua_kelas"
                          checked={isMapelSemuaKelas || mapelAlokasiKelas.length === 0}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setIsMapelSemuaKelas(true);
                              setMapelAlokasiKelas([]);
                            }
                          }}
                          className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
                        />
                        <div>
                          <label htmlFor="checkbox_mapel_semua_kelas" onClick={(e) => e.stopPropagation()} className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer block">
                            Semua Kelas (Umum)
                          </label>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Mata pelajaran dapat diakses oleh seluruh siswa dari semua tingkat dan rombel
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 text-lg">public</span>
                    </div>

                    {/* Structured Group per Tingkat */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {sortedTingkat.map(t => {
                        const classesInTingkat = Array.from(new Set(
                          dataKelas
                            .filter(k => String(k.tingkat || '').trim() === t && k.kelas_paralel)
                            .map(k => `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}`)
                        )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                        const allSelected = classesInTingkat.length > 0 && classesInTingkat.every(cls => mapelAlokasiKelas.includes(cls));

                        return (
                          <div key={t} className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-sm">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/80">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  Tingkat {t}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ({classesInTingkat.filter(c => mapelAlokasiKelas.includes(c)).length}/{classesInTingkat.length} dipilih)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMapelSemuaKelas(false);
                                  if (allSelected) {
                                    setMapelAlokasiKelas(prev => {
                                      const next = prev.filter(c => !classesInTingkat.includes(c));
                                      if (next.length === 0) setIsMapelSemuaKelas(true);
                                      return next;
                                    });
                                  } else {
                                    setMapelAlokasiKelas(prev => Array.from(new Set([...prev, ...classesInTingkat])));
                                  }
                                }}
                                className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10"
                              >
                                {allSelected ? 'Batal Semua' : 'Pilih Semua'}
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {classesInTingkat.map(cls => {
                                const checked = !isMapelSemuaKelas && mapelAlokasiKelas.includes(cls);
                                return (
                                  <label
                                    key={cls}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                      checked
                                        ? 'bg-primary/10 border-primary text-primary font-bold dark:bg-primary/20 dark:text-primary-300'
                                        : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setIsMapelSemuaKelas(false);
                                        if (e.target.checked) {
                                          setMapelAlokasiKelas(prev => Array.from(new Set([...prev, cls])));
                                        } else {
                                          setMapelAlokasiKelas(prev => {
                                            const next = prev.filter(c => c !== cls);
                                            if (next.length === 0) setIsMapelSemuaKelas(true);
                                            return next;
                                          });
                                        }
                                      }}
                                      className="rounded text-primary focus:ring-primary/40 cursor-pointer"
                                    />
                                    <span className="truncate">{cls}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {sortedTingkat.length === 0 && (
                        <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400">
                          Belum ada data kelas paralel. Tambahkan rombel pada menu Manajemen Kelas.
                        </div>
                      )}

                      {orphanClasses.length > 0 && (
                        <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                          <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center justify-between">
                            <span>Alokasi Tersimpan Lainnya</span>
                            <span className="text-[10px] font-normal">{data?.alokasi_kelas} (Tersimpan)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {orphanClasses.map(cls => (
                              <span
                                key={cls}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                              >
                                <span>{cls}</span>
                                <button
                                  type="button"
                                  onClick={() => setMapelAlokasiKelas(prev => {
                                    const next = prev.filter(c => c !== cls);
                                    if (next.length === 0) setIsMapelSemuaKelas(true);
                                    return next;
                                  })}
                                  className="hover:text-rose-600 font-bold ml-1"
                                  title={`Hapus ${cls}`}
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preservation & Compatibility Marker */}
                    <div className="hidden" aria-hidden="true">
                      <select defaultValue="Semua Kelas">
                        <option value="Semua Kelas">Semua Kelas (Umum)</option>
                        {data?.alokasi_kelas && (
                          <option value={data?.alokasi_kelas}>{data?.alokasi_kelas} (Tersimpan)</option>
                        )}
                        <optgroup label="Kelas Paralel Spesifik" />
                      </select>
                    </div>
                  </div>
                </>
              );
            })()}

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
                  <PasswordInput name="password" required={!isEdit} defaultValue={data?.password || ''} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
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
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Agama</label>
                  <select name="agama" defaultValue={data?.agama || 'Islam'} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white">
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Konghucu">Konghucu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Ruang Ujian (Opsional)</label>
                  <input name="ruang" defaultValue={data?.ruang || ''} placeholder="Contoh: R.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
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
                  <PasswordInput name="password" required={!isEdit} defaultValue={data?.password || ''} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
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
                    id="input_jadwal_id_mapel"
                    name="id_mapel"
                    defaultValue={data?.id_mapel || ''}
                    required
                    onChange={(e) => {
                      const selectedMapelId = e.target.value;
                      const selectedM = dataMapel.find(m => String(m.id_mapel) === String(selectedMapelId));
                      const alloc = selectedM?.alokasi_kelas;
                      const newTarget = (alloc && !isUniversalAlloc(alloc)) ? alloc : '';
                      setJadwalTargetKelas(newTarget);
                      const targetSelect = document.getElementById('input_jadwal_target_kelas');
                      if (targetSelect) targetSelect.value = newTarget;

                      // Auto-select Subject Teacher (Guru Pengampu) based on chosen subject and target class
                      if (selectedMapelId && Array.isArray(dataGuru)) {
                        const matchingGurus = dataGuru.filter(g =>
                          (g.id_mapels && g.id_mapels.some(id => String(id) === String(selectedMapelId))) ||
                          (g.guru_mapel && g.guru_mapel.some(gm => String(gm.id_mapel) === String(selectedMapelId))) ||
                          (g.nama_mapel && selectedM && g.nama_mapel === selectedM.nama_mapel)
                        );
                        let matchingGuru = null;
                        if (newTarget && matchingGurus.length > 1) {
                          matchingGuru = matchingGurus.find(g => g.alokasi_kelas && splitCompoundTargets(g.alokasi_kelas).some(tc => newTarget.includes(tc)));
                        }
                        if (!matchingGuru && matchingGurus.length > 0) {
                          matchingGuru = matchingGurus[0];
                        }
                        if (matchingGuru) {
                          setJadwalGuruId(matchingGuru.id_guru);
                        } else {
                          setJadwalGuruId('');
                        }
                      } else {
                        setJadwalGuruId('');
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                  >
                    <option value="">Pilih Mapel</option>
                    {dataMapel.map(m => (
                      <option key={m.id_mapel} value={m.id_mapel}>
                        {m.nama_mapel} {m.alokasi_kelas && !isUniversalAlloc(m.alokasi_kelas) ? `(${m.alokasi_kelas})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Guru Pengampu</label>
                    {jadwalGuruId && (() => {
                      const curMapelId = (typeof document !== 'undefined' && document.getElementById('input_jadwal_id_mapel')?.value) || formModal.data?.id_mapel;
                      const gObj = dataGuru.find(g => String(g.id_guru) === String(jadwalGuruId));
                      const isAssigned = gObj && (
                        (gObj.id_mapels && gObj.id_mapels.some(id => String(id) === String(curMapelId))) ||
                        (gObj.guru_mapel && gObj.guru_mapel.some(gm => String(gm.id_mapel) === String(curMapelId)))
                      );
                      return isAssigned ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          ✓ Terpilih Otomatis
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <select
                    id="input_jadwal_id_guru"
                    name="id_guru"
                    value={jadwalGuruId}
                    onChange={(e) => setJadwalGuruId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                  >
                    <option value="">Pilih Guru</option>
                    {(() => {
                      const curMapelId = (typeof document !== 'undefined' && document.getElementById('input_jadwal_id_mapel')?.value) || formModal.data?.id_mapel;
                      const assignedGurus = dataGuru.filter(g =>
                        (g.id_mapels && g.id_mapels.some(id => String(id) === String(curMapelId))) ||
                        (g.guru_mapel && g.guru_mapel.some(gm => String(gm.id_mapel) === String(curMapelId)))
                      );
                      const assignedIds = new Set(assignedGurus.map(g => g.id_guru));
                      const otherGurus = dataGuru.filter(g => !assignedIds.has(g.id_guru));

                      return (
                        <>
                          {assignedGurus.length > 0 && (
                            <optgroup label="Guru Pengampu Mapel Ini">
                              {assignedGurus.map(g => (
                                <option key={g.id_guru} value={g.id_guru}>
                                  ⭐ {g.nama_lengkap} {g.mapels_list && g.mapels_list !== '-' ? `(${g.mapels_list})` : ''} {g.alokasi_kelas ? `[${g.alokasi_kelas}]` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label={assignedGurus.length > 0 ? "Guru Lainnya" : "Daftar Semua Guru"}>
                            {otherGurus.map(g => (
                              <option key={g.id_guru} value={g.id_guru}>
                                {g.nama_lengkap} {g.mapels_list && g.mapels_list !== '-' ? `(${g.mapels_list})` : (g.nama_mapel ? `(${g.nama_mapel})` : '')} {g.alokasi_kelas ? `[${g.alokasi_kelas}]` : ''}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      );
                    })()}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Target Kelas / Tingkat Ujian</label>
                    <span className="text-[10px] text-slate-400">Pisahkan koma (,) untuk multi-kelas</span>
                  </div>
                  <input
                    id="input_jadwal_target_kelas"
                    name="target_kelas"
                    value={jadwalTargetKelas}
                    onChange={(e) => {
                      const newTargetVal = e.target.value;
                      setJadwalTargetKelas(newTargetVal);
                      const mapelSelect = document.getElementById('input_jadwal_id_mapel');
                      const currentMapelId = mapelSelect?.value;
                      if (currentMapelId && Array.isArray(dataGuru)) {
                        const matchingGurus = dataGuru.filter(g =>
                          (g.id_mapels && g.id_mapels.some(id => String(id) === String(currentMapelId))) ||
                          (g.guru_mapel && g.guru_mapel.some(gm => String(gm.id_mapel) === String(currentMapelId)))
                        );
                        if (matchingGurus.length > 1 && newTargetVal) {
                          const matched = matchingGurus.find(g => g.alokasi_kelas && splitCompoundTargets(g.alokasi_kelas).some(tc => newTargetVal.includes(tc)));
                          if (matched) setJadwalGuruId(matched.id_guru);
                        }
                      }
                    }}
                    placeholder="Semua Tingkat (Umum)"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                  />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        let targetResult = '';
                        if (val === '__ALL__' || val === 'Semua Tingkat (Umum)') {
                          targetResult = '';
                        } else if (!jadwalTargetKelas) {
                          targetResult = val;
                        } else {
                          const existing = splitCompoundTargets(jadwalTargetKelas);
                          if (!existing.includes(val)) {
                            targetResult = [...existing, val].join(', ');
                          } else {
                            targetResult = jadwalTargetKelas;
                          }
                        }
                        setJadwalTargetKelas(targetResult);
                        const mapelSelect = document.getElementById('input_jadwal_id_mapel');
                        const currentMapelId = mapelSelect?.value;
                        if (currentMapelId && Array.isArray(dataGuru) && targetResult) {
                          const matchingGurus = dataGuru.filter(g =>
                            (g.id_mapels && g.id_mapels.some(id => String(id) === String(currentMapelId))) ||
                            (g.guru_mapel && g.guru_mapel.some(gm => String(gm.id_mapel) === String(currentMapelId)))
                          );
                          if (matchingGurus.length > 1) {
                            const matched = matchingGurus.find(g => g.alokasi_kelas && splitCompoundTargets(g.alokasi_kelas).some(tc => targetResult.includes(tc)));
                            if (matched) setJadwalGuruId(matched.id_guru);
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
                    >
                      <option value="" disabled>+ Tambah Kelas / Pilih Preset Target...</option>
                      <option value="__ALL__">Semua Tingkat (Umum)</option>
                      {jadwalTargetKelas && (
                        <option value={jadwalTargetKelas}>{jadwalTargetKelas} (Tersimpan)</option>
                      )}
                      <optgroup label="Tingkat / Angkatan (Semua Kelas)">
                        {Array.from(new Set(dataKelas.map(k => String(k.tingkat || '').trim()).filter(Boolean)))
                          .sort((a, b) => {
                            const numA = parseInt(a, 10);
                            const numB = parseInt(b, 10);
                            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                            return a.localeCompare(b);
                          })
                          .map(t => (
                            <option key={`tingkat-${t}`} value={`Tingkat ${t} (Semua)`}>Tingkat {t} (Semua)</option>
                          ))}
                      </optgroup>
                      <optgroup label="Kelas Paralel Spesifik">
                        {Array.from(new Set(
                          dataKelas
                            .filter(k => k.tingkat && k.kelas_paralel)
                            .map(k => `${String(k.tingkat || '').trim()} ${String(k.kelas_paralel || '').trim()}`)
                        ))
                          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                          .map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                      </optgroup>
                    </select>
                  </div>
                  {jadwalTargetKelas && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {splitCompoundTargets(jadwalTargetKelas).map((cls, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800"
                        >
                          <span>{cls}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const list = splitCompoundTargets(jadwalTargetKelas);
                              const remaining = list.filter((_, i) => i !== idx);
                              setJadwalTargetKelas(remaining.join(', '));
                            }}
                            className="hover:text-rose-600 dark:hover:text-rose-400 font-bold ml-0.5"
                            title={`Hapus ${cls}`}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tanggal Ujian</label>
                  <input type="date" name="tanggal" defaultValue={data?.waktu_mulai ? (() => { const d = new Date(data.waktu_mulai); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Jam Mulai</label>
                    <input type="time" name="waktu_mulai_time" defaultValue={data?.waktu_mulai ? (() => { const d = new Date(data.waktu_mulai); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })() : ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Jam Selesai</label>
                    <input type="time" name="waktu_selesai_time" defaultValue={data?.waktu_selesai ? (() => { const d = new Date(data.waktu_selesai); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })() : ''} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Durasi Ujian (Menit)</label>
                  <input type="number" name="durasi_menit" min="5" max="600" defaultValue={data?.durasi_menit || 90} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Interval Pergantian Token (Menit)</label>
                  <input type="number" name="durasi_token_menit" min="1" max="120" defaultValue={data?.durasi_token_menit || 5} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Batas Maksimal Pelanggaran</label>
                  <input type="number" name="batas_pelanggaran" min="1" max="10" defaultValue={data?.batas_pelanggaran || 3} required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white" />
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
                  {(user?.nama_lengkap || 'A').charAt(0)}
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
              Import Data {importModal.type === 'siswa' ? 'Siswa' : importModal.type === 'guru' ? 'Guru' : importModal.type === 'mapel' ? 'Mata Pelajaran' : importModal.type === 'kelas' ? 'Kelas' : 'Jadwal'}
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

  const renderPrintKartuModal = () => {
    if (!printKartuModal.isOpen) return null;

    // Distinct list of classes from canonical master dataKelas
    const availableClasses = Array.from(
      new Set((dataKelas || []).map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))
    ).sort();

    // Distinct list of rooms from student data
    const availableRooms = Array.from(
      new Set(dataSiswa.map(s => s.ruang).filter(Boolean))
    ).sort();

    // Calculate preview count
    let filteredCount = dataSiswa.length;
    if (printKartuModal.selectedOnly && selectedSiswa.length > 0) {
      filteredCount = dataSiswa.filter(s => selectedSiswa.includes(s.id_siswa)).length;
    } else {
      let temp = dataSiswa;
      if (printKartuModal.filterKelas !== 'ALL') {
        temp = temp.filter(s => isClassMatching(printKartuModal.filterKelas, s));
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
                  Cetak Kartu Peserta Ujian
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih filter data dan pengaturan format kertas
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
                    {printKartuModal.filterKelas && printKartuModal.filterKelas !== 'ALL' && !availableClasses.includes(printKartuModal.filterKelas) && (
                      <option value={printKartuModal.filterKelas}>{printKartuModal.filterKelas} (Target Jadwal)</option>
                    )}
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

            {/* Kepala Sekolah & Tahun Ajaran Customizer */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nama Kepala Sekolah / TTD:
                </label>
                <input
                  type="text"
                  placeholder={user.kepala_sekolah || 'Nama Kepala Sekolah'}
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
                  placeholder={user.nip_kepala_sekolah || '-'}
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

  const renderCloneModal = () => {
    if (!cloneModal.isOpen || !cloneModal.source) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative p-5 sm:p-6 border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-xl">content_copy</span>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Duplikat / Kloning Jadwal Ujian
              </h3>
            </div>
            <button
              onClick={() => setCloneModal({ isOpen: false, source: null, targetKelas: '', token: '' })}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Duplikasi seluruh pengaturan ujian ini (mata pelajaran, durasi, aturan acak, dan lockdown) ke rombel/kelas target baru.
          </p>

          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Mata Pelajaran:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{cloneModal.source.nama_mapel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Durasi Pengerjaan:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{cloneModal.source.durasi_menit || cloneModal.source.durasi || '-'} Menit</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kelas Sumber Asal:</span>
                <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{cloneModal.source.target_kelas}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Kelas / Rombel Baru <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cloneModal.targetKelas}
                onChange={(e) => setCloneModal(prev => ({ ...prev, targetKelas: e.target.value }))}
                placeholder="Contoh: 7B, 8C, atau X MIPA 2"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              />
              {dataKelas && dataKelas.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[11px] text-slate-400">Pilih cepat:</span>
                  {dataKelas.slice(0, 8).map(k => {
                    const labelKelas = k.nama_kelas || `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim();
                    return (
                      <button
                        key={k.id_kelas || labelKelas}
                        type="button"
                        onClick={() => setCloneModal(prev => ({ ...prev, targetKelas: labelKelas }))}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        {labelKelas}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Token Ujian Baru (6 Karakter Uppercase)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={cloneModal.token}
                  onChange={(e) => setCloneModal(prev => ({ ...prev, token: e.target.value.toUpperCase() }))}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/40 font-mono font-bold tracking-widest text-center"
                />
                <button
                  type="button"
                  onClick={() => setCloneModal(prev => ({ ...prev, token: generateRandomToken(6) }))}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 min-h-[44px]"
                  title="Generate Token Acak Baru"
                >
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                  <span>Acak</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setCloneModal({ isOpen: false, source: null, targetKelas: '', token: '' })}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || !cloneModal.targetKelas.trim()}
                onClick={handleExecuteCloneJadwal}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? 'Menduplikasi...' : 'Duplikasi Jadwal Sekarang'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNexaImportModal = () => {
    if (!nexaImportModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative p-5 sm:p-6 border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-xl">upload_file</span>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Import Jawaban Offline (.nexa)
              </h3>
            </div>
            <button
              onClick={() => setNexaImportModal({ isOpen: false, file: null, bundle: null, status: null, error: null })}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Unggah berkas jawaban darurat <code>.nexa</code> yang diekspor siswa saat koneksi internet padam. Sistem mendekripsi, memverifikasi checksum SHA-256, dan menilai secara otomatis.
          </p>

          <div className="space-y-4">
            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <span className="material-symbols-outlined text-3xl text-amber-500 mb-1">file_open</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {nexaImportModal.file ? nexaImportModal.file.name : 'Pilih Berkas Jawaban (.nexa)'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Format terenkripsi NEXA Offline Bundle (*.nexa)</p>
              <label className="inline-block mt-3 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-all shadow-xs">
                Pilih Berkas .nexa
                <input
                  type="file"
                  accept=".nexa"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleNexaFileSelected(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {nexaImportModal.error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-rose-500 shrink-0">error</span>
                <span className="leading-relaxed">{nexaImportModal.error}</span>
              </div>
            )}

            {nexaImportModal.bundle && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200 font-bold mb-1">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Berkas Valid & Checksum Terverifikasi</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-200 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">NISN / Siswa:</span>
                    <span className="font-bold">{nexaImportModal.bundle.nisn || '-'} ({nexaImportModal.bundle.nama_siswa || 'Siswa'})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ID Sesi / Log:</span>
                    <span className="font-mono text-[11px]">{nexaImportModal.bundle.id_log}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Jumlah Jawaban:</span>
                    <span className="font-bold text-emerald-600">{Object.keys(nexaImportModal.bundle.jawaban || {}).length} Butir Soal</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Waktu Ekspor:</span>
                    <span className="text-[11px]">{new Date(nexaImportModal.bundle.timestamp).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNexaImportModal({ isOpen: false, file: null, bundle: null, status: null, error: null })}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isSubmitting || !nexaImportModal.bundle || nexaImportModal.status !== 'valid'}
                onClick={handleExecuteNexaImport}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? 'Memproses Impor...' : 'Impor & Nilai Jawaban'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <>
    {isPrintKartuActive && printKartuPayload && (
      <KartuUjianPrint
        data={printKartuPayload}
        onClose={() => {
          setIsPrintKartuActive(false);
          setPrintKartuPayload(null);
        }}
      />
    )}
    <div className="h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col lg:flex-row w-full overflow-hidden selection:bg-primary/20 selection:text-primary-700">

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
                    data-assistant-target={item.id}
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
      <header className="lg:hidden flex-shrink-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 h-16 flex items-center justify-between shadow-xs transition-colors duration-300">
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

        <div className="flex items-center gap-1.5 shrink-0">
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
                        data-assistant-target={item.id}
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
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] min-w-[44px] transition-colors relative ${
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
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3.5"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">quiz</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 truncate">Total Soal Terdaftar</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                      {dashboardData?.totalSoal || 0}
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
                          {j.status_ujian === 'AKTIF' && (j.token_aktif || j.token) && (
                            <span className="ml-2 inline-block">
                              <TokenCountdown lastUpdate={j.last_update_token} intervalMinutes={j.durasi_token_menit || 5} onExpire={() => fetchData('jadwal')} />
                            </span>
                          )}
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
                    onClick={() => handleOpenPrintKartu()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary dark:text-primary-300 hover:bg-primary/20 transition-all border border-primary/20 min-h-[44px]"
                    title="Cetak Kartu Peserta Ujian"
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
                    {[...new Set((dataKelas || []).map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))].sort().map(k => (
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
                        <th
                          className="py-3 px-4 cursor-pointer select-none hover:text-primary transition-colors"
                          onClick={() => setSortConfigSiswa(prev => ({ key: 'agama', direction: prev.key === 'agama' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          <div className="flex items-center gap-1">
                            <span>Agama</span>
                            <span className="material-symbols-outlined text-[14px]">
                              {sortConfigSiswa.key === 'agama' ? (sortConfigSiswa.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          </div>
                        </th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs sm:text-sm">
                      {isLoading ? (
                        <TableSkeleton rows={6} cols={7} asTableRows={true} hasAvatar={true} />
                      ) : sortedFilteredSiswa.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6">
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
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                s.agama === 'Kristen'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}>
                                {s.agama || '-'}
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
                                {g.mapels_list || '-'} {g.alokasi_kelas ? `[${g.alokasi_kelas}]` : ''}
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
                            <span className="font-mono">NIP: {g.nip || '-'}</span> • {g.mapels_list || '-'} {g.alokasi_kelas ? `[${g.alokasi_kelas}]` : ''}
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
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Bulk Exam Status Operations */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleBulkUpdateStatusUjian('AKTIF')}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-xs min-h-[36px]"
                      title="Mulai Semua Ujian"
                    >
                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                      <span>Mulai Semua</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdateStatusUjian('SELESAI')}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-xs min-h-[36px]"
                      title="Hentikan Semua Ujian"
                    >
                      <span className="material-symbols-outlined text-[16px]">stop</span>
                      <span>Hentikan Semua</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdateStatusUjian('BELUM MULAI')}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-xs min-h-[36px]"
                      title="Reset Semua Ujian"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span>Reset Semua</span>
                    </button>
                  </div>

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
                    onClick={handleOpenNexaImportModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-colors min-h-[44px]"
                    title="Import Jawaban Siswa dari Berkas Darurat (.nexa)"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span className="hidden sm:inline">Import Jawaban (.nexa)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportBackupArchive}
                    disabled={isBackingUp}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-colors min-h-[44px] disabled:opacity-50"
                    title="1-Klik Backup & Arsip Data Ujian (.zip)"
                  >
                    <span className="material-symbols-outlined text-[18px]">archive</span>
                    <span className="hidden sm:inline">{isBackingUp ? 'Membuat Backup...' : '1-Klik Backup CBT'}</span>
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
                              <span className="text-[11px] text-slate-400">Target: {formatJadwalTarget(j.target_kelas)}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{j.guru || '-'}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <span className="block font-semibold">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(j.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(j.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-sm text-primary dark:text-primary-400">
                                    {j.token_aktif || j.token || '-'}
                                  </span>
                                  {(j.token_aktif || j.token) && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyToken(j.token_aktif || j.token)}
                                      className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                      title="Salin Token"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRilisToken(j.id_jadwal)}
                                    disabled={isSubmitting}
                                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary-400 transition-colors inline-flex items-center gap-0.5"
                                    title="Rilis / Putar Token Baru"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">autorenew</span>
                                    <span>Rilis</span>
                                  </button>
                                  {j.status_ujian === 'AKTIF' && (
                                    <TokenCountdown lastUpdate={j.last_update_token} intervalMinutes={j.durasi_token_menit || 5} onExpire={() => fetchData('jadwal')} />
                                  )}
                                </div>

                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLockdown(j.id_jadwal, j.browser_lockdown !== false)}
                                    disabled={isSubmitting}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                                      j.browser_lockdown !== false
                                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
                                    }`}
                                    title="Klik untuk mengubah mode Kunci Darurat (Lockdown)"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">
                                      {j.browser_lockdown !== false ? 'lock' : 'lock_open'}
                                    </span>
                                    <span>{j.browser_lockdown !== false ? 'Lockdown Aktif' : 'Lockdown Bebas'}</span>
                                  </button>
                                </div>
                              </div>
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
                                  onClick={() => handleOpenPrintKartu(j.target_kelas)}
                                  className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Cetak Kartu Peserta untuk Kelas Ini"
                                >
                                  <span className="material-symbols-outlined text-[18px]">badge</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCloneModal(j)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                                  title="Duplikat / Kloning Jadwal Ujian (1-Klik)"
                                >
                                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
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

                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleLockdown(j.id_jadwal, j.browser_lockdown !== false)}
                            disabled={isSubmitting}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                              j.browser_lockdown !== false
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                            }`}
                            title="Mode Kunci Darurat (Lockdown)"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {j.browser_lockdown !== false ? 'lock' : 'lock_open'}
                            </span>
                            <span>{j.browser_lockdown !== false ? 'Lockdown Aktif' : 'Lockdown Bebas'}</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Token Ujian:</span>
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            <strong className="font-mono text-primary dark:text-primary-400 font-bold">
                              #{j.token_aktif || j.token || '-'}
                            </strong>
                            {(j.token_aktif || j.token) && (
                              <button
                                type="button"
                                onClick={() => handleCopyToken(j.token_aktif || j.token)}
                                className="p-1 text-slate-400 hover:text-primary rounded"
                                title="Salin Token"
                              >
                                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRilisToken(j.id_jadwal)}
                              disabled={isSubmitting}
                              className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary dark:text-primary-400 hover:bg-primary/20 inline-flex items-center gap-0.5 transition-colors"
                              title="Rilis Token Baru"
                            >
                              <span className="material-symbols-outlined text-[13px]">autorenew</span>
                              <span>Rilis</span>
                            </button>
                            {j.status_ujian === 'AKTIF' && (
                              <TokenCountdown lastUpdate={j.last_update_token} intervalMinutes={j.durasi_token_menit || 5} onExpire={() => fetchData('jadwal')} />
                            )}
                          </div>
                        </div>
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
                          onClick={() => handleOpenPrintKartu(j.target_kelas)}
                          className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="Cetak Kartu untuk Kelas Ini"
                        >
                          <span className="material-symbols-outlined text-[18px]">badge</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCloneModal(j)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                          title="Duplikat / Kloning Jadwal Ujian"
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
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
                    onClick={() => {
                      refreshMonitoringLogs(selectedJadwal);
                      if (showMessage) showMessage('Data Disegarkan', 'Data pemantauan peserta berhasil diperbarui.', 'info');
                    }}
                    className="h-10 px-3.5 rounded-xl bg-primary text-white hover:bg-primary-600 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm shadow-primary/20 min-h-[44px]"
                    title="Segarkan Monitoring Peserta"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    <span>Segarkan Data</span>
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
                              const totalSoal = p.total_soal || 0;
                              const totalDijawab = p.total_dijawab !== undefined ? p.total_dijawab : (p.jawaban_count || 0);
                              const progressPercent = totalSoal > 0 ? Math.min(100, Math.round((totalDijawab / totalSoal) * 100)) : (p.status_ujian === 'SELESAI' ? 100 : 0);

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
                                      (p.pelanggaran || 0) >= (selectedJadwalObj?.batas_pelanggaran || 3) ? 'bg-rose-100 text-rose-700' :
                                      (p.pelanggaran || 0) > 0 ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                      {p.pelanggaran || 0}/{(selectedJadwalObj?.batas_pelanggaran || 3)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <StatusBadge
                                      status={p.is_blocked ? 'TERBLOKIR' : (p.status_ujian || 'AKTIF')}
                                      pulse={!p.is_blocked && p.status_ujian !== 'SELESAI'}
                                    />
                                    {p.status_ujian === 'SELESAI' && (
                                      <div className="mt-1 text-[11px] font-black text-primary">
                                        Nilai: {p.total_nilai ?? p.nilai_auto ?? 0}
                                      </div>
                                    )}
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
                        const totalSoal = p.total_soal || 0;
                        const totalDijawab = p.total_dijawab !== undefined ? p.total_dijawab : (p.jawaban_count || 0);
                        const progressPercent = totalSoal > 0 ? Math.min(100, Math.round((totalDijawab / totalSoal) * 100)) : (p.status_ujian === 'SELESAI' ? 100 : 0);

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
                                  {p.angkatan} {p.kelas_paralel} • Pelanggaran: <strong className={p.pelanggaran >= (selectedJadwalObj?.batas_pelanggaran || 3) ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}>{p.pelanggaran || 0}/{(selectedJadwalObj?.batas_pelanggaran || 3)}</strong>
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusBadge
                                  status={p.is_blocked ? 'TERBLOKIR' : (p.status_ujian || 'AKTIF')}
                                  size="xs"
                                  pulse={!p.is_blocked && p.status_ujian !== 'SELESAI'}
                                />
                                {p.status_ujian === 'SELESAI' && (
                                  <span className="text-[11px] font-black text-primary">
                                    Nilai: {p.total_nilai ?? p.nilai_auto ?? 0}
                                  </span>
                                )}
                              </div>
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

          {/* ================= TAB 8: MATA PELAJARAN ================= */}
          {activeTab === 'mapel' && (
            <div className="space-y-4 animate-fade-in-up">
              {selectedMapel ? (
                /* Active Subject Question Bank */
                <div className="space-y-4">
                  {/* Top Bar with Back, Title, & Action Buttons */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedMapel(null)}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                        title="Kembali ke Daftar Mapel"
                      >
                        <span className="material-symbols-outlined text-xl">arrow_back</span>
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-base sm:text-lg text-slate-800 dark:text-white leading-tight">
                            {dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || 'Bank Soal'}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30">
                            {filteredSoal.length} Soal
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ID: {selectedMapel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
                      {/* Atur Bobot AKM */}
                      <button
                        onClick={() => setSkemaModal({ isOpen: true, id_mapel: selectedMapel })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 transition-colors min-h-[44px]"
                        title="Atur Bobot AKM Mata Pelajaran"
                      >
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                        <span className="hidden sm:inline">Atur Bobot AKM</span>
                      </button>
                      {/* Unduh Template Excel */}
                      <button
                        onClick={downloadTemplateSoal}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                        title="Unduh Template Excel (.xlsx)"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        <span className="hidden sm:inline">Template Excel</span>
                      </button>
                      {/* Import Excel */}
                      <button
                        onClick={() => !isSelectedMapelActive && fileInputRef.current?.click()}
                        disabled={isSelectedMapelActive}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 dark:bg-green-950/40 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 dark:text-green-300 transition-colors min-h-[44px]"
                        title={isSelectedMapelActive ? 'Soal terkunci selama ujian berlangsung' : 'Import dari Excel (.xlsx)'}
                      >
                        <span className="material-symbols-outlined text-[18px]">table_chart</span>
                        <span className="hidden sm:inline">Import Excel</span>
                      </button>
                      <button
                        onClick={() => !isSelectedMapelActive && setFormNarasi({ isOpen: true, data: null })}
                        disabled={isSelectedMapelActive}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                        title={isSelectedMapelActive ? 'Soal terkunci selama ujian berlangsung' : 'Tambah Narasi Soal'}
                      >
                        <span className="material-symbols-outlined text-[18px]">article</span>
                        <span>Narasi Soal</span>
                      </button>
                      <button
                        onClick={() => !isSelectedMapelActive && setFormSoal({ isOpen: true, data: null, id_mapel: selectedMapel })}
                        disabled={isSelectedMapelActive}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                        title={isSelectedMapelActive ? 'Soal terkunci selama ujian berlangsung' : 'Tambah Soal'}
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        <span>Tambah Soal</span>
                      </button>
                    </div>
                  </div>

                  {isSelectedMapelActive && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-amber-600">lock</span>
                      <span>Bank soal ini terkunci sementara (tambah/hapus dinonaktifkan) karena ujian sedang berstatus <strong>AKTIF</strong>.</span>
                    </div>
                  )}

                  {/* Quick Subject Switcher Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-xs font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">swap_horiz</span> Ganti Mapel:
                    </span>
                    {dataMapel.map(m => (
                      <button
                        key={m.id_mapel}
                        onClick={() => { setSelectedMapel(m.id_mapel); setBankSoalPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] ${
                          selectedMapel === m.id_mapel
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {m.nama_mapel}
                      </button>
                    ))}
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Tipe Soal Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                      {['ALL', 'PG', 'PGK', 'BS', 'JODOH', 'ISIAN', 'URAIAN', 'NARASI'].map(tipe => (
                        <button
                          key={tipe}
                          onClick={() => { setFilterTipeSoal(tipe); setBankSoalPage(1); }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] ${
                            filterTipeSoal === tipe
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {tipe === 'ALL' ? 'Semua Tipe' : tipe === 'NARASI' ? 'Narasi Soal' : tipe === 'BS' ? 'Benar / Salah' : tipe === 'ISIAN' ? 'Isian Singkat' : tipe}
                        </button>
                      ))}
                    </div>

                    {/* Search Input */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-56">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          value={searchQuerySoal}
                          onChange={(e) => { setSearchQuerySoal(e.target.value); setBankSoalPage(1); }}
                          placeholder="Cari pertanyaan..."
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-8 pr-7 py-1.5 rounded-xl text-xs outline-none text-slate-700 dark:text-slate-200"
                        />
                        {searchQuerySoal && (
                          <button
                            onClick={() => setSearchQuerySoal('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* High-Density Question Table */}
                  <div className="w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="py-3 px-4 w-12 text-center">#</th>
                            <th className="py-3 px-4 w-24">Tipe</th>
                            <th className="py-3 px-4">Pertanyaan</th>
                            <th className="py-3 px-4 w-28 text-center">Bobot</th>
                            <th className="py-3 px-4 text-right w-24">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {isSoalLoading ? (
                            <TableSkeleton rows={6} cols={5} asTableRows={true} hasAvatar={false} />
                          ) : paginatedSoal.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8">
                                <EmptyState
                                  compact={true}
                                  icon="quiz"
                                  title="Tidak Ada Butir Soal"
                                  description={searchQuerySoal || filterTipeSoal !== 'ALL' ? 'Tidak ada soal yang cocok dengan filter yang dipilih.' : 'Belum ada soal pada mata pelajaran ini.'}
                                  action={{
                                    label: 'Tambah Soal Baru',
                                    onClick: () => !isSelectedMapelActive && setFormSoal({ isOpen: true, data: null, id_mapel: selectedMapel })
                                  }}
                                />
                              </td>
                            </tr>
                          ) : (
                            paginatedSoal.map((soal, idx) => (
                              <tr key={soal.id_soal || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors group">
                                <td className="py-3 px-4 text-center font-mono text-slate-400 text-xs">
                                  {(bankSoalPage - 1) * itemsPerPageSoal + idx + 1}
                                </td>
                                <td className="py-3 px-4">
                                  {getTipeBadge(soal.tipe_soal || soal.tipe)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="line-clamp-2 font-medium text-slate-800 dark:text-slate-200">
                                    {stripHtml(soal.pertanyaan)}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs">
                                    {soal.bobot || 10} Poin
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => {
                                        if (isSelectedMapelActive) return;
                                        if (soal.tipe_soal === 'NARASI') {
                                          setFormNarasi({ isOpen: true, data: soal });
                                        } else {
                                          setFormSoal({ isOpen: true, data: soal, id_mapel: soal.id_mapel || selectedMapel });
                                        }
                                      }}
                                      disabled={isSelectedMapelActive}
                                      className="p-1.5 text-primary hover:bg-primary/10 dark:hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                                      title={isSelectedMapelActive ? 'Soal terkunci selama ujian berlangsung' : (soal.tipe_soal === 'NARASI' ? 'Edit Narasi Soal' : 'Edit Soal')}
                                    >
                                      <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() => deleteSoal(soal.id_soal)}
                                      disabled={isSelectedMapelActive}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                                      title={isSelectedMapelActive ? 'Soal terkunci selama ujian berlangsung' : 'Hapus Soal'}
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

                    {/* Pagination */}
                    {totalSoalPages > 1 && (
                      <div className="p-3 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-500">
                        <span>Halaman {bankSoalPage} dari {totalSoalPages}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setBankSoalPage(p => Math.max(1, p - 1))}
                            disabled={bankSoalPage === 1}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            Sebelumnya
                          </button>
                          <button
                            onClick={() => setBankSoalPage(p => Math.min(totalSoalPages, p + 1))}
                            disabled={bankSoalPage === totalSoalPages}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            Selanjutnya
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Mata Pelajaran</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar kurikulum mata pelajaran dan bank soal</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                      <button
                        onClick={() => exportDataToExcel('mapel')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                        title="Export Excel"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        <span className="hidden sm:inline">Export</span>
                      </button>
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

                  {/* Filter & Search Bar Mapel */}
                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                      <input
                        type="text"
                        value={searchQueryMapel}
                        onChange={(e) => setSearchQueryMapel(e.target.value)}
                        placeholder="Cari mapel, alokasi kelas, atau agama..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={filterAlokasiMapel}
                        onChange={(e) => setFilterAlokasiMapel(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
                      >
                        <option value="">Semua Alokasi</option>
                        <option value="Semua">Semua Kelas</option>
                        {Array.from(new Set((dataKelas || []).map(k => k.tingkat).filter(Boolean))).sort().map(t => (
                          <option key={t} value={t}>Tingkat {t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mapel Bulk Action Bar */}
                  {selectedMapelBulk.length > 0 && (
                    <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 rounded-xl animate-fade-in">
                      <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        <span className="material-symbols-outlined text-[18px]">check_box</span>
                        <span>{selectedMapelBulk.length} mapel dipilih</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedMapelBulk([])}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                        >
                          Batal
                        </button>
                        <button
                          onClick={() => handleBulkDelete('mapel')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>Hapus Terpilih ({selectedMapelBulk.length})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Select All Checkbox Header */}
                  {sortedFilteredMapel.length > 0 && (
                    <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          aria-label="Pilih Semua Mapel"
                          checked={sortedFilteredMapel.length > 0 && selectedMapelBulk.length === sortedFilteredMapel.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMapelBulk(sortedFilteredMapel.map(m => m.id_mapel));
                            } else {
                              setSelectedMapelBulk([]);
                            }
                          }}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span>Pilih Semua ({sortedFilteredMapel.length} Mapel)</span>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {sortedFilteredMapel.map((m) => (
                      <div
                        key={m.id_mapel}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3"
                      >
                        <input
                          type="checkbox"
                          aria-label={`Pilih mapel ${m.nama_mapel}`}
                          checked={selectedMapelBulk.includes(m.id_mapel)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedMapelBulk(prev => e.target.checked ? [...prev, m.id_mapel] : prev.filter(id => id !== m.id_mapel));
                          }}
                          className="rounded text-primary focus:ring-primary shrink-0"
                        />
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1"
                        >
                          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl">menu_book</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">{m.nama_mapel}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.agama
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}>
                                {m.agama || 'Semua Agama'}
                              </span>
                              {(!m.alokasi_kelas || isUniversalAlloc(m.alokasi_kelas) || splitCompoundTargets(m.alokasi_kelas).length <= 1) ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  m.alokasi_kelas && !isUniversalAlloc(m.alokasi_kelas)
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {m.alokasi_kelas || 'Semua Kelas'}
                                </span>
                              ) : (
                                splitCompoundTargets(m.alokasi_kelas || (m.alokasi_kelas.split(/[,;|]+/))).map((cls, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800"
                                  >
                                    {cls}
                                  </span>
                                ))
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{m.jumlah_soal || 0} Soal Tersedia</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setSkemaModal({ isOpen: true, id_mapel: m.id_mapel })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors"
                            title="Atur Bobot AKM"
                          >
                            <span className="material-symbols-outlined text-[16px]">tune</span>
                            <span className="hidden sm:inline">Bobot AKM</span>
                          </button>
                          <button
                            onClick={() => { setSelectedMapel(m.id_mapel); setBankSoalPage(1); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Kelola Soal"
                          >
                            <span className="material-symbols-outlined text-[16px]">quiz</span>
                            <span className="hidden sm:inline">Kelola Soal</span>
                          </button>
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

                    {sortedFilteredMapel.length === 0 && (
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
                </>
              )}
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
                <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                  <button
                    onClick={() => exportDataToExcel('kelas')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Export Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    onClick={() => setImportModal({ isOpen: true, type: 'kelas' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                    title="Import Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => openCreateModal('kelas')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Tambah Kelas</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar Kelas */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                  <input
                    type="text"
                    value={searchQueryKelas}
                    onChange={(e) => setSearchQueryKelas(e.target.value)}
                    placeholder="Cari tingkat atau nama rombel/paralel..."
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={filterTingkatKelas}
                    onChange={(e) => setFilterTingkatKelas(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="">Semua Tingkat</option>
                    {Array.from(new Set((dataKelas || []).map(k => k.tingkat).filter(Boolean))).sort().map(t => (
                      <option key={t} value={t}>Tingkat {t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kelas Bulk Action Bar */}
              {selectedKelasBulk.length > 0 && (
                <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    <span className="material-symbols-outlined text-[18px]">check_box</span>
                    <span>{selectedKelasBulk.length} kelas dipilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedKelasBulk([])}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleBulkDelete('kelas')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Hapus Terpilih ({selectedKelasBulk.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Select All Checkbox Header */}
              {sortedFilteredKelas.length > 0 && (
                <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      aria-label="Pilih Semua Kelas"
                      checked={sortedFilteredKelas.length > 0 && selectedKelasBulk.length === sortedFilteredKelas.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedKelasBulk(sortedFilteredKelas.map(k => k.id_kelas));
                        } else {
                          setSelectedKelasBulk([]);
                        }
                      }}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span>Pilih Semua ({sortedFilteredKelas.length} Kelas)</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {sortedFilteredKelas.map((k) => (
                  <div
                    key={k.id_kelas}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3"
                  >
                    <input
                      type="checkbox"
                      aria-label={`Pilih kelas ${k.tingkat} ${k.kelas_paralel}`}
                      checked={selectedKelasBulk.includes(k.id_kelas)}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedKelasBulk(prev => e.target.checked ? [...prev, k.id_kelas] : prev.filter(id => id !== k.id_kelas));
                      }}
                      className="rounded text-primary focus:ring-primary shrink-0"
                    />
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

                {sortedFilteredKelas.length === 0 && (
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

                {/* Pengaturan Integrasi Google Drive Webhook (Menggantikan KOP Sekolah) */}
                <div className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="material-symbols-outlined text-primary text-xl">cloud_upload</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">Webhook Google Drive (Gambar Soal)</h4>
                      <p className="text-[11px] text-slate-500">Menyimpan gambar soal ke Google Drive (Zero-Egress Supabase)</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      URL Webhook Google Apps Script
                    </label>
                    <input
                      type="url"
                      value={gasDriveWebhook}
                      onChange={(e) => setGasDriveWebhook(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs dark:bg-slate-900 dark:text-white outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Salin URL Web App dari Google Apps Script (template kode tersedia di folder <code>scripts/google_apps_script_drive_uploader.js</code>).
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isTestingWebhook || !gasDriveWebhook.trim()}
                      onClick={async () => {
                        const url = gasDriveWebhook.trim();
                        if (!url) return;
                        setIsTestingWebhook(true);
                        try {
                          const resp = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({ action: 'test_connection' })
                          });
                          const resJson = await resp.json();
                          if (resJson && resJson.status === 'success') {
                            showMessage('Koneksi Berhasil', 'Webhook Google Drive aktif dan merespons dengan baik.', 'success');
                          } else {
                            showMessage('Respon Webhook', resJson?.message || 'Webhook merespons tetapi status tidak sukses.', 'warning');
                          }
                        } catch (err) {
                          showMessage('Uji Gagal', 'Gagal menghubungi Webhook: ' + err.message + '. Pastikan hak akses diatur ke "Anyone".', 'error');
                        } finally {
                          setIsTestingWebhook(false);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isTestingWebhook ? 'Menguji...' : 'Uji Koneksi'}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingWebhook}
                      onClick={async () => {
                        setIsSavingWebhook(true);
                        try {
                          const url = gasDriveWebhook.trim();
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('nexa_gas_drive_webhook', url);
                          }
                          if (user?.npsn) {
                            await api('update_gas_drive_webhook', { npsn: user.npsn, gas_drive_webhook: url });
                          }
                          showMessage('Berhasil', 'URL Webhook Google Drive berhasil disimpan untuk seluruh sekolah.', 'success');
                        } catch (err) {
                          showMessage('Gagal', err.message || 'Gagal menyimpan Webhook.', 'error');
                        } finally {
                          setIsSavingWebhook(false);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isSavingWebhook ? 'Menyimpan...' : 'Simpan Webhook'}
                    </button>
                  </div>
                </div>

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

          {/* TAB: HASIL & LEGER NILAI SEKOLAH (GURU -> ADMIN) */}
          {activeTab === 'hasil' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-white">Rekap Nilai & Progres Koreksi Guru</h3>
                  <p className="text-xs text-slate-500">Pantau status koreksi uraian guru pengampu dan ekspor leger nilai sekolah.</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchData('hasil')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 self-start"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  <span>Muat Ulang</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase">
                      <th className="p-3 font-bold">Mata Pelajaran</th>
                      <th className="p-3 font-bold">Guru Pengampu</th>
                      <th className="p-3 font-bold">Kelas</th>
                      <th className="p-3 font-bold text-center">Selesai</th>
                      <th className="p-3 font-bold text-center">Status Koreksi Uraian</th>
                      <th className="p-3 font-bold text-center">Rata-Rata</th>
                      <th className="p-3 font-bold text-right">Aksi Leger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {dataRekapHasil.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">Belum ada data jadwal ujian.</td>
                      </tr>
                    ) : dataRekapHasil.map(item => (
                      <tr key={item.id_jadwal} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                        <td className="p-3 font-bold text-slate-800 dark:text-white">{item.nama_mapel}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{item.nama_guru}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{item.target_kelas}</td>
                        <td className="p-3 text-center font-bold">{item.total_selesai} / {item.total_peserta}</td>
                        <td className="p-3 text-center">
                          {!item.has_uraian ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px]">Objektif Saja</span>
                          ) : item.belum_dinilai > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-[10px]">
                              {item.belum_dinilai} Belum Dinilai
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold text-[10px]">
                              Selesai Dikoreksi
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-black text-primary">{item.rata_rata}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                setDetailHasilModal({ isOpen: true, jadwal: item, data: [], isLoading: true });
                                const res = await api('get_hasil_ujian', { id_jadwal: item.id_jadwal, npsn: user.npsn });
                                setDetailHasilModal(prev => ({
                                  ...prev,
                                  isLoading: false,
                                  data: res.status === 'success' ? (res.data || []) : []
                                }));
                              }}
                              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm transition-all"
                            >
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              <span>Lihat Nilai</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setIsLoading(true);
                                const res = await api('get_hasil_ujian', { id_jadwal: item.id_jadwal, npsn: user.npsn });
                                setIsLoading(false);
                                if (res.status === 'success' && (res.data || []).length > 0) {
                                  const rows = res.data.map((r, idx) => ({
                                    No: idx + 1,
                                    NISN: r.nisn,
                                    Nama: r.nama_lengkap,
                                    Kelas: `${r.angkatan || ''} ${r.kelas_paralel || ''}`.trim(),
                                    Nilai_Objektif: r.nilai_auto || 0,
                                    Nilai_Uraian: r.nilai_uraian ?? 'Belum Dinilai',
                                    Total_Nilai: r.total_nilai,
                                    Status: r.is_blocked ? 'TERBLOKIR' : (r.belum_dikoreksi ? 'MENUNGGU KOREKSI' : 'FINAL')
                                  }));
                                  const ws = XLSX.utils.json_to_sheet(rows);
                                  const wb = XLSX.utils.book_new();
                                  XLSX.utils.book_append_sheet(wb, ws, 'Leger Nilai');
                                  XLSX.writeFile(wb, `Leger_${item.nama_mapel}_${item.target_kelas}.xlsx`.replace(/\s+/g, '_'));
                                } else {
                                  showMessage('Info', 'Belum ada peserta yang menyelesaikan ujian ini.', 'info');
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm transition-all"
                            >
                              <span className="material-symbols-outlined text-[14px]">download</span>
                              <span>Leger Excel</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PENGUMUMAN SEKOLAH */}
          {activeTab === 'pengumuman' && (
            <div className="space-y-4 max-w-3xl">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Buat Pengumuman Baru</h3>
                <input
                  type="text"
                  value={pengumumanForm.judul}
                  onChange={(e) => setPengumumanForm(prev => ({ ...prev, judul: e.target.value }))}
                  placeholder="Judul Pengumuman"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                />
                <textarea
                  rows={3}
                  value={pengumumanForm.isi}
                  onChange={(e) => setPengumumanForm(prev => ({ ...prev, isi: e.target.value }))}
                  placeholder="Isi pengumuman untuk siswa..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 dark:bg-slate-900 text-xs sm:text-sm dark:text-white"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!pengumumanForm.judul.trim() || !pengumumanForm.isi.trim()) {
                        showMessage('Peringatan', 'Judul dan isi pengumuman wajib diisi.', 'error');
                        return;
                      }
                      setIsLoading(true);
                      const res = await api('create_pengumuman', {
                        npsn: user.npsn,
                        judul: pengumumanForm.judul.trim(),
                        isi: pengumumanForm.isi.trim()
                      });
                      setIsLoading(false);
                      if (res.status === 'success') {
                        setPengumumanForm({ judul: '', isi: '' });
                        fetchData('pengumuman');
                        showMessage('Berhasil', 'Pengumuman berhasil diterbitkan.', 'success');
                      } else {
                        showMessage('Gagal', res.message || 'Gagal menerbitkan pengumuman.', 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold"
                  >
                    Terbitkan Pengumuman
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {dataPengumuman.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-center text-xs text-slate-400">
                    Belum ada pengumuman aktif.
                  </div>
                ) : dataPengumuman.map(p => (
                  <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{p.judul}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{p.isi}</p>
                      <p className="text-[10px] text-slate-400 mt-2">{p.isGlobal ? 'Super Admin' : 'Admin Sekolah'} • {p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : ''}</p>
                    </div>
                    {!p.isGlobal && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsLoading(true);
                        const res = await api('delete_pengumuman', { id_pengumuman: p.id_pengumuman });
                        setIsLoading(false);
                        if (res.status === 'success') fetchData('pengumuman');
                      }}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Hapus Pengumuman"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modals & Dialogs */}
      {renderFormModal()}
      {renderImportModal()}
      {renderCloneModal()}
      {renderNexaImportModal()}
      {renderDeleteModal()}
      {renderProfileModal()}
      {renderConfirmDialog()}
      {renderPrintKartuModal()}

      {/* Kartu Ujian Print Component rendered outside overflow-hidden container */}

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

      {/* Form Soal Modal */}
      {formSoal.isOpen && (
        <FormSoalModal
          isOpen={formSoal.isOpen}
          data={formSoal.data}
          narasiList={dataSoal.filter(s => s.tipe_soal === 'NARASI')}
          schoolName={user?.nama_sekolah || 'SMA'}
          className={
            dataMapel.find(m => String(m.id_mapel) === String(formSoal.id_mapel || selectedMapel))?.alokasi_kelas ||
            dataMapel.find(m => String(m.id_mapel) === String(formSoal.id_mapel || selectedMapel))?.tingkat ||
            'Semua Kelas'
          }
          subjectName={
            dataMapel.find(m => String(m.id_mapel) === String(formSoal.id_mapel || selectedMapel))?.nama_mapel ||
            'Mata Pelajaran'
          }
          gasWebhookUrl={user?.gas_drive_webhook || (typeof window !== 'undefined' ? localStorage.getItem('nexa_gas_drive_webhook') : '') || ''}
          onClose={() => setFormSoal({ isOpen: false, data: null, id_mapel: '' })}
          onSave={handleSaveSoal}
        />
      )}

      {/* Form Narasi Modal */}
      {formNarasi.isOpen && (
        <FormNarasiModal
          isOpen={formNarasi.isOpen}
          data={formNarasi.data}
          onClose={() => setFormNarasi({ isOpen: false, data: null })}
          onSave={saveSoal}
        />
      )}

      {/* Detail Hasil Ujian Modal */}
      {detailHasilModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-700 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">
                  Rincian Nilai Siswa - {detailHasilModal.jadwal?.nama_mapel}
                </h3>
                <p className="text-xs text-slate-500">
                  Kelas: {detailHasilModal.jadwal?.target_kelas} | Guru: {detailHasilModal.jadwal?.nama_guru}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailHasilModal({ isOpen: false, jadwal: null, data: [], isLoading: false })}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailHasilModal.isLoading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Memuat rincian nilai siswa...</span>
                </div>
              ) : detailHasilModal.data.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada peserta yang menyelesaikan ujian ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase sticky top-0">
                        <th className="p-2.5 font-bold text-center w-12">No</th>
                        <th className="p-2.5 font-bold">Nama Lengkap</th>
                        <th className="p-2.5 font-bold">NISN</th>
                        <th className="p-2.5 font-bold">Kelas</th>
                        <th className="p-2.5 font-bold text-center">Nilai PG</th>
                        <th className="p-2.5 font-bold text-center">Nilai Uraian</th>
                        <th className="p-2.5 font-bold text-center">Total Nilai</th>
                        <th className="p-2.5 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {detailHasilModal.data.map((r, idx) => (
                        <tr key={r.id_log || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                          <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-slate-800 dark:text-white">{r.nama_lengkap}</td>
                          <td className="p-2.5 font-mono text-slate-500">{r.nisn || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-600 dark:text-slate-300">
                            {`${r.angkatan || ''} ${r.kelas_paralel || ''}`.trim() || r.kelas || '-'}
                          </td>
                          <td className="p-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">
                            {r.nilai_auto ?? 0}
                          </td>
                          <td className="p-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">
                            {r.nilai_uraian !== null && r.nilai_uraian !== undefined ? r.nilai_uraian : (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Belum Dinilai</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-black text-primary">
                            {r.total_nilai ?? 0}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.is_blocked ? 'bg-rose-100 text-rose-700' :
                              r.belum_dikoreksi ? 'bg-amber-100 text-amber-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {r.is_blocked ? 'TERBLOKIR' : (r.belum_dikoreksi ? 'MENUNGGU KOREKSI' : 'FINAL')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailHasilModal({ isOpen: false, jadwal: null, data: [], isLoading: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: PENGATURAN SKEMA BOBOT AKM PER MAPEL                      */}
      {/* ================================================================= */}
      {skemaModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 animate-scale-up">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">
                  Pengaturan Bobot AKM — {dataMapel.find(m => m.id_mapel === skemaModal.id_mapel)?.nama_mapel || skemaModal.id_mapel}
                </h3>
                <p className="text-xs text-slate-500">Konfigurasi bobot persentase tipe soal AKM khusus mata pelajaran ini</p>
              </div>
              <button
                type="button"
                onClick={() => setSkemaModal({ isOpen: false, id_mapel: null })}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-5">
              {isAdminMapelSkemaLoading ? (
                <div className="p-8 flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-3xl animate-spin text-primary mb-2">progress_activity</span>
                  <span className="text-xs text-slate-500">Memuat konfigurasi skema bobot mapel...</span>
                </div>
              ) : (
                <SkemaPenilaianPanel
                  dataSoal={adminMapelSkemaData}
                  onSave={handleSaveAdminMapelSkema}
                  schoolDefaultScheme={defaultSkemaSekolah}
                  npsn={user?.npsn || ''}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default AdminView;
