import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Wrench, Truck, CircleDot, KeyRound, LifeBuoy, Disc3, Zap, BatteryCharging, Wind, SprayCan,
  Sparkles, ClipboardCheck, PlugZap, Frame, MapPin, Phone, MessageCircle, Star, Clock, Loader2,
  Navigation, ShieldCheck, Stamp, Ticket, Gift, Handshake, ChevronRight,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useRadar, SERVICOS, type RadarProvider } from "@/hooks/useRadar";
import { toast } from "@/hooks/use-toast";

const WA = "5511963786699";
const ICONS: Record<string, any> = {
  oficina: Wrench, guincho: Truck, borracharia: CircleDot, chaveiro: KeyRound, socorro: LifeBuoy,
  freios: Disc3, autoeletrica: Zap, bateria: BatteryCharging, pneus: CircleDot, vidros: Frame,
  ar_condicionado: Wind, funilaria: SprayCan, estetica: Sparkles, vistoria: ClipboardCheck, eletrico_hibrido: PlugZap,
};
const EMERG = ["guincho", "borracharia", "chaveiro", "socorro"];

const HONRA_KEY = "radar_honra_pendente";

// Fotos dos serviços (public/servicos/<valor>.webp, ~25 KB cada, mesmo estilo de luz e cor).
// Serviço sem foto ainda aparece no mesmo card, em verde com o ícone.
const FOTOS = new Set(["oficina", "freios", "estetica", "vidros", "ar_condicionado"]);
const fotoDe = (v: string | null | undefined) => (v && FOTOS.has(v) ? `/servicos/${v}.webp` : null);

