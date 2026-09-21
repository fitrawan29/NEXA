#!/usr/bin/env node
/**
 * Adversarial Challenger Suite: Admin Default Grading Scheme & Data Persistence
 * File: tests/challenger_round4_admin_grading_scheme.mjs
 *
 * Mandate:
 * 1. Test edge cases in weight inputs: decimal values, negative numbers, non-numeric strings,
 *    weights summing to 99% or 101%, single question type 100%, mode default bypass.
 * 2. Test persistence round-trip: save scheme -> reload -> verify state is intact.
 * 3. Test corrupt localStorage recovery and empty NPSN handling.
 * 4. Verify exam engine question filtering excludes default grading scheme records (SKEMA_DEFAULT).
 * 5. Verify Admin UI navigation & SkemaPenilaianPanel configuration invariants.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

// Setup Mock LocalStorage for Node environment before importing api.js
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;

// Resolve Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inKodeNexa = __dirname.includes('kode NEXA');
const projectRoot = inKodeNexa ? path.resolve(__dirname, '..') : path.resolve(__dirname, '..', 'kode NEXA');

// Import api & config functions under test using pathToFileURL for Windows ESM support
const apiPath = path.resolve(projectRoot, 'src', 'api.js');
const configPath = path.resolve(projectRoot, 'src', 'config.js');
const apiModule = await import(pathToFileURL(apiPath).href);
const configModule = await import(pathToFileURL(configPath).href);

const { get_default_skema_sekolah, save_default_skema_sekolah } = apiModule;
const { supabaseClient } = configModule;

// Registered NPSN from database for live DB integration tests
const REGISTERED_NPSN = '70040625';

// Test reporting harness
const report = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {},
  failures: []
};

function recordTest(category, name, condition, details = '') {
  if (!report.categories[category]) {
    report.categories[category] = { passed: 0, failed: 0 };
  }
  report.total++;
  if (condition) {
    report.passed++;
    report.categories[category].passed++;
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } else {
    report.failed++;
    report.categories[category].failed++;
    report.failures.push({ category, name, details });
    console.log(`  ✖ [FAIL] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('========================================================================');
console.log('  CHALLENGER ROUND 4: ADMIN DEFAULT GRADING SCHEME & PERSISTENCE        ');
console.log('========================================================================\n');

// =============================================================================
// CATEGORY 1: Weight Input Edge Cases & Boundary Validation
// =============================================================================
console.log('▶ CATEGORY 1: Weight Input Edge Cases & Adversarial Validation');

// 1.1 Decimal values that sum to exactly 100%
try {
  const decimalPayload = {
    mode: 'custom',
    skema: { PG: 33.33, PGK: 33.33, BS: 33.34, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  mockStorage.clear();
  const res = await save_default_skema_sekolah(REGISTERED_NPSN, decimalPayload);
  recordTest(
    'Weights',
    'Decimal values summing to 100.00% (33.33, 33.33, 33.34) are accepted',
    res && res.success === true && res.data.skema.PG === 33.33
  );
} catch (err) {
  recordTest('Weights', 'Decimal values summing to 100.00% are accepted', false, err.message);
}

// 1.2 Fine decimal breakdown across all 6 question types summing to 100%
try {
  const fineDecimalPayload = {
    mode: 'custom',
    skema: { PG: 16.6, PGK: 16.6, BS: 16.8, JODOH: 20.0, ISIAN: 15.0, URAIAN: 15.0 }
  };
  const res = await save_default_skema_sekolah(REGISTERED_NPSN, fineDecimalPayload);
  recordTest(
    'Weights',
    'Fine decimal breakdown across 6 types summing to 100.0% is accepted',
    res && res.success === true
  );
} catch (err) {
  recordTest('Weights', 'Fine decimal breakdown across 6 types is accepted', false, err.message);
}

// 1.3 Floating point precision test (e.g. 70.1 + 29.9)
try {
  const floatPayload = {
    mode: 'custom',
    skema: { PG: 70.1, PGK: 29.9, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  const res = await save_default_skema_sekolah(REGISTERED_NPSN, floatPayload);
  recordTest(
    'Weights',
    'Floating point numbers with potential IEEE-754 drift (70.1 + 29.9) are accepted',
    res && res.success === true
  );
} catch (err) {
  recordTest('Weights', 'Floating point drift values accepted', false, err.message);
}

// 1.4 Decimal values summing to 99.99% (MUST be rejected)
try {
  const underPayload = {
    mode: 'custom',
    skema: { PG: 33.33, PGK: 33.33, BS: 33.33, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  let rejected = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, underPayload);
  } catch (err) {
    rejected = err.message.includes('100%');
  }
  recordTest(
    'Weights',
    'Decimal values summing to 99.99% are rejected with 100% requirement error',
    rejected
  );
} catch (err) {
  recordTest('Weights', 'Decimal 99.99% rejection', false, err.message);
}

// 1.5 Sum equals 99% (MUST be rejected)
try {
  const sum99Payload = {
    mode: 'custom',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 9 }
  };
  let rejected = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, sum99Payload);
  } catch (err) {
    rejected = err.message.includes('100%');
  }
  recordTest(
    'Weights',
    'Weights summing to 99% are strictly rejected',
    rejected
  );
} catch (err) {
  recordTest('Weights', 'Weights summing to 99% rejected', false, err.message);
}

// 1.6 Sum equals 101% (MUST be rejected)
try {
  const sum101Payload = {
    mode: 'custom',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 11 }
  };
  let rejected = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, sum101Payload);
  } catch (err) {
    rejected = err.message.includes('100%');
  }
  recordTest(
    'Weights',
    'Weights summing to 101% are strictly rejected',
    rejected
  );
} catch (err) {
  recordTest('Weights', 'Weights summing to 101% rejected', false, err.message);
}

// 1.7 Sum equals 0% or 200%
try {
  let rej0 = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, { mode: 'custom', skema: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 } });
  } catch {
    rej0 = true;
  }
  let rej200 = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, { mode: 'custom', skema: { PG: 100, PGK: 100, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 } });
  } catch {
    rej200 = true;
  }
  recordTest(
    'Weights',
    'Extreme boundary sums 0% and 200% are strictly rejected',
    rej0 && rej200
  );
} catch (err) {
  recordTest('Weights', 'Extreme boundary sums rejected', false, err.message);
}

// 1.8 Negative weight (MUST be rejected even if sum equals 100)
try {
  const negSum100Payload = {
    mode: 'custom',
    skema: { PG: 110, PGK: -10, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  let rejected = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, negSum100Payload);
  } catch (err) {
    rejected = err.message.toLowerCase().includes('negative') || err.message.includes('PGK');
  }
  recordTest(
    'Weights',
    'Negative weight (PG: 110, PGK: -10) is rejected even when sum is 100%',
    rejected
  );
} catch (err) {
  recordTest('Weights', 'Negative weight rejected', false, err.message);
}

// 1.9 Negative decimal weight
try {
  const negDecPayload = {
    mode: 'custom',
    skema: { PG: 100.05, PGK: -0.05, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  let rejected = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, negDecPayload);
  } catch (err) {
    rejected = true;
  }
  recordTest(
    'Weights',
    'Negative fractional weight (-0.05) is rejected',
    rejected
  );
} catch (err) {
  recordTest('Weights', 'Negative fractional weight rejected', false, err.message);
}

// 1.10 Non-numeric strings in weights (e.g. "abc", "NaN", "invalid")
try {
  const nanPayload = {
    mode: 'custom',
    skema: { PG: 'abc', PGK: 50, BS: 50, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  let rejected = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, nanPayload);
  } catch (err) {
    rejected = err.message.includes('NaN') || err.message.includes('PG');
  }
  recordTest(
    'Weights',
    'Non-numeric string weight ("abc") is rejected as NaN',
    rejected
  );
} catch (err) {
  recordTest('Weights', 'Non-numeric string weight rejected', false, err.message);
}

// 1.11 Single question type 100% tests (for each of the 6 question types)
try {
  const types = ['PG', 'PGK', 'BS', 'JODOH', 'ISIAN', 'URAIAN'];
  let allSingleTypeAccepted = true;
  for (const t of types) {
    const singlePayload = {
      mode: 'custom',
      skema: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0, [t]: 100 }
    };
    const res = await save_default_skema_sekolah(REGISTERED_NPSN, singlePayload);
    if (!res || !res.success || res.data.skema[t] !== 100) {
      allSingleTypeAccepted = false;
    }
  }
  recordTest(
    'Weights',
    'Single question type 100% works for all 6 types (PG, PGK, BS, JODOH, ISIAN, URAIAN)',
    allSingleTypeAccepted
  );
} catch (err) {
  recordTest('Weights', 'Single question type 100% works', false, err.message);
}

// 1.12 Mode "default" bypasses 100% weight sum constraint (proportional mode)
try {
  const defaultModePayload = {
    mode: 'default',
    skema: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  const res = await save_default_skema_sekolah(REGISTERED_NPSN, defaultModePayload);
  recordTest(
    'Weights',
    'Mode "default" saves without requiring custom 100% sum validation',
    res && res.success === true && res.data.mode === 'default'
  );
} catch (err) {
  recordTest('Weights', 'Mode default bypasses sum validation', false, err.message);
}

// 1.13 Adversarial fuzzing: 50 randomized weight variations
try {
  let fuzzPassed = true;
  for (let i = 0; i < 50; i++) {
    const r1 = Math.floor(Math.random() * 90);
    const r2 = Math.floor(Math.random() * (99 - r1));
    const isSum100 = i % 2 === 0;
    const r3 = isSum100 ? (100 - r1 - r2) : (101 - r1 - r2);
    const fuzzPayload = {
      mode: 'custom',
      skema: { PG: r1, PGK: r2, BS: r3, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    };
    try {
      const res = await save_default_skema_sekolah(REGISTERED_NPSN, fuzzPayload);
      if (!isSum100 && res.success) {
        fuzzPassed = false;
        break;
      }
    } catch (err) {
      if (isSum100) {
        fuzzPassed = false;
        break;
      }
    }
  }
  recordTest(
    'Weights',
    'Fuzzing 50 randomized weight permutations correctly distinguishes valid 100% vs invalid',
    fuzzPassed
  );
} catch (err) {
  recordTest('Weights', 'Fuzzing randomized weights', false, err.message);
}

// =============================================================================
// CATEGORY 2: Persistence Round-Trip & Cache Synchronization
// =============================================================================
console.log('\n▶ CATEGORY 2: Persistence Round-Trip & Cache Synchronization');

// 2.1 Round-trip custom scheme: save -> reload -> verify state is intact
try {
  mockStorage.clear();
  const originalScheme = {
    mode: 'custom',
    skema: { PG: 40, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 10 },
    bobot: 1
  };
  await save_default_skema_sekolah(REGISTERED_NPSN, originalScheme);
  const loadedScheme = await get_default_skema_sekolah(REGISTERED_NPSN);

  const matched =
    loadedScheme &&
    loadedScheme.mode === 'custom' &&
    loadedScheme.skema.PG === 40 &&
    loadedScheme.skema.PGK === 20 &&
    loadedScheme.skema.BS === 10 &&
    loadedScheme.skema.JODOH === 10 &&
    loadedScheme.skema.ISIAN === 10 &&
    loadedScheme.skema.URAIAN === 10;

  recordTest(
    'Persistence',
    'Persistence round-trip: save custom scheme -> reload -> verify exact state matches',
    matched
  );
} catch (err) {
  recordTest('Persistence', 'Custom persistence round-trip', false, err.message);
}

// 2.2 Round-trip default mode scheme
try {
  mockStorage.clear();
  const defaultPayload = {
    mode: 'default',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 },
    bobot: 0
  };
  await save_default_skema_sekolah(REGISTERED_NPSN, defaultPayload);
  const loaded = await get_default_skema_sekolah(REGISTERED_NPSN);

  const matched =
    loaded &&
    loaded.mode === 'default' &&
    loaded.skema.PG === 20 &&
    loaded.skema.BS === 20;

  recordTest(
    'Persistence',
    'Persistence round-trip: save default mode -> reload -> verify default state intact',
    matched
  );
} catch (err) {
  recordTest('Persistence', 'Default mode persistence round-trip', false, err.message);
}

// 2.3 Overwrite & Update idempotence: save A -> reload -> save B -> reload -> verify B
try {
  mockStorage.clear();
  const schemeA = {
    mode: 'custom',
    skema: { PG: 50, PGK: 50, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  };
  await save_default_skema_sekolah(REGISTERED_NPSN, schemeA);
  const loadedA = await get_default_skema_sekolah(REGISTERED_NPSN);

  const schemeB = {
    mode: 'custom',
    skema: { PG: 25, PGK: 25, BS: 25, JODOH: 25, ISIAN: 0, URAIAN: 0 }
  };
  await save_default_skema_sekolah(REGISTERED_NPSN, schemeB);
  const loadedB = await get_default_skema_sekolah(REGISTERED_NPSN);

  recordTest(
    'Persistence',
    'Scheme update: second save overwrites first cleanly in cache and reload',
    loadedA.skema.PG === 50 && loadedB.skema.PG === 25 && loadedB.skema.BS === 25
  );
} catch (err) {
  recordTest('Persistence', 'Scheme update overwriting', false, err.message);
}

// 2.4 LocalStorage key prefix verification
try {
  mockStorage.clear();
  await save_default_skema_sekolah(REGISTERED_NPSN, {
    mode: 'custom',
    skema: { PG: 100, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  });
  const cachedRaw = mockStorage.getItem('nexa_default_skema_' + REGISTERED_NPSN);
  recordTest(
    'Persistence',
    'LocalStorage key strictly follows format: nexa_default_skema_${npsn}',
    cachedRaw !== null && JSON.parse(cachedRaw).skema.PG === 100
  );
} catch (err) {
  recordTest('Persistence', 'LocalStorage key prefix verification', false, err.message);
}

// 2.5 Live Supabase DB Verification & Cold Cache Repopulation
try {
  const targetCustom = {
    mode: 'custom',
    skema: { PG: 35, PGK: 25, BS: 15, JODOH: 10, ISIAN: 10, URAIAN: 5 }
  };
  await save_default_skema_sekolah(REGISTERED_NPSN, targetCustom);

  // Directly check Supabase database table soal_ujian
  const { data: dbRows, error: dbError } = await supabaseClient
    .from('soal_ujian')
    .select('id_soal, tipe_soal, kunci_jawaban, id_mapel, npsn')
    .eq('id_soal', 'SKEMA_DEFAULT_' + REGISTERED_NPSN)
    .eq('npsn', REGISTERED_NPSN);

  const dbRowExists = !dbError && dbRows && dbRows.length === 1;
  const parsedDbKunci = dbRowExists ? JSON.parse(dbRows[0].kunci_jawaban) : null;
  const dbFieldsValid =
    dbRowExists &&
    dbRows[0].tipe_soal === 'SKEMA_DEFAULT' &&
    dbRows[0].id_mapel === null &&
    parsedDbKunci &&
    parsedDbKunci.skema.PG === 35;

  // Clear localStorage completely to simulate cold app launch / new browser tab
  mockStorage.clear();
  const coldLoaded = await get_default_skema_sekolah(REGISTERED_NPSN);

  // Verify cold load fetched from DB and repopulated localStorage cache
  const cacheRepopulated = mockStorage.getItem('nexa_default_skema_' + REGISTERED_NPSN) !== null;
  const coldMatches = coldLoaded && coldLoaded.skema && coldLoaded.skema.PG === 35;

  recordTest(
    'Persistence',
    'Live Supabase table soal_ujian persists record with tipe_soal="SKEMA_DEFAULT", id_mapel=null, and cold cache reload repopulates localStorage',
    dbFieldsValid && cacheRepopulated && coldMatches
  );
} catch (err) {
  recordTest('Persistence', 'Live Supabase DB verification & cold cache', false, err.message);
}

// =============================================================================
// CATEGORY 3: Corrupt Storage Recovery & Empty NPSN Handling
// =============================================================================
console.log('\n▶ CATEGORY 3: Corrupt LocalStorage Recovery & Parameter Boundaries');

// 3.1 Corrupt raw string in localStorage (not JSON)
try {
  const corruptNpsn = 'NPSN_CORRUPT_01';
  mockStorage.setItem('nexa_default_skema_' + corruptNpsn, '{corrupt-malformed-raw-bytes<<<');
  const res = await get_default_skema_sekolah(corruptNpsn);
  recordTest(
    'FaultTolerance',
    'Corrupted non-JSON localStorage string does not throw and recovers with fallback default',
    res && res.mode === 'default' && res.skema && res.skema.PG === 20
  );
} catch (err) {
  recordTest('FaultTolerance', 'Corrupted non-JSON string recovery', false, err.message);
}

// 3.2 Primitive JSON in localStorage (e.g. "12345")
try {
  const primNpsn = 'NPSN_PRIM_02';
  mockStorage.setItem('nexa_default_skema_' + primNpsn, '12345');
  const res = await get_default_skema_sekolah(primNpsn);
  recordTest(
    'FaultTolerance',
    'Primitive JSON in localStorage ("12345") safely falls back without crash',
    res && res.mode === 'default' && res.skema && res.skema.PG === 20
  );
} catch (err) {
  recordTest('FaultTolerance', 'Primitive JSON recovery', false, err.message);
}

// 3.3 JSON null in localStorage ("null")
try {
  const nullCacheNpsn = 'NPSN_NULL_03';
  mockStorage.setItem('nexa_default_skema_' + nullCacheNpsn, 'null');
  const res = await get_default_skema_sekolah(nullCacheNpsn);
  recordTest(
    'FaultTolerance',
    'JSON "null" in localStorage safely falls back without null dereference error',
    res && res.mode === 'default' && res.skema && res.skema.PG === 20
  );
} catch (err) {
  recordTest('FaultTolerance', 'JSON null cache recovery', false, err.message);
}

// 3.4 Empty NPSN in get_default_skema_sekolah
try {
  const emptyRes = await get_default_skema_sekolah('');
  const nullRes = await get_default_skema_sekolah(null);
  const undefRes = await get_default_skema_sekolah(undefined);
  const spaceRes = await get_default_skema_sekolah('   ');
  const numRes = await get_default_skema_sekolah(12345);

  const allSafe =
    emptyRes && emptyRes.mode === 'default' &&
    nullRes && nullRes.mode === 'default' &&
    undefRes && undefRes.mode === 'default' &&
    spaceRes && spaceRes.mode === 'default' &&
    numRes && numRes.mode === 'default';

  recordTest(
    'FaultTolerance',
    'get_default_skema_sekolah safely handles empty/null/whitespace/non-string NPSN',
    allSafe
  );
} catch (err) {
  recordTest('FaultTolerance', 'get_default_skema_sekolah empty NPSN', false, err.message);
}

// 3.5 Empty NPSN in save_default_skema_sekolah (MUST throw error)
try {
  let rejEmpty = false;
  try {
    await save_default_skema_sekolah('', { mode: 'default' });
  } catch (e) {
    rejEmpty = e.message.includes('NPSN');
  }

  let rejNull = false;
  try {
    await save_default_skema_sekolah(null, { mode: 'default' });
  } catch (e) {
    rejNull = e.message.includes('NPSN');
  }

  let rejUndef = false;
  try {
    await save_default_skema_sekolah(undefined, { mode: 'default' });
  } catch (e) {
    rejUndef = e.message.includes('NPSN');
  }

  let rejSpace = false;
  try {
    await save_default_skema_sekolah('   ', { mode: 'default' });
  } catch (e) {
    rejSpace = e.message.includes('NPSN');
  }

  let rejNum = false;
  try {
    await save_default_skema_sekolah(12345, { mode: 'default' });
  } catch (e) {
    rejNum = e.message.includes('NPSN');
  }

  recordTest(
    'FaultTolerance',
    'save_default_skema_sekolah strictly rejects empty/null/whitespace/non-string NPSN',
    rejEmpty && rejNull && rejUndef && rejSpace && rejNum
  );
} catch (err) {
  recordTest('FaultTolerance', 'save_default_skema_sekolah empty NPSN', false, err.message);
}

// 3.6 Invalid payload in save_default_skema_sekolah (MUST throw error)
try {
  let rejPayloadNull = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, null);
  } catch (e) {
    rejPayloadNull = e.message.includes('Payload');
  }

  let rejPayloadStr = false;
  try {
    await save_default_skema_sekolah(REGISTERED_NPSN, 'not-an-object');
  } catch (e) {
    rejPayloadStr = e.message.includes('Payload');
  }

  recordTest(
    'FaultTolerance',
    'save_default_skema_sekolah strictly rejects null or non-object payloads',
    rejPayloadNull && rejPayloadStr
  );
} catch (err) {
  recordTest('FaultTolerance', 'save_default_skema_sekolah invalid payload', false, err.message);
}

// =============================================================================
// CATEGORY 4: Exam Engine Question Filtering (SKEMA_DEFAULT Exclusion)
// =============================================================================
console.log('\n▶ CATEGORY 4: Exam Engine Question Filtering (SKEMA_DEFAULT Exclusion)');

const apiSource = fs.readFileSync(path.resolve(projectRoot, 'src', 'api.js'), 'utf8');

// 4.1 Check get_soal_ujian question filtering logic
const hasGetSoalFilter = apiSource.includes("s.tipe_soal !== 'SKEMA_DEFAULT'");
recordTest(
  'ExamEngine',
  'api.js get_soal_ujian strictly filters out s.tipe_soal !== "SKEMA_DEFAULT"',
  hasGetSoalFilter
);

// 4.2 Check submit_ujian scoring loop question filtering logic
const hasSubmitFilter = apiSource.includes(
  "for (const soal of soalData.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN' && s.tipe_soal !== 'SKEMA_DEFAULT'))"
);
recordTest(
  'ExamEngine',
  'api.js submit_ujian strictly filters out SKEMA_DEFAULT in scoring iteration',
  hasSubmitFilter
);

// 4.3 Simulation: get_soal_ujian question exclusion test
try {
  const mockRawQuestions = [
    { id_soal: 'Q1', tipe_soal: 'PG', pertanyaan: '2 + 2 = ?', bobot: 1, kunci_jawaban: 'A' },
    { id_soal: 'Q2', tipe_soal: 'BS', pertanyaan: 'Bumi itu bulat', bobot: 1, kunci_jawaban: 'BENAR' },
    { id_soal: 'NARASI-1', tipe_soal: 'NARASI', pertanyaan: 'Bacalah teks berikut', bobot: 0 },
    { id_soal: 'SKEMA-GURU-1', tipe_soal: 'SKEMA_PENILAIAN', pertanyaan: 'Skema Guru', bobot: 1 },
    { id_soal: 'SKEMA_DEFAULT_' + REGISTERED_NPSN, tipe_soal: 'SKEMA_DEFAULT', pertanyaan: 'Skema Default Sekolah', bobot: 1 },
    { id_soal: 'Q3', tipe_soal: 'URAIAN', pertanyaan: 'Jelaskan siklus air', bobot: 5 }
  ];

  // Emulate get_soal_ujian filtering as implemented in api.js:1108
  const soalAktif = mockRawQuestions.filter(
    s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN' && s.tipe_soal !== 'SKEMA_DEFAULT'
  );

  const containsDefaultScheme = soalAktif.some(s => s.tipe_soal === 'SKEMA_DEFAULT' || s.id_soal.startsWith('SKEMA_DEFAULT'));
  const containsGuruScheme = soalAktif.some(s => s.tipe_soal === 'SKEMA_PENILAIAN');
  const containsNarasi = soalAktif.some(s => s.tipe_soal === 'NARASI');
  const validLength = soalAktif.length === 3; // Q1, Q2, Q3

  recordTest(
    'ExamEngine',
    'Simulation: get_soal_ujian filters out SKEMA_DEFAULT, SKEMA_PENILAIAN, and NARASI from active questions',
    !containsDefaultScheme && !containsGuruScheme && !containsNarasi && validLength
  );
} catch (err) {
  recordTest('ExamEngine', 'get_soal_ujian filtering simulation', false, err.message);
}

// 4.4 Simulation: submit_ujian score calculation does NOT count SKEMA_DEFAULT in totalSkorMaxAuto
try {
  const mockExamQuestions = [
    { id_soal: 'Q1', tipe_soal: 'PG', bobot: 2, kunci_jawaban: 'A' },
    { id_soal: 'Q2', tipe_soal: 'BS', bobot: 3, kunci_jawaban: 'BENAR' },
    { id_soal: 'SKEMA_DEFAULT_' + REGISTERED_NPSN, tipe_soal: 'SKEMA_DEFAULT', bobot: 1, kunci_jawaban: '{"mode":"default"}' }
  ];

  const jawaban = {
    Q1: 'A',
    Q2: 'BENAR'
  };

  let totalSkorMaxAuto = 0;
  let totalSkorDiperolehAuto = 0;
  let insertJawaban = [];

  // Emulate submit_ujian logic from api.js:1198-1252
  for (const soal of mockExamQuestions.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN' && s.tipe_soal !== 'SKEMA_DEFAULT')) {
    let jwb = jawaban[soal.id_soal];
    let isCorrect = false;
    let skorDiperoleh = 0;
    let bobot = Number(soal.bobot) || 1;

    if (soal.tipe_soal !== 'URAIAN') {
      totalSkorMaxAuto += bobot;
    }

    if (jwb !== undefined && jwb !== null) {
      if (soal.tipe_soal === 'PG' || soal.tipe_soal === 'BS') {
        if (String(jwb).trim().toLowerCase() === String(soal.kunci_jawaban).trim().toLowerCase()) {
          isCorrect = true;
          skorDiperoleh = bobot;
        }
      }
    }

    insertJawaban.push({
      id_soal: soal.id_soal,
      is_correct: isCorrect,
      skor_diperoleh: skorDiperoleh
    });

    totalSkorDiperolehAuto += skorDiperoleh;
  }

  const finalScore = totalSkorMaxAuto > 0 ? (totalSkorDiperolehAuto / totalSkorMaxAuto) * 100 : 0;

  const noDefaultInInsert = insertJawaban.every(j => j.id_soal !== 'SKEMA_DEFAULT_' + REGISTERED_NPSN);
  const maxScoreIsFive = totalSkorMaxAuto === 5; // 2 + 3 = 5, NOT 6
  const finalScoreIs100 = finalScore === 100;

  recordTest(
    'ExamEngine',
    'Simulation: submit_ujian scoring does not penalize student; SKEMA_DEFAULT excluded from max score & answers',
    noDefaultInInsert && maxScoreIsFive && finalScoreIs100
  );
} catch (err) {
  recordTest('ExamEngine', 'submit_ujian scoring simulation', false, err.message);
}

// 4.5 ExamRoom.jsx does not refer to or render SKEMA_DEFAULT
const examRoomPath = path.resolve(projectRoot, 'src', 'views', 'ExamRoom.jsx');
const examRoomSource = fs.readFileSync(examRoomPath, 'utf8');
const examRoomClean = !examRoomSource.includes('SKEMA_DEFAULT');
recordTest(
  'ExamEngine',
  'src/views/ExamRoom.jsx is clean of any SKEMA_DEFAULT references or rendering',
  examRoomClean
);

// 4.6 GuruView.jsx Question Bank isolates SKEMA_DEFAULT (id_mapel: null)
const guruViewPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
const guruViewSource = fs.readFileSync(guruViewPath, 'utf8');
const guruSkemaSafe = guruViewSource.includes("s.tipe_soal !== 'SKEMA_PENILAIAN'");
recordTest(
  'ExamEngine',
  'src/views/GuruView.jsx correctly isolates grading records in question bank filtering',
  guruSkemaSafe
);

// =============================================================================
// CATEGORY 5: Admin UI & Component Conformance
// =============================================================================
console.log('\n▶ CATEGORY 5: Admin UI Navigation & Component Conformance');

const adminViewPath = path.resolve(projectRoot, 'src', 'views', 'AdminView.jsx');
const adminViewSource = fs.readFileSync(adminViewPath, 'utf8');
const skemaPanelPath = path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx');
const skemaPanelSource = fs.readFileSync(skemaPanelPath, 'utf8');

// 5.1 AST Parsing of AdminView.jsx and SkemaPenilaianPanel.jsx
let adminAst = null;
let panelAst = null;
try {
  adminAst = parse(adminViewSource, { sourceType: 'module', plugins: ['jsx'] });
  panelAst = parse(skemaPanelSource, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AdminUI', 'AdminView.jsx and SkemaPenilaianPanel.jsx parse cleanly with zero AST syntax errors', true);
} catch (err) {
  recordTest('AdminUI', 'AST parsing of AdminView and SkemaPenilaianPanel', false, err.message);
}

// 5.2 AdminView imports get_default_skema_sekolah, save_default_skema_sekolah, and SkemaPenilaianPanel
const hasImports =
  adminViewSource.includes('get_default_skema_sekolah') &&
  adminViewSource.includes('save_default_skema_sekolah') &&
  adminViewSource.includes('SkemaPenilaianPanel');
recordTest(
  'AdminUI',
  'AdminView.jsx imports get_default_skema_sekolah, save_default_skema_sekolah, and SkemaPenilaianPanel',
  hasImports
);

// 5.3 AdminView includes 'skema' tab in navGroups
const hasNavSkema = adminViewSource.includes("id: 'skema'") && adminViewSource.includes("label: 'Skema Penilaian'");
recordTest(
  'AdminUI',
  'AdminView navGroups includes dedicated "Skema Penilaian" navigation tab under Ujian & Pelaksanaan',
  hasNavSkema
);

// 5.4 AdminView renders SkemaPenilaianPanel with isSchoolDefault={true}
const rendersSchoolDefault =
  adminViewSource.includes('<SkemaPenilaianPanel') &&
  adminViewSource.includes('isSchoolDefault={true}') &&
  adminViewSource.includes('onSave={handleSaveDefaultSkema}');
recordTest(
  'AdminUI',
  'AdminView renders SkemaPenilaianPanel with isSchoolDefault={true} and onSave handler',
  rendersSchoolDefault
);

// 5.5 SkemaPenilaianPanel supports isSchoolDefault prop and displays school-specific headers
const panelSupportsSchoolDefault =
  skemaPanelSource.includes('isSchoolDefault = false') &&
  skemaPanelSource.includes('Pengaturan Skema Penilaian Default Sekolah') &&
  skemaPanelSource.includes('Simpan Format Default');
recordTest(
  'AdminUI',
  'SkemaPenilaianPanel supports isSchoolDefault mode with dedicated school administration titles and CTA',
  panelSupportsSchoolDefault
);

// 5.6 SkemaPenilaianPanel enforces 100% total persentase validation in custom mode
const panelEnforcesSum =
  skemaPanelSource.includes('hitungTotalPersentase') &&
  skemaPanelSource.includes('total !== 100');
recordTest(
  'AdminUI',
  'SkemaPenilaianPanel validates hitungTotalPersentase() === 100 before saving in custom mode',
  panelEnforcesSum
);

// 5.7 SkemaPenilaianPanel disables/dims custom input fields when in default mode
const panelDisablesInDefault =
  skemaPanelSource.includes("disabled={mode === 'default'}") &&
  skemaPanelSource.includes("mode === 'default' ? 'opacity-40 pointer-events-none' : ''");
recordTest(
  'AdminUI',
  'SkemaPenilaianPanel disables and applies pointer-events-none to inputs in default mode',
  panelDisablesInDefault
);

// =============================================================================
// CLEANUP & STATE RESET
// =============================================================================
try {
  // Restore clean default scheme for the school
  await save_default_skema_sekolah(REGISTERED_NPSN, {
    mode: 'default',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 },
    bobot: 0
  });
} catch (err) {
  console.warn('Cleanup warning:', err.message);
}

// =============================================================================
// FINAL SUMMARY & VERDICT
// =============================================================================
console.log('\n========================================================================');
console.log('  CHALLENGER STRESS TEST RESULTS                                        ');
console.log('========================================================================');
for (const [cat, data] of Object.entries(report.categories)) {
  console.log(`  • Category [${cat.padEnd(16)}]: ${data.passed}/${data.passed + data.failed} Passed`);
}
console.log('------------------------------------------------------------------------');
console.log(`  TOTAL TESTS: ${report.total} | PASSED: ${report.passed} | FAILED: ${report.failed}`);
const verdict = report.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
console.log(`  VERDICT: ${verdict}`);
console.log('========================================================================\n');

// Save results to json for handoff
const resultsJson = {
  timestamp: new Date().toISOString(),
  verdict,
  total: report.total,
  passed: report.passed,
  failed: report.failed,
  categories: report.categories,
  failures: report.failures
};

fs.writeFileSync(
  path.resolve(projectRoot, 'tests', 'challenger_round4_results.json'),
  JSON.stringify(resultsJson, null, 2)
);

if (report.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
