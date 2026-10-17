import React, { useEffect } from 'react';

/**
 * DokumenUjianPrint - Official Print-Friendly HTML Exam Dossier
 * Generates official Indonesian examination documents:
 * 1. Official Kop Surat (Letterhead) with Dinas & Sekolah SVG logo placeholders and double-line border.
 * 2. Berita Acara Pelaksanaan Ujian (Exam Minutes) with metadata, attendance statistics, incident notes, and proctor signatures.
 * 3. Daftar Hadir Peserta Ujian (Attendance Roster) with embedded Base64 digital canvas signatures and proctor endorsement.
 *
 * Conforms to Requirement 4 and @media print CSS rules.
 */
export default function DokumenUjianPrint({
  data = {},
  onClose = () => {},
  onPrint,
  catatanPelaksanaan,
  pengawasNama,
  pengawasNip
}) {
  const sekolah = typeof data?.sekolah === 'string'
    ? { nama_sekolah: data.sekolah }
    : (data?.sekolah && typeof data.sekolah === 'object' ? data.sekolah : {});
  const jadwal = data?.jadwal && typeof data.jadwal === 'object' ? data.jadwal : {};
  const ruang = typeof data?.ruang === 'string'
    ? { nama_ruang: data.ruang }
    : (data?.ruang && typeof data.ruang === 'object' ? data.ruang : {});
  const activeRuangNama = ruang?.nama_ruang || '-';
  const rawPengawas = data?.pengawas || data?.guru_pengawas;
  const pengawas = typeof rawPengawas === 'string'
    ? { nama_lengkap: rawPengawas }
    : (rawPengawas && typeof rawPengawas === 'object' ? rawPengawas : {});
  const beritaAcara = (data?.berita_acara && typeof data.berita_acara === 'object') ? data.berita_acara : {};
  const rawPeserta = Array.isArray(data?.peserta) ? data.peserta : [];
  const peserta = rawPeserta.filter(p => p && typeof p === 'object');

  // Attendance statistics calculation
  const jumlah_peserta_terdaftar = Number(beritaAcara.jumlah_peserta_terdaftar ?? (peserta.length || 0));
  const jumlah_peserta_hadir = Number(
    beritaAcara.jumlah_peserta_hadir ?? peserta.filter(p => p.status_kehadiran === 'HADIR').length
  );
  const jumlah_peserta_tidak_hadir = Number(
    beritaAcara.jumlah_peserta_absen ?? (jumlah_peserta_terdaftar - jumlah_peserta_hadir)
  );

  const absentStudentsList = peserta.filter(p => p.status_kehadiran === 'TIDAK HADIR' || !p.status_kehadiran);

  // Keyboard shortcut listener for Ctrl+P and Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrint, onClose]);

  const handlePrint = () => {
    if (typeof onPrint === 'function') {
      onPrint();
    } else {
      window.print();
    }
  };

  // Date formatting in formal Indonesian
  const formatDateIndo = (dateStr) => {
    try {
      const d = dateStr ? new Date(dateStr) : new Date();
      if (isNaN(d.getTime())) return { hari: '-', tanggal: '-', lengkap: '-' };
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const dayName = days[d.getDay()];
      const dateNum = d.getDate();
      const monthName = months[d.getMonth()];
      const year = d.getFullYear();
      return {
        hari: dayName,
        tanggal: `${dateNum} ${monthName} ${year}`,
        lengkap: `${dayName}, ${dateNum} ${monthName} ${year}`
      };
    } catch {
      return { hari: '-', tanggal: '-', lengkap: '-' };
    }
  };

  const formatTimeRange = (start, end) => {
    if (!start) return '-';
    try {
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) return '-';
      const s = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      let e = '-';
      if (end) {
        const endDate = new Date(end);
        if (!isNaN(endDate.getTime())) {
          e = endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        }
      }
      return `${s} s.d. ${e} WIB`;
    } catch {
      return '-';
    }
  };

  const dateInfo = formatDateIndo(jadwal?.waktu_mulai);
  const activePengawasNama = pengawasNama || pengawas?.nama_lengkap || beritaAcara?.guru?.nama_lengkap || 'Pengawas Ruang Ujian';
  const activePengawasNip = pengawasNip || pengawas?.nip || beritaAcara?.guru?.nip || '-';
  const catatanText = catatanPelaksanaan || beritaAcara?.catatan_pelaksanaan || "Pelaksanaan ujian di ruang ini berjalan dengan tertib, lancar, dan aman. Seluruh perangkat komputer dan koneksi jaringan berfungsi sebagaimana mestinya tanpa kendala berarti.";

  return (
    <div id="print-document" className="min-h-screen bg-slate-900/60 print:bg-white print:min-h-0 print:p-0">
      {/* =========================================================================
          Screen-Only Toolbar / Preview Controls (.no-print)
          ========================================================================= */}
      <div className="no-print sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 sm:px-8 py-3 shadow-lg flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Pratinjau Dokumen Ujian (CBT)</h2>
            <p className="text-[11px] text-slate-400">
              {(activeRuangNama !== '-' ? activeRuangNama : 'Ruang Ujian')} &bull; {jadwal?.mata_pelajaran?.nama_mapel || jadwal?.nama_mapel || 'Mata Pelajaran'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg shadow transition-all cursor-pointer"
            title="Cetak Dokumen atau Simpan PDF (Ctrl+P)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Cetak Dokumen (Ctrl+P)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-600 transition-all cursor-pointer"
            title="Tutup Pratinjau (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Tutup</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          Printable Paper Container (A4 Portrait Layout)
          ========================================================================= */}
      <div className="mx-auto my-6 max-w-[210mm] bg-white text-black p-8 sm:p-12 shadow-2xl rounded-sm border border-slate-200 print:m-0 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full">
        
        {/* =======================================================================
            SECTION 1: KOP SURAT (OFFICIAL SCHOOL LETTERHEAD)
            ======================================================================= */}
        <header className="kop-surat-header">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Dinas Pendidikan / Pemerintah Daerah SVG Logo Placeholder */}
            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
              {sekolah.logo_dinas ? (
                <img
                  src={sekolah.logo_dinas}
                  alt="Logo Dinas Pendidikan"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <svg
                  className="w-16 h-16 object-contain text-slate-900"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Logo Dinas Pendidikan"
                >
                  <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" fill="#f8fafc" />
                  <polygon points="50,15 80,45 68,85 32,85 20,45" stroke="currentColor" strokeWidth="3" fill="#e2e8f0" />
                  <path d="M50 25 L50 75 M25 50 L75 50" stroke="currentColor" strokeWidth="2.5" />
                  <circle cx="50" cy="50" r="14" fill="#0f172a" stroke="currentColor" strokeWidth="2" />
                  <polygon points="50,40 53,47 60,47 54,51 56,58 50,54 44,58 46,51 40,47 47,47" fill="#fbbf24" />
                  <text x="50" y="93" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">
                    DINAS PENDIDIKAN
                  </text>
                </svg>
              )}
            </div>

            {/* Center: Official School Administrative Header */}
            <div className="flex-1 text-center px-2">
              <h3 className="text-xs uppercase font-semibold tracking-wider text-slate-700">
                PEMERINTAH DAERAH PROVINSI / KABUPATEN
              </h3>
              <h2 className="text-sm uppercase font-bold tracking-wide text-slate-900">
                DINAS PENDIDIKAN DAN KEBUDAYAAN
              </h2>
              <h1 className="text-base uppercase font-extrabold text-slate-950 tracking-tight">
                {sekolah.nama_sekolah || '-'}
              </h1>
              <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                NPSN: {sekolah.npsn || '-'} &bull; Alamat: {sekolah.alamat || '-'}
                {sekolah.email ? ` • Email: ${sekolah.email}` : ''}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 mt-1">
                ASESMEN SUMATIF / UJIAN BERBASIS KOMPUTER (CBT)
              </p>
            </div>

            {/* Right: Tut Wuri Handayani / Sekolah SVG Logo Placeholder */}
            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
              {sekolah.logo ? (
                <img
                  src={sekolah.logo}
                  alt="Logo Sekolah"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <svg
                  className="w-16 h-16 object-contain text-slate-900"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Logo Sekolah"
                >
                  <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" fill="#f8fafc" />
                  <path d="M50 18 L55 32 L45 32 Z" fill="#ef4444" stroke="currentColor" strokeWidth="2" />
                  <path d="M42 32 L58 32 L54 52 L46 52 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="2" />
                  <path d="M22 52 C28 40 40 42 46 52 C38 56 26 56 22 52 Z" fill="#3b82f6" stroke="currentColor" strokeWidth="2" />
                  <path d="M78 52 C72 40 60 42 54 52 C62 56 74 56 78 52 Z" fill="#3b82f6" stroke="currentColor" strokeWidth="2" />
                  <path d="M30 68 C38 60 62 60 70 68 C60 74 40 74 30 68 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="2" />
                  <circle cx="50" cy="40" r="4" fill="#fbbf24" />
                  <text x="50" y="93" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">
                    TUT WURI HANDAYANI
                  </text>
                </svg>
              )}
            </div>
          </div>

          {/* Official double-line border divider */}
          <div className="border-b-4 border-double border-black my-3"></div>
        </header>

        {/* =======================================================================
            SECTION 2: BERITA ACARA PELAKSANAAN UJIAN
            ======================================================================= */}
        <section className="berita-acara-section avoid-break mb-6">
          <div className="text-center mb-3">
            <h2 className="text-sm font-bold uppercase underline tracking-wide">
              BERITA ACARA PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT)
            </h2>
            <p className="text-[11px] text-slate-600">Tahun Ajaran 2026/2027</p>
          </div>

          <p className="text-xs text-justify leading-relaxed mb-3">
            Pada hari ini <span className="font-semibold">{dateInfo.hari}</span>, tanggal <span className="font-semibold">{dateInfo.tanggal}</span>, bertempat di <span className="font-semibold">{sekolah.nama_sekolah || '-'}</span>, telah diselenggarakan Ujian Berbasis Komputer (CBT) untuk mata pelajaran tersebut di bawah ini:
          </p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border border-black p-2.5 mb-3 bg-slate-50/50">
            <div className="flex">
              <span className="w-32 font-medium">Mata Pelajaran</span>
              <span className="mr-1">:</span>
              <span className="font-bold">{jadwal?.mata_pelajaran?.nama_mapel || jadwal?.nama_mapel || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-medium">Sesi / Waktu</span>
              <span className="mr-1">:</span>
              <span className="font-semibold">{formatTimeRange(jadwal?.waktu_mulai, jadwal?.waktu_selesai)}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-medium">Tingkat / Kelas</span>
              <span className="mr-1">:</span>
              <span className="font-semibold">{jadwal?.target_kelas || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-medium">Guru Pengampu</span>
              <span className="mr-1">:</span>
              <span className="font-semibold">{jadwal?.guru?.nama_lengkap || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-medium">Ruang Ujian</span>
              <span className="mr-1">:</span>
              <span className="font-bold">{activeRuangNama}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-medium">Pengawas Ruang</span>
              <span className="mr-1">:</span>
              <span className="font-semibold">{activePengawasNama}</span>
            </div>
          </div>

          {/* Attendance Statistics */}
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase mb-1">I. Rekapitulasi Kehadiran Peserta:</h3>
            <table className="w-full text-xs border-collapse border border-black text-center mb-1.5">
              <thead>
                <tr className="bg-slate-100 font-bold">
                  <th className="border border-black py-1 px-2">Jumlah Peserta Terdaftar</th>
                  <th className="border border-black py-1 px-2">Jumlah Peserta Hadir</th>
                  <th className="border border-black py-1 px-2">Jumlah Peserta Tidak Hadir</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black py-1 px-2 font-semibold">{jumlah_peserta_terdaftar} Siswa</td>
                  <td className="border border-black py-1 px-2 font-semibold text-emerald-800">{jumlah_peserta_hadir} Siswa</td>
                  <td className="border border-black py-1 px-2 font-semibold text-rose-800">{jumlah_peserta_tidak_hadir} Siswa</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-slate-700">
              <span className="font-semibold">Daftar Peserta Tidak Hadir:</span>{' '}
              {absentStudentsList.length > 0
                ? absentStudentsList.map(s => `${s.nama_lengkap || 'Siswa'} (${s.nisn || '-'})`).join(', ')
                : 'Nihil (Semua peserta hadir)'}
            </p>
          </div>

          {/* Exam Incident & Condition Notes */}
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase mb-1">II. Catatan Pelaksanaan Ujian:</h3>
            <div className="border border-black p-2.5 text-xs min-h-[50px] leading-relaxed bg-slate-50/30 whitespace-pre-line">
              {catatanText}
            </div>
          </div>

          {/* Two-Column Signature Block */}
          <div className="grid grid-cols-2 gap-8 text-xs pt-2 avoid-break">
            <div className="text-center">
              <p>Mengetahui,</p>
              <p className="font-semibold">Kepala Sekolah / Ketua Panitia,</p>
              <div className="h-16 flex items-center justify-center">
                {/* Formal stamp or manual signature area */}
              </div>
              <p className="font-bold underline">
                {(typeof sekolah?.kepala_sekolah === 'string' && sekolah.kepala_sekolah) || '...................................................'}
              </p>
              <p>NIP. {(typeof sekolah?.nip_kepala_sekolah === 'string' && sekolah.nip_kepala_sekolah) || '...............................................'}</p>
            </div>

            <div className="text-center">
              <p>{(typeof sekolah?.kota === 'string' && sekolah.kota) || 'Tempat'}, {dateInfo.tanggal}</p>
              <p className="font-semibold">Pengawas Ruang,</p>
              <div className="h-16 flex items-center justify-center">
                {beritaAcara?.tanda_tangan_pengawas && typeof beritaAcara.tanda_tangan_pengawas === 'string' ? (
                  <img
                    src={beritaAcara.tanda_tangan_pengawas}
                    alt="TTD Pengawas"
                    className="h-14 max-h-16 object-contain mx-auto"
                  />
                ) : (
                  <div className="h-14"></div>
                )}
              </div>
              <p className="font-bold underline">{activePengawasNama}</p>
              <p>NIP. {activePengawasNip}</p>
            </div>
          </div>
        </section>

        {/* =======================================================================
            SECTION 3: DAFTAR HADIR PESERTA UJIAN (PAGINATED ON NEW PAGE)
            ======================================================================= */}
        <div className="page-break my-6"></div>

        <section className="daftar-hadir-section">
          {/* Compact Header for Daftar Hadir */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-black">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <svg
                  className="w-10 h-10 object-contain text-slate-900"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Logo Tut Wuri Handayani"
                >
                  <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" fill="#f8fafc" />
                  <path d="M50 18 L55 32 L45 32 Z" fill="#ef4444" stroke="currentColor" strokeWidth="2" />
                  <path d="M42 32 L58 32 L54 52 L46 52 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="2" />
                  <text x="50" y="93" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor">
                    TUT WURI
                  </text>
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase">{sekolah.nama_sekolah || '-'}</h3>
                <p className="text-[10px] text-slate-600">
                  NPSN: {sekolah.npsn || '-'} &bull; Ruang: {activeRuangNama}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xs font-extrabold uppercase tracking-wide">
                DAFTAR HADIR PESERTA UJIAN (CBT)
              </h2>
              <p className="text-[10px] text-slate-700 font-medium">
                Mapel: {jadwal?.mata_pelajaran?.nama_mapel || jadwal?.nama_mapel || '-'} &bull; Kelas: {jadwal?.target_kelas || '-'}
              </p>
            </div>
          </div>

          {/* Student Attendance Sheet Table */}
          <table className="w-full text-xs border-collapse border border-black mb-3">
            <thead>
              <tr className="bg-slate-100 text-center font-bold">
                <th className="border border-black py-1.5 px-2 w-10">No</th>
                <th className="border border-black py-1.5 px-2 w-24">NISN</th>
                <th className="border border-black py-1.5 px-3 text-left">Nama Lengkap Siswa</th>
                <th className="border border-black py-1.5 px-2 w-24">Kelas / Rombel</th>
                <th className="border border-black py-1.5 px-3 w-36">Tanda Tangan Digital</th>
                <th className="border border-black py-1.5 px-2 w-28">Status Kehadiran</th>
                <th className="border border-black py-1.5 px-2 w-24">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {peserta.length > 0 ? (
                peserta.map((p, idx) => (
                  <tr key={p.id_siswa || idx} className="text-center hover:bg-slate-50">
                    <td className="border border-black py-1 px-2 font-mono text-[11px]">{idx + 1}</td>
                    <td className="border border-black py-1 px-2 font-mono text-[11px]">{p.nisn || '-'}</td>
                    <td className="border border-black py-1 px-3 text-left font-semibold">{p.nama_lengkap || '-'}</td>
                    <td className="border border-black py-1 px-2">{p.kelas || '-'}</td>
                    <td className="border border-black py-1 px-2 h-10 align-middle">
                      {p.tanda_tangan && typeof p.tanda_tangan === 'string' ? (
                        <img
                          src={p.tanda_tangan}
                          alt={`Tanda tangan ${p.nama_lengkap || 'peserta'}`}
                          className="h-8 max-h-10 w-auto object-contain mx-auto"
                        />
                      ) : (
                        <span className="text-slate-400 font-mono tracking-widest">....................</span>
                      )}
                    </td>
                    <td className="border border-black py-1 px-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.status_kehadiran === 'HADIR'
                          ? 'text-emerald-800'
                          : 'text-rose-800'
                      }`}>
                        {p.status_kehadiran === 'HADIR'
                          ? (p.status_verifikasi === 'DISETUJUI' ? 'Hadir (Terverifikasi)' : 'Hadir (Menunggu)')
                          : 'Tidak Hadir'}
                      </span>
                    </td>
                    <td className="border border-black py-1 px-2 text-[10px] text-slate-600">
                      {p.keterangan || (p.status_kehadiran === 'TIDAK HADIR' ? 'Absen' : '-')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="border border-black py-4 text-center text-slate-500 italic">
                    Belum ada data peserta untuk ruang ujian ini.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-[11px]">
                <td colSpan="4" className="border border-black py-1.5 px-3 text-left">
                  Total Peserta: {jumlah_peserta_terdaftar} Siswa
                </td>
                <td colSpan="3" className="border border-black py-1.5 px-3 text-right">
                  Hadir: {jumlah_peserta_hadir} &bull; Tidak Hadir: {jumlah_peserta_tidak_hadir}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Proctor Endorsement Signature on Bottom-Right */}
          <div className="flex justify-end pt-2 avoid-break">
            <div className="text-center w-64 text-xs">
              <p>{(typeof sekolah?.kota === 'string' && sekolah.kota) || 'Tempat'}, {dateInfo.tanggal}</p>
              <p className="font-semibold">Pengawas Ruang,</p>
              <div className="h-16 flex items-center justify-center">
                {beritaAcara?.tanda_tangan_pengawas && typeof beritaAcara.tanda_tangan_pengawas === 'string' ? (
                  <img
                    src={beritaAcara.tanda_tangan_pengawas}
                    alt="TTD Pengawas"
                    className="h-14 max-h-16 object-contain mx-auto"
                  />
                ) : (
                  <div className="h-14"></div>
                )}
              </div>
              <p className="font-bold underline">{activePengawasNama}</p>
              <p>NIP. {activePengawasNip}</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
