import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Pedágio FREE FLOW (sem cancela): cobranças que o cliente informou pra Nina lembrar antes de vencer.
// O Co-pilot não descobre passagens sozinho — o pagamento aqui é o que o CLIENTE informou.
const WA = "5511963786699";
const WA_LINK = `https://wa.me/${WA}?text=${encodeURIComponent("Oi! Passei por um pedágio sem cancela (Free Flow). Vou te mandar a cobrança 🚧")}`;
const brl = (v: number | null) => (v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : null);
const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : null);
const dias = (d: string | null) => (d ? Math.ceil((new Date(d + "T23:59:59").getTime() - Date.now()) / 86400000) : null);

type Pedagio = { id: string; concessionaria: string | null; rodovia: string | null; local: string | null; data_passagem: string | null; valor: number | null; vencimento: string | null; status: string; pago_em: string | null };

export function PedagiosFreeFlow({ userId }: { userId?: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pedagios", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pedagios").select("*").neq("status", "cancelado").order("vencimento", { ascending: true, nullsFirst: false }).limit(30);
      if (error) return [] as Pedagio[]; // tabela ainda não criada: só mostra o convite
      return (data || []) as Pedagio[];
    },
  });
  const pendentes = (data || []).filter((p) => p.status === "pendente");
  const pagos = (data || []).filter((p) => p.status === "pago").slice(0, 3);

  const marcarPago = async (id: string) => {
    const { error } = await (supabase as any).from("pedagios").update({ status: "pago", pago_em: new Date().toISOString(), pago_informado_por: "cliente" }).eq("id", id);
    if (error) { toast({ title: "Não consegui marcar", variant: "destructive" }); return; }
    toast({ title: "Marcado como pago ✅", description: "Paro de te lembrar desse." });
    qc.invalidateQueries({ queryKey: ["pedagios", userId] });
  };

  return (
    <div>
      <div className="sec-title" style={{ marginBottom: 10 }}>🚧 Pedágio sem cancela (Free Flow)</div>
      {pendentes.length > 0 && (
        <section className="card pad" style={{ marginBottom: 10 }}>
          {pendentes.map((p, i) => {
            const d = dias(p.vencimento);
            const cor = d == null ? "var(--muted)" : d < 0 ? "#B42318" : d <= 3 ? "#B54708" : "var(--muted)";
            return (
              <div key={p.id} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                  <div style={{ fontWeight: 700 }}>{[p.concessionaria, p.rodovia].filter(Boolean).join(" · ") || "Passagem Free Flow"}{brl(p.valor) ? ` · ${brl(p.valor)}` : ""}</div>
                  <div style={{ fontSize: 12, color: cor }}>
                    {p.vencimento ? (d! < 0 ? `Venceu em ${fmt(p.vencimento)}` : d === 0 ? "Vence HOJE" : `Vence em ${fmt(p.vencimento)} (${d} dia${d === 1 ? "" : "s"})`) : "Sem vencimento ainda: confira no app CNH do Brasil"}
                    {p.data_passagem ? ` · passou em ${fmt(p.data_passagem)}` : ""}
                  </div>
                </div>
                <button className="sbtn" style={{ flex: "none" }} onClick={() => marcarPago(p.id)}><CheckCircle2 size={14} /> Já paguei</button>
              </div>
            );
          })}
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Pague no site ou app da concessionária. Confira as passagens no app CNH do Brasil → Veículos → Pedágio Eletrônico.</p>
        </section>
      )}
      {pagos.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
          Pagos (informado por você): {pagos.map((p) => [p.concessionaria || p.rodovia || "passagem", brl(p.valor)].filter(Boolean).join(" ")).join(" · ")}
        </p>
      )}
      <a className="copilot" href={WA_LINK} target="_blank" rel="noreferrer">
        <span className="av"><MessageCircle size={22} /></span>
        <div>
          <div className="t">Passou por pedágio sem cancela?</div>
          <div className="s">Me manda a cobrança (foto ou print) ou me conta onde passou: eu guardo o vencimento e te lembro até você pagar.</div>
        </div>
        <span className="go"><ChevronRight size={18} /></span>
      </a>
    </div>
  );
}
