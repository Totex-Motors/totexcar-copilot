import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Banknote, Car, TrendingUp, Loader2, CheckCircle2, Info } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  useFipeBrands, useFipeModels, useFipeYears, useFipePrice,
  useMyBuyback, useCreateBuyback,
} from "@/hooks/useBuyback";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Enviado", cls: "due" },
  contacted: { label: "Em contato", cls: "new" },
  closed: { label: "Concluído", cls: "ok" },
  declined: { label: "Recusado", cls: "mut" },
};

// TELA RECOMPRA — avalia o carro pela FIPE e pede proposta de recompra à loja. Padrão Minha Garagem.
export default function Recompra() {
  const { userData, userId, loading } = useCurrentUser();
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  const { data: brands, isLoading: lb } = useFipeBrands(!!userId);
  const { data: models, isLoading: lm } = useFipeModels(brand);
  const { data: years, isLoading: ly } = useFipeYears(brand, model);
  const { data: price, isLoading: lp } = useFipePrice(brand, model, year);
  const { data: myReqs } = useMyBuyback(!!userId);
  const create = useCreateBuyback();

  const dealership = userData?.dealership as string | undefined;
  const onBrand = (v: string) => { setBrand(v); setModel(null); setYear(null); };
  const onModel = (v: string) => { setModel(v); setYear(null); };

  const handleRequest = () => {
    if (!price) return;
    create.mutate(
      { brand: price.fipe.brand, model: price.fipe.model, year: String(price.fipe.year), fuel: price.fipe.fuel, fipe_code: price.fipe.code, fipe_value: price.fipe.value, offer_pct: price.offer_pct },
      {
        onSuccess: () => { toast({ title: "Proposta solicitada! 🎉", description: "A loja vai entrar em contato." }); setBrand(null); setModel(null); setYear(null); },
        onError: (e: any) => toast({ title: "Não foi possível enviar", description: e?.message === "owner_without_dealership" ? "Sua conta não está vinculada a uma loja." : String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  return (
    <MgShell title="Recompra do carro" back="/">
      <div className="stack">
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 2px", lineHeight: 1.4 }}>
          {dealership ? <>A <b style={{ color: "var(--ink)" }}>{dealership}</b> recompra o seu carro por até <b style={{ color: "var(--brand)" }}>{price?.offer_pct ?? 90}% da FIPE</b>. Avalie agora.</>
            : "Avalie seu carro pela FIPE e receba uma proposta de recompra da loja parceira."}
        </p>

        {!dealership && (
          <div className="card" style={{ display: "flex", gap: 10, padding: "12px 13px", background: "var(--gain-soft)", borderColor: "transparent" }}>
            <Info size={16} style={{ color: "var(--warn)", flex: "none", marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: "var(--ink)" }}>Sua conta ainda não está vinculada a uma loja parceira — você consegue avaliar, mas o pedido só é enviado quando houver uma loja vinculada.</span>
          </div>
        )}

        {/* avaliação FIPE */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}><Car size={16} style={{ color: "var(--brand)" }} /> Avalie seu carro (FIPE)</div>
          <label className="lbl">Marca</label>
          <select className="field" value={brand ?? ""} onChange={(e) => onBrand(e.target.value)} disabled={lb}>
            <option value="">{lb ? "Carregando..." : "Selecione a marca"}</option>
            {(brands || []).map((b) => <option key={String(b.codigo)} value={String(b.codigo)}>{b.nome}</option>)}
          </select>
          <label className="lbl" style={{ marginTop: 12 }}>Modelo</label>
          <select className="field" value={model ?? ""} onChange={(e) => onModel(e.target.value)} disabled={!brand || lm}>
            <option value="">{!brand ? "Escolha a marca antes" : lm ? "Carregando..." : "Selecione o modelo"}</option>
            {(models || []).map((m) => <option key={String(m.codigo)} value={String(m.codigo)}>{m.nome}</option>)}
          </select>
          <label className="lbl" style={{ marginTop: 12 }}>Ano</label>
          <select className="field" value={year ?? ""} onChange={(e) => setYear(e.target.value)} disabled={!model || ly}>
            <option value="">{!model ? "Escolha o modelo antes" : ly ? "Carregando..." : "Selecione o ano"}</option>
            {(years || []).map((y) => <option key={String(y.codigo)} value={String(y.codigo)}>{y.nome}</option>)}
          </select>
        </section>

        {/* oferta */}
        {(lp || price) && (
          <section className="card pad" style={{ background: "var(--brand-soft)", borderColor: "transparent" }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}><TrendingUp size={16} style={{ color: "var(--brand)" }} /> Sua oferta de recompra</div>
            {lp ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}><Loader2 size={22} className="animate-spin" style={{ color: "var(--brand)" }} /></div>
            ) : price ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>Tabela FIPE</span>
                  <span style={{ color: "var(--muted)", textDecoration: "line-through" }}>{brl(price.fipe.value)}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>A loja paga até ({price.offer_pct}% da FIPE)</div>
                  <div className="mono" style={{ fontSize: 34, fontWeight: 800, color: "var(--brand)", lineHeight: 1.1 }}>{brl(price.offer_value)}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{price.fipe.brand} {price.fipe.model} · {price.fipe.year} · {price.fipe.fuel}</div>
                <button className="btn-primary" style={{ marginTop: 14 }} onClick={handleRequest} disabled={create.isPending}>{create.isPending ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : "Quero receber a proposta"}</button>
                <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>Valor de referência. A oferta final depende da avaliação do veículo pela loja.</p>
              </>
            ) : null}
          </section>
        )}

        {/* meus pedidos */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Meus pedidos de recompra ({myReqs?.length || 0})</div>
          {myReqs && myReqs.length ? (
            <section className="card">
              {myReqs.map((r) => {
                const st = STATUS[r.status] || STATUS.new;
                return (
                  <div key={r.id} className="list-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t">{[r.brand, r.model, r.year].filter(Boolean).join(" ")}</div>
                      <div className="s">FIPE {brl(Number(r.fipe_value))} · oferta {brl(Number(r.offer_value))} · {new Date(r.created_at).toLocaleDateString("pt-BR")}</div>
                    </div>
                    <span className={`tag ${st.cls}`} style={{ alignSelf: "center" }}>{st.label}</span>
                  </div>
                );
              })}
            </section>
          ) : (
            <div className="card pad" style={{ textAlign: "center" }}>
              <CheckCircle2 size={30} style={{ opacity: .4, margin: "4px auto", color: "var(--brand)" }} />
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Você ainda não pediu nenhuma recompra.</div>
            </div>
          )}
        </div>

        <p className="foot-note">O valor da FIPE é referência — a oferta final sai depois da vistoria presencial da loja.</p>
      </div>
    </MgShell>
  );
}
