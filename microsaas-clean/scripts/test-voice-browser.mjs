// Run Vite with VITE_SUPABASE_URL=https://voice-fixture.supabase.co and a test key.
// All external traffic is blocked. Speech and backend are fixtures, not production.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.VOICE_TEST_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'], headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const user = { id: '12345678-1234-4234-8234-123456789012', email: 'fixture@example.test', role: 'authenticated', app_metadata: {}, user_metadata: {} };
let rows = [], updates = [], speech = 'Abasteci duzentos e cinquenta reais com cinco mil trezentos e cinquenta quilômetros';
const car = { id: '22345678-1234-4234-8234-123456789012', user_id: user.id, name: 'Carro de teste', placa: 'TEST001', hodometro: 5300, is_active: true };
const cat = { id: 1, name: 'Combustível', type: 'expense' };
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin === base) return route.continue();
  if (url.hostname !== 'voice-fixture.supabase.co') return route.abort();
  let body = [];
  if (url.pathname === '/auth/v1/user') body = user;
  else if (url.pathname === '/rest/v1/users') body = { id: user.id, role: 'user', name: 'Teste' };
  else if (url.pathname === '/rest/v1/accounts') {
    if (req.method() === 'PATCH') { updates.push({ data: req.postDataJSON(), query: url.search }); body = []; }
    else body = req.headers().accept?.includes('object') ? car : [car];
  } else if (url.pathname === '/rest/v1/categories') body = req.headers().accept?.includes('object') ? cat : [cat];
  else if (url.pathname === '/rest/v1/transactions') {
    if (req.method() === 'POST') { const row = req.postDataJSON(); rows.push(row); body = { id: row.id }; }
    else { const id = url.searchParams.get('id')?.replace('eq.', ''); body = id ? rows.filter(r => r.id === id) : rows; }
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await page.addInitScript(({ user, speech }) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = btoa(JSON.stringify({ alg: 'none' })) + '.' + btoa(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })) + '.test';
  localStorage.setItem('sb-voice-fixture-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'test', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
  window.SpeechRecognition = class {
    start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: speech }]] }); this.onend?.(); }, 10); }
    abort() {}
  };
}, { user, speech });
try {
  await page.goto(base + '/gastos-voz');
  await page.getByRole('button', { name: 'Falar gasto e quilometragem' }).click();
  await page.getByLabel('Total pago (R$)').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some(i => i.value === '250.00'));
  assert.equal(await page.getByLabel('Quilometragem do painel').inputValue(), '5350');
  assert.equal(rows.length, 0, 'Speech must not save automatically');
  assert.equal(await page.getByRole('button', { name: 'Confirmar e registrar gasto' }).isDisabled(), true);
  await page.getByLabel('Conferi o carro, o valor, o km, a categoria e a data.').check();
  await page.getByRole('button', { name: 'Confirmar e registrar gasto' }).click();
  await page.getByRole('heading', { name: 'Gasto registrado' }).waitFor();
  assert.equal(rows.length, 1); assert.equal(rows[0].amount, -250); assert.equal(rows[0].odometer, 5350);
  assert.equal(rows[0].account_id, car.id); assert.equal(updates[0].data.hodometro, 5350);
  assert.ok(updates[0].query.includes('hodometro.lt.5350'));
  assert.deepEqual(errors, []);
  // No negative/default guess for missing km; manual edit invalidates confirmation.
  await page.goto(base + '/gastos-voz');
  await page.getByLabel('Total pago (R$)').fill('75,50');
  await page.getByLabel('Quilometragem do painel').fill('5200');
  await page.getByLabel('Conferi o carro, o valor, o km, a categoria e a data.').check();
  assert.equal(await page.getByRole('button', { name: 'Confirmar e registrar gasto' }).isDisabled(), true);
  await page.getByLabel(/Este km é menor/).check();
  await page.getByLabel('Total pago (R$)').fill('76,00');
  assert.equal(await page.getByLabel('Conferi o carro, o valor, o km, a categoria e a data.').isChecked(), false);
  if (process.env.VOICE_TEST_SCREENSHOT) await page.screenshot({ path: process.env.VOICE_TEST_SCREENSHOT, fullPage: true });
  console.log('PASS: mocked speech → review → single insert with amount/km, guarded odometer update, historical km confirmation and edit invalidation.');
} finally { await browser.close(); }
