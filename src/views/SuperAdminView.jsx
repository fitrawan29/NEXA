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
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700">
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
                  <button type="submit" className="px-4 py-2 rounded-lg font-label-md bg-primary text-on-primary hover:bg-primary/90">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        );
      };

      return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/20 selection:text-primary">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] rounded-b-[40px] px-6 pt-8 pb-20 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl">verified_user</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Super Admin</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">Developer</p>
                  </div>
                </div>
                <button className="relative">
                  <span className="material-symbols-outlined text-2xl">settings</span>
                </button>
              </div>
            </div>

            {/* Stats Cards (Overlapping) */}
            <div className="px-6 -mt-12 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-green-500">account_balance</span>
                  </div>
                  <span className="text-xl font-bold text-green-500">{dataSekolah.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Sekolah</span>
                  <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-slate-100 dark:border-slate-700">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-blue-500">manage_accounts</span>
                  </div>
                  <span className="text-xl font-bold text-blue-500">{dataAdmin.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Admin</span>
                  <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-purple-500">memory</span>
                  </div>
                  <span className="text-xl font-bold text-purple-500">{dataLog.length}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Logs</span>
                  <span className="text-[10px] text-slate-400">Sistem</span>
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              {activeTab === 'analytics' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Analytics & Logs</h3>
                  <p className="text-sm text-slate-500 mb-6">Pantau aktivitas seluruh sistem secara ringkas. Untuk tampilan detail, gunakan versi desktop.</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => setActiveTab('sekolah')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-500">account_balance</span>
                        </div>
                        <span className="font-bold text-sm">Sekolah</span>
                     </button>
                     <button onClick={() => setActiveTab('admin')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-blue-500">manage_accounts</span>
                        </div>
                        <span className="font-bold text-sm">Admin Sekolah</span>
                     </button>
                     <button onClick={() => setActiveTab('pengumuman')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-orange-500">campaign</span>
                        </div>
                        <span className="font-bold text-sm">Pengumuman</span>
                     </button>
                     <button onClick={() => setActiveTab('log')} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-purple-500">memory</span>
                        </div>
                        <span className="font-bold text-sm">System Logs</span>
                     </button>
                  </div>
                </div>
              )}

              {activeTab === 'sekolah' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Sekolah</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataSekolah.length} Sekolah</span>
                  </div>
                  <div className="space-y-3">
                    {dataSekolah.slice(0, 10).map((s) => (
                      <div key={s.npsn} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-slate-500">account_balance</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{s.nama_sekolah}</h4>
                          <p className="text-xs text-slate-500 truncate">NPSN: {s.npsn}</p>
                        </div>
                      </div>
                    ))}
                    {dataSekolah.length > 10 && <div className="text-center text-xs text-slate-500 mt-2">Buka versi desktop untuk melihat semua data.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'admin' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Data Admin</h3>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{dataAdmin.length} Admin</span>
                  </div>
                  <div className="space-y-3">
                    {dataAdmin.slice(0, 10).map((a) => (
                      <div key={a.id_admin} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-slate-500">manage_accounts</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm truncate">{a.nama_lengkap}</h4>
                          <p className="text-xs text-slate-500 truncate">ID: {a.id_admin} | NPSN: {a.npsn}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'pengumuman' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Pengumuman Global</h3>
                  <div className="space-y-3">
                    {dataPengumuman.map((p) => (
                      <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100">
                         <h4 className="font-bold text-sm">{p.judul}</h4>
                         <p className="text-[10px] text-slate-400 mb-2">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                         <p className="text-xs text-slate-600 line-clamp-2">{p.isi}</p>
                      </div>
                    ))}
                    {dataPengumuman.length === 0 && <div className="text-center text-sm text-slate-500">Tidak ada pengumuman.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'log' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">System Logs</h3>
                  <div className="space-y-3">
                    {dataLog.slice(0,10).map((l) => (
                      <div key={l.id_log} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100">
                         <div className="flex justify-between">
                            <span className="text-[10px] font-bold text-slate-500">{l.tipe_user}</span>
                            <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleString('id-ID')}</span>
                         </div>
                         <p className="text-xs mt-1 text-slate-700">{l.aktivitas}</p>
                      </div>
                    ))}
                    {dataLog.length === 0 && <div className="text-center text-sm text-slate-500">Tidak ada log.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center">
                   <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                     <span className="material-symbols-outlined text-4xl text-primary">verified_user</span>
                   </div>
                   <h3 className="font-bold text-xl">{user.nama_lengkap}</h3>
                   <p className="text-slate-500">Developer / SuperAdmin</p>
                   
                   <div className="w-full mt-8 space-y-3">
                      <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-slate-500">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">Mode Gelap</span>
                        </div>
                        <div className={`w-10 h-6 rounded-full flex items-center p-1 ${isDarkMode ? 'bg-primary' : 'bg-slate-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isDarkMode ? 'translate-x-4' : ''}`}></div>
                        </div>
                      </button>
                      <button onClick={onLogout} className="w-full bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex items-center gap-3 shadow-sm text-red-500">
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-bold">Keluar</span>
                      </button>
                   </div>
                </div>
              )}

            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center transition-colors ${activeTab === 'analytics' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">analytics</span>
                <span className="text-[10px] font-bold mt-1">Analytics</span>
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

