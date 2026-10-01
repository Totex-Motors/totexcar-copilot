import { useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Handshake, Gift, Check, Loader2, MessageCircle, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// CLUBE DE PARCEIROS — cadastro self-service de oficina/serviço (público, sem login).
// O parceiro oferece um benefício pro usuário do Co-pilot; aprovado no /admin, aparece PRIMEIRO
// no Radar de Serviços (app e WhatsApp) com selo e botão "Resgatar". Grátis pra listar.
const WA = "5511963786699";
const CATS: [string, string][] = [
  ["oficina", "Oficina mecânica"], ["pneus", "Pneus"], ["borracharia", "Borracharia"], ["alinhamento", "Alinhamento e balanceamento"],
  ["oleo", "Troca de óleo"], ["freios", "Freios e suspensão"], ["autoeletrica", "Autoelétrica"], ["bateria", "Baterias"],
  ["ar_condicionado", "Ar-condicionado"], ["funilaria", "Funilaria e pintura"], ["martelinho", "Martelinho de ouro"],
  ["estetica", "Estética e lavagem"], ["vidros", "Vidros"], ["insulfilm", "Insulfilm / película"], ["som", "Som e multimídia"],
  ["escapamento", "Escapamento"], ["cambio", "Câmbio e transmissão"], ["eletrico_hibrido", "Elétricos e híbridos"],
  ["guincho", "Guincho / reboque"], ["socorro", "Socorro mecânico"], ["chaveiro", "Chaveiro automotivo"],
  ["vistoria", "Vistoria"], ["despachante", "Despachante"], ["gnv", "GNV / kit gás"], ["posto", "Posto de gasolina"],
];
const EXEMPLOS = ["10% na primeira visita", "Diagnóstico grátis", "Alinhamento cortesia na troca de pneus", "Lavagem grátis na revisão", "Check-up de freios sem custo"];
const ERROS: Record<string, string> = {
  nome_invalido: "Informe o nome do negócio.",
  cidade_obrigatoria: "Informe a cidade ou bairro.",
  whatsapp_invalido: "Confira o WhatsApp (DDD + número).",
  beneficio_obrigatorio: "Descreva o benefício que você oferece.",
  email_invalido: "Confira o e-mail.",
};
const maskZap = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.length <= 2 ? d : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const inp: CSSProperties = { width: "100%", height: 46, borderRadius: 12, border: "1px solid #D5DEDA", padding: "0 13px", fontSize: 15, background: "#fff", color: "#13211E", outline: "none" };
const lbl: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#5D6E69", margin: "12px 0 6px", letterSpacing: ".02em" };
const card: CSSProperties = { background: "#fff", border: "1px solid #E1E8E5", borderRadius: 18, boxShadow: "0 8px 24px rgba(19,33,30,.06)", padding: 20 };

export default function Parceiro() {
  const [params] = useSearchParams();
  const source = params.get("ref") || params.get("src") || params.get("utm_source") || "self_service";
  const [f, setF] = useState({ name: "", category: "oficina", city: "", address: "", whatsapp: "", email: "", contact_name: "", benefit: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { code?: string; already?: boolean; status?: string }>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const zap = f.whatsapp.replace(/\D/g, "");
  const ok = f.name.trim().length >= 3 && !!f.city.trim() && zap.length >= 10 && f.benefit.trim().length >= 5;

  const enviar = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("parceiro", { body: { ...f, whatsapp: zap, source } });
      const d = data as any;
      if (error || !d?.ok) { setErr(ERROS[d?.error] || "Não consegui enviar agora. Tente de novo em instantes."); return; }
      setDone({ code: d.code, already: d.already, status: d.status });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setErr("Não consegui enviar agora. Tente de novo em instantes."); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#EEF2F0", color: "#13211E", fontFamily: '"IBM Plex Sans",system-ui,sans-serif' }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
            <img src="/totexmotors-logo.png" alt="Totexmotors" style={{ height: 34, width: "auto" }} />
          </Link>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0C6E6A", background: "#DCEDEB", padding: "6px 12px", borderRadius: 999 }}>Clube de Parceiros · grátis</span>
        </header>

        {done ? (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: "#DDEFE4", color: "#1F8A54", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Check size={28} /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>{done.already ? "Você já está cadastrado!" : "Recebemos o seu cadastro!"}</h2>
            <p style={{ fontSize: 14.5, color: "#5D6E69", lineHeight: 1.5, margin: 0 }}>
              {done.already && done.status === "approved"
                ? "Seu negócio já está no Radar do Co-pilot com o benefício."
                : "A gente confere e aprova em até 1 dia útil. Assim que aprovar, seu negócio aparece no topo do Radar com o benefício e o botão de resgate."}
            </p>
            {done.code && (
              <>
                <div style={{ margin: "14px auto 0", display: "inline-block", padding: "8px 14px", borderRadius: 12, background: "#EEF2F0", fontFamily: "monospace", fontWeight: 800, letterSpacing: ".12em", fontSize: 16 }}>{done.code.toUpperCase()}</div>
                <p style={{ fontSize: 12, color: "#8A9A95", marginTop: 6 }}>Esse é o seu código de resgate — o cliente fala ele no balcão.</p>
              </>
            )}
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Oi! Acabei de me cadastrar como parceiro no Co-pilot 🤝")}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, fontSize: 14, fontWeight: 700, color: "#1FA855", textDecoration: "none" }}>
              <MessageCircle size={17} /> Falar com a gente no WhatsApp
            </a>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#0C6E6A", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Handshake size={26} /></div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-.01em", lineHeight: 1.15 }}>Apareça primeiro pra quem está procurando o seu serviço</h1>
              <p style={{ fontSize: 14.5, color: "#5D6E69", lineHeight: 1.5, margin: 0 }}>
                Donos de carro usam o <b style={{ color: "#13211E" }}>TotexCar Co-pilot</b> pra achar oficina, pneu, guincho, lavagem… Cadastre um benefício e o seu negócio aparece <b style={{ color: "#13211E" }}>no topo</b>, com selo e botão de resgate. <b style={{ color: "#0C6E6A" }}>Sem mensalidade.</b>
              </p>
            </div>

            <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 16, padding: "8px 14px", marginBottom: 14 }}>
              {([
                ["Clientes novos da sua região", "Quem busca no app já está decidido a contratar."],
                ["Você só dá o benefício quando o cliente aparece", "Nada de taxa, nada de adiantamento."],
                ["2 minutos pra cadastrar", "Aprovação em até 1 dia útil."],
              ] as [string, string][]).map(([t, s]) => (
                <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: "#DDEFE4", color: "#1F8A54", display: "grid", placeItems: "center", flex: "none", marginTop: 1 }}><Check size={14} /></span>
                  <div><div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div><div style={{ fontSize: 12.5, color: "#5D6E69" }}>{s}</div></div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}><Store size={17} style={{ color: "#0C6E6A" }} /> Cadastro do parceiro</div>

              <label style={lbl}>Nome do negócio</label>
              <input style={inp} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Auto Center do Zé" />

              <label style={lbl}>Tipo de serviço</label>
              <select style={inp} value={f.category} onChange={(e) => set("category", e.target.value)}>
                {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>Cidade / bairro</label><input style={inp} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Barueri" /></div>
                <div><label style={lbl}>WhatsApp</label><input style={inp} inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", maskZap(e.target.value))} placeholder="(11) 9xxxx-xxxx" /></div>
              </div>

              <label style={lbl}>Endereço</label>
              <input style={inp} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro" />

              <label style={lbl}>Benefício pro usuário do Co-pilot</label>
              <input style={inp} value={f.benefit} onChange={(e) => set("benefit", e.target.value)} placeholder='Ex.: "10% na primeira visita"' maxLength={160} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {EXEMPLOS.map((ex) => (
                  <button key={ex} type="button" onClick={() => set("benefit", ex)}
                    style={{ fontSize: 12, padding: "6px 10px", borderRadius: 999, border: "1px solid #D5DEDA", background: f.benefit === ex ? "#DCEDEB" : "#fff", color: "#0C6E6A", fontWeight: 600, cursor: "pointer" }}>
                    {ex}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>Seu nome (opcional)</label><input style={inp} value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="Responsável" /></div>
                <div><label style={lbl}>E-mail (opcional)</label><input style={inp} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@..." /></div>
              </div>

              {err && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#FDECEA", color: "#9B2C2C", fontSize: 13 }}>{err}</div>}

              <button disabled={!ok || busy} onClick={enviar}
                style={{ width: "100%", height: 50, marginTop: 16, borderRadius: 14, background: ok ? "#0C6E6A" : "#9FB5B2", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: ok ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: ok ? "0 6px 16px rgba(10,83,80,.25)" : "none" }}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />} {busy ? "Enviando…" : "Quero ser parceiro — grátis"}
              </button>
              <p style={{ fontSize: 11.5, color: "#8A9A95", marginTop: 10, lineHeight: 1.4 }}>
                Ao cadastrar, você autoriza a TotexMotors a exibir o seu negócio e o benefício no app e no WhatsApp do Co-pilot. Sem custo. Pode pedir pra sair quando quiser.
              </p>
            </div>
          </>
        )}

        <p style={{ textAlign: "center", fontSize: 12.5, color: "#8A9A95", marginTop: 18, lineHeight: 1.5 }}>
          Dúvidas? <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Tenho uma dúvida sobre o Clube de Parceiros")}`} target="_blank" rel="noreferrer" style={{ color: "#0C6E6A", fontWeight: 700 }}>Chama no WhatsApp</a>
          {" · "}<Link to="/" style={{ color: "#0C6E6A", fontWeight: 700 }}>Conhecer o Co-pilot</Link>
        </p>
      </div>
    </div>
  );
}
