import { useEffect, useState } from "react";
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
  valor_obrigatorio: "Informe quanto o benefício vale pro cliente, em reais.",
  codigo_invalido: "Código não encontrado.",
  email_invalido: "Confira o e-mail.",
};
const maskZap = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.length <= 2 ? d : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const QUEM: [string, string][] = [
  ["Lojas em shoppings", "Stands da Totex dentro de shoppings na Grande São Paulo, com estúdio de fotos e avaliação presencial. Gente passando todo dia."],
  ["Rede em franquia", "O modelo é replicado em lojas franqueadas. Cada loja nova entrega o Co‑pilot pros clientes dela — e o Radar de parceiros vai junto."],
  ["Grátis pro dono do carro", "O Co‑pilot não cobra mensalidade. Por isso o dono usa de verdade: documentos, manutenção, multas, e a busca por serviço perto dele."],
  ["O que você ganha", "Quando alguém busca o seu tipo de serviço na sua região, o seu negócio aparece primeiro, com selo e benefício. Você só dá o benefício quando o cliente chega."],
];

// REGRA DO TOPO — pública, igual pra todo mundo.
const REGRA: [string, string][] = [
  ["Grátis pra todo mundo", "Inclusive pros seus concorrentes. Oficina, guincho, borracharia: qualquer negócio da categoria pode entrar, sem taxa e sem mensalidade."],
  ["Ninguém paga pra subir", "Não tem plano premium, não tem destaque pago e a gente não escolhe favorito. A posição é decidida só pelo que o cliente ganha."],
  ["Quem dá mais fica no topo", "Até 3 negócios por categoria e cidade ocupam o topo com selo. Entra quem oferece o maior benefício em reais pro dono do carro. Você vê sua posição e pode subir a oferta quando quiser."],
  ["Quem não honra, desce", "Depois de cada resgate, o cliente responde se o benefício foi aplicado. Parceiro que não cumpre perde a posição automaticamente."],
];

const PORQUE: [string, string][] = [
  ["Clientes novos da sua região", "Quem busca no Radar do Co‑pilot já está decidido a contratar. Seu negócio aparece primeiro, com selo e botão de resgate."],
  ["Você só dá o benefício quando o cliente aparece", "Nada de taxa, nada de adiantamento, nada de mensalidade."],
  ["Dois minutos pra cadastrar", "A gente confere e aprova em até um dia útil."],
];

type Rank = { position: number; no_topo: boolean; concorrentes: number; top_slots: number; valor_primeiro: number | null; valor_para_topo: number };
function rankTexto(r: Rank, aprovado: boolean) {
  const base = aprovado ? "Hoje você está" : "Quando for aprovado, você entra";
  if (r.concorrentes === 0) return `${base} em 1º lugar na sua categoria e cidade — por enquanto, sem concorrente. Quem entrar com benefício maior passa na frente.`;
  const pos = `${base} em ${r.position}º entre ${r.concorrentes + 1} na sua categoria e cidade`;
  if (r.no_topo) return `${pos}, no topo.${r.position > 1 && r.valor_primeiro ? ` O 1º oferece cerca de R$ ${r.valor_primeiro}.` : ""} Quem oferecer mais passa na frente.`;
  return `${pos}, fora do topo. Pra entrar no topo, o benefício precisa valer pelo menos R$ ${r.valor_para_topo}. Você pode mudar quando quiser.`;
}

