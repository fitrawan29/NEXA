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

      const handleLupaPassword = () => {
        showMessage('Informasi', 'Fitur reset password mandiri sedang dalam pengembangan. Silakan hubungi Administrator sekolah Anda untuk mereset password.', 'info');
      };

      const handleSyaratKetentuan = () => {
        showMessage('Syarat & Ketentuan', 'Aplikasi NEXA CBT merupakan sistem ujian tertutup. Segala bentuk kecurangan atau eksploitasi sistem akan terekam dan dapat berakibat pembatalan hasil ujian. Mohon kerjakan ujian dengan jujur.', 'info');
      };

      const renderView = () => {
        if (!user) {
          const onLoginSubmit = (e) => {
            e.preventDefault();
            handleLogin();
          };

          const onRegisterSubmit = (e) => {
            e.preventDefault();
            handleRegister();
          };

          return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto bg-surface transition-colors duration-500 dark:bg-slate-900">
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

              {/* Clean, centered login card with no AI blobs */}
              <div className="w-full max-w-md my-auto bg-white dark:bg-slate-800 border border-outline-variant/30 dark:border-slate-700 rounded-3xl shadow-xl overflow-hidden relative z-10 flex flex-col animate-fade-in-up">
                  <div className={`form-slider h-full ${isRegistering ? 'show-register' : ''}`}>
                    {/* MASUK FORM PANE */}
                    <div className="form-pane p-8 flex flex-col justify-center h-full overflow-y-auto">
                      <div className="mb-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-surface shadow-sm rounded-2xl flex items-center justify-center p-2 mb-4 border border-outline-variant/30 dark:bg-slate-700 dark:border-slate-600">
                          <img alt="NEXA Logo" className="w-full h-full object-contain" src="stitch_assets/screen_3_logo.png" />
                        </div>
                        <h2 className="text-2xl font-bold text-on-surface dark:text-white tracking-tight">
                          NEXA CBT
                        </h2>
                        <p className="font-body-md text-on-surface-variant dark:text-slate-400 mt-1">Sistem Ujian Berbasis Komputer</p>
                      </div>

                      <form onSubmit={onLoginSubmit} className="flex flex-col gap-4">
                        {/* Segmented Control */}
                        <div className="grid grid-cols-2 bg-surface-container/50 dark:bg-slate-900/50 p-1 rounded-xl relative isolation-auto z-0 mb-2 shadow-inner border border-outline-variant/20 transition-colors duration-300 gap-1">
                          {[
                            {val: 'siswa', label: 'Siswa', icon: 'school'},
                            {val: 'guru', label: 'Guru', icon: 'local_library'},
                            {val: 'admin', label: 'Admin', icon: 'admin_panel_settings'},
                            {val: 'super_admin', label: 'Super Admin', icon: 'shield_person'}
                          ].map((r) => (
                            <label key={r.val} className="flex-1 cursor-pointer relative group">
                              <input checked={loginRole === r.val} onChange={() => setLoginRole(r.val)} className="peer sr-only" name="login-role" type="radio" value={r.val} />
                              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 rounded-lg text-on-surface-variant dark:text-slate-400 font-label-md transition-all duration-300 peer-checked:text-primary dark:peer-checked:text-white z-10 relative capitalize group-hover:text-on-surface dark:group-hover:text-slate-200">
                                <span className="material-symbols-outlined text-[18px] transition-transform duration-300 peer-checked:scale-110">{r.icon}</span>
                                <span className="text-[12px] sm:text-[13px] font-semibold tracking-wide whitespace-nowrap">{r.label}</span>
                              </div>
                              <div className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-black/5 dark:border-white/10 transform scale-95 opacity-0 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-300 -z-10"></div>
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
                          <div className="flex flex-col gap-1.5 group">
                            <label className="font-label-md text-on-surface dark:text-slate-200 text-[13px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="login-npsn">
                              NPSN Sekolah
                            </label>
                            <div className="relative flex items-center">
                              <span className="material-symbols-outlined absolute left-3 text-outline group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors z-10 text-[20px]">account_balance</span>
                              <input required value={npsn} onChange={e => setNpsn(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="login-npsn" placeholder="NPSN Sekolah" type="text" />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 group">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-[13px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="login-username">
                            {loginRole === 'guru' ? 'Username / NIP' : loginRole === 'admin' ? 'Username' : 'Username / NISN'}
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3 text-outline group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors z-10 text-[20px]">person</span>
                            <input ref={usernameInputRef} required value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="login-username" placeholder={loginRole === 'guru' ? 'Username atau NIP' : loginRole === 'admin' ? 'Username Admin' : 'Username atau NISN'} type="text" />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 group">
                          <div className="flex justify-between items-end">
                            <label className="font-label-md text-on-surface dark:text-slate-200 text-[13px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="login-password">Password</label>
                            {capsLockActive && <span className="text-[10px] text-error font-bold flex items-center gap-1 animate-fade-in-up"><span className="material-symbols-outlined text-[12px]">keyboard_capslock</span> Caps Lock Aktif</span>}
                          </div>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3 text-outline group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors z-10 text-[20px]">lock</span>
                            <input required value={password} onChange={e => setPassword(e.target.value)} onKeyUp={handlePasswordKeyUp} className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-body-md text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="login-password" placeholder="Password Anda" type={showPassword ? "text" : "password"} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-outline hover:text-on-surface-variant dark:hover:text-white transition-colors flex items-center justify-center h-full z-10">
                              <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center justify-center w-4 h-4 border border-outline-variant rounded group-hover:border-primary transition-colors">
                              <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="absolute opacity-0 w-full h-full cursor-pointer peer" />
                              <span className="material-symbols-outlined text-primary opacity-0 peer-checked:opacity-100 transition-opacity text-[14px]">check</span>
                            </div>
                            <span className="font-body-md text-[13px] text-on-surface-variant group-hover:text-on-surface transition-colors">Ingat Saya</span>
                          </label>
                          <button type="button" onClick={handleLupaPassword} className="font-body-md text-[13px] text-primary font-medium hover:text-primary-container transition-colors">Lupa Password?</button>
                        </div>

                        <button disabled={loading || loginSuccess} className={`w-full font-label-md py-3 rounded-xl transition-all duration-300 shadow-sm flex justify-center items-center gap-2 mt-2 ${loginSuccess ? 'bg-[#10B981] text-white' : 'bg-primary text-on-primary hover:bg-primary-container hover:shadow-md hover:-translate-y-0.5'} disabled:opacity-80 disabled:cursor-not-allowed disabled:transform-none`} type="submit">
                          {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : loginSuccess ? (
                            <><span className="material-symbols-outlined text-[20px] animate-fade-in-up">check_circle</span> Berhasil Masuk</>
                          ) : (
                            <>Masuk <span className="material-symbols-outlined text-[18px]">login</span></>
                          )}
                        </button>
                      </form>

                      <p className="text-center font-body-md text-[13px] text-on-surface-variant dark:text-slate-400 mt-6">
                        Belum punya akun? <button onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-primary hover:underline font-semibold" type="button">Daftar Sekarang</button>
                      </p>
                    </div>

                    {/* DAFTAR FORM PANE */}
                    <div className="form-pane p-8 flex flex-col justify-center h-full overflow-y-auto">
                      <div className="mb-6 flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-surface shadow-sm rounded-2xl flex items-center justify-center p-2 mb-3 border border-outline-variant/30 dark:bg-slate-700 dark:border-slate-600">
                          <img alt="NEXA Logo" className="w-full h-full object-contain" src="stitch_assets/screen_3_logo.png" />
                        </div>
                        <h2 className="text-2xl font-bold text-on-surface dark:text-white tracking-tight">
                          Daftar Akun Baru
                        </h2>
                        <p className="font-body-md text-[13px] text-on-surface-variant dark:text-slate-400 mt-1">Bergabung dengan platform NEXA CBT.</p>
                      </div>

                      <form onSubmit={onRegisterSubmit} className="flex flex-col gap-3">
                        {/* Segmented Control */}
                        <div className="flex bg-surface-container/50 dark:bg-slate-900/50 p-1 rounded-xl relative isolation-auto z-0 mb-2 shadow-inner border border-outline-variant/20 transition-colors duration-300">
                          {[
                            {val: 'siswa', label: 'Siswa', icon: 'school'},
                            {val: 'guru', label: 'Guru', icon: 'local_library'}
                          ].map((r) => (
                            <label key={r.val} className="flex-1 cursor-pointer relative group">
                              <input checked={registerRole === r.val} onChange={() => setRegisterRole(r.val)} className="peer sr-only" name="reg-role" type="radio" value={r.val} />
                              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 rounded-lg text-on-surface-variant dark:text-slate-400 font-label-md transition-all duration-300 peer-checked:text-primary dark:peer-checked:text-white z-10 relative capitalize group-hover:text-on-surface dark:group-hover:text-slate-200">
                                <span className="material-symbols-outlined text-[18px] transition-transform duration-300 peer-checked:scale-110">{r.icon}</span>
                                <span className="text-[13px] font-semibold tracking-wide whitespace-nowrap">{r.label}</span>
                              </div>
                              <div className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-black/5 dark:border-white/10 transform scale-95 opacity-0 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-300 -z-10"></div>
                            </label>
                          ))}
                        </div>

                        <div className="flex flex-col gap-1 group">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-[12px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-name">Nama Lengkap</label>
                          <input required value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-[14px] text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="reg-name" placeholder="Nama lengkap" type="text" />
                        </div>
                        <div className="flex flex-col gap-1 group">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-[12px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-username">Username</label>
                          <input required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-[14px] text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="reg-username" placeholder="Username unik" type="text" />
                        </div>

                        {registerRole === 'siswa' && (
                          <div className="flex flex-col gap-1 group animate-fade-in-up">
                            <label className="font-label-md text-on-surface dark:text-slate-200 text-[12px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-nisn">NISN</label>
                            <input required value={regNisn} onChange={e => setRegNisn(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-[14px] text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="reg-nisn" placeholder="NISN valid" type="text" />
                          </div>
                        )}

                        {registerRole === 'guru' && (
                          <div className="flex flex-col gap-1 group animate-fade-in-up">
                            <label className="font-label-md text-on-surface dark:text-slate-200 text-[12px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-nip">NIP (Opsional)</label>
                            <input value={regNip} onChange={e => setRegNip(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-[14px] text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="reg-nip" placeholder="Ketik '-' jika belum memiliki" type="text" />
                          </div>
                        )}

                        <div className="flex flex-col gap-1 group">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-[12px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-npsn">NPSN Sekolah</label>
                          <input required value={npsn} onChange={e => setNpsn(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-[14px] text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="reg-npsn" placeholder="NPSN Sekolah" type="text" />
                        </div>

                        <div className="flex flex-col gap-1 group mb-2">
                          <label className="font-label-md text-on-surface dark:text-slate-200 text-[12px] group-focus-within:text-primary dark:group-focus-within:text-primary-fixed transition-colors" htmlFor="reg-password">Password</label>
                          <div className="relative flex items-center">
                            <input required value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full px-3 pr-[40px] py-2 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface dark:bg-slate-900 text-[14px] text-on-surface dark:text-white placeholder:text-outline-variant dark:placeholder:text-slate-500 transition-all focus:border-primary dark:focus:border-primary-fixed focus:ring-2 focus:ring-primary/20 outline-none" id="reg-password" placeholder="Minimal 6 karakter" type={showPassword ? "text" : "password"} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 text-outline hover:text-on-surface-variant dark:hover:text-white transition-colors flex items-center justify-center h-full">
                              <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <button disabled={loading} className="w-full bg-primary text-on-primary font-label-md py-2.5 rounded-xl hover:bg-primary-container hover:shadow-md transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed" type="submit">
                            {loading ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <>
                                Daftar Akun
                                <span className="material-symbols-outlined text-[18px]">person_add</span>
                              </>
                            )}
                          </button>
                          <p className="text-center font-body-md text-on-surface-variant mt-3 text-[12px]">
                            Dengan mendaftar, Anda setuju dengan <button type="button" onClick={handleSyaratKetentuan} className="text-primary hover:underline">Syarat & Ketentuan</button> kami.
                          </p>
                        </div>
                      </form>

                      <p className="text-center font-body-md text-[13px] text-on-surface-variant dark:text-slate-400 mt-4">
                        Sudah punya akun? <button onClick={() => { setIsRegistering(false); setLoginError(''); }} className="text-primary hover:underline font-semibold" type="button">Masuk ke Akun</button>
                      </p>
                    </div>
                  </div>
              </div>

              {/* Footer */}
              <div className="w-full text-center z-50 mt-8 mb-2">
                <p className="font-body-md text-[13px] text-on-surface-variant dark:text-slate-400">
                  NEXA CBT v1.0.0 &copy; 2026. <button type="button" onClick={handleSyaratKetentuan} className="hover:text-primary dark:hover:text-primary-fixed transition-colors underline underline-offset-2">Bantuan & Panduan</button>
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
