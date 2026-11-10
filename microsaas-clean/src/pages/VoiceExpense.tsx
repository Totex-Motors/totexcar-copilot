import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, CheckCircle, Fuel } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { MgShell } from '@/components/mg/MgShell';
import { useCurrentUser } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useExpenseSpeech } from '@/hooks/useExpenseSpeech';
import { normalizeSpeech, parseVoiceExpense, saveConfirmedExpense, validateExpense, type ExpenseDraft } from '@/lib/voiceExpense';
import { expenseGateway } from '@/lib/expenseGateway';

export default function VoiceExpense() {
  const { userId, loading } = useCurrentUser();
  const { data: cars = [], isLoading: loadingCars } = useAccounts(userId);
  const { data: categories = [], isLoading: loadingCategories } = useCategories('expense');
  const cache = useQueryClient();
  const [account, setAccount] = useState(''), [category, setCategory] = useState('');
  const [description, setDescription] = useState('Abastecimento'), [amount, setAmount] = useState(''), [km, setKm] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [transcript, setTranscript] = useState(''), [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false), [oldKm, setOldKm] = useState(false), [locked, setLocked] = useState(false);
  const [odoWarning, setOdoWarning] = useState(false);
  const draft = useRef<ExpenseDraft | null>(null), saving = useRef(false);
  const categoryInitialized = useRef(false);
  const car = cars.find(c => c.id === account);
  useEffect(() => { if (!account && cars.length) setAccount(cars[0].id); }, [cars, account]);
  useEffect(() => { if (!categoryInitialized.current && categories.length) { categoryInitialized.current = true; const c = categories.find(c => normalizeSpeech(c.name) === 'combustivel'); if (c) setCategory(String(c.id)); } }, [categories]);
  const speech = useExpenseSpeech(text => {
    if (draft.current || saving.current) return;
    const result = parseVoiceExpense(text);
    setTranscript(text); setAmount(result.amount == null ? '' : result.amount.toFixed(2));
    setKm(result.odometer == null ? '' : String(result.odometer)); setDescription(result.description);
    const found = categories.find(c => normalizeSpeech(c.name) === normalizeSpeech(result.category));
    setCategory(found ? String(found.id) : '');
    setWarnings(result.warnings); setConfirmed(false); setOldKm(false);
  });
  useEffect(() => { setConfirmed(false); setOldKm(false); }, [amount, km, category, account, description, date]);
  const sessionOwner = useRef(userId);
  useEffect(() => {
    if (sessionOwner.current && sessionOwner.current !== userId) {
      speech.stop(); draft.current = null; setTranscript(''); setAmount(''); setKm(''); setAccount('');
      setLocked(false); setSaved(false); setConfirmed(false);
    }
    sessionOwner.current = userId;
  }, [userId]);
  const older = km !== '' && car && Number(km) < Number(car.hodometro || 0);
  async function save() {
    if (saving.current || !userId || !car || !confirmed || (older && !oldKm)) return;
    setError('');
    try {
      if (!draft.current) {
        const candidate: ExpenseDraft = { id: crypto.randomUUID(), userId, accountId: car.id,
          categoryId: Number(category), description, amount: Number(amount.replace(',', '.')),
          odometer: km.trim() === '' ? NaN : Number(km), date };
        validateExpense(candidate); draft.current = candidate;
      }
      if (draft.current.userId !== userId) throw new Error('Entre novamente na conta do lançamento.');
      saving.current = true; setBusy(true); setLocked(true); speech.stop();
      const result = await saveConfirmedExpense(draft.current, expenseGateway);
      if (sessionOwner.current !== userId) return;
      setSaved(true); setOdoWarning(!result.odometerUpdated);
      for (const key of ['transactions', 'accounts', 'monthly-stats', 'category-stats', 'fuel-this-month', 'total-spent'])
        cache.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar o registro. Confira a conexão e tente novamente.');
    } finally { saving.current = false; setBusy(false); }
  }
  if (loading) return <MgShell title="Gasto por voz" back="/transactions"><p>Carregando sua conta…</p></MgShell>;
  if (!userId) return <MgShell title="Gasto por voz" back="/"><div className="card pad"><p>Entre na sua conta para guardar o gasto no carro certo.</p><Link to="/entrar" className="btn-primary">Entrar</Link></div></MgShell>;
  return <MgShell title="Gasto por voz" back="/transactions">
    <div className="stack">
      {saved ? <div className="card pad" role="status">
        <CheckCircle size={30} /><h2>Gasto registrado</h2><p>{description} · R$ {Number(amount.replace(',', '.')).toFixed(2).replace('.', ',')} · {km} km</p>
        {odoWarning && <p>O gasto e seu km foram salvos. Não foi possível atualizar o km na ficha do veículo; confira em Meu veículo. Não repita o gasto.</p>}
        <Link to="/transactions" className="btn-primary">Ver gastos</Link>
      </div> : <>
        <section className="card pad">
          <h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Fuel size={22} />Conte o que gastou</h2>
          <p>Exemplo: “Abasteci duzentos e cinquenta reais, com cinco mil trezentos e cinquenta quilômetros”.</p>
          <button className="btn-primary" type="button" disabled={busy || locked || !car || loadingCategories}
            onClick={speech.listening ? speech.stop : speech.start}><Mic size={18} /> {speech.listening ? 'Cancelar captura' : 'Falar gasto e quilometragem'}</button>
          <p className="foot-note">Toque para falar. O serviço de voz do celular ou navegador pode usar internet. Use com o carro estacionado.</p>
          {speech.error && <p role="alert">{speech.error}</p>}
          {transcript && <p><strong>Você disse:</strong> {transcript}</p>}
          {warnings.map(w => <p key={w}>{w}</p>)}
        </section>
        <section className="card pad">
          <h2>Confira antes de salvar</h2>
          {!cars.length && !loadingCars && <p>Cadastre seu carro em <Link to="/veiculo">Meu veículo</Link>.</p>}
          <fieldset disabled={locked || busy || speech.listening} style={{ border: 0, padding: 0, display: 'grid', gap: 12 }}>
            <label>Carro<select className="field" value={account} onChange={e => setAccount(e.target.value)}><option value="">Selecione</option>{cars.map(c => <option key={c.id} value={c.id}>{c.name}{c.placa ? ` · ${c.placa}` : ''}</option>)}</select></label>
            <label>Descrição<input className="field" value={description} maxLength={200} onChange={e => setDescription(e.target.value)} /></label>
            <label>Total pago (R$)<input className="field" inputMode="decimal" placeholder="250,00" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label>Quilometragem do painel<input className="field" inputMode="numeric" placeholder="5350" value={km} onChange={e => setKm(e.target.value)} /></label>
            <label>Categoria<select className="field" value={category} onChange={e => setCategory(e.target.value)}><option value="">Selecione</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Data<input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          </fieldset>
          {older && <label style={{ display: 'block', marginTop: 16 }}><input type="checkbox" checked={oldKm} onChange={e => setOldKm(e.target.checked)} disabled={locked} /> Este km é menor que o atual ({car.hodometro} km). Confirmo que é um registro anterior ou que conferi o painel.</label>}
          <label style={{ display: 'block', margin: '16px 0' }}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={locked || speech.listening} /> Conferi o carro, o valor, o km, a categoria e a data.</label>
          {error && <p role="alert">{error}</p>}
          {locked && !saved && !busy && <p>O resultado pode ter sido salvo. Use “Verificar e tentar novamente”; a mesma identificação evita registrar duas vezes. Os campos ficam bloqueados até confirmar o resultado.</p>}
          <button className="btn-primary" type="button" onClick={save} disabled={busy || speech.listening || !confirmed || !car || (older && !oldKm)}>{busy ? 'Confirmando…' : locked ? 'Verificar e tentar novamente' : 'Confirmar e registrar gasto'}</button>
        </section>
      </>}
    </div>
  </MgShell>;
}
