import { fetchAPI, getTrueNow, get_default_skema_sekolah, isClassMatching, isUniversalAlloc } from '../api.js';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import FormSoalModal from '../components/FormSoalModal.jsx';
import FormNarasiModal from '../components/FormNarasiModal.jsx';
import ModalPeriksaUraian from '../components/ModalPeriksaUraian.jsx';
import SkemaPenilaianPanel from '../components/SkemaPenilaianPanel.jsx';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
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
  PasswordInput
} from '../components/UI.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import TutorialModal, { TutorialBadge, resetTutorialProgress } from '../components/TutorialModal.jsx';
import { compressImageFile } from '../utils/imageHelper.js';

const GuruView = ({ user, onLogout, onUpdateUser, showMessage, isDarkMode, setIsDarkMode }) => {
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
  const [selectedJadwal, setSelectedJadwal] = useState(null);
  const [dataLog, setDataLog] = useState([]);
  const [dataPengumuman, setDataPengumuman] = useState([]);
  const [dataAnalisis, setDataAnalisis] = useState([]);
  const [isAnalisisModalOpen, setIsAnalisisModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [gasWebhookUrl, setGasWebhookUrl] = useState(() => {
    try {
      return (typeof window !== 'undefined' ? window.localStorage.getItem('nexa_gas_drive_webhook') || '' : '');
    } catch (_) {
      return '';
    }
  });
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const currentUserId = user?.id_guru || user?.id_user || user?.id || user?.nip || user?.username || '';
  const tutorialStorageKey = currentUserId ? `nexa_tutorial_seen_${currentUserId}_guru` : null;

  useEffect(() => {
    try {
      const seen = (tutorialStorageKey && localStorage.getItem(tutorialStorageKey)) || localStorage.getItem('nexa_tutorial_shown_guru');
      if (!seen) {
        setShowTutorialModal(true);
      }
    } catch (e) {
      console.error('Failed to read tutorial state from localStorage:', e);
    }
  }, [tutorialStorageKey]);

  const handleCloseTutorial = () => {
    setShowTutorialModal(false);
    try {
      if (tutorialStorageKey) {
        localStorage.setItem(tutorialStorageKey, 'true');
      }
      localStorage.setItem('nexa_tutorial_shown_guru', 'true');
    } catch (e) {
      console.error('Failed to save tutorial state to localStorage:', e);
    }
  };

  const handleRestartTutorial = () => {
    resetTutorialProgress('guru');
    try {
      if (tutorialStorageKey) {
        localStorage.removeItem(tutorialStorageKey);
      }
      localStorage.removeItem('nexa_tutorial_shown_guru');
    } catch (e) {}
    setShowTutorialModal(true);
  };

  // Avatar & Profile
  const [fotoProfil, setFotoProfil] = useState(user.foto || user.foto_profil || '');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ password: '', foto: user.foto || user.foto_profil || '' });
  const [profileLoading, setProfileLoading] = useState(false);

  const handleAvatarSelect = async (avatarUrl) => {
    setIsLoading(true);
    const res = await api('update_guru', { id_guru: user.id_guru, npsn: user.npsn, foto: avatarUrl });
    setIsLoading(false);
    if (res.status === 'success') {
      setFotoProfil(avatarUrl);
      if (onUpdateUser) onUpdateUser({ foto: avatarUrl, foto_profil: avatarUrl });
      else { user.foto = avatarUrl; user.foto_profil = avatarUrl; }
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
      setShowProfileModal(false);
      if (payload.foto) setFotoProfil(payload.foto);
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
  const [dataAudit, setDataAudit] = useState([]);
  const [dataAuditArchive, setDataAuditArchive] = useState([]);
  const [activeLogSubTab, setActiveLogSubTab] = useState('aktif');
  const [isArchivingLog, setIsArchivingLog] = useState(false);

  // Question Bank Filters & Pagination
  const [searchQuerySoal, setSearchQuerySoal] = useState('');
  const [filterTipeSoal, setFilterTipeSoal] = useState('ALL');
  const [filterKDSoal, setFilterKDSoal] = useState('ALL');
  const [bankSoalPage, setBankSoalPage] = useState(1);
  const itemsPerPage = 12;

  // Live Monitoring Filters & State
  const [monitoringFilterStatus, setMonitoringFilterStatus] = useState('ALL');
  const [monitoringFilterKelas, setMonitoringFilterKelas] = useState('ALL');
  const [monitoringSearch, setMonitoringSearch] = useState('');
  const [monitoringPage, setMonitoringPage] = useState(1);

  // Proctor Intervention Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'unblock',
    title: '',
    message: '',
    icon: 'info',
    actionText: 'Konfirmasi',
    onConfirm: null
  });

  // Modals State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [skemaModal, setSkemaModal] = useState({ isOpen: false, id_mapel: null });
  const [selectedMapelAccount, setSelectedMapelAccount] = useState('');
  const [accountDataSoal, setAccountDataSoal] = useState([]);
  const [accountSoalLoading, setAccountSoalLoading] = useState(false);
  const [preFormSoal, setPreFormSoal] = useState({ isOpen: false, id_mapel: '', target_kelas: '', target_paralel: [] });
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

  const fileInputRef = useRef(null);
  const wordInputRef = useRef(null);
  const guruId = user.id_guru || user.id_user;

  // =========================================================================
  // Data Fetching
  // =========================================================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resKelas = await api('get_kelas', {});
      if (resKelas.status === 'success') setDataKelas(resKelas.data || []);

      if (activeTab === 'dashboard' || activeTab === 'akun' || activeTab === 'hasil') {
        const resMapel = await api('get_mapel_guru', { id_guru: guruId });
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
        const resJadwal = await api('get_jadwal_pengawas', { id_guru: guruId });
        if (resJadwal.status === 'success') setDataJadwal(resJadwal.data || []);
      } else if (activeTab === 'bank_soal') {
        const res = await api('get_mapel_guru', { id_guru: guruId });
        if (res.status === 'success') setDataMapel(res.data || []);

        if (selectedMapel) {
          const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
          if (soalRes.status === 'success') setDataSoal(soalRes.data || []);
        }
      }
    } catch (e) {
      console.error('fetchData error:', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedMapel]);

  useEffect(() => {
    if (user?.npsn) {
      get_default_skema_sekolah(user.npsn).catch(() => {});
    }
  }, [user?.npsn]);

  useEffect(() => {
    if (activeTab === 'akun') {
      if (!selectedMapelAccount && dataMapel.length > 0) {
        setSelectedMapelAccount(dataMapel[0].id_mapel);
      }
    }
  }, [activeTab, dataMapel, selectedMapelAccount]);

  useEffect(() => {
    if (activeTab === 'akun' && selectedMapelAccount) {
      let isMounted = true;
      setAccountSoalLoading(true);
      api('get_soal_by_mapel', { id_mapel: selectedMapelAccount }).then((soalRes) => {
        if (isMounted && soalRes.status === 'success') {
          setAccountDataSoal(soalRes.data || []);
        }
        if (isMounted) setAccountSoalLoading(false);
      }).catch((err) => {
        if (isMounted) setAccountSoalLoading(false);
      });
      return () => { isMounted = false; };
    }
  }, [activeTab, selectedMapelAccount]);

  useEffect(() => {
    if (window.MathJax) {
      setTimeout(() => {
        window.MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
      }, 100);
    }
  }, [dataSoal, activeTab, bankSoalPage, selectedMapel, modalUraian.isOpen, formSoal.isOpen, isAnalisisModalOpen]);

  // =========================================================================
  // Question Bank Helpers & Memoized Filtering
  // =========================================================================
  const availableKDList = useMemo(() => {
    const kds = dataSoal
      .filter(s => s.tipe_soal !== 'SKEMA_PENILAIAN')
      .map(s => (s.kd || s.kompetensi_dasar || '').toString().trim())
      .filter(Boolean);
    return Array.from(new Set(kds)).sort();
  }, [dataSoal]);

  const filteredSoal = useMemo(() => {
    return dataSoal.filter(s => {
      if (s.tipe_soal === 'SKEMA_PENILAIAN') return false;

      // Filter Tipe Soal (PG, PGK, JODOH, URAIAN, SEMUA)
      if (filterTipeSoal && filterTipeSoal !== 'ALL' && filterTipeSoal !== 'SEMUA') {
        const t = (s.tipe_soal || s.tipe || '').toUpperCase();
        if (t !== filterTipeSoal.toUpperCase()) return false;
      }

      // Filter KD
      if (filterKDSoal && filterKDSoal !== 'ALL' && filterKDSoal !== 'SEMUA') {
        const kdVal = (s.kd || s.kompetensi_dasar || '').toString().trim();
        if (kdVal !== filterKDSoal.trim()) return false;
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
  }, [dataSoal, filterTipeSoal, filterKDSoal, searchQuerySoal]);

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
    if (t === 'PG') {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60">PG</span>;
    }
    if (t === 'PGK') {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30/70 dark:border-primary/30">PGK</span>;
    }
    if (t === 'JODOH') {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/60">JODOH</span>;
    }
    if (t === 'URAIAN') {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/70 dark:border-purple-800/60">URAIAN</span>;
    }
    if (t === 'NARASI') {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/60">NARASI SOAL</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{t}</span>;
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
      { tipe_soal: 'PG',    pertanyaan: 'Hasil dari 5 + 7 adalah...', opsi_A: '10', opsi_B: '11', opsi_C: '12', opsi_D: '13', opsi_E: '14', kunci_jawaban: 'C', bobot: 10, kd: '3.1', narasi_soal: '' },
      { tipe_soal: 'PGK',   pertanyaan: 'Manakah yang merupakan bilangan prima genap?', opsi_A: '2', opsi_B: '4', opsi_C: '6', opsi_D: '8', opsi_E: '10', kunci_jawaban: 'A,B', bobot: 10, kd: '3.1', narasi_soal: '' },
      { tipe_soal: 'BS',    pertanyaan: 'Bumi mengelilingi Matahari.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Benar', bobot: 5, kd: '3.1', narasi_soal: '' },
      { tipe_soal: 'JODOH', pertanyaan: 'Pasangkan ibukota negara berikut:', opsi_A: 'Indonesia = Jakarta', opsi_B: 'Jepang = Tokyo', opsi_C: 'Inggris = London', opsi_D: '', opsi_E: '', kunci_jawaban: 'Indonesia=Jakarta, Jepang=Tokyo, Inggris=London', bobot: 15, kd: '3.2', narasi_soal: '' },
      { tipe_soal: 'ISIAN', pertanyaan: 'Ibukota Indonesia adalah...', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Jakarta', bobot: 10, kd: '3.2', narasi_soal: '' },
      { tipe_soal: 'URAIAN', pertanyaan: 'Jelaskan hukum kekekalan energi secara singkat.', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: 'Energi tidak dapat diciptakan atau dimusnahkan, hanya berubah bentuk.', bobot: 20, kd: '3.3', narasi_soal: '' },
    ];
    const petunjukData = [
      { Kolom: 'tipe_soal',     Keterangan: 'Wajib. Isi dengan: PG, PGK, BS, JODOH, ISIAN, atau URAIAN' },
      { Kolom: 'pertanyaan',    Keterangan: 'Wajib. Teks pertanyaan soal.' },
      { Kolom: 'opsi_A ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ E',   Keterangan: 'Untuk PG/PGK: teks pilihan. Untuk JODOH: format "Premis = Respon".' },
      { Kolom: 'kunci_jawaban', Keterangan: 'PG: huruf A/B/C/D/E. PGK: pisah koma (A,B). BS: Benar/Salah. JODOH: "P=R, P2=R2". ISIAN/URAIAN: teks kunci.' },
      { Kolom: 'bobot',         Keterangan: 'Angka bobot soal (default 10 jika kosong).' },
      { Kolom: 'kd',            Keterangan: 'Kode Dasar / KD, contoh: 3.1 (opsional).' },
      { Kolom: 'narasi_soal',   Keterangan: 'Teks narasi/wacana pendahulu soal (opsional).' },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateData), 'Template Soal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(petunjukData), 'Petunjuk');
    XLSX.writeFile(wb, 'Template_Soal_NEXA_CBT.xlsx');
  };

  // ponytail: generate file .docx asli via JSZip agar langsung bisa diedit guru di Word
  const downloadTemplateWord = async () => {
    try {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');

      const sampleLines = [
        'PETUNJUK PENGISIAN SOAL NEXA CBT (MICROSOFT WORD)',
        '--------------------------------------------------',
        'Format Fleksibel: Guru dapat menggunakan tag SOAL: atau penomoran biasa (1., 2., dst.)',
        '',
        'CONTOH 1 - PILIHAN GANDA (PG):',
        'SOAL: Hasil dari 5 + 7 adalah...',
        'A. 10',
        'B. 11',
        'C. 12',
        'D. 13',
        'E. 14',
        'KUNCI: C',
        'BOBOT: 10',
        'KD: 3.1',
        '',
        'CONTOH 2 - PILIHAN GANDA KOMPLEKS (PGK - Lebih dari 1 kunci):',
        'TIPE: PGK',
        'SOAL: Manakah yang merupakan bilangan prima genap?',
        'A. 2',
        'B. 4',
        'C. 6',
        'D. 8',
        'KUNCI: A,B',
        'BOBOT: 10',
        '',
        'CONTOH 3 - BENAR / SALAH (BS):',
        'TIPE: BS',
        'SOAL: Bumi mengelilingi Matahari.',
        'KUNCI: Benar',
        'BOBOT: 5',
        '',
        'CONTOH 4 - ISIAN SINGKAT:',
        'TIPE: ISIAN',
        'SOAL: Ibukota negara Indonesia adalah...',
        'KUNCI: Jakarta',
        'BOBOT: 10',
        '',
        'CONTOH 5 - URAIAN / ESSAY:',
        'TIPE: URAIAN',
        'SOAL: Jelaskan prinsip hukum kekekalan energi secara singkat.',
        'KUNCI: Energi tidak dapat diciptakan atau dimusnahkan, hanya berubah bentuk.',
        'BOBOT: 20',
        '',
        'CONTOH 6 - SOAL DENGAN NARASI/STIMULUS:',
        'NARASI: Bacalah teks berikut: "Energi adalah kemampuan untuk melakukan usaha."',
        'SOAL: Apa yang dimaksud dengan energi menurut teks di atas?',
        'A. Kemampuan untuk melakukan usaha',
        'B. Kemampuan untuk bergerak',
        'C. Kemampuan untuk berpindah',
        'D. Kemampuan untuk bekerja',
        'KUNCI: A',
        'BOBOT: 10'
      ];

      const paragraphs = sampleLines.map(p => {
        const escaped = (p || ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>`;
      }).join('');

      zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Template_Soal_NEXA_CBT.docx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showMessage('Gagal', 'Gagal membuat file template Word: ' + err.message, 'error');
    }
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
      narasi_soal: String(getVal('narasi_soal', 'narasisoal', 'narasi', 'wacana', 'stimulus'))
    };
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (!rawData || rawData.length === 0) {
          showMessage('Peringatan', 'File Excel kosong atau format tidak sesuai.', 'error');
          return;
        }

        const payloadData = rawData.map((rawRow, idx) => {
          const row = normalizeExcelRow(rawRow);
          let finalKunci = row.kunci_jawaban ? String(row.kunci_jawaban).trim() : '';
          let opsiStr = null;
          let finalPertanyaan = row.pertanyaan || '';

          if (row.narasi_soal) {
            finalPertanyaan = `<strong>Narasi Soal:</strong><br/>${row.narasi_soal}<br/><br/>${finalPertanyaan}`;
          }

          if (row.tipe_soal === 'PG') {
            const map = { A: row.opsi_A, B: row.opsi_B, C: row.opsi_C, D: row.opsi_D, E: row.opsi_E };
            finalKunci = map[finalKunci.toUpperCase()] || finalKunci;
          } else if (row.tipe_soal === 'PGK') {
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
              if (!val) return;
              const parts = String(val).split('=');
              if (parts.length === 2) {
                const p = parts[0].trim();
                const r = parts[1].trim();
                if (p && !premis.includes(p)) premis.push(p);
                if (r && !respon.includes(r)) respon.push(r);
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
          }

          const uniqueId = `SOAL-${selectedMapel}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${idx}`;

          return {
            id_soal: uniqueId,
            id_mapel: selectedMapel,
            npsn: user.npsn,
            tipe_soal: row.tipe_soal || 'PG',
            pertanyaan: finalPertanyaan,
            opsi: opsiStr,
            kunci_jawaban: finalKunci ? String(finalKunci) : '',
            bobot: row.bobot || 10
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
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  // Parse teks dari Word/TXT menjadi array soal dengan format yang fleksibel
  const parseWordText = (text) => {
    const soalList = [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim());

    let current = null;
    let currentNarasi = '';

    const finalize = () => {
      if (current && current.pertanyaan) {
        if (!current.tipe_soal) {
          if (current.opsi_A || current.opsi_B) {
            current.tipe_soal = 'PG';
          } else {
            current.tipe_soal = 'URAIAN';
          }
        }
        soalList.push({ ...current, narasi_soal: currentNarasi || current.narasi_soal || '' });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // 1. Tag NARASI/WACANA
      if (/^(NARASI|WACANA|STIMULUS)\s*[:=]/i.test(line)) {
        finalize();
        current = null;
        currentNarasi = line.replace(/^(NARASI|WACANA|STIMULUS)\s*[:=]\s*/i, '').trim();
        continue;
      }

      // 2. Tag TIPE SOAL
      if (/^(TIPE|JENIS)(\s*SOAL)?\s*[:=]/i.test(line)) {
        finalize();
        const t = line.replace(/^(TIPE|JENIS)(\s*SOAL)?\s*[:=]\s*/i, '').trim().toUpperCase();
        current = { tipe_soal: t, opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: '', bobot: 10, kd: '' };
        continue;
      }

      // 3. Tag SOAL: atau Penomoran Soal (misal "1. ", "1) ", "Soal 1: ")
      const soalTagMatch = line.match(/^SOAL\s*[:=]\s*(.+)/i);
      const soalNumMatch = !soalTagMatch && line.match(/^(\d+|No\.?\s*\d+|Soal\s*\d+)[\.\)\:\-]\s*(.+)/i);

      if (soalTagMatch || soalNumMatch) {
        if (current && current.pertanyaan) {
          finalize();
          current = null;
        }
        if (!current) {
          current = { tipe_soal: '', opsi_A: '', opsi_B: '', opsi_C: '', opsi_D: '', opsi_E: '', kunci_jawaban: '', bobot: 10, kd: '' };
        }
        current.pertanyaan = (soalTagMatch ? soalTagMatch[1] : soalNumMatch[2]).trim();
        continue;
      }

      // 4. Opsi A, B, C, D, E
      const opsiMatch = line.match(/^(\[)?([A-Ea-e])(\])?[\.\)\:\-]?\s+(.+)/);
      if (opsiMatch && current && current.pertanyaan) {
        const letter = opsiMatch[2].toUpperCase();
        const key = `opsi_${letter}`;
        current[key] = opsiMatch[4].trim();
        continue;
      }

      // 5. Kunci Jawaban
      if (/^(KUNCI(\s*JAWABAN)?|JAWABAN)(\s*SOAL|\s*BENAR)?\s*[:=]/i.test(line)) {
        if (current) {
          current.kunci_jawaban = line.replace(/^(KUNCI(\s*JAWABAN)?|JAWABAN)(\s*SOAL|\s*BENAR)?\s*[:=]\s*/i, '').trim();
        }
        continue;
      }

      // 6. Bobot / Skor
      if (/^(BOBOT|SKOR|NILAI|POIN)\s*[:=]/i.test(line)) {
        if (current) {
          const val = parseInt(line.replace(/^(BOBOT|SKOR|NILAI|POIN)\s*[:=]\s*/i, '').trim());
          if (!isNaN(val)) current.bobot = val;
        }
        continue;
      }

      // 7. KD
      if (/^(KD|KOMPETENSI\s*DASAR)\s*[:=]/i.test(line)) {
        if (current) {
          current.kd = line.replace(/^(KD|KOMPETENSI\s*DASAR)\s*[:=]\s*/i, '').trim();
        }
        continue;
      }

      // 8. Baris kelanjutan pertanyaan
      if (current && current.pertanyaan && !current.opsi_A) {
        current.pertanyaan += ' ' + line;
      }
    }
    finalize();
    return soalList;
  };

  const handleImportWord = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      setIsLoading(true);
      let text = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }

      const rawSoal = parseWordText(text);
      if (!rawSoal.length) {
        showMessage('Peringatan', 'Tidak ada soal yang terbaca. Pastikan format sesuai template.', 'error');
        setIsLoading(false);
        return;
      }

      const payloadData = rawSoal.map((row, idx) => {
        let finalKunci = row.kunci_jawaban ? String(row.kunci_jawaban).trim() : '';
        let opsiStr = null;
        let finalPertanyaan = row.pertanyaan || '';
        if (row.narasi_soal) {
          finalPertanyaan = `<strong>Narasi Soal:</strong><br/>${row.narasi_soal}<br/><br/>${finalPertanyaan}`;
        }

        if (row.tipe_soal === 'PG') {
          const map = { A: row.opsi_A, B: row.opsi_B, C: row.opsi_C, D: row.opsi_D, E: row.opsi_E };
          finalKunci = map[finalKunci.toUpperCase()] || finalKunci;
        } else if (row.tipe_soal === 'PGK') {
          try {
            const mapped = finalKunci.split(',').map(k => ({ A: row.opsi_A, B: row.opsi_B, C: row.opsi_C, D: row.opsi_D, E: row.opsi_E }[k.trim().toUpperCase()] || k.trim()));
            finalKunci = JSON.stringify(mapped);
          } catch (_) {}
        } else if (row.tipe_soal === 'JODOH') {
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

        if ((row.tipe_soal === 'PG' || row.tipe_soal === 'PGK') && !opsiStr) {
          opsiStr = JSON.stringify([row.opsi_A || '', row.opsi_B || '', row.opsi_C || '', row.opsi_D || '', row.opsi_E || '']);
        }

        return {
          id_soal: `SOAL-${selectedMapel}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}-${idx}`,
          id_mapel: selectedMapel,
          npsn: user.npsn,
          tipe_soal: row.tipe_soal || 'PG',
          pertanyaan: finalPertanyaan,
          opsi: opsiStr,
          kunci_jawaban: finalKunci ? String(finalKunci) : '',
          bobot: row.bobot || 10,
        };
      });

      const res = await api('import_soal_bulk', { data: payloadData, npsn: user.npsn });
      setIsLoading(false);
      if (res.status === 'success') {
        showMessage('Berhasil', `${payloadData.length} soal dari Word/TXT berhasil diimpor!`, 'success');
        const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapel)?.nama_mapel || selectedMapel;
        logActivity('IMPORT SOAL', `Import ${payloadData.length} butir soal Word pada mapel ${mapelNama}`);
        fetchData();
      } else {
        showMessage('Info', res.message, 'info');
      }
    } catch (err) {
      setIsLoading(false);
      showMessage('Gagal', 'Gagal memproses file Word: ' + err.message, 'error');
    }
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
    } else {
      showMessage('Gagal', 'Gagal menyimpan soal: ' + res.message, 'error');
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

  const deleteSoal = async (id) => {
    if (!confirm('Hapus butir soal ini?')) return;
    // ponytail: confirm() ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GuruView belum punya confirmDialog state, biarkan sementara
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

  const saveSkemaAccount = async (payload, applyToAll = false) => {
    if (!selectedMapelAccount && !applyToAll) {
      showMessage('Peringatan', 'Pilih mata pelajaran terlebih dahulu.', 'error');
      return;
    }
    setIsLoading(true);

    if (applyToAll) {
      const idMapels = (dataMapel || []).map(m => m.id_mapel).filter(Boolean);
      if (idMapels.length === 0) {
        setIsLoading(false);
        showMessage('Peringatan', 'Tidak ada mata pelajaran yang diampu ditemukan.', 'error');
        return;
      }
      const res = await api('save_skema_penilaian', {
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
        logActivity('SKEMA PENILAIAN BULK', `Menerapkan skema penilaian serentak ke ${idMapels.length} mata pelajaran dari menu akun`);
        if (selectedMapelAccount) {
          const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapelAccount });
          if (soalRes.status === 'success') setAccountDataSoal(soalRes.data || []);
        }
      } else {
        showMessage('Gagal', 'Gagal menerapkan skema penilaian serentak: ' + res.message, 'error');
      }
      return;
    }

    const res = await api('save_skema_penilaian', {
      id_mapel: selectedMapelAccount,
      npsn: user.npsn,
      kunci_jawaban: payload.kunci_jawaban,
      bobot: payload.bobot,
      mode: payload.mode,
      skema: payload.skema
    });
    setIsLoading(false);
    if (res.status === 'success') {
      showMessage('Berhasil', 'Skema penilaian berhasil disimpan.', 'success');
      const mapelNama = dataMapel.find(m => m.id_mapel === selectedMapelAccount)?.nama_mapel || selectedMapelAccount;
      logActivity('SKEMA PENILAIAN', `Menyimpan skema bobot penilaian mapel ${mapelNama} dari menu akun`);
      const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapelAccount });
      if (soalRes.status === 'success') setAccountDataSoal(soalRes.data || []);
    } else {
      showMessage('Gagal', 'Gagal menyimpan skema penilaian: ' + res.message, 'error');
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
    const res = await api('monitoring_ujian', { id_jadwal: jadwal.id_jadwal });
    setIsLoading(false);
    if (res.status === 'success') {
      setDataHasilSiswa(res.data || []);
      setIsHasilModalOpen(true);
    } else {
      showMessage('Gagal', 'Gagal memuat rekap nilai: ' + res.message, 'error');
    }
  };

  const openAnalisisSoal = async (idJadwal, idMapel) => {
    const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(idMapel));
    if (!isTaughtSubject) {
      showMessage('Akses Terbatas', 'Anda hanya berhak mengakses analisis butir soal untuk mata pelajaran yang Anda ampu.', 'info');
      return;
    }
    setIsLoading(true);
    const res = await api('get_analisis_butir_soal', { id_jadwal: idJadwal, id_mapel: idMapel });
    setIsLoading(false);
    if (res.status === 'success') {
      setDataAnalisis(res.data || []);
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

  const saveNilaiUraian = async (totalNilai, isNext = false) => {
    if (!modalUraian.logUjian) return;
    const currentIdLog = modalUraian.logUjian.id_log;
    setIsLoading(true);
    const res = await api('update_nilai_uraian', {
      id_log: currentIdLog,
      nilai_uraian_total: totalNilai
    });
    setIsLoading(false);
    if (res.status === 'success') {
      logActivity('NILAI URAIAN', `Memberikan nilai uraian siswa pada sesi ${currentIdLog} skor ${totalNilai}`);

      let updatedList = [];
      setDataHasilSiswa(prev => {
        updatedList = prev.map(s => {
          if (s.id_log === currentIdLog) {
            const pg = Number(s.nilai_auto) || 0;
            return {
              ...s,
              nilai_uraian: totalNilai,
              total_nilai: pg + totalNilai
            };
          }
          return s;
        });
        return updatedList;
      });

      if (isNext) {
        const nextStudent = updatedList.find(s =>
          (s.status_ujian === 'SELESAI' || Number(s.total_dijawab) > 0) &&
          s.id_log !== currentIdLog &&
          (s.nilai_uraian === null || s.nilai_uraian === undefined)
        );
        if (nextStudent) {
          openPeriksaUraian(nextStudent);
          return;
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
    { id: 'hasil', label: 'Rekap Nilai', icon: 'assessment' },
    { id: 'akun', label: 'Profil', icon: 'person' }
  ];

  const tabTitleMap = {
    dashboard: 'Beranda Guru',
    bank_soal: 'Bank Soal & Narasi',
    hasil: 'Hasil & Rekap Evaluasi',
    akun: 'Pengaturan Profil'
  };

  const tabSubtitleMap = {
    dashboard: 'Ringkasan tugas mengajar, pembuatan soal, dan status penilaian',
    bank_soal: 'Kelola butir soal evaluasi, narasi soal stimulus, dan skema penilaian',
    hasil: 'Rekapitulasi nilai, antrean koreksi uraian, dan analisis butir soal',
    akun: 'Kelola foto profil, avatar, dan keamanan akun guru'
  };

  // =========================================================================
  // Clean Modals (Without Phantom Classes)
  // =========================================================================
  const renderPreviewModal = () => {
    if (!isPreviewOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 dark:border-slate-700 animate-scale-up">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white">Pratinjau Butir Soal</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total {dataSoal.length} soal pada mata pelajaran ini</p>
            </div>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {dataSoal.map((soal, idx) => (
              <div key={soal.id_soal || idx} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 shadow-xs space-y-3">
                <div className="font-bold text-sm flex justify-between items-center">
                  <span className="text-slate-800 dark:text-slate-200">Soal No. {idx + 1} ({soal.tipe_soal || 'PG'})</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Bobot: {soal.bobot || 10}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />
                {soal.tipe_soal === 'PG' && soal.opsi && Array.isArray(soal.opsi) && (
                  <div className="space-y-1.5 pt-1">
                    {soal.opsi.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-2.5 rounded-lg border text-xs sm:text-sm ${soal.kunci_jawaban === opt ? 'bg-primary/10 border-primary dark:bg-primary/10 text-primary-800 dark:text-primary-200 font-semibold' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                        <span dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : opt.teks }} />
                      </div>
                    ))}
                  </div>
                )}
                {soal.tipe_soal === 'PGK' && soal.opsi && Array.isArray(soal.opsi) && (
                  <div className="space-y-1.5 pt-1">
                    {soal.opsi.map((opt, oIdx) => {
                      const isChecked = soal.kunci_jawaban && soal.kunci_jawaban.includes(opt);
                      return (
                        <div key={oIdx} className={`p-2.5 rounded-lg border text-xs sm:text-sm ${isChecked ? 'bg-primary/10 border-primary dark:bg-primary/10 text-primary-800 dark:text-primary-200 font-semibold' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                          <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                          <span dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : opt.teks }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {soal.tipe_soal === 'URAIAN' && (
                  <div className="mt-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 italic text-xs">Kolom input jawaban uraian siswa...</span>
                  </div>
                )}
              </div>
            ))}
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

  const renderConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scale-up">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
            confirmDialog.type === 'unblock' ? 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary-400' :
            confirmDialog.type === 'block' || confirmDialog.type === 'stop' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' :
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
                confirmDialog.type === 'block' || confirmDialog.type === 'stop' ? 'bg-rose-600 hover:bg-rose-700' :
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

  const renderResetModal = () => {
    if (!resetModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-xl border border-slate-200 dark:border-slate-700 animate-scale-up">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Pilih Metode Reset</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
            Pilih "Reset Login" jika siswa hanya terkeluar dari aplikasi. Pilih "Reset Total" untuk mengulang seluruh sesi dan menghapus jawaban siswa.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => handleResetJawaban(resetModal.id_siswa, 'login')}
              className="w-full py-2.5 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 border border-primary/30 dark:border-primary/20 rounded-xl font-bold text-xs hover:bg-primary/20 transition-colors min-h-[44px]"
            >
              Reset Login Saja
            </button>
            <button
              onClick={() => handleResetJawaban(resetModal.id_siswa, 'total')}
              className="w-full py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-xl font-bold text-xs hover:bg-rose-100 transition-colors min-h-[44px]"
            >
              Reset Total (Hapus Jawaban)
            </button>
            <button
              onClick={() => setResetModal(null)}
              className="w-full py-2.5 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xs transition-colors min-h-[44px]"
            >
              Batal
            </button>
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
                    data-tutorial={
                      item.id === 'monitoring'
                        ? 'guru-monitoring guru-pengawasan'
                        : item.id === 'hasil'
                        ? 'guru-hasil guru-nilai'
                        : `guru-${item.id}`
                    }
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
                    {isSidebarCollapsed ? (
                      <TutorialBadge role="guru" targetId={item.id === 'hasil' ? ['guru-hasil', 'guru-nilai'] : `guru-${item.id}`} dotOnly={true} className="absolute top-1 right-1" />
                    ) : (
                      <TutorialBadge role="guru" targetId={item.id === 'hasil' ? ['guru-hasil', 'guru-nilai'] : `guru-${item.id}`} />
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
            data-tutorial="guru-panduan"
            onClick={() => setShowTutorialModal(true)}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95 transition-all min-w-[44px] min-h-[44px] shadow-xs"
            title="Panduan & Tutorial"
            aria-label="Panduan & Tutorial"
          >
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
          <button
            type="button"
            onClick={handleRestartTutorial}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all min-w-[44px] min-h-[44px] shadow-xs"
            title="Mulai Tutorial Lagi"
            aria-label="Mulai Tutorial Lagi"
          >
            <span className="material-symbols-outlined text-xl">restart_alt</span>
          </button>
          <NotificationBell role="guru" npsn={user?.npsn} user={user} />
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
                        data-tutorial={
                          item.id === 'hasil'
                            ? 'guru-hasil guru-nilai'
                            : `guru-${item.id}`
                        }
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
                        <TutorialBadge role="guru" targetId={item.id === 'hasil' ? ['guru-hasil', 'guru-nilai'] : `guru-${item.id}`} />
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
              data-tutorial={`guru-${tab.id}`}
              data-assistant-target={tab.id}
              onClick={() => navigateTab(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] min-w-[44px] transition-colors ${
                isActive
                  ? 'text-primary dark:text-primary-400 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              <span className="text-[10px] font-bold mt-0.5 truncate max-w-[60px]">{tab.label}</span>
              <TutorialBadge role="guru" targetId={tab.id === 'hasil' ? ['guru-hasil', 'guru-nilai'] : `guru-${tab.id}`} className="absolute top-0 right-1/4 scale-75" />
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
            <button
              type="button"
              data-tutorial="guru-panduan"
              onClick={() => setShowTutorialModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm"
              title="Panduan & Tutorial"
              aria-label="Panduan & Tutorial"
            >
              <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400">help</span>
              <span>Panduan</span>
            </button>
            <button
              type="button"
              onClick={handleRestartTutorial}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm"
              title="Mulai Tutorial Lagi dari awal"
              aria-label="Mulai Tutorial Lagi"
            >
              <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400">restart_alt</span>
              <span>Mulai Tutorial Lagi</span>
            </button>
            <NotificationBell role="guru" npsn={user?.npsn} user={user} />
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
                      Buka Semua Soal ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
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
                          <p className="text-[11px] text-slate-500">Kelola 5 tipe soal AKM, stimulus narasi, serta import Word & Excel.</p>
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
                      <input type="file" ref={wordInputRef} onChange={handleImportWord} accept=".docx,.txt" className="hidden" />
                      {/* Template dropdown */}
                      <div className="relative group">
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                          title="Unduh Template"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                          <span className="hidden sm:inline">Template</span>
                          <span className="material-symbols-outlined text-[14px]">expand_more</span>
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 hidden group-hover:block">
                          <button onClick={downloadTemplateSoal} className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 rounded-t-xl">
                            <span className="material-symbols-outlined text-[16px] text-green-600">table_chart</span> Template Excel (.xlsx)
                          </button>
                          <button onClick={downloadTemplateWord} className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 rounded-b-xl">
                            <span className="material-symbols-outlined text-[16px] text-blue-600">description</span> Template Word (.docx)
                          </button>
                        </div>
                      </div>
                      {/* Import Excel */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 dark:bg-green-950/40 hover:bg-green-100 text-green-700 dark:text-green-300 transition-colors min-h-[44px]"
                        title="Import dari Excel (.xlsx)"
                      >
                        <span className="material-symbols-outlined text-[18px]">table_chart</span>
                        <span className="hidden sm:inline">Import Excel</span>
                      </button>
                      {/* Import Word */}
                      <button
                        onClick={() => wordInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition-colors min-h-[44px]"
                        title="Import dari Word/TXT (.docx, .txt)"
                      >
                        <span className="material-symbols-outlined text-[18px]">description</span>
                        <span className="hidden sm:inline">Import Word</span>
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
                        onClick={() => setFormNarasi({ isOpen: true, data: null })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors min-h-[44px]"
                        title="Tambah Narasi Soal"
                      >
                        <span className="material-symbols-outlined text-[18px]">article</span>
                        <span>Narasi Soal</span>
                      </button>
                      <button
                        onClick={() => setFormSoal({ isOpen: true, data: null, id_mapel: selectedMapel })}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 min-h-[44px]"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        <span>Tambah Soal</span>
                      </button>
                    </div>
                  </div>

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
                      {['ALL', 'PG', 'PGK', 'JODOH', 'URAIAN', 'NARASI'].map(tipe => (
                        <button
                          key={tipe}
                          onClick={() => { setFilterTipeSoal(tipe); setBankSoalPage(1); }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] ${
                            filterTipeSoal === tipe
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {tipe === 'ALL' ? 'Semua Tipe' : tipe === 'NARASI' ? 'Narasi Soal' : tipe}
                        </button>
                      ))}
                    </div>

                    {/* KD Filter & Search Input */}
                    <div className="flex items-center gap-2">
                      <select
                        value={filterKDSoal}
                        onChange={(e) => { setFilterKDSoal(e.target.value); setBankSoalPage(1); }}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3 py-2 outline-none text-slate-700 dark:text-slate-200 shrink-0"
                      >
                        <option value="ALL">Semua KD</option>
                        {availableKDList.map(kd => (
                          <option key={kd} value={kd}>KD {kd}</option>
                        ))}
                      </select>

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
                            <th className="py-3 px-4 w-20 text-center">KD</th>
                            <th className="py-3 px-4">Pertanyaan</th>
                            <th className="py-3 px-4 w-28 text-center">Bobot</th>
                            <th className="py-3 px-4 text-right w-24">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {isLoading ? (
                            <TableSkeleton rows={6} cols={6} asTableRows={true} hasAvatar={false} />
                          ) : paginatedSoal.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8">
                                <EmptyState
                                  compact={true}
                                  icon="quiz"
                                  title="Tidak Ada Butir Soal"
                                  description={searchQuerySoal || filterTipeSoal !== 'ALL' || filterKDSoal !== 'ALL' ? 'Tidak ada soal yang cocok dengan filter yang dipilih.' : 'Belum ada soal pada mata pelajaran ini.'}
                                  action={{
                                    label: 'Tambah Soal Baru',
                                    onClick: () => setFormSoal({ isOpen: true, data: null, id_mapel: selectedMapel })
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
                                <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                                  {soal.kd || soal.kompetensi_dasar || '-'}
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
                                        if (soal.tipe_soal === 'NARASI') {
                                          setFormNarasi({ isOpen: true, data: soal });
                                        } else {
                                          setFormSoal({ isOpen: true, data: soal, id_mapel: soal.id_mapel || selectedMapel });
                                        }
                                      }}
                                      className="p-1.5 text-primary hover:bg-primary/10 dark:hover:bg-primary/10 rounded-lg transition-colors"
                                      title={soal.tipe_soal === 'NARASI' ? 'Edit Narasi Soal' : 'Edit Soal'}
                                    >
                                      <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() => deleteSoal(soal.id_soal)}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                      title="Hapus Soal"
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
                              {soal.kd && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                                  KD {soal.kd}
                                </span>
                              )}
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
                                if (soal.tipe_soal === 'NARASI') {
                                  setFormNarasi({ isOpen: true, data: soal });
                                } else {
                                  setFormSoal({ isOpen: true, data: soal, id_mapel: soal.id_mapel || selectedMapel });
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 dark:bg-primary/10 hover:bg-primary/20 flex items-center gap-1 min-h-[38px]"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => deleteSoal(soal.id_soal)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 flex items-center gap-1 min-h-[38px]"
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

          {/* ================= TAB 6: HASIL & EVALUASI ================= */}
          {activeTab === 'hasil' && (() => {
            const tingkatList = Array.from(new Set(dataKelas.map(k => k.tingkat).filter(Boolean)));
            const availableParalels = filterKelasHasil && filterKelasHasil !== 'Umum'
              ? Array.from(new Set(dataKelas.filter(k => k.tingkat === filterKelasHasil).map(k => k.kelas_paralel).filter(Boolean)))
              : [];

            const filteredJadwalHasil = dataJadwal.filter(j => {
              if (j.status_ujian !== 'SELESAI') return false;
              // Strict Scoping: Guru only accesses evaluation for subjects they teach
              const isTaughtSubject = dataMapel.some(m => String(m.id_mapel) === String(j.id_mapel));
              if (!isTaughtSubject) return false;
              if (filterMapelHasil && filterMapelHasil !== 'ALL' && j.nama_mapel !== filterMapelHasil) return false;
              if (filterKelasHasil && filterKelasHasil !== 'Umum') {
                if (j.target_kelas && !isUniversalAlloc(j.target_kelas) && !isClassMatching(j.target_kelas, { angkatan: filterKelasHasil, kelas: filterKelasHasil })) {
                  return false;
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
                          const allP = dataKelas.filter(k => k.tingkat === val).map(k => k.kelas_paralel).filter(Boolean);
                          setFilterParalelHasil(Array.from(new Set(allP)));
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        <option value="">-- Pilih Kelas / Tingkat --</option>
                        {tingkatList.map(t => (
                          <option key={t} value={t}>{t.startsWith('Kelas') || t.startsWith('Tingkat') ? t : `Tingkat ${t}`}</option>
                        ))}
                        <option value="Umum">Umum / Semua Tingkat</option>
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
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                                SELESAI
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
                            onClick={() => openDetailHasil(j)}
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

              {/* Pengaturan Skema Penilaian di Menu Akun */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">tune</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-800 dark:text-white">Pengaturan Skema Penilaian</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Atur model penilaian per mata pelajaran atau pilih format default dari admin sekolah
                    </p>
                  </div>
                </div>

                {dataMapel.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200">
                    Belum ada mata pelajaran yang ditugaskan ke akun Anda oleh admin sekolah.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Pilih Mata Pelajaran
                      </label>
                      <select
                        value={selectedMapelAccount}
                        onChange={(e) => setSelectedMapelAccount(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
                      >
                        {dataMapel.map((m) => (
                          <option key={m.id_mapel} value={m.id_mapel}>
                            {m.nama_mapel} ({m.kode_mapel || m.id_mapel})
                          </option>
                        ))}
                      </select>
                    </div>

                    {accountSoalLoading ? (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-3xl animate-spin mb-2">progress_activity</span>
                        <span>Memuat skema penilaian mata pelajaran...</span>
                      </div>
                    ) : (
                      <SkemaPenilaianPanel
                        dataSoal={accountDataSoal}
                        onSave={saveSkemaAccount}
                      />
                    )}
                  </div>
                )}
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

        const unratedStudents = dataHasilSiswa.filter(s =>
          (s.status_ujian === 'SELESAI' || Number(s.total_dijawab) > 0) &&
          (s.nilai_uraian === null || s.nilai_uraian === undefined)
        );
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
                    <button
                      type="button"
                      onClick={() => openPeriksaUraian(unratedStudents[0])}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-xs transition-all shrink-0 min-h-[40px]"
                    >
                      <span className="material-symbols-outlined text-[18px]">draw</span>
                      <span>Mulai Koreksi Cepat ({unratedCount})</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-3.5 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400">check_circle</span>
                    <span>Semua jawaban uraian telah dinilai untuk jadwal ujian ini.</span>
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
                                {idx === 0 ? 'ÃƒÂ°Ã…Â¸Ã‚Â¥Ã¢â‚¬Â¡' : idx === 1 ? 'ÃƒÂ°Ã…Â¸Ã‚Â¥Ã‹â€ ' : idx === 2 ? 'ÃƒÂ°Ã…Â¸Ã‚Â¥Ã¢â‚¬Â°' : idx + 1}
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
      {/* MODAL: PROCTOR ACTION CONFIRMATION DIALOG                        */}
      {/* ================================================================= */}
      {renderConfirmDialog()}

      {/* ================================================================= */}
      {/* MODAL: RESET SESI PESERTA                                         */}
      {/* ================================================================= */}
      {renderResetModal()}

      {/* ================================================================= */}
      {/* MODAL: PERIKSA JAWABAN URAIAN (Integrated ModalPeriksaUraian)     */}
      {/* ================================================================= */}
      {(() => {
        const remainingUnrated = (dataHasilSiswa || []).filter(s =>
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
              <SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} />
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
      <FormSoalModal
        isOpen={formSoal.isOpen}
        data={formSoal.data}
        narasiList={[]}
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
        gasWebhookUrl={gasWebhookUrl}
        onClose={() => setFormSoal({ isOpen: false, data: null, id_mapel: '' })}
        onSave={handleSaveSoal}
      />

      {/* Form Narasi Modal */}
      <FormNarasiModal
        isOpen={formNarasi.isOpen}
        data={formNarasi.data}
        onClose={() => setFormNarasi({ isOpen: false, data: null })}
        onSave={saveSoal}
      />

      {/* Tutorial & Panduan Alur Modal (Milestone 3 - R7) */}
      <TutorialModal
        isOpen={showTutorialModal}
        initialRole="guru"
        onClose={handleCloseTutorial}
        onRestart={handleRestartTutorial}
      />
    </div>
  );
};

export default GuruView;
