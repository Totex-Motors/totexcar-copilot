import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

// HOME — round 2 (sistema "editorial minimal", referência cinetica.studio).
// Monocromia disciplinada, 3 fontes com papéis rígidos (grotesca pesada CAIXA ALTA / serifa editorial /
// mono pros metadados), rótulos de seção entre parênteses, hairlines com ✦ no lugar de cards, uma pílula
// vazada por seção, muito ar. ?v=mono (100% monocromático) | ?v=ciano (ciano Totex em micro-acentos).
// Tudo que está aqui é o que o produto faz hoje. Rota de teste: /home2 (produção não muda).

const FONTS = "https://fonts.googleapis.com/css2?family=Gabarito:wght@700;900&family=Instrument+Serif:ital@0;1&family=Martian+Mono:wght@400&family=Montserrat:wght@400;500&display=swap";

const CSS = `
.h2x{overflow-x:hidden;background:#050505;color:#fff;font-family:Montserrat,system-ui,sans-serif;--acc:#ffffff;--mute:#8d8d8d;--line:rgba(255,255,255,.14);--ink2:#bdbdbd;-webkit-font-smoothing:antialiased}
.h2x[data-v="ciano"]{--acc:#2DD4BF}
.h2x .disp{font-family:Gabarito,Inter,system-ui,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;line-height:.92}
.h2x .serif{font-family:"Instrument Serif",Georgia,"Times New Roman",serif;font-weight:400;line-height:1.18;letter-spacing:-.005em}
.h2x .mono{font-family:"Martian Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);line-height:1.5}
.h2x .label{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);text-align:center}
.h2x .wrap{max-width:1280px;margin:0 auto;padding:0 32px}
.h2x .sec{padding:140px 0}
.h2x .hair{border-top:1px solid var(--line);position:relative}
.h2x .hair.star::after{content:"✦";position:absolute;right:0;top:-8px;font-size:11px;color:var(--mute);background:#050505;padding-left:8px}
.h2x .pill{display:inline-flex;align-items:center;gap:12px;padding:18px 30px;border:1px solid var(--acc);border-radius:999px;color:#fff;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;transition:background .25s,color .25s}
.h2x .pill:hover{background:var(--acc);color:#050505}
.h2x .pill .dot{width:6px;height:6px;border-radius:999px;background:var(--acc)}
.h2x .brk{position:relative;padding:10px 16px;font-family:"Martian Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);text-decoration:none}
.h2x .brk::before,.h2x .brk::after{content:"";position:absolute;width:8px;height:8px;border-color:var(--line);border-style:solid}
.h2x .brk::before{left:0;top:0;border-width:1px 0 0 1px}
.h2x .brk::after{right:0;bottom:0;border-width:0 1px 1px 0}
.h2x .ruler{position:absolute;left:32px;top:120px;bottom:120px;width:16px;background:repeating-linear-gradient(to bottom,var(--line) 0 1px,transparent 1px 34px);opacity:.9}
.h2x .ruler::before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px;background:repeating-linear-gradient(to bottom,transparent 0 17px,var(--line) 17px 18px,transparent 18px 34px)}
.h2x .marquee{overflow:hidden;white-space:nowrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0}
.h2x .marquee .track{display:inline-block;animation:h2mq 34s linear infinite}
@keyframes h2mq{to{transform:translateX(-50%)}}
.h2x .circ{width:170px;height:170px;border-radius:999px;border:1px solid var(--line);display:grid;place-items:center;margin:0 auto 18px;position:relative}
.h2x .circ::after{content:"✦";position:absolute;right:10px;top:12px;font-size:12px;color:var(--acc)}
.h2x .phone{border:1px solid var(--line);border-radius:30px;background:#0a0a0a;overflow:hidden;max-width:380px;margin:0 auto}
.h2x .phone .hd{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}
.h2x .phone .av{width:34px;height:34px;border-radius:999px;border:1px solid var(--line);display:grid;place-items:center;font-family:Gabarito;font-weight:900;font-size:13px}
.h2x .bub{max-width:86%;padding:11px 14px;border-radius:16px;font-size:13px;line-height:1.5}
.h2x .bub.me{align-self:flex-end;background:#232323;border-top-right-radius:4px}
.h2x .bub.bot{align-self:flex-start;background:#111;border:1px solid var(--line);border-top-left-radius:4px;color:#e6e6e6}
.h2x .num{font-family:Gabarito;font-weight:900;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.h2x .item{display:grid;grid-template-columns:72px 1fr;gap:24px;padding:34px 0}
.h2x .item .n{font-family:Gabarito;font-weight:900;font-size:40px;line-height:1;color:var(--mute)}
.h2x .item h3{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(22px,2.6vw,34px);line-height:1;margin:0 0 10px;letter-spacing:-.01em}
.h2x .item p{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(19px,1.7vw,24px);line-height:1.3;color:var(--ink2);margin:0}
.h2x .kin{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(34px,6.4vw,92px);line-height:.98;letter-spacing:-.015em;color:#3a3a3a}
.h2x .kin b{color:#fff;font-weight:900}
.h2x .acc{color:var(--acc)}
@media (max-width:768px){.h2x .wrap{padding:0 20px}.h2x .sec{padding:96px 0}.h2x .ruler{display:none}.h2x .item{grid-template-columns:48px 1fr;gap:14px;padding:26px 0}.h2x .item .n{font-size:28px}.h2x .circ{width:140px;height:140px}.h2x .circ .serif{font-size:42px}.h2x .hero-row,.h2x .two,.h2x .three{grid-template-columns:1fr!important;gap:28px!important}.h2x .three{gap:40px!important}.h2x .corner-tl{left:20px!important;top:88px!important}.h2x .corner-bl{left:20px!important;bottom:28px!important}.h2x .corner-r{right:16px!important}.h2x header{padding:18px 20px!important}.h2x .phone{max-width:100%}.h2x .big{font-size:clamp(88px,30vw,300px)!important}}
`;

