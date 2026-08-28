    class ErrorBoundary extends React.Component { 
      constructor(props) { super(props); this.state = { hasError: false, error: null }; } 
      static getDerivedStateFromError(error) { return { hasError: true, error }; } 
      componentDidCatch(error, errorInfo) { console.error('ErrorBoundary caught error', error, errorInfo); } 
      render() { 
        if (this.state.hasError) { 
          return <div className="p-8 h-screen w-full flex items-center justify-center bg-red-50 text-red-600"><div className="bg-white p-6 rounded-xl shadow-lg border border-red-200"><h1 className="text-xl font-bold mb-4">Something went wrong.</h1><pre className="text-sm bg-red-50 p-4 rounded overflow-auto max-w-full">{this.state.error && this.state.error.toString()}</pre><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Refresh Page</button></div></div>; 
        } 
        return this.props.children; 
      } 
    }

    const App = () => {
      const [user, setUser] = useState(null);
      const [isRegistering, setIsRegistering] = useState(false);
      const [loading, setLoading] = useState(false);

      const [npsn, setNpsn] = useState('');
      const [username, setUsername] = useState('');
      const [password, setPassword] = useState('');
      const [showPassword, setShowPassword] = useState(false);
      const [rememberMe, setRememberMe] = useState(false);
      const [loginError, setLoginError] = useState('');
      const [loginSuccess, setLoginSuccess] = useState(false);
      const [isOnline, setIsOnline] = useState(navigator.onLine);
      const [isDarkMode, setIsDarkMode] = useState(false);
      const [capsLockActive, setCapsLockActive] = useState(false);

      const [loginRole, setLoginRole] = useState('siswa');
      const [registerRole, setRegisterRole] = useState('siswa');
      const [regName, setRegName] = useState('');
      const [regUsername, setRegUsername] = useState('');
      const [regNip, setRegNip] = useState('');
      const [regNisn, setRegNisn] = useState('');
      const [regPassword, setRegPassword] = useState('');

      const quotes = [
        { text: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan, Anda dapat mengubah dunia.", author: "Nelson Mandela" },
        { text: "Hiduplah seolah engkau mati besok. Belajarlah seolah engkau hidup selamanya.", author: "Mahatma Gandhi" },
        { text: "Pendidikan bukan sekadar mengisi wadah, melainkan menyalakan api.", author: "William Butler Yeats" },
        { text: "Tujuan pendidikan itu untuk mempertajam kecerdasan, memperkukuh kemauan serta memperhalus perasaan.", author: "Tan Malaka" }
      ];
      const [quoteIndex, setQuoteIndex] = useState(0);

      const usernameInputRef = useRef(null);

      useEffect(() => {
        const interval = setInterval(() => {
          setQuoteIndex((prev) => (prev + 1) % quotes.length);
        }, 8000);
        return () => clearInterval(interval);
      }, []);

      useEffect(() => {
        if (!user && usernameInputRef.current) {
          usernameInputRef.current.focus();
        }
      }, [user, isRegistering]);

      useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }, []);

      useEffect(() => {
        if (isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, [isDarkMode]);

      const handlePasswordKeyUp = (e) => {
        if (e.getModifierState && e.getModifierState('CapsLock')) {
          setCapsLockActive(true);
        } else {
          setCapsLockActive(false);
        }
      };

      const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

      const showMessage = (title, message, type) => {
        setModal({ isOpen: true, title, message, type });
      };

      const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setLoginError('');
        const res = await fetchAPI('login', { username, password, npsn, role: loginRole });
        setLoading(false);

        if (res.status === 'success') {
          setLoginSuccess(true);
          setTimeout(() => {
            setUser(res.data);
            setLoginSuccess(false);
          }, 1000);
        } else {
          setLoginError(res.message || 'Username atau password yang Anda masukkan salah.');
        }
      };

      const handleLogout = () => {
        setUser(null);
        setUsername('');
        setPassword('');
        setRememberMe(false);
      };

      const renderView = () => {
        if (!user) {
          const onLoginSubmit = (e) => {
            e.preventDefault();
            handleLogin(e);
          };

          const onRegisterSubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            const payload = {
              role: registerRole,
              nama: regName,
              username: regUsername,
              identitas: registerRole === 'siswa' ? regNisn : regNip,
              password: regPassword,
              npsn: npsn
            };
            const res = await fetchAPI('register', payload);
            setLoading(false);

            if (res.status === 'success') {
              showMessage('Pendaftaran Berhasil', res.message, 'success');
              setRegName('');
              setRegUsername('');
              setRegNisn('');
              setRegNip('');
              setRegPassword('');
              setIsRegistering(false);
            } else {
              showMessage('Pendaftaran Gagal', res.message || 'Terjadi kesalahan saat mendaftar.', 'error');
            }
          };

          const handleLupaPassword = (e) => {
            e.preventDefault();
            showMessage('Lupa Password?', 'Untuk mereset password, silakan hubungi Administrator Sekolah atau Wali Kelas Anda.', 'info');
          };

          const handleSyaratKetentuan = (e) => {
            e.preventDefault();
            showMessage('Syarat & Ketentuan', 'Dengan mendaftar dan menggunakan sistem NEXA CBT, Anda setuju untuk mematuhi tata tertib ujian, tidak melakukan kecurangan, dan menjaga kerahasiaan akun.', 'info');
          };

          return (
            <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/20 selection:text-primary relative">
              
              {/* Background gradient effects */}
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none"></div>

              <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen z-10">
                {/* Header Section */}
                <div className="bg-[#3ecf8e] rounded-b-[40px] px-6 pt-12 pb-24 relative text-white shadow-md z-0 flex flex-col items-center justify-center text-center">
                   <div className="w-20 h-20 bg-white shadow-lg rounded-2xl flex items-center justify-center p-3 mb-4 border border-white/20">
                     <img alt="NEXA Logo" className="w-full h-full object-contain" src="stitch_assets/screen_3_logo.png" />
                   </div>
                   <h2 className="text-3xl font-bold tracking-tight mb-1">NEXA CBT</h2>
                   <p className="text-sm font-medium opacity-90">{isRegistering ? 'Daftar Akun Baru' : 'Platform Ujian Modern'}</p>
                   
                   <div className="absolute top-4 right-4">
                      <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                      </button>
                   </div>
                </div>

                {/* Main Content Pane (overlapping) */}
                <div className="flex-1 overflow-y-auto px-6 -mt-16 pb-8 relative z-10 hide-scrollbar">
                   <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-6 border border-slate-100 dark:border-slate-700 animate-fade-in-up">
                      
                      {!isRegistering ? (
                        <>
                          <div className="mb-6 text-center">
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white">Selamat Datang 👋</h3>
                            <p className="text-sm text-slate-500 mt-1">Silakan masuk untuk melanjutkan</p>
                          </div>
                          
                          <form onSubmit={onLoginSubmit} className="flex flex-col gap-4">
                             {/* Role Selection */}
                             <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl relative z-0">
                               {[
                                 {val: 'siswa', label: 'Siswa', icon: 'school'},
                                 {val: 'guru', label: 'Guru', icon: 'local_library'},
                                 {val: 'admin', label: 'Admin', icon: 'admin_panel_settings'},
                                 {val: 'super_admin', label: 'S-Admin', icon: 'shield_person'}
                               ].map((r) => (
                                 <label key={r.val} className="cursor-pointer relative group text-center py-2">
                                   <input checked={loginRole === r.val} onChange={() => setLoginRole(r.val)} className="peer sr-only" name="login-role" type="radio" value={r.val} />
                                   <div className="relative z-10 text-xs font-bold text-slate-500 dark:text-slate-400 peer-checked:text-primary transition-colors flex flex-col items-center gap-1">
                                      <span className="material-symbols-outlined text-[18px]">{r.icon}</span>
                                      {r.label}
                                   </div>
                                   <div className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm opacity-0 peer-checked:opacity-100 scale-95 peer-checked:scale-100 transition-all -z-10"></div>
                                 </label>
                               ))}
                             </div>

                             {loginError && (
                               <div className="bg-red-50 text-red-500 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100">
                                 <span className="material-symbols-outlined text-[16px]">error</span>
                                 {loginError}
                               </div>
                             )}

                             {loginRole !== 'super_admin' && (
                               <div className="flex flex-col gap-1">
                                 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">NPSN Sekolah</label>
                                 <div className="relative">
                                   <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">account_balance</span>
                                   <input required value={npsn} onChange={e => setNpsn(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Masukkan NPSN" type="text" />
                                 </div>
                               </div>
                             )}

                             <div className="flex flex-col gap-1">
                               <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Username</label>
                               <div className="relative">
                                 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                                 <input ref={usernameInputRef} required value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder={loginRole === 'guru' ? 'Username / NIP' : loginRole === 'admin' ? 'Username' : 'Username / NISN'} type="text" />
                               </div>
                             </div>

                             <div className="flex flex-col gap-1">
                               <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                 Password
                                 {capsLockActive && <span className="text-red-500 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">keyboard_capslock</span> Caps Lock</span>}
                               </label>
                               <div className="relative">
                                 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                                 <input required value={password} onChange={e => setPassword(e.target.value)} onKeyUp={handlePasswordKeyUp} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Masukkan Password" type={showPassword ? "text" : "password"} />
                                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                   <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                 </button>
                               </div>
                             </div>

                             <div className="flex justify-between items-center text-xs mt-1">
                               <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="rounded text-primary border-slate-300 focus:ring-primary" />
                                 <span className="font-bold text-slate-600 dark:text-slate-400">Ingat Saya</span>
                               </label>
                               <button type="button" onClick={handleLupaPassword} className="font-bold text-primary">Lupa Password?</button>
                             </div>

                             <button disabled={loading || loginSuccess} className={w-full py-3 rounded-xl font-bold text-white transition-all shadow-md mt-2 flex justify-center items-center gap-2 } type="submit">
                               {loading ? (
                                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                               ) : loginSuccess ? (
                                 <><span className="material-symbols-outlined">check_circle</span> Berhasil Masuk</>
                               ) : (
                                 <>Masuk <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                               )}
                             </button>
                          </form>

                          <p className="text-center text-xs font-bold text-slate-500 mt-6">
                            Belum punya akun? <button onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-primary hover:underline">Daftar disini</button>
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mb-6 text-center">
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white">Buat Akun Baru</h3>
                            <p className="text-sm text-slate-500 mt-1">Bergabung dengan platform NEXA</p>
                          </div>
                          
                          <form onSubmit={onRegisterSubmit} className="flex flex-col gap-4">
                             <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl relative z-0">
                               {[
                                 {val: 'siswa', label: 'Daftar Siswa', icon: 'school'},
                                 {val: 'guru', label: 'Daftar Guru', icon: 'local_library'}
                               ].map((r) => (
                                 <label key={r.val} className="flex-1 cursor-pointer relative group text-center py-2">
                                   <input checked={registerRole === r.val} onChange={() => setRegisterRole(r.val)} className="peer sr-only" name="reg-role" type="radio" value={r.val} />
                                   <div className="relative z-10 text-xs font-bold text-slate-500 dark:text-slate-400 peer-checked:text-primary transition-colors flex items-center justify-center gap-1">
                                      <span className="material-symbols-outlined text-[16px]">{r.icon}</span>
                                      {r.label}
                                   </div>
                                   <div className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm opacity-0 peer-checked:opacity-100 scale-95 peer-checked:scale-100 transition-all -z-10"></div>
                                 </label>
                               ))}
                             </div>

                             <div className="flex flex-col gap-1">
                               <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                               <input required value={regName} onChange={e => setRegName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Nama Lengkap" type="text" />
                             </div>
                             
                             <div className="flex flex-col gap-1">
                               <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Username</label>
                               <input required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Username Unik" type="text" />
                             </div>

                             {registerRole === 'siswa' && (
                               <div className="flex flex-col gap-1 animate-fade-in-up">
                                 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">NISN</label>
                                 <input required value={regNisn} onChange={e => setRegNisn(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="NISN Valid" type="text" />
                               </div>
                             )}

                             {registerRole === 'guru' && (
                               <div className="flex flex-col gap-1 animate-fade-in-up">
                                 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">NIP (Opsional)</label>
                                 <input value={regNip} onChange={e => setRegNip(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Ketik '-' jika tidak ada" type="text" />
                               </div>
                             )}

                             <div className="flex flex-col gap-1">
                               <label className="text-xs font-bold text-slate-700 dark:text-slate-300">NPSN Sekolah</label>
                               <input required value={npsn} onChange={e => setNpsn(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="NPSN Sekolah" type="text" />
                             </div>

                             <div className="flex flex-col gap-1">
                               <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                               <div className="relative">
                                 <input required value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Password kuat" type={showPassword ? "text" : "password"} />
                                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                   <span className="material-symbols-outlined text-[16px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                 </button>
                               </div>
                             </div>

                             <button disabled={loading} className="w-full py-3 rounded-xl font-bold text-white bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 transition-all shadow-md mt-2 flex justify-center items-center gap-2 disabled:opacity-80" type="submit">
                               {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>Daftar <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
                             </button>
                          </form>
                          
                          <p className="text-center text-xs font-bold text-slate-500 mt-6">
                            Sudah punya akun? <button onClick={() => { setIsRegistering(false); setLoginError(''); }} className="text-primary hover:underline">Masuk disini</button>
                          </p>
                        </>
                      )}
                   </div>
                   
                   {/* Online Indicator & Footer */}
                   <div className="mt-8 flex flex-col items-center justify-center gap-2 pb-4">
                     <div className={lex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold }>
                        <span className={elative flex h-2 w-2}>
                          {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>}
                          <span className={elative inline-flex rounded-full h-2 w-2 }></span>
                        </span>
                        {isOnline ? 'Sistem Online' : 'Koneksi Offline'}
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium">
                       NEXA CBT v1.0.0 &copy; 2026. <button type="button" onClick={handleSyaratKetentuan} className="hover:text-primary underline">Syarat & Ketentuan</button>
                     </p>
                   </div>
                </div>

              </div>
            </div>
          );
        }

        switch (user.role) {
          case 'super_admin': return <ErrorBoundary><SuperAdminView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} /></ErrorBoundary>;
          case 'admin': return <ErrorBoundary><AdminView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} /></ErrorBoundary>;
          case 'guru': return <ErrorBoundary><GuruView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} /></ErrorBoundary>;
          case 'siswa': return <ErrorBoundary><SiswaView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} /></ErrorBoundary>;
          default: return <div className="p-8 text-center text-red-600 font-bold bg-white h-screen">Role tidak valid!</div>;
        }
      };

      return (
        <React.Fragment>
          {renderView()}
          <Modal
            isOpen={modal.isOpen}
            title={modal.title}
            message={modal.message}
            type={modal.type}
            onClose={() => setModal({ ...modal, isOpen: false })}
          />
        </React.Fragment>
      );
    };

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );

