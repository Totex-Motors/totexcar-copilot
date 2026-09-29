import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGESTOES = [
  "Como o Co-pilot mede meu consumo?",
  "Como funciona a análise de multas?",
  "Problema com meu pagamento",
  "Tenho uma sugestão de melhoria",
];

const BOAS_VINDAS: Msg = {
  role: "assistant",
  content: "Oi! Sou o suporte do TotexCar Co-pilot 👋 Posso te ajudar com o uso do app e do WhatsApp, consumo, multas, alertas… E se eu não resolver, aciono o responsável na hora. Como posso ajudar?",
};

// TELA SUPORTE — chat com IA (support-agent), escala pro responsável quando precisa. Padrão Minha Garagem.
export default function Suporte() {
  const { userId, loading } = useCurrentUser();
  const [msgs, setMsgs] = useState<Msg[]>([BOAS_VINDAS]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, sending]);

  const enviar = async (texto?: string) => {
    const content = (texto ?? input).trim();
    if (!content || sending) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const history = next.filter((m) => m !== BOAS_VINDAS);
      const { data, error } = await supabase.functions.invoke("support-agent", { body: { messages: history } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMsgs((p) => [...p, { role: "assistant", content: data.reply || "Desculpe, pode repetir?" }]);
      if (data?.escalated) setEscalated(true);
    } catch (e: any) {
      setMsgs((p) => [...p, { role: "assistant", content: "Tive um problema pra responder agora 😕 Tenta de novo em instantes — ou me chame no WhatsApp do Co-pilot." }]);
      console.error("suporte:", e?.message || e);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <MgShell title="Suporte" back="/"><div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand)" }} /></div></MgShell>;

  return (
    <MgShell title="Suporte" back="/">
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px", lineHeight: 1.4 }}>Atendimento com IA, na hora. Se algo precisar de uma pessoa, o responsável é acionado no WhatsApp automaticamente.</p>

        {escalated && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", background: "var(--good-soft)", borderColor: "transparent", fontSize: 13 }}>
            <CheckCircle2 size={16} style={{ color: "var(--good)", flex: "none" }} /> Chamado aberto! O responsável já foi notificado e vai te retornar.
          </div>
        )}

        <section className="card" style={{ display: "flex", flexDirection: "column", height: "62vh", minHeight: 420, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", borderRadius: 16, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "var(--brand)" : "var(--card-2)", color: m.role === "user" ? "#fff" : "var(--ink)",
                  borderTopRightRadius: m.role === "user" ? 4 : 16, borderTopLeftRadius: m.role === "user" ? 16 : 4,
                }}>
                  {m.role === "assistant" && i === 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}><Sparkles size={13} /> Suporte Co-pilot</span>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ background: "var(--card-2)", borderRadius: 16, borderTopLeftRadius: 4, padding: "12px 14px" }}><Loader2 size={16} className="animate-spin" style={{ color: "var(--brand)" }} /></div></div>}
            <div ref={endRef} />
          </div>

          {msgs.length <= 1 && (
            <div style={{ padding: "0 14px 8px", display: "flex", flexWrap: "wrap", gap: 7 }}>
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => enviar(s)} style={{ fontSize: 11.5, borderRadius: 999, border: "1px solid var(--brand-soft)", background: "var(--brand-soft)", color: "var(--brand)", padding: "6px 11px", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--line)", padding: 12, display: "flex", gap: 8 }}>
            <input className="field" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()} placeholder="Escreva sua dúvida…" disabled={sending || !userId} />
            <button className="sbtn brand" style={{ flex: "none", padding: "0 14px" }} onClick={() => enviar()} disabled={sending || !input.trim()} aria-label="Enviar"><Send size={16} /></button>
          </div>
        </section>
      </div>
    </MgShell>
  );
}