export default function Parceiro() {
  const [params] = useSearchParams();
  const source = params.get("ref") || params.get("src") || params.get("utm_source") || "self_service";
  // Link personalizado de prospecção: ?n=Nome+do+Negócio&cat=guincho&c=Santana+de+Parnaíba — o parceiro abre já preenchido.
  const catIni = CATS.some(([v]) => v === params.get("cat")) ? String(params.get("cat")) : "oficina";
  const [f, setF] = useState({ name: params.get("n") || "", category: catIni, city: params.get("c") || "", address: "", whatsapp: params.get("w") || "", email: "", contact_name: "", benefit: "", benefit_value: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { code?: string; already?: boolean; status?: string; rank?: Rank }>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  useEditorialFonts();

  // ÁREA DO PARCEIRO (?code=XXXXXX): vê posição, resgates e muda o benefício quando quiser (regra do topo)
  const code = (params.get("code") || "").trim().toLowerCase();
  const [area, setArea] = useState<null | { partner: any; rank: Rank }>(null);
  const [areaErr, setAreaErr] = useState<string | null>(null);
  const [edit, setEdit] = useState({ benefit: "", benefit_value: "" });
  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("parceiro", { body: { action: "get", code } });
      const d = data as any;
      if (error || !d?.ok) { setAreaErr("Código não encontrado. Confira o link que você recebeu."); return; }
      setArea({ partner: d.partner, rank: d.rank });
      setEdit({ benefit: d.partner.benefit || "", benefit_value: String(d.partner.benefit_value || "") });
    })();
  }, [code]);
  const salvarArea = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("parceiro", { body: { action: "update", code, benefit: edit.benefit, benefit_value: edit.benefit_value } });
      const d = data as any;
      if (error || !d?.ok) { setErr(ERROS[d?.error] || "Não consegui salvar agora. Tente de novo em instantes."); return; }
      setArea({ partner: d.partner, rank: d.rank });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setErr("Não consegui salvar agora. Tente de novo em instantes."); }
    finally { setBusy(false); }
  };

  const zap = f.whatsapp.replace(/\D/g, "");
  const valor = Number(String(f.benefit_value).replace(",", ".")) || 0;
  const ok = f.name.trim().length >= 3 && !!f.city.trim() && zap.length >= 10 && f.benefit.trim().length >= 5 && valor >= 1;

  const enviar = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("parceiro", { body: { ...f, whatsapp: zap, source, provider_id: params.get("p") || undefined } });
      const d = data as any;
      if (error || !d?.ok) { setErr(ERROS[d?.error] || "Não consegui enviar agora. Tente de novo em instantes."); return; }
      setDone({ code: d.code, already: d.already, status: d.status, rank: d.rank });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setErr("Não consegui enviar agora. Tente de novo em instantes."); }
    finally { setBusy(false); }
  };

  return (
    <div className="h2x">
      <style>{CSS}</style>
      <Nav />

      {code ? (
        <section className="top" style={{ paddingBottom: 80, minHeight: "100svh" }}>
          <div className="wrap">
            <motion.div className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "left" }}>(área do parceiro)</motion.div>
            {areaErr ? (
              <h1 className="disp" style={{ fontSize: "clamp(44px,8.4vw,132px)", margin: "26px 0 0", color: "#e9e9e9" }}><Lines now lines={["Código não", <span className="acc" key="c">encontrado.</span>]} /></h1>
            ) : !area ? (
              <p className="mono" style={{ marginTop: 40 }}>carregando…</p>
            ) : (
              <>
                <h1 className="disp" style={{ fontSize: "clamp(44px,8.4vw,132px)", margin: "26px 0 0", color: "#e9e9e9", maxWidth: 1180 }}>
                  <Lines now delay={0.2} lines={[area.partner.name, area.partner.status !== "approved"
                    ? <span style={{ color: "var(--mute)" }} key="p">Aguardando aprovação.</span>
                    : area.rank.no_topo ? <span className="acc" key="t">{`${area.rank.position}º · no topo.`}</span> : <span style={{ color: "var(--mute)" }} key="f">{`${area.rank.position}º · fora do topo.`}</span>]} />
                </h1>
                <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 680, margin: "40px 0 0" }}>
                  {rankTexto(area.rank, area.partner.status === "approved")}
                </motion.p>
                <div className="three" style={{ textAlign: "left", marginTop: 48, gap: 24 }}>
                  {[[area.partner.shown_count, "aparições no Radar"], [area.partner.redeem_count, "resgates"], [area.partner.honor_rate == null ? "—" : `${area.partner.honor_rate}%`, "clientes confirmaram o benefício"]].map(([n, l]) => (
                    <div key={String(l)} className="hair" style={{ paddingTop: 14 }}><div className="disp" style={{ fontSize: 40 }}>{n}</div><div className="mono">{l}</div></div>
                  ))}
                </div>
                <div style={{ maxWidth: 640, marginTop: 56 }}>
                  <label className="lbl" style={{ marginTop: 0 }}>Seu benefício pro cliente do Co‑pilot</label>
                  <input className="inp" value={edit.benefit} onChange={(e) => setEdit((p) => ({ ...p, benefit: e.target.value }))} maxLength={160} />
                  <label className="lbl">Quanto esse benefício vale pro cliente (R$)</label>
                  <input className="inp" inputMode="numeric" value={edit.benefit_value} onChange={(e) => setEdit((p) => ({ ...p, benefit_value: e.target.value.replace(/[^\d,.]/g, "") }))} placeholder="80" />
                  {err && <div className="err">{err}</div>}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 36 }}>
                    <button className="pill" disabled={busy} onClick={salvarArea}><span className="dot" />{busy ? "Salvando…" : "Atualizar benefício"}</button>
                    <a href={`https://wa.me/${WA}?text=${encodeURIComponent(`Oi! Sou parceiro (${area.partner.name}) e tenho uma dúvida`)}`} target="_blank" rel="noreferrer" className="pill ghost">Falar com a gente</a>
                  </div>
                  <p className="mono" style={{ marginTop: 28 }}>seu código de resgate: {String(area.partner.code).toUpperCase()}</p>
                </div>
              </>
            )}
            <Foot />
          </div>
        </section>
      ) : done ? (
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
                <p className="mono" style={{ marginTop: 10 }}>guarde este link pra ver sua posição e mudar o benefício quando quiser: {window.location.origin}/parceiro?code={done.code}</p>
              </motion.div>
            )}
            {done.rank && !done.already && (
              <motion.p className="serif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 640, margin: "32px 0 0" }}>
                {rankTexto(done.rank, false)}
              </motion.p>
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
                Donos de carro usam o Co‑pilot pra achar oficina, pneu, guincho, lavagem. Cadastre um benefício e dispute o topo do Radar, com selo e botão de resgate. Grátis pra todo mundo, inclusive pros seus concorrentes: ninguém paga pra subir, quem dá mais benefício fica no topo.
              </motion.p>
            </div>
          </section>

          <section style={{ paddingBottom: 100 }}>
            <div className="wrap">
              {PORQUE.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i === 2} delay={i * 0.08}>{d}</Item>)}
              <div className="hair star" />
            </div>
          </section>

          <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="wrap">
              <Label>a regra do topo</Label>
              <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 20px", maxWidth: 1000 }}><Lines lines={["Ninguém paga", "pra subir."]} /></h2>
              <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 640, margin: "0 auto 70px", color: "var(--mute)" }}>
                A regra é uma só e vale pra todo mundo: quem dá o maior benefício ao dono do carro fica no topo. E quem não honra o benefício, desce.
              </motion.p>
              {REGRA.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.07}>{d}</Item>)}
              <div className="hair star" />
            </div>
          </section>

          <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="wrap two" style={{ alignItems: "start" }}>
              <div>
                <Label left>quem é a totex</Label>
                <h2 className="disp" style={{ fontSize: "clamp(40px,5.6vw,88px)", margin: "26px 0 28px" }}><Lines lines={["Loja de carro", "que virou", <span style={{ color: "var(--mute)" }} key="g">tecnologia.</span>]} /></h2>
                <motion.p className="serif" {...fade} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 440, margin: 0 }}>
                  A Totex Motors vende carros em lojas dentro de shoppings na Grande São Paulo e cresce em rede, por franquia. Todo cliente que passa pelo stand ganha o Co‑pilot: um assistente de carro no WhatsApp, grátis, que guarda documentos, avisa vencimentos e indica onde resolver cada coisa. É aí que o seu negócio entra.
                </motion.p>
              </div>
              <div>
                {QUEM.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={i * 0.08}>{d}</Item>)}
                <div className="hair star" />
              </div>
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

                <label className="lbl">Quanto esse benefício vale pro cliente (R$)</label>
                <input className="inp" inputMode="numeric" value={f.benefit_value} onChange={(e) => set("benefit_value", e.target.value.replace(/[^\d,.]/g, ""))} placeholder="80" />
                <p className="mono" style={{ marginTop: 10 }}>é esse valor que decide quem fica no topo da sua categoria na sua cidade</p>

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
