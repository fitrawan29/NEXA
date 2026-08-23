    const SuperAdminView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
      const [activeTab, setActiveTab] = useState('sekolah'); // 'sekolah' or 'admin'
      const [dataSekolah, setDataSekolah] = useState([]);
      const [dataAdmin, setDataAdmin] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      
      const [formModal, setFormModal] = useState({ isOpen: false, type: '' });

      const fetchData = async (tab) => {
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
        if (formModal.type === 'sekolah') endpoint = 'create_sekolah';
        else if (formModal.type === 'admin') endpoint = 'create_admin_sekolah';

        const res = await fetchAPI(endpoint, payload);
        if (res.status === 'success') {
          setFormModal({ isOpen: false, type: '' });
          fetchData(activeTab);
        } else {
          alert(res.message);
        }
      };

      const handleDelete = async (type, item) => {
        if (!confirm(`Hapus data ini secara permanen?`)) return;
        let endpoint = type === 'sekolah' ? 'delete_sekolah' : 'delete_admin_sekolah';
        let payload = type === 'sekolah' ? { npsn: item.npsn } : { id_admin: item.id_admin };
        
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
                Tambah {type === 'sekolah' ? 'Sekolah' : 'Admin'}
              </h2>
              <form onSubmit={handleSaveForm} className="space-y-4">
                {type === 'sekolah' && (
                  <>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">NPSN</label><input name="npsn" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Sekolah</label><input name="nama_sekolah" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                  </>
                )}
                {type === 'admin' && (
                  <>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Lengkap</label><input name="nama_lengkap" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Username</label><input name="username" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password</label><input name="password" type="password" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Sekolah (NPSN)</label>
                      <select name="npsn" required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        <option value="">-- Pilih Sekolah --</option>
                        {dataSekolah.map(s => <option key={s.npsn} value={s.npsn}>{s.npsn} - {s.nama_sekolah}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setFormModal({ isOpen: false, type: '' })} className="px-4 py-2 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-variant">Batal</button>
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
              <a onClick={() => setActiveTab('sekolah')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'sekolah' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">account_balance</span><span>Data Sekolah</span>
              </a>
              <a onClick={() => setActiveTab('admin')} className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold cursor-pointer transition-colors ${activeTab === 'admin' ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined">shield_person</span><span>Data Admin Sekolah</span>
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
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white capitalize">Kelola {activeTab}</h2>
              <button onClick={() => setFormModal({ isOpen: true, type: activeTab })} className="bg-primary text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-primary/90 hover:scale-105 transition-all flex items-center gap-2">
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
                          <button onClick={() => handleDelete('admin', a)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && activeTab === 'admin' && dataAdmin.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada admin terdaftar.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            {renderFormModal()}
          </main>
        </div>
      );
    };
