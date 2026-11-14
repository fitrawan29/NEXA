/**
 * ============================================================================
 * NEXA CBT — Offline Answer Bundle & Encryption Protocol (.nexa)
 * Supporting Requirements R3, R4 & R5
 * ============================================================================
 */

/**
 * Deterministic Pure-JS Synchronous SHA-256 implementation
 * Compliant with FIPS 180-2, produces byte-identical hash to node:crypto and WebCrypto.
 */
export function sha256Hex(ascii) {
  function r(v, n) { return (v >>> n) | (v << (32 - n)); }
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const bytes = new TextEncoder().encode(ascii);
  const bitLength = bytes.length * 8;
  const newLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(newLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setBigUint64(newLen - 8, BigInt(bitLength));

  for (let offset = 0; offset < newLen; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h0] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h0 + S1 + ch + k[i] + w[i]) | 0;
      const S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h0 = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + h0) | 0;
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/**
 * Computes SHA-256 hex string with WebCrypto / Node crypto or fallback
 */
export async function computeSha256(str) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      const utf8 = new TextEncoder().encode(str);
      const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', utf8);
      return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  return sha256Hex(str);
}

/**
 * Synchronous SHA-256 calculation for non-async contexts
 */
export function computeSha256Sync(str) {
  return sha256Hex(str);
}

/**
 * Creates canonical .nexa emergency offline answer bundle
 * Conforms strictly to cbt_test_helpers.mjs:278
 */
export function createNexaBundle({
  id_log,
  id_jadwal,
  id_siswa,
  nisn = '',
  nama_siswa = '',
  npsn = '',
  jawaban = {},
  pelanggaran = 0
}) {
  const timestamp = new Date().toISOString();
  const canonicalPayload = JSON.stringify({
    magic: 'NEXA_OFFLINE_BUNDLE_V1',
    version: '1.0',
    id_log: String(id_log || ''),
    id_jadwal: String(id_jadwal || ''),
    id_siswa: String(id_siswa || ''),
    nisn: String(nisn || ''),
    nama_siswa: String(nama_siswa || ''),
    npsn: String(npsn || ''),
    pelanggaran: Number(pelanggaran) || 0,
    timestamp,
    jawaban
  });

  const checksum = sha256Hex(canonicalPayload);

  return {
    magic: 'NEXA_OFFLINE_BUNDLE_V1',
    version: '1.0',
    id_log: String(id_log || ''),
    id_jadwal: String(id_jadwal || ''),
    id_siswa: String(id_siswa || ''),
    nisn: String(nisn || ''),
    nama_siswa: String(nama_siswa || ''),
    npsn: String(npsn || ''),
    pelanggaran: Number(pelanggaran) || 0,
    timestamp,
    jawaban,
    checksum
  };
}

/**
 * Encrypts/obfuscates .nexa bundle using XOR keystream + Base64
 * Matching cbt_test_helpers.mjs:317
 */
