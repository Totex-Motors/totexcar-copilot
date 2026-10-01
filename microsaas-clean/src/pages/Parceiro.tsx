import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CSS, EASE, fade, useEditorialFonts, Lines, Label, Item, Nav, Foot, WA } from "@/marketing/editorial";

// CLUBE DE PARCEIROS — cadastro self-service de oficina/serviço (público, sem login), no sistema editorial do site.
// O parceiro oferece um benefício pro usuário do Co‑pilot; aprovado no /admin, aparece PRIMEIRO
// no Radar de Serviços (app e WhatsApp) com selo e botão "Resgatar". Grátis pra listar.
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

const PORQUE: [string, string][] = [
  ["Clientes novos da sua região", "Quem busca no Radar do Co‑pilot já está decidido a contratar. Seu negócio aparece primeiro, com selo e botão de resgate."],
  ["Você só dá o benefício quando o cliente aparece", "Nada de taxa, nada de adiantamento, nada de mensalidade."],
  ["Dois minutos pra cadastrar", "A gente confere e aprova em até um dia útil."],
];

export default function Parceiro() {
  const [params] = useSearchParams();
  const source = params.get("ref") || params.get("src") || params.get("utm_source") || "self_service";
  const [f, setF] = useState({ name: "", category: "oficina", city: "", address: "", whatsapp: "", email: "", contact_name: "", benefit: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { code?: string; already?: boolean; status?: string }>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  useEditorialFonts();

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
    <div className="h2x">
      <style>{CSS}</style>
      <Nav />

      {done ? (
        <section className="top" style={{ paddingBottom: 80, minHeight: "100svh" }}>
          <div className="wrap">
            <motion.div className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "left" }}>(clube de parceiros)</motion.div>
            <h1 className="disp" style={{ fontSize: "clamp(44px,8.4vw,132px)", margin: "26px 0 0", color: "#e9e9e9", maxWidth: 1180 }}>
              <Lines now delay={0.2} lines={done.already ? ["Você já está", <span className="acc" key="c">cadastrado.</span>] : ["Recebemos o", "seu cadastro.", <span className="acc" key="c">Obrigado.</span>]} />
            </h1>
            <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 640, margin: "40px 0 0" }}>
              {done.already && done.status === "approved"
                ? "Seu negócio já está no Radar do Co‑pilot com o benefício."
                : "A gente confere e aprova em até um dia útil. Assim que aprovar, seu negócio aparece no topo do Radar com o benefício e o botão de resgate."}
            </motion.p>
            {done.code && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} style={{ marginTop: 40 }}>
                <div className="mono">seu código de resgate — o cliente fala ele no balcão</div>
                <div className="disp" style={{ fontSize: "clamp(40px,7vw,110px)", marginTop: 10 }}>{done.code.toUpperCase()}</div>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 48 }}>
              <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Oi! Acabei de me cadastrar como parceiro no Co‑pilot 🤝")}`} target="_blank" rel="noreferrer" className="pill"><span className="dot" />Falar no WhatsApp</a>
              <Link to="/" className="pill ghost">Conhecer o Co‑pilot</Link>
            </motion.div>
            <Foot />
          </div>
        </section>
      ) : (
        <>
          <section className="top" style={{ paddingBottom: 90 }}>
            <div className="wrap">
              <motion.div className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ textAlign: "left" }}>(clube de parceiros · grátis)</motion.div>
              <h1 className="disp" style={{ fontSize: "clamp(44px,8.4vw,132px)", margin: "26px 0 0", color: "#e9e9e9", maxWidth: 1180 }}>
                <Lines now delay={0.25} lines={["Apareça primeiro", "pra quem procura", <span className="acc" key="c">o seu serviço.</span>]} />
              </h1>
              <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.75 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 640, margin: "40px 0 0" }}>
                Donos de carro usam o Co‑pilot pra achar oficina, pneu, guincho, lavagem. Cadastre um benefício e o seu negócio aparece no topo do Radar, com selo e botão de resgate. Sem mensalidade.
              </motion.p>
            </div>
          </section>

          <section style={{ paddingBottom: 100 }}>
            <div className="wrap">
              {PORQUE.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i === 2} delay={i * 0.08}>{d}</Item>)}
              <div className="hair star" />
            </div>
          </section>

          <section className="sec" style={{ borderTop: "1px solid var(--line)", paddingTop: 100 }}>
            <div className="wrap two" style={{ alignItems: "start" }}>
              <div>
                <Label left>cadastro</Label>
                <h2 className="disp" style={{ fontSize: "clamp(40px,5.6vw,88px)", margin: "26px 0 28px" }}><Lines lines={["Dois minutos.", <span style={{ color: "var(--mute)" }} key="g">Grátis.</span>]} /></h2>
                <motion.p className="serif" {...fade} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 440, margin: 0 }}>
                  Ao cadastrar, você autoriza a TotexMotors a exibir o seu negócio e o benefício no app e no WhatsApp do Co‑pilot. Sem custo. Pode pedir pra sair quando quiser.
                </motion.p>
              </div>
              <motion.form {...fade} onSubmit={(e) => { e.preventDefault(); enviar(); }}>
                <label className="lbl" style={{ marginTop: 0 }}>Nome do negócio</label>
                <input className="inp" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Auto Center do Zé" />

                <label className="lbl">Tipo de serviço</label>
                <select className="inp" value={f.category} onChange={(e) => set("category", e.target.value)}>
                  {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>

                <div className="two" style={{ gap: 24, alignItems: "end" }}>
                  <div><label className="lbl">Cidade / bairro</label><input className="inp" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Barueri" /></div>
                  <div><label className="lbl">WhatsApp</label><input className="inp" inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", maskZap(e.target.value))} placeholder="(11) 9xxxx-xxxx" /></div>
                </div>

                <label className="lbl">Endereço</label>
                <input className="inp" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro" />

                <label className="lbl">Benefício pro usuário do Co‑pilot</label>
                <input className="inp" value={f.benefit} onChange={(e) => set("benefit", e.target.value)} placeholder="10% na primeira visita" maxLength={160} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  {EXEMPLOS.map((ex) => <button key={ex} type="button" className={`chip ${f.benefit === ex ? "on" : ""}`} onClick={() => set("benefit", ex)}>{ex}</button>)}
                </div>

                <div className="two" style={{ gap: 24, alignItems: "end" }}>
                  <div><label className="lbl">Seu nome (opcional)</label><input className="inp" value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="Responsável" /></div>
                  <div><label className="lbl">E-mail (opcional)</label><input className="inp" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@..." /></div>
                </div>

                {err && <div className="err">{err}</div>}

                <div style={{ marginTop: 40 }}>
                  <button type="submit" className="pill" disabled={!ok || busy}><span className="dot" />{busy ? "Enviando…" : "Quero ser parceiro"}</button>
                </div>
              </motion.form>
            </div>
          </section>

          <section className="sec" style={{ borderTop: "1px solid var(--line)", paddingBottom: 80 }}>
            <div className="wrap">
              <h2 className="disp" style={{ fontSize: "clamp(40px,7.4vw,116px)", margin: "0 0 36px", color: "#e9e9e9" }}>
                <Lines lines={["Ficou com dúvida?", <span style={{ color: "var(--mute)" }} key="o">Chama no WhatsApp.</span>]} />
              </h2>
              <motion.div {...fade} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Tenho uma dúvida sobre o Clube de Parceiros")}`} target="_blank" rel="noreferrer" className="pill"><span className="dot" />Falar com a gente</a>
                <Link to="/" className="pill ghost">Conhecer o Co‑pilot</Link>
              </motion.div>
              <Foot />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
