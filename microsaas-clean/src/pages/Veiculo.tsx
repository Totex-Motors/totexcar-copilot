import { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  Car, Coins, ChevronRight, CalendarDays, ShieldCheck, IdCard, FileText, Pencil, Gauge, Fuel, Palette, Hash, Camera, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d); t.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}
const fmtBR = (d?: string | null) => { if (!d) return null; const [y, m, day] = String(d).split("-"); return day && m && y ? `${day}/${m}/${y}` : String(d); };
// reduz a foto no próprio celular antes de subir (máx. 1600px, JPEG) — upload rápido mesmo no 4G
async function fotoParaBase64(file: File): Promise<{ b64: string; mime: string }> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.86);
  return { b64: dataUrl.split(",")[1], mime: "image/jpeg" };
}

function statusOf(dateStr?: string | null) {
  const d = daysUntil(dateStr);
  if (d == null) return { txt: "Não informado", cls: "", dot: "var(--faint)" };
  if (d < 0) return { txt: `Venceu há ${Math.abs(d)}d`, cls: "due", dot: "var(--alert)" };
  if (d <= 30) return { txt: `Vence em ${d}d`, cls: "due", dot: "var(--gain)" };
  return { txt: "Em dia", cls: "ok", dot: "var(--good)" };
}

// TELA VEÍCULO (Meu Carro) — visão do carro no padrão novo: carro em destaque, documentos/vencimentos
// com status real, dados do veículo e atalhos (quanto vale / editar). Edição continua no /settings.
export default function Veiculo() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle, refetch } = useVehicle(userId);

  // FOTO DO CARRO: a da venda (capa do estoque) chega sozinha; o dono pode trocar pela dele (fundo recortado)
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const vid = (vehicle as any)?.id;
  useEffect(() => {
    const atual = (vehicle as any)?.foto_url || null;
    setFoto(atual);
    if (vid && !atual) {
      supabase.functions.invoke("car-photo", { body: { action: "status" } })
        .then(({ data }) => { if ((data as any)?.foto_url) setFoto((data as any).foto_url); })
        .catch(() => {});
    }
  }, [vid, (vehicle as any)?.foto_url]);
  const enviarFoto = async (file?: File | null) => {
    if (!file) return;
    setEnviando(true);
    try {
      const { b64, mime } = await fotoParaBase64(file);
      const { data, error } = await supabase.functions.invoke("car-photo", { body: { action: "upload", image_base64: b64, mime } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setFoto((data as any).foto_url);
      refetch?.();
      toast({ title: "Foto do carro salva ✅" });
    } catch (e: any) {
      toast({ title: "Não consegui salvar a foto", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const recortada = !!foto && /\.webp(\?|$)/i.test(foto);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const v: any = vehicle || {};
  const carro = vehicle ? [v.marca, v.modelo].filter(Boolean).join(" ") : null;
  const ano = v.ano_modelo || v.ano_fabricacao || null;
  const km = v.hodometro ? `${Number(v.hodometro).toLocaleString("pt-BR")} km` : null;

  const docs = [
    { label: "Licenciamento", date: v.licenciamento_vencimento, ic: CalendarDays },
    { label: "IPVA", date: v.ipva_vencimento, ic: CalendarDays },
    { label: "Seguro", date: v.seguro_vencimento, ic: ShieldCheck },
    { label: "CNH (habilitação)", date: userData?.cnh_vencimento, ic: IdCard },
  ];
  const dados = [
    { label: "Ano", value: ano ? String(ano) : "—", ic: CalendarDays },
    { label: "Cor", value: v.cor || "—", ic: Palette },
    { label: "Combustível", value: v.combustivel || "—", ic: Fuel },
    { label: "Hodômetro", value: km || "—", ic: Gauge },
    { label: "Renavam", value: v.renavam || "—", ic: Hash },
    { label: "Chassi", value: v.chassi ? `••••${String(v.chassi).slice(-4)}` : "—", ic: Hash },
  ];

  return (
    <MgShell tab="veiculo">
      <div className="stack">
        <div className="sec-title" style={{ fontSize: 20, marginTop: 2 }}>Meu carro</div>

        {/* carro em destaque — foto recortada flutuando, dados numa linha só (visual limpo) */}
        <section className="card pad">
          <div className="veh-head">
            <div style={{ minWidth: 0 }}>
              {v.placa && <span className="plate">{v.placa}</span>}
              <div className="veh-model" style={{ fontSize: 17 }}>{carro || "Cadastre seu carro"}</div>
              <div className="car-meta">{[km, ano, v.cor].filter(Boolean).join(" · ")}</div>
            </div>
            <Link to="/settings" className="swap">Editar <Pencil size={13} /></Link>
          </div>
          {vehicle && (
            foto ? (
              <div className={`car-stage ${recortada ? "" : "nocut"}`}>
                <img src={foto} alt={carro || "Meu carro"} className={recortada ? "cut" : "full"} />
                <button className="car-cam" aria-label="Trocar foto do carro" onClick={() => fileRef.current?.click()} disabled={enviando}>
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
              </div>
            ) : (
              <div className="car-stage empty">
                <Car size={30} strokeWidth={1.6} />
                <b>Coloque a foto do seu carro</b>
                <button className="car-add" onClick={() => fileRef.current?.click()} disabled={enviando}>
                  {enviando ? <><Loader2 size={15} className="animate-spin" /> Recortando o fundo…</> : <><Camera size={15} /> Adicionar foto</>}
                </button>
              </div>
            )
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => enviarFoto(e.target.files?.[0])} />
        </section>

        {/* quanto vale */}
        <Link to="/vale" className="card alert-card" style={{ borderLeftColor: "var(--brand)" }}>
          <span className="alert-ico" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Coins size={21} /></span>
          <div style={{ flex: 1 }}><div className="t">Quanto vale o seu carro</div><div className="s">Valor na tabela FIPE, na hora</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        {/* documentos & vencimentos */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Documentos & vencimentos</div>
          <section className="card">
            {docs.map((d) => {
              const st = statusOf(d.date);
              const Ic = d.ic;
              return (
                <Link key={d.label} to="/settings" className="list-row">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}>
                    <div className="t">{d.label}</div>
                    <div className="s">{fmtBR(d.date) ? `Vence ${fmtBR(d.date)}` : "Toque pra informar"}</div>
                  </div>
                  <span className={`tag ${st.cls}`} style={{ alignSelf: "center" }}>{st.txt}</span>
                </Link>
              );
            })}
          </section>
        </div>

        {/* CRLV digital */}
        <Link to="/crlv" className="card list-row">
          <span className="offer-ico"><FileText size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">CRLV digital</div><div className="s">Documento do carro</div></div>
          <span className="tag ok" style={{ alignSelf: "center" }}>Disponível</span>
        </Link>

        {/* dados do veículo */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Dados do veículo</div>
          <section className="card" style={{ padding: 4 }}>
            {dados.map((d) => {
              const Ic = d.ic;
              return (
                <div key={d.label} className="list-row" style={{ padding: "12px 12px" }}>
                  <span className="offer-ico" style={{ width: 34, height: 34 }}><Ic size={17} /></span>
                  <div style={{ flex: 1 }} className="t">{d.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }} className="mono">{d.value}</div>
                </div>
              );
            })}
          </section>
        </div>

        <Link to="/settings"><button className="btn-primary"><Pencil size={17} /> Editar dados do veículo</button></Link>

        <p className="foot-note">Os dados vêm do seu cadastro. Atualize em "Editar" ou mandando no WhatsApp do Co-pilot.</p>
      </div>
    </MgShell>
  );
}
