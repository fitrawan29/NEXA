    // Fungsi fetchAPI sebagai Router Supabase

    const generateId = (prefix) => `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    const fetchAPI = async (action, payload = {}) => {
      try {
        let data, error;
        switch (action) {
          // ================= AUTH =================
          case 'login': {
            if (payload.role === 'super_admin') {
              ({ data, error } = await supabaseClient
                .from('super_admin')
                .select('*')
                .eq('username', payload.username)
                .eq('password', payload.password)
                .single());
              if (error || !data) return { status: 'error', message: 'Username atau password Super Admin salah.' };
              data.role = 'super_admin';
              return { status: 'success', data };
            }

            const table = payload.role === 'admin' ? 'admin' : (payload.role === 'guru' ? 'guru' : 'siswa');
            ({ data, error } = await supabaseClient
              .from(table)
              .select('*')
              .eq('username', payload.username)
              .eq('password', payload.password)
              .eq('npsn', payload.npsn)
              .single());
            if (error || !data) return { status: 'error', message: 'Username, password, atau NPSN salah.' };
            data.role = payload.role;
            return { status: 'success', data };
          }
          case 'register': {
            ({ data, error } = await supabaseClient
              .from('siswa')
              .insert([{
                id_siswa: payload.identitas || crypto.randomUUID(),
                nama_lengkap: payload.nama,
                username: payload.username,
                password: payload.password,
                npsn: payload.npsn
              }]));
            if (error) {
              if (error.code === '23505') return { status: 'error', message: 'Username sudah terdaftar.' };
              return { status: 'error', message: error.message };
            }
            return { status: 'success', message: 'Pendaftaran berhasil. Silakan login.' };
          }

          // ================= SUPER ADMIN =================
          case 'update_superadmin_password': {
            ({ error } = await supabaseClient.from('super_admin').update({ password: payload.password }).eq('username', payload.username));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Password Super Admin berhasil diperbarui.' };
          }
          case 'get_sekolah': {
            ({ data, error } = await supabaseClient.from('sekolah').select('*').order('created_at', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_sekolah': {
            ({ error } = await supabaseClient.from('sekolah').insert([{ npsn: payload.npsn, nama_sekolah: payload.nama_sekolah }]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sekolah berhasil ditambahkan.' };
          }
          case 'delete_sekolah': {
            ({ error } = await supabaseClient.from('sekolah').delete().eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sekolah berhasil dihapus.' };
          }
          case 'update_sekolah': {
            ({ error } = await supabaseClient.from('sekolah').update({ nama_sekolah: payload.nama_sekolah }).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sekolah berhasil diperbarui.' };
          }
          case 'get_admin_all': {
            ({ data, error } = await supabaseClient.from('admin').select('*, sekolah(nama_sekolah)').order('created_at', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_admin_sekolah': {
            ({ error } = await supabaseClient.from('admin').insert([{ 
              id_admin: crypto.randomUUID(),
              nama_lengkap: payload.nama_lengkap, 
              username: payload.username,
              password: payload.password,
              npsn: payload.npsn
            }]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Admin Sekolah berhasil dibuat.' };
          }
          case 'delete_admin_sekolah': {
            ({ error } = await supabaseClient.from('admin').delete().eq('id_admin', payload.id_admin));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Admin Sekolah berhasil dihapus.' };
          }
          case 'update_admin_sekolah': {
            const updateData = {
              nama_lengkap: payload.nama_lengkap,
              username: payload.username,
              npsn: payload.npsn
            };
            if (payload.password) updateData.password = payload.password;
            
            ({ error } = await supabaseClient.from('admin').update(updateData).eq('id_admin', payload.id_admin));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Admin Sekolah berhasil diperbarui.' };
          }

          // ================= ADMIN DASHBOARD =================
          case 'get_admin_dashboard_data': {
            const [siswaRes, guruRes, jadwalRes, aktifRes] = await Promise.all([
              supabaseClient.from('siswa').select('id_siswa', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('guru').select('id_guru', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('jadwal').select('id_jadwal', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('log_ujian').select('id_log, jadwal!inner(npsn)', { count: 'exact' }).eq('status_ujian', 'SEDANG KERJA').eq('jadwal.npsn', payload.npsn)
            ]);

            const { data: jadwalAktifData } = await supabaseClient
              .from('jadwal')
              .select('id_jadwal, waktu_mulai, waktu_selesai, guru(nama_lengkap), mata_pelajaran(nama_mapel)')
              .eq('npsn', payload.npsn)
              .limit(5);

            return {
              status: 'success',
              data: {
                totalSiswa: siswaRes.count || 0,
                totalGuru: guruRes.count || 0,
                totalJadwal: jadwalRes.count || 0,
                totalSesiAktif: aktifRes.count || 0,
                jadwalAktif: (jadwalAktifData || []).map(j => ({
                  id_jadwal: j.id_jadwal,
                  nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown',
                  guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
                  waktu_mulai: j.waktu_mulai,
                  waktu_selesai: j.waktu_selesai
                }))
              }
            };
          }

          // ================= CRUD ADMIN =================
          case 'get_siswa': {
            ({ data, error } = await supabaseClient.from('siswa').select('*').eq('npsn', payload.npsn).order('created_at', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_siswa': {
            if (!payload.id_siswa) payload.id_siswa = generateId('S');
            ({ error } = await supabaseClient.from('siswa').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil ditambahkan' };
          }
          case 'create_siswa_bulk': {
            const bulkData = payload.map(item => ({ ...item, id_siswa: item.id_siswa || generateId('S') }));
            ({ error } = await supabaseClient.from('siswa').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil ditambahkan secara massal' };
          }
          case 'update_siswa': {
            const { id_siswa, npsn, ...updates } = payload; // Extract npsn so it's not updated unintentionally
            ({ error } = await supabaseClient.from('siswa').update(updates).eq('id_siswa', id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil diperbarui' };
          }
          case 'delete_siswa': {
            ({ error } = await supabaseClient.from('siswa').delete().eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil dihapus' };
          }

          // GURU
          case 'get_guru': {
            ({ data, error } = await supabaseClient.from('guru').select('*, guru_mapel(id_mapel, mata_pelajaran(nama_mapel))').eq('npsn', payload.npsn).order('created_at', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            const processedData = data.map(g => {
              const mapels = g.guru_mapel ? g.guru_mapel.map(gm => gm.mata_pelajaran?.nama_mapel).filter(Boolean) : [];
              const idMapels = g.guru_mapel ? g.guru_mapel.map(gm => gm.id_mapel) : [];
              return {
                ...g,
                mapels_list: mapels.join(', ') || '-',
                id_mapels: idMapels
              };
            });
            return { status: 'success', data: processedData };
          }
          case 'create_guru': {
            if (!payload.id_guru) payload.id_guru = generateId('G');
            const { mapels, ...guruData } = payload;
            const res = await supabaseClient.from('guru').insert([guruData]).select();
            if (res.error) return { status: 'error', message: res.error.message };
            if (mapels && mapels.length > 0) {
              const mapelInserts = mapels.map(m => ({ id_guru: guruData.id_guru, id_mapel: m }));
              await supabaseClient.from('guru_mapel').insert(mapelInserts);
            }
            return { status: 'success', message: 'Guru berhasil ditambahkan' };
          }
          case 'create_guru_bulk': {
            const bulkData = payload.map(item => ({ ...item, id_guru: item.id_guru || generateId('G') }));
            ({ error } = await supabaseClient.from('guru').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Guru berhasil ditambahkan secara massal' };
          }
          case 'update_guru': {
            const { id_guru, mapels, npsn, ...updates } = payload;
            const res = await supabaseClient.from('guru').update(updates).eq('id_guru', id_guru).eq('npsn', payload.npsn);
            if (res.error) return { status: 'error', message: res.error.message };
            // delete old guru_mapel
            await supabaseClient.from('guru_mapel').delete().eq('id_guru', id_guru);
            // insert new guru_mapel
            if (mapels && mapels.length > 0) {
              const mapelInserts = mapels.map(m => ({ id_guru, id_mapel: m }));
              await supabaseClient.from('guru_mapel').insert(mapelInserts);
            }
            return { status: 'success', message: 'Guru berhasil diperbarui' };
          }
          case 'delete_guru': {
            ({ error } = await supabaseClient.from('guru').delete().eq('id_guru', payload.id_guru).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Guru berhasil dihapus' };
          }

          // MATA PELAJARAN
          case 'get_all_mapel': {
            ({ data, error } = await supabaseClient.from('mata_pelajaran').select('*').eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_mapel': {
            if (!payload.id_mapel) payload.id_mapel = generateId('M');
            ({ error } = await supabaseClient.from('mata_pelajaran').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Mata pelajaran berhasil ditambahkan' };
          }
          case 'create_mapel_bulk': {
            const bulkData = payload.map(item => ({ ...item, id_mapel: item.id_mapel || generateId('M') }));
            ({ error } = await supabaseClient.from('mata_pelajaran').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Mata pelajaran berhasil ditambahkan secara massal' };
          }
          case 'update_mapel': {
            const { id_mapel, npsn, ...updates } = payload;
            ({ error } = await supabaseClient.from('mata_pelajaran').update(updates).eq('id_mapel', id_mapel).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Mata pelajaran berhasil diperbarui' };
          }
          case 'delete_mapel': {
            ({ error } = await supabaseClient.from('mata_pelajaran').delete().eq('id_mapel', payload.id_mapel).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Mata pelajaran berhasil dihapus' };
          }

          case 'get_all_jadwal': {
            ({ data, error } = await supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(j => ({
                ...j,
                guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
                nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown'
              }))
            };
          }

          case 'create_jadwal': {
            if (!payload.id_jadwal) payload.id_jadwal = generateId('U');
            ({ error } = await supabaseClient.from('jadwal').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil ditambahkan' };
          }
          case 'create_jadwal_bulk': {
            const bulkData = payload.map(item => ({ ...item, id_jadwal: item.id_jadwal || generateId('U') }));
            ({ error } = await supabaseClient.from('jadwal').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil ditambahkan secara massal' };
          }

          case 'delete_jadwal': {
            ({ error } = await supabaseClient.from('jadwal').delete().eq('id_jadwal', payload.id_jadwal).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil dihapus.' };
          }

          // ================= GURU / PENGAWAS =================
          case 'get_jadwal_pengawas': {
            let q = supabaseClient.from('jadwal').select('*, mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);
            if (payload.id_guru) q = q.eq('id_guru', payload.id_guru);
            ({ data, error } = await q);
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(j => ({ ...j, nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown' }))
            };
          }

          case 'get_mapel_guru': {
            // guru_mapel is intrinsically tied to guru, but we can trust id_guru
            ({ data, error } = await supabaseClient.from('guru_mapel').select('*, mata_pelajaran(nama_mapel)').eq('id_guru', payload.id_guru));
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(gm => ({ ...gm, nama_mapel: gm.mata_pelajaran ? gm.mata_pelajaran.nama_mapel : 'Unknown' }))
            };
          }

          case 'get_soal_by_mapel': {
            ({ data, error } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', payload.id_mapel).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }

          case 'create_soal_mapel': {
            ({ error } = await supabaseClient.from('soal_ujian').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil ditambahkan.' };
          }

          case 'update_soal_mapel': {
            const { id_soal, npsn, ...updates } = payload;
            ({ error } = await supabaseClient.from('soal_ujian').update(updates).eq('id_soal', id_soal).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil diperbarui.' };
          }

          case 'delete_soal_mapel': {
            ({ error } = await supabaseClient.from('soal_ujian').delete().eq('id_soal', payload.id_soal).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil dihapus.' };
          }

          case 'get_jawaban_uraian': {
            ({ data, error } = await supabaseClient.from('jawaban_siswa').select('*, soal_ujian(pertanyaan)').eq('id_log', payload.id_log).eq('is_uraian', true));
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(j => ({ ...j, pertanyaan: j.soal_ujian ? j.soal_ujian.pertanyaan : 'Unknown' }))
            };
          }

          case 'update_nilai_uraian': {
            const { id_log, nilai_uraian_total } = payload;
            ({ error } = await supabaseClient.from('log_ujian').update({ nilai_uraian: nilai_uraian_total }).eq('id_log', id_log));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Nilai uraian berhasil disimpan.' };
          }

          case 'get_token': {
            ({ data, error } = await supabaseClient.from('jadwal').select('token_aktif, last_update_token').eq('id_jadwal', payload.id_jadwal).single());
            if (error) return { status: 'error', message: error.message };

            let token = data.token_aktif;
            let lastUpdate = data.last_update_token ? new Date(data.last_update_token).getTime() : 0;
            let now = new Date().getTime();

            if (now - lastUpdate > 300000 || !token) {
              token = Math.random().toString(36).substring(2, 8).toUpperCase();
              await supabaseClient.from('jadwal').update({
                token_aktif: token,
                last_update_token: new Date().toISOString()
              }).eq('id_jadwal', payload.id_jadwal);
            }
            return { status: 'success', token };
          }

          case 'monitoring_ujian': {
            ({ data, error } = await supabaseClient.from('log_ujian').select('*, siswa!inner(nama_lengkap, npsn)').eq('id_jadwal', payload.id_jadwal).eq('siswa.npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(l => ({ ...l, nama_lengkap: l.siswa ? l.siswa.nama_lengkap : 'Unknown' }))
            };
          }

          case 'get_hasil_ujian': {
            ({ data, error } = await supabaseClient.from('log_ujian').select('*, siswa!inner(nama_lengkap, angkatan, kelas_paralel, npsn)').eq('id_jadwal', payload.id_jadwal).eq('status_ujian', 'SELESAI').eq('siswa.npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(l => ({
                ...l,
                nama_lengkap: l.siswa ? l.siswa.nama_lengkap : 'Unknown',
                angkatan: l.siswa ? l.siswa.angkatan : '-',
                kelas_paralel: l.siswa ? l.siswa.kelas_paralel : '-',
                total_nilai: (Number(l.nilai_auto) || 0) + (Number(l.nilai_uraian) || 0)
              }))
            };
          }

          case 'buka_blokir': {
            ({ error } = await supabaseClient.from('log_ujian').update({ is_blocked: false }).eq('id_log', payload.id_log));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Blokir berhasil dibuka.' };
          }

          case 'submit_nilai_uraian': {
            ({ error } = await supabaseClient.from('log_ujian').update({ nilai_uraian: payload.nilai }).eq('id_log', payload.id_log));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Nilai uraian berhasil diupdate.' };
          }

          // ================= SISWA =================
          case 'get_jadwal': {
            ({ data, error } = await supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: data.map(j => ({
                ...j,
                nama_guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
                nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown'
              }))
            };
          }

          case 'mulai_ujian': {
            ({ data, error } = await supabaseClient.from('jadwal').select('token_aktif, waktu_selesai').eq('id_jadwal', payload.id_jadwal).eq('npsn', payload.npsn).single());
            if (error || !data) return { status: 'error', message: 'Jadwal tidak ditemukan.' };
            if (new Date(data.waktu_selesai) < new Date()) return { status: 'error', message: 'Ujian sudah berakhir.' };
            if (data.token_aktif !== payload.token) return { status: 'error', message: 'Token tidak valid atau sudah expired.' };

            const { data: logData } = await supabaseClient.from('log_ujian').select('*').eq('id_siswa', payload.id_siswa).eq('id_jadwal', payload.id_jadwal).single();
            let idLog = logData ? logData.id_log : null;

            if (logData) {
              if (logData.is_blocked) return { status: 'error', message: 'Akun Anda diblokir dari ujian ini.' };
              if (logData.status_ujian === 'SELESAI') return { status: 'error', message: 'Anda sudah menyelesaikan ujian ini.' };
            } else {
              idLog = 'LOG-' + Math.random().toString(36).substr(2, 9);
              await supabaseClient.from('log_ujian').insert([{
                id_log: idLog,
                id_jadwal: payload.id_jadwal,
                id_siswa: payload.id_siswa,
                status_ujian: 'SEDANG KERJA'
              }]);
            }
            return { status: 'success', id_log: idLog };
          }

          case 'get_soal_ujian': {
            const { data: jadwal } = await supabaseClient.from('jadwal').select('id_mapel').eq('id_jadwal', payload.id_jadwal).single();
            if (!jadwal) return { status: 'error', message: 'Jadwal tidak ditemukan' };
            ({ data, error } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', jadwal.id_mapel).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }

          case 'catat_pelanggaran': {
            const { data: currLog } = await supabaseClient.from('log_ujian').select('pelanggaran').eq('id_log', payload.id_log).single();
            if (!currLog) return { status: 'error', message: 'Log tidak ditemukan' };
            const newPelanggaran = (currLog.pelanggaran || 0) + 1;
            const isBlocked = newPelanggaran >= 3;
            await supabaseClient.from('log_ujian').update({ pelanggaran: newPelanggaran, is_blocked: isBlocked }).eq('id_log', payload.id_log);
            return { status: 'success' };
          }

          case 'submit_ujian': {
            const logId = payload.id_log;
            const jawaban = payload.jawaban; 
            const idSiswa = payload.id_siswa;

            const { data: jadwal } = await supabaseClient.from('jadwal').select('id_mapel').eq('id_jadwal', payload.id_jadwal).single();
            const { data: soalData } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', jadwal?.id_mapel).eq('npsn', payload.npsn);
            
            let totalSkorMaxAuto = 0;
            let totalSkorDiperolehAuto = 0;
            let insertJawaban = [];

            if (soalData) {
              for (const soal of soalData) {
                let jwb = jawaban[soal.id_soal];
                let isCorrect = false;
                let skorDiperoleh = 0;
                let bobot = Number(soal.bobot) || 1;
                
                if (soal.tipe_soal !== 'URAIAN') {
                  totalSkorMaxAuto += bobot;
                }

                if (jwb !== undefined && jwb !== null) {
                  if (soal.tipe_soal === 'PG' || soal.tipe_soal === 'BS' || soal.tipe_soal === 'ISIAN') {
                    if (String(jwb).trim().toLowerCase() === String(soal.kunci_jawaban).trim().toLowerCase()) {
                      isCorrect = true;
                      skorDiperoleh = bobot;
                    }
                  } else if (soal.tipe_soal === 'PGK') {
                    try {
                      let kunciArr = JSON.parse(soal.kunci_jawaban);
                      if (Array.isArray(jwb) && jwb.length === kunciArr.length && jwb.every(v => kunciArr.includes(v))) {
                        isCorrect = true;
                        skorDiperoleh = bobot;
                      }
                    } catch (e) {}
                  } else if (soal.tipe_soal === 'JODOH') {
                    try {
                      let kunciObj = JSON.parse(soal.kunci_jawaban);
                      let jwbObj = typeof jwb === 'string' ? JSON.parse(jwb) : jwb;
                      let isMatch = true;
                      for (let key in kunciObj) {
                        if (kunciObj[key] !== jwbObj[key]) isMatch = false;
                      }
                      if (isMatch) {
                        isCorrect = true;
                        skorDiperoleh = bobot;
                      }
                    } catch (e) {}
                  }
                }

                let stringJawaban = (typeof jwb === 'object') ? JSON.stringify(jwb) : String(jwb || '');

                insertJawaban.push({
                  id_jawaban: 'JWB-' + Math.random().toString(36).substr(2, 9),
                  id_log: logId,
                  id_soal: soal.id_soal,
                  jawaban_user: stringJawaban,
                  is_correct: isCorrect,
                  skor_diperoleh: skorDiperoleh,
                  is_uraian: soal.tipe_soal === 'URAIAN'
                });
                
                totalSkorDiperolehAuto += skorDiperoleh;
              }
            }

            await supabaseClient.from('jawaban_siswa').delete().eq('id_log', logId);
            if (insertJawaban.length > 0) {
              await supabaseClient.from('jawaban_siswa').insert(insertJawaban);
            }

            let nilaiAuto = 0;
            if (totalSkorMaxAuto > 0) {
              nilaiAuto = (totalSkorDiperolehAuto / totalSkorMaxAuto) * 100;
              nilaiAuto = Math.round(nilaiAuto * 100) / 100;
            }

            await supabaseClient.from('log_ujian').update({
              status_ujian: 'SELESAI',
              nilai_auto: nilaiAuto
            }).eq('id_log', logId);

            return { status: 'success', message: 'Ujian berhasil diselesaikan.', nilai_auto: nilaiAuto };
          }

          default:
            return { status: 'error', message: 'Action tidak dikenali oleh router Supabase.' };
        }
      } catch (error) {
        console.error("Supabase Error:", error);
        return { status: 'error', message: error.message };
      }
    };