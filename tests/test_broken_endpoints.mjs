import { fetchAPI } from '../src/api.js';

async function testBrokenEndpoints() {
  console.log('Testing get_bank_soal_admin:');
  const res1 = await fetchAPI('get_bank_soal_admin', { npsn: '70040625' });
  console.log('get_bank_soal_admin result:', res1);

  console.log('\nTesting get_admin_dashboard_data:');
  const res2 = await fetchAPI('get_admin_dashboard_data', { npsn: '70040625' });
  console.log('get_admin_dashboard_data result:', res2);

  console.log('\nTesting get_all_mapel:');
  const res3 = await fetchAPI('get_all_mapel', { npsn: '70040625' });
  console.log('get_all_mapel result:', res3);

  process.exit(0);
}

testBrokenEndpoints();