export default function Servicos() {
  const { loading, result, buscar, registrarAcao } = useRadar();
  const [loc, setLoc] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const usarLocal = () => {
    if (!navigator.geolocation) { toast({ title: "Localização indisponível", description: "Digite o bairro ou cidade." }); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); toast({ title: "Localização pega ✅" }); },
      () => toast({ title: "Não consegui a localização", description: "Digite o bairro ou cidade." }),
    );
  };

  const rodar = async (service_type: string) => {
    if (!coords && !loc.trim()) { toast({ title: "Onde você está?", description: "Toque em 'Usar localização' ou digite o bairro/cidade." }); return; }
    setSel(service_type);
    const emergency = SERVICOS.find((s) => s.value === service_type)?.emergencia;
    await buscar({ service_type, mode: "balanced", emergency, location_text: loc.trim() || undefined, latitude: coords?.lat, longitude: coords?.lng });
  };

  const abrir = (url: string | null | undefined, pid: string | null | undefined, tipo: string, partnerId?: string | null) => {
    if (!url) return;
    if (pid) registrarAcao(pid, tipo, result?.search_id, partnerId);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Clube de Parceiros: abre o WhatsApp do parceiro já com o benefício + código de resgate
  const resgatar = (p: RadarProvider) => {
    const zap = String(p.whatsapp || p.phone || "").replace(/\D/g, "");
    if (!zap) { toast({ title: "Parceiro sem WhatsApp cadastrado", description: "Use Ligar ou Rota." }); return; }
    const msg = `Oi! Vim pelo TotexCar Co-pilot 🚗 e quero usar o benefício: ${p.benefit}${p.partner_code ? ` (código ${String(p.partner_code).toUpperCase()})` : ""}.`;
    abrir(`https://wa.me/55${zap}?text=${encodeURIComponent(msg)}`, p.provider_id, "redeemed_benefit", p.partner_id);
    // regra do topo: na próxima visita (depois de 30 min) a gente pergunta se o benefício foi aplicado
    try { localStorage.setItem(HONRA_KEY, JSON.stringify({ provider_id: p.provider_id, partner_id: p.partner_id, name: p.name, benefit: p.benefit, ts: Date.now() })); } catch { /* */ }
  };

  // pergunta "o benefício foi aplicado?" — alimenta a regra do topo (quem não honra, desce)
  const [pendHonra, setPendHonra] = useState<{ provider_id?: string | null; partner_id?: string | null; name: string; benefit?: string | null; ts: number } | null>(() => {
    try {
      const raw = localStorage.getItem(HONRA_KEY); if (!raw) return null;
      const v = JSON.parse(raw); const age = Date.now() - Number(v.ts || 0);
      return age > 30 * 60 * 1000 && age < 14 * 24 * 3600 * 1000 ? v : null;
    } catch { return null; }
  });
  const responderHonra = async (ok: boolean) => {
    if (!pendHonra) return;
    if (pendHonra.provider_id) await registrarAcao(pendHonra.provider_id, ok ? "benefit_honored" : "benefit_not_honored", null, pendHonra.partner_id);
    try { localStorage.removeItem(HONRA_KEY); } catch { /* */ }
    setPendHonra(null);
    toast({ title: ok ? "Valeu! Isso mantém o parceiro no topo." : "Anotado. Parceiro que não honra o benefício perde posição." });
  };

  const emergencias = SERVICOS.filter((s) => EMERG.includes(s.value));
  const demais = SERVICOS.filter((s) => !EMERG.includes(s.value));

  return (
    <MgShell tab="servicos">
      <div className="stack">
        <div className="sec-title" style={{ fontSize: 20, marginTop: 2 }}>Serviços</div>
        <p className="s" style={{ color: "var(--muted)", fontSize: 13, margin: "-6px 2px 0" }}>Oficina, guincho, borracharia, chaveiro — a gente acha, compara e mostra as opções perto de você.</p>

        {/* regra do topo: feedback do último resgate */}
        {pendHonra && (
          <div className="card pad" style={{ borderLeft: "4px solid var(--brand)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Você resgatou um benefício em {pendHonra.name}.</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{pendHonra.benefit ? `"${pendHonra.benefit}" — ` : ""}foi aplicado? Sua resposta decide quem fica no topo.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn-primary" style={{ height: 38, fontSize: 14, flex: 1 }} onClick={() => responderHonra(true)}>Sim, foi aplicado</button>
              <button className="sbtn" style={{ height: 38, flex: 1, justifyContent: "center" }} onClick={() => responderHonra(false)}>Não foi</button>
            </div>
          </div>
        )}

        {/* localização */}
        <div style={{ display: "flex", gap: 8 }}>
          <input className="field" placeholder="Bairro ou cidade" value={loc} onChange={(e) => setLoc(e.target.value)} />
          <button className={`sbtn ${coords ? "brand" : ""}`} style={{ flex: "none" }} onClick={usarLocal}><Navigation size={15} /> {coords ? "Ok" : "Usar"}</button>
        </div>

        {/* emergência */}
        <div>
          <div className="eyebrow" style={{ margin: "2px 2px 8px" }}>Precisa agora?</div>
          <div className="catgrid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {emergencias.map((s) => {
              const Ic = ICONS[s.value] || Wrench;
              return (
                <button key={s.value} className={`cat em ${sel === s.value ? "on" : ""}`} onClick={() => rodar(s.value)}>
                  <span className="ci"><Ic size={18} /></span><span className="cl">{s.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* categorias */}
        <div>
          <div className="eyebrow" style={{ margin: "2px 2px 8px" }}>Todos os serviços</div>
          <div className="svc-grid">
            {demais.map((s) => {
              const Ic = ICONS[s.value] || Wrench;
              const foto = fotoDe(s.value);
              return (
                <button key={s.value} className={`svc ${sel === s.value ? "on" : ""}`} onClick={() => rodar(s.value)}>
                  {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="si"><Ic size={18} /></span>}
                  <span className="sl">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* resultados */}
        {loading && <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}><Loader2 className="animate-spin" style={{ display: "inline" }} size={22} /><div style={{ marginTop: 6, fontSize: 13 }}>Procurando perto de você...</div></div>}
        {!loading && result && (
          <div>
            <div className="svc-hero">
              {fotoDe(sel) && <img src={fotoDe(sel)!} alt="" />}
              <div className="ht">
                <small>{result.providers?.length || 0} opções perto de você</small>
                <h2>{result.service_label}</h2>
                {result.location_text && !/^coordenadas/i.test(result.location_text) && <p>{result.location_text}</p>}
              </div>
            </div>
            <div className="stack">
              {(result.providers || []).map((p, i) => (
                <div key={p.provider_id || i} className="card pad">
                  {/* foto do lugar (Google Places) — igual aos cards do Modo Viagem; some se não carregar */}
                  {p.photo_url && (
                    <img src={p.photo_url} alt={p.name} loading="lazy" referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 12, marginBottom: 10, display: "block", background: "var(--brand-soft)" }} />
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="prov-name">{p.name} {p.provider_status === "parceiro_totex" && <span className="badge-p">{p.top ? "No topo" : "Parceiro"}</span>}</div>
                      {p.category && p.category !== result.service_label && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.category}</div>}
                      {p.address && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, display: "flex", gap: 4 }}><MapPin size={13} style={{ flex: "none", marginTop: 1 }} /> {p.address}</div>}
                    </div>
                    {p.distance_km != null && <span style={{ color: "var(--brand)", fontWeight: 700, flex: "none" }}>{Number(p.distance_km).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km</span>}
                  </div>
                  <div className="prov-sig">
                    {p.rating != null && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Star size={13} style={{ fill: "#F5B301", color: "#F5B301" }} /> <b style={{ color: "var(--ink)" }}>{p.rating.toFixed(1)}</b>{p.review_count != null && ` (${p.review_count})`}</span>}
                    {p.open_now === true && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--good)" }}><Clock size={13} /> Aberto agora</span>}
                    {p.open_now === false && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#B45309" }}><Clock size={13} /> Fechado agora</span>}
                    {p.open_24h && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> 24h</span>}
                    {p.mobile_service && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Truck size={13} /> Vai até você</span>}
                  </div>
                  {/* Clube de Parceiros: benefício em destaque + resgate */}
                  {p.provider_status === "parceiro_totex" && p.benefit && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "var(--brand-soft)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand)", letterSpacing: ".04em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}><Gift size={13} /> Benefício Co-pilot</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 3 }}>{p.benefit}{p.benefit_value ? <span style={{ fontWeight: 600, color: "var(--muted)" }}> · vale ≈ R$ {Math.round(p.benefit_value)}</span> : null}</div>
                      {p.honor_rate != null && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{p.honor_rate}% dos clientes confirmaram o benefício</div>}
                      <button className="btn-primary" style={{ marginTop: 8, height: 40, fontSize: 14 }} onClick={() => resgatar(p)}><Gift size={15} /> Resgatar no WhatsApp</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
                    {p.maps_uri && <button className="sbtn" onClick={() => abrir(p.maps_uri, p.provider_id, "opened_route", p.partner_id)}><MapPin size={14} /> Rota</button>}
                    {p.call_uri && <button className="sbtn" onClick={() => abrir(p.call_uri, p.provider_id, "opened_phone", p.partner_id)}><Phone size={14} /> Ligar</button>}
                    {p.whatsapp_uri && <button className="sbtn wa" onClick={() => abrir(p.whatsapp_uri, p.provider_id, "opened_whatsapp", p.partner_id)}><MessageCircle size={14} /> WhatsApp</button>}
                  </div>
                </div>
              ))}
              {!(result.providers?.length) && <div className="card pad" style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nada por aqui agora. Tenta outra região ou categoria parecida.</div>}
            </div>
          </div>
        )}

        {/* parceiros com desconto */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Parceiros com desconto</div>
          <section className="card">
            {[
              { ic: ShieldCheck, t: "Seguro", s: "Cotação em minutos", msg: "Quero cotar um seguro pro meu carro 🚗" },
              { ic: Stamp, t: "Despachante", s: "Transferência e documentos", msg: "Preciso de despachante (transferência/documentos)" },
              { ic: Ticket, t: "Tag de pedágio", s: "Passe direto e ganhe desconto", msg: "Quero a tag de pedágio com desconto" },
            ].map((o) => {
              const Ic = o.ic;
              return (
                <a key={o.t} className="offer" href={`https://wa.me/${WA}?text=${encodeURIComponent(o.msg)}`} target="_blank" rel="noreferrer">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}><div className="t">{o.t}</div><div className="s">{o.s}</div></div>
                  <span className="cta">Ver</span>
                </a>
              );
            })}
          </section>
        </div>

        {/* captação orgânica de parceiros */}
        <Link to="/parceiro" className="card list-row">
          <span className="offer-ico"><Handshake size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Tem uma oficina ou serviço?</div><div className="s">Cadastre um benefício e apareça primeiro aqui. Grátis.</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        <p className="foot-note">Resultados públicos + parceiros Totex. A gente mostra o que dá pra confiar; o que não vier, não aparece.</p>
      </div>
    </MgShell>
  );
}
