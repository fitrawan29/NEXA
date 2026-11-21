-- ==============================================================================
-- DDL: submit_ujian_atomic (PostgreSQL RPC Stored Procedure)
-- Digunakan oleh NEXA CBT untuk menjamin integritas transaksi submit ujian ACID
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
DECLARE
    v_status VARCHAR;
    v_is_blocked BOOLEAN;
    v_nilai_auto NUMERIC;
    v_effective_nilai NUMERIC;
BEGIN
    -- Step 1: Validasi keberadaan log ujian dengan row lock agar aman dari double-submit konkuren
    SELECT status_ujian, is_blocked, nilai_auto
      INTO v_status, v_is_blocked, v_nilai_auto
    FROM public.log_ujian
    WHERE id_log = p_id_log
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Log ujian dengan ID % tidak ditemukan.', p_id_log;
    END IF;

    -- Step 1b: Guard idempoten jika ujian sudah berstatus SELESAI agar jawaban lama tidak terhapus/tertimpa
    IF v_status = 'SELESAI' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_submitted', true,
            'nilai_auto', CASE WHEN COALESCE(v_is_blocked, false) THEN 0 ELSE COALESCE(v_nilai_auto, 0) END,
            'message', 'Ujian sudah disubmit sebelumnya'
        );
    END IF;

    v_effective_nilai := CASE WHEN COALESCE(v_is_blocked, false) THEN 0 ELSE COALESCE(p_nilai_auto, 0) END;

    -- Step 2: Hapus jawaban sebelumnya untuk id_log ini (clean retry saat SEDANG KERJA)
    DELETE FROM public.jawaban_siswa WHERE id_log = p_id_log;

    -- Step 3: Batch set-based insert jawaban baru secara atomik
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

    -- Step 4: Update status log ujian menjadi SELESAI beserta nilai otomatis
    UPDATE public.log_ujian
    SET status_ujian = p_status_ujian,
        nilai_auto = v_effective_nilai,
        waktu_selesai = COALESCE(waktu_selesai, timezone('utc'::text, now()))
    WHERE id_log = p_id_log;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ujian berhasil disubmit secara atomik'
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback otomatis seluruh operasi jika terjadi error
        RAISE EXCEPTION 'Gagal submit jawaban secara atomik: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ujian_atomic(VARCHAR, JSONB, VARCHAR, NUMERIC) TO anon, authenticated, service_role;
