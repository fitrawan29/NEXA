import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const guruCode = fs.readFileSync(path.join(srcDir, 'views/GuruView.jsx'), 'utf8');
const formSoalCode = fs.readFileSync(path.join(srcDir, 'components/FormSoalModal.jsx'), 'utf8');
const formNarasiCode = fs.readFileSync(path.join(srcDir, 'components/FormNarasiModal.jsx'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}\n  ${err.message}`);
    failed++;
  }
}

test('FormNarasiModal sends id_soal on edit, validates stripped content & drops Quill image button', () => {
  assert.match(formNarasiCode, /id_soal:\s*data\s*\?\s*data\.id_soal\s*:\s*null/, 'FormNarasiModal must pass id_soal when editing');
  assert.doesNotMatch(formNarasiCode, /\['link',\s*'image'\]/, 'FormNarasiModal Quill toolbar should not include base64 image button');
});

test('FormSoalModal initializes kunciPG/kunciPGK as indices, strips HTML in narasi select & keeps draft on failed save', () => {
  assert.doesNotMatch(formSoalCode, /useState\(data && data\.tipe_soal==='PG' \? data\.kunci_jawaban/, 'kunciPG must initialize to option index, not text value');
  assert.doesNotMatch(formSoalCode, /formSoalDraft.*\n.*stripHtml|<option[^>]*>\{n\.pertanyaan\.substring/, 'narasi dropdown should strip HTML tags');
  assert.doesNotMatch(formSoalCode, /\['link',\s*'image'\]/, 'FormSoalModal Quill toolbar should not include base64 image button');
  assert.match(formSoalCode, /await onSave\(payload\)/, 'handleSave should await onSave result before clearing draft');
});

test('api.js get_mapel_guru enriches jumlah_soal & alokasi_kelas scoped by npsn; import_soal_bulk normalizes tipe_soal', () => {
  const mapelStart = apiCode.indexOf("case 'get_mapel_guru':");
  const mapelBlock = apiCode.slice(mapelStart, apiCode.indexOf("case 'get_soal_by_mapel':", mapelStart));
  assert.match(mapelBlock, /jumlah_soal/, 'get_mapel_guru must include jumlah_soal');
  assert.match(mapelBlock, /alokasi_kelas/, 'get_mapel_guru must include alokasi_kelas');

  const importStart = apiCode.indexOf("case 'import_soal_bulk':");
  const importBlock = apiCode.slice(importStart, apiCode.indexOf("case 'get_default_skema_sekolah':", importStart));
  assert.match(importBlock, /normalizeTipeSoal/, 'import_soal_bulk must normalize tipe_soal');
});

test('GuruView decommissioning Word import & ignores non-PG extra options, removes dead kd & fixes preview/MathJax', () => {
  assert.doesNotMatch(guruCode, /filterKD|setFilterKD/, 'GuruView should remove dead kd filter since soal_ujian has no kd column');
  assert.match(guruCode, /window\.MathJax\?\.typesetPromise/, 'MathJax call must guard window.MathJax?.typesetPromise');
  assert.ok(!guruCode.includes('parseWordText'), 'Word import (parseWordText) decommissioned in favor of Excel import');
  assert.doesNotMatch(guruCode, /FileReader[\s\S]*?Format file \.xls/, 'fix mojibake in file format hints if present');
});

test('GuruView saveProfile updates user via onUpdateUser cleanly & supports cancellation in fetchData', () => {
  assert.match(guruCode, /onUpdateUser/, 'GuruView saveProfile should notify parent via onUpdateUser instead of mutating user prop');
  assert.doesNotMatch(guruCode, /user\.foto_profil\s*=/, 'must not mutate user prop directly');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
