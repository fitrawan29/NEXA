# Panduan Konfigurasi Deployment Multi-Instance NEXA CBT

Dokumen ini memuat panduan lengkap arsitektur dan konfigurasi deployment multi-instance untuk NEXA CBT. Dengan arsitektur ini, satu repositori kode dapat dihubungkan ke 4 project Vercel terpisah dengan masing-masing database Supabase Free Tier sendiri, beroperasi secara mandiri, stabil, dan tanpa biaya (**Rp 0**).

---

## 1. Arsitektur Multi-Deployment

```
                        ┌──────────────────────────────────────────────┐
                        │        Git Repository: NEXA CBT              │
                        │           (Branch: main)                     │
                        └──────┬────────────┬────────────┬─────────────┘
                               │            │            │             │
              ┌────────────────┘            │            │             └────────────────┐
              ▼                             ▼            ▼                              ▼
      ┌───────────────┐             ┌───────────────┐  ┌───────────────┐        ┌───────────────┐
      │ Vercel Proj 1 │             │ Vercel Proj 2 │  │ Vercel Proj 3 │        │ Vercel Proj 4 │
      │ SMA 1 Tutuyan │             │ SMA 1 Tutuyan │  │ SMA 1 Tutuyan │        │ SMA Sampolawa │
      │   Kelas 10    │             │   Kelas 11    │  │   Kelas 12    │        │ (Semua Kelas) │
      └───────┬───────┘             └───────┬───────┘  └───────┬───────┘        └───────┬───────┘
              │                             │                  │                        │
       VITE_SUPABASE_*               VITE_SUPABASE_*    VITE_SUPABASE_*          VITE_SUPABASE_*
              │                             │                  │                        │
              ▼                             ▼                  ▼                        ▼
      ┌───────────────┐             ┌───────────────┐  ┌───────────────┐        ┌───────────────┐
      │  Supabase DB1 │             │  Supabase DB2 │  │  Supabase DB3 │        │  Supabase DB4 │
      │ Tutuyan Kls 10│             │ Tutuyan Kls 11│  │ Tutuyan Kls 12│        │   Sampolawa   │
      └───────────────┘             └───────────────┘  └───────────────┘        └───────────────┘
```

### Keunggulan Arsitektur:
1. **Beban Terisolasi (Zero Cross-Contamination):** Trafik dan kuota dari 415 siswa terbagi ke 4 database terpisah (~100-140 siswa per instance).
2. **Jaminan Anti-429 (Kong Gateway Safe):** Dengan interval polling 60 detik di `ExamRoom.jsx`, setiap klien hanya mengirim 1 request/menit, sehingga beban konkurensi di setiap instance hanya ~100-140 req/menit (jauh di bawah batas Kong gateway Supabase Free Tier sebesar 500 req/menit).
3. **Penyimpanan Bebas Biaya:** Penggunaan database Supabase Free Tier tetap berada di bawah batas 500 MB per project.
4. **Codebase Tunggal:** Pemeliharaan kode terpusat; setiap update/fitur pada repository Git otomatis dapat diterapkan ke seluruh instance.

---

## 2. Pemetaan Environment Variables 4 Instance

Setiap project Vercel dikonfigurasikan dengan environment variable masing-masing:

| No | Target Deployment | Nama Project Vercel (Rekomendasi) | Environment Variables yang Wajib Diisi |
|---|---|---|---|
| 1 | SMA 1 Tutuyan Kelas 10 | `nexa-tutuyan-k10` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY` |
| 2 | SMA 1 Tutuyan Kelas 11 | `nexa-tutuyan-k11` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY` |
| 3 | SMA 1 Tutuyan Kelas 12 | `nexa-tutuyan-k12` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY` |
| 4 | SMA Sampolawa | `nexa-sampolawa` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY` |

> **Catatan:** Variabel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dibaca secara otomatis pada file `src/config.js` saat proses build di Vercel.

---

## 3. Langkah Persiapan Database di Supabase (Wajib)

Sebelum mengaktifkan deployment, jalankan skrip migrasi keandalan database pada **keempat** project database Supabase:

