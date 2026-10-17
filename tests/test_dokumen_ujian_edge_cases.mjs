import { createServer } from 'vite';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

async function runEdgeCaseTest() {
  console.log('Testing DokumenUjianPrint under edge case scenarios...\n');

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const module = await vite.ssrLoadModule('/src/components/DokumenUjianPrint.jsx');
  const DokumenUjianPrint = module.default;

  const testCases = [
    { name: '1. undefined data prop', props: {} },
    { name: '2. null data prop', props: { data: null } },
    { name: '3. empty object data prop', props: { data: {} } },
    {
      name: '4. all null nested attributes',
      props: {
        data: {
          sekolah: null,
          jadwal: null,
          ruang: null,
          pengawas: null,
          berita_acara: null,
          peserta: null
        }
      }
    },
    {
      name: '5. empty object nested attributes',
      props: {
        data: {
          sekolah: {},
          jadwal: {},
          ruang: {},
          pengawas: {},
          berita_acara: {},
          peserta: []
        }
      }
    },
    {
      name: '6. invalid date and missing fields in student',
      props: {
        data: {
          sekolah: { nama_sekolah: '', npsn: '', alamat: '', email: null },
          jadwal: { waktu_mulai: 'INVALID_DATE_STRING', waktu_selesai: null },
          ruang: { nama_ruang: null },
          peserta: [
            { id_siswa: 's1', nama_lengkap: null, nisn: null, kelas: null, tanda_tangan: null, status_kehadiran: null },
            { id_siswa: 's2', nama_lengkap: 'Siswa Hadir', nisn: '12345', kelas: 'X-1', tanda_tangan: 'data:image/png;base64,abc', status_kehadiran: 'HADIR' },
            { id_siswa: 's3', nama_lengkap: 'Siswa Absen', nisn: '67890', kelas: 'X-2', status_kehadiran: 'TIDAK HADIR' }
          ]
        }
      }
    },
    {
      name: '7. real school data (SMA Nizamudin / SMA Negeri 1 Tutuyan)',
      props: {
        data: {
          sekolah: {
            npsn: '70040625',
            nama_sekolah: 'SMA Nizamudin',
            status: 'ACTIVE'
          },
          jadwal: {
            id_jadwal: 'U-67AC6649',
            waktu_mulai: '2026-10-10T09:00:00Z',
            waktu_selesai: '2026-10-10T10:30:00Z',
            target_kelas: 'XI Merdeka',
            mata_pelajaran: { nama_mapel: 'Matematika X' },
            guru: { nama_lengkap: 'Ade Fitrawan Ibrahim, M.Pd., Gr.' }
          },
          ruang: {
            id_ruang: 'R-01',
            nama_ruang: 'Ruang Ujian Utama'
          },
          pengawas: {
            nama_lengkap: 'Ade Fitrawan Ibrahim, M.Pd., Gr.',
            nip: '30011997'
          },
          berita_acara: {
            catatan_pelaksanaan: 'Ujian berjalan tertib.',
            jumlah_peserta_terdaftar: 1,
            jumlah_peserta_hadir: 1,
            jumlah_peserta_absen: 0
          },
          peserta: [
            {
              id_siswa: 'S-F2934CD8',
              nama_lengkap: 'Muhammad Yusuf Balandatu',
              nisn: '0071234567',
              kelas: 'XI Merdeka - 1',
              status_kehadiran: 'HADIR',
              status_verifikasi: 'DISETUJUI',
              tanda_tangan: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            }
          ]
        }
      }
    },
    {
      name: '8. sparse and null elements inside peserta array',
      props: {
        data: {
          sekolah: { nama_sekolah: 'SMA Negeri 1 Tutuyan', npsn: '40103445' },
          jadwal: { nama_mapel: 'Biologi XI' },
          ruang: { nama_ruang: 'Lab Komputer' },
          peserta: [
            null,
            undefined,
            'invalid_string',
            12345,
            { id_siswa: 's-valid', nama_lengkap: 'Siswa Sah', nisn: '998877', kelas: 'XI-A', status_kehadiran: 'HADIR', tanda_tangan: 'data:image/png;base64,abc' }
          ]
        }
      }
    },
    {
      name: '9. string-type school and proctor props with empty object room',
      props: {
        data: {
          sekolah: 'SMA Nizamudin',
          pengawas: 'Guru Pengawas Lapangan',
          ruang: {},
          jadwal: 'Simulasi Ujian',
          peserta: []
        }
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DokumenUjianPrint, tc.props)
      );

      // Verify that NO dummy strings leaked into rendered HTML
      const containsContoh = html.includes('SMA NEGERI CONTOH');
      const contains1010 = html.includes('10101010');
      const containsJl = html.includes('Jl. Pendidikan Nasional');

      if (containsContoh || contains1010 || containsJl) {
        console.error(`  ✗ FAIL: ${tc.name} rendered dummy residue!`);
        failed++;
      } else {
        console.log(`  ✓ PASS: ${tc.name} rendered cleanly (${html.length} bytes)`);
        passed++;
      }
    } catch (err) {
      console.error(`  ✗ FAIL: ${tc.name} threw error:`, err);
      failed++;
    }
  }

  await vite.close();

  console.log(`\nEdge Case Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runEdgeCaseTest().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
