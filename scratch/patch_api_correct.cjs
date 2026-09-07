const fs = require('fs');

let lines = fs.readFileSync('src/api.js', 'utf8').split('\n');

let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   if (line.includes("case 'get_jadwal': {")) {
       newLines.push(line);
       newLines.push("              const { data: siswaData } = await supabaseClient.from('siswa').select('kelas').eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn).single();");
       newLines.push("              let siswaTingkat = null;");
       newLines.push("              if (siswaData && siswaData.kelas) {");
       newLines.push("                 siswaTingkat = siswaData.kelas.split('|')[0];");
       newLines.push("              }");
       newLines.push("              ");
       newLines.push("              let q = supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);");
       newLines.push("              if (siswaTingkat) {");
       newLines.push("                 q = q.or(`kelas.eq.${siswaTingkat},kelas.is.null`);");
       newLines.push("              }");
       newLines.push("              ");
       newLines.push("              const { data, error } = await q.order('waktu_mulai', { ascending: false });");
       newLines.push("              if (error) return { status: 'error', message: error.message };");
       newLines.push("");
       newLines.push("              const { data: logs } = await supabaseClient.from('log_ujian').select('id_jadwal, status_ujian, is_blocked').eq('id_siswa', payload.id_siswa);");
       newLines.push("              const logMap = {};");
       newLines.push("              if (logs) {");
       newLines.push("                logs.forEach(l => { logMap[l.id_jadwal] = l; });");
       newLines.push("              }");
       newLines.push("");
       newLines.push("              return {");
       newLines.push("                status: 'success',");
       newLines.push("                data: data.map(j => {");
       newLines.push("                  const l = logMap[j.id_jadwal];");
       newLines.push("                  return {");
       newLines.push("                    ...j,");
       newLines.push("                    nama_guru: j.guru ? j.guru.nama_lengkap : 'Unknown',");
       newLines.push("                    nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown',");
       newLines.push("                    status_siswa: l ? l.status_ujian : null,");
       newLines.push("                    is_blocked: l ? l.is_blocked : false");
       newLines.push("                  }");
       newLines.push("                })");
       newLines.push("              };");
       newLines.push("            }");
       
       skip = true;
       continue;
   }

   if (skip && line.includes("case 'mulai_ujian': {")) {
       skip = false;
   }

   if (!skip && line.includes("case 'catat_pelanggaran': {")) {
       newLines.push(line);
       newLines.push("              const { data: currLog } = await supabaseClient.from('log_ujian').select('pelanggaran, pelanggaran_detail').eq('id_log', payload.id_log).single();");
       newLines.push("              if (!currLog) return { status: 'error', message: 'Log tidak ditemukan' };");
       newLines.push("              const newPelanggaran = (currLog.pelanggaran || 0) + 1;");
       newLines.push("              const isBlocked = newPelanggaran >= 3;");
       newLines.push("              const details = Array.isArray(currLog.pelanggaran_detail) ? currLog.pelanggaran_detail : [];");
       newLines.push("              const waktu = new Date().toISOString();");
       newLines.push("              details.push({ waktu, alasan: payload.alasan || 'Terdeteksi keluar dari layar penuh atau pindah aplikasi/tab.' });");
       newLines.push("");
       newLines.push("              await supabaseClient.from('log_ujian').update({ ");
       newLines.push("                 pelanggaran: newPelanggaran, ");
       newLines.push("                 is_blocked: isBlocked,");
       newLines.push("                 pelanggaran_detail: details");
       newLines.push("              }).eq('id_log', payload.id_log);");
       newLines.push("              ");
       newLines.push("              return { status: 'success', pelanggaran_saat_ini: newPelanggaran, terblokir: isBlocked };");
       newLines.push("            }");
       
       skip = true;
       continue;
   }

   if (skip && line.includes("case 'submit_ujian': {")) {
       skip = false;
   }

   if (!skip) {
       newLines.push(line);
   }
}

fs.writeFileSync('src/api.js', newLines.join('\n'));
console.log("api.js patched correctly!");