const fade = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.25 }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } as const;

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const d = t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const h = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return <div className="mono">{d}<br />{h}</div>;
}

const CHAT = [
  { me: true, t: "📸 foto do cupom do posto" },
  { me: false, t: "Abastecimento registrado: R$ 250 · 47,1 L. Me manda a foto do hodômetro que eu calculo seu consumo." },
  { me: true, t: "📸 painel — 48.230 km" },
  { me: false, t: "Você fez 10,9 km/L. Cada km te custou R$ 0,49." },
  { me: false, t: "Lembrete: seu IPVA vence em 12 dias. Quer ver o valor e os débitos da placa?" },
];

const SERVICOS = [
  ["Raio-X do carro", "Consulta cautelar — leilão, sinistro, roubo e gravame — na hora de comprar ou vender um usado."],
  ["CRLV-e na hora", "O documento digital do veículo emitido dentro do app, guardado e aberto quando você precisar."],
  ["Débitos & multas", "IPVA, licenciamento e multas por órgão, antes do vencimento virar surpresa."],
  ["Consulta de CNH", "Pontos, situação e validade da habilitação — útil quando chega uma multa com pontos."],
  ["Oficinas parceiras", "Perto de você, com um benefício exclusivo pra quem chega pelo Co-pilot."],
  ["Seguro", "Cotação comparada antes de renovar no automático."],
  ["Garagem Totex", "Quanto o seu carro vale hoje e o estoque real, quando começar a pensar em trocar."],
];

