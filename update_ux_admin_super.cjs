const fs = require('fs');

// ==== 1. Update AdminView.js ====
let adminContent = fs.readFileSync('views/AdminView.js', 'utf-8');

// The monitoring tab displays `row.status_ujian`.
// Let's replace just the display of status_ujian with a badge component.
const oldStatusDisplay = `<td className="py-2 px-4">{row.status_ujian}</td>`;
const newStatusDisplay = `<td className="py-2 px-4">
                              <span className={\`px-3 py-1 rounded-full text-xs font-bold \${
                                row.status_ujian === 'SELESAI' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                row.status_ujian === 'SEDANG KERJA' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                row.status_ujian === 'BLOKIR' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }\`}>
                                {row.status_ujian}
                              </span>
                            </td>`;
adminContent = adminContent.replace(oldStatusDisplay, newStatusDisplay);
fs.writeFileSync('views/AdminView.js', adminContent, 'utf-8');

// ==== 2. Update SuperAdminView.js ====
let superadminContent = fs.readFileSync('views/SuperAdminView.js', 'utf-8');

// We need to inject the Dashboard Cards just before the "Daftar Sekolah Terdaftar" header
// `dataSekolah` holds the schools.
const headerBlock = `<div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-on-surface dark:text-white">Daftar Sekolah Terdaftar</h1>`;
const newHeaderBlock = `
            {/* Dashboard Makro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">Total Sekolah</p>
                    <h3 className="text-4xl font-bold">{dataSekolah.length}</h3>
                  </div>
                  <span className="material-symbols-outlined text-4xl opacity-50">corporate_fare</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">Sekolah Aktif</p>
                    <h3 className="text-4xl font-bold">{dataSekolah.filter(s => s.status !== 'SUSPENDED').length}</h3>
                  </div>
                  <span className="material-symbols-outlined text-4xl opacity-50">verified</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">Sekolah Suspended</p>
                    <h3 className="text-4xl font-bold">{dataSekolah.filter(s => s.status === 'SUSPENDED').length}</h3>
                  </div>
                  <span className="material-symbols-outlined text-4xl opacity-50">block</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-on-surface dark:text-white">Daftar Sekolah Terdaftar</h1>`;
superadminContent = superadminContent.replace(headerBlock, newHeaderBlock);
fs.writeFileSync('views/SuperAdminView.js', superadminContent, 'utf-8');

console.log('Update UX Admin & SuperAdmin selesai!');
