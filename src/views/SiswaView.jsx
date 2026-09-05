import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
﻿    const SiswaView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
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
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataRiwayat, setDataRiwayat] = useState([]);
      const [hasNotification, setHasNotification] = useState(false);
      
      const [profileModalOpen, setProfileModalOpen] = useState(false);
      const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
      
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
          user.foto_profil = url; // Update local state directly for immediate visual feedback
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
      }, []);

      const loadPengumuman = async () => {
        const res = await api('get_pengumuman', { role: 'siswa' });
        if (res.status === 'success') {
          setDataPengumuman(res.data);
          setHasNotification(false);
        }
      };

      const loadRiwayat = async () => {
        const res = await api('get_riwayat_ujian_siswa', { id_siswa: user.id_user });
        if (res.status === 'success') setDataRiwayat(res.data);
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
            }}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
          />
        );
      }

      return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/30 selection:text-primary">
          <div className="w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] px-6 pt-6 pb-6 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {user.foto_profil ? (
                      <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover bg-white" />
                    ) : (
                      <span className="material-symbols-outlined text-white text-3xl">person</span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">{user.nama_sekolah || 'Siswa'}</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">N.I.S : {user.nisn || user.id_user}</p>
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
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              {activeTab === 'beranda' && (
                <>
                  {/* Jadwal Section */}
                  <div className="px-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Jadwal</h3>
                      <button onClick={() => setActiveTab('jadwal')} className="text-sm font-medium text-primary hover:underline">Lihat semua</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {jadwal.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada jadwal aktif.</div>
                      ) : (
                        jadwal.filter(j => j.status_ujian === 'AKTIF' || new Date(j.waktu_mulai).toDateString() === new Date().toDateString()).slice(0, 3).map((j, index) => {
                          let statusBtnClass = "bg-gradient-to-r from-primary to-secondary text-on-primary";
                          let statusText = "Ambil";
                          if (j.status_siswa === 'SELESAI') {
                            statusBtnClass = "bg-slate-400 text-white cursor-not-allowed";
                            statusText = "Selesai";
                          } else if (j.status_siswa === 'SEDANG KERJA') {
                            statusBtnClass = "bg-yellow-500 text-white";
                            statusText = "Lanjutkan";
                          } else {
                            statusBtnClass = "bg-yellow-400 text-slate-800";
                            statusText = "Ambil";
                          }
                          
                          let iconClass = "text-primary bg-primary/10";
                          let iconName = "computer";
                          if (index % 3 === 1) { iconClass = "text-red-500 bg-red-500/10"; iconName = "menu_book"; }
                          if (index % 3 === 2) { iconClass = "text-blue-500 bg-blue-500/10"; iconName = "language"; }

                          return (
                            <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                                  <span className="material-symbols-outlined">{iconName}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{j.nama_mapel}</h4>
                                  <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                  {new Date(j.waktu_mulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(j.waktu_selesai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                
                                {selectedJadwalUntukToken === j.id_jadwal ? (
                                  <div className="flex items-center gap-1">
                                    <input type="text" maxLength={6} value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="TOKEN" className="w-16 h-8 text-center text-xs font-bold border rounded bg-slate-50" />
                                    <button onClick={() => handleMulaiUjian(j)} className="px-3 h-8 rounded-full text-xs font-bold bg-gradient-to-r from-primary to-secondary text-on-primary">Go</button>
                                  </div>
                                ) : (
                                  <button onClick={() => j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={j.status_siswa === 'SELESAI'} className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusBtnClass}`}>
                                    {statusText}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Tanggapan Guru / Pengumuman Section */}
                  <div className="px-6 mt-8 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Tanggapan Guru</h3>
                      <button onClick={() => setActiveTab('pengumuman')} className="text-sm font-medium text-primary hover:underline">Lihat semua</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {dataPengumuman.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada tanggapan/pengumuman.</div>
                      ) : (
                        dataPengumuman.slice(0, 2).map(p => (
                          <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                  <img src={`https://ui-avatars.com/api/?name=${p.judul}&background=random`} alt="Avatar" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{p.judul}</h4>
                                  <p className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} yang lalu</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.isi}</p>
                              <button className="px-4 py-1 bg-gradient-to-r from-primary to-secondary text-on-primary text-xs font-bold rounded-full">Lihat</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Semua Jadwal Ujian</h3>
                  {/* ... same list as beranda, but all ... */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {jadwal.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada jadwal aktif.</div>
                      ) : (
                        jadwal.map((j, index) => {
                          let statusBtnClass = "bg-gradient-to-r from-primary to-secondary text-on-primary";
                          let statusText = "Ambil";
                          if (j.status_siswa === 'SELESAI') {
                            statusBtnClass = "bg-slate-400 text-white cursor-not-allowed";
                            statusText = "Selesai";
                          } else if (j.status_siswa === 'SEDANG KERJA') {
                            statusBtnClass = "bg-yellow-500 text-white";
                            statusText = "Lanjutkan";
                          } else {
                            statusBtnClass = "bg-yellow-400 text-slate-800";
                            statusText = "Ambil";
                          }
                          
                          let iconClass = "text-primary bg-primary/10";
                          let iconName = "computer";
                          if (index % 3 === 1) { iconClass = "text-red-500 bg-red-500/10"; iconName = "menu_book"; }
                          if (index % 3 === 2) { iconClass = "text-blue-500 bg-blue-500/10"; iconName = "language"; }

                          return (
                            <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                                  <span className="material-symbols-outlined">{iconName}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{j.nama_mapel}</h4>
                                  <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                  {new Date(j.waktu_mulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(j.waktu_selesai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {selectedJadwalUntukToken === j.id_jadwal ? (
                                  <div className="flex items-center gap-1">
                                    <input type="text" maxLength={6} value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="TOKEN" className="w-16 h-8 text-center text-xs font-bold border rounded bg-slate-50" />
                                    <button onClick={() => handleMulaiUjian(j)} className="px-3 h-8 rounded-full text-xs font-bold bg-gradient-to-r from-primary to-secondary text-on-primary">Go</button>
                                  </div>
                                ) : (
                                  <button onClick={() => j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={j.status_siswa === 'SELESAI'} className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusBtnClass}`}>
                                    {statusText}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                </div>
              )}

              {activeTab === 'nilai' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Nilai & Riwayat Ujian</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {dataRiwayat.length === 0 ? (
                       <div className="text-center text-slate-500 text-sm py-4">Belum ada nilai.</div>
                    ) : (
                      dataRiwayat.map(r => (
                        <div key={r.id_log} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                           <div>
                             <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{r.nama_mapel}</h4>
                             <p className="text-xs text-slate-500">{new Date(r.waktu_mulai).toLocaleDateString('id-ID')}</p>
                           </div>
                           <div className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-lg text-lg">
                             {r.total_nilai}
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center pb-24">
                   <div className="relative group">
                     <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-white shadow-md">
                       {user.foto_profil ? (
                         <img src={user.foto_profil} alt="Profile" className="w-full h-full object-cover" />
                       ) : (
                         <span className="material-symbols-outlined text-4xl text-primary">person</span>
                       )}
                     </div>
                     <button onClick={() => setIsAvatarModalOpen(true)} className="absolute bottom-4 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100 text-slate-600 hover:text-primary hover:scale-110 transition-transform">
                       <span className="material-symbols-outlined text-sm">edit</span>
                     </button>
                   </div>
                   <h3 className="font-bold text-xl dark:text-white">{user.nama_lengkap}</h3>
                   <p className="text-slate-500">{user.nisn || user.id_user}</p>
                   
                   <div className="w-full mt-8 space-y-3">
                      <button onClick={() => setProfileModalOpen(true)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                            <span className="material-symbols-outlined">lock</span>
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-sm dark:text-white">Ubah Password</h4>
                            <p className="text-xs text-slate-500">Perbarui kata sandi akun Anda</p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                      </button>
                      <button onClick={onLogout} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                            <span className="material-symbols-outlined">logout</span>
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-sm text-red-600 dark:text-red-400">Keluar Akun</h4>
                            <p className="text-xs text-slate-500">Akhiri sesi Anda saat ini</p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 transition-colors">chevron_right</span>
                      </button>
                   </div>
                </div>
              )}

            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 md:px-12 py-3 flex justify-between md:justify-center md:gap-16 items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-40">
              <button onClick={() => setActiveTab('beranda')} className={`flex flex-col items-center transition-colors ${activeTab === 'beranda' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">home</span>
                <span className="text-[10px] font-bold mt-1">Beranda</span>
              </button>
              <button onClick={() => setActiveTab('nilai')} className={`flex flex-col items-center transition-colors ${activeTab === 'nilai' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">description</span>
                <span className="text-[10px] font-bold mt-1">Nilai</span>
              </button>
              <button onClick={() => setActiveTab('jadwal')} className={`flex flex-col items-center transition-colors ${activeTab === 'jadwal' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">schedule</span>
                <span className="text-[10px] font-bold mt-1">Jadwal</span>
              </button>
              <button onClick={() => setActiveTab('akun')} className={`flex flex-col items-center transition-colors ${activeTab === 'akun' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-bold mt-1">Akun</span>
              </button>
            </div>

            {/* Modals */}
            {profileModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setProfileModalOpen(false)}></div>
                <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg dark:text-white">Ubah Password</h3>
                    <button onClick={() => setProfileModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded-full"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Password Baru</label>
                      <input name="password" type="password" required className="w-full rounded-xl border p-3 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="Masukkan password baru" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                      {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {isAvatarModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsAvatarModalOpen(false)}></div>
                <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg dark:text-white">Pilih Avatar</h3>
                    <button onClick={() => setIsAvatarModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded-full"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button key={idx} onClick={() => handleAvatarSelect(url)} className={`rounded-full overflow-hidden border-4 transition-all hover:scale-105 ${user.foto_profil === url ? 'border-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}>
                        <img src={url} alt={`Avatar ${idx+1}`} className="w-full h-auto" />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-center text-slate-500">Pilih avatar yang paling mencerminkan diri Anda!</p>
                </div>
              </div>
            )}

          </div>
        </div>
      );
    };



export default SiswaView;




