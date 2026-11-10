import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceExpense as parse, spokenNumber, saveConfirmedExpense, validateExpense } from '../src/lib/voiceExpense.ts';

test('pt-BR currency, thousands and numbers written out', () => {
  for (const text of ['Abasteci 250 reais com 5.350 quilômetros',
    'Abasteci duzentos e cinquenta reais com cinco mil trezentos e cinquenta quilômetros',
    'Abasteci 250 reais, hodômetro em 5350', 'Abasteci 250 reais com 5 mil e 350 km']) {
    const d = parse(text); assert.equal(d.amount, 250, text); assert.equal(d.odometer, 5350, text);
    assert.equal(d.category, 'Combustível');
  }
  assert.equal(parse('Paguei 250 reais e cinquenta centavos, 5350 km').amount, 250.5);
  assert.equal(parse('Abasteci R$ 250,50 com 5350 km').amount, 250.5);
  assert.equal(parse('Gastei mil e duzentos reais, 53.000 km').amount, 1200);
});
test('missing or ambiguous amounts/km never guessed', () => {
  assert.equal(parse('Abasteci 250 reais').odometer, null);
  assert.equal(parse('Estou com 5350 km').amount, null);
  assert.equal(parse('250 reais ou 350 reais com 5000 km').amount, null);
  assert.equal(parse('250 reais com 5000 km ou 6000 km').odometer, null);
  assert.equal(parse('250 reais com 5,5 km').odometer, null);
  assert.equal(parse('menos 250 reais, 5350 km').amount, null);
  assert.equal(parse('Gasolina a 6 reais por litro, 5350 km').amount, null);
  assert.equal(parse('250 reais e 100 centavos, 5350 km').amount, null);
  assert.equal(spokenNumber('dois tres'), null);
});
test('other expense categories and historical dates', () => {
  assert.equal(parse('Paguei vinte reais de pedágio com 5350 km').category, 'Pedágio');
  assert.equal(parse('Estacionamento 30 reais, 5350 km').description, 'Estacionamento');
  assert.ok(parse('Ontem abasteci 250 reais com 5350 km').warnings.some(w => w.includes('data')));
});
const draft = { id: '12345678-1234-4234-8234-123456789012', userId: 'user', accountId: 'car', categoryId: 1,
  amount: 250, odometer: 5350, description: 'Abastecimento', date: '2026-11-10' };
test('validation rejects invalid financial values and missing km', () => {
  for (const amount of [NaN, Infinity, -1, 0, 2.999, 100001]) assert.throws(() => validateExpense({ ...draft, amount }));
  for (const odometer of [NaN, -1, 2.5]) assert.throws(() => validateExpense({ ...draft, odometer }));
  assert.throws(() => validateExpense({ ...draft, date: '2026-02-30' }));
  assert.doesNotThrow(() => validateExpense({ ...draft, odometer: 0 }));
});
test('lost insert response and retry create just one expense', async () => {
  let exists = false, count = 0;
  const api = { find: async () => exists, insert: async () => { exists = true; count++; throw new Error('network'); }, advanceOdometer: async () => {} };
  assert.equal((await saveConfirmedExpense(draft, api)).saved, true);
  assert.equal((await saveConfirmedExpense(draft, api)).saved, true);
  assert.equal(count, 1);
});
test('odometer failure is partial success, not a failed expense', async () => {
  let exists = false, count = 0;
  const api = { find: async () => exists, insert: async () => { exists = true; count++; }, advanceOdometer: async () => { throw new Error('offline'); } };
  assert.deepEqual(await saveConfirmedExpense(draft, api), { saved: true, odometerUpdated: false });
  await saveConfirmedExpense(draft, api); assert.equal(count, 1);
});
test('failure before insert never reports saved', async () => {
  const api = { find: async () => false, insert: async () => { throw new Error('RLS denied'); }, advanceOdometer: async () => assert.fail('must not update') };
  await assert.rejects(saveConfirmedExpense(draft, api), /RLS denied/);
});
