    const SuperAdminView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
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
        <div className="bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 antialiased flex min-h-screen">
          <nav className="bg-surface-container-low dark:bg-slate-900 w-64 border-r dark:border-slate-800 flex flex-col p-4 z-40 shadow-lg">
            <div className="flex items-center space-x-sm mb-lg">
              <h1 className="font-headline-sm font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined">admin_panel_settings</span> SUPER ADMIN</h1>
            </div>
            <div className="flex-1 space-y-2 mt-4">
              <a onClick={() => setActiveTab('analytics')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'analytics' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">monitoring</span><span>Dasbor Analitik</span>
              </a>
              <a onClick={() => setActiveTab('sekolah')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'sekolah' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">account_balance</span><span>Data Sekolah</span>
              </a>
              <a onClick={() => setActiveTab('admin')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'admin' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">shield_person</span><span>Data Admin Sekolah</span>
              </a>
              <a onClick={() => setActiveTab('pengumuman')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'pengumuman' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">campaign</span><span>Pengumuman Global</span>
              </a>
              <a onClick={() => setActiveTab('log')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'log' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">list_alt</span><span>Log Aktivitas</span>
              </a>
              <a onClick={() => setActiveTab('profil')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'profil' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">manage_accounts</span><span>Profil / Password</span>
              </a>
            </div>
            <div className="mt-auto space-y-2">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full text-left px-4 py-2 rounded-lg hover:bg-surface-variant dark:hover:bg-slate-800 flex items-center space-x-2">
                <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button onClick={onLogout} className="w-full text-left px-4 py-2 rounded-lg hover:bg-error-container hover:text-on-error-container text-error flex items-center space-x-2">
                <span className="material-symbols-outlined">logout</span><span>Keluar</span>
              </button>
            </div>
          </nav>

          <main className="flex-1 p-8 h-screen overflow-y-auto">
            {activeTab === 'analytics' && (
              <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Dasbor Analitik Resource</h2>
                {isLoading ? <div className="flex justify-center p-12"><span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span></div> : (
                  <>
                  <div className="mb-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xl text-slate-800 dark:text-white">Pengguna Aktif Saat Ini (Semua Sekolah)</h3>
                      <p className="text-sm text-slate-500">Siswa yang sedang dalam status SEDANG KERJA ujian</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-5xl font-black text-primary">{dataAnalytics.concurrentUsers || 0}</span>
                      <span className="material-symbols-outlined text-4xl text-emerald-500 animate-pulse">wifi_tethering</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(dataAnalytics.stats || []).map(stat => (
                      <div key={stat.npsn} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white">{stat.nama_sekolah}</h3>
                            <p className="text-sm font-mono text-slate-500">NPSN: {stat.npsn}</p>
                          </div>
                          <span className="material-symbols-outlined text-primary text-3xl">domain</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Siswa Aktif</span>
                            <span className="font-bold text-primary">{stat.total_siswa}</span>
                          </div>
                          <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Guru Aktif</span>
                            <span className="font-bold text-primary">{stat.total_guru}</span>
                          </div>
                          <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Total Soal</span>
                            <span className="font-bold text-primary">{stat.total_soal}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(dataAnalytics.stats || []).length === 0 && <div className="col-span-full p-8 text-center text-slate-500">Belum ada data sekolah.</div>}
                  </div>
                  </>
                )}
              </div>
            )}

            {(activeTab === 'sekolah' || activeTab === 'admin') && (
              <>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white capitalize">Kelola {activeTab}</h2>
                  <button onClick={() => setFormModal({ isOpen: true, type: activeTab, isEdit: false, editItem: null })} className="bg-primary text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-primary/90 hover:scale-105 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined">add</span> Tambah {activeTab === 'sekolah' ? 'Sekolah' : 'Admin'}
                  </button>
                </div>


            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                    {activeTab === 'sekolah' ? (
                      <tr><th className="p-4 font-bold text-slate-600 dark:text-slate-300">NPSN</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300">Nama Sekolah</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-right">Aksi</th></tr>
                    ) : (
                      <tr><th className="p-4 font-bold text-slate-600 dark:text-slate-300">Nama Admin</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300">Username</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300">Sekolah</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-right">Aksi</th></tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {isLoading ? <tr><td colSpan="4" className="p-8 text-center"><span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span></td></tr> : null}
                    
                    {!isLoading && activeTab === 'sekolah' && dataSekolah.map(s => (
                      <tr key={s.npsn} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-4 font-mono font-medium text-slate-700 dark:text-slate-300">{s.npsn}</td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{s.nama_sekolah}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleEdit('sekolah', s)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                          <button onClick={() => handleDelete('sekolah', s)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && activeTab === 'sekolah' && dataSekolah.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-500">Belum ada sekolah terdaftar.</td></tr>}

                    {!isLoading && activeTab === 'admin' && dataAdmin.map(a => (
                      <tr key={a.id_admin} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{a.nama_lengkap}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm">{a.username}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.sekolah?.nama_sekolah} (NPSN: {a.npsn})</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleEdit('admin', a)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                          <button onClick={() => handleDelete('admin', a)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && activeTab === 'admin' && dataAdmin.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada admin terdaftar.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            </>
            )}

            {activeTab === 'pengumuman' && (
              <>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white capitalize">Pengumuman Global</h2>
                  <button onClick={() => setFormModal({ isOpen: true, type: 'pengumuman', isEdit: false, editItem: null })} className="bg-primary text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-primary/90 hover:scale-105 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined">add</span> Buat Pengumuman
                  </button>
                </div>
                <div className="space-y-4">
                  {isLoading ? <div className="flex justify-center p-12"><span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span></div> : null}
                  {!isLoading && dataPengumuman.map(p => (
                    <div key={p.id_pengumuman} className={`p-6 rounded-2xl border-l-4 shadow-sm bg-white dark:bg-slate-800 relative ${p.tipe === 'warning' ? 'border-amber-500' : p.tipe === 'success' ? 'border-emerald-500' : 'border-blue-500'}`}>
                      <button onClick={() => handleDelete('pengumuman', p)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-500/10 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                      <h3 className="font-bold text-lg mb-1">{p.judul}</h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">{p.isi}</p>
                      <span className="text-xs text-slate-400 font-mono">{new Date(p.created_at).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                  {!isLoading && dataPengumuman.length === 0 && <div className="p-8 text-center text-slate-500">Belum ada pengumuman global.</div>}
                </div>
              </>
            )}

            {activeTab === 'log' && (
              <>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Log Aktivitas Global</h2>
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                        <tr><th className="p-4 font-bold text-slate-600 dark:text-slate-300">Waktu</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300">User / Role</th><th className="p-4 font-bold text-slate-600 dark:text-slate-300">Aksi</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {isLoading ? <tr><td colSpan="3" className="p-8 text-center"><span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span></td></tr> : null}
                        {!isLoading && dataLog.map(l => (
                          <tr key={l.id_log} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="p-4 text-xs font-mono text-slate-500">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                            <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{l.username} <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-[10px] font-mono font-normal ml-2">{l.role}</span></td>
                            <td className="p-4 text-slate-600 dark:text-slate-300 text-sm">{l.action}: {l.detail}</td>
                          </tr>
                        ))}
                        {!isLoading && dataLog.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-500">Belum ada log.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            
            {activeTab === 'profil' && (
              <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Profil / Password</h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-lg">
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.target);
                      const payload = Object.fromEntries(fd.entries());
                      if (payload.password !== payload.password_confirm) {
                          alert("Password tidak cocok!");
                          return;
                      }
                      const res = await fetchAPI('update_superadmin_password', { username: user?.username, password: payload.password });
                      alert(res.message);
                      if (res.status === 'success') e.target.reset();
                  }}>
                      <div className="mb-4">
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">Username Super Admin</label>
                          <input type="text" readOnly value={user?.username || ''} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800" />
                      </div>
                      <div className="mb-4">
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">Password Baru</label>
                          <input type="password" name="password" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                      </div>
                      <div className="mb-6">
                          <label className="block text-sm font-medium mb-1 dark:text-slate-300">Konfirmasi Password Baru</label>
                          <input type="password" name="password_confirm" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                      </div>
                      <button type="submit" className="px-6 py-2 rounded-lg font-bold bg-primary text-white hover:bg-primary/90">Simpan Perubahan</button>
                  </form>
                </div>
              </div>
            )}
            {renderFormModal()}
          </main>
        </div>
      );
    };