1. Buka dashboard masing-masing project di [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Masuk ke menu **SQL Editor** -> klik **New Query**.
3. Salin dan tempelkan isi file `database_backups/migration_keandalan_ujian.sql`:
   ```sql
   -- 1. Buat indeks performa query
   CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_log ON public.jawaban_siswa (id_log);
   ANALYZE public.jawaban_siswa;

   -- 2. Buat fungsi RPC submit ujian atomik (ACID safe & set-based)
   CREATE OR REPLACE FUNCTION public.submit_ujian_atomic(
       p_id_log VARCHAR,
       p_jawaban_list JSONB,
       p_status_ujian VARCHAR,
       p_nilai_auto NUMERIC
   ) RETURNS JSONB
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, pg_temp
   AS $$
   BEGIN
       -- Validasi keberadaan log ujian
       IF NOT EXISTS (SELECT 1 FROM public.log_ujian WHERE id_log = p_id_log) THEN
           RAISE EXCEPTION 'Log ujian dengan ID % tidak ditemukan.', p_id_log;
       END IF;

       -- Hapus jawaban sebelumnya (idempotent / clean retry)
       DELETE FROM public.jawaban_siswa WHERE id_log = p_id_log;

       -- Batch insert jawaban secara atomik & set-based
       IF p_jawaban_list IS NOT NULL 
          AND jsonb_typeof(p_jawaban_list) = 'array' 
          AND jsonb_array_length(p_jawaban_list) > 0 THEN
           INSERT INTO public.jawaban_siswa (
               id_jawaban,
               id_log,
               id_soal,
               jawaban_user,
               is_correct,
               skor_diperoleh
           )
           SELECT
               COALESCE(elem->>'id_jawaban', 'JWB-' || substr(md5(random()::text), 1, 9)),
               p_id_log,
               elem->>'id_soal',
               COALESCE(NULLIF(elem->>'jawaban_user', 'null'), ''),
               CASE WHEN lower(COALESCE(elem->>'is_correct', 'false')) IN ('true', 't', '1') THEN true ELSE false END,
               COALESCE(NULLIF(elem->>'skor_diperoleh', '')::NUMERIC, 0)
           FROM jsonb_array_elements(p_jawaban_list) AS elem;
       END IF;

       -- Update status log ujian menjadi SELESAI
       UPDATE public.log_ujian
       SET status_ujian = p_status_ujian,
           nilai_auto = COALESCE(p_nilai_auto, 0),
           waktu_selesai = COALESCE(waktu_selesai, timezone('utc'::text, now()))
       WHERE id_log = p_id_log;

       RETURN jsonb_build_object(
           'success', true,
           'message', 'Ujian berhasil disubmit secara atomik'
       );
   EXCEPTION
       WHEN OTHERS THEN
           RAISE EXCEPTION 'Gagal submit jawaban secara atomik: %', SQLERRM;
   END;
   $$;

   -- Berikan hak akses eksekusi ke role anon client
   GRANT EXECUTE ON FUNCTION public.submit_ujian_atomic(VARCHAR, JSONB, VARCHAR, NUMERIC) TO anon, authenticated, service_role;
   ```
4. Klik **Run** untuk mengeksekusi. Pastikan output menunjukkan status `Success`.
5. Ulangi langkah di atas pada ke-4 project Supabase.

---

## 4. Langkah Deployment di Vercel

### Langkah 1: Hubungkan Project ke Repositori
1. Masuk ke akun [Vercel](https://vercel.com).
2. Klik tombol **Add New...** -> **Project**.
3. Pilih repository Git NEXA CBT Anda.

### Langkah 2: Konfigurasi Project Settings
1. **Project Name:** Beri nama sesuai instance (contoh: `nexa-tutuyan-k10`).
2. **Framework Preset:** `Vite` (default terdeteksi otomatis).
3. **Root Directory:** `./` (atau `kode NEXA` jika repositori memiliki subfolder).
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`

### Langkah 3: Konfigurasi Environment Variables
Buka bagian **Environment Variables**, lalu tambahkan:
- Key: `VITE_SUPABASE_URL`  
  Value: `https://[ID_PROJECT_SUPABASE].supabase.co` (URL dari database instance terkait)
- Key: `VITE_SUPABASE_ANON_KEY`  
  Value: `[ANON_KEY_PROJECT_SUPABASE]` (Anon public key dari database instance terkait)

Centang semua opsi environment: **Production**, **Preview**, dan **Development**.

### Langkah 4: Deploy & Ulangi untuk 3 Project Lainnya
1. Klik tombol **Deploy**.
2. Tunggu proses build selesai (~1-2 menit).
3. Setelah selesai, ulangi Langkah 1 s/d 4 untuk ketiga project lainnya (`nexa-tutuyan-k11`, `nexa-tutuyan-k12`, dan `nexa-sampolawa`).

---

## 5. Ringkasan Fitur Stabilitas & Keandalan yang Diterapkan

1. **Pelonggaran Polling Anti-429 (ExamRoom.jsx):**
   - Polling sinkronisasi status pengawas diubah dari 15 detik menjadi **60 detik** (`60000 ms`).
   - Mencegah lonjakan trafik konkuren sehingga kuota 500 req/menit Kong Gateway Supabase Free Tier dijamin aman.
2. **Ketahanan Sesi Siswa (Kebal F5 via sessionStorage):**
   - Sesi login siswa disimpan ke `sessionStorage` (`nexa_user_session`).
   - Apabila siswa tidak sengaja me-refresh halaman (tekan F5) saat ujian, sesi akun dan state ruang ujian langsung dipulihkan secara instan tanpa perlu login ulang.
3. **Indeks Database (idx_jawaban_siswa_id_log):**
   - Memastikan query seleksi dan manipulasi jawaban siswa pada tabel `jawaban_siswa` berjalan dalam kompleksitas O(log N).
4. **Transaksi Atomik Submit (submit_ujian_atomic):**
   - Menggunakan PostgreSQL Stored Procedure yang berjalan dalam satu transaksi ACID penuh. Jika koneksi terputus saat submit, Postgres melakukan rollback otomatis untuk mencegah data jawaban parsial.
   - Dilengkapi graceful fallback client-side apabila database belum memperbarui stored procedure.

---

## 6. Verifikasi Pasca-Deployment

Lakukan checklist verifikasi berikut setelah masing-masing project aktif:
- [ ] Buka URL Vercel masing-masing instance di browser.
- [ ] Pastikan halaman login memuat data sekolah yang sesuai dari database instance terkait.
- [ ] Login sebagai siswa, mulai ujian, lalu tekan **F5**: pastikan siswa tetap berada di ruang ujian tanpa keluar atau kehilangan jawaban.
- [ ] Periksa tab **Network** di Developer Tools browser: pastikan request `get_status_log_ujian` memiliki jeda 60 detik.
- [ ] Lakukan submit ujian dan pastikan seluruh jawaban serta nilai otomatis tersimpan utuh di database Supabase.
