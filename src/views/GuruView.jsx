import { fetchAPI, getTrueNow, get_default_skema_sekolah, get_admin_skema_mapel, isClassMatching, isUniversalAlloc, splitCompoundTargets, cleanTokens, normalizeGrade } from '../api.js';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import FormSoalModal from '../components/FormSoalModal.jsx';
import FormNarasiModal from '../components/FormNarasiModal.jsx';
import ModalPeriksaUraian from '../components/ModalPeriksaUraian.jsx';
import SkemaPenilaianPanel from '../components/SkemaPenilaianPanel.jsx';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
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
  PasswordInput,
  TokenCountdown
} from '../components/UI.jsx';
import { compressImageFile } from '../utils/imageHelper.js';
import { normalizeTipeSoal } from '../utils/nexaBundle.js';

const GuruView = ({ user, onLogout, onUpdateUser, showMessage, isDarkMode, setIsDarkMode }) => {
  const api = (action, p = {}) => {
    if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user?.npsn })));
    return fetchAPI(action, { ...p, npsn: user?.npsn });
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

  // =========================================================================
  // Navigation & Responsive Shell State
  // =========================================================================
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const navigateTab = (tabId) => {
    setActiveTab(tabId);
    setIsMobileDrawerOpen(false);
  };

  // =========================================================================
  // Primary Collections State
  // =========================================================================
  const [dataJadwal, setDataJadwal] = useState([]);
  const [dataAnalisis, setDataAnalisis] = useState([]);
  const [isAnalisisModalOpen, setIsAnalisisModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Avatar & Profile
  const [fotoProfil, setFotoProfil] = useState(user?.foto || user?.foto_profil || '');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ password: '', foto: user?.foto || user?.foto_profil || '' });
  const [profileLoading, setProfileLoading] = useState(false);

  const handleAvatarSelect = async (avatarUrl) => {
    setIsLoading(true);
    const res = await api('update_guru', { id_guru: user.id_guru, npsn: user.npsn, foto: avatarUrl });
    setIsLoading(false);
    if (res.status === 'success') {
      setFotoProfil(avatarUrl);
      setProfileForm(prev => ({ ...prev, foto: avatarUrl }));
      if (onUpdateUser) onUpdateUser({ foto: avatarUrl, foto_profil: avatarUrl });
      setIsAvatarModalOpen(false);
      showMessage('Berhasil', 'Foto profil guru berhasil diperbarui.', 'success');
      logActivity('UPDATE AVATAR', 'Memperbarui foto profil akun guru');
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const saveProfile = async () => {
    setProfileLoading(true);
    const payload = {
      id_guru: user.id_guru,
      npsn: user.npsn,
      foto: profileForm.foto || fotoProfil
    };
    if (profileForm.password && profileForm.password.trim()) {
      payload.password = profileForm.password.trim();
    }
    const res = await api('update_guru', payload);
    setProfileLoading(false);
    if (res.status === 'success') {
      showMessage('Berhasil', 'Profil berhasil diperbarui!', 'success');
      if (payload.foto) setFotoProfil(payload.foto);
      if (payload.password) setProfileForm(prev => ({ ...prev, password: '' }));
      if (onUpdateUser && payload.foto) onUpdateUser({ foto: payload.foto, foto_profil: payload.foto });
      logActivity('UPDATE PROFIL', 'Memperbarui informasi profil guru');
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  // Academic Collections
  const [dataMapel, setDataMapel] = useState([]);
  const [dataKelas, setDataKelas] = useState([]);
  const [selectedMapel, setSelectedMapel] = useState(null);
  const [dataSoal, setDataSoal] = useState([]);

  // Question Bank Filters & Pagination
  const [searchQuerySoal, setSearchQuerySoal] = useState('');
  const [filterTipeSoal, setFilterTipeSoal] = useState('ALL');
  const [bankSoalPage, setBankSoalPage] = useState(1);
  const itemsPerPage = 12;

  // Modals State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [skemaModal, setSkemaModal] = useState({ isOpen: false, id_mapel: null });
  const [schoolDefaultScheme, setSchoolDefaultScheme] = useState(null);
  const [formSoal, setFormSoal] = useState({ isOpen: false, data: null, id_mapel: '' });
  const [formNarasi, setFormNarasi] = useState({ isOpen: false, data: null });
  const [modalUraian, setModalUraian] = useState({ isOpen: false, logUjian: null, jawabanUraian: [] });

  // Evaluation & Results State
  const [filterMapelHasil, setFilterMapelHasil] = useState('ALL');
  const [filterKelasHasil, setFilterKelasHasil] = useState('');
  const [filterParalelHasil, setFilterParalelHasil] = useState([]);
  const [selectedHasilJadwal, setSelectedHasilJadwal] = useState(null);
  const [dataHasilSiswa, setDataHasilSiswa] = useState([]);
  const [isHasilModalOpen, setIsHasilModalOpen] = useState(false);
  const [filterHasilParalelDetail, setFilterHasilParalelDetail] = useState('ALL');
  const [searchHasilSiswa, setSearchHasilSiswa] = useState('');

  // Examination / Manual Essay Grading State (R2)
  const [filterTingkatPeriksa, setFilterTingkatPeriksa] = useState('');
  const [filterParalelPeriksa, setFilterParalelPeriksa] = useState('ALL');
  const [filterMapelPeriksa, setFilterMapelPeriksa] = useState('ALL');
  const [filterStatusKoreksi, setFilterStatusKoreksi] = useState('ALL');
  const [selectedPeriksaJadwal, setSelectedPeriksaJadwal] = useState(null);
  const [dataPeriksaSiswa, setDataPeriksaSiswa] = useState([]);
  const [searchPeriksaSiswa, setSearchPeriksaSiswa] = useState('');
  const [isLoadingPeriksa, setIsLoadingPeriksa] = useState(false);

  // Item Analysis & Student Comparison State (R3)
  const [filterTingkatAnalisis, setFilterTingkatAnalisis] = useState('');
  const [filterParalelAnalisis, setFilterParalelAnalisis] = useState('ALL');
  const [filterMapelAnalisis, setFilterMapelAnalisis] = useState('ALL');
  const [selectedJadwalAnalisis, setSelectedJadwalAnalisis] = useState(null);
  const [dataAnalisisButir, setDataAnalisisButir] = useState({ total_peserta: 0, butir_soal: [] });
  const [isLoadingAnalisis, setIsLoadingAnalisis] = useState(false);
  const [selectedDetailSoal, setSelectedDetailSoal] = useState(null);
  const [filterKelompokAnalisis, setFilterKelompokAnalisis] = useState('ALL');
  const [searchSiswaAnalisis, setSearchSiswaAnalisis] = useState('');

  const fileInputRef = useRef(null);
  const guruId = user?.id_guru || user?.id_user;
  const fetchReqIdRef = useRef(0);

  const guruAssignedKelas = useMemo(() => {
    if (!dataKelas || dataKelas.length === 0) return [];
    const alloc = user?.alokasi_kelas;
    if (alloc && !isUniversalAlloc(alloc)) {
      return dataKelas.filter(k => isClassMatching(alloc, {
        angkatan: k.tingkat,
        kelas_paralel: k.kelas_paralel,
        kelas: `${k.tingkat} ${k.kelas_paralel}`
      }));
    }
    if (dataJadwal && dataJadwal.length > 0) {
      const targets = dataJadwal
        .filter(j => j.id_guru === guruId || dataMapel.some(m => String(m.id_mapel) === String(j.id_mapel)))
        .map(j => j.target_kelas)
        .filter(Boolean);
      if (targets.length > 0) {
        if (targets.some(t => isUniversalAlloc(t))) return dataKelas;
        return dataKelas.filter(k => targets.some(target => isClassMatching(target, {
          angkatan: k.tingkat,
          kelas_paralel: k.kelas_paralel,
          kelas: `${k.tingkat} ${k.kelas_paralel}`
        })));
      }
    }
    return dataKelas;
  }, [dataKelas, user?.alokasi_kelas, dataJadwal, dataMapel, guruId]);

  // =========================================================================
  // Data Fetching
  // =========================================================================
  const fetchData = async () => {
    if (!user?.npsn || !guruId) return;
    const reqId = ++fetchReqIdRef.current;
    setIsLoading(true);
    try {
      const resKelas = await api('get_kelas', {});
      if (reqId !== fetchReqIdRef.current) return;
      if (resKelas.status === 'success') setDataKelas(resKelas.data || []);

      if (activeTab === 'dashboard' || activeTab === 'akun' || activeTab === 'hasil' || activeTab === 'pemeriksaan' || activeTab === 'analisis_soal') {
        const resMapel = await api('get_mapel_guru', { id_guru: guruId });
        if (reqId !== fetchReqIdRef.current) return;
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
        const resJadwal = await api('get_jadwal_pengawas', { id_guru: guruId });
        if (reqId !== fetchReqIdRef.current) return;
        if (resJadwal.status === 'success') setDataJadwal(resJadwal.data || []);
      } else if (activeTab === 'bank_soal') {
        const [res, resJadwal] = await Promise.all([
          api('get_mapel_guru', { id_guru: guruId }),
          api('get_jadwal_pengawas', { id_guru: guruId })
        ]);
        if (reqId !== fetchReqIdRef.current) return;
        if (res.status === 'success') setDataMapel(res.data || []);
        if (resJadwal.status === 'success') setDataJadwal(resJadwal.data || []);

        if (selectedMapel) {
          const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
          if (reqId !== fetchReqIdRef.current) return;
          if (soalRes.status === 'success') setDataSoal(soalRes.data || []);
        }
      }
    } catch (e) {
      console.error('fetchData error:', e);
    }
    if (reqId === fetchReqIdRef.current) setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      api('get_jadwal_pengawas', { id_guru: guruId }).then(resJadwal => {
        if (resJadwal.status === 'success') setDataJadwal(resJadwal.data || []);
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [activeTab, selectedMapel]);

  useEffect(() => {
    if (user?.npsn && selectedMapel) {
      get_admin_skema_mapel(selectedMapel, user.npsn).then(res => {
        if (res) setSchoolDefaultScheme(res);
      }).catch(() => {
        get_default_skema_sekolah(user.npsn).then(res => {
          if (res) setSchoolDefaultScheme(res);
        }).catch(() => {});
      });
    } else if (user?.npsn) {
      get_default_skema_sekolah(user.npsn).then(res => {
        if (res) setSchoolDefaultScheme(res);
      }).catch(() => {});
    }
  }, [user?.npsn, selectedMapel]);

  useEffect(() => {
    if (window.MathJax?.typesetPromise) {
      const timer = setTimeout(() => {
        window.MathJax?.typesetPromise?.().catch(err => console.error('MathJax error:', err));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dataSoal, activeTab, bankSoalPage, selectedMapel, modalUraian.isOpen, formSoal.isOpen, isAnalisisModalOpen, isPreviewOpen]);

  // =========================================================================
  // Question Bank Helpers & Memoized Filtering
  // =========================================================================
  const filteredSoal = useMemo(() => {
    return dataSoal.filter(s => {
      if (s.tipe_soal === 'SKEMA_PENILAIAN' || s.tipe_soal === 'SKEMA_DEFAULT' || s.tipe_soal === 'MAPEL_ALLOC') return false; // Ensure s.tipe_soal !== 'SKEMA_PENILAIAN'

      // Filter Tipe Soal (PG, PGK, JODOH, URAIAN, SEMUA)
      if (filterTipeSoal && filterTipeSoal !== 'ALL' && filterTipeSoal !== 'SEMUA') {
        const t = (s.tipe_soal || s.tipe || '').toUpperCase();
        if (t !== filterTipeSoal.toUpperCase()) return false;
      }

      // Text search in questions
      if (searchQuerySoal && searchQuerySoal.trim()) {
        const q = searchQuerySoal.toLowerCase();
        const content = (s.pertanyaan || '').toLowerCase();
        const id = (s.id_soal || '').toLowerCase();
        if (!content.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [dataSoal, filterTipeSoal, searchQuerySoal]);

  // Paginated Question Bank
  const totalSoalPages = Math.ceil(filteredSoal.length / itemsPerPage) || 1;
  const paginatedSoal = useMemo(() => {
    const start = (bankSoalPage - 1) * itemsPerPage;
    return filteredSoal.slice(start, start + itemsPerPage);
  }, [filteredSoal, bankSoalPage, itemsPerPage]);

  const MAPEL_COLORS = [
    { bg: 'bg-primary/10 dark:bg-primary/10', text: 'text-primary dark:text-primary-400', border: 'border-primary/30/60 dark:border-primary/30', icon: 'bg-primary/15 dark:bg-primary/15 text-primary dark:text-primary-300' },
    { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200/60 dark:border-blue-800/60', icon: 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300' },
    { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200/60 dark:border-purple-800/60', icon: 'bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300' },
    { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/60 dark:border-amber-800/60', icon: 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300' },
    { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200/60 dark:border-rose-800/60', icon: 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300' },
    { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200/60 dark:border-cyan-800/60', icon: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-600 dark:text-cyan-300' }
  ];

  const getMapelColor = (idx) => MAPEL_COLORS[idx % MAPEL_COLORS.length];

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
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/60">NARASI SOAL</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{t}</span>;
    }
  };

  const stripHtml = (html) => {
    if (!html) return '-';
    return html.replace(/<[^>]*>?/gm, '').trim();
  };

  // =========================================================================
  // Question Bank Actions (Import, Export, CRUD)
  // =========================================================================
  const downloadTemplateSoal = () => {
    const templateData = [
      { tipe_soal: 'NARASI', pertanyaan: 'Bacalah teks berikut untuk menjawab soal nomor 1 dan 2:\nPembelajaran berbasis digital meningkatkan efektivitas belajar siswa.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: '', bobot: 0, kd: '3.1', narasi_soal: '', id_narasi: 'WACANA-1' },
      { tipe_soal: 'PG',    pertanyaan: 'Hasil dari 5 + 7 adalah...', opsi_A: '10', opsi_B: '11', opsi_C: '12', opsi_D: '13', opsi_E: '14', kunci_jawaban: 'C', bobot: 10, kd: '3.1', narasi_soal: '', id_narasi: 'WACANA-1' },
      { tipe_soal: 'PGK',   pertanyaan: 'Manakah yang merupakan bilangan prima genap?', opsi_A: '2', opsi_B: '4', opsi_C: '6', opsi_D: '8', opsi_E: '10', kunci_jawaban: 'A,B', bobot: 10, kd: '3.1', narasi_soal: '', id_narasi: '' },
      { tipe_soal: 'BS',    pertanyaan: 'Bumi mengelilingi Matahari.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Benar', bobot: 5, kd: '3.1', narasi_soal: '', id_narasi: '' },
      { tipe_soal: 'JODOH', pertanyaan: 'Pasangkan ibukota negara berikut:', opsi_A: 'Indonesia = Jakarta', opsi_B: 'Jepang = Tokyo', opsi_C: 'Inggris = London', opsi_D: '', opsi_E: '', kunci_jawaban: 'Indonesia=Jakarta, Jepang=Tokyo, Inggris=London', bobot: 15, kd: '3.2', narasi_soal: '', id_narasi: '' },
      { tipe_soal: 'ISIAN', pertanyaan: 'Ibukota Indonesia adalah...', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Jakarta', bobot: 10, kd: '3.2', narasi_soal: '', id_narasi: '' },
      { tipe_soal: 'URAIAN', pertanyaan: 'Jelaskan hukum kekekalan energi secara singkat.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Energi tidak dapat diciptakan atau dimusnahkan, hanya berubah bentuk.', bobot: 20, kd: '3.3', narasi_soal: '', id_narasi: '' },
    ];
    const petunjukData = [
      { Kolom: 'tipe_soal',     Keterangan: 'Wajib. Isi dengan: NARASI, PG, PGK, BS, JODOH, ISIAN, atau URAIAN' },
      { Kolom: 'pertanyaan',    Keterangan: 'Wajib (kecuali jika tipe NARASI, teks wacana diletakkan di pertanyaan atau narasi_soal).' },
      { Kolom: 'opsi_A - E',   Keterangan: 'Untuk PG/PGK: teks pilihan. Untuk JODOH: format "Premis = Respon". Kosongkan untuk NARASI.' },
      { Kolom: 'kunci_jawaban', Keterangan: 'PG: huruf A/B/C/D/E. PGK: pisah koma (A,B). BS: Benar/Salah. JODOH: "P=R, P2=R2". ISIAN/URAIAN: teks kunci. Kosongkan untuk NARASI.' },
      { Kolom: 'bobot',         Keterangan: 'Angka bobot soal (default 10 jika kosong; otomatis 0 untuk NARASI).' },
      { Kolom: 'kd',            Keterangan: 'Kode Dasar / KD, contoh: 3.1 (opsional).' },
      { Kolom: 'id_narasi',     Keterangan: 'ID grup narasi/wacana untuk menautkan butir soal dengan stimulus wacana (opsional).' },
      { Kolom: 'narasi_soal',   Keterangan: 'Teks narasi/wacana pendahulu soal (opsional).' },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateData), 'Template Soal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(petunjukData), 'Petunjuk');
    XLSX.writeFile(wb, 'Template_Soal_NEXA_CBT.xlsx');
  };

  // Helper normalisasi nama kolom Excel dari berbagai format guru
  const normalizeExcelRow = (row) => {
    const norm = {};
    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s_\-]+/g, '');
      norm[cleanKey] = val;
    }
    const getVal = (...aliases) => {
      for (const a of aliases) {
        const cleanA = a.toLowerCase().replace(/[\s_\-]+/g, '');
        if (norm[cleanA] !== undefined && norm[cleanA] !== null && String(norm[cleanA]).trim() !== '') {
          return norm[cleanA];
        }
      }
      return '';
    };
    return {
      tipe_soal: String(getVal('tipe_soal', 'tipesoal', 'tipe', 'jenis', 'jenissoal') || 'PG').toUpperCase(),
      pertanyaan: String(getVal('pertanyaan', 'soal', 'tekssoal', 'butirsoal', 'question')),
      opsi_A: String(getVal('opsi_A', 'opsia', 'pilihana', 'a', 'jawaban_a', 'optiona')),
      opsi_B: String(getVal('opsi_B', 'opsib', 'pilihanb', 'b', 'jawaban_b', 'optionb')),
      opsi_C: String(getVal('opsi_C', 'opsic', 'pilihanc', 'c', 'jawaban_c', 'optionc')),
      opsi_D: String(getVal('opsi_D', 'opsid', 'pilihand', 'd', 'jawaban_d', 'optiond')),
      opsi_E: String(getVal('opsi_E', 'opsie', 'pilihane', 'e', 'jawaban_e', 'optione')),
      kunci_jawaban: String(getVal('kunci_jawaban', 'kuncijawaban', 'kunci', 'jawaban', 'answer', 'key')),
      bobot: parseInt(getVal('bobot', 'skor', 'nilai', 'poin', 'score')) || 10,
      kd: String(getVal('kd', 'kompetensidasar')),
      id_narasi: String(getVal('id_narasi', 'idnarasi', 'narasiid', 'stimulusid', 'grupnarasi')),
      narasi_soal: String(getVal('narasi_soal', 'narasisoal', 'narasi', 'wacana', 'stimulus'))
    };
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
    reader.onerror = () => {
      setIsLoading(false);
      showMessage('Gagal', 'Gagal membaca file Excel.', 'error');
    };
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws);

        const validRows = (rawData || []).map(normalizeExcelRow).filter(r => r && (String(r.pertanyaan || '').trim() !== '' || String(r.narasi_soal || '').trim() !== '' || String(r.tipe_soal || '').trim() !== ''));
        if (validRows.length === 0) {
          showMessage('Peringatan', 'File Excel kosong atau format tidak sesuai.', 'error');
          return;
        }

        let activeNarasiId = null;

        const payloadData = validRows.map((row, idx) => {
          const rawTipe = (row.tipe_soal || '').toUpperCase().trim();
          const isExplicitNarasi = rawTipe === 'NARASI' || (!row.pertanyaan && row.narasi_soal);
          const tipe = isExplicitNarasi ? 'NARASI' : normalizeTipeSoal(row.tipe_soal || 'PG');

          let finalKunci = row.kunci_jawaban ? String(row.kunci_jawaban).trim() : '';
          let opsiStr = null;
          let finalPertanyaan = (row.pertanyaan || '').trim();

          if (tipe === 'NARASI') {
            finalPertanyaan = finalPertanyaan || (row.narasi_soal || '').trim();
            finalKunci = '';
            opsiStr = null;
          } else {
            if (row.id_narasi) {
              activeNarasiId = row.id_narasi;
            }
          }

          if (tipe === 'PG') {
            const map = { A: row.opsi_A, B: row.opsi_B, C: row.opsi_C, D: row.opsi_D, E: row.opsi_E };
            finalKunci = map[finalKunci.toUpperCase()] || finalKunci;
          } else if (tipe === 'PGK') {
            try {
              const keys = finalKunci.split(',').map(k => k.trim());
              const mappedKeys = keys.map(k => {
                const upperK = k.toUpperCase();
                if (upperK === 'A') return row.opsi_A;
                if (upperK === 'B') return row.opsi_B;
                if (upperK === 'C') return row.opsi_C;
                if (upperK === 'D') return row.opsi_D;
                if (upperK === 'E') return row.opsi_E;
                return k;
              });
              finalKunci = JSON.stringify(mappedKeys);
            } catch (_) {}
          } else if (tipe === 'JODOH') {
            let premis = [];
            let respon = [];
            let kunci = {};
            const parseJodoh = (val) => {
              if (!val) return;
              const parts = String(val).split('=');
              if (parts.length === 2) {
                const p = parts[0].trim();
                const r = parts[1].trim();
                if (p && !premis.includes(p)) premis.push(p);
                if (r && !respon.includes(r)) respon.push(r);
                if (p && r && !kunci[p]) kunci[p] = r;
              }
            };
            parseJodoh(row.opsi_A); parseJodoh(row.opsi_B); parseJodoh(row.opsi_C); parseJodoh(row.opsi_D); parseJodoh(row.opsi_E);
            opsiStr = JSON.stringify({ premis, respon });

            if (finalKunci) {
              const explicitKunci = {};
              String(finalKunci).split(',').forEach(pair => {
                const parts = pair.split('=');
                if (parts.length === 2) {
                  explicitKunci[parts[0].trim()] = parts[1].trim();
                }
              });
              finalKunci = JSON.stringify(Object.keys(explicitKunci).length > 0 ? explicitKunci : kunci);
            } else {
              finalKunci = JSON.stringify(kunci);
            }
          }

          if (tipe === 'PG' || tipe === 'PGK') {
            opsiStr = JSON.stringify([
              row.opsi_A || '',
              row.opsi_B || '',
              row.opsi_C || '',
              row.opsi_D || '',
              row.opsi_E || ''
            ]);
          } else if (tipe === 'BS' && !opsiStr) {
            opsiStr = JSON.stringify(['Benar', 'Salah']);
          }

          const uniqueId = `SOAL-${selectedMapel}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${idx}`;

          return {
            id_soal: uniqueId,
            id_mapel: selectedMapel,
            npsn: user.npsn,
            tipe_soal: tipe,
            pertanyaan: finalPertanyaan,
            opsi: opsiStr,
            kunci_jawaban: finalKunci ? String(finalKunci) : '',
            bobot: tipe === 'NARASI' ? 0 : (Number(row.bobot) || 10),
            id_narasi: tipe === 'NARASI' ? (row.id_narasi || uniqueId) : (row.id_narasi || activeNarasiId || null)
          };
        });

        setIsLoading(true);
        const res = await api('import_soal_bulk', { data: payloadData, npsn: user.npsn });
        setIsLoading(false);
        if (res.status === 'success') {
          showMessage('Berhasil', `${payloadData.length} soal berhasil diimpor!`, 'success');
          const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
          logActivity('IMPORT SOAL', `Import ${payloadData.length} butir soal Excel pada mapel ${mapelNama}`);
          fetchData();
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

  const handleSaveSoal = async (soalData) => {
    setIsLoading(true);
    let endpoint = formSoal.data ? 'update_soal_mapel' : 'create_soal_mapel';
    let payload = {
      ...soalData,
      npsn: user.npsn,
      id_mapel: formSoal.id_mapel || selectedMapel
    };
    if (formSoal.data) {
      payload.id_soal = formSoal.data.id_soal;
    } else {
      payload.id_soal = 'SOAL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    const res = await api(endpoint, payload);
    setIsLoading(false);
    if (res.status === 'success') {
      setFormSoal({ isOpen: false, data: null, id_mapel: '' });
      const actName = formSoal.data ? 'EDIT SOAL' : 'TAMBAH SOAL';
      const mapelNama = dataMapel.find(m => m.id_mapel === payload.id_mapel)?.nama_mapel || payload.id_mapel;
      logActivity(actName, `${actName} (${payload.tipe_soal}) pada mapel ${mapelNama}`);
      fetchData();
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
      setFormSoal({ isOpen: false, data: null });
      setFormNarasi({ isOpen: false, data: null });
      const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
      logActivity(payload.id_soal ? 'EDIT NARASI SOAL' : 'TAMBAH NARASI SOAL', `Menyimpan narasi soal pada mapel ${mapelNama}`);
      fetchData();
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const isSelectedMapelActive = Boolean(
    selectedMapel && (dataJadwal || []).some(j => String(j.id_mapel) === String(selectedMapel) && j.status_ujian === 'AKTIF')
  );

  const deleteSoal = async (id) => {
    if (isSelectedMapelActive) {
      showMessage('Soal Terkunci', 'Tidak dapat menghapus soal karena jadwal ujian mapel ini sedang AKTIF berlangsung.', 'error');
      return;
    }
    if (!confirm('Hapus butir soal ini?')) return;
    // ponytail: confirm() — GuruView belum punya confirmDialog state, biarkan sementara
    setIsLoading(true);
    const res = await api('delete_soal_mapel', { id_soal: id });
    setIsLoading(false);
    if (res.status === 'success') {
      logActivity('HAPUS SOAL', `Menghapus butir soal ID ${id}`);
      fetchData();
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const saveSkema = async (payload, applyToAll = false) => {
    setIsLoading(true);
    if (applyToAll) {
      const idMapels = (dataMapel || []).map(m => m.id_mapel).filter(Boolean);
      if (idMapels.length === 0) {
        setIsLoading(false);
        showMessage('Peringatan', 'Tidak ada mata pelajaran yang diampu ditemukan.', 'error');
        return;
      }
      const res = await api('save_skema_penilaian', {
        role: 'guru',
        id_guru: user?.id_guru || user?.id,
        id_mapels: idMapels,
        npsn: user.npsn,
        kunci_jawaban: payload.kunci_jawaban,
        bobot: payload.bobot,
        mode: payload.mode,
        skema: payload.skema
      });
      setIsLoading(false);
      if (res.status === 'success') {
        showMessage('Berhasil', `Skema penilaian berhasil diterapkan ke semua (${idMapels.length}) mapel yang Anda ampu.`, 'success');
        setSkemaModal({ isOpen: false, id_mapel: null });
        logActivity('SKEMA PENILAIAN BULK', `Menerapkan skema penilaian serentak ke ${idMapels.length} mata pelajaran`);
        fetchData();
      } else {
        showMessage('Gagal', res.message || 'Gagal menyimpan skema penilaian serentak.', 'error');
      }
      return;
    }

    const res = await api('save_skema_penilaian', {
      role: 'guru',
      id_guru: user?.id_guru || user?.id,
      id_mapel: selectedMapel,
      npsn: user.npsn,
      kunci_jawaban: payload.kunci_jawaban,
      bobot: payload.bobot,
      mode: payload.mode,
      skema: payload.skema
    });
    setIsLoading(false);
    if (res.status === 'success') {
      showMessage('Berhasil', 'Skema penilaian berhasil disimpan.', 'success');
      setSkemaModal({ isOpen: false, id_mapel: null });
      const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
      logActivity('SKEMA PENILAIAN', `Menyimpan skema bobot penilaian mapel ${mapelNama}`);
      fetchData();
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  // Evaluation & Grading Command Center
  // =========================================================================
  const openDetailHasil = async (jadwal) => {
    const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(jadwal?.id_mapel));
    if (!isTaughtSubject) {
      showMessage('Akses Terbatas', 'Anda hanya berhak mengakses rekap nilai evaluasi untuk mata pelajaran yang Anda ampu.', 'info');
      return;
    }
    setSelectedHasilJadwal(jadwal);
    setIsLoading(true);
    const res = await api('get_hasil_ujian', { id_jadwal: jadwal.id_jadwal, id_guru: guruId });
    setIsLoading(false);
    if (res.status === 'success') {
      setDataHasilSiswa(res.data || []);
      setIsHasilModalOpen(true);
    } else {
      showMessage('Gagal', 'Gagal memuat rekap nilai: ' + res.message, 'error');
    }
  };

  const openKoreksiUraianJadwal = async (jadwal) => {
    const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(jadwal?.id_mapel));
    if (!isTaughtSubject) {
      showMessage('Akses Terbatas', 'Anda hanya berhak mengakses koreksi uraian untuk mata pelajaran yang Anda ampu.', 'info');
      return;
    }
    setSelectedHasilJadwal(jadwal);
    setIsLoading(true);
    const res = await api('get_hasil_ujian', { id_jadwal: jadwal.id_jadwal, id_guru: guruId });
    setIsLoading(false);
    if (res.status === 'success') {
      const students = res.data || [];
      setDataHasilSiswa(students);
      const unrated = students.find(s =>
        !s.is_blocked &&
        (s.status_ujian === 'SELESAI' || Number(s.total_dijawab) > 0) &&
        (s.nilai_uraian === null || s.nilai_uraian === undefined)
      );
      if (unrated) {
        openPeriksaUraian(unrated);
      } else if (students.length > 0) {
        openPeriksaUraian(students[0]);
      } else {
        showMessage('Info', 'Belum ada siswa yang menyelesaikan ujian ini.', 'info');
      }
    } else {
      showMessage('Gagal', 'Gagal memuat rekap nilai: ' + res.message, 'error');
    }
  };

  const loadPeriksaQueue = async (jadwal) => {
    if (!jadwal) {
      setSelectedPeriksaJadwal(null);
      setDataPeriksaSiswa([]);
      return;
    }
    const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(jadwal?.id_mapel));
    if (!isTaughtSubject) {
      showMessage('Akses Terbatas', 'Anda hanya berhak memeriksa ujian untuk mata pelajaran yang Anda ampu.', 'info');
      return;
    }
    setSelectedPeriksaJadwal(jadwal);
    setIsLoadingPeriksa(true);
    const res = await api('get_hasil_ujian', { id_jadwal: jadwal.id_jadwal, id_guru: guruId });
    setIsLoadingPeriksa(false);
    if (res.status === 'success') {
      setDataPeriksaSiswa(res.data || []);
    } else {
      showMessage('Gagal', 'Gagal memuat antrean pemeriksaan: ' + res.message, 'error');
    }
  };

  const loadAnalisisButir = async (jadwal, tingkat = filterTingkatAnalisis, paralel = filterParalelAnalisis) => {
    if (!jadwal) {
      setSelectedJadwalAnalisis(null);
      setDataAnalisisButir({ total_peserta: 0, butir_soal: [] });
      setSelectedDetailSoal(null);
      return;
    }
    const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(jadwal?.id_mapel));
    if (!isTaughtSubject) {
      showMessage('Akses Terbatas', 'Anda hanya berhak melihat analisis butir soal untuk mata pelajaran yang Anda ampu.', 'info');
      return;
    }
    setSelectedJadwalAnalisis(jadwal);
    setSelectedDetailSoal(null);
    setIsLoadingAnalisis(true);
    const res = await api('get_analisis_butir_soal', {
      id_jadwal: jadwal.id_jadwal,
      id_mapel: jadwal.id_mapel,
      id_guru: guruId,
      tingkat: tingkat || undefined,
      kelas_paralel: paralel !== 'ALL' ? paralel : undefined
    });
    setIsLoadingAnalisis(false);
    if (res.status === 'success') {
      const resultData = res.data?.butir_soal
        ? res.data
        : { total_peserta: res.total_peserta || 0, butir_soal: Array.isArray(res.data) ? res.data : [] };
      setDataAnalisisButir(resultData);
    } else {
      showMessage('Gagal', 'Gagal memuat analisis butir soal: ' + res.message, 'error');
    }
  };

  const openAnalisisSoal = async (idJadwal, idMapel) => {
    const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(idMapel));
    if (!isTaughtSubject) {
      showMessage('Akses Terbatas', 'Anda hanya berhak mengakses analisis butir soal untuk mata pelajaran yang Anda ampu.', 'info');
      return;
    }
    const targetJadwal = dataJadwal.find(j => j.id_jadwal === idJadwal);
    if (targetJadwal) {
      navigateTab('analisis_soal');
      loadAnalisisButir(targetJadwal);
      return;
    }
    setIsLoading(true);
    const res = await api('get_analisis_soal', { id_jadwal: idJadwal, id_mapel: idMapel });
    setIsLoading(false);
    if (res.status === 'success') {
      const items = Array.isArray(res.data) ? res.data : (res.data?.butir_soal || []);
      setDataAnalisis(items);
      setIsAnalisisModalOpen(true);
    } else {
      showMessage('Gagal', 'Gagal mengambil analisis: ' + res.message, 'error');
    }
  };

  const openPeriksaUraian = async (logData) => {
    setIsLoading(true);
    const res = await api('get_jawaban_uraian', { id_log: logData.id_log });
    setIsLoading(false);
    if (res.status === 'success') {
      setModalUraian({ isOpen: true, logUjian: logData, jawabanUraian: res.data || [] });
    } else {
      showMessage('Gagal', 'Gagal mengambil jawaban uraian: ' + res.message, 'error');
    }
  };

  const saveNilaiUraian = async (totalNilai, isNext = false, detailSkor = []) => {
    if (!modalUraian.logUjian) return;
    const currentIdLog = modalUraian.logUjian.id_log;
    setIsLoading(true);
    const res = await api('update_nilai_uraian', {
      id_log: currentIdLog,
      nilai_uraian_total: totalNilai,
      detail_skor: detailSkor
    });
    setIsLoading(false);
    if (res.status === 'success') {
      logActivity('NILAI URAIAN', `Memberikan nilai uraian siswa pada sesi ${currentIdLog} skor ${totalNilai}`);

      let updatedList = (dataHasilSiswa || []).map(s => {
        if (s.id_log === currentIdLog) {
          const pg = Number(s.nilai_auto) || 0;
          return {
            ...s,
            nilai_uraian: totalNilai,
            total_nilai: s.is_blocked ? 0 : Math.min(100, Math.round((pg + totalNilai) * 100) / 100)
          };
        }
        return s;
      });

      const targetJadwalId = selectedHasilJadwal?.id_jadwal || selectedPeriksaJadwal?.id_jadwal || modalUraian.logUjian?.id_jadwal;
      if (targetJadwalId) {
        const refreshRes = await api('get_hasil_ujian', { id_jadwal: targetJadwalId, id_guru: guruId });
        if (refreshRes.status === 'success' && Array.isArray(refreshRes.data)) {
          updatedList = refreshRes.data;
          setDataHasilSiswa(updatedList);
          setDataPeriksaSiswa(updatedList);
        }
      } else {
        setDataHasilSiswa(updatedList);
        setDataPeriksaSiswa(prev => (prev || []).map(s => {
          if (s.id_log === currentIdLog) {
            const pg = Number(s.nilai_auto) || 0;
            return {
              ...s,
              nilai_uraian: totalNilai,
              total_nilai: s.is_blocked ? 0 : Math.min(100, Math.round((pg + totalNilai) * 100) / 100)
            };
          }
          return s;
        }));
      }

      if (isNext) {
        const nextStudent = updatedList.find(s =>
          !s.is_blocked &&
          (s.status_ujian === 'SELESAI' || Number(s.total_dijawab) > 0) &&
          s.id_log !== currentIdLog &&
          (s.nilai_uraian === null || s.nilai_uraian === undefined)
        );
        if (nextStudent) {
          openPeriksaUraian(nextStudent);
          return;
        } else {
          showMessage('Selesai', 'Semua jawaban uraian untuk ujian ini telah dinilai.', 'success');
        }
      }

      setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] });
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const exportHasilToExcel = (jadwal, studentsList, filterParalel) => {
    if (!studentsList || studentsList.length === 0) {
      { showMessage('Info', 'Tidak ada data nilai untuk diexport.', 'error'); return; }
    }

    const exportRows = studentsList.map((s, idx) => ({
      'Peringkat': idx + 1,
      'NISN': s.nisn || '-',
      'Nama Siswa': s.nama_lengkap,
      'Tingkat': s.angkatan || jadwal.target_kelas || '-',
      'Kelas Paralel': s.kelas_paralel ? `Paralel ${s.kelas_paralel}` : '-',
      'Nilai PG': Number(s.nilai_auto) || 0,
      'Nilai Uraian': Number(s.nilai_uraian) || 0,
      'Total Nilai': Number(s.total_nilai) || 0,
      'Status': (Number(s.total_nilai) || 0) >= 75 ? 'Tuntas' : 'Remedial'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai');

    const cleanMapel = (jadwal.nama_mapel || 'Ujian').replace(/[^a-zA-Z0-9]/g, '_');
    const paralelSuffix = filterParalel && filterParalel !== 'ALL' ? `_Paralel_${filterParalel}` : '';
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Rekap_Nilai_${cleanMapel}${paralelSuffix}_${dateStr}.xlsx`);
    logActivity('EXPORT REKAP', `Mengunduh berkas Excel rekap nilai ujian ${jadwal.nama_mapel}`);
  };

  // =========================================================================
  // Navigation Taxonomy Definitions & Dashboard Metrics
  // =========================================================================
  const totalQuestionsCount = useMemo(() => {
    return dataMapel.reduce((sum, m) => sum + parseInt(m.jumlah_soal || m.total_soal || 0), 0);
  }, [dataMapel]);

  const activeExamsCount = useMemo(() => {
    return dataJadwal.filter(j => j.status_ujian === 'AKTIF').length;
  }, [dataJadwal]);

  const navGroups = [
    {
      title: 'Utama',
      items: [
        { id: 'dashboard', label: 'Beranda Guru', icon: 'dashboard' }
      ]
    },
    {
      title: 'Akademik',
      items: [
        { id: 'bank_soal', label: 'Bank Soal & Narasi', icon: 'quiz' },
        { id: 'pemeriksaan', label: 'Pemeriksaan Uraian', icon: 'draw' },
        { id: 'analisis_soal', label: 'Analisis Butir Soal', icon: 'analytics' },
        { id: 'hasil', label: 'Hasil & Rekap Nilai', icon: 'assessment' }
      ]
    },
    {
      title: 'Sistem',
      items: [
        { id: 'akun', label: 'Profil Guru', icon: 'person' }
      ]
    }
  ];

  const bottomBarItems = [
    { id: 'dashboard', label: 'Beranda', icon: 'dashboard' },
    { id: 'bank_soal', label: 'Bank Soal', icon: 'quiz' },
    { id: 'pemeriksaan', label: 'Pemeriksaan Uraian', icon: 'draw' },
    { id: 'analisis_soal', label: 'Analisis Butir Soal', icon: 'analytics' },
    { id: 'hasil', label: 'Rekap Nilai', icon: 'assessment' },
    { id: 'akun', label: 'Profil', icon: 'person' }
  ];

  const tabTitleMap = {
    dashboard: 'Beranda Guru',
    bank_soal: 'Bank Soal & Narasi',
    pemeriksaan: 'Pemeriksaan Manual Uraian',
    analisis_soal: 'Analisis Butir Soal',
    hasil: 'Hasil & Rekap Evaluasi',
    akun: 'Pengaturan Profil'
  };

  const tabSubtitleMap = {
    dashboard: 'Ringkasan tugas mengajar, pembuatan soal, dan status penilaian',
    bank_soal: 'Kelola butir soal evaluasi, narasi soal stimulus, dan skema penilaian',
    pemeriksaan: 'Penilaian dan pemberian skor jawaban uraian siswa secara manual',
    analisis_soal: 'Evaluasi tingkat kesukaran, daya pembeda, dan perbandingan respon siswa',
    hasil: 'Rekapitulasi nilai, antrean koreksi uraian, dan analisis butir soal',
    akun: 'Kelola foto profil, avatar, dan keamanan akun guru'
  };

  // =========================================================================
  // Clean Modals (Without Phantom Classes)
  // =========================================================================
  const renderPreviewModal = () => {
    if (!isPreviewOpen) return null;
    const narasiMap = {};
    dataSoal.filter(s => s.tipe_soal === 'NARASI').forEach(n => { narasiMap[n.id_soal] = n; });
    const previewSoalList = filteredSoal.filter(s => s.tipe_soal !== 'NARASI');
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 dark:border-slate-700 animate-scale-up">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">Pratinjau Butir Soal</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Menampilkan {previewSoalList.length} soal aktif pada mata pelajaran ini</p>
            </div>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {previewSoalList.map((soal, idx) => {
              const tipe = normalizeTipeSoal(soal.tipe_soal || 'PG');
              const linkedNarasi = soal.id_narasi ? narasiMap[soal.id_narasi] : null;
              return (
              <div key={soal.id_soal || idx} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 shadow-xs space-y-3">
                <div className="font-bold text-sm flex justify-between items-center">
                  <span className="text-slate-800 dark:text-slate-200">Soal No. {idx + 1} ({tipe})</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Bobot: {soal.bobot || 10}
                  </span>
                </div>
                {linkedNarasi && (
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: linkedNarasi.pertanyaan }} />
                )}
                {soal.gambar && (
                  <img src={soal.gambar} alt="Gambar Soal" className="max-h-56 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain" />
                )}
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />
                {tipe === 'PG' && soal.opsi && Array.isArray(soal.opsi) && (
                  <div className="space-y-1.5 pt-1">
                    {soal.opsi.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-2.5 rounded-lg border text-xs sm:text-sm ${soal.kunci_jawaban === opt ? 'bg-primary/10 border-primary dark:bg-primary/10 text-primary-800 dark:text-primary-200 font-semibold' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                        <span dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : opt.teks }} />
                      </div>
                    ))}
                  </div>
                )}
                {tipe === 'PGK' && soal.opsi && Array.isArray(soal.opsi) && (
                  <div className="space-y-1.5 pt-1">
                    {soal.opsi.map((opt, oIdx) => {
                      const kunciArr = typeof soal.kunci_jawaban === 'string' && soal.kunci_jawaban.trim().startsWith('[')
                        ? (() => { try { return JSON.parse(soal.kunci_jawaban); } catch { return []; } })()
                        : String(soal.kunci_jawaban || '').split(',').map(s => s.trim());
                      const isChecked = Array.isArray(kunciArr) && kunciArr.includes(opt);
                      return (
                        <div key={oIdx} className={`p-2.5 rounded-lg border text-xs sm:text-sm ${isChecked ? 'bg-primary/10 border-primary dark:bg-primary/10 text-primary-800 dark:text-primary-200 font-semibold' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                          <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                          <span dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : opt.teks }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {tipe === 'BS' && (
                  <div className="flex gap-2 pt-1">
                    {['Benar', 'Salah'].map(val => (
                      <div key={val} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${String(soal.kunci_jawaban || '').trim().toLowerCase() === val.toLowerCase() ? 'bg-primary/10 border-primary text-primary-800 dark:text-primary-200' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {val}
                      </div>
                    ))}
                  </div>
                )}
                {tipe === 'JODOH' && soal.opsi && typeof soal.opsi === 'object' && (
                  <div className="space-y-1.5 pt-1 text-xs">
                    {(soal.opsi.premis || []).map((p, pIdx) => {
                      const kObj = (() => { try { return typeof soal.kunci_jawaban === 'object' ? soal.kunci_jawaban : JSON.parse(soal.kunci_jawaban || '{}'); } catch { return {}; } })();
                      return (
                        <div key={pIdx} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{p}</span>
                          <span className="text-primary font-bold">&rarr; {kObj[p] || '-'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {tipe === 'ISIAN' && (
                  <div className="mt-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                    <span className="text-slate-500">Kunci Isian: </span>
                    <strong className="text-primary">{soal.kunci_jawaban || '-'}</strong>
                  </div>
                )}
                {tipe === 'URAIAN' && (
                  <div className="mt-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 italic text-xs">Kolom input jawaban uraian siswa...</span>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalisisModal = () => {
    if (!isAnalisisModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-[200] animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl p-5 sm:p-6 relative border border-slate-200 dark:border-slate-800 h-full max-h-[92vh] flex flex-col animate-scale-up">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
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

  if (!user) return null;

  return (
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
              <span className="material-symbols-outlined text-2xl">local_library</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-black text-sm text-slate-800 dark:text-white leading-tight truncate">
                  {user.nama_sekolah || 'NEXA CBT'}
                </h1>
                <p className="text-[11px] font-bold text-primary dark:text-primary-400 truncate">
                  Portal Guru
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

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div
              onClick={() => setIsAvatarModalOpen(true)}
              className="w-9 h-9 rounded-lg overflow-hidden border border-primary/40 shrink-0 cursor-pointer"
              title="Ganti Avatar"
            >
              {fotoProfil ? (
                <img src={fotoProfil} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/15 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs">
                  {(user.nama_lengkap || 'G').charAt(0)}
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{user.nama_lengkap}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.nip ? `NIP: ${user.nip}` : 'Guru Pengampu'}</p>
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
            onClick={() => setIsMobileDrawerOpen(true)}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all min-w-[44px] min-h-[44px]"
            aria-label="Buka Menu Navigasi"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <span className="material-symbols-outlined text-xl">local_library</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight truncate">
                Portal Guru
              </h1>
              <p className="text-[10px] text-primary dark:text-primary-400 font-bold uppercase tracking-wider truncate">
                {user.nama_lengkap}
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
            {fotoProfil ? (
              <img src={fotoProfil} alt="Profile" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="w-full h-full bg-primary/15 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs rounded-lg">
                {(user.nama_lengkap || 'G').charAt(0)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MOBILE OFF-CANVAS SLIDE-OVER DRAWER (< 1024px)                     */}
      {/* ================================================================= */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-80 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-800 z-10 animate-fade-in-up">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">local_library</span>
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight">NEXA CBT</h2>
                  <p className="text-[10px] text-slate-400">Navigasi Guru</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
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
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTab(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] min-w-[44px] transition-colors ${
                isActive
                  ? 'text-primary dark:text-primary-400 font-bold'
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
              {tabSubtitleMap[activeTab] || 'Kelola dan pantau aktivitas belajar mengajar CBT NEXA'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30 dark:border-primary/30 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse"></span>
              <span>Sistem Online</span>
            </div>
          </div>
        </header>

        {/* Main Content Body with Natural Scrolling */}
        <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 pb-28 lg:pb-12">

          {/* ================= TAB 1: DASHBOARD ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-3.5 sm:space-y-4 animate-fade-in-up">
              {/* Compact 3-Column Metric Cards */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                <div
                  onClick={() => navigateTab('bank_soal')}
                  className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg sm:text-xl">library_books</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">
                      <span className="hidden sm:inline">Mapel Ditugaskan</span>
                      <span className="sm:hidden">Mapel</span>
                    </p>
                    <h4 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight">{dataMapel.length}</h4>
                  </div>
                </div>

                <div
                  onClick={() => navigateTab('bank_soal')}
                  className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg sm:text-xl">quiz</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">
                      <span className="hidden sm:inline">Total Soal Dibuat</span>
                      <span className="sm:hidden">Total Soal</span>
                    </p>
                    <h4 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight">{totalQuestionsCount}</h4>
                  </div>
                </div>

                <div
                  onClick={() => navigateTab('hasil')}
                  className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:border-amber-500/50 hover:shadow-sm transition-all group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg sm:text-xl">assessment</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">
                      <span className="hidden sm:inline">Hasil & Rekap Nilai</span>
                      <span className="sm:hidden">Rekap Nilai</span>
                    </p>
                    <h4 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight">Evaluasi</h4>
                  </div>
                </div>
              </div>

              {/* 2-Column Desktop Split: lg:grid-cols-12 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
                {/* Left Column (lg:col-span-7): Mata Pelajaran & Bank Soal List */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700/60">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-base">bar_chart</span>
                      Daftar Mata Pelajaran & Bank Soal
                    </h4>
                    <button
                      onClick={() => navigateTab('bank_soal')}
                      className="text-[11px] font-bold text-primary hover:text-primary-700 transition-colors"
                    >
                      Buka Semua Soal →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {dataMapel.map((m, idx) => {
                      const color = getMapelColor(idx);
                      const count = parseInt(m.jumlah_soal || m.total_soal || 0);
                      return (
                        <div
                          key={m.id_mapel || idx}
                          className="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${color.icon}`}>
                              <span className="material-symbols-outlined text-base">menu_book</span>
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-slate-800 dark:text-white truncate">{m.nama_mapel}</h5>
                              <p className="text-[10px] text-slate-400 truncate">{m.kode_mapel || m.id_mapel}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {count} Soal
                            </span>
                            <button
                              onClick={() => { setSelectedMapel(m.id_mapel); navigateTab('bank_soal'); }}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 font-bold text-[11px] hover:bg-primary/15 transition-colors flex items-center gap-0.5"
                            >
                              <span>Kelola</span>
                              <span className="material-symbols-outlined text-xs">arrow_forward</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {dataMapel.length === 0 && (
                      <EmptyState
                        compact={true}
                        icon="menu_book"
                        title="Belum Ada Mata Pelajaran"
                        description="Anda belum memiliki mata pelajaran yang ditugaskan oleh admin sekolah."
                      />
                    )}
                  </div>
                </div>

                {/* Right Column (lg:col-span-5): Quick Actions & Live Exam HUD */}
                <div className="lg:col-span-5 space-y-3.5 sm:space-y-4">
                  {/* Jadwal Ujian Saya (dari Admin) */}
                  <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700/60">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-base">event_upcoming</span>
                        Jadwal Ujian Saya
                      </h4>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {(dataJadwal || []).filter(j => j.status_ujian !== 'SELESAI').length} Aktif/Mendatang
                      </span>
                    </div>
                    {(dataJadwal || []).filter(j => j.status_ujian !== 'SELESAI').length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {(dataJadwal || []).filter(j => j.status_ujian !== 'SELESAI').slice(0, 5).map(j => (
                          <div key={j.id_jadwal} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{j.nama_mapel || '-'}</p>
                              <p className="text-[10px] text-slate-500 truncate">Kelas: {j.target_kelas || '-'} • {j.waktu_mulai ? new Date(j.waktu_mulai).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                              {j.status_ujian === 'AKTIF' && (
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[10px] text-slate-500">Token:</span>
                                  <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    {j.token || j.token_aktif || '-'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard?.writeText(j.token || j.token_aktif || '');
                                      showMessage('Disalin', 'Token ujian berhasil disalin!', 'success');
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    title="Salin Token"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                  </button>
                                  <TokenCountdown lastUpdate={j.last_update_token} intervalMinutes={j.durasi_token_menit || 5} onExpire={() => fetchData()} />
                                </div>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${j.status_ujian === 'AKTIF' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                              {j.status_ujian}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-2">Belum ada jadwal ujian aktif atau mendatang untuk mapel Anda.</p>
                    )}
                  </div>

                  {/* Live Exam HUD Card */}
                  <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700/60">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-base">task_alt</span>
                        Fokus Tugas Guru
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                        <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">quiz</span>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">Bank Soal AKM</p>
                          <p className="text-[11px] text-slate-500">Kelola 6 tipe soal AKM, stimulus narasi, serta import Excel.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                        <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">draw</span>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">Koreksi & Rekap Nilai</p>
                          <p className="text-[11px] text-slate-500">Koreksi jawaban uraian sequential dan ekspor rekap nilai per mata pelajaran.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Card */}
                  <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-700/60">
                      <span className="material-symbols-outlined text-amber-500 text-base">bolt</span>
                      Aksi Cepat
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigateTab('bank_soal')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/10 dark:hover:bg-primary/5 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-primary text-lg mb-1 block group-hover:scale-110 transition-transform">quiz</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Bank Soal</p>
                        <p className="text-[10px] text-slate-400">Kelola butir soal</p>
                      </button>

                      <button
                        onClick={() => navigateTab('hasil')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-amber-500/50 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-amber-600 text-lg mb-1 block group-hover:scale-110 transition-transform">draw</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Koreksi Uraian</p>
                        <p className="text-[10px] text-slate-400">Periksa esai siswa</p>
                      </button>

                      <button
                        onClick={() => navigateTab('hasil')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-primary text-lg mb-1 block group-hover:scale-110 transition-transform">assessment</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Rekap Nilai</p>
                        <p className="text-[10px] text-slate-400">Hasil & evaluasi</p>
                      </button>

                      <button
                        onClick={() => navigateTab('akun')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-slate-400 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-lg mb-1 block group-hover:scale-110 transition-transform">person</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Profil Saya</p>
                        <p className="text-[10px] text-slate-400">Pengaturan akun</p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: BANK SOAL & NARASI ================= */}
          {activeTab === 'bank_soal' && (
            <div className="space-y-5 animate-fade-in-up">
              {!selectedMapel ? (
                /* Mapel Selection Grid */
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Bank Soal: Pilih Mata Pelajaran</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih mata pelajaran untuk membuat, mengedit, dan mengimpor butir soal</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {dataMapel.map((m, idx) => {
                      const color = getMapelColor(idx);
                      const qCount = parseInt(m.jumlah_soal || m.total_soal || 0);
                      return (
                        <div
                          key={m.id_mapel || idx}
                          onClick={() => setSelectedMapel(m.id_mapel)}
                          className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-primary/50 hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color.icon} group-hover:scale-105 transition-transform`}>
                              <span className="material-symbols-outlined text-2xl">library_books</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {qCount} Soal
                            </span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 mb-1">{m.nama_mapel}</h4>
                            <p className="text-[11px] text-slate-400">{m.kode_mapel || 'Klik untuk membuka bank soal'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {dataMapel.length === 0 && (
                    <EmptyState
                      icon="quiz"
                      title="Tidak Ada Mata Pelajaran"
                      description="Hubungi admin sekolah untuk menugaskan mata pelajaran ke akun Anda."
                    />
                  )}
                </div>
              ) : (
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
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30/60 dark:border-primary/30">
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
                        onClick={() => setIsPreviewOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition-colors min-h-[44px]"
                        title="Pratinjau Ujian"
                      >
                        <span className="material-symbols-outlined text-[18px]">preview</span>
                        <span className="hidden sm:inline">Pratinjau</span>
                      </button>
                      <button
                        onClick={() => setSkemaModal({ isOpen: true, id_mapel: selectedMapel })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 hover:bg-primary/20 transition-colors min-h-[44px]"
                        title="Konfigurasi Skema Penilaian"
                      >
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                        <span className="hidden sm:inline">Skema</span>
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

                  {/* DESKTOP HIGH-DENSITY QUESTION TABLE (hidden md:block) */}
                  <div className="hidden md:block w-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
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
                          {isLoading ? (
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
                                  {(bankSoalPage - 1) * itemsPerPage + idx + 1}
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
                  </div>

                  {/* MOBILE COMPACT CARDS (md:hidden - 375px optimized) */}
                  <div className="md:hidden space-y-2.5">
                    {isLoading ? (
                      <TableSkeleton rows={4} cols={3} asTableRows={false} hasAvatar={false} />
                    ) : paginatedSoal.length === 0 ? (
                      <EmptyState
                        compact={true}
                        icon="quiz"
                        title="Tidak Ada Soal"
                        description="Tidak ada soal sesuai filter."
                        action={{
                          label: 'Tambah Soal',
                          onClick: () => setFormSoal({ isOpen: true, data: null, id_mapel: selectedMapel })
                        }}
                      />
                    ) : (
                      paginatedSoal.map((soal, idx) => (
                        <div
                          key={soal.id_soal || idx}
                          className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-slate-400">#{(bankSoalPage - 1) * itemsPerPage + idx + 1}</span>
                              {getTipeBadge(soal.tipe_soal || soal.tipe)}
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                              {soal.bobot || 10} Poin
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {stripHtml(soal.pertanyaan)}
                          </p>
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
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
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 dark:bg-primary/10 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 min-h-[38px]"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => deleteSoal(soal.id_soal)}
                              disabled={isSelectedMapelActive}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 min-h-[38px]"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {totalSoalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-slate-500">
                        Halaman {bankSoalPage} dari {totalSoalPages} ({filteredSoal.length} soal)
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={bankSoalPage === 1}
                          onClick={() => setBankSoalPage(prev => Math.max(1, prev - 1))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 min-h-[38px]"
                        >
                          Sebelumnya
                        </button>
                        <button
                          disabled={bankSoalPage === totalSoalPages}
                          onClick={() => setBankSoalPage(prev => Math.min(totalSoalPages, prev + 1))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 min-h-[38px]"
                        >
                          Selanjutnya
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: PEMERIKSAAN MANUAL URAIAN ================= */}
          {activeTab === 'pemeriksaan' && (() => {
            const periksaTingkatList = Array.from(new Set(guruAssignedKelas.map(k => k.tingkat).filter(Boolean)));
            const periksaParalelList = filterTingkatPeriksa
              ? Array.from(new Set(guruAssignedKelas.filter(k => k.tingkat === filterTingkatPeriksa).map(k => k.kelas_paralel).filter(Boolean)))
              : [];

            const matchingJadwalPeriksa = dataJadwal.filter(j => {
              const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(j.id_mapel));
              if (!isTaughtSubject) return false;
              if (filterMapelPeriksa && filterMapelPeriksa !== 'ALL' && j.nama_mapel !== filterMapelPeriksa) return false;
              if (filterTingkatPeriksa && j.target_kelas && !isUniversalAlloc(j.target_kelas)) {
                const subTargets = splitCompoundTargets(j.target_kelas);
                const selectedGradeNorm = normalizeGrade(filterTingkatPeriksa);
                const matchesGrade = subTargets.some(st => {
                  const tokens = cleanTokens(st, true);
                  return tokens.length > 0 && tokens[0] === selectedGradeNorm;
                });
                if (!matchesGrade) return false;
              }
              if (filterParalelPeriksa && filterParalelPeriksa !== 'ALL' && filterTingkatPeriksa && j.target_kelas && !isUniversalAlloc(j.target_kelas)) {
                const subTargets = splitCompoundTargets(j.target_kelas);
                const matchesParalel = subTargets.some(st => isClassMatching(st, {
                  angkatan: filterTingkatPeriksa,
                  kelas_paralel: filterParalelPeriksa,
                  kelas: `${filterTingkatPeriksa} ${filterParalelPeriksa}`
                }));
                if (!matchesParalel) return false;
              }
              return true;
            });

            let filteredQueue = (dataPeriksaSiswa || []).filter(s => {
              if (s.is_blocked) return false;
              if (filterTingkatPeriksa) {
                const studentGrade = s.angkatan || s.kelas;
                if (studentGrade && normalizeGrade(studentGrade) !== normalizeGrade(filterTingkatPeriksa)) return false;
              }
              if (filterParalelPeriksa && filterParalelPeriksa !== 'ALL') {
                if (s.kelas_paralel !== filterParalelPeriksa) return false;
              }
              if (filterStatusKoreksi === 'BELUM') {
                if (s.nilai_uraian !== null && s.nilai_uraian !== undefined) return false;
              } else if (filterStatusKoreksi === 'SUDAH') {
                if (s.nilai_uraian === null || s.nilai_uraian === undefined) return false;
              }
              if (searchPeriksaSiswa.trim()) {
                const q = searchPeriksaSiswa.toLowerCase();
                const nameMatch = (s.nama_lengkap || '').toLowerCase().includes(q);
                const nisnMatch = (s.nisn || '').toLowerCase().includes(q);
                if (!nameMatch && !nisnMatch) return false;
              }
              return true;
            });

            filteredQueue.sort((a, b) => {
              const aUnrated = a.nilai_uraian === null || a.nilai_uraian === undefined;
              const bUnrated = b.nilai_uraian === null || b.nilai_uraian === undefined;
              if (aUnrated && !bUnrated) return -1;
              if (!aUnrated && bUnrated) return 1;
              return (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '');
            });

            const totalPesertaQueue = dataPeriksaSiswa.length;
            const unratedQueue = dataPeriksaSiswa.filter(s => s.nilai_uraian === null || s.nilai_uraian === undefined);
            const unratedCount = unratedQueue.length;
            const ratedCount = totalPesertaQueue - unratedCount;

            return (
              <div className="space-y-5 animate-fade-in-up">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">draw</span>
                      Pemeriksaan Manual Jawaban Uraian
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Pemberian skor dan rubrik penilaian esai siswa secara manual dan terintegrasi
                    </p>
                  </div>
                </div>

                {/* Filter Cascade Panel */}
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">school</span>
                        Kelas / Tingkat
                      </label>
                      <select
                        value={filterTingkatPeriksa}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilterTingkatPeriksa(val);
                          setFilterParalelPeriksa('ALL');
                          setSelectedPeriksaJadwal(null);
                          setDataPeriksaSiswa([]);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="">-- Pilih Tingkat --</option>
                        {periksaTingkatList.map(t => (
                          <option key={t} value={t}>{t.startsWith('Kelas') || t.startsWith('Tingkat') ? t : `Tingkat ${t}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">splitscreen</span>
                        Kelas Paralel
                      </label>
                      <select
                        value={filterParalelPeriksa}
                        disabled={!filterTingkatPeriksa}
                        onChange={(e) => {
                          setFilterParalelPeriksa(e.target.value);
                          setSelectedPeriksaJadwal(null);
                          setDataPeriksaSiswa([]);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white disabled:opacity-50"
                      >
                        <option value="ALL">Semua Paralel</option>
                        {periksaParalelList.map(p => (
                          <option key={p} value={p}>Kelas {filterTingkatPeriksa} {p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-purple-500">menu_book</span>
                        Mata Pelajaran
                      </label>
                      <select
                        value={filterMapelPeriksa}
                        onChange={(e) => {
                          setFilterMapelPeriksa(e.target.value);
                          setSelectedPeriksaJadwal(null);
                          setDataPeriksaSiswa([]);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="ALL">Semua Mata Pelajaran</option>
                        {dataMapel.map(m => (
                          <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-500">fact_check</span>
                        Status Penilaian
                      </label>
                      <select
                        value={filterStatusKoreksi}
                        onChange={(e) => setFilterStatusKoreksi(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="ALL">Semua Status</option>
                        <option value="BELUM">Belum Dinilai</option>
                        <option value="SUDAH">Sudah Dinilai</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
                      Pilih Jadwal Ujian Uraian:
                    </label>
                    {matchingJadwalPeriksa.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Tidak ada jadwal ujian yang cocok dengan kombinasi filter di atas.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {matchingJadwalPeriksa.map(j => {
                          const isSelected = selectedPeriksaJadwal?.id_jadwal === j.id_jadwal;
                          return (
                            <button
                              key={j.id_jadwal}
                              type="button"
                              onClick={() => loadPeriksaQueue(j)}
                              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/30'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 bg-slate-50/50 dark:bg-slate-800/50'
                              }`}
                            >
                              <div>
                                <span className="font-bold text-xs text-slate-800 dark:text-white line-clamp-1">{j.nama_mapel}</span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Target: {j.target_kelas || 'Semua Kelas'}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                                  {j.status_ujian}
                                </span>
                                <span className="text-primary font-bold">{isSelected ? '✓ Terpilih' : 'Pilih Ujian →'}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {selectedPeriksaJadwal && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-xs font-bold text-slate-400">Total Peserta Selesai</p>
                        <h4 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-1">{totalPesertaQueue}</h4>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">group</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Belum Dinilai</p>
                        <h4 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{unratedCount}</h4>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">pending_actions</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Sudah Dinilai</p>
                        <h4 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{ratedCount}</h4>
                      </div>
                      {unratedCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (unratedQueue.length > 0) openPeriksaUraian(unratedQueue[0]);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                          Koreksi Cepat
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">check_circle</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Daftar Antrean Koreksi Siswa</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedPeriksaJadwal ? `Ujian: ${selectedPeriksaJadwal.nama_mapel}` : 'Pilih salah satu jadwal ujian di atas'}
                      </p>
                    </div>
                    {selectedPeriksaJadwal && (
                      <div className="relative w-full sm:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          placeholder="Cari siswa atau NISN..."
                          value={searchPeriksaSiswa}
                          onChange={(e) => setSearchPeriksaSiswa(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    )}
                  </div>

                  {isLoadingPeriksa ? (
                    <div className="p-8 text-center"><TableSkeleton rows={5} cols={7} /></div>
                  ) : !selectedPeriksaJadwal ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">arrow_upward</span>
                      Silakan pilih salah satu jadwal ujian pada panel di atas untuk menampilkan daftar jawaban siswa.
                    </div>
                  ) : filteredQueue.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">sentiment_neutral</span>
                      Tidak ada data siswa yang cocok dengan filter.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3 w-12 text-center">No</th>
                            <th className="p-3">Siswa &amp; NISN</th>
                            <th className="p-3">Kelas &amp; Paralel</th>
                            <th className="p-3 text-center">Nilai PG (Auto)</th>
                            <th className="p-3 text-center">Nilai Uraian</th>
                            <th className="p-3 text-center">Total Nilai</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {filteredQueue.map((s, idx) => {
                            const isRated = s.nilai_uraian !== null && s.nilai_uraian !== undefined;
                            return (
                              <tr key={s.id_log} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                                <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-800 dark:text-white">{s.nama_lengkap}</div>
                                  <div className="text-[11px] text-slate-400">NISN: {s.nisn || '-'}</div>
                                </td>
                                <td className="p-3 font-semibold text-slate-600 dark:text-slate-300">
                                  {s.kelas || `${s.angkatan} ${s.kelas_paralel}`}
                                </td>
                                <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-200">
                                  {Number(s.nilai_auto) || 0}
                                </td>
                                <td className="p-3 text-center font-bold">
                                  {isRated ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">{s.nilai_uraian}</span>
                                  ) : (
                                    <span className="text-slate-400 italic">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-center font-bold text-primary">
                                  {s.total_nilai ?? (Number(s.nilai_auto) || 0) + (Number(s.nilai_uraian) || 0)}
                                </td>
                                <td className="p-3 text-center">
                                  {isRated ? (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                      Sudah Dinilai
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                                      Belum Dinilai
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => openPeriksaUraian(s)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 mx-auto active:scale-95 ${
                                      isRated
                                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                                        : 'bg-primary hover:bg-primary/90 text-white'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[15px]">{isRated ? 'edit' : 'draw'}</span>
                                    <span>{isRated ? 'Ubah Nilai' : 'Koreksi'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ================= TAB 4: ANALISIS BUTIR SOAL ================= */}
          {activeTab === 'analisis_soal' && (() => {
            const analisisTingkatList = Array.from(new Set(guruAssignedKelas.map(k => k.tingkat).filter(Boolean)));
            const analisisParalelList = filterTingkatAnalisis
              ? Array.from(new Set(guruAssignedKelas.filter(k => k.tingkat === filterTingkatAnalisis).map(k => k.kelas_paralel).filter(Boolean)))
              : [];

            const matchingJadwalAnalisis = dataJadwal.filter(j => {
              const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(j.id_mapel));
              if (!isTaughtSubject) return false;
              if (filterMapelAnalisis && filterMapelAnalisis !== 'ALL' && j.nama_mapel !== filterMapelAnalisis) return false;
              if (filterTingkatAnalisis && j.target_kelas && !isUniversalAlloc(j.target_kelas)) {
                const subTargets = splitCompoundTargets(j.target_kelas);
                const selectedGradeNorm = normalizeGrade(filterTingkatAnalisis);
                const matchesGrade = subTargets.some(st => {
                  const tokens = cleanTokens(st, true);
                  return tokens.length > 0 && tokens[0] === selectedGradeNorm;
                });
                if (!matchesGrade) return false;
              }
              if (filterParalelAnalisis && filterParalelAnalisis !== 'ALL' && filterTingkatAnalisis && j.target_kelas && !isUniversalAlloc(j.target_kelas)) {
                const subTargets = splitCompoundTargets(j.target_kelas);
                const matchesParalel = subTargets.some(st => isClassMatching(st, {
                  angkatan: filterTingkatAnalisis,
                  kelas_paralel: filterParalelAnalisis,
                  kelas: `${filterTingkatAnalisis} ${filterParalelAnalisis}`
                }));
                if (!matchesParalel) return false;
              }
              return true;
            });

            const itemsList = dataAnalisisButir?.butir_soal || [];
            const totalPeserta = dataAnalisisButir?.total_peserta || 0;

            return (
              <div className="space-y-5 animate-fade-in-up">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">analytics</span>
                    Analisis Butir Soal &amp; Komparasi Respon Siswa
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Evaluasi psikometrik tingkat kesukaran ($P$), daya pembeda ($D$), dan peninjauan detail perbandingan respon siswa vs kunci jawaban
                  </p>
                </div>

                {/* Filter Cascade Panel */}
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">school</span>
                        Kelas / Tingkat
                      </label>
                      <select
                        value={filterTingkatAnalisis}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilterTingkatAnalisis(val);
                          setFilterParalelAnalisis('ALL');
                          setSelectedJadwalAnalisis(null);
                          setSelectedDetailSoal(null);
                          setDataAnalisisButir({ total_peserta: 0, butir_soal: [] });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="">-- Pilih Tingkat --</option>
                        {analisisTingkatList.map(t => (
                          <option key={t} value={t}>{t.startsWith('Kelas') || t.startsWith('Tingkat') ? t : `Tingkat ${t}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">splitscreen</span>
                        Kelas Paralel
                      </label>
                      <select
                        value={filterParalelAnalisis}
                        disabled={!filterTingkatAnalisis}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilterParalelAnalisis(val);
                          if (selectedJadwalAnalisis) {
                            loadAnalisisButir(selectedJadwalAnalisis, filterTingkatAnalisis, val);
                          }
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white disabled:opacity-50"
                      >
                        <option value="ALL">Semua Paralel</option>
                        {analisisParalelList.map(p => (
                          <option key={p} value={p}>Kelas {filterTingkatAnalisis} {p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-purple-500">menu_book</span>
                        Mata Pelajaran
                      </label>
                      <select
                        value={filterMapelAnalisis}
                        onChange={(e) => {
                          setFilterMapelAnalisis(e.target.value);
                          setSelectedJadwalAnalisis(null);
                          setSelectedDetailSoal(null);
                          setDataAnalisisButir({ total_peserta: 0, butir_soal: [] });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="ALL">Semua Mata Pelajaran</option>
                        {dataMapel.map(m => (
                          <option key={m.id_mapel} value={m.nama_mapel}>{m.nama_mapel}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">assessment</span>
                      Pilih Ujian untuk Dianalisis:
                    </label>
                    {matchingJadwalAnalisis.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Tidak ada jadwal ujian yang cocok dengan pilihan filter.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {matchingJadwalAnalisis.map(j => {
                          const isSelected = selectedJadwalAnalisis?.id_jadwal === j.id_jadwal;
                          return (
                            <button
                              key={j.id_jadwal}
                              type="button"
                              onClick={() => loadAnalisisButir(j)}
                              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/30'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 bg-slate-50/50 dark:bg-slate-800/50'
                              }`}
                            >
                              <div>
                                <span className="font-bold text-xs text-slate-800 dark:text-white line-clamp-1">{j.nama_mapel}</span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Target: {j.target_kelas || 'Semua Kelas'}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                                  {j.status_ujian}
                                </span>
                                <span className="text-primary font-bold">{isSelected ? '✓ Terpilih' : 'Pilih Ujian →'}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {selectedDetailSoal ? (() => {
                  let studentComparisonList = selectedDetailSoal.komparasi_siswa || [];
                  if (filterKelompokAnalisis === 'ATAS') {
                    studentComparisonList = studentComparisonList.filter(s => s.kelompok === 'ATAS');
                  } else if (filterKelompokAnalisis === 'BAWAH') {
                    studentComparisonList = studentComparisonList.filter(s => s.kelompok === 'BAWAH');
                  } else if (filterKelompokAnalisis === 'SALAH') {
                    studentComparisonList = studentComparisonList.filter(s => !s.is_correct);
                  }
                  if (searchSiswaAnalisis.trim()) {
                    const q = searchSiswaAnalisis.toLowerCase();
                    studentComparisonList = studentComparisonList.filter(s =>
                      (s.nama_lengkap || '').toLowerCase().includes(q) || (s.kelas || '').toLowerCase().includes(q)
                    );
                  }

                  const pVal = selectedDetailSoal.tingkat_kesukaran?.indeks ?? 0;
                  const pKlas = selectedDetailSoal.tingkat_kesukaran?.klasifikasi || 'Sedang';
                  const dVal = selectedDetailSoal.daya_pembeda?.indeks;
                  const dKlas = selectedDetailSoal.daya_pembeda?.klasifikasi || 'Tidak Cukup Data';
                  const dMetode = selectedDetailSoal.daya_pembeda?.metode || '-';

                  return (
                    <div className="space-y-4 animate-scale-up">
                      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailSoal(null)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                          Kembali ke Ringkasan Butir Soal
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">Soal #{selectedDetailSoal.nomor_soal}</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary">
                            {selectedDetailSoal.tipe_soal}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pertanyaan / Stimulus:</span>
                          <div
                            className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60"
                            dangerouslySetInnerHTML={{ __html: selectedDetailSoal.pertanyaan || '-' }}
                          />
                        </div>

                        <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">key</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                              Kunci Jawaban Resmi / Rubrik Acuan:
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap pl-6">
                            {typeof selectedDetailSoal.kunci_jawaban === 'object'
                              ? JSON.stringify(selectedDetailSoal.kunci_jawaban, null, 2)
                              : String(selectedDetailSoal.kunci_jawaban || '-')}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Tingkat Kesukaran (P):</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{pVal}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pKlas === 'Mudah' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' :
                              pKlas === 'Sedang' ? 'bg-primary/10 text-primary-700 dark:bg-primary/20 dark:text-primary-300' :
                              'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}>
                              {pKlas}
                            </span>
                          </div>

                          <span className="text-slate-300 dark:text-slate-600">|</span>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Daya Pembeda (D):</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{dVal !== null ? dVal : '-'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              dKlas === 'Sangat Baik' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                              dKlas === 'Baik' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' :
                              dKlas === 'Cukup' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                              dKlas === 'Buruk' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' :
                              'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}>
                              {dKlas}
                            </span>
                            <span className="text-[10px] text-slate-400">({dMetode})</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setFilterKelompokAnalisis('ALL')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterKelompokAnalisis === 'ALL'
                                  ? 'bg-primary text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              Semua Siswa ({selectedDetailSoal.komparasi_siswa?.length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={() => setFilterKelompokAnalisis('SALAH')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterKelompokAnalisis === 'SALAH'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              Hanya Salah ({selectedDetailSoal.komparasi_siswa?.filter(s => !s.is_correct).length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={() => setFilterKelompokAnalisis('ATAS')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterKelompokAnalisis === 'ATAS'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              Kelompok Atas ({selectedDetailSoal.komparasi_siswa?.filter(s => s.kelompok === 'ATAS').length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={() => setFilterKelompokAnalisis('BAWAH')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterKelompokAnalisis === 'BAWAH'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              Kelompok Bawah ({selectedDetailSoal.komparasi_siswa?.filter(s => s.kelompok === 'BAWAH').length || 0})
                            </button>
                          </div>

                          <div className="relative w-full sm:w-56">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                            <input
                              type="text"
                              placeholder="Cari siswa / kelas..."
                              value={searchSiswaAnalisis}
                              onChange={(e) => setSearchSiswaAnalisis(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                        </div>

                        {studentComparisonList.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">
                            Tidak ada respon siswa pada kriteria filter ini.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                  <th className="p-3 w-12 text-center">No</th>
                                  <th className="p-3">Siswa &amp; Kelas</th>
                                  <th className="p-3 text-center">Kelompok</th>
                                  <th className="p-3 w-1/3">Jawaban Siswa</th>
                                  <th className="p-3 w-1/3">Kunci Jawaban Resmi</th>
                                  <th className="p-3 text-center">Kesesuaian</th>
                                  <th className="p-3 text-center">Skor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {studentComparisonList.map((st, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                                    <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-800 dark:text-white">{st.nama_lengkap}</div>
                                      <div className="text-[11px] text-slate-400">{st.kelas}</div>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        st.kelompok === 'ATAS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                        st.kelompok === 'BAWAH' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                      }`}>
                                        {st.kelompok}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-28 overflow-y-auto">
                                        {st.jawaban_user}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 text-xs font-mono text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap max-h-28 overflow-y-auto">
                                        {typeof st.kunci_jawaban === 'object' ? JSON.stringify(st.kunci_jawaban) : String(st.kunci_jawaban)}
                                      </div>
                                    </td>
                                    <td className="p-3 text-center">
                                      {st.is_correct ? (
                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                          Sesuai (Benar)
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">cancel</span>
                                          Tidak Sesuai
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-200">
                                      {st.skor_diperoleh}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Daftar Evaluasi Butir Soal</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedJadwalAnalisis ? `Ujian: ${selectedJadwalAnalisis.nama_mapel} • Total Peserta: ${totalPeserta} Siswa` : 'Pilih ujian pada panel di atas'}
                        </p>
                      </div>
                    </div>

                    {isLoadingAnalisis ? (
                      <div className="p-8 text-center"><TableSkeleton rows={5} cols={8} /></div>
                    ) : !selectedJadwalAnalisis ? (
                      <div className="p-12 text-center text-slate-400 text-sm">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">arrow_upward</span>
                        Silakan pilih jadwal ujian pada panel di atas untuk melihat analisis butir soal.
                      </div>
                    ) : itemsList.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-sm">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">description</span>
                        Belum ada data pengerjaan atau butir soal untuk dianalisis pada jadwal ini.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="p-3 w-12 text-center">No</th>
                              <th className="p-3 text-center">Tipe</th>
                              <th className="p-3 w-1/3">Pertanyaan</th>
                              <th className="p-3 text-center">Bobot</th>
                              <th className="p-3 text-center">Benar / Salah</th>
                              <th className="p-3 text-center">Tingkat Kesukaran (P)</th>
                              <th className="p-3 text-center">Daya Pembeda (D)</th>
                              <th className="p-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {itemsList.map((item, idx) => {
                              const P = item.tingkat_kesukaran?.indeks ?? 0;
                              const pKlas = item.tingkat_kesukaran?.klasifikasi || 'Sedang';
                              const D = item.daya_pembeda?.indeks;
                              const dKlas = item.daya_pembeda?.klasifikasi || 'Tidak Cukup Data';
                              const dMetode = item.daya_pembeda?.metode || '';

                              return (
                                <tr key={item.id_soal || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                                  <td className="p-3 text-center text-slate-400 font-bold">{item.nomor_soal || idx + 1}</td>
                                  <td className="p-3 text-center">
                                    <span className="bg-primary/10 text-primary dark:text-primary-400 px-2 py-0.5 rounded text-[11px] font-bold">
                                      {item.tipe_soal}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div
                                      className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200 max-w-sm"
                                      dangerouslySetInnerHTML={{ __html: item.pertanyaan || '-' }}
                                    />
                                  </td>
                                  <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                                    {item.bobot || 10}
                                  </td>
                                  <td className="p-3 text-center font-semibold">
                                    <span className="text-emerald-600 dark:text-emerald-400">{item.jumlah_benar ?? item.correct ?? 0}</span>
                                    <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                                    <span className="text-rose-600 dark:text-rose-400">{item.jumlah_salah ?? item.wrong ?? 0}</span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="font-bold text-xs">{P}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        pKlas === 'Mudah' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' :
                                        pKlas === 'Sedang' ? 'bg-primary/10 text-primary-700 dark:bg-primary/20 dark:text-primary-300' :
                                        'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                      }`}>
                                        {pKlas}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="font-bold text-xs">{D !== null ? D : '-'}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        dKlas === 'Sangat Baik' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                                        dKlas === 'Baik' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' :
                                        dKlas === 'Cukup' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                                        dKlas === 'Buruk' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' :
                                        'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                      }`}>
                                        {dKlas}
                                      </span>
                                      {dMetode && <span className="text-[9px] text-slate-400">({dMetode})</span>}
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDetailSoal(item)}
                                      className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 mx-auto active:scale-95"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">compare_arrows</span>
                                      <span>Komparasi</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ================= TAB 6: HASIL & EVALUASI ================= */}
          {activeTab === 'hasil' && (() => {
            const tingkatList = Array.from(new Set(guruAssignedKelas.map(k => k.tingkat).filter(Boolean)));
            const availableParalels = filterKelasHasil && filterKelasHasil !== 'Umum'
              ? Array.from(new Set(guruAssignedKelas.filter(k => k.tingkat === filterKelasHasil).map(k => k.kelas_paralel).filter(Boolean)))
              : [];

            const filteredJadwalHasil = dataJadwal.filter(j => {
              if (j.status_ujian !== 'SELESAI' && !(Number(j.total_selesai) > 0)) return false;
              // Strict Scoping: Guru only accesses evaluation for subjects they teach
              const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(j.id_mapel));
              if (!isTaughtSubject) return false;
              if (filterMapelHasil && filterMapelHasil !== 'ALL' && j.nama_mapel !== filterMapelHasil) return false;
              if (filterKelasHasil && filterKelasHasil !== 'Umum') {
                if (j.target_kelas && !isUniversalAlloc(j.target_kelas)) {
                  const subTargets = splitCompoundTargets(j.target_kelas);
                  const selectedGradeNorm = normalizeGrade(filterKelasHasil);
                  const matchesGrade = subTargets.some(st => {
                    const tokens = cleanTokens(st, true);
                    return tokens.length > 0 && tokens[0] === selectedGradeNorm;
                  });
                  if (!matchesGrade) return false;
                }
              }
              if (filterParalelHasil.length > 0 && filterKelasHasil && filterKelasHasil !== 'Umum') {
                if (j.target_kelas && !isUniversalAlloc(j.target_kelas)) {
                  const subTargets = splitCompoundTargets(j.target_kelas);
                  const matchesParalel = subTargets.some(st => {
                    return filterParalelHasil.some(p => isClassMatching(st, {
                      angkatan: filterKelasHasil,
                      kelas_paralel: p,
                      kelas: `${filterKelasHasil} ${p}`
                    }));
                  });
                  if (!matchesParalel) return false;
                }
              }
              return true;
            });

            return (
              <div className="space-y-5 animate-fade-in-up">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Hasil & Rekap Nilai Evaluasi</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih tingkat kelas dan mata pelajaran untuk melihat rekapitulasi nilai dan peringkat siswa</p>
                </div>

                {/* Filter Box */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          const allP = guruAssignedKelas.filter(k => k.tingkat === val).map(k => k.kelas_paralel).filter(Boolean);
                          setFilterParalelHasil(Array.from(new Set(allP)));
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="">-- Pilih Kelas / Tingkat --</option>
                        {tingkatList.map(t => (
                          <option key={t} value={t}>{t.startsWith('Kelas') || t.startsWith('Tingkat') ? t : `Tingkat ${t}`}</option>
                        ))}
                        {(!user?.alokasi_kelas || isUniversalAlloc(user?.alokasi_kelas)) && (
                          <option value="Umum">Umum / Semua Tingkat</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-purple-500">menu_book</span>
                        Mata Pelajaran
                      </label>
                      <select
                        value={filterMapelHasil}
                        onChange={(e) => setFilterMapelHasil(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-500">splitscreen</span>
                          Pilih Kelas Paralel <span className="text-[11px] font-normal text-slate-400">(Boleh pilih lebih dari satu)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allP = guruAssignedKelas.filter(k => k.tingkat === filterKelasHasil).map(k => k.kelas_paralel).filter(Boolean);
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
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border min-h-[38px] ${
                                  isSelected
                                    ? 'bg-primary text-white border-primary shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
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
                    </div>
                  )}
                </div>

                {/* Content Section: Finished Exams Cards */}
                {!filterKelasHasil ? (
                  <EmptyState
                    icon="assessment"
                    title="Pilih Kelas / Tingkat Terlebih Dahulu"
                    description="Silakan pilih tingkat kelas dan mata pelajaran di atas untuk menampilkan hasil rekap nilai evaluasi."
                  />
                ) : filteredJadwalHasil.length === 0 ? (
                  <EmptyState
                    icon="event_busy"
                    title="Belum Ada Ujian Selesai"
                    description="Belum ada data pelaksanaan ujian yang selesai pada kelas dan mata pelajaran yang dipilih."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredJadwalHasil.map(j => (
                      <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">{j.nama_mapel}</h4>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                j.status_ujian === 'SELESAI'
                                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/60'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                              }`}>
                                {j.status_ujian === 'SELESAI' ? 'SELESAI' : 'AKTIF'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                <span>Koreksi Uraian</span>
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500">
                            Tingkat: {j.target_kelas || 'Umum'} | Waktu: {new Date(j.waktu_mulai).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <button
                            onClick={() => openDetailHasil(j)}
                            className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                          >
                            <span className="material-symbols-outlined text-[16px]">leaderboard</span>
                            <span>Buka Rekap & Ranking</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openKoreksiUraianJadwal(j)}
                            className="py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold text-xs transition-colors flex items-center justify-center gap-1 min-h-[44px]"
                            title="Koreksi Jawaban Uraian Siswa"
                          >
                            <span className="material-symbols-outlined text-[16px]">draw</span>
                            <span className="hidden sm:inline">Koreksi Uraian</span>
                          </button>
                          <button
                            onClick={() => openAnalisisSoal(j.id_jadwal, j.id_mapel)}
                            className="py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 hover:bg-purple-100 font-bold text-xs transition-colors flex items-center justify-center gap-1 min-h-[44px]"
                            title="Analisis Butir Soal"
                          >
                            <span className="material-symbols-outlined text-[16px]">analytics</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ================= TAB 8: PROFIL GURU ================= */}
          {activeTab === 'akun' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Pengaturan Akun & Profil</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola informasi pribadi, foto avatar, dan keamanan password Anda</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/40 cursor-pointer shrink-0 relative group"
                    title="Klik untuk memilih avatar"
                  >
                    {fotoProfil ? (
                      <img src={fotoProfil} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/15 dark:bg-primary/10 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-2xl">
                        {(user.nama_lengkap || 'G').charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-800 dark:text-white">{user.nama_lengkap}</h4>
                    <p className="text-xs text-slate-400">{user.nip ? `NIP: ${user.nip}` : 'Tenaga Pengajar'}</p>
                    <p className="text-xs text-primary dark:text-primary-400 font-semibold mt-1">
                      NPSN: {user.npsn}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Password Baru (Kosongkan jika tidak ingin mengubah)
                    </label>
                    <PasswordInput
                      placeholder="Masukkan password baru..."
                      value={profileForm.password}
                      onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAvatarModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
                    >
                      Pilih Avatar Karakter
                    </button>
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={profileLoading}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                    >
                      {profileLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ================================================================= */}
      {/* MODAL: DETAIL HASIL EVALUASI & REKAP NILAI SISWA                   */}
      {/* ================================================================= */}
      {isHasilModalOpen && selectedHasilJadwal && (() => {
        const uniqueParalelsInResult = Array.from(new Set(dataHasilSiswa.map(s => s.kelas_paralel).filter(Boolean)));

        let filteredSiswa = dataHasilSiswa.filter(s => {
          if (filterKelasHasil && filterKelasHasil !== 'Umum') {
            const studentGrade = s.angkatan || s.kelas;
            if (studentGrade && normalizeGrade(studentGrade) !== normalizeGrade(filterKelasHasil)) {
              if (selectedHasilJadwal?.target_kelas && isClassMatching(selectedHasilJadwal.target_kelas, s)) {
                // Sesuai target jadwal
              } else {
                return false;
              }
            }
          }
          if (filterHasilParalelDetail !== 'ALL' && s.kelas_paralel !== filterHasilParalelDetail) return false;
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

        // Urutkan nilai tertinggi ke terendah (Ranking)
        filteredSiswa.sort((a, b) => (Number(b.total_nilai) || 0) - (Number(a.total_nilai) || 0));

        const totalPeserta = filteredSiswa.length;
        const rataNilai = totalPeserta > 0 ? (filteredSiswa.reduce((sum, s) => sum + (Number(s.total_nilai) || 0), 0) / totalPeserta).toFixed(1) : 0;
        const nilaiTertinggi = totalPeserta > 0 ? Math.max(...filteredSiswa.map(s => Number(s.total_nilai) || 0)) : 0;
        const nilaiTerendah = totalPeserta > 0 ? Math.min(...filteredSiswa.map(s => Number(s.total_nilai) || 0)) : 0;
        const tuntasCount = filteredSiswa.filter(s => (Number(s.total_nilai) || 0) >= 75).length;
        const persentaseTuntas = totalPeserta > 0 ? Math.round((tuntasCount / totalPeserta) * 100) : 0;

        const hasUraian = dataHasilSiswa.length > 0 && dataHasilSiswa[0].has_uraian !== undefined
          ? Boolean(dataHasilSiswa[0].has_uraian)
          : true;

        const unratedStudents = hasUraian ? dataHasilSiswa.filter(s =>
          !s.is_blocked &&
          (s.status_ujian === 'SELESAI' || Number(s.total_dijawab) > 0) &&
          (s.nilai_uraian === null || s.nilai_uraian === undefined)
        ) : [];
        const unratedCount = unratedStudents.length;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-[150] animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] animate-scale-up">

              {/* Header Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsHasilModalOpen(false)}
                    className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                      <span>Rekap Nilai: {selectedHasilJadwal.nama_mapel}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary-400">
                        Tingkat {selectedHasilJadwal.target_kelas || 'Umum'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Waktu: {new Date(selectedHasilJadwal.waktu_mulai).toLocaleDateString('id-ID')} | Total {dataHasilSiswa.length} Siswa Terdaftar Selesai
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => exportHasilToExcel(selectedHasilJadwal, filteredSiswa, filterHasilParalelDetail)}
                    className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Unduh Excel</span>
                  </button>
                  <button
                    onClick={() => openAnalisisSoal(selectedHasilJadwal.id_jadwal, selectedHasilJadwal.id_mapel)}
                    className="px-3 py-2 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[16px]">analytics</span>
                    <span>Analisis Butir</span>
                  </button>
                  <button
                    onClick={() => setIsHasilModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50 dark:bg-slate-900/50">

                {/* 5 Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-center">
                    <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Peserta</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalPeserta}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Siswa dinilai</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-center">
                    <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Rata-Rata</span>
                    <span className="text-2xl font-black text-primary dark:text-primary-400">{rataNilai}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Skor kelas</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-center">
                    <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Tertinggi</span>
                    <span className="text-2xl font-black text-primary dark:text-primary-400">{nilaiTertinggi}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Nilai maks</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-center">
                    <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Terendah</span>
                    <span className="text-2xl font-black text-rose-500">{nilaiTerendah}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Nilai min</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-center col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Ketuntasan</span>
                    <span className="text-2xl font-black text-primary dark:text-primary-400">{persentaseTuntas}%</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{tuntasCount} / {totalPeserta} Tuntas</span>
                  </div>
                </div>

                {/* Quick Essay Grading Queue Banner (R4) */}
                {unratedCount > 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl animate-pulse">hourglass_top</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm text-amber-900 dark:text-amber-200">
                            Antrean Koreksi Jawaban Uraian
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                            {unratedCount} Siswa Menunggu Koreksi Uraian
                          </span>
                        </div>
                        <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                          Terdapat lembar jawaban uraian siswa yang belum dinilai. Gunakan koreksi cepat untuk menilai secara berurutan.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPeriksaUraian(unratedStudents[0])}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-xs transition-all min-h-[40px]"
                      >
                        <span className="material-symbols-outlined text-[18px]">draw</span>
                        <span>Mulai Koreksi Cepat ({unratedCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Finalisasi nilai? ${unratedCount} siswa yang belum dikoreksi akan diberi nilai uraian 0.`)) return;
                          setIsLoading(true);
                          const res = await api('finalisasi_nilai_jadwal', { id_jadwal: selectedHasilJadwal.id_jadwal });
                          setIsLoading(false);
                          if (res.status === 'success') {
                            setDataHasilSiswa(prev => prev.map(s => (s.nilai_uraian === null || s.nilai_uraian === undefined) ? { ...s, nilai_uraian: 0 } : s));
                            showMessage('Berhasil', 'Nilai jadwal berhasil difinalisasi untuk Admin & Siswa.', 'success');
                          } else {
                            showMessage('Gagal', res.message || 'Gagal memfinalisasi nilai.', 'error');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all min-h-[40px]"
                      >
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Finalisasi Nilai</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-3.5 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400">check_circle</span>
                    <span>{hasUraian ? 'Semua jawaban uraian telah dinilai untuk jadwal ujian ini.' : 'Ujian ini bertipe objektif (tanpa butir uraian). Seluruh nilai telah terkoreksi otomatis.'}</span>
                  </div>
                )}

                {/* Filter Paralel & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-[14px]">filter_alt</span> Paralel:
                    </span>
                    <button
                      onClick={() => setFilterHasilParalelDetail('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap min-h-[38px] ${
                        filterHasilParalelDetail === 'ALL'
                          ? 'bg-primary text-white shadow-xs'
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap min-h-[38px] ${
                            filterHasilParalelDetail === p
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          Paralel {p} ({countInP})
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
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
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-3.5 text-center w-12">#</th>
                          <th className="p-3.5">Nama Siswa</th>
                          <th className="p-3.5">NISN</th>
                          <th className="p-3.5">Kelas & Paralel</th>
                          <th className="p-3.5 text-center">Nilai PG</th>
                          <th className="p-3.5 text-center">Nilai Uraian</th>
                          <th className="p-3.5 text-center font-bold">Total Nilai</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-center">Periksa Uraian</th>
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
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-semibold text-slate-600 dark:text-slate-300 text-xs">
                                  {s.angkatan || selectedHasilJadwal.target_kelas || '-'} ({s.kelas_paralel ? `Paralel ${s.kelas_paralel}` : '-'})
                                </span>
                              </td>
                              <td className="p-3.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                                {Number(s.nilai_auto) || 0}
                              </td>
                              <td className="p-3.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                                {(s.nilai_uraian === null || s.nilai_uraian === undefined) ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    <span>Belum Dinilai</span>
                                  </span>
                                ) : (
                                  <span className="font-extrabold text-slate-700 dark:text-slate-200">
                                    {Number(s.nilai_uraian) || 0}
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={`text-sm font-extrabold ${isLulus ? 'text-primary dark:text-primary-400' : 'text-rose-500'}`}>
                                  {total}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isLulus
                                    ? 'bg-primary/15 text-primary-700 dark:bg-primary/10 dark:text-primary-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                }`}>
                                  {isLulus ? 'Tuntas' : 'Remedial'}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => openPeriksaUraian(s)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all min-h-[36px] active:scale-95 ${
                                    (s.nilai_uraian === null || s.nilai_uraian === undefined)
                                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                                      : 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300'
                                  }`}
                                  title={(s.nilai_uraian === null || s.nilai_uraian === undefined) ? 'Koreksi jawaban uraian siswa ini' : 'Periksa kembali nilai uraian'}
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    {(s.nilai_uraian === null || s.nilai_uraian === undefined) ? 'draw' : 'edit_note'}
                                  </span>
                                  <span>{(s.nilai_uraian === null || s.nilai_uraian === undefined) ? 'Koreksi' : 'Ubah Nilai'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredSiswa.length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-500">
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

      {/* ================================================================= */}
      {/* MODAL: PRATINJAU UJIAN (Cleaned from phantom classes)             */}
      {/* ================================================================= */}
      {renderPreviewModal()}

      {/* ================================================================= */}
      {/* MODAL: ANALISIS BUTIR SOAL (Cleaned from phantom classes)         */}
      {/* ================================================================= */}
      {renderAnalisisModal()}

      {/* ================================================================= */}
      {/* MODAL: PERIKSA JAWABAN URAIAN (Integrated ModalPeriksaUraian)     */}
      {/* ================================================================= */}
      {(() => {
        const remainingUnrated = (dataHasilSiswa || []).filter(s =>
          !s.is_blocked &&
          (s.status_ujian === 'SELESAI' || Number(s.total_dijawab) > 0) &&
          (s.nilai_uraian === null || s.nilai_uraian === undefined)
        );
        const hasNextStudent = remainingUnrated.some(s => s.id_log !== modalUraian.logUjian?.id_log);
        return (
          <ModalPeriksaUraian
            isOpen={modalUraian.isOpen}
            logUjian={modalUraian.logUjian}
            jawabanUraian={modalUraian.jawabanUraian}
            onClose={() => setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] })}
            onSave={saveNilaiUraian}
            hasNext={hasNextStudent}
            unratedCount={remainingUnrated.length}
          />
        );
      })()}

      {/* ================================================================= */}
      {/* MODAL: SKEMA PENILAIAN (Integrated SkemaPenilaianPanel)          */}
      {/* ================================================================= */}
      {skemaModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 animate-scale-up">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">Pengaturan Skema Penilaian</h3>
              <button
                onClick={() => setSkemaModal({ isOpen: false, id_mapel: null })}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-5">
              {/* <SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} /> */}
              <SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} schoolDefaultScheme={schoolDefaultScheme} npsn={user?.npsn || ''} />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: UPLOAD FOTO PROFIL                                         */}
      {/* ================================================================= */}
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
                {fotoProfil ? (
                  <img src={fotoProfil} alt="Profile" className="w-full h-full object-cover" />
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
    </div>
  );
};

export default GuruView;
