import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const guruCode = fs.readFileSync(path.join(srcDir, 'views/GuruView.jsx'), 'utf8');
const modalUraianCode = fs.readFileSync(path.join(srcDir, 'components/ModalPeriksaUraian.jsx'), 'utf8');
const skemaPanelCode = fs.readFileSync(path.join(srcDir, 'components/SkemaPenilaianPanel.jsx'), 'utf8');

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

test('GuruView calls get_hasil_ujian in openDetailHasil & get_analisis_soal in openAnalisisSoal', () => {
  const detailStart = guruCode.indexOf('const openDetailHasil');
  const detailBlock = guruCode.slice(detailStart, guruCode.indexOf('const openAnalisisSoal', detailStart));
  assert.match(detailBlock, /get_hasil_ujian/, 'openDetailHasil must call get_hasil_ujian, not monitoring_ujian');
  assert.doesNotMatch(detailBlock, /monitoring_ujian/, 'openDetailHasil must not call monitoring_ujian');

  const analisisStart = guruCode.indexOf('const openAnalisisSoal');
  const analisisBlock = guruCode.slice(analisisStart, guruCode.indexOf('const openModalUraian', analisisStart));
  assert.match(analisisBlock, /get_analisis_soal/, 'openAnalisisSoal must call get_analisis_soal');
  assert.doesNotMatch(analisisBlock, /get_analisis_butir_soal/, 'get_analisis_butir_soal does not exist in api.js');
});

test('api.js get_jawaban_uraian includes bobot, get_analisis_soal excludes metadata, get_hasil_ujian includes kelas & weighted total', () => {
  const jwbBlock = apiCode.slice(apiCode.indexOf("case 'get_jawaban_uraian':"), apiCode.indexOf("case 'update_nilai_uraian':"));
  assert.match(jwbBlock, /soal_ujian\([^)]*bobot/, 'get_jawaban_uraian must select bobot');

  const analisisStart = apiCode.indexOf("case 'get_analisis_soal':");
  const analisisBlock = apiCode.slice(analisisStart, apiCode.indexOf("case 'get_audit_log':", analisisStart));
  assert.match(analisisBlock, /SKEMA_PENILAIAN|NARASI/, 'get_analisis_soal must exclude metadata rows');

  const hasilStart = apiCode.indexOf("case 'get_hasil_ujian':");
  const hasilBlock = apiCode.slice(hasilStart, apiCode.indexOf("case 'buka_blokir':", hasilStart));
  assert.match(hasilBlock, /kelas/, 'get_hasil_ujian must return siswa kelas');
  assert.match(hasilBlock, /SKEMA_PENILAIAN|computeWeightedExamScores|totalNilai/, 'get_hasil_ujian must apply SKEMA_PENILAIAN weights when present');
});

test('ModalPeriksaUraian clamps score inputs to [0, maxBobot]', () => {
  const saveBlock = modalUraianCode.slice(modalUraianCode.indexOf('const handleSave'), modalUraianCode.indexOf('return ('));
  assert.match(saveBlock, /Math\.max\(0,\s*Math\.min/, 'ModalPeriksaUraian handleSave must clamp scores within [0, maxBobot]');
});

test('GuruView saveNilaiUraian updates list safely outside state updater, excludes blocked students from unrated & passes schoolDefaultScheme', () => {
  const saveUraianStart = guruCode.indexOf('const saveNilaiUraian');
  const saveUraianBlock = guruCode.slice(saveUraianStart, guruCode.indexOf('const ', saveUraianStart + 30));
  assert.doesNotMatch(saveUraianBlock, /setDataHasilSiswa\(prev\s*=>[\s\S]*nextStudent/, 'must not capture nextStudent via side-effect inside setDataHasilSiswa updater');
  assert.match(guruCode, /unratedStudents[\s\S]{0,200}is_blocked/, 'unratedStudents must exclude blocked students');
  assert.match(guruCode, /schoolDefaultScheme/, 'GuruView must pass schoolDefaultScheme to SkemaPenilaianPanel');
  assert.match(skemaPanelCode, /nexa_default_skema_\$\{npsn\}/, 'SkemaPenilaianPanel must lookup exact school npsn cache key');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
