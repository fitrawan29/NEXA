const fs = require('fs');

let apiCode = fs.readFileSync('src/api.js', 'utf8');

// 1. Patch get_jadwal
const oldGetJadwal = `          case 'get_jadwal': {
            const { data: siswaData } = await supabaseClient.from('siswa').select('kelas').eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn).single();
            let siswaTingkat = null;
            if (siswaData && siswaData.kelas) {
               siswaTingkat = siswaData.kelas.split('|')[0];
            }
            
            let q = supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);
            if (siswaTingkat) {
               q = q.or(\`kelas.eq.\${siswaTingkat},kelas.is.null\`);
            }
            
            const { data, error } = await q.order('waktu_mulai', { ascending: false });
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(j => ({
                ...j,
                nama_guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
                nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown'
              }))
            };
          }`;

const newGetJadwal = `          case 'get_jadwal': {
            const { data: siswaData } = await supabaseClient.from('siswa').select('kelas').eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn).single();
            let siswaTingkat = null;
            if (siswaData && siswaData.kelas) {
               siswaTingkat = siswaData.kelas.split('|')[0];
            }
            
            let q = supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);
            if (siswaTingkat) {
               q = q.or(\`kelas.eq.\${siswaTingkat},kelas.is.null\`);
            }
            
            const { data, error } = await q.order('waktu_mulai', { ascending: false });
            if (error) return { status: 'error', message: error.message };

            // Ambil status_ujian dan is_blocked dari log_ujian
            const { data: logs } = await supabaseClient.from('log_ujian').select('id_jadwal, status_ujian, is_blocked').eq('id_siswa', payload.id_siswa);
            const logMap = {};
            if (logs) {
              logs.forEach(l => { logMap[l.id_jadwal] = l; });
            }

            return {
              status: 'success',
              data: data.map(j => {
                const l = logMap[j.id_jadwal];
                return {
                  ...j,
                  nama_guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
                  nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown',
                  status_siswa: l ? l.status_ujian : null,
                  is_blocked: l ? l.is_blocked : false
                }
              })
            };
          }`;

apiCode = apiCode.replace(oldGetJadwal, newGetJadwal);


// 2. Patch catat_pelanggaran
const oldCatatPelanggaran = `          case 'catat_pelanggaran': {
            const { data: currLog } = await supabaseClient.from('log_ujian').select('pelanggaran').eq('id_log', payload.id_log).single();
            if (!currLog) return { status: 'error', message: 'Log tidak ditemukan' };
            const newPelanggaran = (currLog.pelanggaran || 0) + 1;
            const isBlocked = newPelanggaran >= 3;
            await supabaseClient.from('log_ujian').update({ pelanggaran: newPelanggaran, is_blocked: isBlocked }).eq('id_log', payload.id_log);
            return { status: 'success' };
          }`;

const newCatatPelanggaran = `          case 'catat_pelanggaran': {
            const { data: currLog } = await supabaseClient.from('log_ujian').select('pelanggaran, pelanggaran_detail').eq('id_log', payload.id_log).single();
            if (!currLog) return { status: 'error', message: 'Log tidak ditemukan' };
            const newPelanggaran = (currLog.pelanggaran || 0) + 1;
            const isBlocked = newPelanggaran >= 3;
            const details = Array.isArray(currLog.pelanggaran_detail) ? currLog.pelanggaran_detail : [];
            const waktu = new Date().toISOString();
            details.push({ waktu, alasan: payload.alasan || 'Terdeteksi keluar dari layar penuh atau pindah aplikasi/tab.' });

            await supabaseClient.from('log_ujian').update({ 
               pelanggaran: newPelanggaran, 
               is_blocked: isBlocked,
               pelanggaran_detail: details
            }).eq('id_log', payload.id_log);
            
            return { status: 'success', pelanggaran_saat_ini: newPelanggaran, terblokir: isBlocked };
          }`;

apiCode = apiCode.replace(oldCatatPelanggaran, newCatatPelanggaran);

fs.writeFileSync('src/api.js', apiCode);
console.log("api.js patched!");
