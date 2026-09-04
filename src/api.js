import { supabaseClient } from './config.js';
import React from 'react';

    // Fungsi fetchAPI sebagai Router Supabase
    export const generateId = (prefix) => `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    let timeOffset = 0;
    let syncPromise = null;
    export const getTrueNow = async () => {
      if (!syncPromise) {
        syncPromise = (async () => {
          try {
            const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
            if (!res.ok) throw new Error('API down');
            const data = await res.json();
            timeOffset = new Date(data.datetime).getTime() - Date.now();
          } catch (error) {
            console.warn('Failed to sync network time, using local time.', error);
          }
        })();
      }
      await syncPromise;
      return new Date(Date.now() + timeOffset);
    };

    const generateComplexToken = (idJadwal) => {
      const suffix = idJadwal ? idJadwal.substring(idJadwal.length - 2).toUpperCase() : 'XX';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const nums = '0123456789';
      let randomPart = '';
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      randomPart += nums.charAt(Math.floor(Math.random() * nums.length));
      for (let i = 0; i < 2; i++) {
        const all = chars + nums;
        randomPart += all.charAt(Math.floor(Math.random() * all.length));
      }
      const arr = randomPart.split('');
      arr.sort(() => Math.random() - 0.5);
      return suffix + arr.join('');
    };


    // Note: Database uses `id_mapel` now, `id_jadwal` column in `soal_ujian` might still exist but `id_mapel` is what we use.

    const processJadwalData = async (data, now) => {
      return await Promise.all(data.map(async (j) => {
        let currentStatus = 'BELUM MULAI';
        if (j.waktu_mulai && j.waktu_selesai) {
          const mulai = new Date(j.waktu_mulai);
          const selesai = new Date(j.waktu_selesai);
          if (now >= mulai && now <= selesai) {
            currentStatus = 'AKTIF';
          } else if (now > selesai) {
            currentStatus = 'SELESAI';
          }
        }
        
        let tokenAktif = j.token_aktif;
        let lastUpdate = j.last_update_token ? new Date(j.last_update_token).getTime() : 0;
        
        if (currentStatus === 'AKTIF') {
            if (!tokenAktif || (now.getTime() - lastUpdate > 480000)) { 
                tokenAktif = generateComplexToken(j.id_jadwal);
                
                await supabaseClient.from('jadwal').update({
                   token_aktif: tokenAktif,
                   last_update_token: now.toISOString()
                }).eq('id_jadwal', j.id_jadwal);
            }
        } else {
            if (tokenAktif) {
                tokenAktif = null;
                await supabaseClient.from('jadwal').update({
                   token_aktif: null,
                   last_update_token: null
                }).eq('id_jadwal', j.id_jadwal);
            }
        }

        return {
          ...j,
          status_ujian: currentStatus,
          token: tokenAktif,
          guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
          nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown'
        };
      }));
    };

    export const fetchAPI = async (action, payload = {}) => {
      try {
        // ================= APPLICATION-LEVEL RLS =================
        // Menolak kueri jika npsn tidak disertakan untuk rute non-global
        const globalRoutes = ['login', 'register', 'get_sekolah', 'create_sekolah', 'delete_sekolah', 'update_sekolah', 'get_admin_all', 'create_admin_sekolah', 'update_admin_sekolah', 'delete_admin_sekolah', 'get_analytics', 'update_admin_profil', 'get_pengumuman_global', 'create_pengumuman_global', 'delete_pengumuman_global', 'get_log_aktivitas_global', 'create_log_aktivitas_global', 'update_sekolah_status', 'update_superadmin_password', 'reset_all_data'];
        if (!globalRoutes.includes(action)) {
          if (Array.isArray(payload)) {
            if (payload.some(p => !p.npsn)) throw new Error("Security Violation: Akses ditolak. NPSN hilang pada bulk payload.");
          } else {
            if (!payload.npsn) throw new Error("Security Violation: Akses ditolak. Kueri tidak memiliki parameter NPSN.");
          }
        }

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
            
            // Periksa proteksi multi-login khusus Siswa
            if (payload.role === 'siswa') {
               if (data.session_token) {
                  return { status: 'error', message: 'Akun Anda sedang digunakan di perangkat lain. Minta admin mereset sesi Anda.' };
               }
               // Generate and set new session_token
               const newSessionToken = crypto.randomUUID();
               const { error: updateErr } = await supabaseClient
                  .from('siswa')
                  .update({ session_token: newSessionToken })
                  .eq('id_siswa', data.id_siswa);
               if (updateErr) return { status: 'error', message: 'Gagal membuat sesi aman.' };
               
               data.session_token = newSessionToken;
            }

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
            const { data: adminData, error: adminErr } = await supabaseClient.from('admin').select('*').order('created_at', { ascending: false });
            if (adminErr) return { status: 'error', message: adminErr.message };
            const { data: sekolahData } = await supabaseClient.from('sekolah').select('npsn, nama_sekolah');
            const data = adminData.map(a => ({
               ...a,
               sekolah: sekolahData?.find(s => s.npsn === a.npsn) || { nama_sekolah: 'Unknown' }
            }));
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
          case 'update_admin_profil': {
            const updateData = {};
            if (payload.password) updateData.password = payload.password;
            if (payload.foto_profil) updateData.foto_profil = payload.foto_profil;
            ({ error } = await supabaseClient.from('admin').update(updateData).eq('id_admin', payload.id_admin));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Profil berhasil diperbarui. Silakan masuk kembali.' };
          }

          // ================= SUPERADMIN ANALYTICS =================
          case 'get_analytics': {
            const { data: sekolahData, error: sekolahErr } = await supabaseClient.from('sekolah').select('npsn, nama_sekolah');
            if (sekolahErr) return { status: 'error', message: sekolahErr.message };

            // We count items per school manually since Supabase client doesn't support complex GROUP BY out of the box easily.
            // For production, a custom PostgreSQL function/RPC is highly recommended.
            const stats = await Promise.all(sekolahData.map(async (s) => {
              const [siswaRes, guruRes, soalRes] = await Promise.all([
                supabaseClient.from('siswa').select('id_siswa', { count: 'exact' }).eq('npsn', s.npsn),
                supabaseClient.from('guru').select('id_guru', { count: 'exact' }).eq('npsn', s.npsn),
                supabaseClient.from('soal_ujian').select('id_soal', { count: 'exact' }).eq('npsn', s.npsn)
              ]);
              return {
                npsn: s.npsn,
                nama_sekolah: s.nama_sekolah,
                total_siswa: siswaRes.count || 0,
                total_guru: guruRes.count || 0,
                total_soal: soalRes.count || 0
              };
            }));
            
            // Calculate global concurrent users
            const { count: concurrentUsers } = await supabaseClient
              .from('log_ujian')
              .select('id_log', { count: 'exact', head: true })
              .eq('status_ujian', 'SEDANG KERJA');

            return { status: 'success', data: { stats, concurrentUsers: concurrentUsers || 0 } };
          }

          // ================= PENGUMUMAN & LOG GLOBAL =================
          case 'get_pengumuman_global': {
            ({ data, error } = await supabaseClient.from('pengumuman_global').select('*').order('created_at', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_pengumuman_global': {
            ({ error } = await supabaseClient.from('pengumuman_global').insert([{ judul: payload.judul, isi: payload.isi, tipe: payload.tipe }]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Pengumuman berhasil ditambahkan.' };
          }
          case 'delete_pengumuman_global': {
            ({ error } = await supabaseClient.from('pengumuman_global').delete().eq('id_pengumuman', payload.id_pengumuman));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Pengumuman berhasil dihapus.' };
          }
          case 'get_log_aktivitas_global': {
            ({ data, error } = await supabaseClient.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_log_aktivitas_global': {
            ({ error } = await supabaseClient.from('log_aktivitas_global').insert([{ username: payload.username, role: payload.role, action: payload.action, detail: payload.detail }]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Log dicatat.' };
          }

          // ================= ADMIN DASHBOARD =================
          case 'get_bank_soal_admin': {
            const { data, error } = await supabaseClient.from('soal').select('*, mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn).order('created_at', { ascending: false });
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          
          case 'get_admin_dashboard_data': {
            const [siswaRes, guruRes, jadwalRes, aktifRes, mapelRes, soalRes] = await Promise.all([
              supabaseClient.from('siswa').select('id_siswa', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('guru').select('id_guru', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('jadwal').select('id_jadwal', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('log_ujian').select('id_log, jadwal!inner(npsn)', { count: 'exact' }).eq('status_ujian', 'SEDANG KERJA').eq('jadwal.npsn', payload.npsn),
              supabaseClient.from('mata_pelajaran').select('id_mapel', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('bank_soal').select('id_soal', { count: 'exact' }).eq('npsn', payload.npsn)
            ]);

            const { data: allJadwalData } = await supabaseClient
              .from('jadwal')
              .select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)')
              .eq('npsn', payload.npsn);
            
            const now = await getTrueNow();
            const processedJadwal = await processJadwalData(allJadwalData || [], now);
            const jadwalAktifList = processedJadwal.filter(j => j.status_ujian === 'AKTIF').slice(0, 5);

            return {
              status: 'success',
              data: {
                totalSiswa: siswaRes.count || 0,
                totalGuru: guruRes.count || 0,
                totalJadwal: jadwalRes.count || 0,
                totalSesiAktif: aktifRes.count || 0,
                totalMapel: mapelRes.count || 0,
                totalSoal: soalRes.count || 0,
                jadwalAktif: jadwalAktifList.map(j => ({
                  id_jadwal: j.id_jadwal,
                  nama_mapel: j.nama_mapel,
                  guru: j.guru,
                  waktu_mulai: j.waktu_mulai,
                  waktu_selesai: j.waktu_selesai,
                  token: j.token
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
            const { data: existingSiswa } = await supabaseClient.from('siswa').select('id_siswa').eq('nisn', payload.nisn).maybeSingle();
            if (existingSiswa) return { status: 'error', message: 'Siswa dengan NISN ini sudah terdaftar.' };

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
            
            if (updates.nisn) {
              const { data: existingSiswa } = await supabaseClient.from('siswa').select('id_siswa').eq('nisn', updates.nisn).neq('id_siswa', id_siswa).maybeSingle();
              if (existingSiswa) return { status: 'error', message: 'Siswa dengan NISN ini sudah terdaftar pada pengguna lain.' };
            }

            ({ error } = await supabaseClient.from('siswa').update(updates).eq('id_siswa', id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil diperbarui' };
          }
          case 'delete_siswa': {
            ({ error } = await supabaseClient.from('siswa').delete().eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil dihapus' };
          }
          case 'reset_sesi_siswa': {
            ({ error } = await supabaseClient.from('log_ujian').delete().eq('id_siswa', payload.id_siswa).eq('status_ujian', 'SEDANG KERJA'));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sesi siswa berhasil direset' };
          }
          case 'get_kelas': {
            ({ data, error } = await supabaseClient.from('kelas').select('*').eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_kelas': {
            payload.id_kelas = generateId('KLS');
            ({ error } = await supabaseClient.from('kelas').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Kelas berhasil ditambahkan' };
          }
          case 'update_kelas': {
            const { id_kelas, npsn, ...updates } = payload;
            ({ error } = await supabaseClient.from('kelas').update(updates).eq('id_kelas', id_kelas).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Kelas berhasil diperbarui' };
          }
          case 'delete_kelas': {
            ({ error } = await supabaseClient.from('kelas').delete().eq('id_kelas', payload.id_kelas).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil dihapus' };
          }

          // GURU
          case 'get_guru': {
            ({ data, error } = await supabaseClient.from('guru').select('id_guru, nip, nama_lengkap, username, role, password, npsn, created_at, guru_mapel(id_mapel, mata_pelajaran(nama_mapel))').eq('npsn', payload.npsn).order('created_at', { ascending: false }));
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
            const { data: existingGuru } = await supabaseClient.from('guru').select('id_guru').eq('nip', payload.nip).maybeSingle();
            if (existingGuru && payload.nip) return { status: 'error', message: 'Guru dengan NIP ini sudah terdaftar.' };

            if (!payload.id_guru) payload.id_guru = generateId('G');
            const { mapels, ...guruData } = payload;
            const res = await supabaseClient.from('guru').insert([guruData]).select();
            if (res.error) {
              if (res.error.message.includes('guru_username_key')) {
                return { status: 'error', message: 'Username ini sudah digunakan oleh guru lain. Silakan gunakan username yang berbeda.' };
              }
              return { status: 'error', message: res.error.message };
            }
            if (mapels && mapels.length > 0) {
              const mapelInserts = mapels.map(m => ({ id_guru: guruData.id_guru, id_mapel: m }));
              await supabaseClient.from('guru_mapel').insert(mapelInserts);
            }
            return { status: 'success', message: 'Guru berhasil ditambahkan' };
          }
          case 'create_guru_bulk': {
            const bulkData = payload.map(item => ({ ...item, id_guru: item.id_guru || generateId('G') }));
            ({ error } = await supabaseClient.from('guru').insert(bulkData));
            if (error) {
              if (error.message.includes('guru_username_key')) {
                return { status: 'error', message: 'Gagal menambah data masal: Terdapat username guru yang sudah digunakan.' };
              }
              return { status: 'error', message: error.message };
            }
            return { status: 'success', message: 'Guru berhasil ditambahkan secara massal' };
          }
          case 'update_guru': {
            const { id_guru, mapels, npsn, ...updates } = payload;

            if (updates.nip) {
              const { data: existingGuru } = await supabaseClient.from('guru').select('id_guru').eq('nip', updates.nip).neq('id_guru', id_guru).maybeSingle();
              if (existingGuru) return { status: 'error', message: 'Guru dengan NIP ini sudah terdaftar pada pengguna lain.' };
            }

            const res = await supabaseClient.from('guru').update(updates).eq('id_guru', id_guru).eq('npsn', payload.npsn);
            if (res.error) {
              if (res.error.message.includes('guru_username_key')) {
                return { status: 'error', message: 'Username ini sudah digunakan oleh guru lain. Silakan gunakan username yang berbeda.' };
              }
              return { status: 'error', message: res.error.message };
            }
            // update guru_mapel only if mapels is provided
            if (mapels !== undefined) {
              await supabaseClient.from('guru_mapel').delete().eq('id_guru', id_guru);
              if (mapels.length > 0) {
                const mapelInserts = mapels.map(m => ({ id_guru, id_mapel: m }));
                await supabaseClient.from('guru_mapel').insert(mapelInserts);
              }
            }
            return { status: 'success', message: 'Guru berhasil diperbarui' };
          }
          case 'delete_guru': {
            ({ error } = await supabaseClient.from('guru').delete().eq('id_guru', payload.id_guru).eq('npsn', payload.npsn));
            if (error) {
              if (error.code === '23503') return { status: 'error', message: 'Gagal: Guru ini tidak dapat dihapus karena masih terhubung dengan Mata Pelajaran atau Jadwal Ujian.' };
              return { status: 'error', message: error.message };
            }
            return { status: 'success', message: 'Guru berhasil dihapus' };
          }

          // MATA PELAJARAN
          case 'get_all_mapel': {
            const { data: mapelData, error: mapelErr } = await supabaseClient.from('mata_pelajaran').select('*').eq('npsn', payload.npsn);
            if (mapelErr) return { status: 'error', message: mapelErr.message };
            
            const { data: soalData } = await supabaseClient.from('soal').select('id_mapel').eq('npsn', payload.npsn);
            
            const processedData = (mapelData || []).map(m => {
              const jumlah_soal = (soalData || []).filter(s => s.id_mapel === m.id_mapel).length;
              return { ...m, jumlah_soal };
            });
            return { status: 'success', data: processedData };
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
            if (error) {
              if (error.code === '23503') return { status: 'error', message: 'Gagal: Mata Pelajaran ini tidak dapat dihapus karena masih memiliki Bank Soal atau Jadwal Ujian yang aktif.' };
              return { status: 'error', message: error.message };
            }
            return { status: 'success', message: 'Mata pelajaran berhasil dihapus' };
          }

          // DATA KELAS
          case 'get_kelas': {
            ({ data, error } = await supabaseClient.from('kelas').select('*').eq('npsn', payload.npsn).order('tingkat', { ascending: true }));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_kelas': {
            ({ error } = await supabaseClient.from('kelas').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Kelas berhasil ditambahkan' };
          }
          case 'update_kelas': {
            const { id_kelas, npsn, ...updates } = payload;
            ({ error } = await supabaseClient.from('kelas').update(updates).eq('id_kelas', id_kelas).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Kelas berhasil diperbarui' };
          }
          case 'delete_kelas': {
            ({ error } = await supabaseClient.from('kelas').delete().eq('id_kelas', payload.id_kelas).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Kelas berhasil dihapus' };
          }

          case 'get_all_jadwal': {
            ({ data, error } = await supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            const now = await getTrueNow();
            const processedData = await processJadwalData(data, now);
            return {
              status: 'success',
              data: processedData
            };
          }

          case 'create_jadwal': {
            if (!payload.id_jadwal) payload.id_jadwal = generateId('U');
            ({ error } = await supabaseClient.from('jadwal').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil ditambahkan' };
          }
          case 'update_jadwal': {
            const { id_jadwal, npsn, ...updates } = payload;
            ({ error } = await supabaseClient.from('jadwal').update(updates).eq('id_jadwal', id_jadwal).eq('npsn', npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil diperbarui' };
          }
          case 'create_jadwal_bulk': {
            const bulkData = payload.map(item => ({ ...item, id_jadwal: item.id_jadwal || generateId('U') }));
            ({ error } = await supabaseClient.from('jadwal').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil ditambahkan secara massal' };
          }

          case 'reset_sesi_siswa': {
             // Merubah status_ujian "SEDANG KERJA" menjadi "MULAI" agar siswa bisa masuk kembali
             ({ error } = await supabaseClient.from('log_ujian').update({ status_ujian: 'MULAI' }).eq('id_siswa', payload.id_siswa).eq('status_ujian', 'SEDANG KERJA'));
             if (error) return { status: 'error', message: error.message };
             return { status: 'success', message: 'Sesi siswa berhasil direset.' };
          }

          case 'delete_jadwal': {
            ({ error } = await supabaseClient.from('jadwal').delete().eq('id_jadwal', payload.id_jadwal).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil dihapus.' };
          }

          // ================= GURU / PENGAWAS =================
          case 'update_profil_guru': {
            const { id_guru, password, foto } = payload;
            const updateData = {};
            if (password) updateData.password = password;
            if (foto) updateData.foto = foto;
            if (Object.keys(updateData).length === 0) return { status: 'error', message: 'Tidak ada data yang diubah.' };
            ({ error } = await supabaseClient.from('guru').update(updateData).eq('id_guru', id_guru).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Profil berhasil diperbarui.' };
          }

          case 'get_guru_dashboard_data': {
            const { data: jadwalData, error: jadwalError } = await supabaseClient
              .from('jadwal')
              .select('id_jadwal')
              .eq('npsn', payload.npsn)
              .eq('id_guru', payload.id_guru);
            if (jadwalError) return { status: 'error', message: jadwalError.message };

            const jadwalIds = jadwalData.map(j => j.id_jadwal);
            if (jadwalIds.length === 0) {
              return { status: 'success', data: { totalJadwal: 0, totalSelesai: 0, rataNilai: 0 } };
            }

            const { data: logData, error: logError } = await supabaseClient
              .from('log_ujian')
              .select('nilai_total')
              .in('id_jadwal', jadwalIds)
              .eq('status_ujian', 'SELESAI');
            
            if (logError) return { status: 'error', message: logError.message };

            const totalSelesai = logData.length;
            const rataNilai = totalSelesai > 0 ? (logData.reduce((sum, log) => sum + (log.nilai_total || 0), 0) / totalSelesai).toFixed(1) : 0;

            return {
              status: 'success',
              data: {
                totalJadwal: jadwalIds.length,
                totalSelesai,
                rataNilai
              }
            };
          }
          case 'get_jadwal_pengawas': {
            let q = supabaseClient.from('jadwal').select('*, mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);
            if (payload.id_guru) q = q.eq('id_guru', payload.id_guru);
            ({ data, error } = await q);
            if (error) return { status: 'error', message: error.message };
            const now = await getTrueNow();
            const processedData = await processJadwalData(data, now);
            return {
              status: 'success',
              data: processedData
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
            
            // Format opsi column string to array if it is a JSON string
            const formatOpsi = (s) => {
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              return s;
            }
            return { status: 'success', data: (data || []).map(formatOpsi) };
          }

          case 'create_soal_mapel': {
            const { id_soal, id_mapel, npsn, kunci_jawaban, pertanyaan, tipe_soal, opsi, bobot, gambar, id_narasi } = payload;
            
            const insertData = {
              id_soal,
              id_mapel,
              npsn,
              tipe_soal,
              pertanyaan,
              opsi: opsi ? (typeof opsi === 'string' ? opsi : JSON.stringify(opsi)) : null,
              kunci_jawaban,
              bobot: bobot !== undefined ? bobot : 1,
              gambar: gambar || null,
              id_narasi: id_narasi || null
            };
            
            ({ error } = await supabaseClient.from('soal_ujian').insert([insertData]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil ditambahkan.' };
          }

          case 'update_soal_mapel': {
            const { id_soal: upId, npsn: upNpsn, id_mapel, kunci_jawaban, pertanyaan, tipe_soal, opsi, bobot, gambar, id_narasi } = payload;
            
            const updateData = {};
            if (kunci_jawaban !== undefined) updateData.kunci_jawaban = kunci_jawaban;
            if (id_mapel !== undefined) updateData.id_mapel = id_mapel;
            if (pertanyaan !== undefined) updateData.pertanyaan = pertanyaan;
            if (tipe_soal !== undefined) updateData.tipe_soal = tipe_soal;
            if (opsi !== undefined) updateData.opsi = typeof opsi === 'string' ? opsi : JSON.stringify(opsi);
            if (bobot !== undefined) updateData.bobot = bobot;
            if (gambar !== undefined) updateData.gambar = gambar;
            if (id_narasi !== undefined) updateData.id_narasi = id_narasi;

            ({ error } = await supabaseClient.from('soal_ujian').update(updateData).eq('id_soal', upId).eq('npsn', upNpsn));
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
            let nowTime = await getTrueNow();

            if (nowTime.getTime() - lastUpdate > 480000 || !token) {
              token = generateComplexToken(payload.id_jadwal);
              await supabaseClient.from('jadwal').update({
                token_aktif: token,
                last_update_token: nowTime.toISOString()
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
            let q = supabaseClient.from('log_ujian').select('*, siswa!inner(nama_lengkap, nisn, username, angkatan, kelas_paralel, npsn)').eq('status_ujian', 'SELESAI').eq('siswa.npsn', payload.npsn);
            if (Array.isArray(payload.id_jadwal)) {
              q = q.in('id_jadwal', payload.id_jadwal);
            } else if (payload.id_jadwal) {
              q = q.eq('id_jadwal', payload.id_jadwal);
            }
            ({ data, error } = await q);
            if (error) return { status: 'error', message: error.message };
            return {
              status: 'success',
              data: (data || []).map(l => ({
                ...l,
                nama_lengkap: l.siswa ? l.siswa.nama_lengkap : 'Unknown',
                nisn: l.siswa ? l.siswa.nisn : '-',
                username: l.siswa ? l.siswa.username : '-',
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
            const { data: siswaData } = await supabaseClient.from('siswa').select('kelas').eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn).single();
            let siswaTingkat = null;
            if (siswaData && siswaData.kelas) {
               siswaTingkat = siswaData.kelas.split('|')[0];
            }
            
            let q = supabaseClient.from('jadwal').select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);
            if (siswaTingkat) {
               q = q.or(`kelas.eq.${siswaTingkat},kelas.is.null`);
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
            
            // Format opsi
            const unpackedData = (data || []).map(s => {
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              return s;
            });

            // Fisher-Yates shuffle helper
            const shuffleArray = (arr) => {
              const a = [...arr];
              for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
              }
              return a;
            };

            // Filter out NARASI and SKEMA_PENILAIAN from exam questions
            const soalAktif = unpackedData.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN');
            const narasiMap = {};
            unpackedData.filter(s => s.tipe_soal === 'NARASI').forEach(n => { narasiMap[n.id_soal] = n; });

            // Helper to extract clean options array
            const getCleanOpsi = (soal) => {
              if (!soal.opsi) return null;
              if (Array.isArray(soal.opsi)) return soal.opsi;
              return null;
            };

            // Shuffle soal order
            const soalAcak = shuffleArray(soalAktif).map(soal => {
              // Shuffle opsi for PG and PGK — only the actual options array
              if ((soal.tipe_soal === 'PG' || soal.tipe_soal === 'PGK') && soal.opsi) {
                try {
                  const cleanOpsi = getCleanOpsi(soal);
                  if (Array.isArray(cleanOpsi)) {
                    const opsiAcak = shuffleArray(cleanOpsi);
                    return { ...soal, opsi: JSON.stringify(opsiAcak) };
                  }
                } catch(e) {}
              }
              return soal;
            });

            return { status: 'success', data: soalAcak, narasiMap };
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
            const { data: rawSoalData } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', jadwal?.id_mapel).eq('npsn', payload.npsn);
            const soalData = (rawSoalData || []).map(s => {
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              return s;
            });
            
            let totalSkorMaxAuto = 0;
            let totalSkorDiperolehAuto = 0;
            let insertJawaban = [];

            if (soalData) {
              for (const soal of soalData.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN')) {
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

          // ================= ADMIN NEW FEATURES =================
          case 'get_analisis_soal': {
            const { data: soalData, error: soalErr } = await supabaseClient.from('soal_ujian')
              .select('id_soal, pertanyaan, tipe_soal').eq('id_mapel', payload.id_mapel).eq('npsn', payload.npsn);
            if (soalErr) return { status: 'error', message: soalErr.message };

            const { data: logData, error: logErr } = await supabaseClient.from('log_ujian')
              .select('id_log').eq('id_jadwal', payload.id_jadwal).eq('status_ujian', 'SELESAI');
            if (logErr) return { status: 'error', message: logErr.message };

            if (!logData || logData.length === 0) return { status: 'success', data: [] };
            
            const logIds = logData.map(l => l.id_log);
            const { data: jwbData, error: jwbErr } = await supabaseClient.from('jawaban_siswa')
              .select('id_soal, is_correct').in('id_log', logIds);
            if (jwbErr) return { status: 'error', message: jwbErr.message };

            const analysis = soalData.map(soal => {
              const answers = jwbData.filter(j => j.id_soal === soal.id_soal);
              const total = answers.length;
              const correct = answers.filter(a => a.is_correct).length;
              const wrong = total - correct;
              const difficulty = total > 0 ? (correct / total) * 100 : 0;
              return { ...soal, total, correct, wrong, difficulty: difficulty.toFixed(2) };
            });
            return { status: 'success', data: analysis };
          }
          
          case 'get_audit_log': {
            try {
              const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
              // Otomatis hapus arsip yang lebih dari 1 bulan
              await supabaseClient.from('audit_log_archive').delete().lt('created_at', oneMonthAgo);

              // Otomatis pindahkan log yang lebih dari 1 minggu (7 hari) ke arsip
              const { data: oldLogs } = await supabaseClient.from('audit_log').select('*').eq('npsn', payload.npsn).lt('created_at', oneWeekAgo);
              if (oldLogs && oldLogs.length > 0) {
                const archiveEntries = oldLogs.map(l => ({
                  id_archive: 'ARC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                  id_audit: l.id_audit,
                  npsn: l.npsn,
                  username: l.username,
                  role: l.role,
                  action: l.action,
                  target: l.target,
                  created_at: l.created_at,
                  archived_at: new Date().toISOString()
                }));
                await supabaseClient.from('audit_log_archive').insert(archiveEntries);
                const oldIds = oldLogs.map(l => l.id_audit);
                await supabaseClient.from('audit_log').delete().in('id_audit', oldIds);
              }
            } catch (err) {
              console.warn('Auto-archive audit_log warning:', err);
            }

            let logQuery = supabaseClient.from('audit_log').select('*').eq('npsn', payload.npsn);
            if (payload.username) logQuery = logQuery.eq('username', payload.username);
            ({ data, error } = await logQuery.order('created_at', { ascending: false }).limit(100));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data: data || [] };
          }

          case 'get_audit_log_archive': {
            try {
              const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
              await supabaseClient.from('audit_log_archive').delete().lt('created_at', oneMonthAgo);
            } catch (err) {
              console.warn('Purge audit_log_archive warning:', err);
            }
            let q = supabaseClient.from('audit_log_archive').select('*').eq('npsn', payload.npsn);
            if (payload.username) q = q.eq('username', payload.username);
            ({ data, error } = await q.order('created_at', { ascending: false }).limit(200));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data: data || [] };
          }

          case 'reset_and_archive_audit_log': {
            let q = supabaseClient.from('audit_log').select('*').eq('npsn', payload.npsn);
            if (payload.username) q = q.eq('username', payload.username);
            const { data: logsToArchive, error: fetchErr } = await q;
            if (fetchErr) return { status: 'error', message: fetchErr.message };
            if (logsToArchive && logsToArchive.length > 0) {
              const archiveEntries = logsToArchive.map(l => ({
                id_archive: 'ARC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                id_audit: l.id_audit,
                npsn: l.npsn,
                username: l.username,
                role: l.role,
                action: l.action,
                target: l.target,
                created_at: l.created_at,
                archived_at: new Date().toISOString()
              }));
              await supabaseClient.from('audit_log_archive').insert(archiveEntries);
              const ids = logsToArchive.map(l => l.id_audit);
              await supabaseClient.from('audit_log').delete().in('id_audit', ids);
            }
            return { status: 'success', message: 'Semua log berhasil direset dan disimpan ke arsip riwayat.' };
          }
          
          case 'create_audit_log': {
            const auditPayload = {
              id_audit: generateId('LOG'),
              ...payload
            };
            ({ error } = await supabaseClient.from('audit_log').insert([auditPayload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success' };
          }
          
          case 'get_pengumuman': {
            let q = supabaseClient.from('pengumuman').select('*').eq('npsn', payload.npsn).order('created_at', { ascending: false });
            if (payload.role && payload.role !== 'admin') {
               q = q.in('target_role', ['all', payload.role]);
            }
            let { data: localData, error } = await q;
            if (error) return { status: 'error', message: error.message };
            
            const { data: globalData, error: globalErr } = await supabaseClient.from('pengumuman_global').select('*').order('created_at', { ascending: false });
            if (globalErr) return { status: 'error', message: globalErr.message };
            
            // Format global data to match local data structure
            const formattedGlobal = globalData.map(g => ({
               id_pengumuman: g.id_pengumuman,
               judul: `[GLOBAL] ${g.judul}`,
               isi: g.isi,
               target_role: 'all',
               created_at: g.created_at,
               tipe: g.tipe || 'info'
            }));
            
            return { status: 'success', data: [...formattedGlobal, ...(localData || [])] };
          }
          
          case 'create_pengumuman': {
            payload.id_pengumuman = generateId('ANN');
            ({ error } = await supabaseClient.from('pengumuman').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Pengumuman berhasil dibuat.' };
          }
          
          case 'delete_pengumuman': {
            ({ error } = await supabaseClient.from('pengumuman').delete().eq('id_pengumuman', payload.id_pengumuman).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Pengumuman dihapus.' };
          }

          case 'get_riwayat_ujian_siswa': {
            ({ data, error } = await supabaseClient
              .from('log_ujian')
              .select('*, jadwal!inner(waktu_mulai, waktu_selesai, mata_pelajaran(nama_mapel))')
              .eq('id_siswa', payload.id_siswa)
              .eq('status_ujian', 'SELESAI')
              .order('waktu_mulai', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            
            return { 
              status: 'success', 
              data: data.map(log => ({
                id_log: log.id_log,
                waktu_mulai: log.waktu_mulai,
                waktu_selesai: log.waktu_selesai,
                nilai_auto: log.nilai_auto || 0,
                nilai_uraian: log.nilai_uraian || 0,
                total_nilai: (Number(log.nilai_auto) || 0) + (Number(log.nilai_uraian) || 0),
                nama_mapel: log.jadwal?.mata_pelajaran?.nama_mapel || 'Unknown'
              })) 
            };
          }

          
          case 'update_sekolah_status': {
            ({ error } = await supabaseClient.from('sekolah').update({ status: payload.status }).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Status sekolah berhasil diperbarui.' };
          }
          case 'reset_login_siswa': {
            ({ error } = await supabaseClient.from('siswa').update({ session_token: null }).eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sesi siswa berhasil direset.' };
          }
          case 'force_stop_ujian': {
            ({ error } = await supabaseClient.from('log_ujian').update({ status_ujian: 'SELESAI', waktu_selesai: new Date().toISOString() }).eq('id_log', payload.id_log));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Ujian berhasil dihentikan paksa.' };
          }
          case 'import_soal_bulk': {
            ({ error } = await supabaseClient.from('soal_ujian').insert(payload.data));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil diimport.' };
          }

          case 'update_superadmin_password': {
            ({ error } = await supabaseClient.from('super_admin').update({ password: payload.password }).eq('username', payload.username));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Password super admin berhasil diubah.' };
          }
          case 'reset_all_data': {
            const tables = ['log_aktivitas', 'siswa_jawaban', 'siswa_ujian', 'jadwal_ujian', 'soal_ujian', 'mata_pelajaran', 'guru_mapel', 'siswa', 'guru', 'admin', 'pengumuman', 'sekolah'];
            for (let table of tables) {
               await supabaseClient.from(table).delete().neq('created_at', '1970-01-01T00:00:00Z');
            }
            return { status: 'success', message: 'Semua data sistem berhasil dihapus secara permanen.' };
          }

          default:
            return { status: 'error', message: 'Action tidak dikenali oleh router Supabase.' };
        }
      } catch (error) {
        console.error("Supabase Error:", error);
        return { status: 'error', message: error.message };
      }
    };

    // =============================================================================
    // GLOBAL UTILITIES — available to all components/views
    // =============================================================================

    // Safe JSON parser — never throws, returns fallback on invalid input
    window.safeJSONParse = (str, fallback) => {
      if (str === null || str === undefined || str === '') return fallback;
      try { return JSON.parse(str); } catch (e) { console.warn('safeJSONParse error:', e); return fallback; }
    };

    // Custom hook: Supabase realtime listener
    window.useSupabaseRealtime = (table, filterString, onUpdate) => {
      React.useEffect(() => {
        if (typeof supabaseClient === 'undefined') return;
        const channelName = `realtime:${table}:${filterString || 'all'}`;
        const channel = supabaseClient.channel(channelName)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: table,
            filter: filterString || undefined
          }, (payload) => { onUpdate(payload); })
          .subscribe();
        return () => { supabaseClient.removeChannel(channel); };
      }, [table, filterString, onUpdate]);
    };