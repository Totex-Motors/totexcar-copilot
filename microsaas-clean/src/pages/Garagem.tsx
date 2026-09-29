import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
  Warehouse, Search, Sparkles, RadarIcon, Banknote, Loader2, ExternalLink,
  Heart, Car, Trash2, CheckCircle2, Gauge, CalendarDays, ChevronDown, Calculator, X,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { toast } from "@/hooks/use-toast";
import {
  useGaragemSearch, useGaragemBrands, useOportunidades, useInteresse,
  useVenderAvaliar, useRadars, useSalvarRadar, useExcluirRadar, useVitrineListings,
  type GaragemCar, type GaragemFilters,
} from "@/hooks/useGaragem";

const brl = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v) : "—";

// Simulador de financiamento (Meu Credere) em bottom-sheet — mesma URL/iframe do marketplace.
function CredereSheet({ car, open, onClose }: { car: GaragemCar; open: boolean; onClose: () => void }) {
  const [height, setHeight] = useState(560);
  const src = (() => {
    const p = new URLSearchParams({
      pnp: "true", q: car.title, manufacture_year: String(car.year || ""), model_year: String(car.year || ""),
      value_cents: String(Math.round((car.price || 0) * 100)),
      viewport: String(typeof window !== "undefined" ? window.innerWidth : 400),
    });
    return `https://app.meucredere.com.br/simulador/loja/${car.financing_cnpj}/veiculo/detectar?${p.toString()}`;
  })();
  useEffect(() => {
    if (!open) return;
    const onMsg = (e: MessageEvent) => {
      const d = e?.data;
      if (d && d.type === "credere:resize" && typeof d.value === "number") setHeight(Math.max(320, d.value));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div><div style={{ fontWeight: 800, fontSize: 16 }}>Simular financiamento</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Condições dos nossos parceiros</div></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div style={{ background: "var(--card-2)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{car.title}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{car.year} · {brl(car.price)}</div>
        </div>
        <iframe title="Simulação de financiamento" src={src} allow="clipboard-write; web-share" style={{ width: "100%", border: 0, height }} />
      </div>
    </div>
  );
}

function CarCard({ car }: { car: GaragemCar }) {
  const interesse = useInteresse();
  const [sent, setSent] = useState(false);
  const [finOpen, setFinOpen] = useState(false);
  const abaixoFipe = car.fipe_price != null && car.price < car.fipe_price;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ height: 168, background: "var(--card-2)", position: "relative" }}>
        {car.photo
          ? <img src={car.photo} alt={car.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><Car size={40} style={{ color: "var(--faint)" }} /></div>}
        {abaixoFipe && <span className="tag ok" style={{ position: "absolute", top: 10, left: 10 }}>Abaixo da FIPE</span>}
        {car.is_particular && <span className="tag blue" style={{ position: "absolute", top: 10, right: 10 }}>Particular</span>}
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.2 }}>{car.title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{car.year} · {Number(car.km).toLocaleString("pt-BR")} km{car.dealership ? ` · ${car.dealership}` : ""}</div>
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "var(--brand)" }} className="mono">{brl(car.price)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
          {car.is_particular ? (
            <a href={car.url} target="_blank" rel="noreferrer"><button className="sbtn brand" style={{ width: "100%", justifyContent: "center" }}><ExternalLink size={15} /> Ver anúncio</button></a>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="sbtn brand" style={{ flex: 1, justifyContent: "center" }} disabled={interesse.isPending || sent}
                  onClick={() => interesse.mutate({ vehicle_id: car.id }, {
                    onSuccess: () => { setSent(true); toast({ title: "Interesse enviado! 🎉", description: "A loja vai entrar em contato com você." }); },
                    onError: (e: any) => toast({ title: "Não foi possível enviar", description: String(e?.message || e), variant: "destructive" }),
                  })}>
                  {sent ? <CheckCircle2 size={15} /> : <Heart size={15} />} {sent ? "Enviado" : "Tenho interesse"}
                </button>
                <a href={car.url} target="_blank" rel="noreferrer"><button className="sbtn" aria-label="Ver no site"><ExternalLink size={15} /></button></a>
              </div>
              {car.financing_enabled && car.financing_cnpj && (
                <button className="sbtn" style={{ width: "100%", justifyContent: "center", background: "#2f80ed", color: "#fff", borderColor: "transparent" }} onClick={() => setFinOpen(true)}>
                  <Calculator size={15} /> Simular financiamento
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {car.financing_enabled && car.financing_cnpj && <CredereSheet car={car} open={finOpen} onClose={() => setFinOpen(false)} />}
    </div>
  );
}

function CarGrid({ cars, loading, empty }: { cars?: GaragemCar[]; loading: boolean; empty: string }) {
  if (loading) return <div style={{ display: "grid", placeItems: "center", padding: "40px 0" }}><Loader2 size={26} className="animate-spin" style={{ color: "var(--brand)" }} /></div>;
  if (!cars?.length) return <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "32px 8px" }}>{empty}</p>;
  return <div className="stack">{cars.map((c) => <CarCard key={c.id} car={c} />)}</div>;
}

const TABS = [
  { v: "buscar", icon: Search, label: "Buscar", sub: "Todo o estoque" },
  { v: "oportunidades", icon: Sparkles, label: "Oportunidades", sub: "Pro seu perfil" },
  { v: "radar", icon: RadarIcon, label: "Ofertas pra mim", sub: "Deixe no radar" },
  { v: "vender", icon: Banknote, label: "Vender / Avaliar", sub: "Vistoria grátis" },
] as const;

export default function Garagem() {
  const { userId, userData, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);

  const [tab, setTab] = useState<(typeof TABS)[number]["v"]>("buscar");
  const [f, setF] = useState<GaragemFilters>({ limit: 12, page: 1 });
  const [applied, setApplied] = useState<GaragemFilters>({ limit: 12, page: 1 });
  const search = useGaragemSearch(applied, !!userId);
  const { data: brands } = useGaragemBrands(!!userId);
  const [accumCars, setAccumCars] = useState<GaragemCar[]>([]);

  useEffect(() => {
    const d = search.data;
    if (!d) return;
    setAccumCars((prev) => ((applied.page || 1) > 1 ? [...prev, ...d.cars] : d.cars));
  }, [search.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const oport = useOportunidades(!!userId);
  const radars = useRadars(!!userId);
  const salvarRadar = useSalvarRadar();
  const excluirRadar = useExcluirRadar();
  const vender = useVenderAvaliar();

  const [radarForm, setRadarForm] = useState({ brand: "", model: "", color: "", max_price: "", min_year: "", max_km: "", notes: "" });
  const [sellForm, setSellForm] = useState({ modo: "avaliar" as "vender" | "avaliar", data: "", horario: "10:00" });
  const [sellOk, setSellOk] = useState(false);
  const vitrine = useVitrineListings(!!userId);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#0C6E6A" }} /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const aplicar = () => setApplied({ ...f, page: 1 });
  const carregarMais = () => setApplied((p) => ({ ...p, page: (p.page || 1) + 1 }));
  const totalCars = search.data?.total ?? 0;
  const temMais = accumCars.length > 0 && accumCars.length < totalCars;
  const scope = search.data?.scope || oport.data?.scope || null;
  const vitrineFiltrados = (vitrine.data || []).filter((c) => {
    const q = (applied.search || "").toLowerCase().trim();
    if (q && !`${c.brand} ${c.model} ${c.version || ""} ${c.city || ""}`.toLowerCase().includes(q)) return false;
    if (applied.brand && c.brand.toLowerCase() !== applied.brand.toLowerCase()) return false;
    if (applied.max_price && c.price > applied.max_price) return false;
    if (applied.min_year && c.year < applied.min_year) return false;
    if (applied.max_km && c.km > applied.max_km) return false;
    return true;
  });
  const displayCars = [...vitrineFiltrados, ...accumCars];

  const enviarRadar = () => {
    salvarRadar.mutate({
      brand: radarForm.brand || undefined, model: radarForm.model || undefined, color: radarForm.color || undefined,
      max_price: Number(radarForm.max_price) || undefined, min_year: Number(radarForm.min_year) || undefined,
      max_km: Number(radarForm.max_km) || undefined, notes: radarForm.notes || undefined,
    }, {
      onSuccess: (r) => {
        toast({ title: "Radar ativado! 📡", description: r.matches.length ? `Já achamos ${r.matches.length} carro(s) parecidos!` : "A loja foi avisada — te chamamos quando aparecer." });
        setRadarForm({ brand: "", model: "", color: "", max_price: "", min_year: "", max_km: "", notes: "" });
      },
      onError: (e: any) => toast({ title: "Não foi possível salvar", description: e?.message === "informe_marca_modelo_ou_preco" ? "Informe pelo menos marca, modelo ou preço máximo." : String(e?.message || e), variant: "destructive" }),
    });
  };

  const enviarVenda = () => {
    vender.mutate({ modo: sellForm.modo, data: sellForm.data || undefined, horario: sellForm.horario || undefined }, {
      onSuccess: () => { setSellOk(true); toast({ title: sellForm.modo === "vender" ? "Pedido de venda enviado! 🎉" : "Avaliação agendada! 🎉", description: "A loja entra em contato pra confirmar." }); },
      onError: (e: any) => toast({ title: "Não foi possível enviar", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  const carroAtual = vehicle ? [vehicle.marca, vehicle.modelo, vehicle.ano_modelo].filter(Boolean).join(" ") : null;

  return (
    <MgShell title="Garagem Totex" back="/">
      <div className="stack">
        {/* intro */}
        <section className="hero">
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}><Warehouse size={13} /> Garagem Totex</div>
          <div style={{ fontSize: 19, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-.01em" }}>Seu carro atual e o caminho pro próximo.</div>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", lineHeight: 1.4 }}>Ache o próximo carro, avalie o atual e receba oportunidades do seu Co-pilot.</p>
          {(carroAtual || scope) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
              {carroAtual && <span className="trend"><Car size={12} /> {carroAtual}</span>}
              {scope && <span className="trend"><Warehouse size={12} /> Estoque da {scope}</span>}
            </div>
          )}
        </section>

        {/* seletor de modo */}
        <div className="grid">
          {TABS.map((t) => {
            const Ic = t.icon; const on = tab === t.v;
            return (
              <button key={t.v} onClick={() => setTab(t.v)} className="tile" style={{ minHeight: 0, cursor: "pointer", textAlign: "left", borderColor: on ? "var(--brand)" : "var(--line)", background: on ? "var(--brand-soft)" : "var(--card)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13.5, color: on ? "var(--brand)" : "var(--ink)" }}><Ic size={16} style={{ color: "var(--brand)" }} /> {t.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.sub}</span>
              </button>
            );
          })}
        </div>

        {/* ===== BUSCAR ===== */}
        {tab === "buscar" && (
          <>
            <section className="card pad">
              <label className="lbl">Buscar</label>
              <input className="field" placeholder="Corolla, SUV, Onix…" value={f.search || ""} onChange={(e) => setF((p) => ({ ...p, search: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && aplicar()} />
              <div className="formgrid" style={{ marginTop: 12 }}>
                <div><label className="lbl">Marca</label>
                  <select className="field" value={f.brand || ""} onChange={(e) => setF((p) => ({ ...p, brand: e.target.value || undefined }))}>
                    <option value="">Todas</option>
                    {(brands || []).map((b: any) => { const name = typeof b === "string" ? b : b?.brand || b?.name; return name ? <option key={name} value={name}>{name}</option> : null; })}
                  </select>
                </div>
                <div><label className="lbl">Preço até</label><input className="field" type="number" inputMode="numeric" placeholder="120000" value={f.max_price || ""} onChange={(e) => setF((p) => ({ ...p, max_price: Number(e.target.value) || undefined }))} /></div>
                <div><label className="lbl">Ano a partir de</label><input className="field" type="number" inputMode="numeric" placeholder="2020" value={f.min_year || ""} onChange={(e) => setF((p) => ({ ...p, min_year: Number(e.target.value) || undefined }))} /></div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button className="btn-primary" style={{ height: 46 }} onClick={aplicar} disabled={search.isFetching}>{search.isFetching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar</button>
                </div>
              </div>
            </section>
            {search.data && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px" }}>{totalCars + vitrineFiltrados.length} carro(s) {search.data.scope ? `da ${search.data.scope} + particulares` : "no estoque Totexmotors"}</p>}
            {search.isError && !displayCars.length ? (
              <div style={{ textAlign: "center", padding: "32px 8px" }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>O estoque está indisponível no momento (muitas buscas em sequência). Tente de novo em instantes.</p>
                <button className="sbtn" onClick={() => search.refetch()}><Search size={14} /> Tentar de novo</button>
              </div>
            ) : (
              <CarGrid cars={displayCars} loading={search.isLoading && (applied.page || 1) === 1} empty="Nenhum carro com esses filtros. Amplie a busca — ou deixe um radar em 'Ofertas pra mim'. 😉" />
            )}
            {temMais && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                <button className="sbtn" onClick={carregarMais} disabled={search.isFetching}>
                  {search.isFetching ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} Mostrar mais ({accumCars.length}/{totalCars})
                </button>
              </div>
            )}
          </>
        )}

        {/* ===== OPORTUNIDADES ===== */}
        {tab === "oportunidades" && (
          <>
            <div className="card pad" style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--muted)" }}>
              <Sparkles size={16} style={{ color: "var(--brand)", flex: "none", marginTop: 1 }} />
              {oport.data?.base?.tipo === "valor_compra" ? (
                <span>Selecionadas pelo Co-pilot com base no seu <b style={{ color: "var(--ink)" }}>{oport.data.base.carro}</b>{oport.data.base.ano ? ` ${oport.data.base.ano}` : ""} (ref. {brl(oport.data.base.valor)}): upgrades que cabem no seu momento.</span>
              ) : (
                <span>Destaques do estoque. 💡 Preencha o <b style={{ color: "var(--ink)" }}>valor pago no seu carro</b> em Meu veículo pra eu personalizar.</span>
              )}
            </div>
            <CarGrid cars={oport.data?.cars} loading={oport.isLoading} empty="Sem oportunidades agora — o estoque muda todo dia, volte em breve!" />
          </>
        )}

        {/* ===== RADAR ===== */}
        {tab === "radar" && (
          <>
            <section className="card pad">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><RadarIcon size={16} style={{ color: "var(--brand)" }} /> Deixe seu próximo carro no radar</div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Descreva o carro que quer. A loja fica sabendo na hora e te avisa quando ele aparecer.</p>
              <div className="formgrid">
                <div><label className="lbl">Marca</label><input className="field" placeholder="Toyota" value={radarForm.brand} onChange={(e) => setRadarForm((p) => ({ ...p, brand: e.target.value }))} /></div>
                <div><label className="lbl">Modelo</label><input className="field" placeholder="Corolla Cross" value={radarForm.model} onChange={(e) => setRadarForm((p) => ({ ...p, model: e.target.value }))} /></div>
                <div><label className="lbl">Cor (opcional)</label><input className="field" placeholder="Branco" value={radarForm.color} onChange={(e) => setRadarForm((p) => ({ ...p, color: e.target.value }))} /></div>
                <div><label className="lbl">Valor até (R$)</label><input className="field" type="number" inputMode="numeric" placeholder="150000" value={radarForm.max_price} onChange={(e) => setRadarForm((p) => ({ ...p, max_price: e.target.value }))} /></div>
                <div><label className="lbl">Ano a partir de</label><input className="field" type="number" inputMode="numeric" placeholder="2021" value={radarForm.min_year} onChange={(e) => setRadarForm((p) => ({ ...p, min_year: e.target.value }))} /></div>
                <div><label className="lbl">Km até</label><input className="field" type="number" inputMode="numeric" placeholder="60000" value={radarForm.max_km} onChange={(e) => setRadarForm((p) => ({ ...p, max_km: e.target.value }))} /></div>
              </div>
              <label className="lbl" style={{ marginTop: 12 }}>Observações (opcional)</label>
              <input className="field" placeholder="Prefiro automático, teto solar…" value={radarForm.notes} onChange={(e) => setRadarForm((p) => ({ ...p, notes: e.target.value }))} />
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={enviarRadar} disabled={salvarRadar.isPending}>{salvarRadar.isPending ? <Loader2 size={16} className="animate-spin" /> : <RadarIcon size={16} />} Ativar radar</button>
            </section>

            {(radars.data || []).map((r) => (
              <section key={r.id} className="card pad">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{[r.brand, r.model].filter(Boolean).join(" ") || "Qualquer carro"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{[r.min_year ? `a partir de ${r.min_year}` : "", r.max_km ? `até ${Number(r.max_km).toLocaleString("pt-BR")} km` : "", r.max_price ? `até ${brl(r.max_price)}` : "", r.color || ""].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    {r.lead_sent && <span className="tag ok">Loja avisada</span>}
                    <button className="sbtn" style={{ color: "var(--alert)", padding: "8px 9px" }} onClick={() => excluirRadar.mutate(r.id)} aria-label="Remover"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  {r.matches?.length
                    ? <><p style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginBottom: 10 }}>🎯 {r.matches.length} carro(s) no estoque agora:</p><CarGrid cars={r.matches} loading={false} empty="" /></>
                    : <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum carro assim no estoque ainda — seguimos de olho. 👀</p>}
                </div>
              </section>
            ))}
          </>
        )}

        {/* ===== VENDER / AVALIAR ===== */}
        {tab === "vender" && (
          <section className="card pad">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}><Banknote size={16} style={{ color: "var(--brand)" }} /> {carroAtual || "Seu veículo"}</div>
            {sellOk ? (
              <div style={{ display: "flex", gap: 10, borderRadius: 12, background: "var(--good-soft)", padding: 14, fontSize: 13 }}>
                <CheckCircle2 size={18} style={{ color: "var(--good)", flex: "none" }} />
                <span>Pedido enviado! A equipe Totexmotors entra em contato pra confirmar a vistoria.</span>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, lineHeight: 1.4 }}>
                  Agende uma <b style={{ color: "var(--ink)" }}>vistoria gratuita</b>: a loja avalia seu carro{vehicle?.hodometro ? ` (km atual: ${Number(vehicle.hodometro).toLocaleString("pt-BR")})` : ""} e faz uma proposta — pra vender ou dar de entrada na troca.
                </p>
                <div className="formgrid">
                  <div><label className="lbl">Quero…</label>
                    <select className="field" value={sellForm.modo} onChange={(e) => setSellForm((p) => ({ ...p, modo: e.target.value as any }))}>
                      <option value="avaliar">Avaliar meu veículo</option>
                      <option value="vender">Vender meu carro</option>
                    </select>
                  </div>
                  <div><label className="lbl" style={{ display: "flex", alignItems: "center", gap: 4 }}><CalendarDays size={12} /> Melhor dia</label><input className="field" type="date" min={new Date().toISOString().split("T")[0]} value={sellForm.data} onChange={(e) => setSellForm((p) => ({ ...p, data: e.target.value }))} /></div>
                  <div><label className="lbl">Horário</label>
                    <select className="field" value={sellForm.horario} onChange={(e) => setSellForm((p) => ({ ...p, horario: e.target.value }))}>
                      {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"].map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button className="btn-primary" style={{ height: 46 }} onClick={enviarVenda} disabled={vender.isPending || !vehicle}>{vender.isPending ? <Loader2 size={16} className="animate-spin" /> : <Gauge size={16} />} Solicitar</button>
                  </div>
                </div>
                {!vehicle && <p style={{ fontSize: 11.5, color: "var(--warn)", marginTop: 10 }}>Cadastre seu veículo em "Meu veículo" primeiro.</p>}
                <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>💡 Quer só uma referência rápida? Veja também <a href="/recompra" style={{ color: "var(--brand)", textDecoration: "underline" }}>Recompra FIPE</a>.</p>
              </>
            )}
          </section>
        )}

        <p className="foot-note">Estoque real da Totexmotors + carros de particulares — atualiza todo dia.</p>
      </div>
    </MgShell>
  );
}
