import React, { useState } from "react";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// LGPD: o próprio cliente apaga a conta e os dados do app (edge function minha-conta).
type Resumo = { carros: number; gastos: number; documentos: number; conversas: number; leituras_km: number; lembretes: number; premium_ate: string | null };

async function chamar(body: any) {
  const { data, error } = await supabase.functions.invoke("minha-conta", { body });
  let p: any = data;
  if (error) { try { p = await (error as any).context.json(); } catch { throw error; } }
  return p;
}

export function ExcluirConta({ onExcluida }: { onExcluida: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const abrir = async () => {
    setAberto(true); setCarregando(true);
    try {
      const r = await chamar({ acao: "resumo" });
      if (r?.error === "conta_de_loja") { toast({ title: "Conta de loja", description: "Conta de loja ou de administrador não é excluída por aqui. Fale com o suporte.", variant: "destructive" }); setAberto(false); return; }
      if (r?.ok) setResumo(r);
    } catch { /* mostra sem os números */ } finally { setCarregando(false); }
  };

  const excluir = async () => {
    if (texto.trim().toUpperCase() !== "EXCLUIR") return;
    setExcluindo(true);
    try {
      const r = await chamar({ acao: "excluir", confirmacao: "EXCLUIR" });
      if (!r?.ok) throw new Error(r?.error || "erro");
      toast({ title: "Conta excluída", description: "Seus dados foram apagados. Obrigado por usar o Co-pilot." });
      onExcluida();
    } catch (e: any) {
      toast({ title: "Não consegui excluir tudo", description: e?.message === "exclusao_parcial" ? "Parte dos dados foi apagada. Tente de novo ou fale com o suporte." : "Tente de novo em instantes.", variant: "destructive" });
      setExcluindo(false);
    }
  };

  const n = (v: number | undefined, um: string, varios: string) => (v ? `${v} ${v === 1 ? um : varios}` : null);
  const itens = resumo ? [n(resumo.carros, "carro", "carros"), n(resumo.gastos, "gasto", "gastos"), n(resumo.documentos, "documento", "documentos"), n(resumo.leituras_km, "leitura de km", "leituras de km"), n(resumo.lembretes, "lembrete", "lembretes"), n(resumo.conversas, "mensagem", "mensagens")].filter(Boolean) : [];

  return (
    <div>
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><ShieldAlert size={16} /> Privacidade e dados</div>
      <section className="card pad">
        {!aberto ? (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Você pode apagar sua conta e todos os seus dados do Co-pilot quando quiser (LGPD).</p>
            <button className="sbtn" style={{ width: "100%", justifyContent: "center", color: "#B42318", marginTop: 10 }} onClick={abrir}>
              <Trash2 size={16} /> Excluir minha conta e meus dados
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, color: "#B42318", marginBottom: 6 }}>Isso apaga tudo, de vez. Não dá pra desfazer.</div>
            {carregando ? <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--muted)" }}><Loader2 size={14} className="animate-spin" /> Vendo o que tem na sua conta…</div> : itens.length > 0 && (
              <p style={{ margin: "0 0 6px" }}>Hoje sua conta tem: <b>{itens.join(", ")}</b>.</p>
            )}
            <p style={{ margin: "0 0 4px" }}><b>Vamos apagar:</b> seu cadastro e login, carro(s), gastos, km, lembretes, vencimentos, financiamentos, multas, documentos e CNH guardados, relatórios, conversas e memória do Co-pilot, avisos de valor e pontos de fidelidade.</p>
            <p style={{ margin: "0 0 4px", color: "var(--muted)" }}><b>Fica guardado, sem ligação com você no app:</b> os registros da compra na loja parceira (entrega, garantia e revisões feitas por ela) e os comprovantes de pagamento, que a lei obriga a manter.</p>
            {resumo?.premium_ate && <p style={{ margin: "0 0 4px", color: "#B42318" }}>Seu Premium vale até {new Date(resumo.premium_ate).toLocaleDateString("pt-BR")}. Excluindo, você perde esse período.</p>}
            <label className="lbl" style={{ marginTop: 10 }}>Para confirmar, digite EXCLUIR</label>
            <input className="field" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="EXCLUIR" autoCapitalize="characters" style={{ textTransform: "uppercase" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="sbtn" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setAberto(false); setTexto(""); }} disabled={excluindo}>Cancelar</button>
              <button className="sbtn" style={{ flex: 1, justifyContent: "center", background: "#B42318", color: "#fff", opacity: texto.trim().toUpperCase() === "EXCLUIR" ? 1 : 0.5 }} onClick={excluir} disabled={excluindo || texto.trim().toUpperCase() !== "EXCLUIR"}>
                {excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Excluir de vez
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
