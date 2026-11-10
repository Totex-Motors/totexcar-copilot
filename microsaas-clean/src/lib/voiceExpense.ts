export const normalizeSpeech = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const words: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
  trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};
const word = `(?:${Object.keys(words).join('|')}|mil)`;
const atom = `(?:\\d[\\d.,]*|${word})`;
const number = `${atom}(?:\\s+(?:e\\s+)?${atom})*`;

/** Conservative pt-BR number conversion; punctuation is never silently interpreted as a different magnitude. */
export function spokenNumber(raw: string): number | null {
  const s = normalizeSpeech(raw).trim();
  if (/^[\d.,]+$/.test(s)) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s) && !/^\d+\.\d{1,2}$/.test(s)) return null;
    const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.'))
      : /^\d{1,3}(?:\.\d{3})+$/.test(s) ? Number(s.replace(/\./g, '')) : Number(s);
    return Number.isFinite(n) ? n : null;
  }
  let total = 0, group = 0, had = false, thousands = false, last = Infinity;
  for (const token of s.split(/\s+/)) {
    if (token === 'e') continue;
    if (token === 'mil') { if (thousands) return null; total += (group || 1) * 1000; group = 0; last = Infinity; thousands = true; had = true; }
    else if (token in words || /^\d+$/.test(token)) {
      const n = token in words ? words[token] : Number(token);
      if (last < 20 || n >= last || (last >= 20 && last < 100 && n >= 10)) return null;
      group += n; last = n; had = true;
    }
    else return null;
  }
  return had ? total + group : null;
}

export interface SpokenExpense { amount: number | null; odometer: number | null; description: string; category: string; warnings: string[] }
export function parseVoiceExpense(input: string): SpokenExpense {
  const s = normalizeSpeech(input.slice(0, 1000));
  const warnings: string[] = [];
  const values: number[] = [];
  for (const m of s.matchAll(new RegExp(`(${number})\\s*(?:reais|real)\\b(?:\\s+e\\s+(${number})\\s+centavos?)?`, 'g'))) {
    const main = spokenNumber(m[1]), cents = m[2] ? spokenNumber(m[2]) : 0;
    if (main !== null && cents !== null && cents < 100) values.push(main + cents / 100);
  }
  if (!values.length) for (const m of s.matchAll(new RegExp(`(?:r\\$\\s*|(?:gastei|paguei|abasteci)\\s+)(${number})(?=\\s*(?:com|em|no|na|de|$))`, 'g'))) {
    const n = spokenNumber(m[1]); if (n !== null) values.push(n);
  }
  const kms: number[] = [];
  for (const m of s.matchAll(new RegExp(`(${number})\\s*(?:km|quilometros?)\\b`, 'g'))) {
    const n = spokenNumber(m[1]); if (n !== null) kms.push(n);
  }
  if (!kms.length) for (const m of s.matchAll(new RegExp(`(?:hodometro|quilometragem|km)\\s*(?:(?:esta|em|de|a|com)\\s+)*(${number})`, 'g'))) {
    const n = spokenNumber(m[1]); if (n !== null) kms.push(n);
  }
  const invalidSign = /(?:\b(?:menos|ou|corrigindo)\b|quer dizer|[-−]\s*\d)/.test(s);
  let amount = !invalidSign && values.length === 1 && values[0] > 0 && values[0] <= 100000 ? Math.round(values[0] * 100) / 100 : null;
  let odometer = !invalidSign && kms.length === 1 && Number.isInteger(kms[0]) && kms[0] >= 0 && kms[0] <= 9999999 ? kms[0] : null;
  if (/por litro|o litro/.test(s)) { amount = null; warnings.push('Informe o total pago, não o preço por litro.'); }
  if (amount === null) warnings.push('Confira ou preencha o valor total.');
  if (odometer === null) warnings.push('Confira ou preencha a quilometragem do painel.');
  let category = '', description = input.trim().slice(0, 200);
  if (/abastec|gasolina|etanol|diesel|combustivel/.test(s)) { category = 'Combustível'; description = 'Abastecimento'; }
  else if (/pedagio/.test(s)) { category = 'Pedágio'; description = 'Pedágio'; }
  else if (/estacionamento/.test(s)) { category = 'Estacionamento'; description = 'Estacionamento'; }
  if (/ontem|anteontem|semana passada/.test(s)) warnings.push('Confira também a data deste gasto.');
  return { amount, odometer, description, category, warnings };
}

export interface ExpenseDraft {
  id: string; userId: string; accountId: string; amount: number; odometer: number;
  categoryId: number; description: string; date: string;
}
export function validateExpense(d: ExpenseDraft) {
  if (!/^[\da-f-]{36}$/i.test(d.id) || !d.userId || !d.accountId) throw new Error('Entre na sua conta e selecione o carro.');
  if (!Number.isFinite(d.amount) || d.amount <= 0 || d.amount > 100000 || Math.abs(d.amount * 100 - Math.round(d.amount * 100)) > .00001)
    throw new Error('Informe um valor positivo, com no máximo duas casas decimais.');
  if (!Number.isInteger(d.odometer) || d.odometer < 0 || d.odometer > 9999999) throw new Error('Informe a quilometragem inteira do painel.');
  if (!Number.isInteger(d.categoryId) || d.categoryId <= 0) throw new Error('Selecione a categoria.');
  if (!d.description.trim() || d.description.length > 200) throw new Error('Preencha a descrição com até 200 caracteres.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !Number.isFinite(Date.parse(d.date)) || new Date(d.date).toISOString().slice(0, 10) !== d.date)
    throw new Error('Confira a data do gasto.');
}

export interface ExpenseGateway {
  find: (id: string, user: string) => Promise<boolean>;
  insert: (draft: ExpenseDraft) => Promise<void>;
  advanceOdometer: (draft: ExpenseDraft) => Promise<void>;
}
/** Stable id is retained after uncertain network results. Odometer failure never repeats the expense. */
export async function saveConfirmedExpense(d: ExpenseDraft, api: ExpenseGateway) {
  validateExpense(d);
  if (!await api.find(d.id, d.userId)) {
    try { await api.insert(d); }
    catch (error) { if (!await api.find(d.id, d.userId)) throw error; }
  }
  let odometerUpdated = true;
  try { await api.advanceOdometer(d); } catch { odometerUpdated = false; }
  return { saved: true, odometerUpdated };
}
