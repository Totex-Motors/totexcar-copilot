import { useEffect, useRef, useState } from 'react';

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((event: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start(): void; abort(): void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function useExpenseSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false), [error, setError] = useState('');
  const cancel = useRef<() => void>(() => {});
  const callback = useRef(onText); callback.current = onText;
  useEffect(() => () => cancel.current(), []);
  function stop() { cancel.current(); setListening(false); }
  function start() {
    stop(); setError(''); setListening(true);
    if (navigator.userAgent.includes('TotexVoice/1')) {
      const requestId = crypto.randomUUID();
      let timer: ReturnType<typeof setTimeout>;
      const cleanup = () => { clearTimeout(timer); window.removeEventListener('totex-voice-result', receive); };
      const receive = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail?.requestId !== requestId) return;
        cleanup(); setListening(false);
        if (typeof detail.text === 'string' && detail.text.trim()) callback.current(detail.text.slice(0, 1000));
        else setError('A fala não foi capturada. Tente novamente ou preencha os campos.');
      };
      cancel.current = cleanup;
      window.addEventListener('totex-voice-result', receive);
      timer = setTimeout(() => { cleanup(); setListening(false); setError('A captura terminou sem resposta. Você pode tentar de novo.'); }, 60000);
      window.location.href = `totexcar://voice/expense?request=${requestId}`;
      return;
    }
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setListening(false); setError('Este navegador não oferece ditado. Use o aplicativo Android atualizado ou preencha os campos.'); return; }
    const recognition = new Speech();
    recognition.lang = 'pt-BR'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
    const hidden = () => { if (document.hidden) stop(); };
    const cleanup = () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hidden); };
    const timer = setTimeout(() => stop(), 45000);
    document.addEventListener('visibilitychange', hidden);
    cancel.current = () => { cleanup(); recognition.onresult = null; recognition.onend = null; recognition.onerror = null; recognition.abort(); };
    recognition.onresult = event => { const text = event.results[0]?.[0]?.transcript; if (text) callback.current(text.slice(0, 1000)); };
    recognition.onerror = event => setError(event.error === 'not-allowed' ? 'Microfone não autorizado. Permita o acesso ou preencha os campos.' : 'Não foi possível entender. Tente novamente ou preencha os campos.');
    recognition.onend = () => { cleanup(); setListening(false); };
    try { recognition.start(); } catch { stop(); setError('A captura não pôde iniciar. Preencha os campos ou tente novamente.'); }
  }
  return { listening, error, start, stop };
}
