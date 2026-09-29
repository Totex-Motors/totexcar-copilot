import { useMemo, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Gift, Wallet, BadgeCheck, Hourglass, Share2, Copy, Store, Car, KeyRound, Save, ExternalLink } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  useMarketplaceFeed, useReferralEvents, useUpdatePixKey,
  carReferralLink, storeReferralLink, type MarketplaceCar,
} from "@/hooks/useReferral";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const COPILOT = "5511963786699";

function shareToFriend(link: string, msg: string) {
  try { navigator.clipboard?.writeText(link); } catch { /* */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${msg} ${link}`)}`, "_blank", "noopener");
}
function copilotShareLink(carId: string, code?: string | null): string {
  const inner = `Quero ver esse carro 🚗 #oferta ${carId}${code ? ` ind:${code}` : ""}`;
  return `https://wa.me/${COPILOT}?text=${encodeURIComponent(inner)}`;
}
async function shareSmart(text: string, url: string) {
  try { if (typeof navigator !== "undefined" && (navigator as any).share) { await (navigator as any).share({ text, url }); return; } } catch { return; }
  try { await navigator.clipboard?.writeText(`${text} ${url}`); } catch { /* */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
}

// TELA INDIQUE E GANHE — comissão por venda + brinde pro amigo. Padrão Minha Garagem.
export default function Indique() {
  const { userData, userId, loading } = useCurrentUser();
  const { data: feed, isLoading: loadingFeed } = useMarketplaceFeed(!!userId);
  const { data: events } = useReferralEvents(userId);
  const updatePix = useUpdatePixKey();

  const [pix, setPix] = useState("");
  useEffect(() => { if (userData?.pix_key != null) setPix(userData.pix_key); }, [userData?.pix_key]);

  const code = (feed?.referral_code || userData?.referral_code) as string | undefined;
  const storeName = feed?.dealership?.name || userData?.dealership || "Totexmotors";
  const offer = feed?.buyer_offer || "Transferência grátis";
  const cars = feed?.cars || [];

  const stats = useMemo(() => {
    const list = events || [];
    const sales = list.filter((e) => e.type === "sale");
    const aReceber = sales.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.value || 0), 0);
    const pago = sales.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.value || 0), 0);
    return { vendas: sales.length, aReceber, pago };
  }, [events]);

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast({ title: "Link copiado!" }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };

  const shareStore = () => {
    const link = storeReferralLink(feed?.dealership?.url, code);
    if (!link) { toast({ title: "Loja indisponível no marketplace", variant: "destructive" }); return; }
    shareToFriend(link, `Conheça os carros da ${storeName}! Pela minha indicação você ganha: ${offer}. Veja o estoque:`);
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  return (
    <MgShell title="Indique e Ganhe" back="/">
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px", lineHeight: 1.4 }}>
          Compartilhe os carros da {storeName}: <b style={{ color: "var(--ink)" }}>você ganha comissão em dinheiro</b> por venda e <b style={{ color: "var(--brand)" }}>seu amigo ganha {offer}</b> 🎁.
        </p>

        {/* KPIs */}
        <div className="kpi">
          <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><BadgeCheck size={12} /> Vendas</div><div className="v mono">{stats.vendas}</div></div>
          <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Hourglass size={12} /> A receber</div><div className="v mono" style={{ color: "var(--gain)" }}>{brl(stats.aReceber)}</div></div>
        </div>
        <div className="kpi">
          <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Wallet size={12} /> Recebido</div><div className="v mono" style={{ color: "var(--good)" }}>{brl(stats.pago)}</div></div>
          <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Share2 size={12} /> Seu código</div><div className="v mono" style={{ letterSpacing: ".08em" }}>{code || "—"}</div></div>
        </div>

        {/* indicar o Co-pilot */}
        <section className="card pad">
          <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 7 }}><Gift size={18} style={{ color: "var(--brand)" }} /> Indique o Co-pilot e ganhe +30 dias</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 12px", lineHeight: 1.4 }}>
            Amigo se cadastra pelo seu link e registra o carro → depois de 7 dias de uso, <b style={{ color: "var(--ink)" }}>você ganha 30 dias grátis no seu plano</b> (até 12x/ano).
          </p>
          <button className="btn-primary" disabled={!code} onClick={() => {
            const link = `${window.location.origin}/auth?tab=register&ref=${encodeURIComponent(code || "")}`;
            shareToFriend(link, "Estou usando o TotexCar Co-pilot pra cuidar do meu carro pelo WhatsApp (gastos, revisao, multas, FIPE). Cadastre-se pelo meu link:");
          }}><Share2 size={16} /> Indicar pelo WhatsApp</button>
        </section>

        {/* recebimento (PIX) + indicar a loja */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}><KeyRound size={16} style={{ color: "var(--brand)" }} /> Recebimento</div>
          <label className="lbl">Sua chave PIX (para receber as comissões)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
            <button className="sbtn" style={{ flex: "none" }} disabled={updatePix.isPending || !userId} onClick={() => userId && updatePix.mutate({ userId, pixKey: pix.trim() }, {
              onSuccess: () => toast({ title: "Chave PIX salva" }),
              onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
            })}><Save size={15} /></button>
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>A loja usa essa chave pra te pagar a comissão das vendas confirmadas.</p>
          {feed?.dealership?.url && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <label className="lbl" style={{ display: "flex", alignItems: "center", gap: 5 }}><Store size={14} /> Indicar a {storeName}</label>
              <button className="btn-primary" onClick={shareStore}><Share2 size={16} /> Compartilhar a loja</button>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Link da loja no marketplace com o seu código.</p>
            </div>
          )}
        </section>

        {/* histórico */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Minhas indicações ({events?.length || 0})</div>
          {events && events.length ? (
            <section className="card" style={{ maxHeight: 340, overflow: "auto" }}>
              {events.map((e) => (
                <div key={e.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{e.car_title || e.dealership || "Indicação"}</div>
                    <div className="s">{e.type === "sale" ? "Venda" : e.type === "lead" ? "Lead" : "Clique"} · {new Date(e.created_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    {e.type === "sale" && <span style={{ fontWeight: 700, fontSize: 13.5 }}>{brl(e.value)}</span>}
                    {e.type === "sale" && (e.status === "paid" ? <span className="tag ok">pago</span> : <span className="tag due">a receber</span>)}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div className="card pad" style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Você ainda não tem indicações. Compartilhe um carro abaixo pra começar!</div>
          )}
        </div>

        {/* feed de carros */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px", display: "flex", alignItems: "center", gap: 6 }}><Car size={13} /> Carros da {storeName} pra indicar ({cars.length})</div>
          {loadingFeed ? (
            <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Carregando o estoque...</div>
          ) : cars.length ? (
            <div className="stack">{cars.map((c) => <RefCarCard key={c.id} car={c} code={code} storeName={storeName} offer={offer} onCopy={copy} />)}</div>
          ) : (
            <div className="card pad" style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
              {feed?.reason === "owner_without_dealership" ? "Sua conta ainda não está vinculada a uma loja."
                : feed?.reason === "dealership_not_found" ? `Não encontramos a loja "${storeName}" no marketplace.`
                : "Sua loja não tem carros ativos no momento."}
            </div>
          )}
        </div>

        <p className="foot-note">Compartilhe em 1 toque — grupos, status ou pra um amigo. A comissão cai no seu PIX quando a venda é confirmada.</p>
      </div>
    </MgShell>
  );
}

function RefCarCard({ car, code, storeName, offer, onCopy }: { car: MarketplaceCar; code?: string; storeName: string; offer: string; onCopy: (link: string) => void }) {
  const mkLink = carReferralLink(car.url, code);
  const coLink = copilotShareLink(car.id, code);
  const preco = car.price != null ? brl(Number(car.price)) : "Consulte";
  const post = `Olha esse ${car.title} (${preco}) na ${storeName}! Pela minha indicação você ganha ${offer}. Chama aqui que já te mostro tudo:`;
  return (
    <div className="card" style={{ overflow: "hidden", display: "flex" }}>
      <a href={mkLink} target="_blank" rel="noreferrer" style={{ width: 120, background: "var(--card-2)", flex: "none", display: "block" }}>
        {car.photo_url
          ? <img src={car.photo_url} alt={car.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><Car size={30} style={{ color: "var(--faint)" }} /></div>}
      </a>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{car.title}</div>
        <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: "var(--brand)" }}>{preco}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[car.km != null ? `${Number(car.km).toLocaleString("pt-BR")} km` : null, car.color, car.fuel].filter(Boolean).join(" · ")}</div>
        <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 6 }}>
          <button className="sbtn brand" style={{ flex: 1, justifyContent: "center" }} onClick={() => shareSmart(post, coLink)}><Share2 size={14} /> Indicar</button>
          <button className="sbtn" onClick={() => onCopy(`${post} ${coLink}`)} aria-label="Copiar post"><Copy size={14} /></button>
          <a href={mkLink} target="_blank" rel="noreferrer"><button className="sbtn" aria-label="Ver ficha"><ExternalLink size={14} /></button></a>
        </div>
      </div>
    </div>
  );
}
