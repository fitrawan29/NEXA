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
            <div className="min-h-screen flex flex-col items-center justify-center p-lg sm:p-xl md:p-gutter relative overflow-hidden bg-surface transition-colors duration-500 dark:bg-slate-900">
              {/* Top Right Controls (Online Status & Dark Mode) */}
              <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm transition-colors ${isOnline ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30' : 'bg-error-container text-error border border-error/30'}`}>
                  <span className="relative flex h-2 w-2">
                    {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-[#10B981]' : 'bg-error'}`}></span>
                  </span>
                  {isOnline ? 'Online' : 'Offline'}
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-9 h-9 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-outline-variant dark:border-slate-600 flex items-center justify-center text-on-surface dark:text-white hover:bg-white/80 dark:hover:bg-slate-700 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                </button>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-fixed dark:bg-primary/20 rounded-full blur-[100px] opacity-60 pointer-events-none transition-colors duration-500"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-fixed dark:bg-secondary/20 rounded-full blur-[100px] opacity-60 pointer-events-none transition-colors duration-500"></div>

              <div className="w-full max-w-[900px] max-h-[95vh] sm:max-h-[90vh] my-4 bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-white/50 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row animate-fade-in-up">

                {/* Left Side: Illustration / Branding (Hidden on small screens) */}
                <div className="hidden md:flex md:w-1/2 bg-primary text-white p-xl flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-blue-900 opacity-90"></div>
                  <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>

                  <div className="relative z-10">
                    <h2 className="font-headline-lg text-white font-bold flex items-center gap-2 mb-4">
                      <img alt="NEXA Logo" className="w-10 h-10 object-contain rounded bg-white p-1" src="stitch_assets/screen_3_logo.png" />
                      NEXA
                    </h2>
                    <p className="font-body-lg text-primary-fixed-dim">Platform Ujian Berbasis Komputer Modern untuk Sekolah.</p>
                  </div>

                  <div className="relative z-10">
                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 hover:bg-white/20 transition-colors min-h-[140px] flex flex-col justify-center">
                      <p key={quoteIndex} className="font-body-md text-white transition-opacity duration-500 animate-fade-in-up">"{quotes[quoteIndex].text}"</p>
                      <p key={`author-${quoteIndex}`} className="font-label-md text-primary-fixed-dim mt-2 transition-opacity duration-500 animate-fade-in-up">- {quotes[quoteIndex].author}</p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Forms */}
                <div className="w-full md:w-1/2 h-full overflow-hidden relative bg-white/50 dark:bg-slate-900/50">
                  <div className={`form-slider h-full ${isRegistering ? 'show-register' : ''}`}>
                    {/* MASUK FORM PANE */}
                    <div className="form-pane p-lg sm:p-xl flex flex-col justify-center h-full overflow-y-auto">
                      <div className="mb-lg md:hidden">
                        <h2 className="font-headline-md text-on-surface dark:text-white flex items-center gap-xs">
                          <img alt="NEXA Logo" className="w-8 h-8 object-contain rounded" src="stitch_assets/screen_3_logo.png" />
                          NEXA
                        </h2>
                        <p className="font-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Silakan masuk ke akun Anda.</p>
                      </div>

                      <div className="hidden md:block mb-lg">
                        <h2 className="font-headline-md text-on-surface dark:text-white font-bold">Selamat Datang</h2>
                        <p className="font-body-md text-on-surface-variant dark:text-slate-300 mt-1">Masukkan kredensial Anda untuk mengakses sistem.</p>
                      </div>

                      <form onSubmit={onLoginSubmit} className="flex flex-col gap-md">
                        {/* Segmented Control */}
                        <div className="flex bg-surface-container dark:bg-slate-800 p-1 rounded-lg relative isolation-auto z-0 mb-xs shadow-inner transition-colors duration-300">
                          {[{val: 'siswa', label: 'Siswa'}, {val: 'guru', label: 'Guru'}, {val: 'admin', label: 'Admin'}, {val: 'super_admin', label: 'Super Admin'}].map((r) => (
                            <label key={r.val} className="flex-1 cursor-pointer relative">
                              <input checked={loginRole === r.val} onChange={() => setLoginRole(r.val)} className="peer sr-only" name="login-role" type="radio" value={r.val} />
                              <div className="w-full text-center py-2 rounded-md text-on-surface-variant dark:text-slate-300 font-label-md transition-all duration-300 peer-checked:text-primary dark:peer-checked:text-primary-fixed z-10 relative capitalize">
                                {r.label}
                              </div>
                              <div className="absolute inset-0 bg-white dark:bg-slate-700 rounded-md shadow-sm transform scale-90 opacity-0 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-300 -z-10"></div>
                            </label>
                          ))}
                        </div>

                        {loginError && (
                          <div className="bg-error-container text-error px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 animate-fade-in-up border border-error/20">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {loginError}
                          </div>
                        )}

                        {loginRole !== 'super_admin' && (
                          <div className="flex flex-col gap-xs group">
                            <label className="font-label-md text-on-surface dark:text-slate-200 group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="login-npsn">
                              NPSN Sekolah
                            </label>
                            <div className="relative flex items-center">
                              <span className="material-symbols-outlined absolute left-sm text-outline group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors z-10">account_balance</span>
                              <input required value={npsn} onChange={e => setNpsn(e.target.value)} className="academic-input w-full pl-[40px] pr-sm py-sm rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="login-npsn" placeholder="Masukkan NPSN Sekolah Anda" type="text" />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-xs group">
                          <label className="font-label-md text-on-surface dark:text-slate-200 group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="login-username">
                            {loginRole === 'guru' ? 'Username / NIP' : loginRole === 'admin' ? 'Username' : 'Username / NISN'}
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-sm text-outline group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors z-10">person</span>
                            <input ref={usernameInputRef} required value={username} onChange={e => setUsername(e.target.value)} className="academic-input w-full pl-[40px] pr-sm py-sm rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="login-username" placeholder={loginRole === 'guru' ? 'Masukkan Username atau NIP' : loginRole === 'admin' ? 'Masukkan Username' : 'Masukkan Username atau NISN'} type="text" />
                          </div>
                        </div>

                        <div className="flex flex-col gap-xs group">
                          <div className="flex justify-between items-end">
                            <label className="font-label-md text-on-surface dark:text-slate-200 group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="login-password">Password</label>
                            {capsLockActive && <span className="text-[10px] text-error font-bold flex items-center gap-1 animate-fade-in-up"><span className="material-symbols-outlined text-[12px]">keyboard_capslock</span> Caps Lock Aktif</span>}
                          </div>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-sm text-outline group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors z-10">lock</span>
                            <input required value={password} onChange={e => setPassword(e.target.value)} onKeyUp={handlePasswordKeyUp} className="academic-input w-full pl-[40px] pr-[40px] py-sm rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="login-password" placeholder="Dapat berupa huruf, angka & simbol" type={showPassword ? "text" : "password"} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-sm text-outline hover:text-on-surface-variant dark:hover:text-white transition-colors flex items-center justify-center h-full z-10">
                              <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mb-xs mt-[-4px]">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center justify-center w-4 h-4 border border-outline-variant rounded group-hover:border-primary transition-colors">
                              <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="absolute opacity-0 w-full h-full cursor-pointer peer" />
                              <span className="material-symbols-outlined text-primary opacity-0 peer-checked:opacity-100 transition-opacity" style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}>check</span>
                            </div>
                            <span className="font-body-md text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Ingat Saya</span>
                          </label>
                          <button type="button" onClick={handleLupaPassword} className="font-body-md text-sm text-primary font-medium hover:text-primary-container transition-colors">Lupa Password?</button>
                        </div>

                        <button disabled={loading || loginSuccess} className={`w-full font-label-md py-sm rounded-lg transition-all duration-300 shadow-sm flex justify-center items-center gap-xs mt-2 ${loginSuccess ? 'bg-[#10B981] text-white' : 'bg-primary text-on-primary hover:bg-primary-container hover:shadow-lg hover:-translate-y-1'} disabled:opacity-80 disabled:cursor-not-allowed`} type="submit">
                          {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : loginSuccess ? (
                            <><span className="material-symbols-outlined text-[20px] animate-fade-in-up">check_circle</span> Berhasil Masuk</>
                          ) : (
                            <>Masuk Sekarang <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                          )}
                        </button>
                      </form>

                      <p className="text-center font-body-md text-sm text-on-surface-variant dark:text-slate-400 mt-lg">
                        Belum punya akun? <button onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-primary hover:underline font-semibold" type="button">Daftar</button>
                      </p>
                    </div>

                    {/* DAFTAR FORM PANE */}
                    <div className="form-pane p-lg sm:p-xl flex flex-col justify-center h-full overflow-y-auto">
                      <div className="mb-lg md:hidden flex-shrink-0">
                        <h2 className="font-headline-md text-on-surface dark:text-white flex items-center gap-xs">
                          <img alt="NEXA Logo" className="w-8 h-8 object-contain rounded" src="stitch_assets/screen_3_logo.png" />
                          NEXA
                        </h2>
                        <p className="font-body-md text-on-surface-variant dark:text-slate-300 mt-xs">Buat akun baru Anda.</p>
                      </div>

                      <div className="hidden md:block mb-lg flex-shrink-0">
                        <h2 className="font-headline-md text-on-surface dark:text-white font-bold">Buat Akun Baru</h2>
                        <p className="font-body-md text-on-surface-variant dark:text-slate-300 mt-1">Lengkapi data berikut untuk bergabung.</p>
                      </div>

                      <form onSubmit={onRegisterSubmit} className="flex flex-col gap-sm flex-1">
                        {/* Segmented Control */}
                        <div className="flex bg-surface-container dark:bg-slate-800 p-1 rounded-lg relative isolation-auto z-0 mb-xs shadow-inner transition-colors duration-300 flex-shrink-0">
                          {['siswa', 'guru'].map((r) => (
                            <label key={r} className="flex-1 cursor-pointer relative">
                              <input checked={registerRole === r} onChange={() => setRegisterRole(r)} className="peer sr-only" name="reg-role" type="radio" value={r} />
                              <div className="w-full text-center py-2 rounded-md text-on-surface-variant dark:text-slate-300 font-label-md transition-all duration-300 peer-checked:text-primary dark:peer-checked:text-primary-fixed z-10 relative capitalize">
                                {r}
                              </div>
                              <div className="absolute inset-0 bg-white dark:bg-slate-700 rounded-md shadow-sm transform scale-90 opacity-0 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-300 -z-10"></div>
                            </label>
                          ))}
                        </div>

                        <div className="flex flex-col gap-xs group flex-shrink-0">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-sm group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-name">Nama Lengkap</label>
                          <input required value={regName} onChange={e => setRegName(e.target.value)} className="academic-input w-full px-sm py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="reg-name" placeholder="Masukkan nama lengkap" type="text" />
                        </div>
                        <div className="flex flex-col gap-xs group flex-shrink-0">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-sm group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-username">Username</label>
                          <input required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="academic-input w-full px-sm py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="reg-username" placeholder="Masukkan Username unik" type="text" />
                        </div>

                        {registerRole === 'siswa' && (
                          <div className="flex flex-col gap-xs group animate-fade-in-up flex-shrink-0">
                            <label className="font-label-md text-on-surface dark:text-slate-200 text-sm group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-nisn">NISN</label>
                            <input required value={regNisn} onChange={e => setRegNisn(e.target.value)} className="academic-input w-full px-sm py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="reg-nisn" placeholder="Masukkan NISN valid" type="text" />
                          </div>
                        )}

                        {registerRole === 'guru' && (
                          <div className="flex flex-col gap-xs group animate-fade-in-up flex-shrink-0">
                            <label className="font-label-md text-on-surface dark:text-slate-200 text-sm group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-nip">NIP (Opsional)</label>
                            <input value={regNip} onChange={e => setRegNip(e.target.value)} className="academic-input w-full px-sm py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="reg-nip" placeholder="Ketik '-' jika belum memiliki" type="text" />
                          </div>
                        )}

                        <div className="flex flex-col gap-xs group flex-shrink-0">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-sm group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-npsn">NPSN Sekolah</label>
                          <input required value={npsn} onChange={e => setNpsn(e.target.value)} className="academic-input w-full px-sm py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="reg-npsn" placeholder="Masukkan NPSN Sekolah Anda" type="text" />
                        </div>

                        <div className="flex flex-col gap-xs group mb-1 flex-shrink-0">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-sm group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-password">Password</label>
                          <div className="relative flex items-center">
                            <input required value={regPassword} onChange={e => setRegPassword(e.target.value)} className="academic-input w-full px-sm pr-[40px] py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-400 transition-all hover:border-outline focus:border-primary dark:focus:border-primary-fixed focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary-fixed/20 focus:bg-white dark:focus:bg-slate-800" id="reg-password" placeholder="Dapat berupa huruf, angka & simbol" type={showPassword ? "text" : "password"} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-sm text-outline hover:text-on-surface-variant dark:hover:text-white transition-colors flex items-center justify-center h-full">
                              <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-auto pt-2">
                          <button disabled={loading} className="w-full bg-primary text-on-primary font-label-md py-sm rounded-lg hover:bg-primary-container hover:shadow-lg hover:-translate-y-1 transition-all duration-300 shadow-sm flex justify-center items-center gap-xs disabled:opacity-80 disabled:cursor-not-allowed" type="submit">
                            {loading ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <>
                                Daftar Sekarang
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                              </>
                            )}
                          </button>
                          <p className="text-center font-body-md text-on-surface-variant mt-sm text-[12px]">
                            Dengan mendaftar, Anda menyetujui <button type="button" onClick={handleSyaratKetentuan} className="text-primary hover:underline">Syarat & Ketentuan</button> kami.
                          </p>
                        </div>
                      </form>

                      <p className="text-center font-body-md text-sm text-on-surface-variant dark:text-slate-400 mt-md">
                        Sudah punya akun? <button onClick={() => { setIsRegistering(false); setLoginError(''); }} className="text-primary hover:underline font-semibold" type="button">Masuk</button>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="absolute bottom-4 left-0 w-full text-center z-50">
                <p className="font-body-md text-sm text-on-surface-variant dark:text-slate-400">
                  NEXA CBT v1.0.0 &copy; 2026. <button type="button" onClick={handleSyaratKetentuan} className="hover:text-primary dark:hover:text-primary-fixed transition-colors underline underline-offset-2">Panduan & Tata Tertib Ujian</button>
                </p>
              </div>
            </div>
          );
        }

        switch (user.role) {
          case 'super_admin': return <SuperAdminView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
          case 'admin': return <AdminView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
          case 'guru': return <GuruView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
          case 'siswa': return <SiswaView user={user} onLogout={handleLogout} showMessage={showMessage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
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
    root.render(<App />);