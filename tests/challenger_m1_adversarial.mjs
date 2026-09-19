/**
 * Challenger M1: Empirical Adversarial Test Suite for src/components/UI.jsx
 * Validates edge cases, boundary conditions, window backward-compatibility attachments,
 * and build stability under adversarial inputs.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';
import { TestSuite, assert } from './test_framework.mjs';

export async function runChallengerSuite() {
  console.log('======================================================================');
  console.log('   CHALLENGER 2 (M1) — ADVERSARIAL STRESS TEST SUITE: UI.jsx         ');
  console.log('======================================================================\n');

  // Ensure window environment is simulated for backward compatibility checks
  if (typeof global.window === 'undefined') {
    global.window = {};
  }

  // Spin up Vite dev server for native JSX module loading
  const viteServer = await createServer({
    server: { middlewareMode: true }
  });

  let UI;
  try {
    UI = await viteServer.ssrLoadModule('./src/components/UI.jsx');
  } catch (err) {
    console.error('CRITICAL: Failed to load UI.jsx via Vite SSR loader:', err);
    await viteServer.close();
    throw err;
  }

  const overallResults = {
    total: 0,
    passed: 0,
    failed: 0,
    suites: []
  };

  function executeSuite(suite) {
    const res = suite.run();
    overallResults.total += res.total;
    overallResults.passed += res.passed;
    overallResults.failed += res.failed;
    overallResults.suites.push(res);
    return res;
  }

  // =========================================================================
  // SUITE 1: EmptyState Edge Cases & Stress Testing
  // =========================================================================
  const s1 = new TestSuite('EmptyState Edge Cases', 'Adversarial inputs for EmptyState component');

  s1.add('EmptyState renders with no props (all defaults)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState));
    assert.ok(html.includes('Belum Ada Data'), 'Default title rendered');
    assert.ok(html.includes('folder_open'), 'Default icon rendered');
    assert.ok(html.includes('Belum ada data yang dapat ditampilkan di sini.'), 'Default description rendered');
  });

  s1.add('EmptyState handles null and undefined props cleanly', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      icon: null,
      title: null,
      description: null,
      message: null,
      action: null,
      secondaryAction: null,
      className: null
    }));
    assert.ok(html.includes('Belum ada data yang dapat ditampilkan di sini.'), 'Falls back to default description');
    assert.ok(!html.includes('folder_open'), 'Null icon does not render icon text');
  });

  s1.add('EmptyState missing action renders no button elements', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      title: 'No Action Here'
    }));
    assert.ok(!html.includes('<button'), 'No button tag when action props are absent');
  });

  s1.add('EmptyState handles object action with full configuration', () => {
    let clicked = false;
    const actionObj = {
      label: 'Tambah Jadwal Baru',
      onClick: () => { clicked = true; },
      icon: 'add_circle'
    };
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      action: actionObj
    }));
    assert.ok(html.includes('Tambah Jadwal Baru'), 'Action label rendered');
    assert.ok(html.includes('add_circle'), 'Action icon rendered');
    assert.ok(html.includes('<button'), 'Button element rendered');
  });

  s1.add('EmptyState handles object action without icon', () => {
    const actionObj = {
      label: 'Simpan Data',
      onClick: () => {}
    };
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      action: actionObj
    }));
    assert.ok(html.includes('Simpan Data'), 'Action label rendered');
    assert.ok(html.includes('<button'), 'Button element rendered');
  });

  s1.add('EmptyState handles malformed object action safely (missing onClick)', () => {
    const actionObj = { label: 'Incomplete Action' };
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      action: actionObj
    }));
    // renderActionButton should return null and not throw
    assert.ok(!html.includes('Incomplete Action'), 'Broken action button omitted');
  });

  s1.add('EmptyState handles malformed object action safely (missing label)', () => {
    const actionObj = { onClick: () => {} };
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      action: actionObj
    }));
    assert.ok(!html.includes('<button'), 'Broken action button omitted');
  });

  s1.add('EmptyState handles empty object action safely ({})', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      action: {}
    }));
    assert.ok(!html.includes('<button'), 'Empty object action does not produce button');
  });

  s1.add('EmptyState handles non-object primitive action values safely', () => {
    const htmlTrue = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { action: true }));
    const htmlNum = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { action: 123 }));
    const htmlStr = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { action: 'adversarial_string' }));
    assert.ok(!htmlTrue.includes('<button'), 'Boolean true does not produce button');
    assert.ok(!htmlNum.includes('<button'), 'Number does not produce button');
    assert.ok(!htmlStr.includes('<button'), 'String does not produce button');
  });

  s1.add('EmptyState handles React Node direct action element', () => {
    const customNode = React.createElement('a', { href: '#refresh', className: 'custom-link' }, 'Reload');
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      action: customNode
    }));
    assert.ok(html.includes('custom-link'), 'Custom React element rendered directly');
    assert.ok(html.includes('Reload'), 'Custom React element text rendered');
  });

  s1.add('EmptyState legacy actionText + onAction backward compatibility', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      actionText: 'Mulai Ujian',
      onAction: () => {}
    }));
    assert.ok(html.includes('Mulai Ujian'), 'Legacy actionText rendered');
    assert.ok(html.includes('<button'), 'Legacy action button rendered');
  });

  s1.add('EmptyState legacy partial props (actionText without onAction or vice versa)', () => {
    const htmlTextOnly = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { actionText: 'Mulai' }));
    const htmlActionOnly = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { onAction: () => {} }));
    assert.ok(!htmlTextOnly.includes('<button'), 'actionText alone does not render button');
    assert.ok(!htmlActionOnly.includes('<button'), 'onAction alone does not render button');
  });

  s1.add('EmptyState description and message precedence', () => {
    const htmlDesc = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      description: 'Primary Description',
      message: 'Secondary Message'
    }));
    assert.ok(htmlDesc.includes('Primary Description'), 'description takes precedence');
    assert.ok(!htmlDesc.includes('Secondary Message'), 'message is ignored when description present');

    const htmlMsgOnly = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
      message: 'Secondary Message'
    }));
    assert.ok(htmlMsgOnly.includes('Secondary Message'), 'message is used when description absent');
  });

  s1.add('EmptyState compact mode styling', () => {
    const htmlCompact = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { compact: true }));
    const htmlNormal = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { compact: false }));
    assert.ok(htmlCompact.includes('w-14 h-14'), 'Compact container styling verified');
    assert.ok(htmlNormal.includes('w-20 h-20'), 'Normal container styling verified');
  });

  executeSuite(s1);

  // =========================================================================
  // SUITE 2: TableSkeleton Edge Cases & Stress Testing
  // =========================================================================
  const s2 = new TestSuite('TableSkeleton Edge Cases', 'Adversarial inputs for TableSkeleton component');

  s2.add('TableSkeleton default props (5 rows, 4 columns)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton));
    assert.ok(html.includes('divide-y'), 'Renders standalone container');
    assert.ok(html.includes('animate-pulse'), 'Pulse animation applied');
  });

  s2.add('TableSkeleton zero rows (rows = 0)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { rows: 0 }));
    // Container still renders header, 0 row divs
    assert.ok(html.includes('bg-white dark:bg-slate-800'), 'Container renders');
    assert.ok(!html.includes('skel-tr-'), 'Zero body rows rendered');
  });

  s2.add('TableSkeleton negative rows (rows = -5)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { rows: -5 }));
    // Array.from({ length: -5 }) yields empty array in JS without throwing RangeError
    assert.ok(html.includes('bg-white dark:bg-slate-800'), 'Container renders without throwing');
    assert.ok(!html.includes('skel-tr-'), 'Zero body rows rendered');
  });

  s2.add('TableSkeleton zero cols (cols = 0)', () => {
    // cols = 0 falls back via `cols || columns` to default columns = 4
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { cols: 0 }));
    assert.ok(html.includes('w-40 sm:w-56'), 'Column 1 width rendered via default fallback');
  });

  s2.add('TableSkeleton negative cols (cols = -2)', () => {
    // cols = -2 is truthy, colCount = -2, Array.from({ length: -2 }) -> []
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { cols: -2 }));
    assert.ok(html.includes('bg-white dark:bg-slate-800'), 'Negative cols handled safely without crash');
  });

  s2.add('TableSkeleton custom columnWidths array', () => {
    const customWidths = ['w-12', 'w-32', 'w-48'];
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
      columnWidths: customWidths
    }));
    assert.ok(html.includes('w-12'), 'First custom width applied');
    assert.ok(html.includes('w-32'), 'Second custom width applied');
    assert.ok(html.includes('w-48'), 'Third custom width applied');
  });

  s2.add('TableSkeleton empty custom columnWidths array ([])', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
      columnWidths: []
    }));
    assert.ok(html.includes('bg-white dark:bg-slate-800'), 'Empty columnWidths handled safely without crash');
  });

  s2.add('TableSkeleton asTableRows = true (direct tbody integration)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
      asTableRows: true,
      rows: 3,
      cols: 3,
      hasAvatar: true
    }));
    assert.ok(html.includes('<tr'), 'Renders <tr> element');
    assert.ok(html.includes('<td'), 'Renders <td> element');
    assert.ok(html.includes('rounded-full'), 'Avatar circle rendered in column 1');
  });

  s2.add('TableSkeleton asTableRows = true with negative rows', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
      asTableRows: true,
      rows: -3
    }));
    assert.equal(html, '', 'Empty fragment rendered without crash');
  });

  s2.add('TableSkeleton showHeader = false', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
      showHeader: false
    }));
    assert.ok(!html.includes('skel-th-'), 'Header container omitted');
  });

  s2.add('TableSkeleton stress test with 100 rows', () => {
    const startTime = Date.now();
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
      rows: 100,
      columns: 6
    }));
    const elapsed = Date.now() - startTime;
    assert.ok(html.length > 10000, 'Rendered large table skeleton');
    assert.ok(elapsed < 200, `Large render took ${elapsed}ms (<200ms)`);
  });

  executeSuite(s2);

  // =========================================================================
  // SUITE 3: CardSkeleton Edge Cases & Stress Testing
  // =========================================================================
  const s3 = new TestSuite('CardSkeleton Edge Cases', 'Adversarial inputs for CardSkeleton component');

  s3.add('CardSkeleton default props (count = 3, variant = stat)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton));
    assert.ok(html.includes('grid grid-cols-1'), 'Default grid container applied');
    assert.ok(html.includes('card-skel-0'), 'First card rendered');
    assert.ok(html.includes('card-skel-2'), 'Third card rendered');
    assert.ok(!html.includes('card-skel-3'), 'Fourth card not rendered');
  });

  s3.add('CardSkeleton count = 0', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: 0 }));
    assert.ok(html.includes('grid'), 'Grid container renders');
    assert.ok(!html.includes('card-skel-'), 'No card elements rendered');
  });

  s3.add('CardSkeleton negative count (count = -1)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: -1 }));
    assert.ok(html.includes('grid'), 'Grid container renders without throwing');
    assert.ok(!html.includes('card-skel-'), 'No card elements rendered');
  });

  s3.add('CardSkeleton varying counts (1, 6, 12)', () => {
    const html1 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: 1 }));
    const html6 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: 6 }));
    const html12 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: 12 }));

    assert.ok(html1.includes('card-skel-0') && !html1.includes('card-skel-1'), 'Count 1 renders 1 card');
    assert.ok(html6.includes('card-skel-5') && !html6.includes('card-skel-6'), 'Count 6 renders 6 cards');
    assert.ok(html12.includes('card-skel-11') && !html12.includes('card-skel-12'), 'Count 12 renders 12 cards');
  });

  s3.add('CardSkeleton exam variant structure', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: 'exam' }));
    assert.ok(html.includes('w-3/4'), 'Exam variant title bar rendered');
    assert.ok(html.includes('w-1/2'), 'Exam variant subtitle bar rendered');
    assert.ok(html.includes('justify-end'), 'Exam variant footer button bar rendered');
  });

  s3.add('CardSkeleton simple variant structure', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: 'simple' }));
    assert.ok(html.includes('rounded-full'), 'Simple variant circular icon rendered');
  });

  s3.add('CardSkeleton unknown variant fallback', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: 'unrecognized_xyz' }));
    // Falls back to simple variant default in switch
    assert.ok(html.includes('rounded-full'), 'Unknown variant safely falls back to simple');
  });

  s3.add('CardSkeleton null / undefined variant fallback', () => {
    const htmlNull = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: null }));
    assert.ok(htmlNull.includes('rounded-full'), 'Null variant safely falls back');
  });

  executeSuite(s3);

  // =========================================================================
  // SUITE 4: StatusBadge Edge Cases & Stress Testing
  // =========================================================================
  const s4 = new TestSuite('StatusBadge Edge Cases', 'Adversarial inputs for StatusBadge component');

  s4.add('StatusBadge renders with no props (all defaults)', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge));
    assert.ok(html.includes('Status'), 'Default label "Status" rendered');
    assert.ok(html.includes('bg-slate-100 text-slate-600'), 'Default neutral styling rendered');
  });

  s4.add('StatusBadge unknown status string falls back to neutral', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, {
      status: 'UNKNOWN_CUSTOM_STATUS_999'
    }));
    assert.ok(html.includes('UNKNOWN_CUSTOM_STATUS_999'), 'Custom status string rendered');
    assert.ok(html.includes('bg-slate-100 text-slate-600'), 'Neutral styling applied');
  });

  s4.add('StatusBadge case insensitivity and whitespace trimming', () => {
    const htmlLower = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'aktif' }));
    const htmlPadded = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: '   sedang kerja   ' }));
    const htmlDanger = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'TerBlokir' }));

    assert.ok(htmlLower.includes('bg-emerald-50'), 'Lower case "aktif" mapped to emerald success');
    assert.ok(htmlPadded.includes('bg-amber-50'), 'Padded "sedang kerja" mapped to amber warning');
    assert.ok(htmlDanger.includes('bg-rose-50'), 'Mixed case "TerBlokir" mapped to rose danger');
  });

  s4.add('StatusBadge comprehensive status dictionary coverage', () => {
    // Test key representatives from every semantic bucket
    const samples = [
      { status: 'SELESAI', expectedColor: 'emerald' },
      { status: 'SUDAH_SELESAI', expectedColor: 'emerald' },
      { status: 'TERJAWAB', expectedColor: 'emerald' },
      { status: 'SEDANG_UJIAN', expectedColor: 'amber' },
      { status: 'RAGU-RAGU', expectedColor: 'amber' },
      { status: 'MENGERJAKAN', expectedColor: 'amber' },
      { status: 'BELUM MULAI', expectedColor: 'slate' },
      { status: 'NONAKTIF', expectedColor: 'slate' },
      { status: 'PELANGGARAN', expectedColor: 'rose' },
      { status: 'DISKUALIFIKASI', expectedColor: 'rose' },
      { status: 'JADWAL', expectedColor: 'sky' },
      { status: 'HASIL', expectedColor: 'purple' }
    ];

    for (const sample of samples) {
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: sample.status }));
      assert.ok(html.includes(sample.expectedColor), `Status ${sample.status} maps to ${sample.expectedColor}`);
    }
  });

  s4.add('StatusBadge explicit variant override takes precedence', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, {
      status: 'AKTIF', // Would normally map to success (emerald)
      variant: 'danger' // Explicitly overridden to rose danger
    }));
    assert.ok(html.includes('bg-rose-50 text-rose-700'), 'Explicit variant danger overrides status mapping');
  });

  s4.add('StatusBadge invalid variant name falls back to neutral', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, {
      status: 'AKTIF',
      variant: 'nonexistent_variant_token'
    }));
    assert.ok(html.includes('bg-slate-100 text-slate-600'), 'Unrecognized variant falls back to neutral');
  });

  s4.add('StatusBadge null / undefined / empty label handling', () => {
    const htmlNull = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { label: null }));
    const htmlUndef = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { label: undefined, status: 'AKTIF' }));
    const htmlEmpty = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { label: '' }));

    assert.ok(htmlNull.includes('Status'), 'Null label falls back to Status');
    assert.ok(htmlUndef.includes('AKTIF'), 'Undefined label falls back to status');
    assert.ok(htmlEmpty.includes('Status'), 'Empty string label falls back to Status');
  });

  s4.add('StatusBadge children as label content', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, null, 'Custom Child Text'));
    assert.ok(html.includes('Custom Child Text'), 'Children rendered as badge text');
  });

  s4.add('StatusBadge automatic live pulse for active exam states', () => {
    const htmlAktif = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'AKTIF' }));
    const htmlSelesai = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'SELESAI' }));

    assert.ok(htmlAktif.includes('animate-ping'), 'AKTIF status triggers live pulse ping animation');
    assert.ok(!htmlSelesai.includes('animate-ping'), 'SELESAI status does not trigger live pulse ping animation');
  });

  s4.add('StatusBadge dot = false suppresses dot and ping', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, {
      status: 'AKTIF',
      dot: false
    }));
    assert.ok(!html.includes('animate-ping'), 'dot=false suppresses ping animation');
    assert.ok(!html.includes('w-2 h-2'), 'dot=false suppresses dot indicator');
  });

  s4.add('StatusBadge sizes: xs, sm, md, lg and fallback', () => {
    const htmlXs = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { size: 'xs' }));
    const htmlMd = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { size: 'md' }));
    const htmlLg = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { size: 'lg' }));
    const htmlInvalid = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { size: 'gigantic' }));

    assert.ok(htmlXs.includes('text-[10px]'), 'xs size applied');
    assert.ok(htmlMd.includes('px-3 py-1.5'), 'md size applied');
    assert.ok(htmlLg.includes('px-4 py-2'), 'lg size applied');
    assert.ok(htmlInvalid.includes('px-2.5 py-1'), 'invalid size falls back to sm');
  });

  s4.add('StatusBadge pill = true vs pill = false', () => {
    const htmlPill = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { pill: true }));
    const htmlSquare = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { pill: false }));

    assert.ok(htmlPill.includes('rounded-full'), 'pill=true has rounded-full');
    assert.ok(htmlSquare.includes('rounded-lg'), 'pill=false has rounded-lg');
  });

  s4.add('StatusBadge numeric status values (0, 42)', () => {
    const html0 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 0 }));
    const html42 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 42 }));

    assert.ok(html0.includes('Status'), 'Falsy 0 falls back to Status');
    assert.ok(html42.includes('42'), 'Truthy 42 renders as 42');
  });

  executeSuite(s4);

  // =========================================================================
  // SUITE 5: Backward Compatibility & Window Attachments
  // =========================================================================
  const s5 = new TestSuite('Backward Compatibility & Window Attachments', 'Verifies window.* attachments and safe invocation');

  s5.add('All required window component and utility attachments exist', () => {
    const requiredAttachments = [
      'EmptyState',
      'TableSkeleton',
      'CardSkeleton',
      'StatusBadge',
      'Badge',
      'Card',
      'CardHeader',
      'CardTitle',
      'CardDescription',
      'CardContent',
      'CardFooter',
      'Button',
      'safeJSONParse'
    ];

    for (const name of requiredAttachments) {
      assert.ok(typeof window[name] !== 'undefined', `window.${name} is defined`);
      assert.equal(typeof window[name], 'function', `window.${name} is a function / component`);
    }
  });

  s5.add('window.safeJSONParse handles valid and adversarial JSON without crashing', () => {
    const parse = window.safeJSONParse;

    assert.deepEqual(parse('{"active": true, "count": 10}', null), { active: true, count: 10 }, 'Parses valid JSON object');
    assert.deepEqual(parse('[1, 2, 3]', null), [1, 2, 3], 'Parses valid JSON array');
    assert.equal(parse('', 'fallback'), 'fallback', 'Empty string returns fallback');
    assert.equal(parse(null, 'fallback'), 'fallback', 'Null returns fallback');
    assert.equal(parse(undefined, 'fallback'), 'fallback', 'Undefined returns fallback');
    assert.equal(parse('{corrupted_json_syntax', 'safe_fallback'), 'safe_fallback', 'Syntax error returns fallback');
    assert.equal(parse(12345, 'fallback'), 'fallback', 'Number returns fallback without crashing');
  });

  s5.add('window.EmptyState renders correctly when invoked via window global', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(window.EmptyState, {
      title: 'Global Empty State',
      description: 'Rendered from window.EmptyState'
    }));
    assert.ok(html.includes('Global Empty State'), 'Rendered title');
    assert.ok(html.includes('Rendered from window.EmptyState'), 'Rendered description');
  });

  s5.add('window.TableSkeleton renders correctly when invoked via window global', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(window.TableSkeleton, {
      rows: 2,
      columns: 3
    }));
    assert.ok(html.includes('divide-y'), 'Rendered table skeleton');
  });

  s5.add('window.CardSkeleton renders correctly when invoked via window global', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(window.CardSkeleton, {
      count: 2,
      variant: 'stat'
    }));
    assert.ok(html.includes('card-skel-0'), 'Rendered card skeleton');
  });

  s5.add('window.StatusBadge and window.Badge render identically', () => {
    const html1 = ReactDOMServer.renderToStaticMarkup(React.createElement(window.StatusBadge, { status: 'SELESAI' }));
    const html2 = ReactDOMServer.renderToStaticMarkup(React.createElement(window.Badge, { status: 'SELESAI' }));
    assert.equal(html1, html2, 'window.StatusBadge and window.Badge render identical markup');
    assert.ok(html1.includes('bg-emerald-50 text-emerald-700'), 'Proper emerald success styling');
  });

  s5.add('window.Button renders with variant and icon', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(window.Button, {
      variant: 'primary',
      icon: 'check'
    }, 'Submit Exam'));
    assert.ok(html.includes('Submit Exam'), 'Button children rendered');
    assert.ok(html.includes('check'), 'Button icon rendered');
    assert.ok(html.includes('bg-emerald-600 hover:bg-emerald-700 text-white'), 'Button primary emerald styles');
  });

  s5.add('window.Card primitives assemble full card hierarchy', () => {
    const cardElement = React.createElement(window.Card, { className: 'custom-card' },
      React.createElement(window.CardHeader, null,
        React.createElement(window.CardTitle, null, 'Statistik Ujian'),
        React.createElement(window.CardDescription, null, 'Ringkasan semester')
      ),
      React.createElement(window.CardContent, null, 'Konten utama'),
      React.createElement(window.CardFooter, null, 'Footer aksi')
    );
    const html = ReactDOMServer.renderToStaticMarkup(cardElement);
    assert.ok(html.includes('custom-card'), 'Card container rendered');
    assert.ok(html.includes('Statistik Ujian'), 'CardTitle rendered');
    assert.ok(html.includes('Ringkasan semester'), 'CardDescription rendered');
    assert.ok(html.includes('Konten utama'), 'CardContent rendered');
    assert.ok(html.includes('Footer aksi'), 'CardFooter rendered');
  });

  executeSuite(s5);

  // =========================================================================
  // SUITE 6: Additional Component Primitives: Card & Button Edge Cases
  // =========================================================================
  const s6 = new TestSuite('Card and Button Primitive Edge Cases', 'Stress testing Button and Card primitives in UI.jsx');

  s6.add('Button isLoading state shows spinner and hides left icon', () => {
    const htmlLoading = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, {
      isLoading: true,
      icon: 'send'
    }, 'Kirim'));
    assert.ok(htmlLoading.includes('animate-spin'), 'Loading spinner present');
    assert.ok(!htmlLoading.includes('send'), 'Normal icon hidden while loading');
    assert.ok(htmlLoading.includes('disabled=""') || htmlLoading.includes('disabled'), 'Button is disabled when loading');
  });

  s6.add('Button rightIcon renders alongside text', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, {
      rightIcon: 'arrow_forward'
    }, 'Lanjut Soal'));
    assert.ok(html.includes('Lanjut Soal'), 'Button text rendered');
    assert.ok(html.includes('arrow_forward'), 'Right icon rendered');
  });

  s6.add('Button unknown variant falls back safely to emerald primary', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, {
      variant: 'unrecognized_variant_type'
    }, 'Fallback'));
    assert.ok(html.includes('bg-emerald-600 hover:bg-emerald-700 text-white'), 'Unknown variant safely falls back');
  });

  executeSuite(s6);

  await viteServer.close();

  console.log('\n======================================================================');
  console.log('CHALLENGER SUITE EXECUTION SUMMARY');
  console.log(`  Total Test Cases : ${overallResults.total}`);
  console.log(`  Passed           : ${overallResults.passed}`);
  console.log(`  Failed           : ${overallResults.failed}`);
  console.log(`  Pass Rate        : ${Math.round((overallResults.passed / overallResults.total) * 100)}%`);
  console.log('======================================================================\n');

  if (overallResults.failed > 0) {
    throw new Error(`${overallResults.failed} adversarial test(s) failed!`);
  }

  return overallResults;
}

// Direct execution CLI check
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('challenger_m1_adversarial.mjs')) {
  runChallengerSuite().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
