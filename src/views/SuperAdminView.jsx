import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef, useCallback } from 'react';
﻿    const SuperAdminView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
      const [activeTab, setActiveTab] = useState('analytics');
      const [dataSekolah, setDataSekolah] = useState([]);
      const [dataAdmin, setDataAdmin] = useState([]);
      const [dataAnalytics, setDataAnalytics] = useState({});
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataLog, setDataLog] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [visibleCount, setVisibleCount] = useState(10);
      const [fotoProfil, setFotoProfil] = useState(localStorage.getItem(`foto_${user.username}`) || '');
      
      const [formModal, setFormModal] = useState({ isOpen: false, type: '', isEdit: false, editItem: null });

      const fetchData = async (tab) => {
        if (tab === 'profil') return;
        setIsLoading(true);
        if (tab === 'sekolah') {
          const res = await fetchAPI('get_sekolah');
          if (res.status === 'success') setDataSekolah(res.data);
        } else if (tab === 'admin') {
          const res = await fetchAPI('get_admin_all');
          if (res.status === 'success') setDataAdmin(res.data);
          
          // Also fetch sekolah to populate dropdown for adding admin
          const resSekolah = await fetchAPI('get_sekolah');
          if (resSekolah.status === 'success') setDataSekolah(resSekolah.data);
        } else if (tab === 'analytics') {
          const res = await fetchAPI('get_analytics');
          if (res.status === 'success') setDataAnalytics(res.data);
        } else if (tab === 'pengumuman') {
          const res = await fetchAPI('get_pengumuman_global');
          if (res.status === 'success') setDataPengumuman(res.data);
        } else if (tab === 'log') {
          const res = await fetchAPI('get_log_aktivitas_global');
          if (res.status === 'success') setDataLog(res.data);
        }
        setIsLoading(false);
      };

      useEffect(() => {
        setVisibleCount(10);
        fetchData(activeTab);
      }, [activeTab]);

      // Realtime Sync for sekolah
      const useCallbackSekolah = useCallback((payload) => {
         if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setDataSekolah(prev => {
               const idx = prev.findIndex(item => item.npsn === payload.new.npsn);
               if (idx !== -1) {
                  const newArr = [...prev];
                  newArr[idx] = { ...newArr[idx], ...payload.new };
                  return newArr;
               }
               return [payload.new, ...prev];
            });
         } else if (payload.eventType === 'DELETE') {
            setDataSekolah(prev => prev.filter(item => item.npsn !== payload.old.npsn));
         }
      }, []);
      useSupabaseRealtime('sekolah', null, useCallbackSekolah);
      
      // Realtime Sync for admin
      const useCallbackAdmin = useCallback((payload) => {
         if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setDataAdmin(prev => {
               const idx = prev.findIndex(item => item.id_admin === payload.new.id_admin);
               if (idx !== -1) {
                  const newArr = [...prev];
                  newArr[idx] = { ...newArr[idx], ...payload.new };
                  return newArr;
               }
               return [payload.new, ...prev];
            });
         } else if (payload.eventType === 'DELETE') {
            setDataAdmin(prev => prev.filter(item => item.id_admin !== payload.old.id_admin));
         }
      }, []);
      useSupabaseRealtime('admin', null, useCallbackAdmin);

      const handleSaveForm = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        let endpoint = '';
        if (formModal.type === 'sekolah') endpoint = formModal.isEdit ? 'update_sekolah' : 'create_sekolah';
        else if (formModal.type === 'admin') endpoint = formModal.isEdit ? 'update_admin_sekolah' : 'create_admin_sekolah';
        else if (formModal.type === 'pengumuman') endpoint = 'create_pengumuman_global';

        const res = await fetchAPI(endpoint, payload);
        if (res.status === 'success') {
          setFormModal({ isOpen: false, type: '', isEdit: false, editItem: null });
          fetchData(activeTab);
        } else {
          alert(res.message);
        }
      };

      const handleEdit = (type, item) => {
        setFormModal({ isOpen: true, type, isEdit: true, editItem: item });
      };

      const handleDelete = async (type, item) => {
        if (!confirm(`Hapus data ini secara permanen?`)) return;
        let endpoint = '';
        let payload = {};
        
        if (type === 'sekolah') { endpoint = 'delete_sekolah'; payload = { npsn: item.npsn }; }
        else if (type === 'admin') { endpoint = 'delete_admin_sekolah'; payload = { id_admin: item.id_admin }; }
        else if (type === 'pengumuman') { endpoint = 'delete_pengumuman_global'; payload = { id_pengumuman: item.id_pengumuman }; }
        
        const res = await fetchAPI(endpoint, payload);
        if (res.status === 'success') fetchData(activeTab);
        else alert(res.message);
      };

      const renderFormModal = () => {
        if (!formModal.isOpen) return null;
        const type = formModal.type;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700">
              <h2 className="text-xl font-bold mb-4 text-on-surface dark:text-white capitalize">
                {formModal.isEdit ? 'Edit' : 'Tambah'} {type}
              </h2>
              <form onSubmit={handleSaveForm} className="space-y-4">
                {type === 'sekolah' && (
                  <>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">NPSN</label><input name="npsn" defaultValue={formModal.editItem?.npsn} readOnly={formModal.isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Sekolah</label><input name="nama_sekolah" defaultValue={formModal.editItem?.nama_sekolah} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                  </>
                )}
                {type === 'admin' && (
                  <>
                    {formModal.isEdit && <input type="hidden" name="id_admin" value={formModal.editItem?.id_admin} />}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Lengkap</label><input name="nama_lengkap" defaultValue={formModal.editItem?.nama_lengkap} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Username</label><input name="username" defaultValue={formModal.editItem?.username} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password {formModal.isEdit && '(Kosongkan jika tidak diubah)'}</label><input name="password" type="password" required={!formModal.isEdit} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Sekolah (NPSN)</label>
                      <select name="npsn" defaultValue={formModal.editItem?.npsn} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        <option value="">-- Pilih Sekolah --</option>
                        {dataSekolah.map(s => <option key={s.npsn} value={s.npsn}>{s.npsn} - {s.nama_sekolah}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {type === 'pengumuman' && (
                  <>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Judul Pengumuman</label><input name="judul" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Isi Pengumuman</label><textarea name="isi" required rows="4" className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"></textarea></div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Tipe</label>
                      <select name="tipe" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        <option value="info">Info (Biru)</option>
                        <option value="warning">Warning (Kuning)</option>
                        <option value="success">Success (Hijau)</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setFormModal({ isOpen: false, type: '', isEdit: false, editItem: null })} className="px-4 py-2 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-variant">Batal</button>
                  <button type="submit" className="px-4 py-2 rounded-lg font-label-md bg-gradient-to-r from-primary to-secondary text-on-primary text-on-primary hover:from-primary/90 hover:to-secondary/90">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        );
      };

      return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/30 selection:text-primary">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] rounded-none px-6 pt-4 pb-4 relative text-white shadow-md z-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {fotoProfil ? (
                      <img src={fotoProfil} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-white text-3xl">verified_user</span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Super Admin</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="relative p-1 rounded-full hover:bg-white/20 transition-colors" title="Mode Gelap/Terang">
                    <span className="material-symbols-outlined text-2xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                  </button>
                </div>
              </div>
            </div>


            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              {activeTab === 'analytics' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Dasbor Statistik</h3>
                  <p className="text-sm text-slate-500 mb-6">Ringkasan statistik dari seluruh sekolah yang terdaftar di sistem.</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-6">
                     <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                        <span className="material-symbols-outlined text-white/70 mb-1 text-lg">public</span>
                        <span className="text-xl font-bold">{dataAnalytics.concurrentUsers || 0}</span>
                        <span className="text-[10px] font-medium opacity-90 leading-tight">Ujian Aktif Saat Ini</span>
                     </div>
                     <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-3 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                        <span className="material-symbols-outlined text-white/70 mb-1 text-lg">school</span>
                        <span className="text-xl font-bold">{dataAnalytics.stats?.reduce((acc, s) => acc + s.total_siswa, 0) || 0}</span>
                        <span className="text-[10px] font-medium opacity-90 leading-tight">Total Siswa Terdaftar</span>
                     </div>
                     <div className="bg-gradient-to-br from-orange-400 to-red-500 p-3 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                        <span className="material-symbols-outlined text-white/70 mb-1 text-lg">badge</span>
                        <span className="text-xl font-bold">{dataAnalytics.stats?.reduce((acc, s) => acc + s.total_guru, 0) || 0}</span>
                        <span className="text-[10px] font-medium opacity-90 leading-tight">Total Guru</span>
                     </div>
                     <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 p-3 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                        <span className="material-symbols-outlined text-white/70 mb-1 text-lg">quiz</span>
                        <span className="text-xl font-bold">{dataAnalytics.stats?.reduce((acc, s) => acc + s.total_soal, 0) || 0}</span>
                        <span className="text-[10px] font-medium opacity-90 leading-tight">Total Soal Bank</span>
                     </div>
                  </div>

                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3">Rincian per Sekolah</h4>
                  <div className="space-y-3">
                    {dataAnalytics.stats?.map((s, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{s.nama_sekolah}</p>
                          <p className="text-[10px] text-slate-500">{s.npsn}</p>
                        </div>
                        <div className="flex gap-3 text-center ml-2">
                           <div>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{s.total_siswa}</p>
                              <p className="text-[9px] text-slate-400">Siswa</p>
                           </div>
                           <div>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{s.total_guru}</p>
                              <p className="text-[9px] text-slate-400">Guru</p>
                           </div>
                        </div>
                      </div>
                    ))}
                    {(!dataAnalytics.stats || dataAnalytics.stats.length === 0) && (
                      <p className="text-xs text-center text-slate-500">Belum ada data analitik.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'sekolah' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Sekolah</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataSekolah.length} Sekolah</span>
                  </div>
                  <div className="space-y-3 pb-32">
                    {dataSekolah.slice(0, visibleCount).map((s) => (
                      <div key={s.npsn} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-slate-500 dark:text-slate-300">account_balance</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{s.nama_sekolah}</h4>
                          <p className="text-xs text-slate-500 truncate">NPSN: {s.npsn}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit('sekolah', s)} className="p-1 text-slate-400 hover:text-blue-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete('sekolah', s)} className="p-1 text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    {dataSekolah.length > visibleCount && (
                      <button 
                        onClick={() => setVisibleCount(v => v + 10)} 
                        className="w-full py-3 mt-4 text-sm font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
                        Tampilkan Lebih Banyak
                      </button>
                    )}
                  </div>
                  {/* FAB Tambah */}
                  <button 
                    onClick={() => setFormModal({ isOpen: true, type: 'sekolah', isEdit: false })}
                    className="fixed bottom-20 right-4 w-10 h-10 bg-gradient-to-r from-primary to-secondary text-emerald-900 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-10">
                    <span className="material-symbols-outlined text-2xl">add</span>
                  </button>
                </div>
              )}

              {activeTab === 'admin' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Admin</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataAdmin.length} Admin</span>
                  </div>
                  <div className="space-y-3 pb-32">
                    {dataAdmin.slice(0, visibleCount).map((a) => (
                      <div key={a.id_admin} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-slate-500 dark:text-slate-300">manage_accounts</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{a.nama_lengkap}</h4>
                          <p className="text-xs text-slate-500 truncate">ID: {a.id_admin} | NPSN: {a.npsn}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit('admin', a)} className="p-1 text-slate-400 hover:text-blue-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete('admin', a)} className="p-1 text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    {dataAdmin.length > visibleCount && (
                      <button 
                        onClick={() => setVisibleCount(v => v + 10)} 
                        className="w-full py-3 mt-4 text-sm font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
                        Tampilkan Lebih Banyak
                      </button>
                    )}
                  </div>
                  {/* FAB Tambah */}
                  <button 
                    onClick={() => setFormModal({ isOpen: true, type: 'admin', isEdit: false })}
                    className="fixed bottom-20 right-4 w-10 h-10 bg-gradient-to-r from-primary to-secondary text-emerald-900 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-10">
                    <span className="material-symbols-outlined text-2xl">add</span>
                  </button>
                </div>
              )}

              {activeTab === 'pengumuman' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Pengumuman Global</h3>
                  <div className="space-y-3 pb-32">
                    {dataPengumuman.slice(0, visibleCount).map((p) => (
                      <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-start gap-3">
                         <div className="flex-1">
                           <h4 className="font-bold text-sm">{p.judul}</h4>
                           <p className="text-[10px] text-slate-400 mb-2">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                           <p className="text-xs text-slate-600 line-clamp-2">{p.isi}</p>
                         </div>
                         <button onClick={() => handleDelete('pengumuman', p)} className="p-1 text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg shrink-0">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                         </button>
                      </div>
                    ))}
                    {dataPengumuman.length === 0 && <div className="text-center text-sm text-slate-500">Tidak ada pengumuman.</div>}
                    {dataPengumuman.length > visibleCount && (
                      <button 
                        onClick={() => setVisibleCount(v => v + 10)} 
                        className="w-full py-3 mt-4 text-sm font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
                        Tampilkan Lebih Banyak
                      </button>
                    )}
                  </div>
                  {/* FAB Tambah */}
                  <button 
                    onClick={() => setFormModal({ isOpen: true, type: 'pengumuman', isEdit: false })}
                    className="fixed bottom-20 right-4 w-10 h-10 bg-gradient-to-r from-primary to-secondary text-emerald-900 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-10">
                    <span className="material-symbols-outlined text-2xl">add</span>
                  </button>
                </div>
              )}

              {activeTab === 'log' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">System Logs</h3>
                  <div className="space-y-3 pb-32">
                    {dataLog.slice(0, visibleCount).map((l) => (
                      <div key={l.id_log} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                         <div className="flex justify-between">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{l.tipe_user}</span>
                            <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleString('id-ID')}</span>
                         </div>
                         <p className="text-xs mt-1 text-slate-700 dark:text-slate-300">{l.aktivitas}</p>
                      </div>
                    ))}
                    {dataLog.length === 0 && <div className="text-center text-sm text-slate-500">Tidak ada log.</div>}
                    {dataLog.length > visibleCount && (
                      <button 
                        onClick={() => setVisibleCount(v => v + 10)} 
                        className="w-full py-3 mt-4 text-sm font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
                        Tampilkan Lebih Banyak
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up pb-24">
                   <div className="flex flex-col items-center">
                     <div className="relative group">
                       <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-2 overflow-hidden border-2 border-primary/30">
                         {fotoProfil ? (
                            <img src={fotoProfil} className="w-full h-full object-cover" />
                         ) : (
                            <span className="material-symbols-outlined text-4xl text-primary">person</span>
                         )}
                       </div>
                       <label className="absolute bottom-2 right-0 w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow flex items-center justify-center border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                         <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files[0];
                            if(file) {
                               const reader = new FileReader();
                               reader.onload = (event) => {
                                  const img = new Image();
                                  img.onload = () => {
                                      const canvas = document.createElement('canvas');
                                      const MAX_WIDTH = 200;
                                      const MAX_HEIGHT = 200;
                                      let width = img.width;
                                      let height = img.height;

                                      if (width > height) {
                                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                                      } else {
                                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                                      }

                                      canvas.width = width;
                                      canvas.height = height;
                                      const ctx = canvas.getContext('2d');
                                      ctx.drawImage(img, 0, 0, width, height);
                                      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                      try {
                                        localStorage.setItem(`foto_${user.username}`, dataUrl);
                                        setFotoProfil(dataUrl);
                                      } catch (err) {
                                        showMessage('Error', 'Gagal menyimpan foto. File mungkin masih terlalu besar.', 'error');
                                      }
                                  };
                                  img.src = event.target.result;
                               };
                               reader.readAsDataURL(file);
                            }
                         }} />
                         <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-300">edit</span>
                       </label>
                     </div>
                     <h3 className="font-bold text-xl dark:text-white">{user.nama_lengkap}</h3>
                     <p className="text-slate-500 text-sm">SuperAdmin</p>
                   </div>
                   
                   <div className="w-full mt-8 space-y-6">
                      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h4 className="font-bold text-sm mb-3 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400">lock</span> Ganti Password
                        </h4>
                        <div className="flex flex-col gap-2">
                          <input type="password" placeholder="Password Baru" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary" id="new_superadmin_password" />
                          <button onClick={async () => {
                            const pwd = document.getElementById('new_superadmin_password').value;
                            if(!pwd) return showMessage('Info', 'Password tidak boleh kosong', 'info');
                            const res = await fetchAPI('update_superadmin_password', { username: user.username, password: pwd });
                            showMessage(res.status === 'success' ? 'Sukses' : 'Gagal', res.message, res.status);
                            if(res.status === 'success') document.getElementById('new_superadmin_password').value = '';
                          }} className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold rounded-xl text-sm transition-colors mt-1">Simpan Password</button>
                        </div>
                      </div>

                      <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30">
                        <h4 className="font-bold text-sm mb-1 text-red-600 dark:text-red-400 flex items-center gap-2">
                          <span className="material-symbols-outlined">warning</span> Zona Bahaya
                        </h4>
                        <p className="text-[10px] text-red-500/80 mb-3">Tindakan ini akan menghapus permanen seluruh data (Sekolah, Admin, Guru, Siswa, Ujian).</p>
                        <button onClick={() => {
                          if(window.confirm('PERINGATAN KERAS! Apakah Anda yakin ingin mereset dan MENGHAPUS SEMUA DATA sistem?')) {
                            fetchAPI('reset_all_data').then(res => {
                              showMessage(res.status === 'success' ? 'Berhasil' : 'Gagal', res.message, res.status);
                              if(res.status === 'success') window.location.reload();
                            });
                          }
                        }} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm">
                          Reset Semua Data
                        </button>
                      </div>

                      <button onClick={onLogout} className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">logout</span> Keluar Akun
                      </button>
                   </div>
                </div>
              )}

            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center transition-colors ${activeTab === 'analytics' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">analytics</span>
                <span className="text-[10px] font-bold mt-1">Statistik</span>
              </button>
              <button onClick={() => setActiveTab('sekolah')} className={`flex flex-col items-center transition-colors ${activeTab === 'sekolah' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">account_balance</span>
                <span className="text-[10px] font-bold mt-1">Sekolah</span>
              </button>
              <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center transition-colors ${activeTab === 'admin' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">manage_accounts</span>
                <span className="text-[10px] font-bold mt-1">Admin</span>
              </button>
              <button onClick={() => setActiveTab('pengumuman')} className={`flex flex-col items-center transition-colors ${activeTab === 'pengumuman' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">campaign</span>
                <span className="text-[10px] font-bold mt-1">Informasi</span>
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




export default SuperAdminView;