export default function Home2() {
  const [params] = useSearchParams();
  const v = params.get("v") === "ciano" ? "ciano" : "mono";
  useEffect(() => {
    if (document.querySelector('link[data-h2x]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONTS; l.setAttribute("data-h2x", "1"); document.head.appendChild(l);
  }, []);

  return (
    <div className="h2x" data-v={v}>
      <style>{CSS}</style>

      {/* NAV mínima */}
      <header style={{ position: "fixed", inset: "0 0 auto 0", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 32px", mixBlendMode: "difference" }}>
        <img src="/totexmotors-logo.png" alt="TotexMotors" style={{ height: 22, width: "auto", filter: "grayscale(1) brightness(2)" }} />
        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/parceiro" className="brk">Parceiros</Link>
          <Link to="/entrar" className="brk">Entrar</Link>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <video src="/landing-demo.mp4" autoPlay muted loop playsInline preload="metadata"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) brightness(.28) contrast(1.1)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(5,5,5,.55) 0%,rgba(5,5,5,.15) 45%,#050505 100%)" }} />
        <div className="ruler" />
        <div className="mono corner-tl" style={{ position: "absolute", left: 64, top: 96 }}>TotexCar Co-pilot<br />by Totex Motors</div>
        <div className="mono corner-r" style={{ position: "absolute", right: 32, top: 110, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Grátis · sem mensalidade</div>
        <div className="corner-bl" style={{ position: "absolute", left: 64, bottom: 40 }}><Clock /></div>

        <div className="wrap" style={{ position: "relative", width: "100%", paddingBottom: 110, paddingTop: 180 }}>
          <motion.h1 className="disp" {...fade} style={{ fontSize: "clamp(44px,9.6vw,150px)", margin: 0, color: "#e9e9e9", maxWidth: 1180 }}>
            Seu carro,<br />cuidado pelo<br /><span className="acc">WhatsApp.</span>
          </motion.h1>
          <div className="hero-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "end", marginTop: 44 }}>
            <motion.p className="serif" {...fade} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 560, margin: 0 }}>
              Manda a foto do cupom, da multa ou do painel. O Co-pilot registra, avisa dos vencimentos e mostra quanto o carro custa de verdade.
            </motion.p>
            <motion.div {...fade}><Link to="/entrar?tab=register" className="pill"><span className="dot" />Começar grátis</Link></motion.div>
          </div>
        </div>
      </section>

      {/* (O PROBLEMA) */}
      <section className="sec">
        <div className="wrap">
          <motion.div className="label" {...fade}>(o problema)</motion.div>
          <motion.h2 className="serif" {...fade} style={{ fontSize: "clamp(30px,4vw,56px)", textAlign: "center", maxWidth: 900, margin: "28px auto 0", color: "#f2f2f2" }}>
            Você sabe quanto abasteceu. Mas sabe quanto o seu carro custa?
          </motion.h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 640, margin: "26px auto 80px", color: "var(--mute)" }}>
            Combustível é só o começo. Separados, os gastos parecem pequenos. Somados, contam a história de verdade do carro — e quase ninguém acompanha.
          </motion.p>
          <div>
            {[
              ["01", "Combustível", "Quanto você gasta por mês — e por quilômetro."],
              ["02", "Manutenção", "Os reparos pequenos que vão somando sem você ver."],
              ["03", "Vencimentos", "IPVA, licenciamento, seguro, CNH: o que está chegando e ainda não está no orçamento."],
              ["04", "Custo real", "Quanto cada quilômetro do seu carro custa pra você."],
            ].map(([n, t, d], i) => (
              <motion.div key={n} className={`item hair ${i === 3 ? "star" : ""}`} {...fade}>
                <div className="n">{n}</div>
                <div><h3>{t}</h3><p>{d}</p></div>
              </motion.div>
            ))}
            <div className="hair star" />
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="track disp" style={{ fontSize: "clamp(20px,2.6vw,34px)", color: "#bdbdbd" }}>
          {[0, 1].map((k) => (
            <span key={k}>
              {["Foto do cupom → registrado", "Hodômetro → km/L", "Foto da multa → recurso pronto", "IPVA vencendo → aviso no WhatsApp", "Revisão por km → lembrete"].map((s) => (
                <span key={s} style={{ padding: "0 36px" }}>{s} <span className="acc">✦</span></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* (O CO-PILOT) */}
      <section className="sec">
        <div className="wrap two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <motion.div className="label" {...fade} style={{ textAlign: "left" }}>(o co-pilot)</motion.div>
            <motion.h2 className="disp" {...fade} style={{ fontSize: "clamp(40px,5.6vw,88px)", margin: "26px 0 28px" }}>
              Não é só<br />registrar.<br /><span style={{ color: "var(--mute)" }}>É entender.</span>
            </motion.h2>
            <motion.p className="serif" {...fade} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 480, margin: 0 }}>
              Você pergunta no WhatsApp. O Co-pilot conhece o seu carro e responde com os seus dados — não com dezenas de gráficos.
            </motion.p>
          </div>
          <motion.div {...fade}>
            <div className="phone">
              <div className="hd">
                <div className="av">TC</div>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>TotexCar Co-pilot</div><div className="mono" style={{ fontSize: 9 }}><span className="acc">●</span> online</div></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18, minHeight: 360 }}>
                {CHAT.map((b, i) => (
                  <motion.div key={i} className={`bub ${b.me ? "me" : "bot"}`} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.22 }}>{b.t}</motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* NÚMEROS (só o que a gente prova) */}
      <section className="sec" style={{ paddingTop: 40 }}>
        <div className="wrap three" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32, textAlign: "center" }}>
          {[["R$ 0", "de mensalidade"], ["+25", "tipos de serviço no radar"], ["4", "consultas oficiais no app"]].map(([n, l]) => (
            <motion.div key={l} {...fade}>
              <div className="circ"><span className="serif" style={{ fontSize: 54 }}>{n}</span></div>
              <div className="num">{l}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* (GRÁTIS) */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <motion.div className="label" {...fade}>(grátis)</motion.div>
          <motion.div className="disp big" {...fade} style={{ fontSize: "clamp(96px,20vw,300px)", margin: "20px 0 36px", lineHeight: 1.04 }}>R$ <span className="acc">0</span></motion.div>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 620, margin: "0 auto 40px" }}>
            Porque cuidar melhor do seu carro não deveria começar com uma assinatura. Sem mensalidade, sem cartão.
          </motion.p>
          <motion.div {...fade}><Link to="/entrar?tab=register" className="pill"><span className="dot" />Criar meu Co-pilot</Link></motion.div>
        </div>
      </section>

      {/* (QUANDO PRECISAR) */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <motion.div className="label" {...fade}>(quando você precisar)</motion.div>
          <motion.h2 className="disp" {...fade} style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 20px", maxWidth: 1000 }}>
            A gente ajuda<br />a encontrar.
          </motion.h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 620, margin: "0 auto 70px", color: "var(--mute)" }}>
            O app é grátis. Serviços oficiais e parceiros aparecem só quando fazem sentido naquele momento — e o valor aparece antes de você confirmar.
          </motion.p>
          {SERVICOS.map(([t, d], i) => (
            <motion.div key={t} className={`item hair ${i % 2 ? "star" : ""}`} {...fade}>
              <div className="n">{String(i + 1).padStart(2, "0")}</div>
              <div><h3>{t}</h3><p>{d}</p></div>
            </motion.div>
          ))}
          <div className="hair star" />
        </div>
      </section>

      {/* TIPOGRAFIA CINÉTICA — a régua */}
      <section className="sec">
        <div className="wrap">
          <motion.p className="kin" {...fade}>
            Não parece <b>uma loja</b> tentando te vender um carro. Parece <b>a tecnologia</b> que deveria vir <b>com o carro.</b>
          </motion.p>
        </div>
      </section>

      {/* FECHAMENTO */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)", paddingBottom: 80 }}>
        <div className="wrap">
          <motion.h2 className="disp" {...fade} style={{ fontSize: "clamp(40px,7.4vw,116px)", margin: "0 0 36px", color: "#e9e9e9" }}>
            Seu carro já faz<br />parte da sua vida.<br /><span style={{ color: "var(--mute)" }}>Agora organize a dele.</span>
          </motion.h2>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link to="/entrar?tab=register" className="pill"><span className="dot" />Começar grátis</Link>
            <Link to="/parceiro" className="pill" style={{ borderColor: "var(--line)" }}>Sou uma oficina</Link>
          </div>
          <div className="hair" style={{ marginTop: 120, paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div className="mono">TotexCar Co-pilot · Totex Motors<br />© {new Date().getFullYear()} · todos os direitos reservados</div>
            <div className="mono" style={{ textAlign: "right" }}><Link to="/privacy-policy" style={{ color: "inherit", textDecoration: "none" }}>Privacidade</Link> · <Link to="/terms-conditions" style={{ color: "inherit", textDecoration: "none" }}>Termos</Link><br />Carapicuíba · Alphaville · SP</div>
          </div>
        </div>
      </section>
    </div>
  );
}
