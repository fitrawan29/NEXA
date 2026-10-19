import { fetchAPI, getTrueNow, get_default_skema_sekolah, isClassMatching, isUniversalAlloc } from '../api.js';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import FormSoalModal from '../components/FormSoalModal.jsx';
import FormNarasiModal from '../components/FormNarasiModal.jsx';
import ModalPeriksaUraian from '../components/ModalPeriksaUraian.jsx';
import SkemaPenilaianPanel from '../components/SkemaPenilaianPanel.jsx';
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
import ModalPratinjauTandaTangan from '../components/ModalPratinjauTandaTangan.jsx';
import DokumenUjianPrint from '../components/DokumenUjianPrint.jsx';
import TutorialModal from '../components/TutorialModal.jsx';
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
    const target = tabId === 'kontrol' ? 'monitoring' : tabId;
    setActiveTab(target);
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

  // Proctor Dashboard & Attendance Verification State (Requirement 3)
  const [dataTugasPengawas, setDataTugasPengawas] = useState([]);
  const [selectedPengawasRuang, setSelectedPengawasRuang] = useState(null);
  const [pesertaPengawas, setPesertaPengawas] = useState([]);
  const [loadingPengawas, setLoadingPengawas] = useState(false);
  const [inspectStudentSignature, setInspectStudentSignature] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [filterStatusPengawas, setFilterStatusPengawas] = useState('ALL');
  const [searchPengawas, setSearchPengawas] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [loadingPrint, setLoadingPrint] = useState(false);

  // Berita Acara & Live Camera WebRTC State (Milestone 2 - R2)
  const [catatanPelaksanaan, setCatatanPelaksanaan] = useState('');
  const [fotoDokumentasi, setFotoDokumentasi] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
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
    if (!tutorialStorageKey) return;
    try {
      const seen = localStorage.getItem(tutorialStorageKey);
      if (!seen) {
        setShowTutorialModal(true);
      }
    } catch (e) {
      console.error('Failed to read tutorial state from localStorage:', e);
    }
  }, [tutorialStorageKey]);

  const handleCloseTutorial = () => {
    setShowTutorialModal(false);
    if (tutorialStorageKey) {
      try {
        localStorage.setItem(tutorialStorageKey, 'true');
      } catch (e) {
        console.error('Failed to save tutorial state to localStorage:', e);
      }
    }
  };
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [isSavingBeritaAcara, setIsSavingBeritaAcara] = useState(false);
  const [existingSignature, setExistingSignature] = useState('');
  const [hasProctorSigned, setHasProctorSigned] = useState(false);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [loadedRoomId, setLoadedRoomId] = useState(null);
  const sigCanvasRef = useRef(null);

  // Camera WebRTC State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraInputFileRef = useRef(null);

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
  const guruId = user.id_guru || user.id_user;

  // =========================================================================
  // Data Fetching
  // =========================================================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resKelas = await api('get_kelas', {});
      if (resKelas.status === 'success') setDataKelas(resKelas.data || []);

      // Fetch assigned proctor rooms for dashboard notification card and pengawasan tab
      const resTugas = await api('get_ruang_guru_pengawas', { id_guru: guruId });
      if (resTugas.status === 'success') {
        const listTugas = resTugas.data || [];
        setDataTugasPengawas(listTugas);
        setSelectedPengawasRuang(prev => {
          if (prev && listTugas.some(t => t.id_penugasan === prev.id_penugasan)) {
            return listTugas.find(t => t.id_penugasan === prev.id_penugasan);
          }
          return listTugas[0] || null;
        });
      }

      if (activeTab === 'jadwal' || activeTab === 'dashboard' || activeTab === 'akun') {
        const res = await api('get_jadwal_pengawas', { id_guru: guruId });
        if (res.status === 'success') setDataJadwal(res.data || []);
        const resMapel = await api('get_mapel_guru', { id_guru: guruId });
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);
      } else if (activeTab === 'pengawasan') {
        // Active in proctor room view
      } else if (activeTab === 'pengumuman') {
        const res = await api('get_pengumuman', { role: 'guru' });
        if (res.status === 'success') setDataPengumuman(res.data || []);
      } else if (activeTab === 'monitoring' || activeTab === 'kontrol' || activeTab === 'hasil') {
        const res = await api('get_jadwal_pengawas', { id_guru: guruId });
        if (res.status === 'success') setDataJadwal(res.data || []);
        const resMapel = await api('get_mapel_guru', { id_guru: guruId });
        if (resMapel.status === 'success') setDataMapel(resMapel.data || []);

        if (selectedJadwal && (activeTab === 'monitoring' || activeTab === 'kontrol')) {
          const jId = typeof selectedJadwal === 'object' ? selectedJadwal.id_jadwal : selectedJadwal;
          const logRes = await api('monitoring_ujian', { id_jadwal: jId });
          if (logRes.status === 'success') setDataLog(logRes.data || []);
        }
      } else if (activeTab === 'logs') {
        const res = await api('get_audit_log', { username: user.username });
        if (res.status === 'success') setDataAudit(res.data || []);
        const resArc = await api('get_audit_log_archive', { username: user.username });
        if (resArc.status === 'success') setDataAuditArchive(resArc.data || []);
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
    let interval;
    if (activeTab === 'monitoring' && selectedJadwal) {
      interval = setInterval(fetchData, 15000);
    }
    return () => clearInterval(interval);
  }, [activeTab, selectedJadwal, selectedMapel]);

  // Proctor Dashboard Data Fetching & Verification Handlers (Requirement 3)
  const fetchPesertaRuangPengawas = async (targetTugas = selectedPengawasRuang) => {
    if (!targetTugas) return;
    setLoadingPengawas(true);
    try {
      const jId = targetTugas.id_jadwal;
      const rId = targetTugas.id_ruang;

      const [absRes, dokRes] = await Promise.all([
        api('get_absensi_ruang', { id_jadwal: jId, id_ruang: rId }),
        api('get_dokumen_ujian_cetak', { id_jadwal: jId, id_ruang: rId })
      ]);

      const absensiList = (absRes.status === 'success' && Array.isArray(absRes.data)) ? absRes.data : [];
      const dokPeserta = (dokRes.status === 'success' && dokRes.data && Array.isArray(dokRes.data.peserta)) ? dokRes.data.peserta : [];

      const absMap = {};
      absensiList.forEach(a => {
        if (a.id_siswa) absMap[a.id_siswa] = a;
      });

      let combinedList = [];
      if (dokPeserta.length > 0) {
        combinedList = dokPeserta.map((p, idx) => {
          const abs = absMap[p.id_siswa];
          return {
            no: idx + 1,
            id_siswa: p.id_siswa,
            id_absensi: abs?.id_absensi || p.id_absensi || null,
            nama_lengkap: p.nama_lengkap,
            nisn: p.nisn || '-',
            kelas: p.kelas || targetTugas.jadwal?.target_kelas || '-',
            ruang: p.ruang || targetTugas.ruang?.nama_ruang || '-',
            status_ujian: p.status_ujian || (abs ? 'SEDANG KERJA' : 'BELUM KERJA'),
            tanda_tangan: abs?.tanda_tangan || p.tanda_tangan || null,
            status_kehadiran: abs?.status_kehadiran || p.status_kehadiran || (abs ? 'HADIR' : 'TIDAK HADIR'),
            status_verifikasi: abs?.status_verifikasi || p.status_verifikasi || (abs ? 'MENUNGGU' : 'BELUM ABSEN'),
            waktu_absen: abs?.waktu_absen || p.waktu_absen || null,
            foto_profil: p.foto_profil || abs?.siswa?.foto_profil || null
          };
        });
      } else {
        combinedList = absensiList.map((a, idx) => ({
          no: idx + 1,
          id_siswa: a.id_siswa,
          id_absensi: a.id_absensi,
          nama_lengkap: a.siswa?.nama_lengkap || 'Siswa',
          nisn: a.siswa?.nisn || '-',
          kelas: a.siswa?.kelas || targetTugas.jadwal?.target_kelas || '-',
          ruang: targetTugas.ruang?.nama_ruang || a.ruang || '-',
          status_ujian: a.status_ujian || 'SEDANG KERJA',
          tanda_tangan: a.tanda_tangan,
          status_kehadiran: a.status_kehadiran || 'HADIR',
          status_verifikasi: a.status_verifikasi || 'MENUNGGU',
          waktu_absen: a.waktu_absen,
          foto_profil: a.siswa?.foto_profil || null
        }));
      }

      setPesertaPengawas(combinedList);

      // Populate Berita Acara for the selected room if available
      if (dokRes.status === 'success' && dokRes.data) {
        const ba = dokRes.data.berita_acara;
        if (loadedRoomId !== rId) {
          setLoadedRoomId(rId);
          setCatatanPelaksanaan(ba?.catatan_pelaksanaan || '');
          setFotoDokumentasi(ba?.foto_dokumentasi || dokRes.data.foto_dokumentasi || '');
          setDriveUrl(ba?.drive_url || dokRes.data.drive_url || '');
          if (ba?.tanda_tangan_pengawas) {
            setExistingSignature(ba.tanda_tangan_pengawas);
            setHasProctorSigned(true);
          } else {
            setExistingSignature('');
            setHasProctorSigned(false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching peserta ruang pengawas:', err);
    }
    setLoadingPengawas(false);
  };

  // Camera stream cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'pengawasan' && selectedPengawasRuang) {
      fetchPesertaRuangPengawas(selectedPengawasRuang);
      const interval = setInterval(() => {
        fetchPesertaRuangPengawas(selectedPengawasRuang);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedPengawasRuang]);

  const kpiPengawas = useMemo(() => {
    const totalTerdaftar = pesertaPengawas.length;
    const hadirTerverifikasi = pesertaPengawas.filter(p => p.status_verifikasi === 'DISETUJUI' || p.status_verifikasi === 'TERVERIFIKASI').length;
    const menungguVerifikasi = pesertaPengawas.filter(p => p.status_verifikasi === 'MENUNGGU').length;
    const belumHadir = pesertaPengawas.filter(p => p.status_verifikasi === 'BELUM ABSEN' || !p.tanda_tangan || p.status_kehadiran === 'TIDAK HADIR' || p.status_kehadiran === 'BELUM HADIR').length;
    return {
      totalTerdaftar,
      hadirTerverifikasi,
      menungguVerifikasi,
      belumHadir
    };
  }, [pesertaPengawas]);

  const filteredPesertaPengawas = useMemo(() => {
    return pesertaPengawas.filter(p => {
      if (filterStatusPengawas === 'MENUNGGU' && p.status_verifikasi !== 'MENUNGGU') return false;
      if (filterStatusPengawas === 'DISETUJUI' && p.status_verifikasi !== 'DISETUJUI' && p.status_verifikasi !== 'TERVERIFIKASI') return false;
      if (filterStatusPengawas === 'BELUM' && p.status_verifikasi !== 'BELUM ABSEN' && p.status_kehadiran !== 'TIDAK HADIR' && p.tanda_tangan) return false;

      if (searchPengawas.trim()) {
        const q = searchPengawas.toLowerCase().trim();
        const nama = (p.nama_lengkap || '').toLowerCase();
        const nisn = (p.nisn || '').toLowerCase();
        const kelas = (p.kelas || '').toLowerCase();
        if (!nama.includes(q) && !nisn.includes(q) && !kelas.includes(q)) return false;
      }
      return true;
    });
  }, [pesertaPengawas, filterStatusPengawas, searchPengawas]);

  const handleSingleApprove = async (student) => {
    if (!student?.id_absensi) return;
    setIsVerifying(true);
    try {
      const res = await api('verifikasi_absensi', {
        id_absensi: student.id_absensi,
        status_verifikasi: 'DISETUJUI',
        id_guru: guruId
      });
      if (res.status === 'success') {
        logActivity('VERIFIKASI ABSENSI', `Menyetujui kehadiran siswa ${student.nama_lengkap || student.nisn}`);
        setInspectStudentSignature(null);
        await fetchPesertaRuangPengawas(selectedPengawasRuang);
      } else {
        showMessage('Gagal', res.message || 'Gagal memverifikasi kehadiran.', 'error');
      }
    } catch (e) {
      console.error('Single approval error:', e);
    }
    setIsVerifying(false);
  };

  const handleSingleReject = async (student) => {
    if (!student?.id_absensi) return;
    setIsVerifying(true);
    try {
      const res = await api('verifikasi_absensi', {
        id_absensi: student.id_absensi,
        status_verifikasi: 'DITOLAK',
        id_guru: guruId
      });
      if (res.status === 'success') {
        logActivity('TOLAK ABSENSI', `Menolak tanda tangan kehadiran siswa ${student.nama_lengkap || student.nisn}`);
        setInspectStudentSignature(null);
        await fetchPesertaRuangPengawas(selectedPengawasRuang);
      } else {
        showMessage('Gagal', res.message || 'Gagal menolak kehadiran.', 'error');
      }
    } catch (e) {
      console.error('Single reject error:', e);
    }
    setIsVerifying(false);
  };

  const handleBulkApprove = async () => {
    const pendingList = pesertaPengawas.filter(p => p.status_verifikasi === 'MENUNGGU' && p.id_absensi);
    if (pendingList.length === 0) return;
    setIsVerifying(true);
    try {
      const res = await api('verifikasi_absensi_bulk', {
        list_id_absensi: pendingList.map(p => p.id_absensi),
        id_guru: guruId,
        status_verifikasi: 'DISETUJUI'
      });
      if (res.status === 'success') {
        logActivity('VERIFIKASI ABSENSI BULK', `Menyetujui kehadiran ${pendingList.length} siswa di ${selectedPengawasRuang?.ruang?.nama_ruang || 'ruang ujian'}`);
        await fetchPesertaRuangPengawas(selectedPengawasRuang);
      } else {
        showMessage('Gagal', res.message || 'Gagal memverifikasi semua kehadiran.', 'error');
      }
    } catch (e) {
      console.error('Bulk approval error:', e);
    }
    setIsVerifying(false);
  };

  const handleOpenPrintDocument = async (tugas = selectedPengawasRuang) => {
    if (!tugas) return;
    setLoadingPrint(true);
    try {
      const res = await api('get_dokumen_ujian_cetak', {
        id_jadwal: tugas.id_jadwal,
        id_ruang: tugas.id_ruang,
        npsn: user.npsn
      });
      if (res.status === 'success') {
        setPrintData(res.data);
        setPrintModalOpen(true);
      } else {
        showMessage('Gagal', 'Gagal memuat dokumen ujian untuk dicetak: ' + (res.message || 'Error'), 'error');
      }
    } catch (e) {
      console.error('Print fetch error:', e);
      showMessage('Info', 'Terjadi kesalahan saat memuat berkas cetak dokumen ujian.', 'info');
    }
    setLoadingPrint(false);
  };

  const handleOpenPrintDocumentForJadwal = async (jdw) => {
    if (!jdw?.id_jadwal) return;
    setLoadingPrint(true);
    try {
      const res = await api('get_dokumen_ujian_cetak', {
        id_jadwal: jdw.id_jadwal,
        id_ruang: jdw.id_ruang || undefined,
        npsn: user.npsn
      });
      if (res.status === 'success' && res.data) {
        setPrintData(res.data);
        setPrintModalOpen(true);
      } else {
        showMessage('Gagal', res.message || 'Gagal memuat dokumen pengawasan ujian.', 'error');
      }
    } catch (e) {
      console.error('Fetch Dokumen Ujian Jadwal error:', e);
      showMessage('Info', 'Terjadi kesalahan saat memuat berkas cetak dokumen ujian.', 'info');
    }
    setLoadingPrint(false);
  };

  // Proctor Signature Canvas Helpers (Milestone 2 - R2)
  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startSigDrawing = (e) => {
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawingSig(true);
    setHasProctorSigned(true);
  };

  const drawSig = (e) => {
    if (!isDrawingSig) return;
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopSigDrawing = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasProctorSigned(false);
    setExistingSignature('');
  };

  // Live Camera WebRTC & Watermarking Functions (Milestone 2 - R2)
  const startCamera = async () => {
    setCameraLoading(true);
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const constraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('WebRTC getUserMedia not available or permission denied:', err);
      showMessage('Info Kamera', 'Akses kamera langsung tidak tersedia atau ditolak. Anda dapat menggunakan opsi jepret / unggah foto.', 'info');
      if (cameraInputFileRef.current) {
        cameraInputFileRef.current.click();
      }
    }
    setCameraLoading(false);
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const switchCameraFacing = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.error('Failed to switch camera:', e);
      }
    }
  };

  const applyWatermarkAndProcess = async (sourceImageOrVideo, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw frame
    ctx.drawImage(sourceImageOrVideo, 0, 0, width, height);

    // 2. Draw watermark gradient banner at the bottom
    const bannerHeight = Math.max(90, Math.round(height * 0.18));
    const gradient = ctx.createLinearGradient(0, height - bannerHeight, 0, height);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

    // Subtle emerald top border on watermark strip
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = Math.max(2, Math.round(height * 0.005));
    ctx.beginPath();
    ctx.moveTo(0, height - bannerHeight);
    ctx.lineTo(width, height - bannerHeight);
    ctx.stroke();

    // 3. Render watermark text
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    const roomName = selectedPengawasRuang?.ruang?.nama_ruang || selectedPengawasRuang?.nama_ruang || 'Ruang Ujian';
    const schoolName = user?.nama_sekolah || user?.sekolah || 'SEKOLAH INDONESIA';
    const mapelName = selectedPengawasRuang?.jadwal?.mata_pelajaran?.nama_mapel || selectedPengawasRuang?.jadwal?.nama_mapel || 'Ujian CBT';
    const targetKelas = selectedPengawasRuang?.jadwal?.target_kelas || selectedPengawasRuang?.jadwal?.kelas || 'Semua Kelas';
    const proctorName = user?.nama_lengkap || user?.username || 'Pengawas';

    const baseFontSize = Math.max(12, Math.round(height * 0.026));
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';

    // Line 1: Date & Time
    ctx.font = `bold ${baseFontSize + 2}px sans-serif`;
    ctx.fillStyle = '#34d399';
    ctx.fillText(`📅 ${dateStr} • ${timeStr}`, 20, height - bannerHeight + 14);

    // Line 2: Room & School
    ctx.font = `bold ${baseFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`📍 ${roomName} — ${schoolName}`, 20, height - bannerHeight + 18 + baseFontSize + 4);

    // Line 3: Subject & Class
    ctx.font = `600 ${baseFontSize - 1}px sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`📖 Mapel: ${mapelName} | Kelas: ${targetKelas}`, 20, height - bannerHeight + 22 + (baseFontSize * 2) + 6);

    // Line 4: Proctor Name
    ctx.font = `500 ${baseFontSize - 2}px sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`👤 Pengawas: ${proctorName}${user?.nip ? ` (NIP: ${user.nip})` : ''} • DOKUMENTASI RESMI CBT`, 20, height - bannerHeight + 26 + (baseFontSize * 3) + 8);

    const watermarkedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setFotoDokumentasi(watermarkedDataUrl);

    // Automatically trigger GAS Drive sync if webhook URL is configured
    syncToGoogleDrive(watermarkedDataUrl);
    return watermarkedDataUrl;
  };

  const captureLivePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    await applyWatermarkAndProcess(video, w, h);
    stopCamera();
    showMessage('Berhasil', 'Foto dokumentasi pengawasan berhasil diambil dan dibubuhi watermark.', 'success');
  };

  const handleFallbackPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          await applyWatermarkAndProcess(img, w, h);
          showMessage('Berhasil', 'Foto berhasil diproses dengan watermark lokasi, waktu, dan pengawas.', 'success');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Fallback photo select error:', err);
      showMessage('Gagal', 'Gagal memproses file foto pengawasan.', 'error');
    }
  };

  const syncToGoogleDrive = async (base64Image) => {
    const targetGasUrl = (gasWebhookUrl || '').trim();
    if (!targetGasUrl || !base64Image) return; // Clean fallback to local dataUrl

    setIsUploadingDrive(true);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

    try {
      const safeRoom = (selectedPengawasRuang?.ruang?.nama_ruang || selectedPengawasRuang?.nama_ruang || 'RUANG').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `DOK_${safeRoom}_${Date.now()}.jpg`;
      const safeSchool = (user?.nama_sekolah || user?.sekolah || 'Umum').trim() || 'Umum';
      const safeClass = (selectedPengawasRuang?.jadwal?.target_kelas || selectedPengawasRuang?.jadwal?.kelas || 'Umum').trim() || 'Umum';
      const safeSubject = (selectedPengawasRuang?.jadwal?.mata_pelajaran?.nama_mapel || selectedPengawasRuang?.jadwal?.nama_mapel || 'Ujian').trim() || 'Ujian';

      const payload = {
        action: 'upload_dokumentasi',
        image: base64Image,
        filename,
        rootFolder: 'NEXA',
        sekolah: safeSchool,
        ruang: selectedPengawasRuang?.ruang?.nama_ruang || selectedPengawasRuang?.nama_ruang || 'Ruang',
        mapel: safeSubject,
        kelas: safeClass,
        schoolName: safeSchool,
        className: safeClass,
        subjectName: safeSubject,
        pengawas: user?.nama_lengkap || user?.username || 'Pengawas',
        folderPath: 'NEXA/' + safeSchool + '/' + safeClass + '/' + safeSubject,
        hierarchy: ['NEXA', safeSchool, safeClass, safeSubject]
      };

      const resp = await fetch(targetGasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller?.signal
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && (data.url || data.drive_url || data.fileUrl)) {
          const gUrl = data.url || data.drive_url || data.fileUrl;
          setDriveUrl(gUrl);
          showMessage('Sinkronisasi Google Drive', 'Foto dokumentasi berhasil diunggah ke Google Drive!', 'success');
        }
      }
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('Google Drive GAS sync failed, using watermarked local data URL:', e);
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const handleSaveBeritaAcara = async () => {
    if (!selectedPengawasRuang) return;
    setIsSavingBeritaAcara(true);
    try {
      let finalSignature = existingSignature;
      if (sigCanvasRef.current && hasProctorSigned) {
        try {
          finalSignature = sigCanvasRef.current.toDataURL('image/png');
        } catch (_) {}
      }

      const absentList = pesertaPengawas
        .filter(p => p.status_kehadiran === 'TIDAK HADIR' || p.status_verifikasi === 'BELUM ABSEN')
        .map(p => ({ id_siswa: p.id_siswa, nama_lengkap: p.nama_lengkap, nisn: p.nisn, kelas: p.kelas }));

      const totalHadir = pesertaPengawas.filter(p => p.status_kehadiran === 'HADIR' || p.status_verifikasi === 'DISETUJUI' || p.status_verifikasi === 'TERVERIFIKASI' || p.status_verifikasi === 'MENUNGGU').length;

      const payload = {
        id_jadwal: selectedPengawasRuang.id_jadwal,
        id_ruang: selectedPengawasRuang.id_ruang,
        id_guru: guruId,
        npsn: user.npsn,
        jumlah_peserta_terdaftar: pesertaPengawas.length,
        jumlah_peserta_hadir: totalHadir,
        jumlah_peserta_absen: Math.max(0, pesertaPengawas.length - totalHadir),
        daftar_siswa_tidak_hadir: absentList,
        catatan_pelaksanaan: catatanPelaksanaan,
        tanda_tangan_pengawas: finalSignature || null,
        foto_dokumentasi: fotoDokumentasi || null,
        drive_url: driveUrl || null
      };

      const res = await api('save_berita_acara', payload);
      if (res.status === 'success') {
        showMessage('Berhasil', 'Berita Acara dan Catatan Pengawasan Ujian berhasil disimpan.', 'success');
        logActivity('SIMPAN BERITA ACARA', `Menyimpan berita acara ruang ${selectedPengawasRuang?.ruang?.nama_ruang || ''}`);
        if (finalSignature) setExistingSignature(finalSignature);
      } else {
        showMessage('Gagal', res.message || 'Gagal menyimpan berita acara.', 'error');
      }
    } catch (err) {
      console.error('Save Berita Acara error:', err);
      showMessage('Gagal', 'Terjadi kesalahan saat menyimpan berita acara ujian.', 'error');
    }
    setIsSavingBeritaAcara(false);
  };

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
      {
        tipe_soal: 'PG',
        pertanyaan: 'Hasil dari 5 + 7 adalah...',
        opsi_A: '10',
        opsi_B: '11',
        opsi_C: '12',
        opsi_D: '13',
        opsi_E: '14',
        kunci_jawaban: 'C',
        bobot: 10,
        kd: '3.1',
        narasi_soal: ''
      },
      {
        tipe_soal: 'PGK',
        pertanyaan: 'Manakah yang merupakan bilangan prima genap?',
        opsi_A: '2',
        opsi_B: '4',
        opsi_C: '6',
        opsi_D: '8',
        opsi_E: '10',
        kunci_jawaban: 'A',
        bobot: 10,
        kd: '3.1',
        narasi_soal: ''
      },
      {
        tipe_soal: 'JODOH',
        pertanyaan: 'Pasangkan ibukota negara berikut dengan tepat:',
        opsi_A: 'Indonesia = Jakarta',
        opsi_B: 'Jepang = Tokyo',
        opsi_C: 'Inggris = London',
        opsi_D: '',
        opsi_E: '',
        kunci_jawaban: 'Indonesia=Jakarta, Jepang=Tokyo, Inggris=London',
        bobot: 15,
        kd: '3.2',
        narasi_soal: ''
      },
      {
        tipe_soal: 'URAIAN',
        pertanyaan: 'Jelaskan konsep dasar hukum kekekalan energi secara singkat dan padat.',
        opsi_A: '',
        opsi_B: '',
        opsi_C: '',
        opsi_D: '',
        opsi_E: '',
        kunci_jawaban: 'Energi tidak dapat diciptakan atau dimusnahkan, hanya dapat berubah bentuk.',
        bobot: 20,
        kd: '3.3',
        narasi_soal: ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    XLSX.writeFile(wb, 'Template_Soal_NEXA_CBT.xlsx');
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
          { showMessage('Peringatan', 'File Excel kosong atau format tidak sesuai.', 'error'); return; }
        }

        const payloadData = rawData.map((row, idx) => {
          let finalKunci = row.kunci_jawaban ? String(row.kunci_jawaban).trim() : '';
          let opsiStr = null;
          let finalPertanyaan = row.pertanyaan || '';

          const narasiText = row.narasi_soal || row.wacana;
          if (narasiText) {
            finalPertanyaan = `<strong>Narasi Soal:</strong><br/>${narasiText}<br/><br/>${finalPertanyaan}`;
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
            } catch (err) {}
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
            bobot: row.bobot ? parseInt(row.bobot) : 10
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

  // =========================================================================
  // Live Monitoring HUD & Proctoring Interventions
  // =========================================================================
  const monitoringMetrics = useMemo(() => {
    const total = dataLog.length;
    const mengerjakan = dataLog.filter(l => l.status_ujian === 'SEDANG KERJA' && !l.is_blocked && (l.pelanggaran || 0) < 3).length;
    const selesai = dataLog.filter(l => l.status_ujian === 'SELESAI').length;
    const terblokir = dataLog.filter(l => l.is_blocked || (l.pelanggaran || 0) >= 3).length;
    return { total, mengerjakan, selesai, terblokir };
  }, [dataLog]);

  const availableMonitoringClasses = useMemo(() => {
    const classes = dataLog.map(log => {
      return log.kelas || (log.siswa ? `${log.siswa.angkatan || ''} ${log.siswa.kelas_paralel || ''}`.trim() : null);
    }).filter(Boolean);
    return Array.from(new Set(classes)).sort();
  }, [dataLog]);

  const filteredDataLog = useMemo(() => {
    return dataLog.filter(log => {
      // Status filter
      if (monitoringFilterStatus !== 'ALL') {
        if (monitoringFilterStatus === 'TERBLOKIR') {
          if (!log.is_blocked && (log.pelanggaran || 0) < 3) return false;
        } else if (monitoringFilterStatus === 'SEDANG KERJA') {
          if (log.status_ujian !== 'SEDANG KERJA' || log.is_blocked || (log.pelanggaran || 0) >= 3) return false;
        } else if (monitoringFilterStatus === 'SELESAI') {
          if (log.status_ujian !== 'SELESAI') return false;
        }
      }

      // Kelas filter
      if (monitoringFilterKelas !== 'ALL') {
        const studentClass = log.kelas || (log.siswa ? `${log.siswa.angkatan || ''} ${log.siswa.kelas_paralel || ''}`.trim() : '');
        if (studentClass !== monitoringFilterKelas) return false;
      }

      // Search query
      if (monitoringSearch.trim()) {
        const q = monitoringSearch.toLowerCase();
        const name = (log.nama_lengkap || log.siswa?.nama_lengkap || '').toLowerCase();
        const nisn = (log.nisn || log.siswa?.nisn || '').toLowerCase();
        if (!name.includes(q) && !nisn.includes(q)) return false;
      }

      return true;
    });
  }, [dataLog, monitoringFilterStatus, monitoringFilterKelas, monitoringSearch]);

  const handleUnblock = (idLog, idSiswa, idJadwal) => {
    setConfirmDialog({
      isOpen: true,
      type: 'unblock',
      title: 'Buka Blokir Siswa',
      message: 'Apakah Anda yakin ingin membuka blokir siswa ini? Peserta akan diizinkan kembali melanjutkan ujian.',
      icon: 'lock_open',
      actionText: 'Buka Blokir',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        if (idSiswa && idJadwal) {
          await api('buka_blokir_siswa', { p_id_siswa: idSiswa, p_id_jadwal: idJadwal });
        }
        await api('buka_blokir', { id_log: idLog });
        logActivity('BUKA BLOKIR', `Membuka blokir sesi ujian siswa (ID Log: ${idLog})`);
        fetchData();
        setIsLoading(false);
      }
    });
  };

  const handleBlock = (idLog) => {
    setConfirmDialog({
      isOpen: true,
      type: 'block',
      title: 'Blokir Sesi Siswa',
      message: 'Apakah Anda yakin ingin memblokir peserta ini? Peserta tidak akan dapat melanjutkan ujian sampai blokir dibuka.',
      icon: 'gpp_bad',
      actionText: 'Blokir Siswa',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        await api('catat_pelanggaran', { id_log: idLog });
        logActivity('BLOKIR SISWA', `Memblokir sesi ujian siswa (ID Log: ${idLog})`);
        fetchData();
        setIsLoading(false);
      }
    });
  };

  const handleResetSession = (idLogOrStudent, idSiswaOrJadwal, idJadwalParam) => {
    let idSiswa, idLog, idJadwal, sNama;
    const activeJadwalId = typeof selectedJadwal === 'object' ? selectedJadwal?.id_jadwal : selectedJadwal;
    if (typeof idLogOrStudent === 'object' && idLogOrStudent !== null) {
      idSiswa = idLogOrStudent.id_siswa;
      idLog = idLogOrStudent.id_log;
      sNama = idLogOrStudent.nama_lengkap || idSiswa;
      idJadwal = idSiswaOrJadwal || idLogOrStudent.id_jadwal || selectedPengawasRuang?.id_jadwal || activeJadwalId;
    } else {
      idLog = idLogOrStudent;
      idSiswa = idSiswaOrJadwal;
      idJadwal = idJadwalParam || activeJadwalId || selectedPengawasRuang?.id_jadwal;
      sNama = idSiswa;
    }

    setConfirmDialog({
      isOpen: true,
      type: 'reset',
      title: 'Reset Sesi Peserta',
      message: `Sesi ujian ${sNama ? `peserta ${sNama}` : 'siswa'} akan direset agar dapat masuk kembali ke ujian. Jawaban yang telah tersimpan tidak akan terhapus. Lanjutkan?`,
      icon: 'restart_alt',
      actionText: 'Reset Sesi',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        const res = await api('reset_sesi_siswa', {
          id_siswa: idSiswa,
          id_jadwal: idJadwal,
          p_id_siswa: idSiswa,
          p_id_jadwal: idJadwal,
          id_log: idLog,
          npsn: user.npsn
        });
        setIsLoading(false);
        if (res.status === 'success') {
          logActivity('RESET_SESI', `Reset sesi peserta: ${sNama || idSiswa} (${idSiswa || idLog})`);
          if (showMessage) showMessage('Berhasil', `Sesi ${sNama || idSiswa} berhasil direset. Siswa dapat login kembali.`, 'success');
          if (activeTab === 'pengawasan' && selectedPengawasRuang) {
            fetchPesertaRuangPengawas(selectedPengawasRuang);
          } else {
            fetchData();
          }
        } else {
          if (showMessage) showMessage('Gagal', res.message || 'Gagal mereset sesi siswa.', 'error');
        }
      }
    });
  };

  const handleForceStop = (idLog) => {
    setConfirmDialog({
      isOpen: true,
      type: 'stop',
      title: 'Hentikan Ujian Paksa',
      message: 'Apakah Anda yakin ingin menghentikan ujian peserta ini secara paksa? Status pengerjaan akan diset SELESAI.',
      icon: 'stop_circle',
      actionText: 'Hentikan Ujian',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        const res = await api('force_stop_ujian', { id_log: idLog });
        if (res.status === 'success') {
          logActivity('STOP PAKSA SISWA', `Menghentikan paksa ujian siswa pada sesi ${idLog}`);
          fetchData();
        }
        setIsLoading(false);
      }
    });
  };

  const handleResetJawaban = async (id_siswa, resetType) => {
    setIsLoading(true);
    const res = await api(resetType === 'total' ? 'reset_sesi_siswa' : 'reset_login_siswa', { id_siswa, npsn: user.npsn });
    setIsLoading(false);
    if (res.status === 'success') {
      showMessage('Berhasil', 'Berhasil mereset akun peserta.', 'success');
      logActivity('RESET SESI SISWA', `Reset sesi peserta (ID Siswa: ${id_siswa}, tipe: ${resetType})`);
      fetchData();
    } else {
      showMessage('Gagal', 'Gagal: ' + res.message, 'error');
    }
    setResetModal(null);
  };

  // Schedule control actions
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
      showMessage('Info', res.message, 'info');
    }
  };

  const handleGenerateToken = async (id) => {
    const res = await api('get_token', { id_jadwal: id });
    if (res.status === 'success') {
      showMessage('Info', 'Token Ujian: ' + res.token, 'info');
      logActivity('GENERATE TOKEN', `Membuat token ujian baru untuk jadwal ID ${id}`);
      fetchData();
    } else {
      showMessage('Info', res.message, 'info');
    }
  };

  const handlePerpanjangWaktu = async (id_jadwal, extraMinutes = 15) => {
    setIsLoading(true);
    const jadwal = dataJadwal.find(j => j.id_jadwal === id_jadwal);
    if (!jadwal) {
      setIsLoading(false);
      return;
    }
    const now = await getTrueNow();
    let currentEnd = jadwal.waktu_selesai ? new Date(jadwal.waktu_selesai) : now;
    if (currentEnd < now) currentEnd = now;
    const newEnd = new Date(currentEnd.getTime() + extraMinutes * 60 * 1000);
    const newDurasi = (Number(jadwal.durasi_menit) || 90) + extraMinutes;

    const res = await api('update_jadwal', {
      id_jadwal,
      waktu_selesai: newEnd.toISOString(),
      durasi_menit: newDurasi
    });
    setIsLoading(false);
    if (res.status === 'success') {
      const mapelNama = jadwal.nama_mapel || id_jadwal;
      showMessage('Berhasil', `Waktu ujian ${mapelNama} diperpanjang +${extraMinutes} menit.`, 'success');
      logActivity('PERPANJANG WAKTU', `Memperpanjang waktu ujian ${mapelNama} sebesar ${extraMinutes} menit`);
      fetchData();
    } else {
      showMessage('Gagal', res.message || 'Gagal memperpanjang waktu ujian', 'error');
    }
  };

  // =========================================================================
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

  const saveNilaiUraian = async (totalNilai) => {
    setIsLoading(true);
    const res = await api('update_nilai_uraian', {
      id_log: modalUraian.logUjian.id_log,
      nilai_uraian_total: totalNilai
    });
    setIsLoading(false);
    if (res.status === 'success') {
      logActivity('NILAI URAIAN', `Memberikan nilai uraian siswa pada sesi ${modalUraian.logUjian.id_log} skor ${totalNilai}`);
      setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] });

      // Live update the student's score in dataHasilSiswa
      setDataHasilSiswa(prev => prev.map(s => {
        if (s.id_log === modalUraian.logUjian.id_log) {
          const pg = Number(s.nilai_auto) || 0;
          return {
            ...s,
            nilai_uraian: totalNilai,
            total_nilai: pg + totalNilai
          };
        }
        return s;
      }));
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
        { id: 'jadwal', label: 'Jadwal Mengajar', icon: 'event_note' }
      ]
    },
    {
      title: 'Monitoring & Pengawasan',
      items: [
        { id: 'monitoring', label: 'Monitoring', icon: 'visibility' },
        { id: 'pengawasan', label: 'Ruang Pengawasan', icon: 'badge' },
        { id: 'hasil', label: 'Hasil & Rekap Nilai', icon: 'assessment' }
      ]
    },
    {
      title: 'Sistem',
      items: [
        { id: 'logs', label: 'Log Aktivitas', icon: 'history' },
        { id: 'akun', label: 'Profil Guru', icon: 'person' }
      ]
    }
  ];

  const bottomBarItems = [
    { id: 'dashboard', label: 'Beranda', icon: 'dashboard' },
    { id: 'bank_soal', label: 'Bank Soal', icon: 'quiz' },
    { id: 'jadwal', label: 'Jadwal', icon: 'event_note' },
    { id: 'monitoring', label: 'Monitoring', icon: 'visibility' },
    { id: '_drawer', label: 'Menu', icon: 'menu', isDrawerTrigger: true }
  ];

  const tabTitleMap = {
    dashboard: 'Beranda Guru',
    bank_soal: 'Bank Soal & Narasi',
    jadwal: 'Jadwal Ujian Mengajar',
    kontrol: 'Monitoring Ujian',
    monitoring: 'Monitoring Ujian',
    pengawasan: 'Ruang Pengawasan Ujian',
    hasil: 'Hasil & Rekap Evaluasi',
    logs: 'Log Aktivitas Guru',
    akun: 'Pengaturan Profil'
  };

  const tabSubtitleMap = {
    dashboard: 'Ringkasan tugas mengajar, pembuatan soal, dan ujian aktif',
    bank_soal: 'Kelola butir soal evaluasi, narasi soal stimulus, dan skema penilaian',
    jadwal: 'Daftar jadwal pelaksanaan ujian mata pelajaran yang diampu',
    kontrol: 'Pusat kontrol sesi, token ujian, monitoring real-time, dan intervensi peserta',
    monitoring: 'Pusat kontrol sesi, token ujian, monitoring real-time, dan intervensi peserta',
    pengawasan: 'Verifikasi tanda tangan digital kehadiran siswa dan kelola pengawasan ruang ujian',
    hasil: 'Rekapitulasi nilai, ranking peringkat siswa, dan analisis butir soal',
    logs: 'Catatan audit jejak aktivitas pengajaran dan pengawasan',
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
      <header className="lg:hidden flex-shrink-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 h-16 flex items-center justify-between shadow-xs">
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
            onClick={() => setShowTutorialModal(true)}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95 transition-all min-w-[44px] min-h-[44px] shadow-xs"
            title="Panduan & Tutorial"
            aria-label="Panduan & Tutorial"
          >
            <span className="material-symbols-outlined text-xl">help</span>
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
              {tabSubtitleMap[activeTab] || 'Kelola dan pantau aktivitas belajar mengajar CBT NEXA'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTutorialModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm"
              title="Panduan & Tutorial"
              aria-label="Panduan & Tutorial"
            >
              <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400">help</span>
              <span>Panduan</span>
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
              {/* Tugas Pengawasan Ruang Ujian Notification Card (Requirement 3) */}
              {dataTugasPengawas && dataTugasPengawas.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-primary/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-primary-950/40 border border-blue-200/90 dark:border-blue-800/80 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[22px]">badge</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">
                            Tugas Pengawasan Ruang Ujian
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                            {dataTugasPengawas.length} Ruang Ditugaskan
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Anda memiliki tugas pengawasan ruang ujian. Masuk ke ruang pengawasan untuk memantau kehadiran siswa dan memverifikasi tanda tangan digital kanvas.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (dataTugasPengawas.length > 0 && !selectedPengawasRuang) {
                          setSelectedPengawasRuang(dataTugasPengawas[0]);
                        }
                        navigateTab('pengawasan');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-xs shrink-0"
                    >
                      <span>Masuk Ruang Pengawas</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                  {/* Room Quick Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {dataTugasPengawas.map((tugas, idx) => (
                      <div
                        key={tugas.id_penugasan || idx}
                        onClick={() => {
                          setSelectedPengawasRuang(tugas);
                          navigateTab('pengawasan');
                        }}
                        className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/90 border border-blue-100 dark:border-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                            {tugas.ruang?.nama_ruang || tugas.nama_ruang || `Ruang ${idx + 1}`}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tugas.jadwal?.mata_pelajaran?.nama_mapel || tugas.jadwal?.nama_mapel || 'Ujian'} • {tugas.jadwal?.target_kelas || 'Kelas'}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-blue-500 text-sm shrink-0 group-hover:translate-x-0.5 transition-transform">
                          chevron_right
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  onClick={() => navigateTab('monitoring')}
                  className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg sm:text-xl">visibility</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">
                      <span className="hidden sm:inline">Ujian Sedang Aktif</span>
                      <span className="sm:hidden">Ujian Aktif</span>
                    </p>
                    <h4 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight">{activeExamsCount}</h4>
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
                  {/* Live Exam HUD Card */}
                  <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700/60">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-purple-600 text-base">sensors</span>
                        Live Exam HUD
                      </h4>
                      {activeExamsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                          {activeExamsCount} Aktif
                        </span>
                      )}
                    </div>

                    {dataJadwal.filter(j => j.status_ujian === 'AKTIF').length > 0 ? (
                      <div className="space-y-2">
                        {dataJadwal.filter(j => j.status_ujian === 'AKTIF').slice(0, 3).map(j => (
                          <div
                            key={j.id_jadwal}
                            className="p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-800 dark:text-white truncate">
                                {j.nama_mapel || j.mata_pelajaran?.nama_mapel || 'Ujian'}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {j.kelas || 'Semua Kelas'} • {j.durasi_menit ? `${j.durasi_menit} mnt` : 'CBT'}
                              </p>
                            </div>
                            <button
                              onClick={() => { setSelectedJadwal(j); navigateTab('monitoring'); }}
                              className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-[11px] shrink-0 transition-colors shadow-xs"
                            >
                              Pantau
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada sesi ujian aktif saat ini.</p>
                      </div>
                    )}
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
                        onClick={() => navigateTab('monitoring')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-purple-500/50 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-purple-600 text-lg mb-1 block group-hover:scale-110 transition-transform">visibility</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Monitoring</p>
                        <p className="text-[10px] text-slate-400">Pantau siswa</p>
                      </button>

                      <button
                        onClick={() => navigateTab('jadwal')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-primary text-lg mb-1 block group-hover:scale-110 transition-transform">event_note</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Jadwal Ujian</p>
                        <p className="text-[10px] text-slate-400">Agenda mengajar</p>
                      </button>

                      <button
                        onClick={() => navigateTab('hasil')}
                        className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-amber-500/50 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 text-left transition-all group"
                      >
                        <span className="material-symbols-outlined text-amber-600 text-lg mb-1 block group-hover:scale-110 transition-transform">assessment</span>
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Rekap Nilai</p>
                        <p className="text-[10px] text-slate-400">Hasil & evaluasi</p>
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
                      <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                      <button
                        onClick={downloadTemplateSoal}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                        title="Unduh Template Excel"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        <span className="hidden sm:inline">Template</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
                        title="Import Excel"
                      >
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
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

          {/* ================= TAB 3: JADWAL MENGAJAR ================= */}
          {activeTab === 'jadwal' && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Jadwal Ujian & Mengajar</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Daftar jadwal pelaksanaan ujian mata pelajaran yang Anda ampu</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dataJadwal.map((j) => (
                  <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white leading-tight">{j.nama_mapel}</h4>
                        <StatusBadge status={j.status_ujian} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {j.target_kelas ? `Tingkat ${j.target_kelas}` : 'Umum / Semua Tingkat'}
                      </p>
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Waktu Mulai:</span>
                          <span className="font-semibold">{new Date(j.waktu_mulai).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Token Ujian:</span>
                          <span className="font-mono font-bold text-primary dark:text-primary-400">{j.token || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
                      {j.status_ujian === 'AKTIF' && (
                        <button
                          onClick={() => { setSelectedJadwal(j); navigateTab('monitoring'); }}
                          className="flex-1 py-2 px-3 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 min-h-[44px]"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Monitoring</span>
                        </button>
                      )}
                      {j.status_ujian === 'SELESAI' && (
                        <button
                          onClick={() => openDetailHasil(j)}
                          className="flex-1 py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold text-xs hover:bg-purple-100 transition-colors flex items-center justify-center gap-1 min-h-[44px]"
                        >
                          <span className="material-symbols-outlined text-[16px]">assessment</span>
                          <span>Rekap Nilai</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenPrintDocumentForJadwal(j)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1 min-h-[44px]"
                        title="Cetak Berita Acara & Dokumen Pengawasan Ujian"
                      >
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        <span>Dokumen Ujian</span>
                      </button>
                    </div>
                  </div>
                ))}
                {dataJadwal.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      icon="event_note"
                      title="Belum Ada Jadwal Ujian"
                      description="Belum ada jadwal pelaksanaan ujian yang dibuat untuk mata pelajaran Anda."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: UNIFIED MONITORING & KONTROL ================= */}
          {(activeTab === 'monitoring' || activeTab === 'kontrol') && (() => {
            const currJadwal = selectedJadwal
              ? (typeof selectedJadwal === 'object'
                  ? (dataJadwal.find(j => j.id_jadwal === selectedJadwal?.id_jadwal) || selectedJadwal)
                  : dataJadwal.find(j => j.id_jadwal === selectedJadwal))
              : null;

            return (
              <div className="space-y-5 animate-fade-in-up">
                {/* Header Navigation & Schedule Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                  <div className="flex items-center gap-3">
                    {currJadwal && (
                      <button
                        onClick={() => setSelectedJadwal(null)}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                        title="Kembali ke Daftar Jadwal"
                      >
                        <span className="material-symbols-outlined text-xl">arrow_back</span>
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-white truncate">
                          {currJadwal ? currJadwal.nama_mapel : 'Pusat Monitoring & Kontrol Ujian'}
                        </h3>
                        {currJadwal && <StatusBadge status={currJadwal.status_ujian} />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {currJadwal
                          ? `Target: ${currJadwal.target_kelas || 'Semua Kelas'} | Token: ${currJadwal.token || '-'}`
                          : 'Kelola sesi, rilis token, perpanjang waktu, dan pantau pengerjaan siswa real-time'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <select
                      value={currJadwal?.id_jadwal || ''}
                      onChange={(e) => {
                        const found = dataJadwal.find(j => j.id_jadwal === e.target.value);
                        setSelectedJadwal(found || null);
                      }}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none"
                    >
                      <option value="">-- Pilih Jadwal Ujian --</option>
                      {dataJadwal.map(j => (
                        <option key={j.id_jadwal} value={j.id_jadwal}>
                          {j.nama_mapel} ({j.status_ujian}) - {j.target_kelas || 'Semua'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={fetchData}
                      className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
                      title="Refresh Data"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                    </button>
                  </div>
                </div>

                {!currJadwal ? (
                  /* Schedule Grid Overview with Integrated Controls */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {dataJadwal.map((j) => (
                        <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-base text-slate-800 dark:text-white">{j.nama_mapel}</h4>
                                <p className="text-xs text-slate-500">Tingkat: {j.target_kelas || 'Semua Kelas'} | ID: {j.id_jadwal}</p>
                              </div>
                              <StatusBadge status={j.status_ujian} />
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Token Akses</p>
                                <p className="font-mono text-lg font-black text-primary dark:text-primary-400">{j.token || 'BELUM ADA'}</p>
                              </div>
                              <button
                                onClick={() => handleGenerateToken(j.id_jadwal)}
                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors min-h-[36px] flex items-center gap-1 shadow-2xs"
                                title="Rilis token baru"
                              >
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                <span>Rilis Token</span>
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                              <span>Waktu: {new Date(j.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>Durasi: {j.durasi_menit || 90} Mnt</span>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                              {j.status_ujian !== 'AKTIF' ? (
                                <button
                                  onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'AKTIF')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors min-h-[40px] flex items-center justify-center gap-1 shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                  <span>Aktifkan</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateStatusUjian(j.id_jadwal, 'SELESAI')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors min-h-[40px] flex items-center justify-center gap-1 shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[16px]">stop</span>
                                  <span>Akhiri</span>
                                </button>
                              )}
                              <button
                                onClick={() => handlePerpanjangWaktu(j.id_jadwal, 15)}
                                className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-xs transition-colors min-h-[40px] flex items-center gap-1"
                                title="Perpanjang waktu ujian +15 menit"
                              >
                                <span className="material-symbols-outlined text-[16px]">more_time</span>
                                <span>+15m</span>
                              </button>
                            </div>
                            <button
                              onClick={() => setSelectedJadwal(j)}
                              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 min-h-[42px]"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                              <span>Buka Proctoring HUD</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {dataJadwal.length === 0 && (
                      <EmptyState
                        icon="visibility"
                        title="Belum Ada Jadwal Ujian"
                        description="Belum ada jadwal pelaksanaan ujian yang dibuat untuk mata pelajaran Anda."
                      />
                    )}
                  </div>
                ) : (
                  /* Schedule selected: Integrated Control Strip + Proctoring HUD */
                  <div className="space-y-5">
                    {/* Control Strip for Selected Exam */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-primary/20 dark:border-primary/30 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center gap-3">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Token Ujian</p>
                            <p className="font-mono text-lg font-black text-primary dark:text-primary-400">{currJadwal.token || 'BELUM ADA'}</p>
                          </div>
                          <button
                            onClick={() => handleGenerateToken(currJadwal.id_jadwal)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                            title="Rilis Token Baru"
                          >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                          </button>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                          <p><span className="text-slate-400">Target:</span> <span className="font-bold">{currJadwal.target_kelas || 'Semua Kelas'}</span></p>
                          <p><span className="text-slate-400">Durasi:</span> <span className="font-bold">{currJadwal.durasi_menit || 90} Menit</span></p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Session Status Toggle */}
                        {currJadwal.status_ujian !== 'AKTIF' ? (
                          <button
                            onClick={() => handleUpdateStatusUjian(currJadwal.id_jadwal, 'AKTIF')}
                            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors min-h-[40px] flex items-center gap-1.5 shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                            <span>Aktifkan Ujian</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatusUjian(currJadwal.id_jadwal, 'SELESAI')}
                            className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors min-h-[40px] flex items-center gap-1.5 shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">stop</span>
                            <span>Akhiri Ujian</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatusUjian(currJadwal.id_jadwal, 'BELUM MULAI')}
                          className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-xs transition-colors min-h-[40px]"
                          title="Reset status ujian ke BELUM MULAI"
                        >
                          Reset Status
                        </button>

                        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                        {/* Exam Extension Buttons */}
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
                          <span className="text-[11px] font-bold text-slate-400 px-1.5 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[14px]">more_time</span>
                            <span>Perpanjang:</span>
                          </span>
                          <button
                            onClick={() => handlePerpanjangWaktu(currJadwal.id_jadwal, 15)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-primary hover:text-white dark:hover:bg-primary text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                            title="Tambah 15 menit ke waktu ujian"
                          >
                            +15m
                          </button>
                          <button
                            onClick={() => handlePerpanjangWaktu(currJadwal.id_jadwal, 30)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-primary hover:text-white dark:hover:bg-primary text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                            title="Tambah 30 menit ke waktu ujian"
                          >
                            +30m
                          </button>
                        </div>
                      </div>
                    </div>
                  {/* 4 KPI Summary Cards */}
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
                            <th className="py-3 px-4 text-right">Intervensi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {isLoading ? (
                            <TableSkeleton rows={5} cols={7} asTableRows={true} hasAvatar={true} />
                          ) : filteredDataLog.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8">
                                <EmptyState
                                  compact={true}
                                  icon="search_off"
                                  title="Data Peserta Tidak Ditemukan"
                                  description="Belum ada data pengerjaan siswa yang sesuai filter."
                                />
                              </td>
                            </tr>
                          ) : (
                            filteredDataLog.map((log, idx) => {
                              const sName = log.nama_lengkap || log.siswa?.nama_lengkap || 'Siswa';
                              const sClass = log.kelas || (log.siswa ? `${log.siswa.angkatan || ''} ${log.siswa.kelas_paralel || ''}`.trim() : '-') || '-';
                              const totalDijawab = log.total_dijawab !== undefined ? log.total_dijawab : (log.jawaban_count || 0);
                              const totalSoal = log.total_soal || (currJadwal?.total_soal || currJadwal?.jumlah_soal || 40);
                              const progressPercent = totalSoal > 0 ? Math.min(100, Math.round((totalDijawab / totalSoal) * 100)) : 0;
                              const isBlocked = log.is_blocked || (log.pelanggaran || 0) >= 3;
                              const jId = typeof selectedJadwal === 'object' ? selectedJadwal.id_jadwal : selectedJadwal;

                              return (
                                <tr key={log.id_log || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                                  <td className="py-3 px-4 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                        isBlocked ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-primary/15 text-primary-700 dark:bg-primary/10 dark:text-primary-300'
                                      }`}>
                                        {isBlocked ? <span className="material-symbols-outlined text-[16px]">block</span> : sName.substring(0, 2).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs">{sName}</p>
                                        <p className="text-[11px] font-mono text-slate-400">{log.nisn || log.siswa?.nisn || '-'}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                                      {sClass}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="w-full">
                                      <div className="flex justify-between items-center text-[11px] mb-1 font-semibold">
                                        <span className="text-slate-600 dark:text-slate-400">{totalDijawab} / {totalSoal} Soal</span>
                                        <span className={isBlocked ? 'text-rose-500 font-bold' : log.status_ujian === 'SELESAI' ? 'text-primary font-bold' : 'text-slate-700 dark:text-slate-300'}>
                                          {progressPercent}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full transition-all duration-500 rounded-full ${
                                            isBlocked ? 'bg-rose-500' : log.status_ujian === 'SELESAI' ? 'bg-sky-500' : 'bg-primary-400'
                                          }`}
                                          style={{ width: `${progressPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      (log.pelanggaran || 0) >= 3 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50' :
                                      (log.pelanggaran || 0) > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50' :
                                      'bg-slate-100 text-slate-500 dark:bg-slate-700'
                                    }`}>
                                      {log.pelanggaran || 0} / 3
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {isBlocked ? (
                                      <StatusBadge status="TERBLOKIR" />
                                    ) : (
                                      <StatusBadge status={log.status_ujian} />
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {isBlocked ? (
                                        <button
                                          onClick={() => handleUnblock(log.id_log, log.id_siswa, jId)}
                                          className="px-2.5 py-1.5 bg-primary/10 text-primary-700 dark:bg-primary/10 dark:text-primary-300 rounded-lg text-xs font-bold hover:bg-primary/15 transition-colors flex items-center gap-1 min-h-[36px]"
                                          title="Buka Blokir Siswa"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">lock_open</span>
                                          <span>Buka</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleBlock(log.id_log)}
                                          className="px-2.5 py-1.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1 min-h-[36px]"
                                          title="Blokir Sesi Siswa"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">gpp_bad</span>
                                          <span>Blokir</span>
                                        </button>
                                      )}

                                      <button
                                        onClick={() => handleResetSession(log.id_log, log.id_siswa, jId)}
                                        className="px-2.5 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 min-h-[36px]"
                                        title="Reset Sesi"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                        <span>Reset</span>
                                      </button>
                                      {log.status_ujian === 'SEDANG KERJA' && (
                                        <button
                                          onClick={() => handleForceStop(log.id_log)}
                                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1 min-h-[36px]"
                                          title="Stop Ujian Paksa"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                                          <span>Stop</span>
                                        </button>
                                      )}
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

                  {/* MOBILE COMPACT CARDS (md:hidden - 375px optimized) */}
                  <div className="md:hidden space-y-2.5">
                    {isLoading ? (
                      <TableSkeleton rows={4} cols={3} asTableRows={false} hasAvatar={true} />
                    ) : filteredDataLog.length === 0 ? (
                      <EmptyState
                        compact={true}
                        icon="search_off"
                        title="Tidak Ada Peserta"
                        description="Belum ada pengerjaan yang cocok."
                      />
                    ) : (
                      filteredDataLog.map((log, idx) => {
                        const sName = log.nama_lengkap || log.siswa?.nama_lengkap || 'Siswa';
                        const sClass = log.kelas || (log.siswa ? `${log.siswa.angkatan || ''} ${log.siswa.kelas_paralel || ''}`.trim() : '-') || '-';
                        const totalDijawab = log.total_dijawab !== undefined ? log.total_dijawab : (log.jawaban_count || 0);
                        const totalSoal = log.total_soal || (currJadwal?.total_soal || currJadwal?.jumlah_soal || 40);
                        const progressPercent = totalSoal > 0 ? Math.min(100, Math.round((totalDijawab / totalSoal) * 100)) : 0;
                        const isBlocked = log.is_blocked || (log.pelanggaran || 0) >= 3;
                        const jId = typeof selectedJadwal === 'object' ? selectedJadwal.id_jadwal : selectedJadwal;

                        return (
                          <div
                            key={log.id_log || idx}
                            className={`rounded-2xl p-4 border shadow-xs space-y-3 ${
                              isBlocked ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40' : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isBlocked ? 'bg-rose-100 text-rose-700' : 'bg-primary/15 text-primary-700'
                                }`}>
                                  {isBlocked ? <span className="material-symbols-outlined text-[18px]">block</span> : sName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">{sName}</h4>
                                  <p className="text-[10px] text-slate-400 font-mono">{log.nisn || log.siswa?.nisn || '-'} • {sClass}</p>
                                </div>
                              </div>
                              {isBlocked ? <StatusBadge status="TERBLOKIR" /> : <StatusBadge status={log.status_ujian} />}
                            </div>

                            {/* Progress bar */}
                            <div>
                              <div className="flex justify-between items-center text-[11px] mb-1 font-semibold">
                                <span className="text-slate-500">{totalDijawab} / {totalSoal} Soal</span>
                                <span className={isBlocked ? 'text-rose-500 font-bold' : 'text-primary font-bold'}>{progressPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 rounded-full ${
                                    isBlocked ? 'bg-rose-500' : log.status_ujian === 'SELESAI' ? 'bg-sky-500' : 'bg-primary-400'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Actions (>=44px touch targets) */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                              {isBlocked ? (
                                <button
                                  onClick={() => handleUnblock(log.id_log, log.id_siswa, jId)}
                                  className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1 min-h-[44px]"
                                >
                                  <span className="material-symbols-outlined text-[18px]">lock_open</span>
                                  <span>Buka Blokir</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBlock(log.id_log)}
                                  className="px-3.5 py-2 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1 min-h-[44px]"
                                >
                                  <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
                                  <span>Blokir</span>
                                </button>
                              )}

                              {log.status_ujian === 'SEDANG KERJA' && (
                                <>
                                  <button
                                    onClick={() => handleResetSession(log.id_log, log.id_siswa, jId)}
                                    className="px-3.5 py-2 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 min-h-[44px]"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                                    <span>Reset Sesi</span>
                                  </button>
                                  <button
                                    onClick={() => handleForceStop(log.id_log)}
                                    className="px-3 py-2 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors min-h-[44px]"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

          {/* ================= TAB: RUANG PENGAWASAN & VERIFIKASI ABSENSI ================= */}
          {activeTab === 'pengawasan' && (
            <div className="space-y-4 sm:space-y-5 animate-fade-in-up">
              {/* If no assigned proctor rooms */}
              {(!dataTugasPengawas || dataTugasPengawas.length === 0) ? (
                <EmptyState
                  icon="badge"
                  title="Tidak Ada Tugas Pengawasan"
                  description="Anda saat ini belum memiliki penugasan sebagai pengawas ruang ujian. Hubungi administrator sekolah untuk penugasan pengawas."
                />
              ) : (
                <>
                  {/* Multi-Room Switcher Pills (if assigned to multiple rooms) */}
                  {dataTugasPengawas.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                        Pilih Ruangan:
                      </span>
                      {dataTugasPengawas.map((tugas, idx) => {
                        const isSelected = selectedPengawasRuang?.id_penugasan === tugas.id_penugasan;
                        return (
                          <button
                            key={tugas.id_penugasan || idx}
                            type="button"
                            onClick={() => setSelectedPengawasRuang(tugas)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 min-h-[40px] ${
                              isSelected
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:border-primary/50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                            <span>{tugas.ruang?.nama_ruang || tugas.nama_ruang || `Ruang ${idx + 1}`}</span>
                            <span className="opacity-70 text-[10px]">
                              • {tugas.jadwal?.mata_pelajaran?.nama_mapel || tugas.jadwal?.nama_mapel || 'Ujian'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedPengawasRuang && (
                    <>
                      {/* Header HUD */}
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-2xl">meeting_room</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                                  {selectedPengawasRuang.ruang?.nama_ruang || selectedPengawasRuang.nama_ruang || 'Ruang Ujian'}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  {selectedPengawasRuang.peran || 'Pengawas Ruang'}
                                </span>
                                {selectedPengawasRuang.ruang?.kapasitas && (
                                  <span className="text-[11px] text-slate-400">
                                    (Kapasitas: {selectedPengawasRuang.ruang.kapasitas} Siswa)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                  {selectedPengawasRuang.jadwal?.mata_pelajaran?.nama_mapel || selectedPengawasRuang.jadwal?.nama_mapel || 'Ujian CBT'}
                                </span>
                                {' '}• Target: <span className="font-semibold">{selectedPengawasRuang.jadwal?.target_kelas || 'Semua Kelas'}</span>
                                {' '}• Pengawas: <span className="font-semibold">{user.nama_lengkap || user.username}</span>
                                {user.nip ? ` (NIP: ${user.nip})` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Token Badge */}
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Token:</span>
                              <span className="font-mono font-black text-sm text-primary dark:text-primary-400 tracking-widest">
                                {selectedPengawasRuang.jadwal?.token_aktif || selectedPengawasRuang.jadwal?.token || '-'}
                              </span>
                            </div>

                            {/* Refresh Button */}
                            <button
                              type="button"
                              onClick={() => fetchPesertaRuangPengawas(selectedPengawasRuang)}
                              disabled={loadingPengawas}
                              title="Muat ulang absensi"
                              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <span className={`material-symbols-outlined text-[20px] ${loadingPengawas ? 'animate-spin' : ''}`}>
                                refresh
                              </span>
                            </button>

                            {/* Cetak Dokumen Ujian Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenPrintDocument(selectedPengawasRuang)}
                              disabled={loadingPrint}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-xs transition-all active:scale-[0.98] min-h-[40px]"
                            >
                              {loadingPrint ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <span className="material-symbols-outlined text-[18px]">print</span>
                              )}
                              <span>Cetak Dokumen Ujian</span>
                            </button>

                            {/* Bulk Approval Button */}
                            <button
                              type="button"
                              onClick={handleBulkApprove}
                              disabled={isVerifying || kpiPengawas.menungguVerifikasi === 0}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
                            >
                              {isVerifying ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <span className="material-symbols-outlined text-[18px]">done_all</span>
                              )}
                              <span>Verifikasi Semua Kehadiran</span>
                              {kpiPengawas.menungguVerifikasi > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white text-emerald-700">
                                  {kpiPengawas.menungguVerifikasi}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 4 KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          {/* Total Terdaftar */}
                          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            <div className="flex items-center justify-between text-slate-400 mb-1">
                              <span className="text-[11px] font-bold">Total Terdaftar</span>
                              <span className="material-symbols-outlined text-lg text-primary">group</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                              {kpiPengawas.totalTerdaftar}
                            </p>
                            <span className="text-[10px] text-slate-400">Siswa di ruangan</span>
                          </div>

                          {/* Hadir (Terverifikasi) */}
                          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 sm:p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                              <span className="text-[11px] font-bold">Hadir (Terverifikasi)</span>
                              <span className="material-symbols-outlined text-lg">verified</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-tight">
                              {kpiPengawas.hadirTerverifikasi}
                            </p>
                            <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Kehadiran disetujui</span>
                          </div>

                          {/* Menunggu Verifikasi */}
                          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 sm:p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                              <span className="text-[11px] font-bold">Menunggu Verifikasi</span>
                              <span className="material-symbols-outlined text-lg animate-pulse">hourglass_top</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 leading-tight">
                              {kpiPengawas.menungguVerifikasi}
                            </p>
                            <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70">Perlu persetujuan tanda tangan</span>
                          </div>

                          {/* Belum Hadir */}
                          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            <div className="flex items-center justify-between text-slate-400 mb-1">
                              <span className="text-[11px] font-bold">Belum Hadir</span>
                              <span className="material-symbols-outlined text-lg">person_off</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-300 leading-tight">
                              {kpiPengawas.belumHadir}
                            </p>
                            <span className="text-[10px] text-slate-400">Belum masuk ujian / absen</span>
                          </div>
                        </div>
                      </div>

                      {/* Student Roster Table Card */}
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Search Input */}
                          <div className="relative flex-1 max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                              search
                            </span>
                            <input
                              type="text"
                              value={searchPengawas}
                              onChange={(e) => setSearchPengawas(e.target.value)}
                              placeholder="Cari siswa berdasarkan nama atau NISN..."
                              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                          </div>

                          {/* Filter Status Pills */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                            {[
                              { id: 'ALL', label: 'Semua', count: pesertaPengawas.length },
                              { id: 'MENUNGGU', label: 'Menunggu', count: kpiPengawas.menungguVerifikasi },
                              { id: 'DISETUJUI', label: 'Terverifikasi', count: kpiPengawas.hadirTerverifikasi },
                              { id: 'BELUM', label: 'Belum Hadir', count: kpiPengawas.belumHadir }
                            ].map(f => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilterStatusPengawas(f.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 min-h-[36px] ${
                                  filterStatusPengawas === f.id
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                <span>{f.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                  filterStatusPengawas === f.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                                }`}>
                                  {f.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Desktop Table (> 768px) */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                <th className="py-3 px-3 w-10 text-center">No</th>
                                <th className="py-3 px-3">Identitas Siswa</th>
                                <th className="py-3 px-3">Kelas</th>
                                <th className="py-3 px-3">Status Ujian</th>
                                <th className="py-3 px-3 text-center">Tanda Tangan Canvas</th>
                                <th className="py-3 px-3 text-center">Status Kehadiran</th>
                                <th className="py-3 px-3 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                              {loadingPengawas && pesertaPengawas.length === 0 ? (
                                <tr>
                                  <td colSpan="7" className="py-8 text-center text-slate-400">
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                      <span>Memuat daftar siswa ruang ujian...</span>
                                    </div>
                                  </td>
                                </tr>
                              ) : filteredPesertaPengawas.length === 0 ? (
                                <tr>
                                  <td colSpan="7" className="py-8 text-center text-slate-400">
                                    <span className="material-symbols-outlined text-3xl block mb-1 text-slate-300">search_off</span>
                                    <p className="font-semibold text-xs">Tidak ada data siswa yang sesuai filter atau pencarian</p>
                                  </td>
                                </tr>
                              ) : (
                                filteredPesertaPengawas.map((p, idx) => {
                                  const avatar = p.foto_profil || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nisn || p.nama_lengkap || idx}`;
                                  const isDisetujui = p.status_verifikasi === 'DISETUJUI' || p.status_verifikasi === 'TERVERIFIKASI';
                                  const isMenunggu = p.status_verifikasi === 'MENUNGGU';
                                  const isDitolak = p.status_verifikasi === 'DITOLAK';

                                  return (
                                    <tr key={p.id_siswa || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                      <td className="py-3 px-3 text-center font-bold text-slate-400">
                                        {idx + 1}
                                      </td>
                                      <td className="py-3 px-3">
                                        <div className="flex items-center gap-2.5">
                                          <img src={avatar} alt={p.nama_lengkap} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 object-cover shrink-0" />
                                          <div className="min-w-0">
                                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                              {p.nama_lengkap}
                                            </p>
                                            <p className="text-[11px] font-mono text-slate-400">
                                              NISN: {p.nisn}
                                            </p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                                        {p.kelas}
                                      </td>
                                      <td className="py-3 px-3">
                                        <StatusBadge status={p.status_ujian || 'BELUM KERJA'} size="xs" />
                                      </td>
                                      <td className="py-3 px-3 text-center">
                                        {p.tanda_tangan ? (
                                          <button
                                            type="button"
                                            onClick={() => setInspectStudentSignature(p)}
                                            title="Klik untuk memperbesar tanda tangan"
                                            className="group relative inline-flex items-center justify-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs hover:border-primary transition-all"
                                          >
                                            <img
                                              src={p.tanda_tangan}
                                              alt={`TTD ${p.nama_lengkap}`}
                                              className="h-7 max-w-[75px] object-contain"
                                            />
                                            <span className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                                              <span className="material-symbols-outlined text-xs text-primary">zoom_in</span>
                                            </span>
                                          </button>
                                        ) : (
                                          <span className="text-[11px] text-slate-400 italic">Belum Ada</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-center">
                                        {isDisetujui ? (
                                          <StatusBadge variant="success" label="DISETUJUI" size="xs" />
                                        ) : isMenunggu ? (
                                          <StatusBadge variant="warning" label="MENUNGGU" size="xs" pulse={true} />
                                        ) : isDitolak ? (
                                          <StatusBadge variant="danger" label="DITOLAK" size="xs" />
                                        ) : (
                                          <StatusBadge variant="neutral" label="BELUM HADIR" size="xs" />
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          {/* Tombol Lihat Signature Modal */}
                                          <button
                                            type="button"
                                            onClick={() => setInspectStudentSignature(p)}
                                            title="Lihat tanda tangan dan detail siswa"
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center gap-1"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                            <span>Lihat</span>
                                          </button>

                                          {/* Reset Sesi Siswa Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleResetSession(p, selectedPengawasRuang?.id_jadwal)}
                                            title="Reset sesi ujian siswa"
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 transition-colors inline-flex items-center gap-1 min-h-[32px]"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                            <span>Reset</span>
                                          </button>

                                          {/* Single Approval Action Button */}
                                          {isMenunggu && p.id_absensi && (
                                            <button
                                              type="button"
                                              onClick={() => handleSingleApprove(p)}
                                              disabled={isVerifying}
                                              title="Setujui kehadiran siswa ini"
                                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-2xs transition-all inline-flex items-center gap-1"
                                            >
                                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                              <span>Setujui</span>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Student Cards (md:hidden - 375px optimized) */}
                        <div className="md:hidden space-y-3">
                          {loadingPengawas && pesertaPengawas.length === 0 ? (
                            <div className="p-6 text-center text-slate-400">
                              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block mr-2"></span>
                              <span className="text-xs">Memuat siswa...</span>
                            </div>
                          ) : filteredPesertaPengawas.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                              <p className="text-xs font-semibold">Tidak ada siswa yang sesuai pencarian</p>
                            </div>
                          ) : (
                            filteredPesertaPengawas.map((p, idx) => {
                              const avatar = p.foto_profil || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nisn || p.nama_lengkap || idx}`;
                              const isDisetujui = p.status_verifikasi === 'DISETUJUI' || p.status_verifikasi === 'TERVERIFIKASI';
                              const isMenunggu = p.status_verifikasi === 'MENUNGGU';
                              const isDitolak = p.status_verifikasi === 'DITOLAK';

                              return (
                                <div
                                  key={p.id_siswa || idx}
                                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-xs space-y-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <img src={avatar} alt={p.nama_lengkap} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 object-cover shrink-0" />
                                      <div className="min-w-0">
                                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                          {p.nama_lengkap}
                                        </h5>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                          NISN: {p.nisn} • {p.kelas}
                                        </p>
                                      </div>
                                    </div>
                                    {isDisetujui ? (
                                      <StatusBadge variant="success" label="DISETUJUI" size="xs" />
                                    ) : isMenunggu ? (
                                      <StatusBadge variant="warning" label="MENUNGGU" size="xs" pulse={true} />
                                    ) : isDitolak ? (
                                      <StatusBadge variant="danger" label="DITOLAK" size="xs" />
                                    ) : (
                                      <StatusBadge variant="neutral" label="BELUM HADIR" size="xs" />
                                    )}
                                  </div>

                                  {/* Signature Preview & Actions */}
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-slate-400">TTD:</span>
                                      {p.tanda_tangan ? (
                                        <button
                                          type="button"
                                          onClick={() => setInspectStudentSignature(p)}
                                          className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs hover:border-primary inline-flex items-center gap-1"
                                        >
                                          <img src={p.tanda_tangan} alt="TTD" className="h-6 max-w-[60px] object-contain" />
                                          <span className="material-symbols-outlined text-xs text-slate-400">zoom_in</span>
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">Belum Ada</span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setInspectStudentSignature(p)}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                                        <span>Lihat</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleResetSession(p, selectedPengawasRuang?.id_jadwal)}
                                        title="Reset sesi ujian siswa"
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-1"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                                        <span>Reset</span>
                                      </button>
                                      {isMenunggu && p.id_absensi && (
                                        <button
                                          type="button"
                                          onClick={() => handleSingleApprove(p)}
                                          disabled={isVerifying}
                                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-2xs"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">check</span>
                                          <span>Setujui</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* =========================================================
                          FORMULIR BERITA ACARA & DOKUMENTASI UJIAN (MILESTONE 2 - R2)
                          ========================================================= */}
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-4 sm:p-6 space-y-5">
                        {/* Section Header with Metadata Banner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/80 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-2xl">history_edu</span>
                            </div>
                            <div>
                              <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                Formulir Berita Acara & Dokumentasi Ujian
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Cukup diisi oleh salah satu pengawas ruang yang bertugas. Data tersinkronisasi otomatis.
                              </p>
                            </div>
                          </div>

                          {/* Quick Print Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenPrintDocument(selectedPengawasRuang)}
                            disabled={loadingPrint}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-xs transition-all min-h-[40px] shrink-0"
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                            <span>Pratinjau Dokumen Cetak</span>
                          </button>
                        </div>

                        {/* Explicit Class & Subject Metadata Badge Banner */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 text-xs">
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mata Pelajaran:</span>
                            <span className="font-black text-slate-800 dark:text-white text-sm">
                              {selectedPengawasRuang.jadwal?.mata_pelajaran?.nama_mapel || selectedPengawasRuang.jadwal?.nama_mapel || 'Ujian CBT'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tingkat / Target Kelas:</span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {selectedPengawasRuang.jadwal?.target_kelas || 'Semua Kelas'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ruangan Ujian:</span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {selectedPengawasRuang.ruang?.nama_ruang || selectedPengawasRuang.nama_ruang || 'Ruang Ujian'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Pengawas Pelapor:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {user.nama_lengkap || user.username}
                            </span>
                          </div>
                        </div>

                        {/* Attendance Count Overview */}
                        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-blue-600">group</span>
                            <span>Total Terdaftar: <strong className="font-black">{pesertaPengawas.length}</strong> Siswa</span>
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                            <span>Hadir: <strong className="font-black">{kpiPengawas.hadirTerverifikasi + kpiPengawas.menungguVerifikasi}</strong> Siswa</span>
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                            <span className="material-symbols-outlined text-[18px]">person_off</span>
                            <span>Tidak Hadir: <strong className="font-black">{kpiPengawas.belumHadir}</strong> Siswa</span>
                          </span>
                        </div>

                        {/* Catatan Pelaksanaan Ujian */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Catatan Pelaksanaan Ujian / Insiden Khusus:
                          </label>
                          <textarea
                            value={catatanPelaksanaan}
                            onChange={(e) => setCatatanPelaksanaan(e.target.value)}
                            rows={3}
                            placeholder="Tuliskan catatan pelaksanaan ujian di ruang ini (kondisi ketertiban, siswa izin keluar, kendala koneksi, pemadaman listrik, atau catatan khusus lainnya)..."
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all leading-relaxed"
                          />
                        </div>

                        {/* Live Camera & Watermark Documentation */}
                        <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-lg">photo_camera</span>
                                <span>Dokumentasi Live Camera Ber-Watermark</span>
                              </h5>
                              <p className="text-[11px] text-slate-500">
                                Mengambil foto situasi ruangan dengan watermark tanggal, waktu, ruangan, mapel, dan nama pengawas.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {!isCameraActive ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={startCamera}
                                    disabled={cameraLoading}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-xs transition-all min-h-[38px]"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">videocam</span>
                                    <span>Buka Kamera Live</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cameraInputFileRef.current && cameraInputFileRef.current.click()}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all min-h-[38px]"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">upload</span>
                                    <span>Pilih / Jepret File</span>
                                  </button>
                                  <input
                                    ref={cameraInputFileRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFallbackPhotoSelect}
                                    className="hidden"
                                  />
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={captureLivePhoto}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all min-h-[38px]"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">camera</span>
                                    <span>Ambil Foto Ber-Watermark</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={switchCameraFacing}
                                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 min-h-[38px]"
                                    title="Ganti kamera depan / belakang"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">flip_camera_ios</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={stopCamera}
                                    className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 min-h-[38px]"
                                    title="Tutup kamera"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Live Video Preview Stream */}
                          {isCameraActive && (
                            <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-primary shadow-lg max-w-xl mx-auto">
                              <video
                                ref={videoRef}
                                playsInline
                                autoPlay
                                muted
                                className="w-full h-auto max-h-[320px] object-cover mx-auto"
                              />
                              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-white"></span>
                                <span>Kamera Live Aktif</span>
                              </div>
                            </div>
                          )}

                          {/* Captured Watermarked Photo Preview */}
                          {fotoDokumentasi && (
                            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
                                  <span>Foto Dokumentasi Terpilih (Ber-Watermark):</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFotoDokumentasi('');
                                    setDriveUrl('');
                                  }}
                                  className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                  <span>Hapus Foto</span>
                                </button>
                              </div>

                              <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-900 max-w-lg mx-auto shadow-sm">
                                <img
                                  src={fotoDokumentasi}
                                  alt="Dokumentasi Pelaksanaan Ujian"
                                  className="w-full h-auto max-h-[260px] object-contain mx-auto"
                                />
                              </div>

                              {/* Google Drive Status & GAS Webhook Settings */}
                              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-600 text-[18px]">cloud_upload</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      Arsip Google Drive:
                                    </span>
                                  </div>
                                  {driveUrl ? (
                                    <a
                                      href={driveUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary font-bold hover:underline truncate max-w-xs flex items-center gap-1"
                                    >
                                      <span>Buka di Google Drive</span>
                                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">
                                      {isUploadingDrive ? 'Mengunggah ke Drive...' : 'Tersimpan lokal (data URL), siap disinkron'}
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-2 items-center pt-1">
                                  <input
                                    type="url"
                                    value={gasWebhookUrl}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setGasWebhookUrl(val);
                                      if (typeof window !== 'undefined') {
                                        try {
                                          window.localStorage.setItem('nexa_gas_drive_webhook', val.trim());
                                        } catch (_) {}
                                      }
                                    }}
                                    placeholder="URL Webhook Google Apps Script (Opsional)"
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => syncToGoogleDrive(fotoDokumentasi)}
                                    disabled={!(gasWebhookUrl || '').trim() || isUploadingDrive}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors shrink-0"
                                  >
                                    {isUploadingDrive ? 'Mengunggah...' : 'Unggah ke Drive'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tanda Tangan Digital Pengawas Ruang */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              Tanda Tangan Pengawas Ruang (Mewakili):
                            </label>
                            {(hasProctorSigned || existingSignature) && (
                              <button
                                type="button"
                                onClick={clearSigCanvas}
                                className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                                <span>Bersihkan Kanvas Tanda Tangan</span>
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="w-full max-w-sm">
                              <canvas
                                ref={sigCanvasRef}
                                width={380}
                                height={140}
                                onMouseDown={startSigDrawing}
                                onMouseMove={drawSig}
                                onMouseUp={stopSigDrawing}
                                onMouseLeave={stopSigDrawing}
                                onTouchStart={startSigDrawing}
                                onTouchMove={drawSig}
                                onTouchEnd={stopSigDrawing}
                                className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-crosshair touch-none shadow-2xs"
                              />
                              <p className="text-[10px] text-slate-400 mt-1 text-center">
                                Goreskan tanda tangan digital Anda di dalam area kanvas di atas
                              </p>
                            </div>

                            {existingSignature && !hasProctorSigned && (
                              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-center space-y-1.5">
                                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
                                  Tanda Tangan Tersimpan Sebelumnya:
                                </span>
                                <img
                                  src={existingSignature}
                                  alt="TTD Sebelumnya"
                                  className="h-14 max-h-16 mx-auto object-contain bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700"
                                />
                                <span className="text-[10px] text-slate-500 block">
                                  (Dapat digores ulang di kanvas jika ingin memperbarui)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submit Action Bar */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-xs text-slate-500">
                            Pengawas: <strong className="text-slate-800 dark:text-white">{user.nama_lengkap || user.username}</strong>
                            {user.nip ? ` • NIP: ${user.nip}` : ''}
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSaveBeritaAcara}
                              disabled={isSavingBeritaAcara}
                              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                            >
                              {isSavingBeritaAcara ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <span className="material-symbols-outlined text-[18px]">save</span>
                              )}
                              <span>Simpan Berita Acara & Catatan</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
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
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                              SELESAI
                            </span>
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
                            onClick={() => handleOpenPrintDocumentForJadwal(j)}
                            className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1 min-h-[44px]"
                            title="Cetak Dokumen Pengawasan Ujian"
                          >
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            <span className="hidden sm:inline">Dokumen</span>
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

          {/* ================= TAB 7: LOG AKTIVITAS ================= */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">Log Aktivitas & Audit Trail</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Catatan jejak aktivitas pengajaran, manajemen soal, dan pengawasan ujian</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveLogSubTab('aktif')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors min-h-[38px] ${
                        activeLogSubTab === 'aktif' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Log Aktif ({dataAudit.length})
                    </button>
                    <button
                      onClick={() => setActiveLogSubTab('arsip')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors min-h-[38px] ${
                        activeLogSubTab === 'arsip' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Arsip ({dataAuditArchive.length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4 w-36">Waktu</th>
                        <th className="py-3 px-4 w-36">Aksi</th>
                        <th className="py-3 px-4">Deskripsi Aktivitas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {(activeLogSubTab === 'aktif' ? dataAudit : dataAuditArchive).map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-slate-400 text-xs">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-xs">
                            {new Date(log.created_at || log.waktu).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {log.target || log.details || '-'}
                          </td>
                        </tr>
                      ))}
                      {(activeLogSubTab === 'aktif' ? dataAudit : dataAuditArchive).length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8">
                            <EmptyState
                              compact={true}
                              icon="history"
                              title="Belum Ada Log"
                              description="Belum ada aktivitas tercatat pada kategori ini."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
                                {Number(s.nilai_uraian) || 0}
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
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 inline-flex items-center gap-1 transition-colors min-h-[36px]"
                                  title="Periksa Jawaban Uraian Siswa"
                                >
                                  <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                  <span>Periksa</span>
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
      <ModalPeriksaUraian
        isOpen={modalUraian.isOpen}
        logUjian={modalUraian.logUjian}
        jawabanUraian={modalUraian.jawabanUraian}
        onClose={() => setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] })}
        onSave={saveNilaiUraian}
      />

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

      {/* Modal Pratinjau Tanda Tangan Canvas (Requirement 3) */}
      <ModalPratinjauTandaTangan
        isOpen={Boolean(inspectStudentSignature)}
        student={inspectStudentSignature}
        onClose={() => setInspectStudentSignature(null)}
        onApprove={handleSingleApprove}
        onReject={handleSingleReject}
        isSubmitting={isVerifying}
      />


      {/* Cetak Dokumen Ujian Print Modal (Requirement 4 Integration) */}
      {printModalOpen && printData && (
        <DokumenUjianPrint
          data={printData}
          onClose={() => {
            setPrintModalOpen(false);
            setPrintData(null);
          }}
          pengawasNama={user.nama_lengkap || user.username}
          pengawasNip={user.nip || ''}
        />
      )}

      {/* Tutorial & Panduan Alur Modal (Milestone 3 - R7) */}
      <TutorialModal
        isOpen={showTutorialModal}
        initialRole="guru"
        onClose={handleCloseTutorial}
      />

    </div>
  );
};

export default GuruView;
