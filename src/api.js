import { supabaseClient } from './config.js';
import React from 'react';
import {
  decodeNexaBundle,
  verifyNexaBundleChecksum,
  computeWeightedExamScores,
  cloneExamSchedule,
  normalizeTipeSoal
} from './utils/nexaBundle.js';

export { supabaseClient };

    // Fungsi fetchAPI sebagai Router Supabase
    export const generateId = (prefix) => `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    let timeOffset = 0;
    let syncPromise = null;
    export const setServerTimeOffset = (offset) => {
      if (typeof offset === 'number' && !Number.isNaN(offset)) {
        timeOffset = offset;
      }
    };
    export const getTrueNow = async () => {
      if (!syncPromise) {
        syncPromise = (async () => {
          try {
            if (typeof window !== 'undefined' && window.location && window.location.href) {
              let signal = undefined;
              let timeoutId = undefined;
              if (typeof AbortController !== 'undefined') {
                const controller = new AbortController();
                signal = controller.signal;
                timeoutId = setTimeout(() => controller.abort(), 2000);
              }
              const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store', signal });
              if (timeoutId) clearTimeout(timeoutId);
              const dateHeader = res?.headers?.get('date');
              if (dateHeader) {
                const serverMs = new Date(dateHeader).getTime();
                if (!Number.isNaN(serverMs)) {
                  timeOffset = serverMs - Date.now();
                  return;
                }
              }
            }
          } catch (_) {
            // Fallback safe to local system time (zero network freeze)
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
    const OPTIONAL_SOAL_COLUMNS = ['sub_mapel', 'id_guru_pembuat', 'nama_guru_pembuat'];

    async function executeSoalMutationWithSchemaFallback(runQuery, payload) {
      let current = Array.isArray(payload) ? payload.map(r => ({ ...r })) : { ...payload };
      for (let i = 0; i < OPTIONAL_SOAL_COLUMNS.length; i++) {
        const { error } = await runQuery(current);
        if (!error) return { error: null };
        const match = error.message?.match(/Could not find the '([^']+)' column of 'soal_ujian' in the schema cache/i);
        const missingCol = match?.[1];
        if (!missingCol || !OPTIONAL_SOAL_COLUMNS.includes(missingCol)) {
          return { error };
        }
        console.warn(`[NEXA] Kolom '${missingCol}' belum ada di schema cache soal_ujian, melanjutkan tanpa kolom tersebut.`);
        if (Array.isArray(current)) {
          current = current.map((row) => {
            const copy = { ...row };
            delete copy[missingCol];
            return copy;
          });
        } else {
          delete current[missingCol];
        }
      }
      return await runQuery(current);
    }

    export const normalizeSkemaConfig = (raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const targetSkema = raw.skema && typeof raw.skema === 'object' ? raw.skema : raw;
      let mode = raw.mode;
      if (!mode) {
        const hasPositive = Object.values(targetSkema).some(v => parseFloat(v) > 0);
        mode = hasPositive ? 'custom' : 'default';
      }
      return { mode, skema: targetSkema };
    };

    export const resolveMapelSkemaFromSoal = (soalList, defaultSkema = null) => {
      const skemaRows = (soalList || []).filter(s => s && s.tipe_soal === 'SKEMA_PENILAIAN');

      let guruParsed = null;
      let adminMapelParsed = null;

      for (const row of skemaRows) {
        if (!row?.kunci_jawaban) continue;
        let p = null;
        try {
          p = typeof row.kunci_jawaban === 'string' ? JSON.parse(row.kunci_jawaban) : row.kunci_jawaban;
        } catch {
          continue;
        }
        if (!p || typeof p !== 'object') continue;

        // Partitioned row support: { guru: ..., admin: ... }
        if (p.guru && typeof p.guru === 'object') {
          guruParsed = p.guru;
        }
        if (p.admin && typeof p.admin === 'object') {
          adminMapelParsed = p.admin;
        }

        const isExplicitAdmin = (row.id_soal && String(row.id_soal).startsWith('SKEMA_ADMIN_')) || p.role === 'admin';
        const isExplicitGuru = (row.id_soal && String(row.id_soal).startsWith('SKEMA-')) || p.role === 'guru';

        if (isExplicitAdmin) {
          if (!adminMapelParsed) adminMapelParsed = p;
        } else if (isExplicitGuru) {
          if (!guruParsed) guruParsed = p;
        } else {
          // Legacy flat or unpartitioned row defaults to teacher
          if (!guruParsed) guruParsed = p;
        }
      }

      // Tier 1: Guru custom weights for the subject
      if (guruParsed) {
        const config = normalizeSkemaConfig(guruParsed);
        if (config?.mode === 'custom' && config?.skema && typeof config.skema === 'object') {
          const keys = ['PG', 'PGK', 'BS', 'JODOH', 'ISIAN', 'URAIAN'];
          const hasPositive = keys.some(k => Number(config.skema[k]) > 0);
          if (hasPositive) return config;
        }
      }

      // Tier 2: Admin per-mapel custom weights for the subject
      if (adminMapelParsed) {
        const config = normalizeSkemaConfig(adminMapelParsed);
        if (config?.mode === 'custom' && config?.skema && typeof config.skema === 'object') {
          const keys = ['PG', 'PGK', 'BS', 'JODOH', 'ISIAN', 'URAIAN'];
          const hasPositive = keys.some(k => Number(config.skema[k]) > 0);
          if (hasPositive) return config;
        }
      }

      // Tier 3: Admin global default
      const fallbackSchoolDefault = {
        mode: 'default',
        skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 }
      };

      if (defaultSkema) {
        const norm = normalizeSkemaConfig(defaultSkema);
        if (norm?.skema && typeof norm.skema === 'object') {
          return norm;
        }
      }

      return fallbackSchoolDefault;
    };

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
            const tokenIntervalMs = (j.durasi_token_menit ? Number(j.durasi_token_menit) : 5) * 60 * 1000;
            if (!tokenAktif || (now.getTime() - lastUpdate >= tokenIntervalMs)) { 
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
        } else if (currentStatus === 'SELESAI') {
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
          token_aktif: tokenAktif,
          last_update_token: (currentStatus === 'AKTIF' && tokenAktif !== j.token_aktif) ? now.toISOString() : (currentStatus === 'SELESAI' ? null : j.last_update_token),
          durasi_token_menit: j.durasi_token_menit !== undefined && j.durasi_token_menit !== null ? Number(j.durasi_token_menit) : 5,
          status_ujian: currentStatus,
          token: tokenAktif,
          guru: j.guru ? (j.guru.nama_guru || j.guru.nama_lengkap || 'Unknown') : 'Unknown',
          nama_mapel: j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : (j.nama_mapel || 'Unknown')
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

      // Query Supabase soal_ujian table for reserved default record first
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

      // Fallback to localStorage cache if DB unavailable or empty
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

        let dbError = null;
        if (existing) {
          const { error } = await supabaseClient
            .from('soal_ujian')
            .update(record)
            .eq('id_soal', recordId)
            .eq('npsn', npsn);
          if (error) dbError = error;
        } else {
          const { error } = await supabaseClient
            .from('soal_ujian')
            .insert([record]);
          if (error) dbError = error;
        }
        if (dbError) {
          console.warn('Database error in save_default_skema_sekolah:', dbError);
          return { success: false, message: dbError.message, data: payload };
        }
      } catch (err) {
        console.warn('save_default_skema_sekolah network/DB warning:', err);
        return { success: false, message: err.message || 'Gagal menyimpan ke database', data: payload };
      }

      // Sync cache to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nexa_default_skema_' + npsn, JSON.stringify(payload));
      }

      return { success: true, data: payload };
    };

    export const get_admin_skema_mapel = async (id_mapel, npsn) => {
      const fallbackDefault = {
        mode: 'default',
        skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 }
      };

      if (!id_mapel) {
        return npsn ? await get_default_skema_sekolah(npsn) : fallbackDefault;
      }

      // 1. Check database for SKEMA_ADMIN_${id_mapel}
      try {
        let query = supabaseClient
          .from('soal_ujian')
          .select('kunci_jawaban')
          .eq('id_soal', 'SKEMA_ADMIN_' + id_mapel);
        if (npsn) query = query.eq('npsn', npsn);
        const { data, error } = await query.maybeSingle();

        if (!error && data?.kunci_jawaban) {
          try {
            const parsed = typeof data.kunci_jawaban === 'string' ? JSON.parse(data.kunci_jawaban) : data.kunci_jawaban;
            if (parsed && typeof parsed === 'object') {
              if (typeof localStorage !== 'undefined' && npsn) {
                localStorage.setItem(`nexa_admin_skema_${npsn}_${id_mapel}`, JSON.stringify(parsed));
              }
              return parsed;
            }
          } catch (e) {
            console.warn('Error parsing admin mapel skema from DB:', e);
          }
        }
      } catch (err) {
        console.warn('get_admin_skema_mapel DB error:', err);
      }

      // 2. Check localStorage cache
      if (typeof localStorage !== 'undefined' && npsn) {
        try {
          const cached = localStorage.getItem(`nexa_admin_skema_${npsn}_${id_mapel}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') return parsed;
          }
        } catch (e) {
          console.warn('Error reading admin mapel skema from cache:', e);
        }
      }

      // 3. Fallback to school global default
      if (npsn) {
        return await get_default_skema_sekolah(npsn);
      }
      return fallbackDefault;
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

    export const normalizeGrade = (tok) => {
      if (!tok) return '';
      const up = String(tok).trim().toUpperCase();
      return GRADE_MAP[up] || up;
    };

    export const cleanTokens = (str, normalizeFirstAsGrade = true) => {
      if (!str) return [];
      let s = String(str).trim().toUpperCase();
      s = s.replace(/\|/g, ' ');
      s = s.replace(/^TINGKAT\s+/i, '');
      s = s.replace(/^KELAS\s+/i, '');
      s = s.replace(/^ROMBEL\s+/i, '');
      s = s.replace(/^PARALEL\s+/i, '');
      s = s.replace(/\s*\(SEMUA(\s*(KELAS|ROMBEL|SISWA|TINGKAT))?\)$/i, '');
      s = s.replace(/^SEMUA\s+(KELAS|TINGKAT|ROMBEL)?\s+/i, '');
      s = s.replace(/\bMERDEKA\b/g, ' ');
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
     * Resolves required religion for a subject.
     * Supports all 6 recognized religions (Islam, Kristen, Katolik, Hindu, Buddha, Konghucu).
     * Returns TitleCased religion name or null for general/universal subjects.
     */
    export const getMapelReligion = (mapelOrName) => {
      if (!mapelOrName) return null;
      const explicit = typeof mapelOrName === 'object' ? (mapelOrName.agama || mapelOrName.mata_pelajaran?.agama) : null;
      if (explicit) {
        const normExp = String(explicit).trim().toLowerCase();
        if (normExp === 'semua/umum' || normExp === 'semua' || normExp === 'umum' || normExp === '') return null;
        if (normExp === 'islam') return 'Islam';
        if (normExp === 'kristen' || normExp === 'protestan') return 'Kristen';
        if (normExp === 'katolik') return 'Katolik';
        if (normExp === 'hindu') return 'Hindu';
        if (normExp === 'buddha' || normExp === 'budha') return 'Buddha';
        if (normExp === 'konghucu' || normExp === 'khonghucu') return 'Konghucu';
      }
      const name = typeof mapelOrName === 'object'
        ? (mapelOrName.nama_mapel || mapelOrName.mata_pelajaran?.nama_mapel || '')
        : String(mapelOrName);
      const norm = String(name || '').trim().toLowerCase();
      if (!norm) return null;

      if (/\b(pai)\b/i.test(norm) || /agama\s+islam/i.test(norm)) return 'Islam';
      if (/\b(pak)\b/i.test(norm) || /agama\s+kristen/i.test(norm)) return 'Kristen';
      if (/agama\s+katolik/i.test(norm) || /\b(katolik)\b/i.test(norm)) return 'Katolik';
      if (/agama\s+hindu/i.test(norm) || /\b(hindu)\b/i.test(norm)) return 'Hindu';
      if (/agama\s+budd?ha/i.test(norm) || /\b(budd?ha)\b/i.test(norm)) return 'Buddha';
      if (/agama\s+k[ho]+nghucu/i.test(norm) || /\bk[ho]+nghucu\b/i.test(norm)) return 'Konghucu';

      return null;
    };

    /**
     * Checks if a student's religion satisfies the religion requirement of a subject.
     * General subjects (where getMapelReligion returns null) are universal and return true.
     */
    export const isReligionMatching = (studentReligion, mapelOrName) => {
      const requiredReligion = getMapelReligion(mapelOrName);
      if (!requiredReligion) return true; // General subjects are universal
      const sRel = String(studentReligion || '').trim().toLowerCase();
      const reqRel = requiredReligion.toLowerCase();
      if (sRel === reqRel) return true;
      if ((sRel === 'budha' && reqRel === 'buddha') || (sRel === 'buddha' && reqRel === 'budha')) return true;
      if ((sRel === 'khonghucu' && reqRel === 'konghucu') || (sRel === 'konghucu' && reqRel === 'khonghucu')) return true;
      if ((sRel === 'protestan' && reqRel === 'kristen') || (sRel === 'kristen' && reqRel === 'protestan')) return true;
      return false;
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

        // 2. Purge arsip audit usang (> 30 hari)
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
          'get_status_log_ujian',
          'get_soal_ujian', 'submit_ujian', 'catat_pelanggaran', 'import_jawaban_offline'
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

            let schoolGasWebhook = '';
            if (payload.npsn) {
              try {
                const { data: sch } = await supabaseClient
                  .from('sekolah')
                  .select('status, gas_drive_webhook')
                  .eq('npsn', payload.npsn)
                  .maybeSingle();
                if (sch && String(sch.status || '').toUpperCase() === 'SUSPENDED') {
                  return { status: 'error', message: 'Akses sekolah sedang ditangguhkan (SUSPENDED). Hubungi Super Admin.' };
                }
                schoolGasWebhook = sch?.gas_drive_webhook || '';
              } catch (_) {
                const { data: sch } = await supabaseClient
                  .from('sekolah')
                  .select('status')
                  .eq('npsn', payload.npsn)
                  .maybeSingle();
                if (sch && String(sch.status || '').toUpperCase() === 'SUSPENDED') {
                  return { status: 'error', message: 'Akses sekolah sedang ditangguhkan (SUSPENDED). Hubungi Super Admin.' };
                }
              }
            }

            if (payload.role === 'guru') {
              const loginId = (payload.username || payload.nip || '').trim();
              if (!loginId) return { status: 'error', message: 'Username / NIP wajib diisi.' };
              ({ data, error } = await supabaseClient
                .from('guru')
                .select('*')
                .eq('username', loginId)
                .eq('password', payload.password)
                .eq('npsn', payload.npsn)
                .maybeSingle());
              if (!data && !error) {
                ({ data, error } = await supabaseClient
                  .from('guru')
                  .select('*')
                  .eq('nip', loginId)
                  .eq('password', payload.password)
                  .eq('npsn', payload.npsn)
                  .limit(1)
                  .maybeSingle());
              }
              if (error || !data) return { status: 'error', message: 'Username / NIP, password, atau NPSN salah.' };
              data.role = 'guru';
              data.nama_lengkap = data.nama_guru || data.nama_lengkap || '';
              data.gas_drive_webhook = schoolGasWebhook;
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
               const nowTrue = await getTrueNow();
               const nowMs = nowTrue.getTime();
               if (data.session_token) {
                  const parts = data.session_token.split('|');
                  let isActive = true;
                  if (parts.length === 2) {
                     const lastActive = parseInt(parts[1], 10);
                     // Allow login if lastActive is older than 3 minutes (180000 ms)
                     if (nowMs - lastActive > 3 * 60 * 1000) {
                         isActive = false; 
                     }
                  }

                  if (isActive) {
                      return { status: 'error', message: 'Akun Anda sedang digunakan. Tunggu 3 menit setelah keluar, atau minta admin mereset sesi Anda.' };
                  }
               }
               // Generate and set new session_token with timestamp
               const newSessionToken = crypto.randomUUID() + '|' + nowMs;
               const { error: updateErr } = await supabaseClient
                  .from('siswa')
                  .update({ session_token: newSessionToken })
                  .eq('id_siswa', data.id_siswa);
               if (updateErr) return { status: 'error', message: 'Gagal membuat sesi aman.' };
               
               data.session_token = newSessionToken;
            }

            data.role = payload.role;
            if (payload.role === 'admin') {
              data.gas_drive_webhook = schoolGasWebhook;
            }
            return { status: 'success', data };
          }
          case 'heartbeat_siswa': {
             const { data: dbData, error: hbErr } = await supabaseClient
               .from('siswa')
               .select('session_token')
               .eq('id_siswa', payload.id_siswa)
               .single();
             if (hbErr) {
               return { status: 'error', session_conflict: false, message: hbErr.message || 'Gagal memeriksa sesi.' };
             }
             if (dbData && dbData.session_token && payload.session_token) {
                 const currentUuid = dbData.session_token.split('|')[0];
                 const payloadUuid = payload.session_token.split('|')[0];
                 if (currentUuid === payloadUuid) {
                     return { status: 'success' };
                 }
             }
             return { status: 'error', session_conflict: true, message: 'Sesi tidak valid atau akun dibuka di perangkat lain.' };
          }
          case 'register': {
            if (payload.role === 'guru') {
              ({ data, error } = await supabaseClient
                .from('guru')
                .insert([{
                  id_guru: generateId('G'),
                  nama_guru: payload.nama,
                  username: payload.username,
                  nip: payload.identitas || '-',
                  password: payload.password,
                  npsn: payload.npsn
                }]));
            } else {
              ({ data, error } = await supabaseClient
                .from('siswa')
                .insert([{
                  id_siswa: generateId('S'),
                  nama_lengkap: payload.nama,
                  username: payload.username,
                  nisn: payload.identitas || '',
                  password: payload.password,
                  npsn: payload.npsn
                }]));
            }
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
            const updateFields = { nama_sekolah: payload.nama_sekolah };
            if (payload.gas_drive_webhook !== undefined) updateFields.gas_drive_webhook = payload.gas_drive_webhook;
            ({ error } = await supabaseClient.from('sekolah').update(updateFields).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sekolah berhasil diperbarui.' };
          }
          case 'get_gas_drive_webhook': {
            const targetNpsn = payload.npsn;
            if (!targetNpsn) return { status: 'success', gas_drive_webhook: '' };
            try {
              const { data: sch, error: schErr } = await supabaseClient
                .from('sekolah')
                .select('gas_drive_webhook')
                .eq('npsn', targetNpsn)
                .maybeSingle();
              if (schErr) return { status: 'success', gas_drive_webhook: '' };
              return { status: 'success', gas_drive_webhook: sch?.gas_drive_webhook || '' };
            } catch (_) {
              return { status: 'success', gas_drive_webhook: '' };
            }
          }
          case 'update_gas_drive_webhook': {
            const { npsn, gas_drive_webhook } = payload;
            if (!npsn) return { status: 'error', message: 'NPSN sekolah diperlukan.' };
            try {
              const { error: updErr } = await supabaseClient
                .from('sekolah')
                .update({ gas_drive_webhook: (gas_drive_webhook || '').trim() })
                .eq('npsn', npsn);
              if (updErr) return { status: 'error', message: updErr.message };
              return { status: 'success', message: 'URL Webhook Google Drive berhasil disimpan.' };
            } catch (err) {
              return { status: 'error', message: err.message };
            }
          }
          case 'update_sekolah_status': {
            ({ error } = await supabaseClient.from('sekolah').update({ status: payload.status }).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Status sekolah berhasil diperbarui.' };
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
            const [sekolahRes, siswaRes, guruRes, soalRes, activeRes] = await Promise.all([
              supabaseClient.from('sekolah').select('npsn, nama_sekolah'),
              supabaseClient.from('siswa').select('npsn'),
              supabaseClient.from('guru').select('npsn'),
              supabaseClient.from('soal_ujian').select('npsn, tipe_soal').not('tipe_soal', 'in', '("NARASI","SKEMA_PENILAIAN","SKEMA_DEFAULT","MAPEL_ALLOC")'),
              supabaseClient.from('log_ujian').select('id_log', { count: 'exact', head: true }).eq('status_ujian', 'SEDANG KERJA')
            ]);
            if (sekolahRes.error) return { status: 'error', message: sekolahRes.error.message };

            const countByNpsn = (rows) => {
              const map = {};
              (rows || []).forEach(r => { if (r.npsn) map[r.npsn] = (map[r.npsn] || 0) + 1; });
              return map;
            };
            const siswaCounts = countByNpsn(siswaRes.data);
            const guruCounts = countByNpsn(guruRes.data);
            const soalCounts = countByNpsn(soalRes.data);

            const stats = (sekolahRes.data || []).map(s => ({
              npsn: s.npsn,
              nama_sekolah: s.nama_sekolah,
              total_siswa: siswaCounts[s.npsn] || 0,
              total_guru: guruCounts[s.npsn] || 0,
              total_soal: soalCounts[s.npsn] || 0
            }));
            return { status: 'success', data: { stats, concurrentUsers: activeRes.count || 0 } };
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
          case 'reset_all_data': {
            const tables = [
              { name: 'jawaban_siswa', col: 'id_jawaban' },
              { name: 'absensi_ujian', col: 'id_absensi' },
              { name: 'berita_acara_ujian', col: 'id_berita_acara' },
              { name: 'pengawas_ruang', col: 'id_penugasan' },
              { name: 'ruang_ujian', col: 'id_ruang' },
              { name: 'log_ujian', col: 'id_log' },
              { name: 'jadwal', col: 'id_jadwal' },
              { name: 'soal_ujian', col: 'id_soal' },
              { name: 'guru_mapel', col: 'id_guru' },
              { name: 'mata_pelajaran', col: 'id_mapel' },
              { name: 'kelas', col: 'id_kelas' },
              { name: 'siswa', col: 'id_siswa' },
              { name: 'guru', col: 'id_guru' },
              { name: 'admin', col: 'id_admin' },
              { name: 'pengumuman', col: 'id_pengumuman' },
              { name: 'pengumuman_global', col: 'id_pengumuman' },
              { name: 'audit_log', col: 'id_audit' },
              { name: 'sekolah', col: 'npsn' }
            ];
            for (const t of tables) {
              const { error: delErr } = await supabaseClient.from(t.name).delete().neq(t.col, '__NEVER__');
              if (delErr) return { status: 'error', message: `Gagal reset tabel ${t.name}: ${delErr.message}` };
            }
            return { status: 'success', message: 'Semua data sistem berhasil dihapus secara permanen.' };
          }

          // ================= ADMIN DASHBOARD =================
          case 'get_admin_dashboard_data': {
            const [siswaRes, guruRes, jadwalRes, aktifRes, mapelRes, soalRes] = await Promise.all([
              supabaseClient.from('siswa').select('id_siswa', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('guru').select('id_guru', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('jadwal').select('id_jadwal', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('log_ujian').select('id_log, jadwal!inner(npsn)', { count: 'exact' }).eq('status_ujian', 'SEDANG KERJA').eq('jadwal.npsn', payload.npsn),
              supabaseClient.from('mata_pelajaran').select('id_mapel', { count: 'exact' }).eq('npsn', payload.npsn),
              supabaseClient.from('soal_ujian').select('id_soal', { count: 'exact' }).eq('npsn', payload.npsn).neq('tipe_soal', 'SKEMA_DEFAULT').neq('tipe_soal', 'SKEMA_PENILAIAN').neq('tipe_soal', 'MAPEL_ALLOC')
            ]);

            const { data: allJadwalData } = await supabaseClient
              .from('jadwal')
              .select('*, guru(nama_guru), mata_pelajaran(nama_mapel)')
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
            if (payload.nisn) {
              const { data: existingSiswa } = await supabaseClient.from('siswa').select('id_siswa').eq('nisn', payload.nisn).eq('npsn', payload.npsn).maybeSingle();
              if (existingSiswa) return { status: 'error', message: 'Siswa dengan NISN ini sudah terdaftar.' };
            }

            if (!payload.id_siswa) payload.id_siswa = generateId('S');
            ({ error } = await supabaseClient.from('siswa').insert([payload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil ditambahkan' };
          }
          case 'create_siswa_bulk': {
            const bulkData = (Array.isArray(payload) ? payload : []).map(item => {
              const kelasCombined = item.kelas || `${item.angkatan || ''} ${item.kelas_paralel || ''}`.trim();
              return {
                id_siswa: item.id_siswa || generateId('S'),
                npsn: item.npsn,
                nama_lengkap: item.nama_lengkap,
                username: item.username,
                password: item.password || 'Nexa123!',
                nisn: item.nisn ? String(item.nisn) : '',
                angkatan: item.angkatan ? String(item.angkatan) : '',
                kelas_paralel: item.kelas_paralel ? String(item.kelas_paralel) : '',
                kelas: kelasCombined,
                ruang: item.ruang || null,
                agama: item.agama ? String(item.agama).trim() : null
              };
            });
            ({ error } = await supabaseClient.from('siswa').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Siswa berhasil ditambahkan secara massal' };
          }
          case 'update_siswa': {
            const { id_siswa, npsn, ...updates } = payload; // Extract npsn so it's not updated unintentionally
            
            if (updates.nisn) {
              const { data: existingSiswa } = await supabaseClient.from('siswa').select('id_siswa').eq('nisn', updates.nisn).eq('npsn', payload.npsn).neq('id_siswa', id_siswa).maybeSingle();
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
                waktu_login: null,
                nilai_auto: null,
                nilai_uraian: null,
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
          case 'create_kelas_bulk': {
            const rawList = Array.isArray(payload) ? payload : (payload?.data || []);
            const npsn = payload?.npsn || rawList[0]?.npsn;
            if (!Array.isArray(rawList) || rawList.length === 0) {
              return { status: 'error', message: 'Tidak ada data kelas untuk disimpan' };
            }
            const bulkData = rawList.map(k => ({
              id_kelas: k.id_kelas || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('KLS-' + Math.random().toString(36).substr(2, 9))),
              tingkat: String(k.tingkat || '').trim(),
              kelas_paralel: String(k.kelas_paralel || '').trim(),
              npsn: k.npsn || npsn
            })).filter(k => k.tingkat && k.kelas_paralel);

            if (bulkData.length === 0) {
              return { status: 'error', message: 'Data kelas tidak valid (tingkat dan kelas paralel wajib diisi)' };
            }
            ({ error } = await supabaseClient.from('kelas').insert(bulkData));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: `${bulkData.length} kelas berhasil ditambahkan`, insertedCount: bulkData.length };
          }
          case 'delete_kelas_bulk': {
            if (!Array.isArray(payload?.ids) || payload.ids.length === 0) {
              return { status: 'error', message: 'Tidak ada kelas yang dipilih' };
            }
            let query = supabaseClient.from('kelas').delete().in('id_kelas', payload.ids);
            if (payload.npsn) query = query.eq('npsn', payload.npsn);
            const resBulkKelas = await query;
            if (resBulkKelas.error) {
              if (resBulkKelas.error.code === '23503') {
                return { status: 'error', message: 'Gagal: Sebagian atau seluruh kelas terpilih masih digunakan oleh data siswa.' };
              }
              return { status: 'error', message: resBulkKelas.error.message };
            }
            return { status: 'success', message: `${payload.ids.length} kelas berhasil dihapus` };
          }

          // GURU
          case 'get_guru': {
            ({ data, error } = await supabaseClient.from('guru').select('id_guru, nip, nama_guru, alokasi_kelas, nama_mapel, username, role, password, npsn, created_at, guru_mapel(id_mapel, mata_pelajaran(nama_mapel))').eq('npsn', payload.npsn).order('created_at', { ascending: false }));
            if (error) return { status: 'error', message: error.message };
            const processedData = data.map(g => {
              const mapels = g.guru_mapel ? g.guru_mapel.map(gm => gm.mata_pelajaran?.nama_mapel).filter(Boolean) : [];
              const idMapels = g.guru_mapel ? g.guru_mapel.map(gm => gm.id_mapel) : [];
              return {
                ...g,
                nama_lengkap: g.nama_guru || g.nama_lengkap || '',
                mapels_list: mapels.join(', ') || g.nama_mapel || '-',
                id_mapels: idMapels
              };
            });
            return { status: 'success', data: processedData };
          }
          case 'create_guru': {
            if (payload.nip) {
              const { data: existingGuru } = await supabaseClient.from('guru').select('id_guru').eq('nip', payload.nip).eq('npsn', payload.npsn).maybeSingle();
              if (existingGuru) return { status: 'error', message: 'Guru dengan NIP ini sudah terdaftar.' };
            }

            if (!payload.id_guru) payload.id_guru = generateId('G');
            const { mapels, ...guruData } = payload;
            if (guruData.nama_lengkap && !guruData.nama_guru) {
              guruData.nama_guru = guruData.nama_lengkap;
            }
            delete guruData.nama_lengkap;
            const res = await supabaseClient.from('guru').insert([guruData]).select();
            if (res.error) {
              if (res.error.message.includes('guru_username_key')) {
                return { status: 'error', message: 'Username ini sudah digunakan oleh guru lain. Silakan gunakan username yang berbeda.' };
              }
              return { status: 'error', message: res.error.message };
            }
            if (mapels && mapels.length > 0) {
              const mapelInserts = mapels.map(m => ({ id_guru: guruData.id_guru, id_mapel: m }));
              const { error: gmErr } = await supabaseClient.from('guru_mapel').insert(mapelInserts);
              if (gmErr) return { status: 'error', message: gmErr.message };
            }
            return { status: 'success', message: 'Guru berhasil ditambahkan' };
          }
          case 'create_guru_bulk': {
            const bulkData = (Array.isArray(payload) ? payload : []).map(item => {
              const id_guru = item.id_guru || generateId('G');
              const nama_guru = item.nama_guru || item.nama_lengkap || '';
              return {
                record: {
                  id_guru,
                  npsn: item.npsn,
                  nama_guru,
                  username: item.username,
                  password: item.password || 'Nexa123!',
                  nip: item.nip ? String(item.nip) : null,
                  role: item.role || 'guru',
                  alokasi_kelas: item.alokasi_kelas || null,
                  nama_mapel: item.nama_mapel || item.mata_pelajaran || null
                },
                id_guru,
                _mapels: Array.isArray(item.mapels) ? Array.from(new Set(item.mapels)) : []
              };
            });
            const guruInserts = bulkData.map(x => x.record);
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
              const { error: gmErr } = await supabaseClient.from('guru_mapel').insert(mapelInserts);
              if (gmErr) return { status: 'error', message: gmErr.message };
            }
            return { status: 'success', message: 'Guru berhasil ditambahkan secara massal' };
          }
          case 'update_guru': {
            const { id_guru, mapels, npsn, ...updates } = payload;
            if (updates.nama_lengkap && !updates.nama_guru) {
              updates.nama_guru = updates.nama_lengkap;
            }
            delete updates.nama_lengkap;

            if (updates.nip) {
              const { data: existingGuru } = await supabaseClient.from('guru').select('id_guru').eq('nip', updates.nip).eq('npsn', payload.npsn).neq('id_guru', id_guru).maybeSingle();
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
              const { error: delGmErr } = await supabaseClient.from('guru_mapel').delete().eq('id_guru', id_guru);
              if (delGmErr) return { status: 'error', message: delGmErr.message };
              if (mapels.length > 0) {
                const mapelInserts = mapels.map(m => ({ id_guru, id_mapel: m }));
                const { error: insGmErr } = await supabaseClient.from('guru_mapel').insert(mapelInserts);
                if (insGmErr) return { status: 'error', message: insGmErr.message };
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
                s.tipe_soal !== 'MAPEL_ALLOC'
              ).length;
              const alokasi_kelas = allocMap[m.id_mapel] || m.alokasi_kelas || 'Semua Kelas';
              const mapelName = m.nama_mapel || '';
              const lowerName = mapelName.toLowerCase();
              const isIpaTerpadu = lowerName.includes('ipa terpadu') || (lowerName.includes('ipa') && lowerName.includes('terpadu')) || lowerName === 'ipa';
              const isIpsTerpadu = lowerName.includes('ips terpadu') || (lowerName.includes('ips') && lowerName.includes('terpadu')) || lowerName === 'ips';
              let subMapelList = [];
              if (isIpaTerpadu) {
                subMapelList = ['Biologi', 'Fisika', 'Kimia'];
              } else if (isIpsTerpadu) {
                subMapelList = ['Sosiologi', 'Ekonomi', 'Geografi', 'Sejarah'];
              }
              const isTerpadu = Boolean(isIpaTerpadu || isIpsTerpadu || m.is_terpadu);
              if (m.sub_mapel_list && Array.isArray(m.sub_mapel_list) && m.sub_mapel_list.length > 0) {
                subMapelList = m.sub_mapel_list;
              }
              return { ...m, jumlah_soal, alokasi_kelas, is_terpadu: isTerpadu, sub_mapel_list: subMapelList };
            });
            return { status: 'success', data: processedData };
          }
          case 'create_mapel': {
            const alokasiKelas = payload.alokasi_kelas || 'Semua Kelas';
            const { alokasi_kelas, ...mapelPayload } = payload;
            if (!mapelPayload.id_mapel) mapelPayload.id_mapel = generateId('M');
            if (mapelPayload.agama === 'Semua/Umum' || mapelPayload.agama === 'Semua' || mapelPayload.agama === 'Umum' || mapelPayload.agama === '') {
              mapelPayload.agama = null;
            }

            const resInsert = await supabaseClient.from('mata_pelajaran').insert([mapelPayload]);
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
              const agamaVal = item.agama && item.agama !== 'Semua/Umum' && item.agama !== 'Semua' && item.agama !== 'Umum' ? String(item.agama).trim() : null;
              bulkData.push({
                id_mapel: item.id_mapel || generateId('M'),
                npsn: item.npsn,
                nama_mapel: name,
                agama: agamaVal,
                alokasi_kelas: item.alokasi_kelas || 'Semua Kelas'
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

            const sanitized = toInsert.map(({ alokasi_kelas, ...rest }) => rest);
            const resBulk = await supabaseClient.from('mata_pelajaran').insert(sanitized);
            if (resBulk.error) return { status: 'error', message: resBulk.error.message };

            await Promise.all(toInsert.map(item => saveMapelAlokasi(item.id_mapel, item.npsn, item.alokasi_kelas || 'Semua Kelas')));

            return { status: 'success', message: 'Mata pelajaran berhasil ditambahkan secara massal', insertedCount: toInsert.length };
          }
          case 'update_mapel': {
            const { id_mapel, npsn, alokasi_kelas, ...updates } = payload;
            if (updates.agama === 'Semua/Umum' || updates.agama === 'Semua' || updates.agama === 'Umum' || updates.agama === '') {
              updates.agama = null;
            }
            const resUpdate = await supabaseClient.from('mata_pelajaran').update(updates).eq('id_mapel', id_mapel).eq('npsn', payload.npsn);
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
          case 'delete_mapel_bulk': {
            if (!Array.isArray(payload?.ids) || payload.ids.length === 0) {
              return { status: 'error', message: 'Tidak ada mata pelajaran yang dipilih' };
            }
            let query = supabaseClient.from('mata_pelajaran').delete().in('id_mapel', payload.ids);
            if (payload.npsn) query = query.eq('npsn', payload.npsn);
            const resBulkDelete = await query;
            if (resBulkDelete.error) {
              if (resBulkDelete.error.code === '23503') {
                return { status: 'error', message: 'Gagal: Sebagian atau seluruh Mata Pelajaran terpilih tidak dapat dihapus karena masih memiliki Bank Soal atau Jadwal Ujian yang aktif.' };
              }
              return { status: 'error', message: resBulkDelete.error.message };
            }
            await Promise.all(payload.ids.map(id => deleteMapelAlokasi(id, payload.npsn)));
            return { status: 'success', message: `${payload.ids.length} mata pelajaran berhasil dihapus` };
          }

          case 'get_all_jadwal': {
            ({ data, error } = await supabaseClient.from('jadwal').select('*, guru(nama_guru), mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn));
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
            const insertPayload = {
              ...payload,
              durasi_token_menit: payload.durasi_token_menit !== undefined ? Number(payload.durasi_token_menit) : 5,
              batas_pelanggaran: payload.batas_pelanggaran !== undefined ? Number(payload.batas_pelanggaran) : 3
            };
            ({ error } = await supabaseClient.from('jadwal').insert([insertPayload]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil ditambahkan' };
          }
          case 'update_jadwal': {
            const { id_jadwal, npsn, ...updates } = payload;
            if (updates.durasi_token_menit !== undefined) {
              updates.durasi_token_menit = Number(updates.durasi_token_menit);
            }
            if (updates.batas_pelanggaran !== undefined) {
              updates.batas_pelanggaran = Number(updates.batas_pelanggaran);
            }
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
          case 'clone_jadwal': {
            const { id_jadwal_sumber, target_kelas, token_baru, npsn } = payload;
            let srcQuery = supabaseClient
              .from('jadwal')
              .select('*')
              .eq('id_jadwal', id_jadwal_sumber);
            if (npsn) srcQuery = srcQuery.eq('npsn', npsn);
            const { data: source, error: srcErr } = await srcQuery.single();
            if (srcErr || !source) return { status: 'error', message: srcErr?.message || 'Jadwal sumber tidak ditemukan' };

            const cloned = cloneExamSchedule(source, target_kelas, token_baru);
            if (npsn) cloned.npsn = npsn;
            ({ error } = await supabaseClient.from('jadwal').insert([cloned]));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Jadwal berhasil diduplikasi.', data: cloned };
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

          // ================= GURU =================
          case 'get_jadwal_pengawas': {
            let q = supabaseClient.from('jadwal').select('*, mata_pelajaran(nama_mapel)').eq('npsn', payload.npsn);
            let teacherAlloc = null;
            if (payload.id_guru) {
              const { data: teacherProfile } = await supabaseClient
                .from('guru')
                .select('id_guru, alokasi_kelas, nama_mapel')
                .eq('id_guru', payload.id_guru)
                .maybeSingle();
              if (teacherProfile) {
                teacherAlloc = teacherProfile.alokasi_kelas;
              }

              const { data: gmData } = await supabaseClient
                .from('guru_mapel')
                .select('id_mapel')
                .eq('id_guru', payload.id_guru);
              let taughtMapelIds = (gmData || []).map(g => g.id_mapel).filter(Boolean);
              if (taughtMapelIds.length === 0 && teacherProfile?.nama_mapel) {
                const { data: mp } = await supabaseClient
                  .from('mata_pelajaran')
                  .select('id_mapel')
                  .eq('nama_mapel', teacherProfile.nama_mapel)
                  .eq('npsn', payload.npsn);
                taughtMapelIds = (mp || []).map(m => m.id_mapel).filter(Boolean);
              }
              if (taughtMapelIds.length === 0) {
                return { status: 'success', data: [] };
              }
              q = q.in('id_mapel', taughtMapelIds);
            }
            ({ data, error } = await q);
            if (error) return { status: 'error', message: error.message };
            const now = await getTrueNow();
            const processedData = await processJadwalData(data, now);

            const jIds = processedData.map(j => j.id_jadwal).filter(Boolean);
            const selesaiCountMap = {};
            if (jIds.length > 0) {
              const { data: doneLogs } = await supabaseClient
                .from('log_ujian')
                .select('id_jadwal')
                .in('id_jadwal', jIds)
                .eq('status_ujian', 'SELESAI');
              (doneLogs || []).forEach(dl => {
                selesaiCountMap[dl.id_jadwal] = (selesaiCountMap[dl.id_jadwal] || 0) + 1;
              });
            }

            // Scope schedules by teacher's alokasi_kelas and id_guru
            let finalJadwal = processedData.map(j => ({
              ...j,
              total_selesai: selesaiCountMap[j.id_jadwal] || 0
            }));
            if (payload.id_guru && teacherAlloc && !isUniversalAlloc(teacherAlloc)) {
              const teacherClasses = splitCompoundTargets(teacherAlloc);
              finalJadwal = processedData.filter(j => {
                if (j.id_guru && j.id_guru === payload.id_guru) return true;
                return teacherClasses.some(tc => {
                  const parts = tc.trim().split(/\s+/);
                  const fakeStudent = {
                    angkatan: parts[0] || '',
                    kelas: tc.trim(),
                    kelas_paralel: parts.slice(1).join(' ') || ''
                  };
                  return isClassMatching(j.target_kelas, fakeStudent);
                });
              });
            }

            return {
              status: 'success',
              data: finalJadwal
            };
          }

          case 'get_mapel_guru': {
            const { data: teacherProfile } = await supabaseClient
              .from('guru')
              .select('id_guru, alokasi_kelas, nama_mapel')
              .eq('id_guru', payload.id_guru)
              .maybeSingle();

            ({ data, error } = await supabaseClient
              .from('guru_mapel')
              .select('*, mata_pelajaran(nama_mapel, npsn)')
              .eq('id_guru', payload.id_guru));
            if (error) return { status: 'error', message: error.message };

            const filteredGm = (data || []).filter(gm => !payload.npsn || gm.mata_pelajaran?.npsn === payload.npsn);
            const mapelIds = filteredGm.map(gm => gm.id_mapel).filter(Boolean);
            const soalCountMap = {};
            const dbAllocMap = {};

            if (mapelIds.length > 0 && payload.npsn) {
              const { data: soalRows } = await supabaseClient
                .from('soal_ujian')
                .select('id_mapel, id_soal, tipe_soal, pertanyaan')
                .eq('npsn', payload.npsn)
                .in('id_mapel', mapelIds);
              (soalRows || []).forEach(s => {
                if (s.tipe_soal === 'MAPEL_ALLOC' && s.id_soal?.startsWith('MAPEL_ALLOC_')) {
                  dbAllocMap[s.id_soal.replace('MAPEL_ALLOC_', '')] = s.pertanyaan || 'Semua Kelas';
                } else if (!['NARASI', 'SKEMA_PENILAIAN', 'SKEMA_DEFAULT', 'MAPEL_ALLOC'].includes(s.tipe_soal)) {
                  soalCountMap[s.id_mapel] = (soalCountMap[s.id_mapel] || 0) + 1;
                }
              });
            }

            let cachedAlloc = {};
            if (typeof localStorage !== 'undefined' && payload.npsn) {
              try { cachedAlloc = JSON.parse(localStorage.getItem('nexa_mapel_allocations_' + payload.npsn) || '{}'); } catch {}
            }
            const allocMap = { ...cachedAlloc, ...dbAllocMap };

            return {
              status: 'success',
              data: filteredGm.map(gm => {
                const mapelName = gm.mata_pelajaran ? gm.mata_pelajaran.nama_mapel : (teacherProfile?.nama_mapel || 'Unknown');
                const lowerName = (mapelName || '').toLowerCase();
                const isIpaTerpadu = lowerName.includes('ipa terpadu') || (lowerName.includes('ipa') && lowerName.includes('terpadu')) || lowerName === 'ipa';
                const isIpsTerpadu = lowerName.includes('ips terpadu') || (lowerName.includes('ips') && lowerName.includes('terpadu')) || lowerName === 'ips';
                let subMapelList = [];
                if (isIpaTerpadu) {
                  subMapelList = ['Biologi', 'Fisika', 'Kimia'];
                } else if (isIpsTerpadu) {
                  subMapelList = ['Sosiologi', 'Ekonomi', 'Geografi', 'Sejarah'];
                }
                const isTerpadu = Boolean(isIpaTerpadu || isIpsTerpadu || gm.mata_pelajaran?.is_terpadu);
                if (gm.mata_pelajaran?.sub_mapel_list && Array.isArray(gm.mata_pelajaran.sub_mapel_list) && gm.mata_pelajaran.sub_mapel_list.length > 0) {
                  subMapelList = gm.mata_pelajaran.sub_mapel_list;
                }

                return {
                  ...gm,
                  nama_mapel: mapelName,
                  is_terpadu: isTerpadu,
                  sub_mapel_list: subMapelList,
                  jumlah_soal: soalCountMap[gm.id_mapel] || 0,
                  alokasi_kelas: teacherProfile?.alokasi_kelas || allocMap[gm.id_mapel] || 'Semua Kelas'
                };
              })
            };
          }

          case 'get_soal_by_mapel': {
            ({ data, error } = await supabaseClient.from('soal_ujian').select('*').eq('id_mapel', payload.id_mapel).eq('npsn', payload.npsn).neq('tipe_soal', 'MAPEL_ALLOC').neq('tipe_soal', 'SKEMA_DEFAULT'));
            if (error) return { status: 'error', message: error.message };
            
            // Format opsi column string to array if it is a JSON string
            const formatOpsi = (s) => {
              const normTipe = normalizeTipeSoal(s.tipe_soal);
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              if (normTipe === 'BS' && (!Array.isArray(s.opsi) || s.opsi.length === 0)) {
                s.opsi = ['Benar', 'Salah'];
              }
              return s;
            }
            return { status: 'success', data: (data || []).map(formatOpsi) };
          }

          case 'create_soal_mapel': {
            const { id_soal, id_mapel, npsn, kunci_jawaban, pertanyaan, tipe_soal, opsi, bobot, gambar, id_narasi, sub_mapel, id_guru_pembuat, nama_guru_pembuat } = payload;
            const normTipe = normalizeTipeSoal(tipe_soal);
            let finalOpsi = opsi ? (typeof opsi === 'string' ? opsi : JSON.stringify(opsi)) : null;
            if (normTipe === 'BS' && !finalOpsi) {
              finalOpsi = JSON.stringify(['Benar', 'Salah']);
            }
            
            const insertData = {
              id_soal,
              id_mapel,
              npsn,
              tipe_soal: normTipe,
              pertanyaan,
              opsi: finalOpsi,
              kunci_jawaban,
              bobot: bobot !== undefined ? bobot : 1,
              gambar: gambar || null,
              id_narasi: id_narasi || null,
              sub_mapel: sub_mapel || null,
              id_guru_pembuat: id_guru_pembuat || null,
              nama_guru_pembuat: nama_guru_pembuat || null
            };
            
            ({ error } = await executeSoalMutationWithSchemaFallback(
              (data) => supabaseClient.from('soal_ujian').insert([data]),
              insertData
            ));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil ditambahkan.' };
          }

          case 'update_soal_mapel': {
            const { id_soal: upId, npsn: upNpsn, id_mapel, kunci_jawaban, pertanyaan, tipe_soal, opsi, bobot, gambar, id_narasi, sub_mapel, id_guru_pembuat, nama_guru_pembuat } = payload;
            
            const updateData = {};
            if (kunci_jawaban !== undefined) updateData.kunci_jawaban = kunci_jawaban;
            if (id_mapel !== undefined) updateData.id_mapel = id_mapel;
            if (pertanyaan !== undefined) updateData.pertanyaan = pertanyaan;
            if (tipe_soal !== undefined) updateData.tipe_soal = normalizeTipeSoal(tipe_soal);
            if (opsi !== undefined) updateData.opsi = typeof opsi === 'string' ? opsi : JSON.stringify(opsi);
            if (bobot !== undefined) updateData.bobot = bobot;
            if (gambar !== undefined) updateData.gambar = gambar;
            if (id_narasi !== undefined) updateData.id_narasi = id_narasi;
            if (sub_mapel !== undefined) updateData.sub_mapel = sub_mapel;
            if (id_guru_pembuat !== undefined) updateData.id_guru_pembuat = id_guru_pembuat;
            if (nama_guru_pembuat !== undefined) updateData.nama_guru_pembuat = nama_guru_pembuat;

            ({ error } = await executeSoalMutationWithSchemaFallback(
              (data) => supabaseClient.from('soal_ujian').update(data).eq('id_soal', upId).eq('npsn', upNpsn),
              updateData
            ));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil diperbarui.' };
          }

          case 'delete_soal_mapel': {
            ({ error } = await supabaseClient.from('soal_ujian').delete().eq('id_soal', payload.id_soal).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Soal berhasil dihapus.' };
          }

          case 'delete_soal_bulk':
          case 'delete_soal_mapel_bulk': {
            if (!Array.isArray(payload?.ids) || payload.ids.length === 0) {
              return { status: 'error', message: 'Tidak ada butir soal yang dipilih.' };
            }
            let query = supabaseClient.from('soal_ujian').delete().in('id_soal', payload.ids);
            if (payload.npsn) query = query.eq('npsn', payload.npsn);
            const resBulkDelete = await query;
            if (resBulkDelete.error) {
              return { status: 'error', message: resBulkDelete.error.message };
            }
            return { status: 'success', message: `${payload.ids.length} butir soal berhasil dihapus.` };
          }

          case 'get_jawaban_uraian': {
            ({ data, error } = await supabaseClient.from('jawaban_siswa').select('*, soal_ujian(pertanyaan, tipe_soal, bobot, kunci_jawaban)').eq('id_log', payload.id_log));
            if (error) return { status: 'error', message: error.message };
            const uraianList = (data || []).filter(j => j.soal_ujian && j.soal_ujian.tipe_soal === 'URAIAN');
            return {
              status: 'success',
              data: uraianList.map(j => ({
                ...j,
                pertanyaan: j.soal_ujian ? j.soal_ujian.pertanyaan : 'Unknown',
                bobot: j.soal_ujian?.bobot ?? 10,
                kunci_jawaban: j.soal_ujian?.kunci_jawaban || '',
                sub_mapel: j.soal_ujian?.sub_mapel || null
              }))
            };
          }

          case 'update_nilai_uraian': {
            const { id_log, nilai_uraian_total, detail_skor } = payload;
            if (Array.isArray(detail_skor) && detail_skor.length > 0) {
              await Promise.all(
                detail_skor
                  .filter(d => d && d.id_jawaban)
                  .map(d =>
                    supabaseClient
                      .from('jawaban_siswa')
                      .update({ skor_diperoleh: Number(d.skor_diperoleh) || 0 })
                      .eq('id_jawaban', d.id_jawaban)
                  )
              );
            }
            ({ error } = await supabaseClient.from('log_ujian').update({ nilai_uraian: Number(nilai_uraian_total) || 0 }).eq('id_log', id_log));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Nilai uraian berhasil disimpan.' };
          }

          case 'monitoring_ujian': {
            let teacherAlloc = payload.alokasi_kelas;
            if (!teacherAlloc && payload.id_guru) {
              const { data: gData } = await supabaseClient
                .from('guru')
                .select('alokasi_kelas')
                .eq('id_guru', payload.id_guru)
                .maybeSingle();
              if (gData?.alokasi_kelas) {
                teacherAlloc = gData.alokasi_kelas;
              }
            }

            ({ data, error } = await supabaseClient
              .from('log_ujian')
              .select('*, siswa!inner(nama_lengkap, nisn, username, angkatan, kelas_paralel, kelas, npsn)')
              .eq('id_jadwal', payload.id_jadwal)
              .eq('siswa.npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };

            let logs = data || [];
            if (teacherAlloc && !isUniversalAlloc(teacherAlloc)) {
              logs = logs.filter(l => isClassMatching(teacherAlloc, l.siswa));
            }
            let totalSoal = 0;
            const jawabanCountMap = {};

            const { data: jMeta } = await supabaseClient
              .from('jadwal')
              .select('id_mapel, npsn')
              .eq('id_jadwal', payload.id_jadwal)
              .maybeSingle();

            if (jMeta?.id_mapel) {
              const { count: soalCount } = await supabaseClient
                .from('soal_ujian')
                .select('id_soal', { count: 'exact', head: true })
                .eq('id_mapel', jMeta.id_mapel)
                .eq('npsn', payload.npsn || jMeta.npsn)
                .neq('tipe_soal', 'NARASI')
                .neq('tipe_soal', 'SKEMA_PENILAIAN')
                .neq('tipe_soal', 'SKEMA_DEFAULT')
                .neq('tipe_soal', 'MAPEL_ALLOC');
              totalSoal = soalCount || 0;
            }

            const logIds = logs.map(l => l.id_log).filter(Boolean);
            if (logIds.length > 0) {
              const { data: jwbRows } = await supabaseClient
                .from('jawaban_siswa')
                .select('id_log')
                .in('id_log', logIds);
              (jwbRows || []).forEach(r => {
                if (r && r.id_log) {
                  jawabanCountMap[r.id_log] = (jawabanCountMap[r.id_log] || 0) + 1;
                }
              });
            }

            return {
              status: 'success',
              data: logs.map(l => ({
                ...l,
                nama_lengkap: l.siswa ? l.siswa.nama_lengkap : 'Unknown',
                nisn: l.siswa ? l.siswa.nisn : '-',
                username: l.siswa ? l.siswa.username : '-',
                angkatan: l.siswa ? l.siswa.angkatan : '-',
                kelas_paralel: l.siswa ? l.siswa.kelas_paralel : '-',
                kelas: l.kelas || (l.siswa ? (l.siswa.kelas || `${l.siswa.angkatan || ''} ${l.siswa.kelas_paralel || ''}`.trim()) : '-'),
                total_soal: totalSoal,
                jawaban_count: jawabanCountMap[l.id_log] || 0
              }))
            };
          }

          case 'get_hasil_ujian': {
            let teacherAlloc = payload.alokasi_kelas;
            if (!teacherAlloc && payload.id_guru) {
              const { data: gData } = await supabaseClient
                .from('guru')
                .select('alokasi_kelas')
                .eq('id_guru', payload.id_guru)
                .maybeSingle();
              if (gData?.alokasi_kelas) {
                teacherAlloc = gData.alokasi_kelas;
              }
            }

            let q = supabaseClient
              .from('log_ujian')
              .select('*, siswa!inner(nama_lengkap, nisn, username, angkatan, kelas_paralel, kelas, npsn), jadwal(id_mapel, npsn)')
              .eq('status_ujian', 'SELESAI')
              .eq('siswa.npsn', payload.npsn);
            if (Array.isArray(payload.id_jadwal)) {
              q = q.in('id_jadwal', payload.id_jadwal);
            } else if (payload.id_jadwal) {
              q = q.eq('id_jadwal', payload.id_jadwal);
            }
            ({ data, error } = await q);
            if (error) return { status: 'error', message: error.message };

            let logs = data || [];
            if (teacherAlloc && !isUniversalAlloc(teacherAlloc)) {
              logs = logs.filter(l => isClassMatching(teacherAlloc, l.siswa));
            }
            const mapelIds = [...new Set(logs.map(l => l.jadwal?.id_mapel).filter(Boolean))];
            const soalByMapel = {};
            if (mapelIds.length > 0) {
              const { data: sRows } = await supabaseClient
                .from('soal_ujian')
                .select('id_soal, id_mapel, tipe_soal, bobot, kunci_jawaban')
                .eq('npsn', payload.npsn)
                .in('id_mapel', mapelIds);
              (sRows || []).forEach(s => {
                if (!soalByMapel[s.id_mapel]) soalByMapel[s.id_mapel] = [];
                soalByMapel[s.id_mapel].push(s);
              });
            }
            const defaultSkema = payload.npsn ? await get_default_skema_sekolah(payload.npsn) : null;

            return {
              status: 'success',
              data: logs.map(l => {
                const mapelSoal = soalByMapel[l.jadwal?.id_mapel] || [];
                const skemaObj = resolveMapelSkemaFromSoal(mapelSoal, defaultSkema);

                const weighted = computeWeightedExamScores(mapelSoal, {}, l.is_blocked, skemaObj, Number(l.nilai_uraian) || 0);
                const totalNilai = l.is_blocked
                  ? 0
                  : Math.min(100, Math.round(((Number(l.nilai_auto) || 0) + weighted.nilaiUraianScaled) * 100) / 100);

                return {
                  ...l,
                  nama_lengkap: l.siswa ? l.siswa.nama_lengkap : 'Unknown',
                  nisn: l.siswa ? l.siswa.nisn : '-',
                  username: l.siswa ? l.siswa.username : '-',
                  angkatan: l.siswa ? l.siswa.angkatan : '-',
                  kelas_paralel: l.siswa ? l.siswa.kelas_paralel : '-',
                  kelas: l.siswa ? (l.siswa.kelas || `${l.siswa.angkatan || ''} ${l.siswa.kelas_paralel || ''}`.trim()) : '-',
                  has_uraian: mapelSoal.some(s => s.tipe_soal === 'URAIAN'),
                  belum_dikoreksi: mapelSoal.some(s => s.tipe_soal === 'URAIAN') && !l.is_blocked && (l.nilai_uraian === null || l.nilai_uraian === undefined),
                  total_nilai: totalNilai
                };
              })
            };
          }

          case 'buka_blokir': {
            const idLog = payload.id_log;
            const idSiswa = payload.id_siswa || payload.p_id_siswa;
            const idJadwal = payload.id_jadwal || payload.p_id_jadwal;
            if (!idLog && !(idSiswa && idJadwal)) {
              return { status: 'error', message: 'ID Log atau ID Siswa & Jadwal diperlukan.' };
            }
            let q = supabaseClient
              .from('log_ujian')
              .update({ is_blocked: false, pelanggaran: 0, status_ujian: 'SEDANG KERJA', waktu_selesai: null });
            if (idLog) {
              q = q.eq('id_log', idLog);
            } else if (idSiswa && idJadwal) {
              if (payload.npsn) {
                const { data: jCheck } = await supabaseClient.from('jadwal').select('id_jadwal').eq('id_jadwal', idJadwal).eq('npsn', payload.npsn).maybeSingle();
                if (!jCheck) return { status: 'error', message: 'Jadwal tidak sesuai NPSN sekolah.' };
              }
              q = q.eq('id_siswa', idSiswa).eq('id_jadwal', idJadwal);
            }
            ({ error } = await q);
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Blokir berhasil dibuka.' };
          }

          // ================= SISWA =================
          case 'get_jadwal': {
              const { data: siswaData } = await supabaseClient
                .from('siswa')
                .select('id_siswa, angkatan, kelas_paralel, kelas, agama')
                .eq('id_siswa', payload.id_siswa)
                .eq('npsn', payload.npsn)
                .single();
              
              const { data: allJadwal, error } = await supabaseClient
                .from('jadwal')
                .select('*, guru(nama_guru), mata_pelajaran(nama_mapel, agama)')
                .eq('npsn', payload.npsn)
                .order('waktu_mulai', { ascending: false });

              if (error) return { status: 'error', message: error.message };

              const now = await getTrueNow();
              const processedJadwal = await processJadwalData(allJadwal || [], now);

              // Filter schedules strictly matching student's class and religion requirement
              const matchingJadwal = processedJadwal.filter(j => {
                if (!isClassMatching(j.target_kelas, siswaData)) return false;
                const mapelInfo = j.mata_pelajaran || j.nama_mapel || '';
                return isReligionMatching(siswaData?.agama, mapelInfo);
              });

              const { data: logs } = await supabaseClient
                .from('log_ujian')
                .select('id_jadwal, status_ujian, is_blocked, pelanggaran, id_log, waktu_login')
                .eq('id_siswa', payload.id_siswa)
                .order('waktu_login', { ascending: false });

              const logMap = {};
              if (logs) {
                logs.forEach(l => {
                  if (!logMap[l.id_jadwal]) logMap[l.id_jadwal] = l;
                });
              }

              return {
                status: 'success',
                serverNow: now.toISOString(),
                data: matchingJadwal.map(j => {
                  const l = logMap[j.id_jadwal];
                  const strikes = l ? (l.pelanggaran || 0) : 0;
                  const maxAllowedStrikes = Number(j.batas_pelanggaran) || 3;
                  const blocked = l ? (l.is_blocked || (strikes >= maxAllowedStrikes) || (strikes >= 3 && maxAllowedStrikes === 3)) : false;
                  const { token: _t, token_aktif: _ta, ...safeJadwal } = j;
                  return {
                    ...safeJadwal,
                    nama_guru: typeof j.guru === 'string' ? j.guru : (j.guru ? (j.guru.nama_guru || j.guru.nama_lengkap) : 'Unknown'),
                    nama_mapel: j.nama_mapel || (j.mata_pelajaran ? j.mata_pelajaran.nama_mapel : 'Unknown'),
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
              .select('id_log, id_jadwal, id_siswa, waktu_login, pelanggaran, is_blocked, status_ujian, nilai_auto')
              .eq('id_log', payload.id_log)
              .single();
            if (logErr || !log) return { status: 'error', message: logErr?.message || 'Log tidak ditemukan' };

            if (payload.session_token && log.id_siswa) {
              const { data: siswaData } = await supabaseClient
                .from('siswa')
                .select('session_token')
                .eq('id_siswa', log.id_siswa)
                .maybeSingle();
              if (siswaData && siswaData.session_token) {
                const currentUuid = siswaData.session_token.split('|')[0];
                const payloadUuid = payload.session_token.split('|')[0];
                if (currentUuid !== payloadUuid) {
                  return { status: 'error', session_conflict: true, message: 'Sesi tidak valid atau akun dibuka di perangkat lain.' };
                }
              }
            }

            let waktu_selesai = null;
            let durasi_menit = null;
            if (log.id_jadwal) {
              const { data: jadwalInfo } = await supabaseClient
                .from('jadwal')
                .select('waktu_selesai, durasi_menit')
                .eq('id_jadwal', log.id_jadwal)
                .maybeSingle();
              if (jadwalInfo) {
                waktu_selesai = jadwalInfo.waktu_selesai;
                durasi_menit = jadwalInfo.durasi_menit;
              }
            }

            const nowTrue = await getTrueNow();
            return { 
              status: 'success', 
              data: {
                ...log,
                waktu_selesai,
                durasi_menit,
                serverNow: nowTrue.toISOString()
              } 
            };
          }

          case 'mulai_ujian': {
            ({ data, error } = await supabaseClient
              .from('jadwal')
              .select('token_aktif, waktu_mulai, waktu_selesai, target_kelas, id_mapel, batas_pelanggaran, mata_pelajaran(nama_mapel, agama)')
              .eq('id_jadwal', payload.id_jadwal)
              .eq('npsn', payload.npsn)
              .single());
            if (error || !data) return { status: 'error', message: 'Jadwal tidak ditemukan.' };

            // Fetch student data including agama and class
            const { data: siswaData } = await supabaseClient
              .from('siswa')
              .select('id_siswa, angkatan, kelas_paralel, kelas, agama')
              .eq('id_siswa', payload.id_siswa)
              .eq('npsn', payload.npsn)
              .maybeSingle();

            // Religion Gating (R1): Reject if religion does not match
            const mapelInfo = data.mata_pelajaran || data.id_mapel;
            if (!isReligionMatching(siswaData?.agama, mapelInfo)) {
              return {
                status: 'error',
                message: 'Akses ditolak: Ujian mata pelajaran agama ini tidak sesuai dengan data agama Anda.'
              };
            }

            const nowTrue = await getTrueNow();
            if (data.waktu_selesai && new Date(data.waktu_selesai) < nowTrue) return { status: 'error', message: 'Ujian sudah berakhir.' };

            const { data: logsData } = await supabaseClient
              .from('log_ujian')
              .select('*')
              .eq('id_siswa', payload.id_siswa)
              .eq('id_jadwal', payload.id_jadwal)
              .order('waktu_login', { ascending: false });
            const logData = logsData && logsData.length > 0 ? logsData[0] : null;
            let idLog = logData ? logData.id_log : null;

            if (logsData && logsData.length > 0) {
              const maxAllowedStrikes = Number(data.batas_pelanggaran) || 3;
              const blockedLog = logsData.find(l => l.is_blocked || (l.pelanggaran || 0) >= maxAllowedStrikes || ((l.pelanggaran || 0) >= 3 && maxAllowedStrikes === 3));
              if (blockedLog) {
                return { 
                  status: 'error', 
                  message: `Akun Anda diblokir dari ujian ini (pelanggaran melebihi batas ${maxAllowedStrikes} kali).`,
                  terblokir: true,
                  pelanggaran: blockedLog.pelanggaran || maxAllowedStrikes
                };
              }
              if (logData.status_ujian === 'SELESAI') return { status: 'error', message: 'Anda sudah menyelesaikan ujian ini.' };
              // Resuming active 'SEDANG KERJA' or 'MEMULAI' session within window succeeds even after token rotation (Bypass Queue)
              const isResuming = logData.status_ujian === 'SEDANG KERJA' || logData.status_ujian === 'MEMULAI';
              if (isResuming) {
                return { 
                  status: 'success', 
                  admitted: true,
                  id_log: idLog,
                  serverNow: nowTrue.toISOString(),
                  pelanggaran: logData.pelanggaran || 0,
                  is_blocked: logData.is_blocked || false,
                  dataLog: logData
                };
              }

              if (data.waktu_mulai && nowTrue < new Date(data.waktu_mulai)) return { status: 'error', message: 'Ujian belum dimulai.' };
              if (data.token_aktif !== payload.token) return { status: 'error', message: 'Token tidak valid atau sudah expired.' };
            } else {
              if (data.waktu_mulai && nowTrue < new Date(data.waktu_mulai)) return { status: 'error', message: 'Ujian belum dimulai.' };
              if (data.token_aktif !== payload.token) return { status: 'error', message: 'Token tidak valid atau sudah expired.' };
            }

            // SOP 2: Traffic Gatekeeper Admission Check (Maksimal 50 siswa masuk bersamaan)
            const MAX_ENTERING_CAPACITY = 50;
            const cutoffTime = new Date(nowTrue.getTime() - 45000).toISOString();
            
            const { count: activeEnteringCount } = await supabaseClient
              .from('log_ujian')
              .select('id_log', { count: 'exact', head: true })
              .eq('id_jadwal', payload.id_jadwal)
              .eq('status_ujian', 'MEMULAI')
              .gt('waktu_login', cutoffTime);

            const currentEntering = activeEnteringCount || 0;

            if (currentEntering >= MAX_ENTERING_CAPACITY) {
              // Kuota gelombang masuk 50 siswa sedang penuh -> Masuk antrean
              if (!idLog) {
                idLog = 'LOG-' + Math.random().toString(36).substr(2, 9);
                const { error: insErr } = await supabaseClient.from('log_ujian').insert([{
                  id_log: idLog,
                  id_jadwal: payload.id_jadwal,
                  id_siswa: payload.id_siswa,
                  waktu_login: nowTrue.toISOString(),
                  status_ujian: 'ANTRE',
                  pelanggaran: 0
                }]);
                if (insErr) return { status: 'error', message: 'Gagal mencatat antrean ujian: ' + insErr.message };
              } else if (logData?.status_ujian !== 'ANTRE') {
                await supabaseClient.from('log_ujian').update({
                  status_ujian: 'ANTRE',
                  waktu_login: nowTrue.toISOString()
                }).eq('id_log', idLog);
              }

              // Hitung posisi antrean di depan siswa ini
              const { count: aheadCount } = await supabaseClient
                .from('log_ujian')
                .select('id_log', { count: 'exact', head: true })
                .eq('id_jadwal', payload.id_jadwal)
                .eq('status_ujian', 'ANTRE')
                .lt('waktu_login', nowTrue.toISOString());

              const queuePos = (aheadCount || 0) + 1;

              return {
                status: 'queued',
                queue_active: true,
                position: queuePos,
                id_log: idLog,
                waitSeconds: 4,
                current_count: currentEntering,
                max_capacity: MAX_ENTERING_CAPACITY,
                message: `Ruang ujian sedang memproses gelombang masuk (${currentEntering}/${MAX_ENTERING_CAPACITY} siswa). Anda berada di antrean #${queuePos}.`
              };
            }

            // Kuota tersedia (< 50) -> Masuk dengan status 'MEMULAI'
            if (!idLog) {
              idLog = 'LOG-' + Math.random().toString(36).substr(2, 9);
              const { error: insLogErr } = await supabaseClient.from('log_ujian').insert([{
                id_log: idLog,
                id_jadwal: payload.id_jadwal,
                id_siswa: payload.id_siswa,
                waktu_login: nowTrue.toISOString(),
                status_ujian: 'MEMULAI',
                pelanggaran: 0
              }]);
              if (insLogErr) return { status: 'error', message: 'Gagal memulai sesi ujian: ' + insLogErr.message };
            } else {
              await supabaseClient.from('log_ujian').update({
                status_ujian: 'MEMULAI',
                waktu_login: nowTrue.toISOString()
              }).eq('id_log', idLog);
            }

            return { 
              status: 'success', 
              admitted: true,
              id_log: idLog,
              serverNow: nowTrue.toISOString(),
              pelanggaran: logData ? (logData.pelanggaran || 0) : 0,
              is_blocked: logData ? (logData.is_blocked || false) : false,
              dataLog: logData ? { ...logData, status_ujian: 'MEMULAI', waktu_login: nowTrue.toISOString() } : { 
                id_log: idLog, 
                id_jadwal: payload.id_jadwal, 
                id_siswa: payload.id_siswa, 
                waktu_login: nowTrue.toISOString(), 
                status_ujian: 'MEMULAI', 
                pelanggaran: 0, 
                is_blocked: false 
              }
            };
          }

          case 'cek_antrean_ujian': {
            const { id_log: qIdLog, id_jadwal: qIdJadwal, id_siswa: qIdSiswa } = payload;
            if (!qIdLog || !qIdJadwal) return { status: 'error', message: 'Parameter antrean tidak lengkap.' };

            const nowTrue = await getTrueNow();
            const { data: logItem, error: logErr } = await supabaseClient
              .from('log_ujian')
              .select('id_log, id_jadwal, id_siswa, status_ujian, pelanggaran, is_blocked, waktu_login, nilai_auto')
              .eq('id_log', qIdLog)
              .maybeSingle();

            if (logErr || !logItem) return { status: 'error', message: 'Data antrean tidak ditemukan.' };

            // Jika siswa sudah admitted sebelumnya (misal 'MEMULAI' atau 'SEDANG KERJA')
            if (logItem.status_ujian === 'MEMULAI' || logItem.status_ujian === 'SEDANG KERJA') {
              return {
                status: 'admitted',
                id_log: qIdLog,
                serverNow: nowTrue.toISOString(),
                pelanggaran: logItem.pelanggaran || 0,
                is_blocked: logItem.is_blocked || false,
                dataLog: logItem
              };
            }

            // Cek kuota masuk aktif
            const MAX_ENTERING_CAPACITY = 50;
            const cutoffTime = new Date(nowTrue.getTime() - 45000).toISOString();
            const { count: activeCount } = await supabaseClient
              .from('log_ujian')
              .select('id_log', { count: 'exact', head: true })
              .eq('id_jadwal', qIdJadwal)
              .eq('status_ujian', 'MEMULAI')
              .gt('waktu_login', cutoffTime);

            const currentEntering = activeCount || 0;
            const availableSlots = Math.max(0, MAX_ENTERING_CAPACITY - currentEntering);

            // Cek ada berapa antrean di depan siswa ini
            const { count: aheadCount } = await supabaseClient
              .from('log_ujian')
              .select('id_log', { count: 'exact', head: true })
              .eq('id_jadwal', qIdJadwal)
              .eq('status_ujian', 'ANTRE')
              .lt('waktu_login', logItem.waktu_login || nowTrue.toISOString());

            const ahead = aheadCount || 0;

            if (availableSlots > 0 && ahead < availableSlots) {
              // Giliran siswa ini masuk!
              await supabaseClient.from('log_ujian').update({
                status_ujian: 'MEMULAI',
                waktu_login: nowTrue.toISOString()
              }).eq('id_log', qIdLog);

              return {
                status: 'admitted',
                id_log: qIdLog,
                serverNow: nowTrue.toISOString(),
                pelanggaran: logItem.pelanggaran || 0,
                is_blocked: false,
                dataLog: { ...logItem, status_ujian: 'MEMULAI', waktu_login: nowTrue.toISOString() }
              };
            }

            return {
              status: 'queued',
              position: ahead + 1,
              current_count: currentEntering,
              max_capacity: MAX_ENTERING_CAPACITY,
              waitSeconds: 4
            };
          }

          case 'konfirmasi_masuk_ujian': {
            const { id_log: cIdLog, id_jadwal: cIdJadwal } = payload;
            if (!cIdLog) return { status: 'error', message: 'ID log wajib disertakan.' };

            // Update status dari 'MEMULAI' menjadi 'SEDANG KERJA' untuk melepaskan kuota antrean bagi siswa lain
            const { error: updErr } = await supabaseClient
              .from('log_ujian')
              .update({ status_ujian: 'SEDANG KERJA' })
              .eq('id_log', cIdLog)
              .eq('status_ujian', 'MEMULAI');

            if (updErr) return { status: 'error', message: updErr.message };
            return { status: 'success', message: 'Sesi masuk ujian terkonfirmasi aktif.' };
          }

          case 'get_soal_ujian': {
            const isPrivileged = payload.role === 'guru' || payload.role === 'admin' || payload.preview === true;
            if (!isPrivileged && !payload.id_log) {
              return {
                status: 'error',
                message: 'Akses soal ditolak: Log ujian wajib disertakan untuk mengakses soal ujian.'
              };
            }

            const { data: jadwal } = await supabaseClient.from('jadwal').select('id_mapel, npsn, batas_pelanggaran, mata_pelajaran(nama_mapel, agama)').eq('id_jadwal', payload.id_jadwal).single();
            if (!jadwal) return { status: 'error', message: 'Jadwal tidak ditemukan' };
            const effectiveNpsn = payload.npsn || jadwal.npsn;
            const soalColumns = isPrivileged
              ? 'id_soal, id_mapel, npsn, tipe_soal, pertanyaan, opsi, kunci_jawaban, bobot, gambar, id_narasi, sub_mapel'
              : 'id_soal, id_mapel, npsn, tipe_soal, pertanyaan, opsi, bobot, gambar, id_narasi, sub_mapel';
            ({ data, error } = await supabaseClient.from('soal_ujian').select(soalColumns).eq('id_mapel', jadwal.id_mapel).eq('npsn', effectiveNpsn));
            if (error) return { status: 'error', message: error.message };
            
            // Format opsi
            const unpackedData = (data || []).map(s => {
              const normTipe = normalizeTipeSoal(s.tipe_soal);
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              if (normTipe === 'BS' && (!Array.isArray(s.opsi) || s.opsi.length === 0)) {
                s.opsi = ['Benar', 'Salah'];
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
                .select('pelanggaran, is_blocked, status_ujian, nilai_auto, id_jadwal, id_siswa, siswa(agama)')
                .eq('id_log', payload.id_log)
                .maybeSingle();

              if (!log) {
                return {
                  status: 'error',
                  message: 'Log ujian tidak ditemukan atau sesi tidak valid.'
                };
              }

              // Defense-in-depth religion check:
              if (!isPrivileged) {
                const mapelInfo = jadwal.mata_pelajaran || jadwal.id_mapel;
                const studentReligion = log.siswa ? log.siswa.agama : null;
                if (!isReligionMatching(studentReligion, mapelInfo)) {
                  return {
                    status: 'error',
                    message: 'Akses ditolak: Ujian mata pelajaran agama ini tidak sesuai dengan data agama Anda.'
                  };
                }
              }

              const maxAllowedStrikes = Number(jadwal?.batas_pelanggaran) || 3;
              if (log) {
                if (log.is_blocked || (log.pelanggaran || 0) >= maxAllowedStrikes || ((log.pelanggaran || 0) >= 3 && maxAllowedStrikes === 3)) {
                  log.is_blocked = true;
                }
              }
              logStatus = log;
            }

            return { status: 'success', data: soalAktif, narasiMap, logStatus };
          }

          case 'catat_pelanggaran': {
              const { data: currLog, error: fetchErr } = await supabaseClient
                .from('log_ujian')
                .select('pelanggaran, pelanggaran_detail, id_jadwal')
                .eq('id_log', payload.id_log)
                .single();

              if (fetchErr || !currLog) return { status: 'error', message: fetchErr?.message || 'Log tidak ditemukan' };

              let maxPelanggaran = Number(payload.batas_pelanggaran) || 0;
              if (!maxPelanggaran && currLog.id_jadwal) {
                const { data: currJadwal } = await supabaseClient
                  .from('jadwal')
                  .select('batas_pelanggaran')
                  .eq('id_jadwal', currLog.id_jadwal)
                  .single();
                if (currJadwal?.batas_pelanggaran) {
                  maxPelanggaran = Number(currJadwal.batas_pelanggaran);
                }
              }
              if (!maxPelanggaran) maxPelanggaran = 3;

              const forceBlock = payload.force_block === true;
              const newPelanggaran = forceBlock ? maxPelanggaran : (currLog.pelanggaran || 0) + 1;
              const isBlocked = forceBlock || newPelanggaran >= maxPelanggaran || (newPelanggaran >= 3 && maxPelanggaran === 3);
              const details = Array.isArray(currLog.pelanggaran_detail) ? currLog.pelanggaran_detail : [];
              const waktu = new Date().toISOString();
              details.push({ 
                waktu, 
                alasan: payload.alasan || (forceBlock ? 'Diblokir oleh Pengawas / Admin Ujian.' : 'Terdeteksi keluar dari layar penuh atau pindah aplikasi/tab.')
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
            
            // Cek status sesi & blokir (idempoten jika sudah SELESAI)
            const { data: currLog, error: logErr } = await supabaseClient
              .from('log_ujian')
              .select('status_ujian, is_blocked, pelanggaran, nilai_auto, id_jadwal')
              .eq('id_log', logId)
              .maybeSingle();
            if (logErr) return { status: 'error', message: 'Gagal memeriksa log ujian: ' + logErr.message };
            if (currLog?.status_ujian === 'SELESAI') {
              return {
                status: 'success',
                already_submitted: true,
                message: currLog.is_blocked ? 'Ujian telah berakhir (Terblokir).' : 'Ujian sudah dikumpulkan sebelumnya.',
                nilai_auto: currLog.is_blocked ? 0 : (currLog.nilai_auto ?? 0)
              };
            }
            const effectiveJadwalId = payload.id_jadwal || currLog?.id_jadwal;
            const { data: jadwal } = effectiveJadwalId
              ? await supabaseClient.from('jadwal').select('id_mapel, npsn, batas_pelanggaran').eq('id_jadwal', effectiveJadwalId).maybeSingle()
              : { data: null };
            const maxAllowedStrikes = Number(jadwal?.batas_pelanggaran) || 3;
            const isBlocked = Boolean(currLog?.is_blocked || (currLog?.pelanggaran || 0) >= maxAllowedStrikes || ((currLog?.pelanggaran || 0) >= 3 && maxAllowedStrikes === 3));

            // Konversi array jawaban [{id_soal, jawaban}] atau object {id_soal: jawaban} menjadi map
            const jawaban = {};
            if (Array.isArray(payload.jawaban)) {
              payload.jawaban.forEach(j => {
                if (j && j.id_soal) jawaban[j.id_soal] = j.jawaban;
              });
            } else if (payload.jawaban && typeof payload.jawaban === 'object') {
              Object.assign(jawaban, payload.jawaban);
            }

            const effectiveNpsn = payload.npsn || jadwal?.npsn;
            const { data: rawSoalData } = await supabaseClient
              .from('soal_ujian')
              .select('id_soal, id_mapel, npsn, tipe_soal, kunci_jawaban, bobot, opsi')
              .eq('id_mapel', jadwal?.id_mapel)
              .eq('npsn', effectiveNpsn);
            const soalData = (rawSoalData || []).map(s => {
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch(e) {}
              }
              return s;
            });
            
            const defSkema = effectiveNpsn ? await get_default_skema_sekolah(effectiveNpsn) : null;
            const mapelSkema = resolveMapelSkemaFromSoal(soalData, defSkema);

            const weightedResult = computeWeightedExamScores(soalData, jawaban, isBlocked, mapelSkema);
            let nilaiAuto = weightedResult.nilaiAuto;
            if (isBlocked) { nilaiAuto = 0; }
            const insertJawaban = (weightedResult.details || []).map(d => {
              const jwb = jawaban[d.id_soal];
              const stringJawaban = (jwb !== null && typeof jwb === 'object') ? JSON.stringify(jwb) : String(jwb ?? '');
              return {
                id_jawaban: 'JWB-' + Math.random().toString(36).substr(2, 9),
                id_log: logId,
                id_soal: d.id_soal,
                jawaban_user: stringJawaban,
                is_correct: d.isCorrect,
                skor_diperoleh: d.skorDiperoleh
              };
            });

            // Transaksi Atomik Submit: Menjamin seluruh jawaban tersimpan utuh dan status log diperbarui dalam 1 transaksi ACID
            let atomicDone = false;
            let atomicError = null;
            try {
              const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('submit_ujian_atomic', {
                p_id_log: logId,
                p_jawaban_list: insertJawaban,
                p_status_ujian: 'SELESAI',
                p_nilai_auto: isNaN(nilaiAuto) ? 0 : nilaiAuto
              });
              if (!rpcErr && rpcRes && (rpcRes.success || rpcRes.status === 'success' || rpcRes === true)) {
                atomicDone = true;
              } else if (rpcErr) {
                atomicError = rpcErr;
              } else if (rpcRes && (rpcRes.error || rpcRes.success === false)) {
                atomicError = { message: rpcRes.message || rpcRes.error || 'Eksekusi transaksi submit_ujian_atomic gagal.' };
              } else {
                atomicError = { message: 'Respons transaksi submit_ujian_atomic tidak terduga.' };
              }
            } catch (err) {
              atomicError = err;
            }

            // Fallback: Jika RPC belum terpasang di database, jalankan operasi tabel berurutan
            if (!atomicDone) {
              const isFunctionMissing = !atomicError || 
                atomicError.code === 'PGRST202' || 
                atomicError.code === '42883' || 
                (atomicError.message && (
                  atomicError.message.includes('submit_ujian_atomic') || 
                  atomicError.message.toLowerCase().includes('could not find the function') ||
                  atomicError.message.toLowerCase().includes('does not exist')
                ));

              if (!isFunctionMissing && atomicError) {
                return { 
                  status: 'error', 
                  message: atomicError.message || 'Gagal menyimpan jawaban ujian secara atomik.' 
                };
              }

              const { error: delErr } = await supabaseClient.from('jawaban_siswa').delete().eq('id_log', logId);
              if (delErr) {
                return { status: 'error', message: 'Gagal membersihkan jawaban lama: ' + delErr.message };
              }

              if (insertJawaban.length > 0) {
                const { error: insErr } = await supabaseClient.from('jawaban_siswa').insert(insertJawaban);
                if (insErr) {
                  return { status: 'error', message: 'Gagal menyimpan jawaban siswa: ' + insErr.message };
                }
              }

              const { error: updErr } = await supabaseClient.from('log_ujian').update({
                status_ujian: 'SELESAI',
                nilai_auto: nilaiAuto,
                waktu_selesai: new Date().toISOString()
              }).eq('id_log', logId);

              if (updErr) {
                return { status: 'error', message: 'Gagal memperbarui status ujian: ' + updErr.message };
              }
            }

            return { 
              status: 'success', 
              message: isBlocked ? 'Ujian telah berakhir. Karena Anda melanggar lebih dari 3 kali (Terblokir), nilai Anda otomatis menjadi 0.' : 'Ujian berhasil diselesaikan.', 
              nilai_auto: nilaiAuto 
            };
          }

          case 'import_jawaban_offline': {
            let bundle = payload.bundle;
            if (!bundle && payload.encoded_bundle) {
              try {
                bundle = decodeNexaBundle(payload.encoded_bundle, 'NEXA_SECRET_SALT', payload.npsn, payload.id_log);
              } catch (e) {
                return { status: 'error', message: 'Gagal mendekripsi berkas .nexa: ' + e.message };
              }
            } else if (!bundle && payload.magic && String(payload.magic).startsWith('NEXA_OFFLINE_BUNDLE')) {
              bundle = payload;
            }

            if (!bundle || !bundle.id_log) {
              return { status: 'error', message: 'Berkas .nexa tidak valid atau data sesi hilang.' };
            }

            // Verifikasi integritas checksum
            if (bundle.checksum) {
              const chk = verifyNexaBundleChecksum(bundle);
              if (!chk.valid) {
                return { status: 'error', message: chk.error || 'Checksum berkas .nexa tidak cocok (berkas rusak atau dimanipulasi).' };
              }
            }

            const logId = bundle.id_log;
            const activeNpsn = bundle.npsn || payload.npsn;

            // Cek log ujian siswa
            let currLog = null;
            const { data: logRow } = await supabaseClient.from('log_ujian').select('*').eq('id_log', logId).maybeSingle();
            if (logRow) currLog = logRow;

            // Ambil jadwal & soal
            const idJadwal = bundle.id_jadwal || currLog?.id_jadwal;
            let idMapel = payload.id_mapel;
            let batasPelanggaran = Number(bundle.batas_pelanggaran) || 0;
            if (idJadwal) {
              const { data: jRow } = await supabaseClient.from('jadwal').select('id_mapel, npsn, batas_pelanggaran').eq('id_jadwal', idJadwal).maybeSingle();
              if (jRow) {
                if (!idMapel) idMapel = jRow.id_mapel;
                if (!batasPelanggaran && jRow.batas_pelanggaran) batasPelanggaran = Number(jRow.batas_pelanggaran);
              }
            }
            if (!batasPelanggaran) batasPelanggaran = 3;
            const maxAllowedStrikes = batasPelanggaran;
            const isBlocked = (bundle.pelanggaran >= maxAllowedStrikes) || ((currLog?.pelanggaran || 0) >= maxAllowedStrikes) || (currLog?.is_blocked === true) || (maxAllowedStrikes === 3 && (bundle.pelanggaran >= 3 || (currLog?.pelanggaran || 0) >= 3));

            let soalQuery = supabaseClient.from('soal_ujian').select('*');
            if (idMapel) soalQuery = soalQuery.eq('id_mapel', idMapel);
            if (activeNpsn) soalQuery = soalQuery.eq('npsn', activeNpsn);
            const { data: rawSoalData, error: soalErr } = await soalQuery;
            if (soalErr) return { status: 'error', message: 'Gagal memuat soal ujian: ' + soalErr.message };

            const soalData = (rawSoalData || []).map(s => {
              if (s.opsi && typeof s.opsi === 'string') {
                try { s.opsi = JSON.parse(s.opsi); } catch {}
              }
              return s;
            });

            const defaultSkema = activeNpsn ? await get_default_skema_sekolah(activeNpsn) : null;
            const mapelSkema = resolveMapelSkemaFromSoal(soalData, defaultSkema);

            const rawJawaban = bundle.jawaban || {};
            const jawabanMap = {};
            if (Array.isArray(rawJawaban)) {
              rawJawaban.forEach(j => {
                if (j && j.id_soal) jawabanMap[j.id_soal] = j.jawaban;
              });
            } else if (typeof rawJawaban === 'object' && rawJawaban !== null) {
              Object.assign(jawabanMap, rawJawaban);
            }

            const weightedResult = computeWeightedExamScores(soalData, jawabanMap, isBlocked, mapelSkema);
            const nilaiAuto = isBlocked ? 0 : weightedResult.nilaiAuto;

            // Format jawaban_siswa rows from weightedResult.details
            const insertJawaban = (weightedResult.details || []).map(d => {
              const jwb = jawabanMap[d.id_soal];
              const stringJawaban = (jwb !== null && typeof jwb === 'object') ? JSON.stringify(jwb) : String(jwb ?? '');
              return {
                id_jawaban: 'JWB-' + Math.random().toString(36).substr(2, 9),
                id_log: logId,
                id_soal: d.id_soal,
                jawaban_user: stringJawaban,
                is_correct: d.isCorrect,
                skor_diperoleh: d.skorDiperoleh
              };
            });

            // Update or insert log_ujian first (must exist for FK if newly inserted)
            const logFields = {
              status_ujian: 'SELESAI',
              nilai_auto: isNaN(nilaiAuto) ? 0 : nilaiAuto,
              waktu_selesai: bundle.timestamp || new Date().toISOString(),
              pelanggaran: bundle.pelanggaran ?? currLog?.pelanggaran ?? 0,
              is_blocked: isBlocked
            };

            if (!currLog) {
              const { error: insLogErr } = await supabaseClient.from('log_ujian').insert([{
                id_log: logId,
                id_jadwal: idJadwal,
                id_siswa: bundle.id_siswa,
                waktu_login: bundle.timestamp || new Date().toISOString(),
                ...logFields
              }]);
              if (insLogErr) return { status: 'error', message: 'Gagal membuat log_ujian offline: ' + insLogErr.message };
            } else {
              const { error: updErr } = await supabaseClient.from('log_ujian').update(logFields).eq('id_log', logId);
              if (updErr) return { status: 'error', message: 'Gagal memperbarui log_ujian: ' + updErr.message };
            }

            // Hapus jawaban lama dan simpan jawaban baru
            const { error: delErr } = await supabaseClient.from('jawaban_siswa').delete().eq('id_log', logId);
            if (delErr) return { status: 'error', message: 'Gagal membersihkan jawaban lama: ' + delErr.message };
            if (insertJawaban.length > 0) {
              const { error: insErr } = await supabaseClient.from('jawaban_siswa').insert(insertJawaban);
              if (insErr) return { status: 'error', message: 'Gagal menyimpan jawaban offline: ' + insErr.message };
            }

            return {
              status: 'success',
              message: isBlocked 
                ? 'Jawaban offline diimpor. Siswa tercatat melakukan 3 pelanggaran (auto-kick), nilai otomatis 0.'
                : 'Jawaban offline siswa berhasil diimpor dan dinilai secara otomatis.',
              nilai_auto: nilaiAuto,
              id_log: logId,
              metode_submit: 'OFFLINE_NEXA_IMPORT'
            };
          }

          case 'get_cbt_backup_data': {
            const effectiveNpsn = payload.npsn;
            if (!effectiveNpsn) return { status: 'error', message: 'NPSN diperlukan untuk backup data.' };

            const [soalRes, jadwalRes] = await Promise.all([
              supabaseClient.from('soal_ujian').select('*').eq('npsn', effectiveNpsn),
              supabaseClient.from('jadwal').select('*').eq('npsn', effectiveNpsn)
            ]);

            if (soalRes.error) return { status: 'error', message: soalRes.error.message };
            if (jadwalRes.error) return { status: 'error', message: jadwalRes.error.message };

            const jadwalIds = (jadwalRes.data || []).map(j => j.id_jadwal).filter(Boolean);
            let logData = [];
            if (jadwalIds.length > 0) {
              const { data: lData, error: logErr } = await supabaseClient
                .from('log_ujian')
                .select('*')
                .in('id_jadwal', jadwalIds);
              if (logErr) return { status: 'error', message: logErr.message };
              logData = lData || [];
            }

            const logIds = logData.map(l => l.id_log).filter(Boolean);
            let jawabanData = [];
            if (logIds.length > 0) {
              const chunkSize = 100;
              for (let i = 0; i < logIds.length; i += chunkSize) {
                const chunk = logIds.slice(i, i + chunkSize);
                const { data: jData, error: jErr } = await supabaseClient.from('jawaban_siswa').select('*').in('id_log', chunk);
                if (jErr) return { status: 'error', message: jErr.message };
                if (jData) jawabanData.push(...jData);
              }
            }

            return {
              status: 'success',
              data: {
                soal_ujian: soalRes.data || [],
                jadwal: jadwalRes.data || [],
                log_ujian: logData,
                jawaban_siswa: jawabanData
              }
            };
          }

          // ================= ADMIN NEW FEATURES =================
          case 'get_analisis_butir_soal':
          case 'get_analisis_soal': {
            let teacherAlloc = payload.alokasi_kelas;
            if (!teacherAlloc && payload.id_guru) {
              const { data: gData } = await supabaseClient
                .from('guru')
                .select('alokasi_kelas')
                .eq('id_guru', payload.id_guru)
                .maybeSingle();
              if (gData?.alokasi_kelas) {
                teacherAlloc = gData.alokasi_kelas;
              }
            }

            const { data: soalData, error: soalErr } = await supabaseClient.from('soal_ujian')
              .select('id_soal, pertanyaan, opsi, kunci_jawaban, bobot, tipe_soal')
              .eq('id_mapel', payload.id_mapel)
              .eq('npsn', payload.npsn)
              .neq('tipe_soal', 'NARASI')
              .neq('tipe_soal', 'SKEMA_PENILAIAN')
              .neq('tipe_soal', 'SKEMA_DEFAULT')
              .neq('tipe_soal', 'MAPEL_ALLOC');
            if (soalErr) return { status: 'error', message: soalErr.message };

            let q = supabaseClient.from('log_ujian')
              .select('id_log, id_siswa, id_jadwal, nilai_auto, nilai_uraian, status_ujian, is_blocked, siswa!inner(id_siswa, nama_lengkap, nisn, angkatan, kelas_paralel, kelas, npsn)')
              .eq('status_ujian', 'SELESAI')
              .eq('siswa.npsn', payload.npsn);

            if (Array.isArray(payload.id_jadwal)) {
              q = q.in('id_jadwal', payload.id_jadwal);
            } else if (payload.id_jadwal) {
              q = q.eq('id_jadwal', payload.id_jadwal);
            }
            const { data: logData, error: logErr } = await q;
            if (logErr) return { status: 'error', message: logErr.message };

            let examinees = logData || [];
            if (teacherAlloc && !isUniversalAlloc(teacherAlloc)) {
              examinees = examinees.filter(l => isClassMatching(teacherAlloc, l.siswa));
            }
            if (payload.tingkat && payload.tingkat !== 'Umum') {
              examinees = examinees.filter(l => {
                const sGrade = l.siswa?.angkatan || l.siswa?.kelas;
                return sGrade && normalizeGrade(sGrade) === normalizeGrade(payload.tingkat);
              });
            }
            if (payload.kelas_paralel && payload.kelas_paralel !== 'ALL') {
              examinees = examinees.filter(l => l.siswa?.kelas_paralel === payload.kelas_paralel);
            }

            const N = examinees.length;
            if (N === 0) {
              const emptyResult = (soalData || []).map((soal, idx) => ({
                ...soal,
                nomor_soal: idx + 1,
                bobot: Number(soal.bobot) || 10,
                total: 0,
                correct: 0,
                wrong: 0,
                jumlah_benar: 0,
                jumlah_salah: 0,
                difficulty: '0.00',
                tingkat_kesukaran: {
                  indeks: 0,
                  klasifikasi: 'Sukar'
                },
                daya_pembeda: {
                  indeks: null,
                  klasifikasi: 'Tidak Cukup Data',
                  metode: 'Insufficient Data'
                },
                komparasi_siswa: []
              }));
              const resPayload = { total_peserta: 0, butir_soal: emptyResult };
              if (action === 'get_analisis_butir_soal' || payload.as_object) {
                return { status: 'success', data: resPayload };
              }
              Object.assign(emptyResult, resPayload);
              return { status: 'success', data: emptyResult, ...resPayload };
            }

            const examineeScores = examinees.map(l => {
              const totalScore = (Number(l.nilai_auto) || 0) + (Number(l.nilai_uraian) || 0);
              return {
                id_log: l.id_log,
                id_siswa: l.id_siswa,
                nama_lengkap: l.siswa ? l.siswa.nama_lengkap : 'Unknown',
                nisn: l.siswa ? l.siswa.nisn : '-',
                kelas: l.siswa ? (l.siswa.kelas || `${l.siswa.angkatan || ''} ${l.siswa.kelas_paralel || ''}`.trim()) : '-',
                totalScore
              };
            });
            examineeScores.sort((a, b) => b.totalScore - a.totalScore);

            let groupMethod = 'Insufficient Data';
            const upperLogIds = new Set();
            const lowerLogIds = new Set();

            if (N >= 30) {
              groupMethod = 'Kelley 27%';
              const n = Math.max(1, Math.round(N * 0.27));
              for (let i = 0; i < n; i++) upperLogIds.add(examineeScores[i].id_log);
              for (let i = N - n; i < N; i++) lowerLogIds.add(examineeScores[i].id_log);
            } else if (N >= 2) {
              groupMethod = 'Median Split 50%';
              const nA = Math.ceil(N / 2);
              const nB = Math.floor(N / 2);
              for (let i = 0; i < nA; i++) upperLogIds.add(examineeScores[i].id_log);
              for (let i = N - nB; i < N; i++) lowerLogIds.add(examineeScores[i].id_log);
            }

            const logIds = examinees.map(l => l.id_log);
            const { data: jwbData, error: jwbErr } = await supabaseClient.from('jawaban_siswa')
              .select('id_soal, id_log, jawaban_user, is_correct, skor_diperoleh')
              .in('id_log', logIds);
            if (jwbErr) return { status: 'error', message: jwbErr.message };

            const answers = jwbData || [];

            const analysis = (soalData || []).map((soal, idx) => {
              const qAnswers = answers.filter(j => j.id_soal === soal.id_soal);
              const answerMap = new Map();
              qAnswers.forEach(a => answerMap.set(a.id_log, a));

              const isEssay = soal.tipe_soal === 'URAIAN';
              const maxBobot = Number(soal.bobot) || 10;

              const checkCorrect = (ans) => {
                if (!ans) return false;
                if (isEssay) {
                  return Boolean(ans.is_correct) || (Number(ans.skor_diperoleh) > 0);
                }
                return Boolean(ans.is_correct);
              };

              let correctCount = 0;
              let upperCorrect = 0;
              let lowerCorrect = 0;

              const komparasiSiswa = examineeScores.map(student => {
                const ans = answerMap.get(student.id_log);
                const isCorrect = checkCorrect(ans);
                if (isCorrect) correctCount++;

                let kelompok = 'TENGAH';
                if (upperLogIds.has(student.id_log)) {
                  kelompok = 'ATAS';
                  if (isCorrect) upperCorrect++;
                } else if (lowerLogIds.has(student.id_log)) {
                  kelompok = 'BAWAH';
                  if (isCorrect) lowerCorrect++;
                }

                return {
                  id_siswa: student.id_siswa,
                  nama_lengkap: student.nama_lengkap,
                  kelas: student.kelas,
                  jawaban_user: ans ? (ans.jawaban_user || '-') : '-',
                  kunci_jawaban: soal.kunci_jawaban || '-',
                  is_correct: isCorrect,
                  skor_diperoleh: ans ? (Number(ans.skor_diperoleh) || 0) : 0,
                  kelompok
                };
              });

              const wrongCount = Math.max(0, N - correctCount);

              const P = N > 0 ? Math.round((correctCount / N) * 100) / 100 : 0;
              let klasKesukaran = 'Sedang';
              if (P < 0.30) klasKesukaran = 'Sukar';
              else if (P > 0.70) klasKesukaran = 'Mudah';

              let D = null;
              let klasPembeda = 'Tidak Cukup Data';
              const nA = upperLogIds.size;
              const nB = lowerLogIds.size;

              if (nA > 0 && nB > 0) {
                const diff = (upperCorrect / nA) - (lowerCorrect / nB);
                D = Math.round(diff * 100) / 100;
                if (D >= 0.40) klasPembeda = 'Sangat Baik';
                else if (D >= 0.30) klasPembeda = 'Baik';
                else if (D >= 0.20) klasPembeda = 'Cukup';
                else if (D >= 0.00) klasPembeda = 'Buruk';
                else klasPembeda = 'Sangat Buruk';
              }

              return {
                ...soal,
                nomor_soal: idx + 1,
                bobot: maxBobot,
                total: N,
                correct: correctCount,
                wrong: wrongCount,
                jumlah_benar: correctCount,
                jumlah_salah: wrongCount,
                difficulty: (P * 100).toFixed(2),
                tingkat_kesukaran: {
                  indeks: P,
                  klasifikasi: klasKesukaran
                },
                daya_pembeda: {
                  indeks: D,
                  klasifikasi: klasPembeda,
                  metode: groupMethod
                },
                komparasi_siswa: komparasiSiswa
              };
            });

            const resPayload = { total_peserta: N, butir_soal: analysis };
            if (action === 'get_analisis_butir_soal' || payload.as_object) {
              return { status: 'success', data: resPayload };
            }
            Object.assign(analysis, resPayload);
            return { status: 'success', data: analysis, ...resPayload };
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
               tipe: g.tipe || 'info',
               isGlobal: true
            }));
            
            return { status: 'success', data: [...formattedGlobal, ...(localData || [])] };
          }
          
          case 'create_pengumuman': {
            const insertPengumuman = {
              id_pengumuman: generateId('ANN'),
              npsn: payload.npsn,
              judul: payload.judul,
              isi: payload.isi,
              target_role: payload.target_role || 'all'
            };
            ({ error } = await supabaseClient.from('pengumuman').insert([insertPengumuman]));
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
              .select('*, jadwal!inner(id_jadwal, id_mapel, waktu_mulai, waktu_selesai, mata_pelajaran(nama_mapel))')
              .eq('id_siswa', payload.id_siswa)
              .eq('status_ujian', 'SELESAI')
              .order('waktu_selesai', { ascending: false }));
            if (error) return { status: 'error', message: error.message };

            const mapelIds = [...new Set((data || []).map(l => l.jadwal?.id_mapel).filter(Boolean))];
            const soalByMapel = {};
            if (mapelIds.length > 0) {
              let sQuery = supabaseClient
                .from('soal_ujian')
                .select('id_soal, id_mapel, tipe_soal, bobot, kunci_jawaban')
                .in('id_mapel', mapelIds);
              if (payload.npsn) sQuery = sQuery.eq('npsn', payload.npsn);
              const { data: sData } = await sQuery;
              (sData || []).forEach(s => {
                if (!soalByMapel[s.id_mapel]) soalByMapel[s.id_mapel] = [];
                soalByMapel[s.id_mapel].push(s);
              });
            }
            const defaultSkema = payload.npsn ? await get_default_skema_sekolah(payload.npsn) : null;
            
            return { 
              status: 'success', 
              data: (data || []).map(log => {
                const mapelSoal = soalByMapel[log.jadwal?.id_mapel] || [];
                const hasUraian = mapelSoal.some(q => q.tipe_soal === 'URAIAN');
                const menungguKoreksi = !log.is_blocked && hasUraian && (log.nilai_uraian === null || log.nilai_uraian === undefined);
                const skemaObj = resolveMapelSkemaFromSoal(mapelSoal, defaultSkema);
                const weighted = computeWeightedExamScores(mapelSoal, {}, log.is_blocked, skemaObj, Number(log.nilai_uraian) || 0);
                const rawTotal = log.is_blocked
                  ? 0
                  : Math.min(100, Math.round(((Number(log.nilai_auto) || 0) + weighted.nilaiUraianScaled) * 100) / 100);
                return {
                  id_log: log.id_log,
                  id_jadwal: log.id_jadwal || log.jadwal?.id_jadwal,
                  id_mapel: log.jadwal?.id_mapel,
                  waktu_mulai: log.jadwal?.waktu_mulai,
                  waktu_selesai: log.jadwal?.waktu_selesai,
                  nilai_auto: log.is_blocked ? 0 : (log.nilai_auto || 0),
                  nilai_uraian: log.is_blocked ? 0 : (log.nilai_uraian || 0),
                  total_nilai: rawTotal,
                  menunggu_koreksi: menungguKoreksi,
                  has_uraian: hasUraian,
                  nama_mapel: log.jadwal?.mata_pelajaran?.nama_mapel || 'Unknown',
                  is_blocked: log.is_blocked || false,
                  pelanggaran_detail: log.pelanggaran_detail || []
                };
              }) 
            };
          }

          case 'finalisasi_nilai_jadwal': {
            const { id_jadwal } = payload;
            if (!id_jadwal) return { status: 'error', message: 'ID Jadwal diperlukan.' };
            ({ error } = await supabaseClient
              .from('log_ujian')
              .update({ nilai_uraian: 0 })
              .eq('id_jadwal', id_jadwal)
              .eq('status_ujian', 'SELESAI')
              .is('nilai_uraian', null));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Nilai jadwal berhasil difinalisasi.' };
          }

          case 'get_rekap_koreksi_admin': {
            const { data: jadwalList, error: jErr } = await supabaseClient
              .from('jadwal')
              .select('*, mata_pelajaran(nama_mapel), guru(nama_guru)')
              .eq('npsn', payload.npsn)
              .order('waktu_mulai', { ascending: false });
            if (jErr) return { status: 'error', message: jErr.message };

            const jadwalIds = (jadwalList || []).map(j => j.id_jadwal);
            const mapelIds = [...new Set((jadwalList || []).map(j => j.id_mapel).filter(Boolean))];
            let logsData = [];
            if (jadwalIds.length > 0) {
              const { data: lData } = await supabaseClient
                .from('log_ujian')
                .select('id_log, id_jadwal, status_ujian, nilai_auto, nilai_uraian, is_blocked')
                .in('id_jadwal', jadwalIds);
              logsData = lData || [];
            }

            const soalByMapel = {};
            if (mapelIds.length > 0) {
              const { data: uData } = await supabaseClient
                .from('soal_ujian')
                .select('id_soal, id_mapel, tipe_soal, bobot, kunci_jawaban')
                .in('id_mapel', mapelIds)
                .eq('npsn', payload.npsn);
              (uData || []).forEach(u => {
                if (!soalByMapel[u.id_mapel]) soalByMapel[u.id_mapel] = [];
                soalByMapel[u.id_mapel].push(u);
              });
            }
            const defaultSkema = payload.npsn ? await get_default_skema_sekolah(payload.npsn) : null;

            const now = await getTrueNow();
            const summary = (jadwalList || []).map(j => {
              let computedStatus = 'BELUM MULAI';
              if (j.waktu_mulai && j.waktu_selesai) {
                const mulai = new Date(j.waktu_mulai);
                const selesai = new Date(j.waktu_selesai);
                if (now >= mulai && now <= selesai) computedStatus = 'AKTIF';
                else if (now > selesai) computedStatus = 'SELESAI';
              }
              const mapelSoal = soalByMapel[j.id_mapel] || [];
              const skemaObj = resolveMapelSkemaFromSoal(mapelSoal, defaultSkema);
              const jLogs = logsData.filter(l => l.id_jadwal === j.id_jadwal);
              const selesaiLogs = jLogs.filter(l => l.status_ujian === 'SELESAI');
              const hasUraian = mapelSoal.some(q => q.tipe_soal === 'URAIAN');
              const belumDinilai = hasUraian
                ? selesaiLogs.filter(l => !l.is_blocked && (l.nilai_uraian === null || l.nilai_uraian === undefined)).length
                : 0;
              const scores = selesaiLogs.map(l => {
                if (l.is_blocked) return 0;
                const weighted = computeWeightedExamScores(mapelSoal, {}, l.is_blocked, skemaObj, Number(l.nilai_uraian) || 0);
                return Math.min(100, Math.round(((Number(l.nilai_auto) || 0) + weighted.nilaiUraianScaled) * 100) / 100);
              });
              const rataRata = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
              return {
                id_jadwal: j.id_jadwal,
                nama_mapel: j.mata_pelajaran?.nama_mapel || '-',
                nama_guru: j.guru?.nama_guru || j.guru?.nama_lengkap || '-',
                target_kelas: j.target_kelas || '-',
                status_ujian: computedStatus,
                waktu_mulai: j.waktu_mulai,
                has_uraian: hasUraian,
                total_peserta: jLogs.length,
                total_selesai: selesaiLogs.length,
                belum_dinilai: belumDinilai,
                sudah_dinilai: selesaiLogs.length - belumDinilai,
                rata_rata: rataRata
              };
            });
            return { status: 'success', data: summary };
          }
          
          case 'reset_login_siswa': {
            if (payload.session_token) {
              const { data: currSiswa } = await supabaseClient
                .from('siswa')
                .select('session_token')
                .eq('id_siswa', payload.id_siswa)
                .eq('npsn', payload.npsn)
                .maybeSingle();
              const payloadUuid = payload.session_token.split('|')[0];
              const dbUuid = currSiswa?.session_token ? currSiswa.session_token.split('|')[0] : null;
              if (dbUuid && dbUuid !== payloadUuid) {
                // Active session already belongs to a newer login on another device; do not clear it
                return { status: 'success', message: 'Sesi lokal ditutup.' };
              }
            }
            ({ error } = await supabaseClient.from('siswa').update({ session_token: null }).eq('id_siswa', payload.id_siswa).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Sesi login siswa berhasil direset.' };
          }
          case 'reset_all_login_siswa': {
            ({ error } = await supabaseClient.from('siswa').update({ session_token: null }).eq('npsn', payload.npsn));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: 'Semua sesi login siswa berhasil direset.' };
          }
          case 'import_soal_bulk': {
            const sanitized = (payload.data || []).map((item, idx) => {
              const { kd, ...rest } = item;
              const normTipe = normalizeTipeSoal(item.tipe_soal || 'PG');
              let opsi = item.opsi;
              if (normTipe === 'BS' && !opsi) {
                opsi = JSON.stringify(['Benar', 'Salah']);
              }
              return {
                ...rest,
                tipe_soal: normTipe,
                opsi,
                id_soal: item.id_soal || `SOAL-${generateId('IMP')}-${idx}`,
                bobot: item.bobot !== undefined ? Number(item.bobot) : 10
              };
            });
            ({ error } = await executeSoalMutationWithSchemaFallback(
              (rows) => supabaseClient.from('soal_ujian').insert(rows),
              sanitized
            ));
            if (error) return { status: 'error', message: error.message };
            return { status: 'success', message: `${sanitized.length} butir soal berhasil diimpor.` };
          }

          case 'get_default_skema_sekolah': {
            const data = await get_default_skema_sekolah(payload.npsn);
            return { status: 'success', data };
          }
          case 'save_default_skema_sekolah': {
            const res = await save_default_skema_sekolah(payload.npsn, payload.payload || payload.format || payload.skema_data || payload);
            if (!res.success) return { status: 'error', message: res.message || 'Gagal menyimpan skema penilaian default sekolah.' };
            return { status: 'success', data: res.data, message: 'Skema penilaian default sekolah berhasil disimpan.' };
          }
          case 'get_admin_skema_mapel': {
            const data = await get_admin_skema_mapel(payload.id_mapel, payload.npsn);
            return { status: 'success', data };
          }
          case 'save_skema_penilaian': {
            const targetMapelIds = (payload.id_mapels && Array.isArray(payload.id_mapels) && payload.id_mapels.length > 0)
              ? payload.id_mapels
              : (payload.id_mapel ? [payload.id_mapel] : []);

            if (targetMapelIds.length === 0) {
              return { status: 'error', message: 'Mata pelajaran tidak valid.' };
            }

            const role = payload.role === 'admin' ? 'admin' : 'guru';
            const effectiveNpsn = payload.npsn;

            // Authorization: Guru role can only configure assigned subjects
            if (role === 'guru') {
              if (!payload.id_guru) {
                return { status: 'error', message: 'ID Guru diperlukan untuk verifikasi hak akses mata pelajaran.' };
              }
              const { data: assignments, error: gmErr } = await supabaseClient
                .from('guru_mapel')
                .select('id_mapel')
                .eq('id_guru', payload.id_guru);

              if (gmErr) {
                return { status: 'error', message: 'Gagal memverifikasi penugasan guru: ' + gmErr.message };
              }

              const assignedSet = new Set((assignments || []).map(a => a.id_mapel));
              const unauthorized = targetMapelIds.filter(id => !assignedSet.has(id));
              if (unauthorized.length > 0) {
                return {
                  status: 'error',
                  message: `Guru tidak memiliki hak akses untuk mata pelajaran: ${unauthorized.join(', ')}.`
                };
              }
            }

            // Mode determination
            let mode = payload.mode;
            let rawSkema = payload.skema;
            if (!mode || !rawSkema) {
              if (payload.kunci_jawaban) {
                try {
                  const parsedKunci = typeof payload.kunci_jawaban === 'string' ? JSON.parse(payload.kunci_jawaban) : payload.kunci_jawaban;
                  if (!mode && parsedKunci?.mode) mode = parsedKunci.mode;
                  if (!rawSkema && parsedKunci?.skema) rawSkema = parsedKunci.skema;
                  else if (!rawSkema && !parsedKunci?.skema && typeof parsedKunci === 'object') rawSkema = parsedKunci;
                } catch (e) {}
              }
            }
            mode = mode || 'default';

            // Validation: Custom mode requires total weights across all 6 question types to equal exactly 100%
            const AKM_TYPES = ['PG', 'PGK', 'BS', 'JODOH', 'ISIAN', 'URAIAN'];
            const cleanSkema = {};
            if (mode === 'custom') {
              if (!rawSkema || typeof rawSkema !== 'object') {
                return { status: 'error', message: 'Skema pembobotan kustom harus berupa objek yang valid.' };
              }
              let totalWeight = 0;
              for (const type of AKM_TYPES) {
                const raw = rawSkema[type];
                const num = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : Number(raw);
                if (isNaN(num) || num < 0) {
                  return { status: 'error', message: `Bobot tipe soal ${type} tidak boleh negatif atau tidak valid.` };
                }
                cleanSkema[type] = num;
                totalWeight += num;
              }
              const roundedTotal = Math.round(totalWeight * 100) / 100;
              if (roundedTotal !== 100) {
                return { status: 'error', message: `Total persentase bobot harus tepat 100%. Saat ini: ${roundedTotal}%.` };
              }
            } else {
              for (const type of AKM_TYPES) {
                cleanSkema[type] = 0;
              }
            }

            const bobot = payload.bobot !== undefined ? payload.bobot : (mode === 'custom' ? 1 : 0);

            const payloadObj = {
              mode,
              skema: cleanSkema,
              role,
              ...(payload.id_guru ? { id_guru: payload.id_guru } : {}),
              updated_at: new Date().toISOString()
            };
            const kunciJawaban = JSON.stringify(payloadObj);

            // Row ID conventions:
            // Admin: 'SKEMA_ADMIN_' + mapelId
            // Guru:  'SKEMA-' + mapelId
            const targetIdPattern = (mapelId) => (role === 'admin' ? 'SKEMA_ADMIN_' + mapelId : 'SKEMA-' + mapelId);
            const targetIdList = targetMapelIds.map(targetIdPattern);

            let existingQuery = supabaseClient
              .from('soal_ujian')
              .select('id_soal, id_mapel')
              .eq('tipe_soal', 'SKEMA_PENILAIAN')
              .in('id_soal', targetIdList);

            if (effectiveNpsn) {
              existingQuery = existingQuery.eq('npsn', effectiveNpsn);
            }
            const { data: existingRecords } = await existingQuery;

            const existingMap = {};
            (existingRecords || []).forEach(r => {
              existingMap[r.id_soal] = r;
            });

            const toUpdate = [];
            const toInsert = [];

            for (const mapelId of targetMapelIds) {
              const desiredId = targetIdPattern(mapelId);
              if (existingMap[desiredId]) {
                toUpdate.push({
                  id_soal: desiredId,
                  id_mapel: mapelId,
                  npsn: effectiveNpsn,
                  kunci_jawaban: kunciJawaban,
                  bobot
                });
              } else {
                toInsert.push({
                  id_soal: desiredId,
                  id_mapel: mapelId,
                  npsn: effectiveNpsn,
                  tipe_soal: 'SKEMA_PENILAIAN',
                  pertanyaan: 'Skema Penilaian',
                  kunci_jawaban: kunciJawaban,
                  bobot
                });
              }

              // LocalStorage cache for Admin per-mapel offline resilience
              if (role === 'admin' && typeof localStorage !== 'undefined' && effectiveNpsn) {
                try {
                  localStorage.setItem(`nexa_admin_skema_${effectiveNpsn}_${mapelId}`, kunciJawaban);
                } catch (e) {}
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
                role,
                mode,
                totalUpdated: toUpdate.length,
                totalInserted: toInsert.length,
                id_mapels: targetMapelIds
              }
            };
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