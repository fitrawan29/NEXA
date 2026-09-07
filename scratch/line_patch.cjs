const fs = require('fs');
const lines = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8').split('\n');

let inOpsi = false;
let inSoal = false;

let newLines = [];
for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   if (line.includes("if (jadwal.acak_opsi && parsedOpsi && (s.tipe_soal === 'PG' || s.tipe_soal === 'PGK')) {")) {
      newLines.push("            const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);");
      newLines.push(line);
      newLines.push("              seededShuffle(parsedOpsi, seed + (s.id_soal || 0));");
      i += 4; // skip the next 4 lines of Math.random logic
      continue;
   }

   if (line.includes("if (jadwal.acak_soal) {")) {
      newLines.push(line);
      newLines.push("            const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);");
      newLines.push("            seededShuffle(parsedSoal, seed);");
      i += 4;
      continue;
   }
   
   newLines.push(line);
}

fs.writeFileSync('src/views/ExamRoom.jsx', newLines.join('\n'));
console.log("Line by line patched successfully!");
