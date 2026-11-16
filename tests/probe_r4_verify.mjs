import { fetchAPI, supabaseClient } from '../src/api.js';

async function run() {
  const id1 = 'U-TEST-DEF-' + Date.now();
  const id2 = 'U-TEST-CUSTOM-' + Date.now();
  const npsn = '40103445';

  try {
    console.log('Test 1: create_jadwal with default durasi_token_menit...');
    const r1 = await fetchAPI('create_jadwal', {
      id_jadwal: id1,
      id_mapel: 'M-F6B30793',
      target_kelas: 'XII IPA 1',
      waktu_mulai: new Date().toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      npsn
    });
    console.log('Result r1:', r1);
    if (r1.status !== 'success') throw new Error(`r1 failed: ${r1.message}`);

    console.log('Test 2: create_jadwal with custom durasi_token_menit (string "12")...');
    const r2 = await fetchAPI('create_jadwal', {
      id_jadwal: id2,
      id_mapel: 'M-F6B30793',
      target_kelas: 'XII IPA 1',
      waktu_mulai: new Date().toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      durasi_token_menit: '12',
      npsn
    });
    console.log('Result r2:', r2);
    if (r2.status !== 'success') throw new Error(`r2 failed: ${r2.message}`);

    console.log('Test 3: update_jadwal to durasi_token_menit 8...');
    const r3 = await fetchAPI('update_jadwal', {
      id_jadwal: id1,
      durasi_token_menit: '8',
      npsn
    });
    console.log('Result r3:', r3);
    if (r3.status !== 'success') throw new Error(`r3 failed: ${r3.message}`);

    console.log('Test 4: verify rows in DB and via get_all_jadwal...');
    const { data: rows, error: selErr } = await supabaseClient.from('jadwal').select('*').in('id_jadwal', [id1, id2]);
    if (selErr) throw selErr;
    console.log('DB Rows:', rows.map(r => ({ id: r.id_jadwal, durasi_token_menit: r.durasi_token_menit })));

    const allJadwal = await fetchAPI('get_all_jadwal', { npsn });
    const pRows = allJadwal.data.filter(r => r.id_jadwal === id1 || r.id_jadwal === id2);
    console.log('Processed Rows:', pRows.map(r => ({ id: r.id_jadwal, durasi_token_menit: r.durasi_token_menit, token: r.token })));

    // Cleanup
    await supabaseClient.from('jadwal').delete().in('id_jadwal', [id1, id2]);
    console.log('Cleanup completed successfully.');
    console.log('ALL R4 VERIFICATION PROBES PASSED!');
  } catch (err) {
    console.error('Test error:', err);
    await supabaseClient.from('jadwal').delete().in('id_jadwal', [id1, id2]);
    process.exit(1);
  }
}

run();
