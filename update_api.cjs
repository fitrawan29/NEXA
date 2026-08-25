const fs = require('fs');
let content = fs.readFileSync('api.js', 'utf-8');

const originalLogin = `          case 'login': {
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
          }`;

const newLogin = `          case 'login': {
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

            // Cek status sekolah
            const { data: sekolahData, error: sekolahErr } = await supabaseClient
              .from('sekolah')
              .select('status')
              .eq('npsn', payload.npsn)
              .single();
            if (sekolahErr || !sekolahData) return { status: 'error', message: 'Sekolah tidak terdaftar.' };
            if (sekolahData.status === 'SUSPENDED') return { status: 'error', message: 'Akses ditolak: Sekolah dalam masa penangguhan (Suspended).' };

            const table = payload.role === 'admin' ? 'admin' : (payload.role === 'guru' ? 'guru' : 'siswa');
            ({ data, error } = await supabaseClient
              .from(table)
              .select('*')
              .eq('username', payload.username)
              .eq('password', payload.password)
              .eq('npsn', payload.npsn)
              .single());
            if (error || !data) return { status: 'error', message: 'Username, password, atau NPSN salah.' };
            
            if (payload.role === 'siswa') {
              if (data.session_token && data.session_token !== payload.session_token) {
                 return { status: 'error', message: 'Akun Anda sedang aktif di perangkat lain. Hubungi Admin untuk mereset sesi Anda.' };
              }
              const newToken = crypto.randomUUID();
              await supabaseClient.from('siswa').update({ session_token: newToken }).eq('id_siswa', data.id_siswa);
              data.session_token = newToken;
            }

            data.role = payload.role;
            return { status: 'success', data };
          }`;

content = content.replace(originalLogin, newLogin);

// Add global routes logic to include reset_login_siswa, update_sekolah_status, dll
content = content.replace(
  "const globalRoutes = ['login', 'register', 'get_sekolah', 'update_admin_sekolah', 'tambah_admin_sekolah', 'get_analytics', 'update_admin_profil', 'hapus_sekolah', 'get_pengumuman_global', 'create_pengumuman_global', 'delete_pengumuman_global', 'get_log_aktivitas_global', 'create_log_aktivitas_global'];",
  "const globalRoutes = ['login', 'register', 'get_sekolah', 'update_admin_sekolah', 'tambah_admin_sekolah', 'get_analytics', 'update_admin_profil', 'hapus_sekolah', 'get_pengumuman_global', 'create_pengumuman_global', 'delete_pengumuman_global', 'get_log_aktivitas_global', 'create_log_aktivitas_global', 'update_sekolah_status'];"
);

// Append new routes
const newRoutes = `
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
          case 'import_soal_bulk': {
            ({ error } = await supabaseClient.from('soal_ujian').insert(payload.data));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil diimport.' };
          }
`;

content = content.replace("default:", newRoutes + "\n          default:");

fs.writeFileSync('api.js', content, 'utf-8');
console.log('Update api.js selesai!');