export function encodeNexaBundle(bundleObj, saltKey = 'NEXA_SECRET_SALT') {
  const jsonStr = JSON.stringify(bundleObj);
  const key = `${saltKey}_${bundleObj.npsn || 'DEFAULT'}_${bundleObj.id_log || 'LOG'}`;
  
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  const keyBytes = new TextEncoder().encode(key);
  const xorBytes = new Uint8Array(utf8Bytes.length);

  for (let i = 0; i < utf8Bytes.length; i++) {
    xorBytes[i] = utf8Bytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // Cross-environment Base64 encoding
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(xorBytes).toString('base64');
  }

  let binary = '';
  for (let i = 0; i < xorBytes.byteLength; i++) {
    binary += String.fromCharCode(xorBytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes and verifies .nexa bundle
 * Matching cbt_test_helpers.mjs:334
 */
export function decodeNexaBundle(encodedStr, saltKey = 'NEXA_SECRET_SALT', bundleNpsn = '', bundleLogId = '') {
  if (!encodedStr || typeof encodedStr !== 'string') {
    throw new Error('Failed to decode .nexa bundle: Empty or invalid input');
  }

  let xorBytes;
  if (typeof Buffer !== 'undefined') {
    xorBytes = Buffer.from(encodedStr, 'base64');
  } else {
    try {
      const binary = atob(encodedStr.trim());
      xorBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        xorBytes[i] = binary.charCodeAt(i);
      }
    } catch (e) {
      throw new Error(`Failed to decode .nexa bundle: Invalid Base64 (${e.message})`);
    }
  }

  // 1. Direct JSON check
  try {
    const rawText = new TextDecoder('utf-8').decode(xorBytes);
    const directObj = JSON.parse(rawText);
    if (directObj && directObj.magic && String(directObj.magic).startsWith('NEXA_OFFLINE_BUNDLE')) {
      return directObj;
    }
  } catch {}

  // 2. Candidate XOR keystreams
  const candidateKeys = [
    `${saltKey}_${bundleNpsn}_${bundleLogId}`,
    `${saltKey}_DEFAULT_LOG`,
    saltKey,
    'DISASTER_SALT'
  ];

  let rawJson = null;

  for (const candKey of candidateKeys) {
    try {
      const keyBuf = new TextEncoder().encode(candKey);
      const decBytes = new Uint8Array(xorBytes.length);
      for (let i = 0; i < xorBytes.length; i++) {
        decBytes[i] = xorBytes[i] ^ keyBuf[i % keyBuf.length];
      }
      const parsedText = new TextDecoder('utf-8').decode(decBytes);
      const parsed = JSON.parse(parsedText);
      if (parsed && parsed.magic && String(parsed.magic).startsWith('NEXA_OFFLINE_BUNDLE')) {
        rawJson = parsed;
        break;
      }
    } catch {}
  }

  if (!rawJson) {
    throw new Error('Failed to decode .nexa bundle: Invalid format or corrupt encryption key');
  }

  return rawJson;
}

/**
 * Cryptographically verifies SHA-256 checksum of bundle
 */
export function verifyNexaBundleChecksum(bundleObj) {
  if (!bundleObj || !bundleObj.checksum) {
    return { valid: false, error: 'Bundle missing checksum' };
  }

  const { checksum, ...rest } = bundleObj;
  const canonicalPayload = JSON.stringify(rest);
  const expectedChecksum = sha256Hex(canonicalPayload);

  const matches = String(checksum).toLowerCase() === String(expectedChecksum).toLowerCase();
  return {
    valid: matches,
    expectedChecksum,
    actualChecksum: checksum,
    error: matches ? null : 'Checksum mismatch: bundle has been tampered with or corrupted'
  };
}

/**
 * Triggers browser download of .nexa encrypted bundle file
 */
export function downloadNexaBundle(bundleObj, filename = null) {
  const nisn = bundleObj.nisn || 'SISWA';
  const idLog = bundleObj.id_log || 'LOG';
  const defaultFilename = `NEXA_JAWABAN_${nisn}_${idLog}.nexa`;
  const finalFilename = filename || defaultFilename;

  const encodedContent = encodeNexaBundle(bundleObj);
  const blob = new Blob([encodedContent], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Evaluates a single AKM question against student answer
 */
export function normalizeTipeSoal(rawTipe) {
  const t = String(rawTipe || 'PG').trim().toUpperCase();
  if (t === 'ISIAN_SINGKAT' || t === 'ISIAN SINGKAT') return 'ISIAN';
  if (t === 'MENJODOHKAN') return 'JODOH';
  if (t === 'BENAR_SALAH' || t === 'BENAR SALAH') return 'BS';
  return t;
}

export function evaluateAKMQuestion(soal, studentAnswer) {
  const tipe = normalizeTipeSoal(soal.tipe_soal);
  const bobot = Number(soal.bobot) || 10;
  let isCorrect = false;
  let skorDiperoleh = 0;

  if (tipe === 'URAIAN') {
    return { isCorrect: false, skorDiperoleh: 0, maxSkor: 0, isEssay: true };
  }

  if (tipe === 'PG' || tipe === 'BS') {
    const key = String(soal.kunci_jawaban || '').trim().toLowerCase();
    const ans = String(studentAnswer || '').trim().toLowerCase();
    isCorrect = ans !== '' && ans === key;
  } else if (tipe === 'PGK') {
    let kunciArr = [];
    try {
      kunciArr = Array.isArray(soal.kunci_jawaban)
        ? soal.kunci_jawaban
        : JSON.parse(soal.kunci_jawaban || '[]');
    } catch {
      kunciArr = String(soal.kunci_jawaban || '').split(',').map(s => s.trim()).filter(Boolean);
    }
    const cleanKunci = kunciArr.map(k => String(k).trim().toLowerCase()).sort();
    const ansArr = Array.isArray(studentAnswer)
      ? studentAnswer.map(a => String(a).trim().toLowerCase()).sort()
      : [];

    isCorrect = ansArr.length > 0 &&
      ansArr.length === cleanKunci.length &&
      ansArr.every((val, idx) => val === cleanKunci[idx]);
  } else if (tipe === 'JODOH') {
    let kunciObj = {};
    try {
      kunciObj = (typeof soal.kunci_jawaban === 'object' && soal.kunci_jawaban !== null)
        ? soal.kunci_jawaban
        : JSON.parse(soal.kunci_jawaban || '{}');
    } catch {
      kunciObj = {};
    }
    const ansObj = (typeof studentAnswer === 'object' && studentAnswer !== null) ? studentAnswer : {};

    const keys = Object.keys(kunciObj);
    if (keys.length > 0) {
      let allMatch = true;
      for (const k of keys) {
        const expected = String(kunciObj[k] || '').trim().toLowerCase();
        const actual = String(ansObj[k] || '').trim().toLowerCase();
        if (!actual || actual !== expected) {
          allMatch = false;
          break;
        }
      }
      isCorrect = allMatch;
    }
  } else if (tipe === 'ISIAN') {
    const key = String(soal.kunci_jawaban || '').trim().toLowerCase();
    const ans = String(studentAnswer || '').trim().toLowerCase();
    isCorrect = ans !== '' && ans === key;
  }

  if (isCorrect) {
    skorDiperoleh = bobot;
  }

  return { isCorrect, skorDiperoleh, maxSkor: bobot, isEssay: false };
}

/**
 * Calculates exam objective score across question array
 */
export function calculateExamScore(questions, answersMap, isBlocked = false) {
  if (isBlocked) {
    return {
      nilaiAuto: 0,
      totalDiperoleh: 0,
      totalMaxAuto: 0,
      details: (questions || []).map(q => ({ id_soal: q.id_soal, isCorrect: false, skorDiperoleh: 0 }))
    };
  }

  let totalSkorMaxAuto = 0;
  let totalSkorDiperolehAuto = 0;
  const details = [];

  for (const q of (questions || [])) {
    if (
      q.tipe_soal === 'NARASI' ||
      q.tipe_soal === 'SKEMA_PENILAIAN' ||
      q.tipe_soal === 'SKEMA_DEFAULT' ||
      q.tipe_soal === 'MAPEL_ALLOC'
    ) {
      continue;
    }
    const studentAns = (answersMap || {})[q.id_soal];
    const res = evaluateAKMQuestion(q, studentAns);
    if (!res.isEssay) {
      totalSkorMaxAuto += res.maxSkor;
      totalSkorDiperolehAuto += res.skorDiperoleh;
    }
    details.push({
      id_soal: q.id_soal,
      isCorrect: res.isCorrect,
      skorDiperoleh: res.skorDiperoleh,
      isEssay: res.isEssay
    });
  }

  let nilaiAuto = 0;
  if (totalSkorMaxAuto > 0) {
    nilaiAuto = Math.round((totalSkorDiperolehAuto / totalSkorMaxAuto) * 10000) / 100;
  }

  return {
    nilaiAuto,
    totalDiperoleh: totalSkorDiperolehAuto,
    totalMaxAuto: totalSkorMaxAuto,
    details
  };
}

/**
 * Generates a random 6-character token
 */
export function generateRandomToken(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Clones schedule parameters with a new random token
 */
export function cloneExamSchedule(sourceSchedule, targetKelas, customToken = null) {
  if (!targetKelas || String(targetKelas).trim() === '') {
    throw new Error('Target kelas is required for cloning schedule');
  }

  const newToken = customToken ? String(customToken).toUpperCase() : generateRandomToken(6);

  return {
    id_jadwal: `SCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    npsn: sourceSchedule.npsn,
    id_mapel: sourceSchedule.id_mapel,
    nama_mapel: sourceSchedule.nama_mapel,
    target_kelas: targetKelas.trim(),
    durasi: sourceSchedule.durasi,
    guru: sourceSchedule.guru,
    id_guru: sourceSchedule.id_guru,
    acak_soal: sourceSchedule.acak_soal ?? true,
    acak_opsi: sourceSchedule.acak_opsi ?? true,
    browser_lockdown: sourceSchedule.browser_lockdown ?? true,
    token_ujian: newToken,
    token_aktif: newToken,
    status_ujian: 'BELUM MULAI',
    waktu_mulai: sourceSchedule.waktu_mulai || new Date().toISOString(),
    waktu_selesai: sourceSchedule.waktu_selesai || null,
    is_cloned: true,
    source_jadwal_id: sourceSchedule.id_jadwal
  };
}
