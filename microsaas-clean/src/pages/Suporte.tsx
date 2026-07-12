import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LifeBuoy, Send, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
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
  content:
    "Oi! Sou o suporte do TotexCar Co-pilot 👋 Posso te ajudar com o uso do app e do WhatsApp, planos e pagamentos, consumo, multas, alertas… E se eu não resolver, aciono o responsável na hora. Como posso ajudar?",
};

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
      // manda só o histórico real da conversa (sem a boas-vindas estática)
      const history = next.filter((m) => m !== BOAS_VINDAS);
      const { data, error } = await supabase.functions.invoke("support-agent", {
        body: { messages: history },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMsgs((p) => [...p, { role: "assistant", content: data.reply || "Desculpe, pode repetir?" }]);
      if (data?.escalated) setEscalated(true);
    } catch (e: any) {
      setMsgs((p) => [...p, {
        role: "assistant",
        content: "Tive um problema pra responder agora 😕 Tenta de novo em instantes — ou me chame no WhatsApp do Co-pilot.",
      }]);
      console.error("suporte:", e?.message || e);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <LifeBuoy className="w-7 h-7 text-primary" /> Suporte
          </h1>
          <p className="text-muted-foreground">
            Atendimento com IA, na hora. Se algo precisar de uma pessoa, o responsável é acionado no WhatsApp automaticamente.
          </p>
        </div>

        {escalated && (
          <div className="flex items-center gap-2.5 rounded-xl border border-green-500/30 bg-green-500/[0.07] px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            Chamado aberto! O responsável já foi notificado e vai te retornar.
          </div>
        )}

        <Card className="border-0 shadow-premium-md">
          <CardContent className="p-0 flex flex-col h-[60vh] min-h-[420px]">
            {/* mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                    ${m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"}`}>
                    {m.role === "assistant" && i === 0 && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                        <Sparkles className="w-3.5 h-3.5" /> Suporte Co-pilot
                      </span>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* sugestões rápidas (só no início) */}
            {msgs.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)}
                    className="text-xs rounded-full border border-primary/30 bg-primary/5 text-primary px-3 py-1.5 hover:bg-primary/10 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
                placeholder="Escreva sua dúvida…"
                disabled={sending || !userId}
              />
              <Button onClick={() => enviar()} disabled={sending || !input.trim()} size="icon" className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
