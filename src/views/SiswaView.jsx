import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ExamRoom from './ExamRoom.jsx';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  StatusBadge,
  EmptyState,
  CardSkeleton,
  safeJSONParse,
} from '../components/UI.jsx';

/**
 * Calm countdown component: formatted time without aggressive flashing
 */
const Countdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) return 'Dimulai...';
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      // Urgent only if less than 15 minutes
      setIsUrgent(diff < 15 * 60 * 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days} hari lagi`;
      }
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    setTimeLeft(calc());
    const interval = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <span className={`font-mono text-xs font-semibold ${isUrgent ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`}>
      {timeLeft}
    </span>
  );
};

/**
 * Progress chart with responsive bars and safe overflow clamping
 */
const ProgressChart = ({ data }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.total_nilai)) || 100;
  const recentData = data.slice(0, 8).reverse();

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="pb-3">
        <div>
          <CardTitle>Grafik Perkembangan Nilai</CardTitle>
          <CardDescription>Tren performa dari {recentData.length} ujian terakhir</CardDescription>
        </div>
        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60">
          Tertinggi: {max}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-end gap-2 sm:gap-4 h-32 pt-6">
          {recentData.map((d, i) => {
            const heightPct = Math.max(8, (d.total_nilai / max) * 100);
            return (
              <div key={i} className="flex flex-col items-center flex-1 group relative h-full justify-end cursor-pointer">
                {/* Tooltip */}
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md font-bold z-20 whitespace-nowrap pointer-events-none shadow-md">
                  {d.nama_mapel}: <span className="text-emerald-400">{d.total_nilai}</span>
                </div>
                {/* Bar */}
                <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-700/60 rounded-t-lg relative flex items-end overflow-hidden" style={{ height: `${heightPct}%` }}>
                  <div className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg transition-all group-hover:brightness-110" style={{ height: '100%' }}></div>
                </div>
                {/* Label */}
                <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-2 truncate w-full text-center font-medium" title={d.nama_mapel}>
                  {d.nama_mapel.substring(0, 3).toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const SiswaView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
  const currentUserId = user?.id_user || user?.id_siswa;

  const api = (action, p = {}) => {
    if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
    return fetchAPI(action, { ...p, npsn: user.npsn });
  };

  const [jadwal, setJadwal] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeExamData, setActiveExamData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('nexa_active_exam');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Token Modal state (replaces awkward inline card token box)
  const [tokenModalJadwal, setTokenModalJadwal] = useState(null);
  const [inputToken, setInputToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);

  const [activeTab, setActiveTab] = useState('beranda');
  const [jadwalFilter, setJadwalFilter] = useState('HARI INI');
  const [dataPengumuman, setDataPengumuman] = useState([]);
  const [dataRiwayat, setDataRiwayat] = useState([]);
  const [dataLeaderboard, setDataLeaderboard] = useState([]);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [detailNilaiModal, setDetailNilaiModal] = useState(null);

  const PRESET_AVATARS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=George&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo&backgroundColor=d1d4f9",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia&backgroundColor=f6e3d4"
  ];

  useEffect(() => {
    loadPengumuman();
    loadRiwayat();
    loadJadwal();
    loadLeaderboard();
  }, []);

  // Heartbeat session sync
  useEffect(() => {
    const interval = setInterval(async () => {
      if (user && user.session_token) {
        const res = await api('heartbeat_siswa', { id_siswa: currentUserId, session_token: user.session_token });
        if (res.status === 'error') {
          onLogout();
          showMessage('Sesi Berakhir', 'Sesi Anda telah digantikan oleh login di perangkat lain atau waktu telah habis.', 'error');
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, currentUserId]);

  const loadPengumuman = async () => {
    const res = await api('get_pengumuman', { role: 'siswa' });
    if (res.status === 'success') {
      setDataPengumuman(res.data || []);
    }
  };

  const loadRiwayat = async () => {
    const res = await api('get_riwayat_ujian_siswa', { id_siswa: currentUserId });
    if (res.status === 'success') setDataRiwayat(res.data || []);
  };

  const loadLeaderboard = async () => {
    const res = await api('get_leaderboard', {});
    if (res.status === 'success') setDataLeaderboard(res.data || []);
  };

  const loadJadwal = async () => {
    setIsLoading(true);
    const res = await api('get_jadwal', { id_siswa: currentUserId });
    if (res.status === 'success') setJadwal(res.data || []);
    setIsLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pw = fd.get('password');
    if (!pw) return showMessage('Info', 'Password tidak diubah', 'info');

    setIsLoading(true);
    const res = await api('update_profil_siswa', { id_siswa: currentUserId, password: pw });
    setIsLoading(false);
    if (res.status === 'success') {
      showMessage('Sukses', res.message, 'success');
      setProfileModalOpen(false);
    } else {
      showMessage('Gagal', res.message, 'error');
    }
  };

  const handleAvatarSelect = async (url) => {
    setIsLoading(true);
    const res = await api('update_profil_siswa', { id_siswa: currentUserId, foto_profil: url });
    setIsLoading(false);
    if (res.status === 'success') {
      user.foto_profil = url;
      showMessage('Sukses', 'Foto profil berhasil diperbarui', 'success');
      setIsAvatarModalOpen(false);
    } else {
      showMessage('Gagal', res.message, 'error');
    }
  };

  const handleOpenTokenModal = (j) => {
    if (j.is_blocked && j.status_siswa !== 'SELESAI') {
      showMessage('Akses Terblokir', 'Akun Anda telah diblokir dari ujian ini karena terindikasi melakukan pelanggaran. Silakan hubungi Guru Pengawas atau Admin Sekolah.', 'error');
      return;
    }
    setTokenModalJadwal(j);
    setInputToken('');
    setTokenError('');
  };

  const handleMulaiUjianSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!inputToken || inputToken.trim().length < 6) {
      setTokenError('Masukkan 6 karakter token yang diberikan pengawas.');
      return;
    }

    setIsVerifyingToken(true);
    setTokenError('');

    const res = await api('mulai_ujian', {
      id_jadwal: tokenModalJadwal.id_jadwal,
      id_siswa: currentUserId,
      token: inputToken.trim().toUpperCase()
    });

    setIsVerifyingToken(false);

    if (res.status === 'success') {
      const selected = tokenModalJadwal;
      const examData = {
        jadwal: selected,
        idLog: res.id_log,
        dataLog: res.dataLog || { id_log: res.id_log, pelanggaran: res.pelanggaran || 0, is_blocked: res.is_blocked || false }
      };
      try {
        sessionStorage.setItem('nexa_active_exam', JSON.stringify(examData));
      } catch (err) {}
      setTokenModalJadwal(null);
      setInputToken('');
      setActiveExamData(examData);
    } else {
      setTokenError(res.message || 'Token ujian tidak valid atau sudah kedaluwarsa.');
    }
  };

  // Filtered schedules for tabs
  const todaySchedules = useMemo(() => {
    const today = new Date().toDateString();
    return jadwal.filter(j => new Date(j.waktu_mulai).toDateString() === today || j.status_siswa === 'SEDANG KERJA');
  }, [jadwal]);

  const filteredJadwalList = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    return jadwal.filter(j => {
      const mulai = new Date(j.waktu_mulai);
      if (jadwalFilter === 'HARI INI') return mulai.toDateString() === today;
      if (jadwalFilter === 'AKAN DATANG') return mulai > now && mulai.toDateString() !== today;
      if (jadwalFilter === 'SELESAI') return j.status_siswa === 'SELESAI' || new Date(j.waktu_selesai) < now;
      return true;
    });
  }, [jadwal, jadwalFilter]);

  // Render individual exam schedule card using UI primitives
  const renderJadwalCard = (j) => {
    const now = new Date();
    const mulai = new Date(j.waktu_mulai);
    const selesai = new Date(j.waktu_selesai);
    const isBelumMulai = mulai > now;
    const isSelesai = j.status_siswa === 'SELESAI' || selesai < now;
    const isSedangKerja = j.status_siswa === 'SEDANG KERJA';
    const isBlocked = j.is_blocked && j.status_siswa !== 'SELESAI';

    // Find score if completed
    const matchingRiwayat = dataRiwayat.find(r => r.id_log && (r.nama_mapel === j.nama_mapel || r.id_jadwal === j.id_jadwal));

    let statusType = 'AKTIF';
    let statusLabel = 'Aktif';
    if (isBlocked) {
      statusType = 'TERBLOKIR';
      statusLabel = 'Terblokir';
    } else if (isSelesai) {
      statusType = 'SELESAI';
      statusLabel = 'Selesai';
    } else if (isSedangKerja) {
      statusType = 'SEDANG KERJA';
      statusLabel = 'Sedang Kerja';
    } else if (isBelumMulai) {
      statusType = 'BELUM MULAI';
      statusLabel = 'Belum Mulai';
    }

    return (
      <Card key={j.id_jadwal} className="flex flex-col justify-between hover:shadow-md transition-all hover:border-emerald-500/30">
        <CardHeader className="pb-3 flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/50">
              <span className="material-symbols-outlined text-2xl">menu_book</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-800 dark:text-white text-base truncate" title={j.nama_mapel}>
                {j.nama_mapel}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {j.nama_guru || user.nama_sekolah || 'Pengawas Ujian'}
              </p>
            </div>
          </div>
          <StatusBadge status={statusType} label={statusLabel} size="xs" />
        </CardHeader>

        <CardContent className="py-2 space-y-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
            <span>{new Date(j.waktu_mulai).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
              <span className="font-mono">
                {new Date(j.waktu_mulai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(j.waktu_selesai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {isBelumMulai && <Countdown targetDate={j.waktu_mulai} />}
          </div>

          {isSelesai && matchingRiwayat && (
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 dark:text-slate-400">Nilai Akhir:</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60">
                {matchingRiwayat.total_nilai}
              </span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3">
          {isBlocked ? (
            <Button
              variant="danger"
              size="md"
              className="w-full min-h-[44px]"
              icon="lock"
              onClick={() => showMessage('Akses Terblokir', 'Akun Anda diblokir dari ujian ini karena terindikasi pelanggaran. Hubungi guru/proctor untuk unblock.', 'error')}
            >
              Terblokir
            </Button>
          ) : isSelesai ? (
            <Button
              variant="secondary"
              size="md"
              className="w-full min-h-[44px]"
              icon="visibility"
              onClick={() => matchingRiwayat ? setDetailNilaiModal(matchingRiwayat) : showMessage('Hasil Ujian', 'Ujian telah selesai.', 'info')}
            >
              Lihat Hasil
            </Button>
          ) : isSedangKerja ? (
            <Button
              variant="warning"
              size="md"
              className="w-full min-h-[44px]"
              icon="play_arrow"
              onClick={() => handleOpenTokenModal(j)}
            >
              Lanjutkan Ujian
            </Button>
          ) : isBelumMulai ? (
            <Button
              variant="secondary"
              size="md"
              disabled
              className="w-full min-h-[44px]"
              icon="timer"
            >
              Belum Dimulai
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              className="w-full min-h-[44px]"
              icon="login"
              onClick={() => handleOpenTokenModal(j)}
            >
              Mulai Ujian
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  // Active exam view (Delegates directly to ExamRoom with contract intact)
  if (activeExamData) {
    return (
      <ExamRoom
        user={user}
        jadwal={activeExamData.jadwal}
        idLog={activeExamData.idLog}
        dataLog={activeExamData.dataLog}
        showMessage={showMessage}
        onFinish={() => {
          try {
            sessionStorage.removeItem('nexa_active_exam');
          } catch (err) {}
          setActiveExamData(null);
          setTokenModalJadwal(null);
          setInputToken('');
          loadJadwal();
          loadRiwayat();
          loadLeaderboard();
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-700">
      
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP TOP NAVIGATION BAR (md: and above)                    */}
      {/* ------------------------------------------------------------- */}
      <header className="hidden md:block flex-shrink-0 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* School / NEXA Branding */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-base text-slate-800 dark:text-white leading-tight truncate">
                  {user.nama_sekolah || 'NEXA CBT'}
                </h1>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                  Portal Ujian Siswa
                </p>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="flex items-center gap-1">
              {[
                { id: 'beranda', label: 'Beranda', icon: 'home' },
                { id: 'jadwal', label: 'Jadwal Ujian', icon: 'event_note', badge: todaySchedules.length > 0 ? todaySchedules.length : null },
                { id: 'nilai', label: 'Riwayat Nilai', icon: 'military_tech' },
                { id: 'leaderboard', label: 'Papan Peringkat', icon: 'social_leaderboard' },
                { id: 'akun', label: 'Profil Saya', icon: 'person' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* User Profile Summary & Utilities */}
            <div className="flex items-center gap-2">
              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Ganti Mode Gelap/Terang"
                aria-label="Toggle Dark Mode"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isDarkMode ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              {/* User Avatar & Name */}
              <div
                onClick={() => setIsAvatarModalOpen(true)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  {user.foto_profil ? (
                    <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-lg">person</span>
                  )}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-slate-800 dark:text-white leading-tight max-w-[130px] truncate">
                    {user.nama_lengkap}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {user.nisn || currentUserId}
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={onLogout}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Keluar Aplikasi"
                aria-label="Keluar Aplikasi"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE HEADER BANNER (md:hidden)                              */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden flex-shrink-0 z-30 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 pt-6 pb-6 shadow-md">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => setIsAvatarModalOpen(true)}
              className="w-13 h-13 rounded-2xl bg-white/20 border-2 border-white/50 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer shadow-sm active:scale-95 transition-transform"
            >
              {user.foto_profil ? (
                <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover bg-white" />
              ) : (
                <span className="material-symbols-outlined text-white text-3xl">person</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight truncate">
                {user.nama_sekolah || 'NEXA CBT'}
              </h2>
              <p className="text-sm font-semibold opacity-95 truncate">
                {user.nama_lengkap}
              </p>
              <p className="text-xs opacity-80 font-mono">
                NISN: {user.nisn || currentUserId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-all shadow-sm min-w-[44px] min-h-[44px]"
              title="Ganti Mode Gelap/Terang"
              aria-label="Toggle Dark Mode"
            >
              <span className="material-symbols-outlined text-xl">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-all shadow-sm min-w-[44px] min-h-[44px]"
              title="Keluar"
              aria-label="Keluar"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN RESPONSIVE CONTENT AREA                                  */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-12">
        
        {/* ============================================================ */}
        {/* TAB 1: BERANDA                                               */}
        {/* ============================================================ */}
        {activeTab === 'beranda' && (
          <div className="space-y-8 animate-fade-in-up">
            
            {/* Quick KPI Stat Banner */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              <Card className="p-4 sm:p-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">event_available</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ujian Hari Ini</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{todaySchedules.length}</p>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">task_alt</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ujian Selesai</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{dataRiwayat.length}</p>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">trending_up</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Rata-Rata Nilai</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {dataRiwayat.length > 0 ? (dataRiwayat.reduce((sum, r) => sum + (r.total_nilai || 0), 0) / dataRiwayat.length).toFixed(1) : '-'}
                  </p>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">military_tech</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nilai Tertinggi</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {dataRiwayat.length > 0 ? Math.max(...dataRiwayat.map(r => r.total_nilai || 0)) : '-'}
                  </p>
                </div>
              </Card>
            </div>

            {/* Main Asymmetric Grid on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left 2 Cols: Ujian Hari Ini */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">Ujian Hari Ini</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Jadwal ujian yang berlangsung atau harus diselesaikan hari ini</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('jadwal')} rightIcon="arrow_forward">
                    Lihat Semua
                  </Button>
                </div>

                {isLoading ? (
                  <CardSkeleton count={2} variant="exam" gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-4" />
                ) : todaySchedules.length === 0 ? (
                  <EmptyState
                    icon="celebration"
                    title="Tidak Ada Ujian Hari Ini"
                    description="Semua jadwal ujian untuk hari ini sudah selesai atau belum ada ujian aktif. Selamat belajar dan istirahatlah yang cukup!"
                    actionText="Periksa Semua Jadwal"
                    onAction={() => setActiveTab('jadwal')}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {todaySchedules.map(j => renderJadwalCard(j))}
                  </div>
                )}

                {/* Progress Chart below exam cards */}
                {dataRiwayat.length >= 2 && (
                  <div className="pt-4">
                    <ProgressChart data={dataRiwayat} />
                  </div>
                )}
              </div>

              {/* Right 1 Col: Pengumuman & Top 3 Leaderboard */}
              <div className="space-y-6">
                
                {/* Pengumuman Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500">campaign</span>
                      <CardTitle>Pengumuman Sekolah</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('pengumuman')}>
                      Semua
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    {dataPengumuman.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Belum ada pengumuman baru.</p>
                    ) : (
                      dataPengumuman.slice(0, 3).map(p => (
                        <div key={p.id_pengumuman} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-1">{p.judul}</h4>
                            <span className="text-[10px] text-slate-400">
                              {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{p.isi}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Kilas Leaderboard Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500">social_leaderboard</span>
                      <CardTitle>Peringkat Teratas</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('leaderboard')}>
                      Detail
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {dataLeaderboard.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Belum ada data nilai.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {dataLeaderboard.slice(0, 3).map((lb, idx) => (
                          <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                idx === 0 ? 'bg-amber-400 text-amber-900' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-amber-600/30 text-amber-800 dark:text-amber-300'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {lb.nama}
                              </span>
                            </div>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                              {lb.rata_rata}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: SEMUA JADWAL                                          */}
        {/* ============================================================ */}
        {activeTab === 'jadwal' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Jadwal Ujian Siswa</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Daftar lengkap jadwal ujian aktif, mendatang, dan riwayat selesai</p>
              </div>

              {/* Filter Pills */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 border border-slate-200 dark:border-slate-700">
                {['HARI INI', 'AKAN DATANG', 'SELESAI'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setJadwalFilter(filter)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all min-h-[44px] ${
                      jadwalFilter === filter
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <CardSkeleton count={3} variant="exam" />
            ) : filteredJadwalList.length === 0 ? (
              <EmptyState
                icon="event_busy"
                title={`Tidak Ada Jadwal ${jadwalFilter.toLowerCase()}`}
                description={`Saat ini belum ada jadwal ujian dalam kategori ${jadwalFilter.toLowerCase()}. Silakan periksa kategori jadwal lainnya.`}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredJadwalList.map(j => renderJadwalCard(j))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: PAPAN PENGUMUMAN                                      */}
        {/* ============================================================ */}
        {activeTab === 'pengumuman' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">campaign</span>
                  <span>Papan Pengumuman Sekolah</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Informasi, edaran, dan pengumuman resmi dari pihak sekolah dan panitia ujian
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('beranda')} icon="arrow_back">
                Kembali ke Beranda
              </Button>
            </div>

            {dataPengumuman.length === 0 ? (
              <EmptyState
                icon="campaign"
                title="Tidak Ada Pengumuman"
                description="Saat ini belum ada pengumuman baru dari sekolah atau panitia ujian."
                actionText="Kembali ke Beranda"
                onAction={() => setActiveTab('beranda')}
              />
            ) : (
              <div className="space-y-4">
                {dataPengumuman.map(p => (
                  <Card key={p.id_pengumuman} className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0 border border-emerald-100 dark:border-emerald-900/50">
                        <span className="material-symbols-outlined">campaign</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate">{p.judul}</h4>
                        <p className="text-xs text-slate-400">
                          {new Date(p.created_at).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800">
                      {p.isi}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: NILAI & RIWAYAT BELAJAR                               */}
        {/* ============================================================ */}
        {activeTab === 'nilai' && (
          <div className="space-y-6 animate-fade-in-up">
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Riwayat Nilai & Hasil Ujian</h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Rekapitulasi perolehan skor ujian pilihan ganda dan koreksi uraian</p>
            </div>

            <ProgressChart data={dataRiwayat} />

            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Daftar Hasil Ujian</h4>
              
              {dataRiwayat.length === 0 ? (
                <EmptyState
                  icon="military_tech"
                  title="Belum Ada Riwayat Nilai"
                  description="Kamu belum menyelesaikan ujian apapun. Nilai akan muncul setelah ujian selesai dan dikoreksi oleh sistem/guru."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dataRiwayat.map(r => (
                    <Card
                      key={r.id_log}
                      onClick={() => setDetailNilaiModal(r)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate group-hover:text-emerald-600 transition-colors">
                          {r.nama_mapel}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {new Date(r.waktu_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-bold inline-flex items-center gap-0.5">
                          <span>Lihat Rincian</span>
                          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </p>
                      </div>

                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-lg text-white shadow-sm shrink-0 ${
                        r.is_blocked ? 'bg-rose-500' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      }`}>
                        <span>{r.is_blocked ? 0 : r.total_nilai}</span>
                        <span className="text-[8px] uppercase tracking-wider font-semibold opacity-90">Poin</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: PAPAN PERINGKAT (LEADERBOARD)                         */}
        {/* ============================================================ */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Papan Peringkat Kelas</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">10 Siswa terbaik dengan rata-rata nilai tertinggi</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold px-3 py-1 rounded-full">
                Top 10
              </div>
            </div>

            {dataLeaderboard.length === 0 ? (
              <EmptyState
                icon="social_leaderboard"
                title="Belum Ada Data Peringkat"
                description="Papan peringkat akan otomatis diperbarui setelah ujian selesai dievaluasi."
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {dataLeaderboard.map((lb, idx) => {
                    const isSelf = currentUserId === lb.id;
                    return (
                      <div
                        key={idx}
                        className={`p-4 flex items-center gap-4 transition-colors ${
                          isSelf ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {/* Rank Badge */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white'
                              : idx === 2
                              ? 'bg-amber-600/30 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Name & Class */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
                            <span>{lb.nama}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-semibold">
                                Anda
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">Kelas: {lb.kelas || '-'}</p>
                        </div>

                        {/* Average Score */}
                        <div className="text-right shrink-0">
                          <div className="font-black text-base sm:text-lg text-emerald-600 dark:text-emerald-400">
                            {lb.rata_rata}
                          </div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                            Rata-Rata
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 6: AKUN / PROFIL                                         */}
        {/* ============================================================ */}
        {activeTab === 'akun' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
            <Card className="p-6 sm:p-8 flex flex-col items-center text-center">
              <div className="relative group cursor-pointer mb-4" onClick={() => setIsAvatarModalOpen(true)}>
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500/30 shadow-xl group-hover:scale-105 transition-transform bg-slate-100 dark:bg-slate-800">
                  {user.foto_profil ? (
                    <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-6xl text-emerald-600 h-full flex items-center justify-center">
                      person
                    </span>
                  )}
                </div>
                <div className="absolute bottom-1 right-1 w-9 h-9 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center border-2 border-white dark:border-slate-800 group-hover:bg-emerald-700 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </div>
              </div>

              <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1">{user.nama_lengkap}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{user.nama_sekolah || 'NEXA CBT System'}</p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/60 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-6">
                <span className="material-symbols-outlined text-[14px]">badge</span>
                <span>NISN: {user.nisn || currentUserId}</span>
              </div>

              <div className="w-full space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full justify-between min-h-[44px]"
                  icon="lock"
                  rightIcon="chevron_right"
                  onClick={() => setProfileModalOpen(true)}
                >
                  Ubah Kata Sandi
                </Button>

                <Button
                  variant="danger"
                  size="lg"
                  className="w-full justify-between min-h-[44px]"
                  icon="logout"
                  rightIcon="chevron_right"
                  onClick={onLogout}
                >
                  Keluar Aplikasi
                </Button>
              </div>
            </Card>
          </div>
        )}

      </main>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE STICKY BOTTOM NAVIGATION BAR (md:hidden)               */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg">
        {[
          { id: 'beranda', label: 'Beranda', icon: 'home' },
          { id: 'jadwal', label: 'Jadwal', icon: 'event_note' },
          { id: 'nilai', label: 'Nilai', icon: 'military_tech' },
          { id: 'leaderboard', label: 'Peringkat', icon: 'social_leaderboard' },
          { id: 'akun', label: 'Profil', icon: 'person' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 transition-all ${
                isActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? 'font-black' : ''}`}>
                {tab.icon}
              </span>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
              {isActive && <div className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-full mt-0.5"></div>}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TOKEN ENTRY MODAL (REPLACES INLINE CARD INPUT)                */}
      {/* ------------------------------------------------------------- */}
      {tokenModalJadwal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setTokenModalJadwal(null)}></div>
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md relative z-10 p-6 shadow-2xl animate-slide-up sm:animate-fade-in-up border border-slate-200 dark:border-slate-700">
            
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Konfirmasi Ujian</span>
                <h3 className="font-bold text-xl text-slate-800 dark:text-white mt-0.5">{tokenModalJadwal.nama_mapel}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tokenModalJadwal.nama_guru || 'Pengawas Ruangan'}</p>
              </div>
              <button
                type="button"
                onClick={() => setTokenModalJadwal(null)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleMulaiUjianSubmit} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 text-center">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Masukkan 6 Digit Token Ujian
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Mintalah token rilis ujian kepada guru atau pengawas ruangan.
                </p>

                <input
                  type="text"
                  maxLength={6}
                  value={inputToken}
                  autoFocus
                  onChange={(e) => {
                    setInputToken(e.target.value.toUpperCase());
                    if (tokenError) setTokenError('');
                  }}
                  placeholder="Contoh: AB12CD"
                  className="w-full text-center text-2xl font-mono font-black tracking-[0.3em] uppercase py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all min-h-[52px]"
                />

                {tokenError && (
                  <p className="text-xs text-rose-500 font-bold mt-2 flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{tokenError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1 min-h-[44px]"
                  onClick={() => setTokenModalJadwal(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1 min-h-[44px]"
                  isLoading={isVerifyingToken}
                  icon="play_arrow"
                >
                  Masuk Ujian
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DETAIL NILAI & KOREKSI URAIAN                          */}
      {/* ------------------------------------------------------------- */}
      {detailNilaiModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setDetailNilaiModal(null)}></div>
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl relative z-10 shadow-2xl animate-slide-up sm:animate-fade-in-up overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white relative">
              <button
                type="button"
                onClick={() => setDetailNilaiModal(null)}
                className="absolute top-4 right-4 w-11 h-11 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors min-w-[44px] min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <h3 className="font-bold text-xl mb-1">{detailNilaiModal.nama_mapel}</h3>
              <p className="text-xs opacity-90">
                {new Date(detailNilaiModal.waktu_mulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="p-6">
              <div className="flex flex-col items-center justify-center mb-6 relative">
                <div className={`w-28 h-28 rounded-full border-4 border-slate-50 dark:border-slate-900 flex items-center justify-center ${
                  detailNilaiModal.is_blocked ? 'bg-rose-500' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                } shadow-xl z-10 text-white relative -mt-14`}>
                  <span className="font-black text-3xl">{detailNilaiModal.is_blocked ? 0 : detailNilaiModal.total_nilai}</span>
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Skor Akhir</p>
              </div>

              {detailNilaiModal.is_blocked && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 p-4 rounded-2xl mb-4 text-rose-700 dark:text-rose-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <span className="material-symbols-outlined text-[18px]">gavel</span>
                    <span>Ujian Terblokir</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    Siswa terindikasi melakukan pelanggaran keamanan layar penuh atau berpindah tab lebih dari 3 kali.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-4 text-center">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 mb-1">fact_check</span>
                  <span className="block text-xs text-slate-500">Pilihan Ganda</span>
                  <span className="font-bold text-lg text-slate-800 dark:text-white">{detailNilaiModal.nilai_auto}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-4 text-center">
                  <span className="material-symbols-outlined text-purple-500 mb-1">edit_document</span>
                  <span className="block text-xs text-slate-500">Uraian / Essay</span>
                  <span className="font-bold text-lg text-slate-800 dark:text-white">{detailNilaiModal.nilai_uraian}</span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="lg"
                className="w-full min-h-[44px]"
                onClick={() => setDetailNilaiModal(null)}
              >
                Tutup Rincian
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: UBAH PASSWORD                                          */}
      {/* ------------------------------------------------------------- */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setProfileModalOpen(false)}></div>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Ubah Password</h3>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-2.5 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-600 dark:text-slate-300">Password Baru</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">lock</span>
                  <input
                    name="password"
                    type="password"
                    required
                    className="w-full rounded-xl border p-3 pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm min-h-[44px]"
                    placeholder="Ketik password baru"
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2 min-h-[44px]"
                isLoading={isLoading}
              >
                Simpan Perubahan
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: PILIH AVATAR                                           */}
      {/* ------------------------------------------------------------- */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsAvatarModalOpen(false)}></div>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Pilih Avatar</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pilih karakter profil favoritmu</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-2.5 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAvatarSelect(url)}
                  className={`rounded-2xl overflow-hidden border-4 transition-all hover:scale-105 min-h-[44px] ${
                    user.foto_profil === url
                      ? 'border-emerald-500 shadow-md shadow-emerald-500/30'
                      : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-700'
                  }`}
                >
                  <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SiswaView;
