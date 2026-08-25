const fs = require('fs');
let content = fs.readFileSync('views/AdminView.js', 'utf-8');

// 1. Add handleResetLogin
const handleSaveForm = `const handleSaveForm = async (e) => {`;
const newFunction = `
      const handleResetLogin = async (id_siswa) => {
        if (!confirm('Reset sesi login siswa ini?')) return;
        const res = await fetchAPI('reset_login_siswa', { id_siswa, npsn: user.npsn });
        if (res.status === 'success') {
          alert('Sesi login berhasil direset.');
        } else {
          alert(res.message);
        }
      };
      
      const handleSaveForm = async (e) => {`;
content = content.replace(handleSaveForm, newFunction);

// 2. Add Reset Login Button in action column
const actionColRegex = /<td className="p-4 text-right">([\s\S]*?)<button onClick=\{\(\) => openEditModal/m;
const newActionCol = `<td className="p-4 text-right">
                            {activeTab === 'siswa' && (
                              <button onClick={() => handleResetLogin(row.id_siswa)} title="Reset Login Sesi" className="text-orange-500 hover:bg-orange-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors mr-1">
                                <span className="material-symbols-outlined text-[20px]">sync</span>
                              </button>
                            )}
                            <button onClick={() => openEditModal`;
content = content.replace(actionColRegex, newActionCol);

fs.writeFileSync('views/AdminView.js', content, 'utf-8');
console.log('Update AdminView.js selesai!');
