import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Wrench, Truck, CircleDot, KeyRound, LifeBuoy, Disc3, Zap, BatteryCharging, Wind, SprayCan,
  Sparkles, ClipboardCheck, PlugZap, Frame, MapPin, Phone, MessageCircle, Star, Clock, Loader2,
  Navigation, ShieldCheck, Stamp, Ticket,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useRadar, SERVICOS } from "@/hooks/useRadar";
import { toast } from "@/hooks/use-toast";

const WA = "5511963786699";
const ICONS: Record<string, any> = {
  oficina: Wrench, guincho: Truck, borracharia: CircleDot, chaveiro: KeyRound, socorro: LifeBuoy,
  freios: Disc3, autoeletrica: Zap, bateria: BatteryCharging, pneus: CircleDot, vidros: Frame,
  ar_condicionado: Wind, funilaria: SprayCan, estetica: Sparkles, vistoria: ClipboardCheck, eletrico_hibrido: PlugZap,
};
const EMERG = ["guincho", "borracharia", "chaveiro", "socorro"];

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

  const abrir = (url: string | null | undefined, pid: string | null | undefined, tipo: string) => {
    if (!url) return;
    if (pid) registrarAcao(pid, tipo, result?.search_id);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const emergencias = SERVICOS.filter((s) => EMERG.includes(s.value));
  const demais = SERVICOS.filter((s) => !EMERG.includes(s.value));

  return (
    <MgShell tab="servicos">
      <div className="stack">
        <div className="sec-title" style={{ fontSize: 20, marginTop: 2 }}>Serviços</div>
        <p className="s" style={{ color: "var(--muted)", fontSize: 13, margin: "-6px 2px 0" }}>Oficina, guincho, borracharia, chaveiro — a gente acha, compara e mostra as opções perto de você.</p>

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
          <div className="catgrid">
            {demais.map((s) => {
              const Ic = ICONS[s.value] || Wrench;
              return (
                <button key={s.value} className={`cat ${sel === s.value ? "on" : ""}`} onClick={() => rodar(s.value)}>
                  <span className="ci"><Ic size={18} /></span><span className="cl">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* resultados */}
        {loading && <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}><Loader2 className="animate-spin" style={{ display: "inline" }} size={22} /><div style={{ marginTop: 6, fontSize: 13 }}>Procurando perto de você...</div></div>}
        {!loading && result && (
          <div>
            <div className="eyebrow" style={{ margin: "2px 2px 8px" }}>{result.providers?.length || 0} opções · {result.service_label}</div>
            <div className="stack">
              {(result.providers || []).map((p, i) => (
                <div key={p.provider_id || i} className="card pad">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="prov-name">{p.name} {p.provider_status === "parceiro_totex" && <span className="badge-p">Parceiro</span>}</div>
                      {p.address && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, display: "flex", gap: 4 }}><MapPin size={13} style={{ flex: "none", marginTop: 1 }} /> {p.address}</div>}
                    </div>
                    {p.distance_km != null && <span style={{ color: "var(--brand)", fontWeight: 700, flex: "none" }}>{p.distance_km} km</span>}
                  </div>
                  <div className="prov-sig">
                    {p.rating != null && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Star size={13} style={{ fill: "#F5B301", color: "#F5B301" }} /> <b style={{ color: "var(--ink)" }}>{p.rating.toFixed(1)}</b>{p.review_count != null && ` (${p.review_count})`}</span>}
                    {p.open_now === true && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--good)" }}><Clock size={13} /> Aberto</span>}
                    {p.open_24h && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> 24h</span>}
                    {p.mobile_service && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Truck size={13} /> Vai até você</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
                    {p.maps_uri && <button className="sbtn" onClick={() => abrir(p.maps_uri, p.provider_id, "opened_route")}><MapPin size={14} /> Rota</button>}
                    {p.call_uri && <button className="sbtn" onClick={() => abrir(p.call_uri, p.provider_id, "opened_phone")}><Phone size={14} /> Ligar</button>}
                    {p.whatsapp_uri && <button className="sbtn wa" onClick={() => abrir(p.whatsapp_uri, p.provider_id, "opened_whatsapp")}><MessageCircle size={14} /> WhatsApp</button>}
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

        <p className="foot-note">Resultados públicos + parceiros Totex. A gente mostra o que dá pra confiar; o que não vier, não aparece.</p>
      </div>
    </MgShell>
  );
}
