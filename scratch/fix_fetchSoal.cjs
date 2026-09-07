const fs = require('fs');
let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

const regexOpsi = /if \(jadwal\.acak_opsi && parsedOpsi[\s\S]*?\}\n\s*\}/;
const newOpsi = `const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);
            if (jadwal.acak_opsi && parsedOpsi && (s.tipe_soal === 'PG' || s.tipe_soal === 'PGK')) {
              seededShuffle(parsedOpsi, seed + (s.id_soal || 0));
            }`;

code = code.replace(regexOpsi, newOpsi);

const regexSoal = /if \(jadwal\.acak_soal\) \{[\s\S]*?\}\n\s*\}/;
const newSoal = `if (jadwal.acak_soal) {
             const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);
             seededShuffle(parsedSoal, seed);
          }`;

code = code.replace(regexSoal, newSoal);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("Patched fetchSoal!");
