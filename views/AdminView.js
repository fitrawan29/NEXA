    const AdminView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [activeTab, setActiveTab] = useState('dashboard');
      const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Toggle Sidebar

      const [dashboardData, setDashboardData] = useState(null);
      const [dataSiswa, setDataSiswa] = useState([]);
      const [dataGuru, setDataGuru] = useState([]);
      const [dataJadwal, setDataJadwal] = useState([]);
      const [dataMapel, setDataMapel] = useState([]);
      const [dataKelas, setDataKelas] = useState([]);
      const [dataLog, setDataLog] = useState([]); // monitoring / hasil
      const [isLoading, setIsLoading] = useState(true);
      const [hasNotification, setHasNotification] = useState(false);

      const [selectedKelas, setSelectedKelas] = useState(null); // Filter kelas
      const [selectedJadwal, setSelectedJadwal] = useState(null); // Filter monitoring/hasil

      // Modal State
      const [formModal, setFormModal] = useState({ isOpen: false, type: '', data: null });
      const [profileModalOpen, setProfileModalOpen] = useState(false);

      const fetchData = async (tab) => {
        setIsLoading(true);
        if (tab === 'dashboard') {
          const res = await api('get_admin_dashboard_data', {});
          if (res.status === 'success') setDashboardData(res.data);
        } else if (tab === 'siswa' || tab === 'kelas') {
          const res = await api('get_siswa', {});
          if (res.status === 'success') setDataSiswa(res.data);
          const resK = await api('get_kelas', {});
          if (resK.status === 'success') setDataKelas(resK.data);
        } else if (tab === 'guru') {
          const res = await api('get_guru', {});
          if (res.status === 'success') setDataGuru(res.data);
        } else if (tab === 'mapel') {
          const res = await api('get_all_mapel', {});
          if (res.status === 'success') setDataMapel(res.data);
        } else if (tab === 'jadwal' || tab === 'monitoring' || tab === 'hasil') {
          const res = await api('get_all_jadwal', {});
          if (res.status === 'success') setDataJadwal(res.data);

          if (selectedJadwal) {
            const endpoint = tab === 'hasil' ? 'get_hasil_ujian' : 'monitoring_ujian';
            const logRes = await api(endpoint, { id_jadwal: selectedJadwal });
            if (logRes.status === 'success') setDataLog(logRes.data);
          } else {
            setDataLog([]);
          }
        }
        setIsLoading(false);
      };

      useEffect(() => {
        fetchData(activeTab);
      }, [activeTab, selectedJadwal]);

      const handleDelete = async (id, type) => {
        if (!confirm(`Hapus data ${type} ini?`)) return;
        let endpoint = `delete_${type}`;
        let payload = {};
        payload[`id_${type}`] = id;

        const res = await api(endpoint, payload);
        if (res.status === 'success') fetchData(activeTab);
        else alert(res.message);
      };

      const handleSaveForm = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        let payload = Object.fromEntries(formData.entries());
        const isEdit = formModal.data != null;

        let endpoint = `create_${formModal.type}`;
        if (isEdit) endpoint = `update_${formModal.type}`;

        if (isEdit && payload.password === '') {
          delete payload.password;
        }

        // Handle Guru mapels checkbox
        if (formModal.type === 'guru') {
          payload.mapels = formData.getAll('mapels');
        }

        // Handle Siswa kelas_gabungan
        if (formModal.type === 'siswa' && payload.kelas_gabungan) {
          const [t, p] = payload.kelas_gabungan.split('|');
          payload.angkatan = t;
          payload.kelas_paralel = p;
          delete payload.kelas_gabungan;
        }

        const res = await api(endpoint, payload);
        if (res.status === 'success') {
          setFormModal({ isOpen: false, type: '', data: null });
          fetchData(activeTab);
        } else {
          alert(res.message);
        }
      };

      const openCreateModal = async (type) => {
        if (type === 'guru' || type === 'jadwal') {
          const res = await api('get_all_mapel', {});
          if (res.status === 'success') setDataMapel(res.data);
          if (type === 'jadwal') {
            const resG = await api('get_guru', {});
            if (resG.status === 'success') setDataGuru(resG.data);
          }
        }
        setFormModal({ isOpen: true, type, data: null });
      };

      const openEditModal = async (type, item) => {
        if (type === 'guru' || type === 'jadwal') {
          const res = await api('get_all_mapel', {});
          if (res.status === 'success') setDataMapel(res.data);
          if (type === 'jadwal') {
            const resG = await api('get_guru', {});
            if (resG.status === 'success') setDataGuru(resG.data);
          }
        }
        setFormModal({ isOpen: true, type, data: item });
      };

      const handleBlock = async (idLog) => {
        if (!confirm('Blokir siswa ini?')) return;
        await api('catat_pelanggaran', { id_log: idLog });
        fetchData(activeTab);
      };

      const handleUnblock = async (idLog) => {
        if (!confirm('Buka blokir siswa ini?')) return;
        await api('buka_blokir', { id_log: idLog });
        fetchData(activeTab);
      };

      const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            if (data.length === 0) return alert('File kosong atau format salah.');
            
            let endpoint = `create_${type}_bulk`;
            
            // Format check (id fields are now auto-generated if missing)
            // if (type === 'siswa' && !data[0].id_siswa) return alert('Format salah. Pastikan ada kolom id_siswa.');
            // if (type === 'guru' && !data[0].id_guru) return alert('Format salah. Pastikan ada kolom id_guru.');
            // if (type === 'mapel' && !data[0].id_mapel) return alert('Format salah. Pastikan ada kolom id_mapel.');
            // if (type === 'jadwal' && !data[0].id_jadwal) return alert('Format salah. Pastikan ada kolom id_jadwal.');


            const res = await api(endpoint, data);
            if (res.status === 'success') {
              alert(`Berhasil menambahkan ${data.length} data ${type}.`);
              fetchData(activeTab);
            } else {
              alert(`Gagal: ${res.message}`);
            }
          } catch (error) {
            console.error(error);
            alert('Gagal memproses file. Pastikan format file sesuai (.xlsx/.csv).');
          }
          e.target.value = null; // Reset input
        };
        reader.readAsBinaryString(file);
      };

      const downloadTemplate = (type) => {
        let sampleData = [];
        let fileName = `Template_Data_${type}.xlsx`;
        
        if (type === 'siswa') {
          sampleData = [{ id_siswa: 'S-001', nama_lengkap: 'Nama Contoh', username: 'siswa01', password: 'password123', angkatan: 'X', kelas_paralel: 'A' }];
        } else if (type === 'guru') {
          sampleData = [{ id_guru: 'G-001', nama_lengkap: 'Guru Contoh', username: 'guru01', password: 'password123' }];
        } else if (type === 'mapel') {
          sampleData = [{ id_mapel: 'M-001', nama_mapel: 'Matematika' }];
        } else if (type === 'jadwal') {
          sampleData = [{ id_jadwal: 'J-001', id_mapel: 'M-001', id_guru: 'G-001', waktu_mulai: '2026-08-25T07:00:00', waktu_selesai: '2026-08-25T09:00:00' }];
        }

        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, fileName);
      };

      const exportToExcel = () => {
        if (!dataLog || dataLog.length === 0) return alert('Tidak ada data untuk di-export');
        const exportData = dataLog.map((l, i) => ({
          'No': i + 1,
          'ID Siswa': l.id_siswa,
          'Nama Siswa': l.nama_lengkap,
          'Tingkat': l.angkatan,
          'Paralel': l.kelas_paralel,
          'Waktu Login': new Date(l.waktu_login).toLocaleString('id-ID'),
          'Nilai Pilihan Ganda': l.nilai_auto,
          'Nilai Uraian': l.nilai_uraian,
          'Total Nilai': l.total_nilai
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Ujian");
        XLSX.writeFile(workbook, `Hasil_Ujian_${selectedJadwal}.xlsx`);
      };

      const exportDataToExcel = (type) => {
        let exportData = [];
        let fileName = '';
        if (type === 'siswa') {
          if (!dataSiswa || dataSiswa.length === 0) return alert('Tidak ada data siswa untuk di-export');
          exportData = dataSiswa.map((s, i) => ({
            'No': i + 1,
            'ID Siswa': s.id_siswa,
            'Nama Lengkap': s.nama_lengkap,
            'Username': s.username,
            'Tingkat': s.angkatan,
            'Kelas Paralel': s.kelas_paralel,
          }));
          fileName = 'Data_Siswa.xlsx';
        } else if (type === 'guru') {
          if (!dataGuru || dataGuru.length === 0) return alert('Tidak ada data guru untuk di-export');
          exportData = dataGuru.map((g, i) => ({
            'No': i + 1,
            'ID Guru': g.id_guru,
            'Nama Lengkap': g.nama_lengkap,
            'Username': g.username,
            'Mata Pelajaran': g.mapels_list || '-',
          }));
          fileName = 'Data_Guru.xlsx';
        }
        
        if (exportData.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, `Data ${type}`);
          XLSX.writeFile(workbook, fileName);
        }
      };

      // Kelompokkan siswa berdasarkan Angkatan & Paralel
      const groupedClasses = React.useMemo(() => {
        const groups = {};
        dataSiswa.forEach(s => {
          const key = `${s.angkatan || '-'} ${s.kelas_paralel || '-'}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        return groups;
      }, [dataSiswa]);

      const [autoUsername, setAutoUsername] = useState('');

      useEffect(() => {
        if (formModal.isOpen && formModal.data) {
          setAutoUsername(formModal.data.username || '');
        } else if (formModal.isOpen) {
          setAutoUsername('');
        }
      }, [formModal.isOpen, formModal.data]);

      const handleAutoUsernameSiswa = () => {
        const nama = document.getElementById('input_nama_siswa')?.value || '';
        const kelas = document.getElementById('input_kelas_siswa')?.value || '';
        if (!nama || !kelas) return;
        const [t, p] = kelas.split('|');
        const u = `${nama.split(' ')[0].toLowerCase()}_${t.toLowerCase()}_${p.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
        setAutoUsername(u);
      };

      const handleAutoUsernameGuru = () => {
        const nama = document.getElementById('input_nama_guru')?.value || '';
        const mapelEls = document.querySelectorAll('input[name="mapels"]:checked');
        if (!nama || mapelEls.length === 0) return;
        const mapelId = mapelEls[0].value;
        const mapelObj = dataMapel.find(m => m.id_mapel === mapelId);
        if (!mapelObj) return;
        const mapelName = mapelObj.nama_mapel.split(' ')[0].toLowerCase();
        const u = `${nama.split(' ')[0].toLowerCase()}_${mapelName}`;
        setAutoUsername(u);
      };

      const renderFormModal = () => {
        if (!formModal.isOpen) return null;
        const { type, data } = formModal;
        const isEdit = data != null;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-on-surface dark:text-white capitalize">
                {isEdit ? 'Edit Data' : 'Tambah Data'} {type}
              </h2>
              <form onSubmit={handleSaveForm} className="space-y-4">
                {type === 'kelas' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Kelas</label><input name="id_kelas" defaultValue={data?.id_kelas || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Tingkat (Contoh: X, 10, dll)</label><input name="tingkat" defaultValue={data?.tingkat || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Kelas Paralel (Contoh: IPA 1, A, dll)</label><input name="kelas_paralel" defaultValue={data?.kelas_paralel || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                  </>
                )}
                {type === 'mapel' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Mapel</label><input name="id_mapel" defaultValue={data?.id_mapel || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Mapel</label><input name="nama_mapel" defaultValue={data?.nama_mapel || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                  </>
                )}

                {type === 'siswa' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Siswa</label><input name="id_siswa" defaultValue={data?.id_siswa || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Lengkap</label><input id="input_nama_siswa" name="nama_lengkap" defaultValue={data?.nama_lengkap || ''} onChange={handleAutoUsernameSiswa} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Username</label><input name="username" value={autoUsername} onChange={(e) => setAutoUsername(e.target.value)} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password {isEdit && '(Kosongkan jika tidak diubah)'}</label><input name="password" type="password" required={!isEdit} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Kelas</label>
                      <select id="input_kelas_siswa" name="kelas_gabungan" defaultValue={data ? `${data.angkatan}|${data.kelas_paralel}` : ''} onChange={handleAutoUsernameSiswa} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        <option value="">Pilih Kelas</option>
                        {dataKelas.map(k => <option key={k.id_kelas} value={`${k.tingkat}|${k.kelas_paralel}`}>{k.tingkat} {k.kelas_paralel}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {type === 'guru' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Guru</label><input name="id_guru" defaultValue={data?.id_guru || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Nama Lengkap</label><input id="input_nama_guru" name="nama_lengkap" defaultValue={data?.nama_lengkap || ''} onChange={handleAutoUsernameGuru} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Username</label><input name="username" value={autoUsername} onChange={(e) => setAutoUsername(e.target.value)} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password {isEdit && '(Kosongkan jika tidak diubah)'}</label><input name="password" type="password" required={!isEdit} className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-slate-300">Mata Pelajaran (Bisa Pilih Lebih dari 1)</label>
                      <div className="max-h-40 overflow-y-auto border border-outline-variant dark:border-slate-600 rounded-md p-2 space-y-1">
                        {dataMapel.map(m => (
                          <label key={m.id_mapel} className="flex items-center space-x-2 text-sm text-on-surface dark:text-slate-300">
                            <input type="checkbox" name="mapels" value={m.id_mapel} defaultChecked={data?.id_mapels?.includes(m.id_mapel)} onChange={handleAutoUsernameGuru} className="rounded text-primary focus:ring-primary" />
                            <span>{m.nama_mapel}</span>
                          </label>
                        ))}
                        {dataMapel.length === 0 && <span className="text-xs text-slate-500">Belum ada mapel, silakan tambahkan di menu mapel.</span>}
                      </div>
                    </div>
                  </>
                )}

                {type === 'jadwal' && (
                  <>
                    {isEdit && <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">ID Ujian (Jadwal)</label><input name="id_jadwal" defaultValue={data?.id_jadwal || ''} readOnly={isEdit} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 bg-slate-100" /></div>}
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Mata Pelajaran</label><select name="id_mapel" defaultValue={data?.id_mapel || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option value="">Pilih Mapel</option>{dataMapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Guru Pengawas</label><select name="id_guru" defaultValue={data?.id_guru || ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option value="">Pilih Guru</option>{dataGuru.map(g => <option key={g.id_guru} value={g.id_guru}>{g.nama_lengkap}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Waktu Mulai</label><input type="datetime-local" name="waktu_mulai" defaultValue={data?.waktu_mulai ? new Date(data.waktu_mulai).toISOString().slice(0, 16) : ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                      <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Waktu Selesai</label><input type="datetime-local" name="waktu_selesai" defaultValue={data?.waktu_selesai ? new Date(data.waktu_selesai).toISOString().slice(0, 16) : ''} required className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => setFormModal({ isOpen: false, type: '', data: null })} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600">Batal</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        );
      };

      const renderProfileModal = () => {
        if (!profileModalOpen) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700">
              <h2 className="text-xl font-bold mb-4 text-on-surface dark:text-white">Profil Admin</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const payload = Object.fromEntries(fd.entries());
                if (payload.password && payload.password !== payload.password_confirm) {
                  return alert('Password tidak cocok!');
                }
                const res = await api('update_admin_profil', { id_admin: user.id_admin, password: payload.password, foto_profil: payload.foto_profil });
                if (res.status === 'success') {
                  alert(res.message);
                  setProfileModalOpen(false);
                  onLogout(); // Force logout to reflect changes
                } else {
                  alert(res.message);
                }
              }} className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  {user.foto_profil ? (
                    <img src={user.foto_profil} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-primary/20" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl">{user.nama_lengkap.charAt(0)}</div>
                  )}
                </div>
                <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">URL Foto Profil</label><input name="foto_profil" defaultValue={user.foto_profil || ''} placeholder="https://..." className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Password Baru (Kosongkan jika tidak diubah)</label><input name="password" type="password" className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Konfirmasi Password</label><input name="password_confirm" type="password" className="w-full rounded-md border p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setProfileModalOpen(false)} className="px-4 py-2 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-variant">Batal</button>
                  <button type="submit" className="px-4 py-2 rounded-lg font-label-md bg-primary text-on-primary hover:bg-primary/90">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        );
      };

      const SidebarLink = ({ id, icon, label }) => (
        <a onClick={(e) => { e.preventDefault(); setActiveTab(id); setIsSidebarOpen(false); }} className={`flex items-center space-x-sm px-md py-sm rounded-lg font-label-md text-label-md duration-200 ease-in-out cursor-pointer ${activeTab === id ? 'bg-primary-container dark:bg-primary/20 text-on-primary-container dark:text-primary-fixed shadow-sm' : 'text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-highest dark:hover:bg-slate-800 transition-colors'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          <span>{label}</span>
        </a>
      );

      return (
        <div className="bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 antialiased flex min-h-screen transition-colors duration-500">

          {/* Mobile Overlay */}
          {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

          {/* SideNavBar */}
          <nav className={`bg-surface-container-low dark:bg-slate-900 text-primary docked left-0 h-full w-64 border-r border-outline-variant dark:border-slate-800 flat fixed top-0 flex flex-col p-md z-40 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            {/* Header */}
            <div className="flex items-center space-x-sm mb-lg px-sm">
              <img alt="NEXA Logo" className="w-10 h-10 rounded-full object-cover shadow-sm" src="stitch_assets/screen_3_logo.png" />
              <div>
                <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface dark:text-white">NEXA</h1>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Admin Panel</p>
              </div>
            </div>
            {/* Navigation Links */}
            <div className="flex-1 space-y-2 mt-4">
              <SidebarLink id="dashboard" icon="dashboard" label="Dashboard" />
              <SidebarLink id="kelas" icon="meeting_room" label="Data Kelas" />
              <SidebarLink id="siswa" icon="group" label="Data Siswa" />
              <SidebarLink id="guru" icon="school" label="Data Guru" />
              <SidebarLink id="mapel" icon="menu_book" label="Mata Pelajaran" />
              <SidebarLink id="jadwal" icon="calendar_today" label="Kelola Jadwal" />
              <SidebarLink id="monitoring" icon="monitor" label="Pantau Ujian" />
              <SidebarLink id="hasil" icon="assignment_turned_in" label="Hasil Ujian" />
            </div>
          </nav>

          {/* Main Content Area */}
          <main className="flex-1 md:ml-64 w-full transition-all duration-500 min-h-screen flex flex-col">
            
            {/* Top Bar for User Actions */}
            <div className="w-full flex justify-end items-center p-4 border-b border-outline-variant dark:border-slate-800 bg-surface dark:bg-slate-900 sticky top-0 z-20 gap-2">
                 <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-800 transition-colors" title="Mode Tema">
                   <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                 </button>

                 <button onClick={() => setActiveTab('pemberitahuan')} className="relative p-2 rounded-full text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-800 transition-colors" title="Pemberitahuan">
                   <span className="material-symbols-outlined">notifications</span>
                   {hasNotification && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>}
                 </button>
                 
                 <div onClick={() => setProfileModalOpen(true)} className="flex items-center space-x-2 cursor-pointer p-1 pr-3 rounded-full hover:bg-surface-variant dark:hover:bg-slate-800 transition-colors" title="Profil Admin">
                   {user.foto_profil ? (
                     <img src={user.foto_profil} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{user.nama_lengkap.charAt(0)}</div>
                   )}
                   <div className="hidden sm:block text-left">
                     <p className="text-sm font-medium text-on-surface dark:text-white leading-tight">{user.nama_lengkap}</p>
                     <p className="text-xs text-on-surface-variant dark:text-slate-400 capitalize">{user.role}</p>
                   </div>
                 </div>

                 <button onClick={onLogout} className="flex items-center space-x-1 p-2 rounded-lg text-error hover:bg-error/10 transition-colors" title="Keluar">
                   <span className="material-symbols-outlined">logout</span>
                 </button>
            </div>

            <div className="p-lg sm:p-xl md:p-gutter flex-1">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-xl gap-md">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-surface-variant/50 rounded-lg text-on-surface dark:text-white">
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <div>
                  <h2 className="font-display-sm text-display-sm text-on-surface dark:text-white capitalize font-semibold mb-1">
                    {activeTab === 'dashboard' ? 'Beranda' : activeTab === 'pemberitahuan' ? 'Pemberitahuan' : activeTab === 'kelas' ? 'Data Kelas' : activeTab === 'siswa' ? 'Data Siswa' : activeTab === 'guru' ? 'Data Guru' : activeTab === 'mapel' ? 'Mata Pelajaran' : activeTab === 'jadwal' ? 'Kelola Jadwal' : activeTab === 'monitoring' ? 'Monitoring Ujian' : 'Hasil Ujian'}
                  </h2>
                  <p className="text-body-md text-on-surface-variant dark:text-slate-400">Panel Manajemen Admin.</p>
                </div>
              </div>

              {['kelas', 'siswa', 'guru', 'mapel', 'jadwal'].includes(activeTab) && (
                <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
                  {activeTab !== 'kelas' && (
                    <>
                      {(activeTab === 'siswa' || activeTab === 'guru') && (
                        <button onClick={() => exportDataToExcel(activeTab)} className="bg-surface-container-highest dark:bg-slate-700 text-on-surface-variant dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 px-md py-sm rounded-full font-label-md shadow-sm transition-all flex items-center justify-center gap-sm hover:-translate-y-0.5 whitespace-nowrap">
                          <span className="material-symbols-outlined text-[20px]">file_download</span>
                          Download Data
                        </button>
                      )}
                      <button onClick={() => downloadTemplate(activeTab)} className="bg-surface-container-highest dark:bg-slate-700 text-on-surface-variant dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 px-md py-sm rounded-full font-label-md shadow-sm transition-all flex items-center justify-center gap-sm hover:-translate-y-0.5 whitespace-nowrap">
                        <span className="material-symbols-outlined text-[20px]">download</span>
                        Template
                      </button>
                      <button onClick={() => document.getElementById('file-upload').click()} className="bg-[#10B981] text-white hover:bg-[#059669] px-md py-sm rounded-full font-label-md shadow-sm transition-all flex items-center justify-center gap-sm hover:-translate-y-0.5 whitespace-nowrap">
                        <span className="material-symbols-outlined text-[20px]">upload_file</span>
                        Upload Excel
                      </button>
                      <input type="file" id="file-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, activeTab)} />
                    </>
                  )}
                  <button onClick={() => openCreateModal(activeTab)} className="bg-primary text-on-primary hover:bg-primary/90 px-md py-sm rounded-full font-label-md shadow-sm transition-all flex items-center justify-center gap-sm hover:-translate-y-0.5 whitespace-nowrap">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Tambah {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  </button>
                </div>
              )}
            </header>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-xl animate-fade-in-up">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                  {[
                    { label: 'Total Siswa', value: dashboardData?.totalSiswa || 0, icon: 'group', color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Total Guru', value: dashboardData?.totalGuru || 0, icon: 'school', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
                    { label: 'Total Ujian', value: dashboardData?.totalJadwal || 0, icon: 'description', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
                    { label: 'Sesi Aktif', value: dashboardData?.totalSesiAktif || 0, icon: 'bolt', color: 'text-error', bg: 'bg-error/10' }
                  ].map((kpi, idx) => (
                    <div key={idx} className="bg-surface dark:bg-slate-800 p-md rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm relative overflow-hidden">
                      <div className="flex items-center gap-md relative z-10">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                          <span className="material-symbols-outlined text-[28px]">{kpi.icon}</span>
                        </div>
                        <div>
                          <p className="text-body-sm text-on-surface-variant dark:text-slate-400 font-medium">{kpi.label}</p>
                          <p className="text-headline-sm font-bold text-on-surface dark:text-white leading-tight">{isLoading ? '...' : kpi.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-md mt-lg">
                  <div className="bg-surface dark:bg-slate-800 p-lg rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-headline-sm text-on-surface dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">info</span> Informasi Aplikasi
                    </h3>
                    <p className="text-body-md text-on-surface-variant dark:text-slate-300 mb-4 leading-relaxed">
                      NEXA adalah platform Computer Based Test (CBT) modern yang dirancang untuk memudahkan pelaksanaan asesmen dan ujian di lingkungan sekolah. Dilengkapi dengan antarmuka dinamis, sistem pengawasan real-time, dan auto-grading.
                    </p>
                    <ul className="space-y-2 text-sm text-on-surface-variant dark:text-slate-400">
                      <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span> Manajemen Data Massal (Siswa, Guru, Mapel, Jadwal)</li>
                      <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span> Pembuatan Token Ujian Dinamis</li>
                      <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span> Auto-grading (Pilihan Ganda)</li>
                    </ul>
                  </div>

                  <div className="bg-surface dark:bg-slate-800 p-lg rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-headline-sm text-on-surface dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">quick_reference_all</span> Panduan Cepat
                    </h3>
                    <ol className="space-y-3 text-sm text-on-surface-variant dark:text-slate-300 list-decimal list-inside">
                      <li><strong>Persiapan Data:</strong> Unduh template, isi, lalu unggah data Siswa, Guru, dan Mapel secara massal.</li>
                      <li><strong>Penjadwalan:</strong> Buat jadwal ujian di menu 'Kelola Jadwal' sesuai mapel dan pengawas.</li>
                      <li><strong>Pengawasan:</strong> Guru pengawas meng-generate token ujian pada menu 'Pantau Ujian' saat hari H.</li>
                      <li><strong>Hasil Evaluasi:</strong> Lihat rekapitulasi nilai pada menu 'Hasil Ujian' setelah ujian selesai.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pemberitahuan' && (
              <div className="animate-fade-in-up">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-6">Pemberitahuan Sistem</h2>
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
                  <div className="flex flex-col items-center justify-center text-center space-y-4 text-slate-500 dark:text-slate-400 py-10">
                    <span className="material-symbols-outlined text-6xl text-primary/50">notifications_active</span>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Belum Ada Pemberitahuan</h3>
                    <p className="max-w-md">Saat ini tidak ada informasi atau pemberitahuan terbaru untuk Admin Sekolah. Semua informasi terkait sistem, pembaruan jadwal ujian, atau laporan sistem akan muncul di sini.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: DATA KELAS */}
            {activeTab === 'kelas' && (
              <div className="animate-fade-in-up">
                {!selectedKelas ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                    {Object.keys(groupedClasses).map(kelasKey => (
                      <div key={kelasKey} onClick={() => setSelectedKelas(kelasKey)} className="bg-surface dark:bg-slate-800 p-lg rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4"><span className="material-symbols-outlined">meeting_room</span></div>
                        <h3 className="text-xl font-bold text-on-surface dark:text-white mb-1">Kelas {kelasKey}</h3>
                        <p className="text-sm text-slate-500">{groupedClasses[kelasKey].length} Siswa</p>
                      </div>
                    ))}
                    {Object.keys(groupedClasses).length === 0 && !isLoading && <p>Belum ada data siswa.</p>}
                  </div>
                ) : (
                  <div>
                    <button onClick={() => setSelectedKelas(null)} className="mb-4 flex items-center gap-2 text-primary hover:underline font-medium"><span className="material-symbols-outlined">arrow_back</span> Kembali ke Daftar Kelas</button>
                    <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 overflow-hidden">
                      <div className="p-4 border-b border-outline-variant dark:border-slate-700 font-bold">Data Siswa: Kelas {selectedKelas}</div>
                      <table className="w-full text-left">
                        <thead className="bg-surface-variant/30 dark:bg-slate-800/80">
                          <tr><th className="p-4">ID</th><th className="p-4">Nama Lengkap</th><th className="p-4">Username</th></tr>
                        </thead>
                        <tbody>
                          {groupedClasses[selectedKelas]?.map(s => (
                            <tr key={s.id_siswa} className="border-t border-outline-variant/30 dark:border-slate-700">
                              <td className="p-4">{s.id_siswa}</td><td className="p-4">{s.nama_lengkap}</td><td className="p-4">{s.username}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: TABEL CRUD STANDARD */}
            {['kelas', 'siswa', 'guru', 'mapel', 'jadwal'].includes(activeTab) && (
              <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm overflow-hidden animate-fade-in-up overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-surface-variant/30 dark:bg-slate-800/80">
                    <tr>
                      {activeTab === 'kelas' && (<><th className="py-md px-md text-label-md font-semibold text-on-surface-variant dark:text-slate-400">Tingkat</th><th className="py-md px-md font-semibold">Paralel</th></>)}
                      {activeTab === 'siswa' && (<><th className="py-md px-md text-label-md font-semibold text-on-surface-variant dark:text-slate-400">ID Siswa</th><th className="py-md px-md font-semibold">Nama Lengkap</th><th className="py-md px-md font-semibold">Username</th><th className="py-md px-md font-semibold">Tingkat</th><th className="py-md px-md font-semibold">Paralel</th></>)}
                      {activeTab === 'guru' && (<><th className="py-md px-md text-label-md font-semibold text-on-surface-variant dark:text-slate-400">ID Guru</th><th className="py-md px-md font-semibold">Nama Lengkap</th><th className="py-md px-md font-semibold">Username</th><th className="py-md px-md font-semibold">Mata Pelajaran</th></>)}
                      {activeTab === 'mapel' && (<><th className="py-md px-md text-label-md font-semibold text-on-surface-variant dark:text-slate-400">ID Mapel</th><th className="py-md px-md font-semibold">Nama Mapel</th></>)}
                      {activeTab === 'jadwal' && (<><th className="py-md px-md text-label-md font-semibold text-on-surface-variant dark:text-slate-400">ID Ujian</th><th className="py-md px-md font-semibold">Mapel</th><th className="py-md px-md font-semibold">Guru</th><th className="py-md px-md font-semibold">Waktu</th></>)}
                      <th className="py-md px-md text-label-md font-semibold text-on-surface-variant dark:text-slate-400 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md divide-y divide-outline-variant/30 dark:divide-slate-700">
                    {isLoading ? (<tr><td colSpan="6" className="py-xl text-center">Memuat data...</td></tr>) : (
                      (activeTab === 'kelas' ? dataKelas : activeTab === 'siswa' ? dataSiswa : activeTab === 'guru' ? dataGuru : activeTab === 'mapel' ? dataMapel : dataJadwal).length > 0 ? (
                        (activeTab === 'kelas' ? dataKelas : activeTab === 'siswa' ? dataSiswa : activeTab === 'guru' ? dataGuru : activeTab === 'mapel' ? dataMapel : dataJadwal).map((row) => (
                          <tr key={row.id_kelas || row.id_jadwal || row.id_siswa || row.id_guru || row.id_mapel} className="hover:bg-surface-variant/20 dark:hover:bg-slate-800/50">
                            {activeTab === 'kelas' && (<><td className="p-4">{row.tingkat}</td><td className="p-4">{row.kelas_paralel}</td></>)}
                            {activeTab === 'siswa' && (<><td className="p-4">{row.id_siswa}</td><td className="p-4">{row.nama_lengkap}</td><td className="p-4">{row.username}</td><td className="p-4">{row.angkatan}</td><td className="p-4">{row.kelas_paralel}</td></>)}
                            {activeTab === 'guru' && (<><td className="p-4">{row.id_guru}</td><td className="p-4">{row.nama_lengkap}</td><td className="p-4">{row.username}</td><td className="p-4 text-xs max-w-xs truncate">{row.mapels_list}</td></>)}
                            {activeTab === 'mapel' && (<><td className="p-4">{row.id_mapel}</td><td className="p-4">{row.nama_mapel}</td></>)}
                            {activeTab === 'jadwal' && (<><td className="p-4">{row.id_jadwal}</td><td className="p-4">{row.nama_mapel}</td><td className="p-4">{row.guru}</td><td className="p-4 text-sm">{new Date(row.waktu_mulai).toLocaleString('id-ID')} s.d {new Date(row.waktu_selesai).toLocaleString('id-ID')}</td></>)}
                            <td className="p-4 text-right">
                              <button onClick={() => openEditModal(activeTab, row)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded mr-2"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                              <button onClick={() => handleDelete(row.id_kelas || row.id_jadwal || row.id_siswa || row.id_guru || row.id_mapel, activeTab)} className="p-1.5 text-error hover:bg-error/20 rounded"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                            </td>
                          </tr>
                        ))
                      ) : (<tr><td colSpan="6" className="py-xl text-center">Data kosong.</td></tr>)
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: MONITORING & HASIL */}
            {['monitoring', 'hasil'].includes(activeTab) && (
              <div className="animate-fade-in-up">
                <div className="flex gap-4 mb-6">
                  <select onChange={(e) => setSelectedJadwal(e.target.value)} value={selectedJadwal || ''} className="p-2 border rounded-lg bg-surface dark:bg-slate-800 dark:border-slate-700 w-full max-w-md">
                    <option value="">-- Pilih Jadwal Ujian --</option>
                    {dataJadwal.map(j => <option key={j.id_jadwal} value={j.id_jadwal}>{j.id_jadwal} - {j.nama_mapel} ({j.guru})</option>)}
                  </select>
                  {activeTab === 'hasil' && selectedJadwal && (
                    <button onClick={exportToExcel} className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm">
                      <span className="material-symbols-outlined">download</span> Export XLSX
                    </button>
                  )}
                </div>

                {selectedJadwal ? (
                  <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 overflow-hidden overflow-x-auto shadow-sm">
                    <table className="w-full text-left min-w-[800px]">
                      <thead className="bg-surface-variant/30 dark:bg-slate-800/80">
                        <tr>
                          <th className="p-4">Siswa</th>
                          {activeTab === 'hasil' && <th className="p-4">Kelas</th>}
                          {activeTab === 'monitoring' && <th className="p-4">Status</th>}
                          {activeTab === 'monitoring' && <th className="p-4 text-center">Pelanggaran</th>}
                          {activeTab === 'hasil' && <th className="p-4 text-right">Nilai PG</th>}
                          {activeTab === 'hasil' && <th className="p-4 text-right">Nilai Uraian</th>}
                          {activeTab === 'hasil' && <th className="p-4 text-right">Total Nilai</th>}
                          {activeTab === 'monitoring' && <th className="p-4 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {dataLog.length > 0 ? dataLog.map(l => (
                          <tr key={l.id_log} className="border-t border-outline-variant/30 dark:border-slate-700">
                            <td className="p-4">
                              <div className="font-bold">{l.nama_lengkap}</div>
                              <div className="text-xs text-slate-500">{l.id_siswa}</div>
                            </td>
                            {activeTab === 'hasil' && <td className="p-4 text-sm">{l.angkatan} {l.kelas_paralel}</td>}
                            {activeTab === 'monitoring' && (
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${l.is_blocked ? 'bg-red-100 text-red-700' : l.status_ujian === 'SELESAI' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {l.is_blocked ? 'DIBLOKIR' : l.status_ujian}
                                </span>
                              </td>
                            )}
                            {activeTab === 'monitoring' && <td className="p-4 text-center font-bold text-error">{l.pelanggaran || 0}</td>}

                            {activeTab === 'hasil' && <td className="p-4 text-right font-medium">{l.nilai_auto}</td>}
                            {activeTab === 'hasil' && <td className="p-4 text-right font-medium">{l.nilai_uraian}</td>}
                            {activeTab === 'hasil' && <td className="p-4 text-right font-bold text-primary text-lg">{l.total_nilai}</td>}

                            {activeTab === 'monitoring' && (
                              <td className="p-4 text-right">
                                {!l.is_blocked ? (
                                  <button onClick={() => handleBlock(l.id_log)} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs font-bold">Blokir</button>
                                ) : (
                                  <button onClick={() => handleUnblock(l.id_log)} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs font-bold">Buka Blokir</button>
                                )}
                              </td>
                            )}
                          </tr>
                        )) : (
                          <tr><td colSpan="8" className="p-8 text-center text-slate-500">Belum ada data log untuk jadwal ini.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-12 bg-surface-variant/30 rounded-xl border border-dashed dark:border-slate-700">Silakan pilih jadwal ujian di atas.</div>
                )}
              </div>
            )}
            </div>
            {renderFormModal()}
            {renderProfileModal()}
          </main>
        </div>
      );
    };
