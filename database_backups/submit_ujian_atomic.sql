-- ==============================================================================
-- SKRIP TRANSAKSI ATOMIK SUBMIT UJIAN NEXA CBT
-- Fungsi Stored Procedure (RPC) untuk mengeksekusi penghapusan jawaban lama,
-- batch insertion jawaban baru, dan pembaruan status log_ujian dalam satu transaksi ACID.
-- Diterapkan pada masing-masing 4 database Supabase:
-- 1. SMA 1 Tutuyan Kelas 10
-- 2. SMA 1 Tutuyan Kelas 11
-- 3. SMA 1 Tutuyan Kelas 12
-- 4. SMA Sampolawa
-- ==============================================================================

CREATE OR REPLACE FUNCTION submit_ujian_atomic(
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
    -- 1. Validasi keberadaan log ujian terlebih dahulu
    IF NOT EXISTS (SELECT 1 FROM public.log_ujian WHERE id_log = p_id_log) THEN
        RAISE EXCEPTION 'Log ujian dengan ID % tidak ditemukan.', p_id_log;
    END IF;

    -- 2. Hapus jawaban sebelumnya untuk id_log yang bersangkutan (idempotent / clean retry)
    DELETE FROM public.jawaban_siswa WHERE id_log = p_id_log;

    -- 3. Masukkan semua jawaban baru secara set-based (jauh lebih cepat & aman)
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

    -- 4. Update status ujian dan nilai otomatis pada log_ujian
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
        -- Rollback otomatis seluruh operasi jika terjadi kesalahan apapun
        RAISE EXCEPTION 'Gagal submit jawaban secara atomik: %', SQLERRM;
END;
$$;

-- Izin eksekusi RPC untuk role klien Supabase (anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.submit_ujian_atomic(VARCHAR, JSONB, VARCHAR, NUMERIC) TO anon, authenticated, service_role;
