import React, { useEffect } from 'react';

/**
 * KartuUjianPrint
 * Print component for Kartu Peserta Ujian
 *
 * Rules:
 * - Uses #print-document container (compatible with index.css print isolation)
 * - Zero <header> and <footer> tags (to avoid global display: none in @media print)
 * - Deterministic JavaScript chunking (8 cards per sheet: 2 columns x 4 rows)
 * - Pure Tailwind CSS - zero external libraries
 * - Supports A4 and F4 paper sizes via dynamic @page stylesheet
 */

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const KartuUjianPrint = ({ data, onClose }) => {
  const {
    students = [],
    sekolah = {},
    paperSize = 'A4',
    showPassword = true,
    tahunAjaran = '2026/2027',
    namaKepalaSekolah = '',
    nipKepalaSekolah = '',
    targetKelas = '',
    targetRuang = '',
    targetSesi = 'Sesi 1'
  } = data || {};

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const schoolName = sekolah.nama_sekolah || 'SEKOLAH INDONESIA';
  const schoolNpsn = sekolah.npsn || '-';
  const headmasterName = namaKepalaSekolah || sekolah.kepala_sekolah || 'Kepala Sekolah';
  const headmasterNip = nipKepalaSekolah || sekolah.nip_kepala_sekolah || '-';

  // Chunk students into pages of 8 cards
  const studentChunks = chunkArray(students, 8);

  return (
    <div id="print-document" className="min-h-screen bg-slate-900/60 print:bg-white print:min-h-0 print:p-0">
      {/* Dynamic @page CSS style for paper size */}
      <style>
        {`
          @media print {
            @page {
              size: ${paperSize === 'F4' ? '215mm 330mm' : 'A4 portrait'};
              margin: 8mm 10mm 8mm 10mm;
            }
            @page :left {
              margin: 8mm 10mm 8mm 10mm;
            }
            @page :right {
              margin: 8mm 10mm 8mm 10mm;
            }
            @page :first {
              margin: 8mm 10mm 8mm 10mm;
            }
            .print-sheet {
              min-height: 0 !important;
              height: auto !important;
            }
          }
        `}
      </style>

      {/* Screen Toolbar (Hidden on Print) */}
      <div className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-2xl">badge</span>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide">
                Pratinjau Cetak Kartu Peserta Ujian
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total: <span className="font-bold text-slate-700 dark:text-slate-300">{students.length} Siswa</span>
                {' '}({studentChunks.length} Lembar {paperSize})
                {targetKelas ? ` • Kelas: ${targetKelas}` : ''}
                {targetRuang ? ` • Ruang: ${targetRuang}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>Tutup (Esc)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover active:scale-[0.98] text-white shadow-md transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Cetak Dokumen (Ctrl+P)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Sheets Container */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 print:max-w-none print:p-0">
        {studentChunks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-xl text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">warning</span>
            <p className="text-sm font-bold">Tidak ada data siswa yang dipilih untuk dicetak.</p>
          </div>
        ) : (
          studentChunks.map((chunk, pageIdx) => (
            <div
              key={pageIdx}
              className={`print-sheet bg-white mx-auto my-6 p-4 sm:p-5 shadow-xl border border-slate-200 print:m-0 print:p-0 print:shadow-none print:border-none print:w-full ${
                pageIdx > 0 ? 'page-break' : ''
              }`}
              style={{ minHeight: paperSize === 'F4' ? '310mm' : '278mm' }}
            >
              <div className="grid grid-cols-2 gap-2.5 print:gap-2">
                {chunk.map((student, sIdx) => {
                  const kelasStr = student.kelas || `${student.angkatan || ''} ${student.kelas_paralel || ''}`.trim() || targetKelas || '-';
                  const ruangStr = student.ruang || targetRuang || '-';
                  const sesiStr = student.sesi || targetSesi || 'Sesi 1';
                  const avatar = student.foto_profil;

                  // ===========================================================
                  // KARTU PESERTA UJIAN (Student Identification Card)
                  // ===========================================================
                  return (
                    <div
                      key={student.id_siswa || sIdx}
                      className="avoid-break border border-dashed border-slate-500 print:border-black rounded-lg p-2 bg-white flex flex-col justify-between text-black text-[9px] leading-tight overflow-hidden"
                      style={{ height: '67mm', minHeight: '67mm', maxHeight: '68mm' }}
                    >
                      {/* Header Kartu Peserta */}
                      <div className="border-b border-black pb-1 mb-1 flex items-center justify-between gap-1.5">
                        <div className="flex-1 text-center min-w-0 px-1">
                          <div className="text-[9px] font-black uppercase tracking-tight truncate text-slate-950 leading-tight">
                            {schoolName}
                          </div>
                          <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-700 leading-tight truncate">
                            KARTU PESERTA ASESMEN / CBT
                          </div>
                          <div className="text-[7px] text-slate-500 leading-none mt-0.5 truncate">
                            NPSN: {schoolNpsn} • TP {tahunAjaran}
                          </div>
                        </div>
                      </div>

                      {/* Card Content: Details & Photo */}
                      <div className="flex gap-2 items-start my-auto">
                        {/* Details Table */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex">
                            <span className="w-16 font-semibold text-slate-600 shrink-0">Nama</span>
                            <span className="font-bold text-slate-950 truncate">: {student.nama_lengkap || '-'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-16 font-semibold text-slate-600 shrink-0">NISN / No</span>
                            <span className="font-mono font-bold">: {student.nisn || student.id_siswa || '-'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-16 font-semibold text-slate-600 shrink-0">Kelas</span>
                            <span className="font-semibold">: {kelasStr}</span>
                          </div>
                          <div className="flex">
                            <span className="w-16 font-semibold text-slate-600 shrink-0">Ruang / Sesi</span>
                            <span className="font-semibold">: {ruangStr} / {sesiStr}</span>
                          </div>
                          <div className="flex pt-0.5 border-t border-slate-200">
                            <span className="w-16 font-semibold text-slate-600 shrink-0">Username</span>
                            <span className="font-mono font-bold text-primary print:text-black">: {student.username || '-'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-16 font-semibold text-slate-600 shrink-0">Password</span>
                            <span className="font-mono font-black text-slate-900">: {showPassword !== false ? (student.password || '-') : '••••••••'}</span>
                          </div>
                        </div>

                        {/* Photo Box */}
                        <div className="w-[18mm] h-[24mm] border border-slate-400 rounded flex-shrink-0 flex items-center justify-center overflow-hidden bg-slate-50 text-[7px] text-slate-400 text-center">
                          {avatar ? (
                            <img src={avatar} alt="Foto" className="w-full h-full object-cover" />
                          ) : (
                            <div className="p-1">
                              <span>Foto<br/>2x3</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Signature Footer */}
                      <div className="pt-1 border-t border-slate-200 flex justify-between items-end text-[7px] leading-tight">
                        <div className="italic text-slate-500">
                          *Harap kartu dibawa saat ujian
                        </div>
                        <div className="text-right">
                          <div>Kepala Sekolah / Panitia,</div>
                          <div className="h-4"></div>
                          <div className="font-bold underline text-slate-900">{headmasterName}</div>
                          {headmasterNip !== '-' && <div>NIP: {headmasterNip}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KartuUjianPrint;
