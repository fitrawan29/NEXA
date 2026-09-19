const fs = require('fs');
let code = fs.readFileSync('src/views/SiswaView.jsx', 'utf8');

const oldButton = `<button onClick={() => !isBelumMulai && !j.is_blocked && j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={isBelumMulai || j.status_siswa === 'SELESAI' || (j.is_blocked && j.status_siswa !== 'SELESAI')} className={\`px-4 py-1.5 rounded-full text-xs font-bold \${statusBtnClass}\`}>`;

const newButton = `<button onClick={() => {
                if (j.is_blocked && j.status_siswa !== 'SELESAI') {
                  showMessage('Akses Terblokir', 'Akun Anda telah diblokir dari ujian ini karena terindikasi melakukan pelanggaran. Silakan hubungi Admin Sekolah atau Guru Pengampu mata pelajaran ini untuk membuka blokir Anda.', 'error');
                  return;
                }
                if (!isBelumMulai && j.status_siswa !== 'SELESAI') {
                  setSelectedJadwalUntukToken(j.id_jadwal);
                }
              }} disabled={isBelumMulai || j.status_siswa === 'SELESAI'} className={\`px-4 py-1.5 rounded-full text-xs font-bold transition-all \${statusBtnClass}\`}>`;

code = code.replace(oldButton, newButton);
fs.writeFileSync('src/views/SiswaView.jsx', code);
