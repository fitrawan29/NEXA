import { supabaseClient } from './config.js';
import React from 'react';

export { supabaseClient };

    // Fungsi fetchAPI sebagai Router Supabase
    export const generateId = (prefix) => `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    let timeOffset = 0;
    let syncPromise = null;
    export const getTrueNow = async () => {
      if (!syncPromise) {
        syncPromise = (async () => {
          try {
            let signal = undefined;
            let timeoutId = undefined;
            if (typeof AbortController !== 'undefined') {
              const controller = new AbortController();
              signal = controller.signal;
              timeoutId = setTimeout(() => controller.abort(), 3000);
            }
            const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', { signal });
            if (timeoutId) clearTimeout(timeoutId);
            if (!res.ok) throw new Error('API down');
            const data = await res.json();
            timeOffset = new Date(data.datetime).getTime() - Date.now();
          } catch (error) {
            console.warn('Network time sync unavailable, falling back to local system time.');
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
                
                let updateQuery = supabaseClient.from('jadwal').update({
                   token_aktif: tokenAktif,
                   last_update_token: now.toISOString()
                }).eq('id_jadwal', j.id_jadwal);

                updateQuery = j.last_update_token != null
                  ? updateQuery.eq('last_update_token', j.last_update_token)
                  : updateQuery.is('last_update_token', null);

                await updateQuery;
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

    export const get_default_skema_sekolah = async (npsn) => {
      const fallbackDefault = {
        mode: 'default',
        skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 }
      };

      if (!npsn || typeof npsn !== 'string' || !npsn.trim()) {
        return fallbackDefault;
      }

      // Check localStorage cache first
      if (typeof localStorage !== 'undefined') {
        try {
          const cached = localStorage.getItem('nexa_default_skema_' + npsn);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') {
              return parsed;
            }
          }
        } catch (e) {
          console.warn('Error reading default skema from localStorage cache:', e);
        }
      }

      // Query Supabase soal_ujian table for reserved default record
      try {
        const { data, error } = await supabaseClient
          .from('soal_ujian')
          .select('kunci_jawaban')
          .eq('id_soal', 'SKEMA_DEFAULT_' + npsn)
          .eq('npsn', npsn)
          .maybeSingle();

        if (!error && data && data.kunci_jawaban) {
          try {
            const parsed = JSON.parse(data.kunci_jawaban);
            if (parsed && typeof parsed === 'object') {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('nexa_default_skema_' + npsn, JSON.stringify(parsed));
              }
              return parsed;
            }
          } catch (e) {
            console.warn('Error parsing default skema kunci_jawaban from DB:', e);
          }
        }
      } catch (err) {
        console.warn('get_default_skema_sekolah DB error:', err);
      }

      return fallbackDefault;
    };

    export const save_default_skema_sekolah = async (npsn, payload) => {
      // Validate non-empty npsn
      if (!npsn || typeof npsn !== 'string' || !npsn.trim()) {
        throw new Error('NPSN must be a non-empty string');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload must be an object');
      }

      // Validate custom mode weight sum and weights
      if (payload.mode === 'custom') {
        const skema = payload.skema || {};
        const allowedKeys = ['PG', 'PGK', 'BS', 'JODOH', 'ISIAN', 'URAIAN'];
        let total = 0;
        for (const key of allowedKeys) {
          const val = parseFloat(skema[key] ?? 0);
          if (isNaN(val) || val < 0) {
            throw new Error(`Negative or NaN weight for ${key}: ${skema[key]}`);
          }
          total += val;
        }
        if (Math.round(total * 100) / 100 !== 100) {
          throw new Error(`Total percentage must equal 100%, got ${total}%`);
        }
      }

      const recordId = 'SKEMA_DEFAULT_' + npsn;
      const record = {
        id_soal: recordId,
        tipe_soal: 'SKEMA_DEFAULT',
        id_mapel: null,
        pertanyaan: 'Skema Penilaian Default Sekolah',
        kunci_jawaban: JSON.stringify(payload),
        bobot: 1,
        npsn: npsn
      };

      try {
        const { data: existing } = await supabaseClient
          .from('soal_ujian')
          .select('id_soal')
          .eq('id_soal', recordId)
          .eq('npsn', npsn)
          .maybeSingle();

        if (existing) {
          const { error } = await supabaseClient
            .from('soal_ujian')
            .update(record)
            .eq('id_soal', recordId)
            .eq('npsn', npsn);
          if (error) console.warn('Database update error in save_default_skema_sekolah:', error);
        } else {
          const { error } = await supabaseClient
            .from('soal_ujian')
            .insert([record]);
          if (error) console.warn('Database insert error in save_default_skema_sekolah:', error);
        }
      } catch (err) {
        console.warn('save_default_skema_sekolah network/DB warning:', err);
      }

      // Sync cache to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nexa_default_skema_' + npsn, JSON.stringify(payload));
      }

      return { success: true, data: payload };
    };

    /**
     * Roman <-> Arabic numeral map for standard Indonesian school grades (1-12 / I-XII).
     */
    const GRADE_MAP = {
      '1': 'I', 'I': 'I',
      '2': 'II', 'II': 'II',
      '3': 'III', 'III': 'III',
      '4': 'IV', 'IV': 'IV',
      '5': 'V', 'V': 'V',
      '6': 'VI', 'VI': 'VI',
      '7': 'VII', 'VII': 'VII',
      '8': 'VIII', 'VIII': 'VIII',
      '9': 'IX', 'IX': 'IX',
      '10': 'X', 'X': 'X',
      '11': 'XI', 'XI': 'XI',
      '12': 'XII', 'XII': 'XII'
    };

    const normalizeGrade = (tok) => {
      if (!tok) return '';
      const up = String(tok).trim().toUpperCase();
      return GRADE_MAP[up] || up;
    };

    const cleanTokens = (str, normalizeFirstAsGrade = true) => {
      if (!str) return [];
      let s = String(str).trim().toUpperCase();
      s = s.replace(/\|/g, ' ');
      s = s.replace(/^TINGKAT\s+/i, '');
      s = s.replace(/^KELAS\s+/i, '');
      s = s.replace(/^ROMBEL\s+/i, '');
      s = s.replace(/^PARALEL\s+/i, '');
      s = s.replace(/\s*\(SEMUA(\s*(KELAS|ROMBEL|SISWA|TINGKAT))?\)$/i, '');
      s = s.replace(/^SEMUA\s+(KELAS|TINGKAT|ROMBEL)?\s+/i, '');
      s = s.replace(/[^A-Z0-9]/g, ' ');
      const tokens = s.split(/\s+/).filter(Boolean);
      if (tokens.length > 0 && normalizeFirstAsGrade) {
        tokens[0] = normalizeGrade(tokens[0]);
      }
      return tokens;
    };

    /**
     * Determines whether a class allocation string represents an open/universal target.
     */
    export const isUniversalAlloc = (alloc) => {
      if (!alloc) return true;
      const s = String(alloc).trim();
      const up = s.toUpperCase();
      return (
        s === '' ||
        up === 'SEMUA' ||
        s === 'Semua' ||
        s === 'Semua Kelas' ||
        s === 'Semua Kelas (Umum)' ||
        s === 'Semua Tingkat' ||
        s === 'Semua Tingkat (Umum)' ||
        s === 'Semua Rombel' ||
        s === 'Semua Siswa' ||
        s === 'Umum' ||
        s === 'ALL' ||
        s === 'GLOBAL' ||
        s === '-' ||
        s === '*' ||
        /^SEMUA(\s+(KELAS|TINGKAT|ROMBEL|SISWA)?)?(\s*\(UMUM\))?$/i.test(s) ||
        /^UMUM(\s*\(SEMUA\))?$/i.test(s)
      );
    };

    const singleClassPipeRegex = /^(?:tingkat\s+|kelas\s+)?([0-9]+|[ivxlcdm]+)\|([a-z0-9_-]+(?:\s+[a-z0-9_-]+)*)$/i;

    /**
     * Safely parses and splits compound target strings across comma (,), semicolon (;),
     * pipe (|), and newlines, preserving single class specifications in "tingkat|paralel" format.
     */
    export const splitCompoundTargets = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.flatMap(r => splitCompoundTargets(r));
      const str = String(raw).trim();
      if (!str) return [];
      const primaryChunks = str.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
      const result = [];
      for (const rawChunk of primaryChunks) {
        const chunk = rawChunk.replace(/^[|]+|[|]+$/g, '').trim();
        if (!chunk) continue;
        if (!chunk.includes('|')) {
          result.push(chunk);
          continue;
        }
        if (singleClassPipeRegex.test(chunk)) {
          result.push(chunk);
          continue;
        }
        if (/\s+\|\s+/.test(chunk)) {
          const subChunks = chunk.split(/\s+\|\s+/).map(s => s.trim()).filter(Boolean);
          for (const sc of subChunks) {
            if (sc) result.push(...splitCompoundTargets(sc));
          }
          continue;
        }
        const subChunks = chunk.split(/\|+/).map(s => s.trim()).filter(Boolean);
        if (subChunks.length > 1) {
          for (const sc of subChunks) {
            if (sc) result.push(...splitCompoundTargets(sc));
          }
        } else {
          result.push(chunk);
        }
      }
      return result;
    };

    /**
     * Determines whether a student matches a target_kelas specification.
     * Supports specific parallel classes ('XI A'), grade levels ('Tingkat XI (Semua)', 'XI'),
     * and universal options ('Semua Kelas', 'Semua Tingkat', 'Semua Tingkat (Umum)', '', null).
     */
    export const isClassMatching = (targetKelas, student) => {
      if (!targetKelas) return true;

      if (Array.isArray(targetKelas)) {
        if (targetKelas.length === 0) return true;
        return targetKelas.some(t => isClassMatching(t, student));
      }

      const rawStr = String(targetKelas).trim();
      if (!rawStr) return true;

      if (isUniversalAlloc(rawStr)) return true;

      // Compound multi-target support: comma (,), semicolon (;), pipe (|), or newline (\n, \r)
      const subTargets = splitCompoundTargets(rawStr);
      if (subTargets.length > 1) {
        return subTargets.some(t => isClassMatching(t, student));
      }

      const rawTarget = (subTargets[0] || rawStr).toUpperCase();
      
      if (isUniversalAlloc(rawTarget)) return true;
      if (!student) return true;

      const targetTokens = cleanTokens(rawTarget, true);
      if (targetTokens.length === 0) return true;

      const isGradeWide = targetTokens.length === 1 || /\(SEMUA(\s*(KELAS|ROMBEL|SISWA|TINGKAT))?\)$/i.test(rawTarget);

      // Student grades and tokens
      const rawAngkatan = String(student.angkatan || '').trim();
      const rawParalel = String(student.kelas_paralel || '').trim();
      const rawKelas = String(student.kelas || '').trim();

      const angkatanTokens = cleanTokens(rawAngkatan, true);
      const paralelTokens = cleanTokens(rawParalel, false);
      const kelasTokens = cleanTokens(rawKelas, true);

      // Determine student grade
      const studentGrade = angkatanTokens[0] || (kelasTokens.length > 0 ? kelasTokens[0] : '');

      if (isGradeWide) {
        const targetGrade = targetTokens[0];
        if (studentGrade && studentGrade === targetGrade) return true;
        return false;
      }

      // Specific parallel match: target must match candidate representations
      const targetCompressed = targetTokens.join('');

      const candidates = new Set();
      if (kelasTokens.length > 0) {
        candidates.add(kelasTokens.join(''));
      }
      if (angkatanTokens.length > 0 && paralelTokens.length > 0) {
        candidates.add([...angkatanTokens, ...paralelTokens].join(''));
      }
      if (kelasTokens.length === 1 && paralelTokens.length > 0) {
        candidates.add([...kelasTokens, ...paralelTokens].join(''));
      }
      if (angkatanTokens.length > 0 && kelasTokens.length > 0 && kelasTokens[0] !== angkatanTokens[0]) {
        candidates.add([...angkatanTokens, ...kelasTokens].join(''));
      }

      return candidates.has(targetCompressed);
    };

    /**
     * Persist parallel class allocation metadata for a subject.
     * Mirrors the proven SKEMA_DEFAULT metadata design via soal_ujian and localStorage.
     */
    export const saveMapelAlokasi = async (id_mapel, npsn, alokasi_kelas) => {
      if (!id_mapel) return;
      let allocVal = alokasi_kelas || 'Semua Kelas';
      if (isUniversalAlloc(allocVal)) {
        allocVal = 'Semua Kelas';
      } else {
        const parts = splitCompoundTargets(allocVal);
        allocVal = parts.length > 0 ? parts.join(', ') : 'Semua Kelas';
      }

      // 1. Update localStorage cache synchronously
      if (typeof localStorage !== 'undefined') {
        try {
          const cacheKey = 'nexa_mapel_allocations_' + npsn;
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
          cached[id_mapel] = allocVal;
          localStorage.setItem(cacheKey, JSON.stringify(cached));
        } catch (_) {}
      }

      // 2. Persist to soal_ujian table
      const recordId = 'MAPEL_ALLOC_' + id_mapel;
      const record = {
        id_soal: recordId,
        tipe_soal: 'MAPEL_ALLOC',
        id_mapel: id_mapel,
        pertanyaan: allocVal,
        kunci_jawaban: allocVal,
        bobot: 1,
        npsn: npsn
      };

      try {
        const { data: existing } = await supabaseClient
          .from('soal_ujian')
          .select('id_soal')
          .eq('id_soal', recordId)
          .maybeSingle();

        if (existing) {
          await supabaseClient
            .from('soal_ujian')
            .update({
              pertanyaan: allocVal,
              kunci_jawaban: allocVal
            })
            .eq('id_soal', recordId);
        } else {
          await supabaseClient
            .from('soal_ujian')
            .insert([record]);
        }
      } catch (err) {
        console.warn('saveMapelAlokasi DB persist error:', err);
      }
    };

    /**
     * Delete parallel class allocation metadata when a subject is deleted.
     */
    export const deleteMapelAlokasi = async (id_mapel, npsn) => {
      if (!id_mapel) return;
      if (typeof localStorage !== 'undefined') {
        try {
          const cacheKey = 'nexa_mapel_allocations_' + npsn;
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
          delete cached[id_mapel];
          localStorage.setItem(cacheKey, JSON.stringify(cached));
        } catch (_) {}
      }
      try {
        await supabaseClient
          .from('soal_ujian')
          .delete()
          .eq('id_soal', 'MAPEL_ALLOC_' + id_mapel);
      } catch (err) {
        console.warn('deleteMapelAlokasi DB error:', err);
      }
    };

    export const getDefaultKopSettings = (user = {}) => {
      const u = user || {};
      const schoolName = u.nama_sekolah || u.sekolah || 'SEKOLAH INDONESIA';
      const schoolNpsn = u.npsn || '';
      const schoolAddress = u.alamat_sekolah || u.alamat || '';
      return {
        nama_sekolah: schoolName,
        npsn: schoolNpsn,
        alamat_sekolah: schoolAddress,
        kepala_sekolah: u.kepala_sekolah || '',
        nip_kepala_sekolah: u.nip_kepala_sekolah || '',

        // Logo configuration
        logo_kiri: u.logo_kiri || u.logo_dinas || null,
        logo_kanan: u.logo_kanan || u.logo || null,
        show_logo_kiri: u.show_logo_kiri !== false,
        show_logo_kanan: u.show_logo_kanan !== false,

        // Kartu Peserta configuration
        kop_baris1: u.kop_baris1 !== undefined ? u.kop_baris1 : 'PEMERINTAH PROVINSI DAERAH KHUSUS',
        kop_baris2: u.kop_baris2 || schoolName,
        kop_baris3: u.kop_baris3 || 'KARTU PESERTA ASESMEN / CBT',
        kop_baris4: u.kop_baris4 !== undefined ? u.kop_baris4 : (schoolAddress ? `${schoolAddress}${schoolNpsn ? ' • NPSN: ' + schoolNpsn : ''}` : (schoolNpsn ? `NPSN: ${schoolNpsn}` : '')),
        kartu_peserta_show_logo_kiri: u.kartu_peserta_show_logo_kiri !== false,
        kartu_peserta_show_logo_kanan: u.kartu_peserta_show_logo_kanan !== false,

        // Kartu Meja configuration
        kop_meja_mode: u.kop_meja_mode || 'formal', // 'formal' | 'minimalis'
        kop_meja_baris1: u.kop_meja_baris1 || schoolName,
        kop_meja_baris2: u.kop_meja_baris2 !== undefined ? u.kop_meja_baris2 : 'KARTU MEJA UJIAN CBT',
        kartu_meja_show_logo_kiri: u.kartu_meja_show_logo_kiri !== false,
        kartu_meja_show_logo_kanan: u.kartu_meja_show_logo_kanan !== false
      };
    };

    export const get_pengaturan_sekolah = async (npsn) => {
      const cleanNpsn = npsn !== null && npsn !== undefined ? String(npsn).trim() : '';
      const fallback = getDefaultKopSettings({ npsn: cleanNpsn });
      if (!cleanNpsn) {
        return fallback;
      }

      // Check localStorage cache
      if (typeof localStorage !== 'undefined') {
        try {
          const cached = localStorage.getItem('nexa_kop_settings_' + cleanNpsn);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') {
              return { ...fallback, ...parsed };
            }
          }
        } catch (e) {
          console.warn('Error reading kop settings from localStorage cache:', e);
        }
      }

      // Query Supabase for persisted school settings record
      try {
        const { data, error } = await supabaseClient
          .from('soal_ujian')
          .select('kunci_jawaban')
          .eq('id_soal', 'KOP_SETTINGS_' + cleanNpsn)
          .eq('npsn', cleanNpsn)
          .maybeSingle();

        if (!error && data && data.kunci_jawaban) {
          try {
            const parsed = JSON.parse(data.kunci_jawaban);
            if (parsed && typeof parsed === 'object') {
              const merged = { ...fallback, ...parsed };
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('nexa_kop_settings_' + cleanNpsn, JSON.stringify(merged));
              }
              return merged;
            }
          } catch (e) {
            console.warn('Error parsing kop settings JSON from DB:', e);
          }
        }
      } catch (err) {
        console.warn('get_pengaturan_sekolah DB error:', err);
      }

      return fallback;
    };

    export const save_pengaturan_sekolah = async (npsn, payload) => {
      const cleanNpsn = npsn !== null && npsn !== undefined ? String(npsn).trim() : '';
      if (!cleanNpsn) {
        throw new Error('NPSN must be a non-empty string');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Payload must be an object');
      }

      // Retrieve existing cache for partial updates to avoid wiping logos
      let existingCached = null;
      if (typeof localStorage !== 'undefined') {
        try {
          const cachedStr = localStorage.getItem('nexa_kop_settings_' + cleanNpsn);
          if (cachedStr) existingCached = JSON.parse(cachedStr);
        } catch (_) {}
      }
      const prevLogoKiri = existingCached ? (existingCached.logo_kiri !== undefined ? existingCached.logo_kiri : existingCached.logo_dinas) : null;
      const prevLogoKanan = existingCached ? (existingCached.logo_kanan !== undefined ? existingCached.logo_kanan : existingCached.logo) : null;

      // Normalize logo aliases for backward compatibility, honoring explicit null
      const resolvedLogoKiri = payload.logo_kiri !== undefined ? payload.logo_kiri : (payload.logo_dinas !== undefined ? payload.logo_dinas : prevLogoKiri);
      const resolvedLogoKanan = payload.logo_kanan !== undefined ? payload.logo_kanan : (payload.logo !== undefined ? payload.logo : prevLogoKanan);

      const normalized = {
        ...payload,
        logo_kiri: resolvedLogoKiri,
        logo_dinas: resolvedLogoKiri,
        logo_kanan: resolvedLogoKanan,
        logo: resolvedLogoKanan
      };

      // Sync cache to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nexa_kop_settings_' + cleanNpsn, JSON.stringify(normalized));
      }

      const recordId = 'KOP_SETTINGS_' + cleanNpsn;
      const record = {
        id_soal: recordId,
        tipe_soal: 'KOP_SETTINGS',
        id_mapel: null,
        pertanyaan: 'Pengaturan Kop dan Logo Sekolah',
        kunci_jawaban: JSON.stringify(normalized),
        bobot: 1,
        npsn: cleanNpsn
      };

      try {
        const { data: existing } = await supabaseClient
          .from('soal_ujian')
          .select('id_soal')
          .eq('id_soal', recordId)
          .eq('npsn', cleanNpsn)
          .maybeSingle();

        if (existing) {
          const { error } = await supabaseClient
            .from('soal_ujian')
            .update(record)
            .eq('id_soal', recordId)
            .eq('npsn', cleanNpsn);
          if (error) console.warn('Database update error in save_pengaturan_sekolah:', error);
        } else {
          const { error } = await supabaseClient
            .from('soal_ujian')
            .insert([record]);
          if (error) console.warn('Database insert error in save_pengaturan_sekolah:', error);
        }
      } catch (err) {
        console.warn('save_pengaturan_sekolah DB warning:', err);
      }

      // Sync school name to sekolah table if provided
      if (normalized.nama_sekolah) {
        try {
          await supabaseClient
            .from('sekolah')
            .update({ nama_sekolah: normalized.nama_sekolah })
            .eq('npsn', cleanNpsn);
        } catch (err) {
          console.warn('update nama_sekolah warning:', err);
        }
      }

      return { success: true, status: 'success', data: normalized, message: 'Pengaturan profil sekolah dan kop berhasil disimpan.' };
    };

    export const autoPurgeWeeklyLogs = async (force = false, customCutoff = null) => {
      try {
        const now = new Date();
        const isSunday = now.getDay() === 0;
        if (!isSunday && !force) {
          return { status: 'skipped', message: 'Bukan hari Minggu, pembersihan diskip.' };
        }

        let cutoffIso = customCutoff;
        if (!cutoffIso) {
          const sundayStart = new Date(now);
          sundayStart.setHours(0, 0, 0, 0);
          cutoffIso = sundayStart.toISOString();
        }

        // 1. Purge & Archive audit_log sebelum cutoff
        const { data: oldAuditLogs } = await supabaseClient
          .from('audit_log')
          .select('*')
          .lt('created_at', cutoffIso);

        if (oldAuditLogs && oldAuditLogs.length > 0) {
          const archiveEntries = oldAuditLogs.map(l => ({
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
          const oldIds = oldAuditLogs.map(l => l.id_audit);
          await supabaseClient.from('audit_log').delete().in('id_audit', oldIds);
        }

        // 2. Purge log_aktivitas_global sebelum cutoff
        await supabaseClient
          .from('log_aktivitas_global')
          .delete()
          .lt('created_at', cutoffIso);

        // 3. Purge arsip audit usang (> 30 hari)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseClient.from('audit_log_archive').delete().lt('created_at', thirtyDaysAgo);

        return { 
          status: 'success', 
          message: 'Log mingguan berhasil dibersihkan.', 
          cutoff: cutoffIso, 
          auditPurged: oldAuditLogs?.length || 0 
        };
      } catch (err) {
        console.warn('Pembersihan log mingguan warning:', err);
        return { status: 'error', message: err.message };
      }
    };

    export const fetchAPI = async (action, payload = {}) => {
      try {
        // ================= APPLICATION-LEVEL RLS =================
        // Menolak kueri jika npsn tidak disertakan untuk rute non-global
        const globalRoutes = [
          'login', 'register', 'get_sekolah', 'create_sekolah', 'delete_sekolah', 'update_sekolah', 
          'get_admin_all', 'create_admin_sekolah', 'update_admin_sekolah', 'delete_admin_sekolah', 
          'get_analytics', 'update_admin_profil', 'get_pengumuman_global', 'create_pengumuman_global', 
          'delete_pengumuman_global', 'get_log_aktivitas_global', 'create_log_aktivitas_global', 'purge_weekly_logs',
          'update_sekolah_status', 'update_superadmin_password', 'reset_all_data',
          'get_status_log_ujian', 'simpan_kehadiran_siswa', 'submit_absensi_siswa', 
          'verifikasi_absensi', 'verifikasi_absensi_bulk',
          'get_soal_ujian', 'submit_ujian', 'catat_pelanggaran'
        ];
        if (!globalRoutes.includes(action)) {
          if (Array.isArray(payload)) {
            if (payload.some(p => !p || !p.npsn)) throw new Error("Security Violation: Akses ditolak. NPSN hilang pada bulk payload.");
          } else {
            if (!payload || !payload.npsn) throw new Error("Security Violation: Akses ditolak. Kueri tidak memiliki parameter NPSN.");
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

            if (payload.role === 'guru') {
              const loginId = (payload.username || payload.nip)?.trim();
              ({ data, error } = await supabaseClient
                .from('guru')
                .select('*')
                .or(`username.eq.${loginId},nip.eq.${loginId}`)
                .eq('password', payload.password)
                .eq('npsn', payload.npsn)
                .maybeSingle());
              if (error || !data) return { status: 'error', message: 'Username / NIP, password, atau NPSN salah.' };
              data.role = 'guru';
              return { status: 'success', data };
            }

            const table = payload.role === 'admin' ? 'admin' : 'siswa';
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
                  const parts = data.session_token.split('|');
                  let isActive = true;
                  if (parts.length === 2) {
                     const lastActive = parseInt(parts[1], 10);
                     // Allow login if lastActive is older than 3 minutes (180000 ms)
                     if (Date.now() - lastActive > 3 * 60 * 1000) {
                         isActive = false; 
                     }
                  }

                  if (isActive) {
                      return { status: 'error', message: 'Akun Anda sedang digunakan. Tunggu 3 menit setelah keluar, atau minta admin mereset sesi Anda.' };
                  }
               }
               // Generate and set new session_token with timestamp
               const newSessionToken = crypto.randomUUID() + '|' + Date.now();
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
          case 'heartbeat_siswa': {
             const { data: dbData } = await supabaseClient.from('siswa').select('session_token').eq('id_siswa', payload.id_siswa).single();
             if (dbData && dbData.session_token) {
                 const currentUuid = dbData.session_token.split('|')[0];
                 const payloadUuid = payload.session_token.split('|')[0];
                 if (currentUuid === payloadUuid) {
                     const newToken = currentUuid + '|' + Date.now();
                     await supabaseClient.from('siswa').update({ session_token: newToken }).eq('id_siswa', payload.id_siswa);
                     return { status: 'success' };
                 }
             }
             return { status: 'error', message: 'Sesi tidak valid' };
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
            const { data: rpcData, error: rpcError } = await supabaseClient.rpc('delete_sekolah_cascade', { p_npsn: payload.npsn });
            if (!rpcError && rpcData) {
              if (rpcData.status === 'error') return { status: 'error', message: rpcData.message };
              return { status: 'success', message: rpcData.message, data: rpcData };
            }
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
               sekolah: sekolahData?.find(s => s.npsn === a.npsn) || { nama_sekolah: '-' }
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
            return { status: 'success', message: 'Profil berhasil diperbarui.' };
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
          case 'purge_weekly_logs': {
            const res = await autoPurgeWeeklyLogs(payload.force || false, payload.cutoff);
            return res;
          }
          case 'get_log_aktivitas_global': {
            await autoPurgeWeeklyLogs(false);
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
            const { data, error } = await supabaseClient
              .from('soal_ujian')
              .select('*, mata_pelajaran(nama_mapel)')
              .eq('npsn', payload.npsn)
              .neq('tipe_soal', 'SKEMA_DEFAULT')
              .neq('tipe_soal', 'SKEMA_PENILAIAN')
              .neq('tipe_soal', 'MAPEL_ALLOC')
              .neq('tipe_soal', 'KOP_SETTINGS')
              .order('id_soal', { ascending: false });
            if (error) return { status: 'error', message: error.message };
            const mapped = (data || []).map(s => ({
              ...s,
              jawaban_benar: s.jawaban_benar || s.kunci_jawaban
            }));
            return { status: 'success', data: mapped };
          }
          
          case 'get_admin_dashboard_data': {
            const [siswaRes, guruRes, jadwalRes, aktifRes, mapelRes, soalRes] = await Promise.all([
              supabaseClient.from('siswa').select('id_siswa', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('guru').select('id_guru', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('jadwal').select('id_jadwal', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('log_ujian').select('id_log, jadwal!inner(npsn)', { count: 'exact' }).eq('status_ujian', 'SEDANG KERJA').eq('jadwal.npsn', payload.npsn),
              supabaseClient.from('mata_pelajaran').select('id_mapel', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('soal_ujian').select('id_soal', { count: 'exact' }).eq('npsn', payload.npsn).neq('tipe_soal', 'SKEMA_DEFAULT').neq('tipe_soal', 'SKEMA_PENILAIAN').neq('tipe_soal', 'MAPEL_ALLOC').neq('tipe_soal', 'KOP_SETTINGS')
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
          case 'update_profil_siswa': {
            const { id_siswa, password, foto_profil } = payload;
            const updateData = {};
            if (password) updateData.password = password;
            if (foto_profil) updateData.foto_profil = foto_profil;
            if (Object.keys(updateData).length === 0) return { status: 'error', message: 'Tidak ada data yang diubah.' };
            ({ error } = await supabaseClient.from('siswa').update(updateData).eq('id_siswa', id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Profil berhasil diperbarui.' };
          }
          case 'delete_siswa': {
            ({ error } = await supabaseClient.from('siswa').delete().eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil dihapus' };
          }
          case 'delete_siswa_bulk': {
            if (!payload.ids || !payload.ids.length) return { status: 'error', message: 'Tidak ada siswa yang dipilih.' };
            ({ error } = await supabaseClient.from('siswa').delete().in('id_siswa', payload.ids).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: `${payload.ids.length} siswa berhasil dihapus.` };
          }
          case 'buka_blokir_siswa':
          case 'reset_sesi_siswa': {
            const idSiswa = payload.id_siswa || payload.p_id_siswa;
            const idJadwal = payload.id_jadwal || payload.p_id_jadwal;
            const idLog = payload.id_log;

            if (!idSiswa && !idLog) {
              return { status: 'error', message: 'ID Siswa atau ID Log wajib disertakan.' };
            }

            // 1. Reset login token on siswa table to clear 3-minute multi-login lock
            if (idSiswa) {
              let qSiswa = supabaseClient.from('siswa').update({ session_token: null }).eq('id_siswa', idSiswa);
              if (payload.npsn) qSiswa = qSiswa.eq('npsn', payload.npsn);
              await qSiswa;
            }

            // 2. Unblock & reset exam session in log_ujian non-destructively
            let qLog = supabaseClient
              .from('log_ujian')
              .update({
                is_blocked: false,
                pelanggaran: 0,
                status_ujian: 'SEDANG KERJA',
                waktu_selesai: null
              });

            if (idLog) {
              qLog = qLog.eq('id_log', idLog);
            } else if (idSiswa && idJadwal) {
              qLog = qLog.eq('id_siswa', idSiswa).eq('id_jadwal', idJadwal);
            } else if (idSiswa) {
              qLog = qLog.eq('id_siswa', idSiswa);
            }

            const { error: errLog } = await qLog;
            if (errLog) return { status: 'error', message: errLog.message };

            return { status: 'success', message: 'Sesi siswa berhasil direset.' };
          }
          // DATA KELAS
          case 'get_kelas': {
            ({ data, error } = await supabaseClient.from('kelas').select('*').eq('npsn', payload.npsn).order('tingkat', { ascending: true }));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data };
          }
          case 'create_kelas': {
            payload.id_kelas = payload.id_kelas || crypto.randomUUID();
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
            const bulkData = payload.map(item => {
              const { mata_pelajaran, mapels, ...rest } = item;
              return {
                ...rest,
                id_guru: item.id_guru || generateId('G'),
                _mapels: Array.isArray(mapels) ? mapels : []
              };
            });
            const guruInserts = bulkData.map(({ _mapels, ...g }) => g);
            ({ error } = await supabaseClient.from('guru').insert(guruInserts));
            if (error) {
              if (error.message && error.message.includes('guru_username_key')) {
                return { status: 'error', message: 'Gagal menambah data masal: Terdapat username guru yang sudah digunakan.' };
              }
              return { status: 'error', message: error.message };
            }
            const mapelInserts = [];
            for (const item of bulkData) {
              if (item._mapels && item._mapels.length > 0) {
                for (const mId of item._mapels) {
                  mapelInserts.push({ id_guru: item.id_guru, id_mapel: mId });
                }
              }
            }
            if (mapelInserts.length > 0) {
              await supabaseClient.from('guru_mapel').insert(mapelInserts);
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
          case 'delete_guru_bulk': {
            if (!payload.ids || !payload.ids.length) return { status: 'error', message: 'Tidak ada guru yang dipilih.' };
            ({ error } = await supabaseClient.from('guru').delete().in('id_guru', payload.ids).eq('npsn', payload.npsn));
            if (error) {
              if (error.code === '23503') return { status: 'error', message: 'Gagal: Sebagian guru tidak dapat dihapus karena masih terhubung dengan Mata Pelajaran atau Jadwal Ujian.' };
              return { status: 'error', message: error.message };
            }
            return { status: 'success', message: `${payload.ids.length} guru berhasil dihapus.` };
          }

          // MATA PELAJARAN
          case 'get_all_mapel': {
            const { data: mapelData, error: mapelErr } = await supabaseClient.from('mata_pelajaran').select('*').eq('npsn', payload.npsn);
            if (mapelErr) return { status: 'error', message: mapelErr.message };
            
            const { data: soalData } = await supabaseClient.from('soal_ujian')
              .select('id_mapel, id_soal, tipe_soal, pertanyaan')
              .eq('npsn', payload.npsn);
            
            // Extract allocations from soal_ujian metadata records
            const dbAllocMap = {};
            (soalData || []).forEach(s => {
              if (s.tipe_soal === 'MAPEL_ALLOC' && s.id_soal && s.id_soal.startsWith('MAPEL_ALLOC_')) {
                const mapelId = s.id_soal.replace('MAPEL_ALLOC_', '');
                dbAllocMap[mapelId] = s.pertanyaan || 'Semua Kelas';
              }
            });

            // LocalStorage cache fallback/merge
            let cachedAllocMap = {};
            if (typeof localStorage !== 'undefined') {
              try {
                cachedAllocMap = JSON.parse(localStorage.getItem('nexa_mapel_allocations_' + payload.npsn) || '{}');
              } catch (_) {}
            }
            const allocMap = { ...cachedAllocMap, ...dbAllocMap };
            if (typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem('nexa_mapel_allocations_' + payload.npsn, JSON.stringify(allocMap));
              } catch (_) {}
            }

            const processedData = (mapelData || []).map(m => {
              const jumlah_soal = (soalData || []).filter(s => 
                s.id_mapel === m.id_mapel && 
                s.tipe_soal !== 'SKEMA_DEFAULT' && 
                s.tipe_soal !== 'SKEMA_PENILAIAN' && 
                s.tipe_soal !== 'MAPEL_ALLOC' &&
                s.tipe_soal !== 'KOP_SETTINGS'
              ).length;
              const alokasi_kelas = allocMap[m.id_mapel] || m.alokasi_kelas || 'Semua Kelas';
              return { ...m, jumlah_soal, alokasi_kelas };
            });
            return { status: 'success', data: processedData };
          }
          case 'create_mapel': {
            const alokasiKelas = payload.alokasi_kelas || 'Semua Kelas';
            const { alokasi_kelas, ...mapelPayload } = payload;
            if (!mapelPayload.id_mapel) mapelPayload.id_mapel = generateId('M');

            // Attempt insert with alokasi_kelas if column exists, fallback to mapelPayload without it
            let resInsert = await supabaseClient.from('mata_pelajaran').insert([{ ...mapelPayload, alokasi_kelas: alokasiKelas }]);
            if (resInsert.error && resInsert.error.message && resInsert.error.message.includes('alokasi_kelas')) {
              resInsert = await supabaseClient.from('mata_pelajaran').insert([mapelPayload]);
            }
            if (resInsert.error) return { status: 'error', message: resInsert.error.message };

            // Persist alokasi_kelas via metadata in soal_ujian & localStorage
            await saveMapelAlokasi(mapelPayload.id_mapel, mapelPayload.npsn, alokasiKelas);

            return { status: 'success', message: 'Mata pelajaran berhasil ditambahkan' };
          }
          case 'create_mapel_bulk': {
            if (!Array.isArray(payload) || payload.length === 0) {
              return { status: 'error', message: 'Tidak ada data mata pelajaran untuk disimpan' };
            }
            const seen = new Set();
            const bulkData = [];
            const npsnSet = new Set();
            for (const item of payload) {
              if (!item) continue;
              const name = String(item.nama_mapel ?? '').replace(/\s+/g, ' ').trim();
              if (!name) continue;
              const npsn = String(item.npsn || '').trim();
              if (npsn) npsnSet.add(npsn);
              const key = `${npsn}_${name.toLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              bulkData.push({
                ...item,
                nama_mapel: name,
                id_mapel: item.id_mapel || generateId('M')
              });
            }
            if (bulkData.length === 0) {
              return { status: 'error', message: 'Tidak ada data mata pelajaran yang valid untuk disimpan' };
            }

            let toInsert = bulkData;
            if (npsnSet.size > 0) {
              const { data: existingMapel, error: existErr } = await supabaseClient
                .from('mata_pelajaran')
                .select('npsn, nama_mapel')
                .in('npsn', Array.from(npsnSet))
                .limit(5000);

              if (!existErr && existingMapel && existingMapel.length > 0) {
                const dbSeen = new Set(existingMapel.map(m => `${m.npsn || ''}_${String(m.nama_mapel || '').replace(/\s+/g, ' ').trim().toLowerCase()}`));
                toInsert = bulkData.filter(item => !dbSeen.has(`${item.npsn || ''}_${item.nama_mapel.toLowerCase()}`));
              }
            }

            if (toInsert.length === 0) {
              return { status: 'success', message: 'Semua mata pelajaran sudah terdaftar di database', insertedCount: 0 };
            }

            let resBulk = await supabaseClient.from('mata_pelajaran').insert(toInsert);
            if (resBulk.error && resBulk.error.message && resBulk.error.message.includes('alokasi_kelas')) {
              const sanitized = toInsert.map(({ alokasi_kelas, ...rest }) => rest);
              resBulk = await supabaseClient.from('mata_pelajaran').insert(sanitized);
            }
            if (resBulk.error) return { status: 'error', message: resBulk.error.message };

            for (const item of toInsert) {
              await saveMapelAlokasi(item.id_mapel, item.npsn, item.alokasi_kelas || 'Semua Kelas');
            }

            return { status: 'success', message: 'Mata pelajaran berhasil ditambahkan secara massal', insertedCount: toInsert.length };
          }
          case 'update_mapel': {
            const { id_mapel, npsn, alokasi_kelas, ...updates } = payload;
            let resUpdate = await supabaseClient.from('mata_pelajaran').update({ ...updates, alokasi_kelas }).eq('id_mapel', id_mapel).eq('npsn', payload.npsn);
            if (resUpdate.error && resUpdate.error.message && resUpdate.error.message.includes('alokasi_kelas')) {
              resUpdate = await supabaseClient.from('mata_pelajaran').update(updates).eq('id_mapel', id_mapel).eq('npsn', payload.npsn);
            }
            if (resUpdate.error) return { status: 'error', message: resUpdate.error.message };

            if (alokasi_kelas !== undefined) {
              await saveMapelAlokasi(id_mapel, npsn, alokasi_kelas);
            }

            return { status: 'success', message: 'Mata pelajaran berhasil diperbarui' };
          }
          case 'delete_mapel': {
            ({ error } = await supabaseClient.from('mata_pelajaran').delete().eq('id_mapel', payload.id_mapel).eq('npsn', payload.npsn));
            if (error) {
              if (error.code === '23503') return { status: 'error', message: 'Gagal: Mata Pelajaran ini tidak dapat dihapus karena masih memiliki Bank Soal atau Jadwal Ujian yang aktif.' };
              return { status: 'error', message: error.message };
            }
            await deleteMapelAlokasi(payload.id_mapel, payload.npsn);
            return { status: 'success', message: 'Mata pelajaran berhasil dihapus' };
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


          case 'delete_jadwal': {
            ({ error } = await supabaseClient.from('jadwal').delete().eq('id_jadwal', payload.id_jadwal).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil dihapus.' };
          }
          case 'delete_jadwal_bulk': {
            if (!payload.ids || !payload.ids.length) return { status: 'error', message: 'Tidak ada jadwal yang dipilih.' };
            ({ error } = await supabaseClient.from('jadwal').delete().in('id_jadwal', payload.ids).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: `${payload.ids.length} jadwal berhasil dihapus.` };
          }

          // ================= RUANG & PENGAWAS UJIAN =================
          case 'get_ruang': {
            const { data: ruangList, error: errRuang } = await supabaseClient
              .from('ruang_ujian')
              .select('*')
              .eq('npsn', payload.npsn)
              .order('nama_ruang', { ascending: true });
            if (errRuang) return { status: 'error', message: errRuang.message };
            return { status: 'success', data: ruangList || [] };
          }

          case 'create_ruang': {
            if (!payload.nama_ruang) return { status: 'error', message: 'Nama ruang wajib diisi.' };
            const newId = payload.id_ruang || generateId('R');
            const insertPayload = {
              id_ruang: newId,
              npsn: payload.npsn,
              nama_ruang: payload.nama_ruang,
              kode_ruang: payload.kode_ruang || newId,
              kapasitas: Number(payload.kapasitas) || 30,
              keterangan: payload.keterangan || null
            };
            const { error: errInsert } = await supabaseClient.from('ruang_ujian').insert([insertPayload]);
            if (errInsert) return { status: 'error', message: errInsert.message };
            return { status: 'success', message: 'Ruang ujian berhasil ditambahkan.', data: insertPayload };
          }

          case 'update_ruang': {
            if (!payload.id_ruang) return { status: 'error', message: 'ID ruang wajib diisi.' };
            const { id_ruang, npsn, ...updates } = payload;
            if (updates.kapasitas !== undefined) updates.kapasitas = Number(updates.kapasitas);
            const { error: errUpdate } = await supabaseClient
              .from('ruang_ujian')
              .update(updates)
              .eq('id_ruang', id_ruang)
              .eq('npsn', npsn);
            if (errUpdate) return { status: 'error', message: errUpdate.message };
            return { status: 'success', message: 'Ruang ujian berhasil diperbarui.' };
          }

          case 'delete_ruang': {
            if (!payload.id_ruang) return { status: 'error', message: 'ID ruang wajib diisi.' };
            const { error: errDelete } = await supabaseClient
              .from('ruang_ujian')
              .delete()
              .eq('id_ruang', payload.id_ruang)
              .eq('npsn', payload.npsn);
            if (errDelete) return { status: 'error', message: errDelete.message };
            return { status: 'success', message: 'Ruang ujian berhasil dihapus.' };
          }

          case 'get_pengawas_ruang': {
            let query = supabaseClient
              .from('pengawas_ruang')
              .select(`
                *,
                guru:id_guru (id_guru, nama_lengkap, nip, foto, username),
                ruang:id_ruang (id_ruang, nama_ruang, kapasitas, kode_ruang),
                jadwal:id_jadwal (id_jadwal, target_kelas, waktu_mulai, waktu_selesai, id_mapel, mata_pelajaran(nama_mapel))
              `)
              .eq('npsn', payload.npsn);

            if (payload.id_jadwal) query = query.eq('id_jadwal', payload.id_jadwal);
            if (payload.id_ruang) query = query.eq('id_ruang', payload.id_ruang);
            if (payload.id_guru) query = query.eq('id_guru', payload.id_guru);

            const { data: pengawasData, error: errPengawas } = await query.order('created_at', { ascending: false });
            if (errPengawas) return { status: 'error', message: errPengawas.message };
            return { status: 'success', data: pengawasData || [] };
          }

          case 'assign_pengawas_ruang': {
            if (!payload.id_ruang || !payload.id_guru) {
              return { status: 'error', message: 'Ruang dan Guru pengawas wajib dipilih.' };
            }
            const newId = payload.id_penugasan || generateId('TGS');
            const record = {
              id_penugasan: newId,
              npsn: payload.npsn,
              id_ruang: payload.id_ruang,
              id_guru: payload.id_guru,
              id_jadwal: payload.id_jadwal || null,
              peran: payload.peran || 'PENGAWAS UTAMA',
              status_tugas: payload.status_tugas || 'AKTIF'
            };
            const { error: errAssign } = await supabaseClient.from('pengawas_ruang').insert([record]);
            if (errAssign) return { status: 'error', message: errAssign.message };
            return { status: 'success', message: 'Pengawas berhasil ditugaskan ke ruang ujian.', data: record };
          }

          case 'delete_pengawas_ruang': {
            if (!payload.id_penugasan) return { status: 'error', message: 'ID penugasan wajib diisi.' };
            const { error: errDel } = await supabaseClient
              .from('pengawas_ruang')
              .delete()
              .eq('id_penugasan', payload.id_penugasan)
              .eq('npsn', payload.npsn);
            if (errDel) return { status: 'error', message: errDel.message };
            return { status: 'success', message: 'Penugasan pengawas berhasil dihapus.' };
          }

          case 'get_ruang_guru_pengawas': {
            const { data: listTugas, error: errTugas } = await supabaseClient
              .from('pengawas_ruang')
              .select(`
                *,
                ruang:id_ruang (*),
                jadwal:id_jadwal (*, mata_pelajaran(nama_mapel))
              `)
              .eq('id_guru', payload.id_guru)
              .eq('npsn', payload.npsn)
              .eq('status_tugas', 'AKTIF');

            if (errTugas) return { status: 'error', message: errTugas.message };
            return { status: 'success', data: listTugas || [] };
          }

          case 'assign_siswa_ruang_bulk': {
            const { npsn, id_ruang, nama_ruang, target_kelas, list_id_siswa } = payload;
            const roomValue = nama_ruang || id_ruang;
            if (!roomValue) return { status: 'error', message: 'Nama ruang atau ID ruang wajib diisi.' };

            let q = supabaseClient.from('siswa').update({ ruang: roomValue }).eq('npsn', npsn);
            
            if (Array.isArray(list_id_siswa) && list_id_siswa.length > 0) {
              q = q.in('id_siswa', list_id_siswa);
            } else if (target_kelas) {
              q = q.ilike('kelas', `${target_kelas}%`);
            } else {
              return { status: 'error', message: 'Kriteria alokasi siswa tidak lengkap (list_id_siswa atau target_kelas).' };
            }

            const { error: errBulk } = await q;
            if (errBulk) return { status: 'error', message: errBulk.message };
            return { status: 'success', message: 'Alokasi siswa ke ruangan berhasil disimpan.' };
          }

          case 'simpan_kehadiran_siswa':
          case 'submit_absensi_siswa': {
            let { id_jadwal, id_siswa, id_ruang, tanda_tangan, npsn, id_log, status_kehadiran } = payload;
            if (!tanda_tangan || typeof tanda_tangan !== 'string' || !tanda_tangan.startsWith('data:image')) {
              return { status: 'error', message: 'Tanda tangan digital tidak valid (wajib format Base64 data:image).' };
            }

            // Minimum signature length validation: reject empty or 0-byte Data URLs and 1x1 blank transparent PNG
            const base64Data = tanda_tangan.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
            if (
              tanda_tangan.length < 100 || 
              base64Data.length < 50 || 
              tanda_tangan === 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            ) {
              return { status: 'error', message: 'Tanda tangan digital kosong atau tidak valid.' };
            }

            // Retrieve missing fields from log_ujian if id_log is provided
            if (id_log && (!id_jadwal || !id_siswa || !npsn)) {
              const { data: logInfo } = await supabaseClient
                .from('log_ujian')
                .select('id_log, id_jadwal, id_siswa')
                .eq('id_log', id_log)
                .maybeSingle();

              if (logInfo) {
                id_jadwal = id_jadwal || logInfo.id_jadwal;
                id_siswa = id_siswa || logInfo.id_siswa;
              }
            }

            // Retrieve missing npsn or id_ruang from siswa
            if (id_siswa && (!npsn || !id_ruang)) {
              const { data: siswaInfo } = await supabaseClient
                .from('siswa')
                .select('npsn, ruang')
                .eq('id_siswa', id_siswa)
                .maybeSingle();

              if (siswaInfo) {
                npsn = npsn || siswaInfo.npsn;
                id_ruang = id_ruang || siswaInfo.ruang;
              }
            }

            // Retrieve missing npsn from jadwal
            if (id_jadwal && !npsn) {
              const { data: jadwalInfo } = await supabaseClient
                .from('jadwal')
                .select('npsn')
                .eq('id_jadwal', id_jadwal)
                .maybeSingle();
              if (jadwalInfo) npsn = jadwalInfo.npsn;
            }

            if (!npsn || !id_jadwal || !id_siswa) {
              return { status: 'error', message: 'Data absensi tidak lengkap (npsn, id_jadwal, id_siswa).' };
            }

            // Safe room resolution: verify if id_ruang matches an existing record in ruang_ujian
            // If not found (e.g. legacy free-text student room name), fallback to null to satisfy absensi_ujian_ruang_fkey
            let verifiedRoomId = null;
            let roomNameForLog = id_ruang || null;

            if (id_ruang) {
              const { data: matchById } = await supabaseClient
                .from('ruang_ujian')
                .select('id_ruang, nama_ruang')
                .eq('id_ruang', id_ruang)
                .maybeSingle();

              if (matchById) {
                verifiedRoomId = matchById.id_ruang;
                roomNameForLog = matchById.nama_ruang || matchById.id_ruang;
              } else {
                const { data: matchByName } = await supabaseClient
                  .from('ruang_ujian')
                  .select('id_ruang, nama_ruang')
                  .eq('nama_ruang', id_ruang)
                  .maybeSingle();

                if (matchByName) {
                  verifiedRoomId = matchByName.id_ruang;
                  roomNameForLog = matchByName.nama_ruang;
                } else {
                  verifiedRoomId = null;
                }
              }
            }

            const waktuAbsen = new Date().toISOString();
            const absensiRecord = {
              id_absensi: payload.id_absensi || generateId('ABS'),
              npsn,
              id_jadwal,
              id_siswa,
              id_ruang: verifiedRoomId,
              id_log: id_log || null,
              tanda_tangan,
              status_kehadiran: status_kehadiran || 'HADIR',
              status_verifikasi: 'MENUNGGU',
              waktu_absen: waktuAbsen
            };

            const { error: errAbs } = await supabaseClient
              .from('absensi_ujian')
              .upsert(absensiRecord, { onConflict: 'id_jadwal, id_siswa' });

            if (errAbs) return { status: 'error', message: errAbs.message };

            // Dual-write to log_ujian
            const logUpdate = {
              tanda_tangan,
              status_kehadiran: status_kehadiran || 'HADIR',
              waktu_absen: waktuAbsen
            };
            if (roomNameForLog) logUpdate.ruang = roomNameForLog;

            if (id_log) {
              await supabaseClient.from('log_ujian').update(logUpdate).eq('id_log', id_log);
            } else {
              await supabaseClient.from('log_ujian').update(logUpdate).eq('id_jadwal', id_jadwal).eq('id_siswa', id_siswa);
            }

            return { status: 'success', message: 'Absensi dan tanda tangan berhasil disimpan.', data: absensiRecord };
          }

          case 'get_absensi_ruang': {
            let q = supabaseClient
              .from('absensi_ujian')
              .select(`
                *,
                siswa:id_siswa (id_siswa, nama_lengkap, nisn, username, kelas, angkatan, kelas_paralel, foto_profil)
              `)
              .eq('id_jadwal', payload.id_jadwal)
              .eq('npsn', payload.npsn);

            if (payload.id_ruang) q = q.eq('id_ruang', payload.id_ruang);

            const { data: absData, error: errAbs } = await q.order('waktu_absen', { ascending: true });
            if (errAbs) return { status: 'error', message: errAbs.message };
            return { status: 'success', data: absData || [] };
          }

          case 'verifikasi_absensi': {
            const { id_absensi, status_verifikasi, id_guru, catatan, id_log } = payload;
            const newStatus = status_verifikasi || 'DISETUJUI';
            const nowIso = new Date().toISOString();
            const updatePayload = {
              status_verifikasi: newStatus,
              verified_by: id_guru || null,
              verified_at: nowIso,
              catatan_pengawas: catatan || null
            };

            let q = supabaseClient.from('absensi_ujian').update(updatePayload);
            if (id_absensi) {
              q = q.eq('id_absensi', id_absensi);
            } else if (id_log) {
              q = q.eq('id_log', id_log);
            } else {
              return { status: 'error', message: 'id_absensi atau id_log wajib diberikan.' };
            }

            const { error: errVerif } = await q;
            if (errVerif) return { status: 'error', message: errVerif.message };

            // Also update log_ujian
            const logVerifUpdate = {
              is_verified_kehadiran: newStatus === 'DISETUJUI',
              verified_by: id_guru || null,
              verified_at: nowIso
            };
            if (newStatus === 'DISETUJUI') logVerifUpdate.status_kehadiran = 'TERVERIFIKASI';
            else if (newStatus === 'DITOLAK') logVerifUpdate.status_kehadiran = 'DITOLAK';

            if (id_log) {
              await supabaseClient.from('log_ujian').update(logVerifUpdate).eq('id_log', id_log);
            } else if (id_absensi) {
              const { data: absRec } = await supabaseClient.from('absensi_ujian').select('id_jadwal, id_siswa, id_log').eq('id_absensi', id_absensi).maybeSingle();
              if (absRec) {
                if (absRec.id_log) {
                  await supabaseClient.from('log_ujian').update(logVerifUpdate).eq('id_log', absRec.id_log);
                } else {
                  await supabaseClient.from('log_ujian').update(logVerifUpdate).eq('id_jadwal', absRec.id_jadwal).eq('id_siswa', absRec.id_siswa);
                }
              }
            }

            return { status: 'success', message: 'Status kehadiran siswa berhasil diverifikasi.' };
          }

          case 'verifikasi_absensi_bulk': {
            const { list_id_absensi, id_guru, status_verifikasi } = payload;
            if (!Array.isArray(list_id_absensi) || list_id_absensi.length === 0) {
              return { status: 'error', message: 'Daftar ID absensi kosong atau tidak valid.' };
            }

            const newStatus = status_verifikasi || 'DISETUJUI';
            const nowIso = new Date().toISOString();
            const { error: errBulk } = await supabaseClient
              .from('absensi_ujian')
              .update({
                status_verifikasi: newStatus,
                verified_by: id_guru || null,
                verified_at: nowIso
              })
              .in('id_absensi', list_id_absensi);

            if (errBulk) return { status: 'error', message: errBulk.message };

            // Update associated log_ujian records
            const { data: updatedAbs } = await supabaseClient
              .from('absensi_ujian')
              .select('id_log, id_jadwal, id_siswa')
              .in('id_absensi', list_id_absensi);

            if (updatedAbs && updatedAbs.length > 0) {
              const logIds = updatedAbs.map(a => a.id_log).filter(Boolean);
              if (logIds.length > 0) {
                await supabaseClient
                  .from('log_ujian')
                  .update({
                    is_verified_kehadiran: newStatus === 'DISETUJUI',
                    verified_by: id_guru || null,
                    verified_at: nowIso,
                    status_kehadiran: newStatus === 'DISETUJUI' ? 'TERVERIFIKASI' : (newStatus === 'DITOLAK' ? 'DITOLAK' : 'HADIR')
                  })
                  .in('id_log', logIds);
              }
            }

            return { status: 'success', message: `${list_id_absensi.length} kehadiran siswa berhasil diproses.` };
          }

          case 'save_berita_acara': {
            const { 
              id_jadwal, 
              id_ruang, 
              npsn, 
              id_guru, 
              jumlah_peserta_terdaftar, 
              jumlah_peserta_hadir, 
              jumlah_peserta_absen, 
              daftar_siswa_tidak_hadir, 
              catatan_pelaksanaan, 
              tanda_tangan_pengawas,
              foto_dokumentasi,
              drive_url,
              drive_link
            } = payload;
            if (!id_jadwal || !id_ruang || !npsn) {
              return { status: 'error', message: 'id_jadwal, id_ruang, dan npsn wajib diisi.' };
            }

            const resolvedDriveUrl = drive_url || drive_link || null;
            // Encapsulate foto_dokumentasi & drive_url safely into catatan_pelaksanaan JSON
            // to avoid PostgreSQL 42703 error (column foto_dokumentasi does not exist on berita_acara_ujian)
            let finalCatatan = catatan_pelaksanaan || null;
            if (foto_dokumentasi || resolvedDriveUrl) {
              finalCatatan = JSON.stringify({
                catatan: catatan_pelaksanaan || '',
                foto_dokumentasi: foto_dokumentasi || null,
                drive_url: resolvedDriveUrl
              });
            }

            const record = {
              id_berita_acara: payload.id_berita_acara || generateId('BA'),
              npsn,
              id_jadwal,
              id_ruang,
              id_guru: id_guru || null,
              jumlah_peserta_terdaftar: Number(jumlah_peserta_terdaftar) || 0,
              jumlah_peserta_hadir: Number(jumlah_peserta_hadir) || 0,
              jumlah_peserta_absen: Number(jumlah_peserta_absen) || 0,
              daftar_siswa_tidak_hadir: typeof daftar_siswa_tidak_hadir === 'object' ? JSON.stringify(daftar_siswa_tidak_hadir) : (daftar_siswa_tidak_hadir || null),
              catatan_pelaksanaan: finalCatatan,
              tanda_tangan_pengawas: tanda_tangan_pengawas || null,
              updated_at: new Date().toISOString()
            };

            const { error: errBA } = await supabaseClient
              .from('berita_acara_ujian')
              .upsert(record, { onConflict: 'id_jadwal, id_ruang' });

            if (errBA) return { status: 'error', message: errBA.message };
            return { 
              status: 'success', 
              message: 'Berita acara ujian berhasil disimpan.', 
              data: {
                ...record,
                catatan_pelaksanaan: catatan_pelaksanaan || null,
                foto_dokumentasi: foto_dokumentasi || null,
                drive_url: resolvedDriveUrl
              } 
            };
          }

          case 'get_berita_acara': {
            const { id_jadwal, id_ruang, npsn } = payload;
            if (!id_jadwal || !id_ruang) {
              return { status: 'error', message: 'id_jadwal dan id_ruang wajib diisi.' };
            }

            let q = supabaseClient
              .from('berita_acara_ujian')
              .select('*, guru:id_guru(nama_lengkap, nip)')
              .eq('id_jadwal', id_jadwal)
              .eq('id_ruang', id_ruang);
            if (npsn) q = q.eq('npsn', npsn);
            const { data: ba, error: errBA } = await q.maybeSingle();
            if (errBA) return { status: 'error', message: errBA.message };

            let unpackedCatatan = ba?.catatan_pelaksanaan || null;
            let fotoDokumentasi = null;
            let driveUrl = null;

            if (ba?.catatan_pelaksanaan && typeof ba.catatan_pelaksanaan === 'string' && ba.catatan_pelaksanaan.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(ba.catatan_pelaksanaan);
                if (parsed && typeof parsed === 'object') {
                  unpackedCatatan = parsed.catatan !== undefined ? parsed.catatan : ba.catatan_pelaksanaan;
                  fotoDokumentasi = parsed.foto_dokumentasi || parsed.drive_url || null;
                  driveUrl = parsed.drive_url || parsed.drive_link || null;
                }
              } catch (_) {}
            }

            const processedBa = ba ? {
              ...ba,
              catatan_pelaksanaan: unpackedCatatan,
              foto_dokumentasi: fotoDokumentasi,
              drive_url: driveUrl
            } : null;

            return { status: 'success', data: processedBa };
          }

          case 'get_dokumen_ujian_cetak': {
            const { id_jadwal, id_ruang, npsn } = payload;
            if (!id_jadwal || !npsn) {
              return { status: 'error', message: 'id_jadwal dan npsn wajib diisi.' };
            }

            // 1. Data Sekolah & Kop Settings (Merged)
            const { data: sek } = await supabaseClient
              .from('sekolah')
              .select('*')
              .eq('npsn', npsn)
              .maybeSingle();

            const kopSettings = await get_pengaturan_sekolah(npsn);
            const resolvedAddress = kopSettings?.alamat_sekolah || kopSettings?.alamat || sek?.alamat || '';
            const mergedSekolah = {
              ...(sek || {}),
              nama_sekolah: sek?.nama_sekolah || kopSettings?.nama_sekolah || 'SEKOLAH INDONESIA',
              npsn: npsn,
              alamat: resolvedAddress,
              alamat_sekolah: resolvedAddress,
              logo: kopSettings?.logo_kanan || kopSettings?.logo || sek?.logo || null,
              logo_dinas: kopSettings?.logo_kiri || kopSettings?.logo_dinas || sek?.logo_dinas || null,
              kepala_sekolah: kopSettings?.kepala_sekolah || sek?.kepala_sekolah || '',
              nip_kepala_sekolah: kopSettings?.nip_kepala_sekolah || sek?.nip_kepala_sekolah || ''
            };

            // 2. Data Jadwal
            const { data: jdw } = await supabaseClient
              .from('jadwal')
              .select('*, mata_pelajaran(nama_mapel), guru(nama_lengkap, nip)')
              .eq('id_jadwal', id_jadwal)
              .maybeSingle();

            // 3. Data Ruang
            let rng = null;
            if (id_ruang) {
              const { data: rData } = await supabaseClient
                .from('ruang_ujian')
                .select('*')
                .eq('id_ruang', id_ruang)
                .maybeSingle();
              rng = rData;
            }

            // 4. Data Pengawas Ruang (Fetch all assigned proctors)
            let pgwQuery = supabaseClient
              .from('pengawas_ruang')
              .select('*, guru:id_guru(*)')
              .eq('npsn', npsn);
            if (id_jadwal) pgwQuery = pgwQuery.eq('id_jadwal', id_jadwal);
            if (id_ruang) pgwQuery = pgwQuery.eq('id_ruang', id_ruang);
            const { data: pgwRows } = await pgwQuery;
            const primaryProctor = (pgwRows && pgwRows.length > 0) ? pgwRows[0].guru : null;
            const allProctors = (pgwRows || []).map(r => r.guru).filter(Boolean);

            // 5. Data Berita Acara & Unpack Encapsulated Photo/Drive URL
            let baQuery = supabaseClient
              .from('berita_acara_ujian')
              .select('*, guru:id_guru(nama_lengkap, nip)')
              .eq('id_jadwal', id_jadwal);
            if (id_ruang) baQuery = baQuery.eq('id_ruang', id_ruang);
            const { data: ba } = await baQuery.maybeSingle();

            let unpackedCatatan = ba?.catatan_pelaksanaan || null;
            let fotoDokumentasi = null;
            let driveUrl = null;

            if (ba?.catatan_pelaksanaan && typeof ba.catatan_pelaksanaan === 'string' && ba.catatan_pelaksanaan.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(ba.catatan_pelaksanaan);
                if (parsed && typeof parsed === 'object') {
                  unpackedCatatan = parsed.catatan !== undefined ? parsed.catatan : ba.catatan_pelaksanaan;
                  fotoDokumentasi = parsed.foto_dokumentasi || parsed.drive_url || null;
                  driveUrl = parsed.drive_url || parsed.drive_link || null;
                }
              } catch (_) {}
            }

            const processedBa = ba ? {
              ...ba,
              catatan_pelaksanaan: unpackedCatatan,
              foto_dokumentasi: fotoDokumentasi,
              drive_url: driveUrl
            } : null;

            // 6. Daftar Siswa
            let qSiswa = supabaseClient
              .from('siswa')
              .select('id_siswa, nama_lengkap, nisn, username, kelas, ruang')
              .eq('npsn', npsn);
            if (rng && (rng.nama_ruang || rng.id_ruang)) {
              qSiswa = qSiswa.or(`ruang.eq.${rng.nama_ruang},ruang.eq.${rng.id_ruang}`);
            }
            const { data: daftarSiswa } = await qSiswa.order('nama_lengkap', { ascending: true });

            // 7. Absensi Ujian
            let absQuery = supabaseClient
              .from('absensi_ujian')
              .select('*')
              .eq('id_jadwal', id_jadwal);
            if (id_ruang) absQuery = absQuery.eq('id_ruang', id_ruang);
            const { data: absensiList } = await absQuery;

            const absensiMap = {};
            (absensiList || []).forEach(a => { absensiMap[a.id_siswa] = a; });

            const rekapPeserta = (daftarSiswa || []).map((s, idx) => {
              const abs = absensiMap[s.id_siswa];
              return {
                no: idx + 1,
                id_siswa: s.id_siswa,
                nama_lengkap: s.nama_lengkap,
                nisn: s.nisn || '-',
                kelas: s.kelas || '-',
                ruang: s.ruang || (rng ? rng.nama_ruang : '-'),
                tanda_tangan: abs ? abs.tanda_tangan : null,
                status_kehadiran: abs ? abs.status_kehadiran : 'TIDAK HADIR',
                status_verifikasi: abs ? abs.status_verifikasi : 'BELUM ABSEN',
                waktu_absen: abs ? abs.waktu_absen : null
              };
            });

            return {
              status: 'success',
              data: {
                sekolah: mergedSekolah,
                jadwal: jdw || null,
                ruang: rng || null,
                pengawas: primaryProctor,
                daftar_pengawas: allProctors,
                berita_acara: processedBa,
                foto_dokumentasi: fotoDokumentasi,
                drive_url: driveUrl,
                peserta: rekapPeserta
              }
            };
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
              .select('nilai_auto, nilai_uraian')
              .in('id_jadwal', jadwalIds)
              .eq('status_ujian', 'SELESAI');
            
            if (logError) return { status: 'error', message: logError.message };

            const totalSelesai = logData.length;
            const rataNilai = totalSelesai > 0 ? (logData.reduce((sum, log) => sum + ((Number(log.nilai_auto) || 0) + (Number(log.nilai_uraian) || 0)), 0) / totalSelesai).toFixed(1) : 0;

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
            if (payload.id_guru) {
              // 1. Query taught subjects from guru_mapel
              const { data: gmData } = await supabaseClient
                .from('guru_mapel')
                .select('id_mapel')
                .eq('id_guru', payload.id_guru);
              const taughtMapelIds = (gmData || []).map(g => g.id_mapel).filter(Boolean);

              // 2. Query assigned rooms from pengawas_ruang
              const { data: assignedRooms } = await supabaseClient
                .from('pengawas_ruang')
                .select('id_jadwal')
                .eq('id_guru', payload.id_guru)
                .eq('npsn', payload.npsn);
              const assignedJadwalIds = (assignedRooms || []).map(r => r.id_jadwal).filter(Boolean);

              // If teacher has neither taught subjects nor proctor assignments, return empty list
              if (taughtMapelIds.length === 0 && assignedJadwalIds.length === 0) {
                return { status: 'success', data: [] };
              }

              const orConditions = [];
              if (taughtMapelIds.length > 0) {
                orConditions.push(`id_mapel.in.(${taughtMapelIds.join(',')})`);
              }
              if (assignedJadwalIds.length > 0) {
                orConditions.push(`id_jadwal.in.(${assignedJadwalIds.join(',')})`);
              }
              q = q.or(orConditions.join(','));
            }
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
            ({ data, error } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', payload.id_mapel).eq('npsn', payload.npsn).neq('tipe_soal', 'MAPEL_ALLOC').neq('tipe_soal', 'SKEMA_DEFAULT').neq('tipe_soal', 'KOP_SETTINGS'));
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
            ({ data, error } = await supabaseClient.from('jawaban_siswa').select('*, soal_ujian(pertanyaan, tipe_soal)').eq('id_log', payload.id_log));
            if (error) return { status: 'error', message: error.message };
            const uraianList = (data || []).filter(j => j.soal_ujian && j.soal_ujian.tipe_soal === 'URAIAN');
            return {
              status: 'success',
              data: uraianList.map(j => ({ ...j, pertanyaan: j.soal_ujian ? j.soal_ujian.pertanyaan : 'Unknown' }))
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
              let updateQuery = supabaseClient.from('jadwal').update({
                token_aktif: token,
                last_update_token: nowTime.toISOString()
              }).eq('id_jadwal', payload.id_jadwal);

              updateQuery = data.last_update_token != null
                ? updateQuery.eq('last_update_token', data.last_update_token)
                : updateQuery.is('last_update_token', null);

              await updateQuery;
            }
            return { status: 'success', token };
          }

          case 'monitoring_ujian': {
            ({ data, error } = await supabaseClient
              .from('log_ujian')
              .select('*, siswa!inner(nama_lengkap, nisn, username, angkatan, kelas_paralel, kelas, npsn)')
              .eq('id_jadwal', payload.id_jadwal)
              .eq('siswa.npsn', payload.npsn));
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
                kelas: l.kelas || (l.siswa ? (l.siswa.kelas || `${l.siswa.angkatan || ''} ${l.siswa.kelas_paralel || ''}`.trim()) : '-')
              }))
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
            ({ error } = await supabaseClient.from('log_ujian').update({ is_blocked: false, pelanggaran: 0 }).eq('id_log', payload.id_log));
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
              const { data: siswaData } = await supabaseClient
                .from('siswa')
                .select('id_siswa, angkatan, kelas_paralel, kelas')
                .eq('id_siswa', payload.id_siswa)
                .eq('npsn', payload.npsn)
                .single();
              
              const { data: allJadwal, error } = await supabaseClient
                .from('jadwal')
                .select('*, guru(nama_lengkap), mata_pelajaran(nama_mapel)')
                .eq('npsn', payload.npsn)
                .order('waktu_mulai', { ascending: false });

              if (error) return { status: 'error', message: error.message };

              // Filter schedules strictly matching student's class and parallel section
              const matchingJadwal = (allJadwal || []).filter(j => isClassMatching(j.target_kelas, siswaData));

              const { data: logs } = await supabaseClient
                .from('log_ujian')
                .select('id_jadwal, status_ujian, is_blocked, pelanggaran, id_log')
                .eq('id_siswa', payload.id_siswa);

              const logMap = {};
              if (logs) {
                logs.forEach(l => { logMap[l.id_jadwal] = l; });
              }

              return {
                status: 'success',
                data: matchingJadwal.map(j => {
                  const l = logMap[j.id_jadwal];
                  const strikes = l ? (l.pelanggaran || 0) : 0;
                  const blocked = l ? (l.is_blocked || strikes >= 3) : false;
                  return {
                    ...j,
                    nama_guru: j.guru ? j.guru.nama_lengkap : 'Unknown',
                    nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown',
                    status_siswa: l ? l.status_ujian : null,
                    is_blocked: blocked,
                    pelanggaran: strikes,
                    id_log: l ? l.id_log : null
                  };
                })
              };
            }

          case 'get_status_log_ujian': {
            const { data: log, error: logErr } = await supabaseClient
              .from('log_ujian')
              .select('id_log, id_jadwal, id_siswa, pelanggaran, is_blocked, status_ujian, nilai_auto, tanda_tangan, status_kehadiran, is_verified_kehadiran')
              .eq('id_log', payload.id_log)
              .single();
            if (logErr || !log) return { status: 'error', message: logErr?.message || 'Log tidak ditemukan' };
            
            let hasSigned = Boolean(log.tanda_tangan);
            if (!hasSigned && log.id_jadwal && log.id_siswa) {
              const { data: absCheck } = await supabaseClient
                .from('absensi_ujian')
                .select('tanda_tangan')
                .eq('id_jadwal', log.id_jadwal)
                .eq('id_siswa', log.id_siswa)
                .maybeSingle();
              if (absCheck && absCheck.tanda_tangan) hasSigned = true;
            }

            let waktu_selesai = null;
            let durasi_menit = null;
            if (log.id_jadwal) {
              const { data: jadwalInfo } = await supabaseClient
                .from('jadwal')
                .select('waktu_selesai, durasi_menit, status_ujian')
                .eq('id_jadwal', log.id_jadwal)
                .maybeSingle();
              if (jadwalInfo) {
                waktu_selesai = jadwalInfo.waktu_selesai;
                durasi_menit = jadwalInfo.durasi_menit;
              }
            }

            return { 
              status: 'success', 
              data: {
                ...log,
                waktu_selesai,
                durasi_menit,
                has_signed: hasSigned
              } 
            };
          }

          case 'mulai_ujian': {
            ({ data, error } = await supabaseClient.from('jadwal').select('token_aktif, waktu_selesai').eq('id_jadwal', payload.id_jadwal).eq('npsn', payload.npsn).single());
            if (error || !data) return { status: 'error', message: 'Jadwal tidak ditemukan.' };
            if (new Date(data.waktu_selesai) < new Date()) return { status: 'error', message: 'Ujian sudah berakhir.' };
            if (data.token_aktif !== payload.token) return { status: 'error', message: 'Token tidak valid atau sudah expired.' };

            const { data: logsData } = await supabaseClient
              .from('log_ujian')
              .select('*')
              .eq('id_siswa', payload.id_siswa)
              .eq('id_jadwal', payload.id_jadwal)
              .order('waktu_login', { ascending: false });
            const logData = logsData && logsData.length > 0 ? logsData[0] : null;
            let idLog = logData ? logData.id_log : null;

            if (logsData && logsData.length > 0) {
              const blockedLog = logsData.find(l => l.is_blocked || (l.pelanggaran || 0) >= 3);
              if (blockedLog) {
                return { 
                  status: 'error', 
                  message: 'Akun Anda diblokir dari ujian ini (pelanggaran melebihi batas 3 kali).',
                  terblokir: true,
                  pelanggaran: blockedLog.pelanggaran || 3
                };
              }
              if (logData.status_ujian === 'SELESAI') return { status: 'error', message: 'Anda sudah menyelesaikan ujian ini.' };
            } else {
              idLog = 'LOG-' + Math.random().toString(36).substr(2, 9);
              await supabaseClient.from('log_ujian').insert([{
                id_log: idLog,
                id_jadwal: payload.id_jadwal,
                id_siswa: payload.id_siswa,
                status_ujian: 'SEDANG KERJA',
                pelanggaran: 0,
                status_kehadiran: 'BELUM_HADIR'
              }]);
            }

            // Check signature in logData or absensi_ujian
            let hasSigned = Boolean(logData && logData.tanda_tangan);
            if (!hasSigned) {
              const { data: absCheck } = await supabaseClient
                .from('absensi_ujian')
                .select('tanda_tangan, status_kehadiran, status_verifikasi')
                .eq('id_jadwal', payload.id_jadwal)
                .eq('id_siswa', payload.id_siswa)
                .maybeSingle();
              if (absCheck && absCheck.tanda_tangan) {
                hasSigned = true;
              }
            }

            const currentStatusKehadiran = logData?.status_kehadiran || (hasSigned ? 'HADIR' : 'BELUM_HADIR');

            return { 
              status: 'success', 
              id_log: idLog,
              pelanggaran: logData ? (logData.pelanggaran || 0) : 0,
              is_blocked: logData ? (logData.is_blocked || false) : false,
              has_signed: hasSigned,
              status_kehadiran: currentStatusKehadiran,
              dataLog: logData ? { 
                ...logData, 
                has_signed: hasSigned, 
                status_kehadiran: currentStatusKehadiran 
              } : { 
                id_log: idLog, 
                pelanggaran: 0, 
                is_blocked: false, 
                has_signed: hasSigned, 
                status_kehadiran: currentStatusKehadiran, 
                tanda_tangan: null 
              }
            };
          }

          case 'get_soal_ujian': {
            const isPrivileged = payload.role === 'guru' || payload.role === 'admin' || payload.preview === true;
            if (!isPrivileged && !payload.id_log) {
              return {
                status: 'error',
                message: 'Akses soal ditolak: Log ujian wajib disertakan untuk mengakses soal ujian.',
                need_signature: true
              };
            }

            const { data: jadwal } = await supabaseClient.from('jadwal').select('id_mapel, npsn').eq('id_jadwal', payload.id_jadwal).single();
            if (!jadwal) return { status: 'error', message: 'Jadwal tidak ditemukan' };
            const effectiveNpsn = payload.npsn || jadwal.npsn;
            ({ data, error } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', jadwal.id_mapel).eq('npsn', effectiveNpsn));
            if (error) return { status: 'error', message: error.message };
            
            // Format opsi
            const unpackedData = (data || []).map(s => {
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              return s;
            });

            // Filter out NARASI, SKEMA_PENILAIAN, and MAPEL_ALLOC from exam questions
            const soalAktif = unpackedData.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN' && s.tipe_soal !== 'SKEMA_DEFAULT' && s.tipe_soal !== 'MAPEL_ALLOC');
            const narasiMap = {};
            unpackedData.filter(s => s.tipe_soal === 'NARASI').forEach(n => { narasiMap[n.id_soal] = n; });

            // NOTE: Shuffling is done client-side (ExamRoom.jsx) with a seeded random function
            // so that each student gets a consistent (but unique-per-student) question order.
            // Do NOT shuffle here with Math.random() as it would create inconsistent order on reconnects.
            let logStatus = null;
            if (payload.id_log) {
              const { data: log } = await supabaseClient
                .from('log_ujian')
                .select('pelanggaran, is_blocked, status_ujian, nilai_auto, tanda_tangan, id_jadwal, id_siswa')
                .eq('id_log', payload.id_log)
                .maybeSingle();

              if (!log) {
                return {
                  status: 'error',
                  message: 'Log ujian tidak ditemukan atau sesi tidak valid.'
                };
              }

              logStatus = log;

              if (!isPrivileged) {
                // Exam Entry Gating: Check attendance/signature in log_ujian or absensi_ujian
                let signed = Boolean(log.tanda_tangan);
                if (!signed && log.id_jadwal && log.id_siswa) {
                  const { data: absCheck } = await supabaseClient
                    .from('absensi_ujian')
                    .select('tanda_tangan')
                    .eq('id_jadwal', log.id_jadwal)
                    .eq('id_siswa', log.id_siswa)
                    .maybeSingle();
                  if (absCheck && absCheck.tanda_tangan) signed = true;
                }

                if (!signed) {
                  return {
                    status: 'error',
                    message: 'Akses soal ditolak: Tanda tangan kehadiran belum disimpan.',
                    need_signature: true
                  };
                }
              }
            }

            return { status: 'success', data: soalAktif, narasiMap, logStatus };
          }

          case 'catat_pelanggaran': {
              const { data: currLog, error: fetchErr } = await supabaseClient
                .from('log_ujian')
                .select('pelanggaran, pelanggaran_detail')
                .eq('id_log', payload.id_log)
                .single();

              if (fetchErr || !currLog) return { status: 'error', message: fetchErr?.message || 'Log tidak ditemukan' };

              const newPelanggaran = (currLog.pelanggaran || 0) + 1;
              const isBlocked = newPelanggaran >= 3;
              const details = Array.isArray(currLog.pelanggaran_detail) ? currLog.pelanggaran_detail : [];
              const waktu = new Date().toISOString();
              details.push({ 
                waktu, 
                alasan: payload.alasan || 'Terdeteksi keluar dari layar penuh atau pindah aplikasi/tab.' 
              });

              const updatePayload = {
                pelanggaran: newPelanggaran,
                is_blocked: isBlocked,
                pelanggaran_detail: details
              };

              if (isBlocked) {
                updatePayload.status_ujian = 'SELESAI';
                updatePayload.nilai_auto = 0;
                updatePayload.waktu_selesai = waktu;
              }

              const { error: updateErr } = await supabaseClient
                .from('log_ujian')
                .update(updatePayload)
                .eq('id_log', payload.id_log);

              if (updateErr) return { status: 'error', message: updateErr.message };

              return { 
                status: 'success', 
                pelanggaran_saat_ini: newPelanggaran, 
                terblokir: isBlocked 
              };
            }
          case 'submit_ujian': {
            const logId = payload.id_log;
            
            // Cek status blokir
            const { data: currLog } = await supabaseClient.from('log_ujian').select('is_blocked').eq('id_log', logId).single();
            const isBlocked = currLog?.is_blocked || false;

            // Konversi array jawaban [{id_soal, jawaban}] menjadi object/map {id_soal: jawaban}
            const jawaban = {};
            if (Array.isArray(payload.jawaban)) {
              payload.jawaban.forEach(j => {
                if (j && j.id_soal) jawaban[j.id_soal] = j.jawaban;
              });
            }

            const idSiswa = payload.id_siswa;

            const { data: jadwal } = await supabaseClient.from('jadwal').select('id_mapel, npsn').eq('id_jadwal', payload.id_jadwal).single();
            const effectiveNpsn = payload.npsn || jadwal?.npsn;
            const { data: rawSoalData } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', jadwal?.id_mapel).eq('npsn', effectiveNpsn);
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
              for (const soal of soalData.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN' && s.tipe_soal !== 'SKEMA_DEFAULT' && s.tipe_soal !== 'MAPEL_ALLOC')) {
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
                  skor_diperoleh: skorDiperoleh
                });
                
                totalSkorDiperolehAuto += skorDiperoleh;
              }
            }

            await supabaseClient.from('jawaban_siswa').delete().eq('id_log', logId);
            if (insertJawaban.length > 0) {
              await supabaseClient.from('jawaban_siswa').insert(insertJawaban);
            }

              let nilaiAuto = 0;
              if (isBlocked) {
                nilaiAuto = 0;
              } else if (totalSkorMaxAuto > 0) {
                nilaiAuto = (totalSkorDiperolehAuto / totalSkorMaxAuto) * 100;
                nilaiAuto = Math.round(nilaiAuto * 100) / 100;
              }
  
              await supabaseClient.from('log_ujian').update({
                status_ujian: 'SELESAI',
                nilai_auto: nilaiAuto
              }).eq('id_log', logId);
  
              return { 
                status: 'success', 
                message: isBlocked ? 'Ujian telah berakhir. Karena Anda melanggar lebih dari 3 kali (Terblokir), nilai Anda otomatis menjadi 0.' : 'Ujian berhasil diselesaikan.', 
                nilai_auto: nilaiAuto 
              };
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
            await autoPurgeWeeklyLogs(false);
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
              .order('waktu_selesai', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            
            return { 
              status: 'success', 
              data: data.map(log => ({
                id_log: log.id_log,
                waktu_mulai: log.jadwal?.waktu_mulai,
                waktu_selesai: log.jadwal?.waktu_selesai,
                nilai_auto: log.nilai_auto || 0,
                nilai_uraian: log.nilai_uraian || 0,
                total_nilai: (Number(log.nilai_auto) || 0) + (Number(log.nilai_uraian) || 0),
                nama_mapel: log.jadwal?.mata_pelajaran?.nama_mapel || 'Unknown',
                is_blocked: log.is_blocked || false,
                pelanggaran_detail: log.pelanggaran_detail || []
              })) 
            };
          }
          
          case 'get_leaderboard': {
             const { data: logs, error: err } = await supabaseClient
                 .from('log_ujian')
                 .select('id_siswa, nilai_auto, nilai_uraian, siswa!inner(nama_lengkap, kelas_paralel, angkatan)')
                 .eq('status_ujian', 'SELESAI')
                 .eq('siswa.npsn', payload.npsn);
             if (err) return { status: 'error', message: err.message };
             
             const map = {};
             logs.forEach(l => {
                 if (!map[l.id_siswa]) map[l.id_siswa] = { id: l.id_siswa, nama: l.siswa?.nama_lengkap, kelas: `${l.siswa?.angkatan || ''} ${l.siswa?.kelas_paralel || ''}`.trim(), total_nilai: 0, count: 0 };
                 map[l.id_siswa].total_nilai += (Number(l.nilai_auto) || 0) + (Number(l.nilai_uraian) || 0);
                 map[l.id_siswa].count++;
             });
             let arr = Object.values(map).map(item => ({ ...item, rata_rata: parseFloat((item.total_nilai / item.count).toFixed(1)) }));
             arr.sort((a, b) => b.rata_rata - a.rata_rata);
             return { status: 'success', data: arr.slice(0, 10) }; // Top 10
          }

          
          case 'update_sekolah_status': {
            ({ error } = await supabaseClient.from('sekolah').update({ status: payload.status }).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Status sekolah berhasil diperbarui.' };
          }
          case 'reset_login_siswa': {
            ({ error } = await supabaseClient.from('siswa').update({ session_token: null }).eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sesi login siswa berhasil direset.' };
          }
          case 'reset_all_login_siswa': {
            ({ error } = await supabaseClient.from('siswa').update({ session_token: null }).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Semua sesi login siswa berhasil direset.' };
          }
          case 'force_stop_ujian': {
            ({ error } = await supabaseClient.from('log_ujian').update({ status_ujian: 'SELESAI', waktu_selesai: new Date().toISOString() }).eq('id_log', payload.id_log));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Ujian berhasil dihentikan paksa.' };
          }
          case 'import_soal_bulk': {
            const sanitized = (payload.data || []).map((item, idx) => {
              const { kd, ...rest } = item;
              return {
                ...rest,
                id_soal: item.id_soal || `SOAL-${generateId('IMP')}-${idx}`,
                bobot: item.bobot !== undefined ? Number(item.bobot) : 10
              };
            });
            ({ error } = await supabaseClient.from('soal_ujian').insert(sanitized));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: `${sanitized.length} butir soal berhasil diimpor.` };
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

          case 'get_default_skema_sekolah': {
            const data = await get_default_skema_sekolah(payload.npsn);
            return { status: 'success', data };
          }
          case 'save_default_skema_sekolah': {
            const res = await save_default_skema_sekolah(payload.npsn, payload.payload || payload.format || payload.skema_data || payload);
            return { status: 'success', data: res.data, message: 'Skema penilaian default sekolah berhasil disimpan.' };
          }
          case 'get_skema_penilaian': {
            let q = supabaseClient.from('soal_ujian').select('*').eq('tipe_soal', 'SKEMA_PENILAIAN');
            if (payload.npsn) q = q.eq('npsn', payload.npsn);
            if (payload.id_mapel) {
              q = q.eq('id_mapel', payload.id_mapel);
              const { data: rec, error } = await q.maybeSingle();
              if (error) return { status: 'error', message: error.message };
              return { status: 'success', data: rec };
            } else if (payload.id_mapels && Array.isArray(payload.id_mapels)) {
              q = q.in('id_mapel', payload.id_mapels);
              const { data: recs, error } = await q;
              if (error) return { status: 'error', message: error.message };
              return { status: 'success', data: recs || [] };
            }
            ({ data, error } = await q);
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', data: data || [] };
          }
          case 'save_skema_penilaian': {
            const targetMapelIds = (payload.id_mapels && Array.isArray(payload.id_mapels) && payload.id_mapels.length > 0)
              ? payload.id_mapels
              : (payload.id_mapel ? [payload.id_mapel] : []);

            if (targetMapelIds.length === 0) {
              return { status: 'error', message: 'Mata pelajaran tidak valid.' };
            }

            const effectiveNpsn = payload.npsn;
            const kunciJawaban = typeof payload.kunci_jawaban === 'string'
              ? payload.kunci_jawaban
              : JSON.stringify({
                  mode: payload.mode || 'default',
                  skema: payload.skema || {}
                });

            let mode = payload.mode;
            if (!mode) {
              try {
                const parsed = JSON.parse(kunciJawaban);
                mode = parsed.mode;
              } catch (e) {
                mode = 'default';
              }
            }
            const bobot = payload.bobot !== undefined ? payload.bobot : (mode === 'custom' ? 1 : 0);

            let existingQuery = supabaseClient
              .from('soal_ujian')
              .select('id_soal, id_mapel')
              .eq('tipe_soal', 'SKEMA_PENILAIAN')
              .in('id_mapel', targetMapelIds);

            if (effectiveNpsn) {
              existingQuery = existingQuery.eq('npsn', effectiveNpsn);
            }
            const { data: existingRecords } = await existingQuery;

            const existingMap = {};
            (existingRecords || []).forEach(r => {
              existingMap[r.id_mapel] = r.id_soal;
            });

            const toUpdate = [];
            const toInsert = [];

            for (const mapelId of targetMapelIds) {
              if (existingMap[mapelId]) {
                toUpdate.push({
                  id_soal: existingMap[mapelId],
                  id_mapel: mapelId,
                  npsn: effectiveNpsn,
                  kunci_jawaban: kunciJawaban,
                  bobot
                });
              } else {
                toInsert.push({
                  id_soal: 'SKEMA-' + mapelId,
                  id_mapel: mapelId,
                  npsn: effectiveNpsn,
                  tipe_soal: 'SKEMA_PENILAIAN',
                  pertanyaan: 'Skema Penilaian',
                  kunci_jawaban: kunciJawaban,
                  bobot
                });
              }
            }

            for (const item of toUpdate) {
              let upQuery = supabaseClient.from('soal_ujian').update({
                kunci_jawaban: item.kunci_jawaban,
                bobot: item.bobot
              }).eq('id_soal', item.id_soal);
              if (effectiveNpsn) upQuery = upQuery.eq('npsn', effectiveNpsn);
              await upQuery;
            }

            if (toInsert.length > 0) {
              const { error: insErr } = await supabaseClient.from('soal_ujian').insert(toInsert);
              if (insErr) return { status: 'error', message: insErr.message };
            }

            return {
              status: 'success',
              message: `Skema penilaian berhasil disimpan untuk ${targetMapelIds.length} mata pelajaran.`,
              data: {
                totalUpdated: toUpdate.length,
                totalInserted: toInsert.length,
                id_mapels: targetMapelIds
              }
            };
          }
          case 'get_pengaturan_sekolah': {
            const data = await get_pengaturan_sekolah(payload.npsn);
            return { status: 'success', data };
          }
          case 'save_pengaturan_sekolah': {
            const res = await save_pengaturan_sekolah(payload.npsn, payload.payload || payload.settings || payload);
            return { status: 'success', data: res.data, message: 'Pengaturan sekolah dan kop berhasil disimpan.' };
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
    if (typeof window !== 'undefined') {
      window.fetchAPI = fetchAPI;
      window.supabaseClient = supabaseClient;
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
    }