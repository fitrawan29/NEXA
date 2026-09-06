import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
import ExamRoom from './ExamRoom.jsx';

const Countdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) return 'Dimulai...';
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    setTimeLeft(calc());
    const interval = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return <span className="font-mono text-xs font-bold text-red-500 animate-pulse">{timeLeft}</span>;
};

const ProgressChart = ({ data }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => d.total_nilai)) || 100;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 mt-2">
      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-6 text-center">Grafik Perkembangan Nilai</h4>
      <div className="flex items-end gap-2 h-24">
        {data.slice(0, 10).reverse().map((d, i) => (
          <div key={i} className="flex flex-col items-center flex-1 group relative h-full justify-end cursor-crosshair">
            <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded font-bold z-10 whitespace-nowrap">{d.total_nilai}</div>
            <div className="w-full bg-primary/20 rounded-t-md relative flex items-end" style={{ height: `${Math.max(5, (d.total_nilai / max) * 100)}%` }}>
               <div className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-t-md opacity-80 group-hover:opacity-100 transition-opacity" style={{ height: '100%' }}></div>
            </div>
            <div className="text-[8px] text-slate-500 mt-1 truncate w-full text-center font-bold" title={d.nama_mapel}>{d.nama_mapel.substring(0,3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SiswaView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
  const api = (action, p = {}) => {
    if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
    return fetchAPI(action, { ...p, npsn: user.npsn });
  };
  
  const [jadwal, setJadwal] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeExamData, setActiveExamData] = useState(null);
  const [inputToken, setInputToken] = useState('');
  const [selectedJadwalUntukToken, setSelectedJadwalUntukToken] = useState(null);
  
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pw = fd.get('password');
    if (!pw) return showMessage('Info', 'Password tidak diubah', 'info');
    
    setIsLoading(true);
    const res = await api('update_profil_siswa', { id_siswa: user.id_user, password: pw });
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
    const res = await api('update_profil_siswa', { id_siswa: user.id_user, foto_profil: url });
    setIsLoading(false);
    if (res.status === 'success') {
      user.foto_profil = url;
      showMessage('Sukses', 'Foto profil berhasil diperbarui', 'success');
      setIsAvatarModalOpen(false);
    } else {
      showMessage('Gagal', res.message, 'error');
    }
  };

  useEffect(() => {
    loadPengumuman();
    loadRiwayat();
    loadJadwal();
    loadLeaderboard();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (user && user.session_token) {
        const res = await api('heartbeat_siswa', { id_siswa: user.id_siswa, session_token: user.session_token });
        if (res.status === 'error') {
           onLogout();
           showMessage('Sesi Berakhir', 'Sesi Anda telah digantikan oleh login di perangkat lain atau waktu telah habis.', 'error');
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const loadPengumuman = async () => {
    const res = await api('get_pengumuman', { role: 'siswa' });
    if (res.status === 'success') {
      setDataPengumuman(res.data);
    }
  };

  const loadRiwayat = async () => {
    const res = await api('get_riwayat_ujian_siswa', { id_siswa: user.id_user });
    if (res.status === 'success') setDataRiwayat(res.data);
  };

  const loadLeaderboard = async () => {
    const res = await api('get_leaderboard', {});
    if (res.status === 'success') setDataLeaderboard(res.data);
  };

  const loadJadwal = async () => {
    setIsLoading(true);
    const res = await api('get_jadwal', { id_siswa: user.id_user });
    if (res.status === 'success') setJadwal(res.data);
    setIsLoading(false);
  };

  const handleMulaiUjian = async (j) => {
    if (!inputToken) {
      showMessage('Perhatian', 'Harap masukkan 6 digit token dari pengawas.', 'warning');
      return;
    }
    setIsLoading(true);
    const res = await api('mulai_ujian', {
      id_jadwal: j.id_jadwal,
      id_siswa: user.id_user,
      token: inputToken.toUpperCase()
    });
    setIsLoading(false);
    if (res.status === 'success') {
      setActiveExamData({ jadwal: j, idLog: res.id_log });
    } else {
      showMessage('Akses Ditolak', res.message, 'error');
    }
  };

  const renderJadwalCard = (j, index) => {
    let statusBtnClass = "bg-gradient-to-r from-primary to-secondary text-on-primary";
    let statusText = "Ambil";
    const now = new Date();
    const mulai = new Date(j.waktu_mulai);
    const isBelumMulai = mulai > now;

    if (j.status_siswa === 'SELESAI') {
      statusBtnClass = "bg-slate-400 text-white cursor-not-allowed shadow-none";
      statusText = "Selesai";
    } else if (j.status_siswa === 'SEDANG KERJA') {
      statusBtnClass = "bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]";
      statusText = "Lanjutkan";
    } else if (isBelumMulai) {
      statusBtnClass = "bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400 shadow-none";
      statusText = "Belum Mulai";
    } else {
      statusBtnClass = "bg-gradient-to-r from-primary to-secondary text-on-primary shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all";
      statusText = "Mulai Ujian";
    }
    
    let iconClass = "text-primary bg-primary/10";
    let iconName = "computer";
    if (index % 3 === 1) { iconClass = "text-red-500 bg-red-500/10"; iconName = "menu_book"; }
    if (index % 3 === 2) { iconClass = "text-blue-500 bg-blue-500/10"; iconName = "language"; }

    return (
      <div key={j.id_jadwal} className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-3 transition-colors ${j.status_siswa === 'SEDANG KERJA' ? 'border-amber-400 dark:border-amber-500' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
              <span className="material-symbols-outlined">{iconName}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{j.nama_mapel}</h4>
              <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-50 dark:border-slate-700/50">
          <div className="flex flex-col">
             <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
               {new Date(j.waktu_mulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(j.waktu_selesai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
             </span>
             {isBelumMulai && <Countdown targetDate={j.waktu_mulai} />}
          </div>
          
          {selectedJadwalUntukToken === j.id_jadwal ? (
            <div className="flex items-center gap-1 animate-fade-in">
              <input type="text" maxLength={6} value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="TOKEN" className="w-16 h-8 text-center text-xs font-bold border rounded bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white uppercase focus:ring-1 focus:ring-primary outline-none" />
              <button onClick={() => handleMulaiUjian(j)} className="px-3 h-8 rounded-full text-xs font-bold bg-primary text-white hover:bg-primary/90">Go</button>
              <button onClick={() => setSelectedJadwalUntukToken(null)} className="px-2 h-8 rounded-full text-xs font-bold text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[16px]">close</span></button>
            </div>
          ) : (
            <button onClick={() => !isBelumMulai && j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={isBelumMulai || j.status_siswa === 'SELESAI'} className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusBtnClass}`}>
              {statusText}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (activeExamData) {
    return (
      <ExamRoom
        user={user}
        jadwal={activeExamData.jadwal}
        idLog={activeExamData.idLog}
        showMessage={showMessage}
        onFinish={() => {
          setActiveExamData(null);
          setSelectedJadwalUntukToken(null);
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
    <div className="bg-slate-50 dark:bg-slate-900 min-h-[100dvh] flex justify-center selection:bg-primary/30 selection:text-primary">
      <div className="w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-[100dvh]">
        
        {/* Header / Top Section */}
        <div className="bg-[#3ecf8e] px-6 pt-6 pb-6 relative text-white shadow-md z-0 shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div onClick={() => setIsAvatarModalOpen(true)} className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-sm">
                {user.foto_profil ? (
                  <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover bg-white" />
                ) : (
                  <span className="material-symbols-outlined text-white text-3xl">person</span>
                )}
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight truncate max-w-[200px]">{user.nama_sekolah || 'NEXA CBT'}</h2>
                <p className="text-sm font-medium opacity-90 truncate max-w-[200px]">{user.nama_lengkap}</p>
                <p className="text-xs opacity-80">N.I.S : {user.nisn || user.id_user}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="relative p-1.5 rounded-full hover:bg-white/20 transition-colors text-white backdrop-blur-sm bg-white/10" title="Mode Gelap/Terang">
                <span className="material-symbols-outlined text-xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
          
          {activeTab === 'beranda' && (
            <div className="animate-fade-in-up">
              {/* Jadwal Section */}
              <div className="px-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Ujian Hari Ini</h3>
                  <button onClick={() => setActiveTab('jadwal')} className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full">Lihat Semua</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {jadwal.filter(j => new Date(j.waktu_mulai).toDateString() === new Date().toDateString() || j.status_siswa === 'SEDANG KERJA').length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 col-span-full">🎉 Yey! Tidak ada jadwal ujian untuk hari ini.</div>
                  ) : (
                    jadwal.filter(j => new Date(j.waktu_mulai).toDateString() === new Date().toDateString() || j.status_siswa === 'SEDANG KERJA').slice(0, 3).map((j, index) => renderJadwalCard(j, index))
                  )}
                </div>
              </div>

              {/* Tanggapan Guru / Pengumuman Section */}
              <div className="px-6 mt-8 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">campaign</span> Pengumuman</h3>
                  <button onClick={() => setActiveTab('pengumuman')} className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full">Buka Papan</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {dataPengumuman.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 col-span-full">Belum ada pengumuman baru.</div>
                  ) : (
                    dataPengumuman.slice(0, 2).map(p => (
                      <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-600">
                              {p.judul.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-1">{p.judul}</h4>
                              <p className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{p.isi}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'jadwal' && (
            <div className="px-6 mt-6 animate-fade-in-up">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xl mb-4">Semua Jadwal Ujian</h3>
              
              <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl mb-6">
                 {['HARI INI', 'AKAN DATANG', 'SELESAI'].map(filter => (
                    <button key={filter} onClick={() => setJadwalFilter(filter)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${jadwalFilter === filter ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                       {filter}
                    </button>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {jadwal.filter(j => {
                     const now = new Date();
                     const today = new Date().toDateString();
                     const mulai = new Date(j.waktu_mulai);
                     if (jadwalFilter === 'HARI INI') return mulai.toDateString() === today;
                     if (jadwalFilter === 'AKAN DATANG') return mulai > now && mulai.toDateString() !== today;
                     if (jadwalFilter === 'SELESAI') return j.status_siswa === 'SELESAI' || new Date(j.waktu_selesai) < now;
                     return true;
                  }).length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 col-span-full">Tidak ada jadwal {jadwalFilter.toLowerCase()}.</div>
                  ) : (
                    jadwal.filter(j => {
                      const now = new Date();
                      const today = new Date().toDateString();
                      const mulai = new Date(j.waktu_mulai);
                      if (jadwalFilter === 'HARI INI') return mulai.toDateString() === today;
                      if (jadwalFilter === 'AKAN DATANG') return mulai > now && mulai.toDateString() !== today;
                      if (jadwalFilter === 'SELESAI') return j.status_siswa === 'SELESAI' || new Date(j.waktu_selesai) < now;
                      return true;
                   }).map((j, index) => renderJadwalCard(j, index))
                  )}
                </div>
            </div>
          )}

          {activeTab === 'pengumuman' && (
            <div className="px-6 mt-6 animate-fade-in-up pb-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xl mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">campaign</span> Papan Pengumuman</h3>
              <div className="space-y-4">
                {dataPengumuman.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">Tidak ada pengumuman.</div>
                ) : (
                  dataPengumuman.map(p => (
                    <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                          {p.judul.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.judul}</h4>
                          <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString('id-ID', {weekday: 'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap border border-slate-100 dark:border-slate-700/50">
                        {p.isi}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'nilai' && (
            <div className="px-6 mt-6 animate-fade-in-up pb-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xl mb-2">Nilai & Riwayat Belajar</h3>
              
              <ProgressChart data={dataRiwayat} />

              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-3">Daftar Riwayat Ujian</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dataRiwayat.length === 0 ? (
                   <div className="text-center text-slate-500 text-sm py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 col-span-full">Belum ada nilai ujian yang terekam.</div>
                ) : (
                  dataRiwayat.map(r => (
                    <div key={r.id_log} onClick={() => setDetailNilaiModal(r)} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group">
                       <div className="flex-1 min-w-0 pr-4">
                         <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate group-hover:text-primary transition-colors">{r.nama_mapel}</h4>
                         <p className="text-xs text-slate-500">{new Date(r.waktu_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'})}</p>
                         <p className="text-[10px] text-primary mt-1 font-bold">Klik untuk detail <span className="material-symbols-outlined text-[10px] align-middle">chevron_right</span></p>
                       </div>
                       <div className="bg-gradient-to-br from-green-400 to-green-600 text-white font-black w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-[0_5px_15px_rgba(74,222,128,0.3)] shrink-0">
                         {r.total_nilai}
                       </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
             <div className="px-6 mt-6 animate-fade-in-up pb-10">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xl flex items-center gap-2"><span className="material-symbols-outlined text-yellow-500">social_leaderboard</span> Papan Peringkat</h3>
                   <div className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full">Top 10</div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                   {dataLeaderboard.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm">Belum ada data peringkat.</div>
                   ) : (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700">
                         {dataLeaderboard.map((lb, idx) => (
                            <div key={idx} className={`p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${user.id_user === lb.id ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${idx === 0 ? 'bg-yellow-400 text-yellow-900 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-600 text-amber-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                 {idx + 1}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{lb.nama} {user.id_user === lb.id && <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full ml-2 align-middle">Anda</span>}</h4>
                                  <p className="text-[10px] text-slate-500">Kelas: {lb.kelas || '-'}</p>
                               </div>
                               <div className="text-right shrink-0">
                                  <div className="font-black text-lg text-primary">{lb.rata_rata}</div>
                                  <div className="text-[8px] text-slate-400 uppercase tracking-wider">Rata-Rata</div>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             </div>
          )}

          {activeTab === 'akun' && (
            <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center pb-24">
               <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                 <div className="w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl group-hover:scale-105 transition-transform">
                   {user.foto_profil ? (
                     <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <span className="material-symbols-outlined text-5xl text-primary">person</span>
                   )}
                 </div>
                 <div className="absolute bottom-4 right-0 w-8 h-8 bg-primary text-white rounded-full shadow-lg flex items-center justify-center border-2 border-white dark:border-slate-800 group-hover:bg-primary/90 transition-colors">
                   <span className="material-symbols-outlined text-[14px]">edit</span>
                 </div>
               </div>
               <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1">{user.nama_lengkap}</h3>
               <div className="bg-slate-100 dark:bg-slate-800 px-4 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 mb-8 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">badge</span> {user.nisn || user.id_user}
               </div>
               
               <div className="w-full space-y-3">
                  <button onClick={() => setProfileModalOpen(true)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:border-primary/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">Ubah Password</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Perbarui kata sandi keamanan Anda</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                  </button>
                  <button onClick={onLogout} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:border-red-500/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined">logout</span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-sm text-red-600 dark:text-red-400">Keluar Aplikasi</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Akhiri sesi belajar Anda hari ini</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-red-500 transition-colors">chevron_right</span>
                  </button>
               </div>
            </div>
          )}

        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-md dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 px-4 md:px-12 py-2.5 flex justify-between md:justify-center md:gap-12 items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-40">
          <button onClick={() => setActiveTab('beranda')} className={`flex flex-col items-center flex-1 transition-all ${activeTab === 'beranda' ? 'text-primary -translate-y-1' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <span className={`material-symbols-outlined text-[24px] ${activeTab === 'beranda' ? 'font-black' : ''}`}>home</span>
            <span className="text-[9px] font-bold mt-1">Beranda</span>
            {activeTab === 'beranda' && <div className="w-1 h-1 bg-primary rounded-full mt-1"></div>}
          </button>
          <button onClick={() => setActiveTab('jadwal')} className={`flex flex-col items-center flex-1 transition-all ${activeTab === 'jadwal' ? 'text-primary -translate-y-1' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <span className={`material-symbols-outlined text-[24px] ${activeTab === 'jadwal' ? 'font-black' : ''}`}>event_note</span>
            <span className="text-[9px] font-bold mt-1">Jadwal</span>
            {activeTab === 'jadwal' && <div className="w-1 h-1 bg-primary rounded-full mt-1"></div>}
          </button>
          <button onClick={() => setActiveTab('nilai')} className={`flex flex-col items-center flex-1 transition-all ${activeTab === 'nilai' ? 'text-primary -translate-y-1' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <span className={`material-symbols-outlined text-[24px] ${activeTab === 'nilai' ? 'font-black' : ''}`}>military_tech</span>
            <span className="text-[9px] font-bold mt-1">Nilai</span>
            {activeTab === 'nilai' && <div className="w-1 h-1 bg-primary rounded-full mt-1"></div>}
          </button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex flex-col items-center flex-1 transition-all ${activeTab === 'leaderboard' ? 'text-yellow-500 -translate-y-1' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <span className={`material-symbols-outlined text-[24px] ${activeTab === 'leaderboard' ? 'font-black' : ''}`}>social_leaderboard</span>
            <span className="text-[9px] font-bold mt-1">Peringkat</span>
            {activeTab === 'leaderboard' && <div className="w-1 h-1 bg-yellow-500 rounded-full mt-1"></div>}
          </button>
          <button onClick={() => setActiveTab('akun')} className={`flex flex-col items-center flex-1 transition-all ${activeTab === 'akun' ? 'text-primary -translate-y-1' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <span className={`material-symbols-outlined text-[24px] ${activeTab === 'akun' ? 'font-black' : ''}`}>person</span>
            <span className="text-[9px] font-bold mt-1">Profil</span>
            {activeTab === 'akun' && <div className="w-1 h-1 bg-primary rounded-full mt-1"></div>}
          </button>
        </div>

        {/* Modals */}
        {profileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setProfileModalOpen(false)}></div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-fade-in-up border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Ubah Password</h3>
                <button onClick={() => setProfileModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 dark:text-slate-300">Password Baru</label>
                  <div className="relative">
                     <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">lock</span>
                     <input name="password" type="password" required className="w-full rounded-xl border p-3 pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm" placeholder="Ketik password baru" />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-2 disabled:opacity-50">
                  {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </form>
            </div>
          </div>
        )}

        {isAvatarModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsAvatarModalOpen(false)}></div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-fade-in-up border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="font-bold text-lg text-slate-800 dark:text-white">Pilih Avatar</h3>
                   <p className="text-xs text-slate-500">Pilih karakter favoritmu</p>
                </div>
                <button onClick={() => setIsAvatarModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {PRESET_AVATARS.map((url, idx) => (
                  <button key={idx} onClick={() => handleAvatarSelect(url)} className={`rounded-2xl overflow-hidden border-4 transition-all hover:scale-105 ${user.foto_profil === url ? 'border-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-700'}`}>
                    <img src={url} alt={`Avatar ${idx+1}`} className="w-full h-auto" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {detailNilaiModal && (
           <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setDetailNilaiModal(null)}></div>
              <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl relative z-10 shadow-2xl animate-slide-up overflow-hidden border border-slate-100 dark:border-slate-700">
                 <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white relative">
                    <button onClick={() => setDetailNilaiModal(null)} className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                       <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                    <h3 className="font-bold text-xl mb-1">{detailNilaiModal.nama_mapel}</h3>
                    <p className="text-sm opacity-90">{new Date(detailNilaiModal.waktu_mulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                 </div>
                 
                 <div className="p-6">
                    <div className="flex flex-col items-center justify-center mb-8 relative">
                       <div className="w-32 h-32 rounded-full border-8 border-slate-50 dark:border-slate-900 flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 shadow-xl z-10 text-white relative -mt-16">
                          <span className="font-black text-4xl">{detailNilaiModal.total_nilai}</span>
                       </div>
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-3">Skor Akhir</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center">
                          <span className="material-symbols-outlined text-blue-500 mb-1">fact_check</span>
                          <span className="text-xs text-slate-500 mb-1">Pilihan Ganda</span>
                          <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{detailNilaiModal.nilai_auto}</span>
                       </div>
                       <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center">
                          <span className="material-symbols-outlined text-purple-500 mb-1">edit_document</span>
                          <span className="text-xs text-slate-500 mb-1">Uraian / Essay</span>
                          <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{detailNilaiModal.nilai_uraian}</span>
                       </div>
                    </div>
                    
                    <button onClick={() => setDetailNilaiModal(null)} className="w-full mt-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Tutup Detail</button>
                 </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default SiswaView;
