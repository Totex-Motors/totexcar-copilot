import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

// HOME pública (sistema "editorial minimal", referência cinetica.studio).
// Monocromia disciplinada com micro-acentos em ciano, 3 fontes com papéis rígidos (grotesca pesada CAIXA ALTA /
// serifa editorial / mono pros metadados), rótulos de seção entre parênteses, hairlines com ✦ no lugar de cards,
// uma pílula vazada por seção, muito ar. ?v=mono força a versão 100% monocromática (comparação).
//
// Movimento (tudo com framer-motion, sem lib extra, respeita prefers-reduced-motion):
//  - títulos entram linha a linha por máscara (clip), com stagger — nunca "fade genérico";
//  - frase cinética acende palavra por palavra conforme o scroll (scroll-linked, não por tempo);
//  - fotos reais coloridas com leve parallax no scroll e zoom lento no hover;
//  - números nos anéis contam quando entram na tela; marquee contínua, pausa no hover;
//  - pílulas preenchem de ciano no hover e o ponto pulsa devagar.
// Tudo que está aqui é o que o produto faz hoje. Tem nav e rodapé próprios (não usa MarketingLayout).

const FONTS = "https://fonts.googleapis.com/css2?family=Gabarito:wght@700;900&family=Instrument+Serif:ital@0;1&family=Martian+Mono:wght@400&family=Montserrat:wght@400;500&display=swap";

const CSS = `
.h2x{overflow-x:hidden;background:#050505;color:#fff;font-family:Montserrat,system-ui,sans-serif;--acc:#2DD4BF;--mute:#8d8d8d;--line:rgba(255,255,255,.14);--ink2:#bdbdbd;-webkit-font-smoothing:antialiased}
.h2x[data-v="mono"]{--acc:#ffffff}
.h2x .disp{font-family:Gabarito,Inter,system-ui,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;line-height:.92}
.h2x .serif{font-family:"Instrument Serif",Georgia,"Times New Roman",serif;font-weight:400;line-height:1.18;letter-spacing:-.005em}
.h2x .mono{font-family:"Martian Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);line-height:1.5}
.h2x .label{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);text-align:center}
.h2x .wrap{max-width:1280px;margin:0 auto;padding:0 32px}
.h2x .sec{padding:140px 0}
.h2x .hair{border-top:1px solid var(--line);position:relative}
.h2x .hair.star::after{content:"✦";position:absolute;right:0;top:-8px;font-size:11px;color:var(--mute);background:#050505;padding-left:8px}
.h2x .pill{display:inline-flex;align-items:center;gap:12px;padding:18px 30px;border:1px solid var(--acc);border-radius:999px;color:#fff;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;transition:background .35s cubic-bezier(.22,1,.36,1),color .35s,transform .35s cubic-bezier(.22,1,.36,1)}
.h2x .pill:hover{background:var(--acc);color:#050505;transform:translateY(-1px)}
.h2x .pill .dot{width:6px;height:6px;border-radius:999px;background:var(--acc);animation:h2pulse 2.4s ease-in-out infinite}
.h2x .pill:hover .dot{background:#050505;animation:none}
@keyframes h2pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.6);opacity:.55}}
.h2x .brk{position:relative;padding:10px 16px;font-family:"Martian Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);text-decoration:none;transition:color .3s}
.h2x .brk:hover{color:#fff}
.h2x .brk::before,.h2x .brk::after{content:"";position:absolute;width:8px;height:8px;border-color:var(--line);border-style:solid;transition:border-color .3s}
.h2x .brk:hover::before,.h2x .brk:hover::after{border-color:var(--acc)}
.h2x .brk::before{left:0;top:0;border-width:1px 0 0 1px}
.h2x .brk::after{right:0;bottom:0;border-width:0 1px 1px 0}
.h2x .ruler{position:absolute;left:32px;top:120px;bottom:120px;width:16px;background:repeating-linear-gradient(to bottom,var(--line) 0 1px,transparent 1px 34px);opacity:.9}
.h2x .ruler::before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px;background:repeating-linear-gradient(to bottom,transparent 0 17px,var(--line) 17px 18px,transparent 18px 34px)}
.h2x .marquee{overflow:hidden;white-space:nowrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0}
.h2x .marquee .track{display:inline-block;animation:h2mq 34s linear infinite}
.h2x .marquee:hover .track{animation-play-state:paused}
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
.h2x .item{display:grid;grid-template-columns:72px 1fr;gap:24px;padding:34px 0;transition:padding-left .4s cubic-bezier(.22,1,.36,1)}
.h2x .item:hover{padding-left:10px}
.h2x .item .n{font-family:Gabarito;font-weight:900;font-size:40px;line-height:1;color:var(--mute);transition:color .3s}
.h2x .item:hover .n{color:var(--acc)}
.h2x .item h3{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(22px,2.6vw,34px);line-height:1;margin:0 0 10px;letter-spacing:-.01em}
.h2x .item p{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(19px,1.7vw,24px);line-height:1.3;color:var(--ink2);margin:0}
.h2x .kin{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(34px,6.4vw,92px);line-height:.98;letter-spacing:-.015em;color:#3a3a3a}
.h2x .kin b{font-weight:900}
.h2x .acc{color:var(--acc)}
.h2x .ln{display:block;overflow:hidden;padding:.16em 0 .08em;margin:-.16em 0 -.08em}
.h2x .ln>span{display:block;will-change:transform}
.h2x .ph{position:relative;overflow:hidden;background:#0a0a0a;border:1px solid var(--line)}
.h2x .ph img{position:absolute;inset:-12% 0;width:100%;height:124%;object-fit:cover;filter:brightness(.92) saturate(.95);transition:filter .8s cubic-bezier(.22,1,.36,1),transform 1.2s cubic-bezier(.22,1,.36,1)}
.h2x .ph:hover img{filter:brightness(1) saturate(1);transform:scale(1.03)}
.h2x .ph .cap{position:absolute;left:16px;bottom:14px;right:16px;display:flex;justify-content:space-between;gap:12px;color:#fff;mix-blend-mode:difference}
.h2x .photos{display:grid;grid-template-columns:repeat(12,1fr);gap:20px}
@media (max-width:768px){.h2x .wrap{padding:0 20px}.h2x .sec{padding:96px 0}.h2x .ruler{display:none}.h2x .item{grid-template-columns:48px 1fr;gap:14px;padding:26px 0}.h2x .item .n{font-size:28px}.h2x .circ{width:140px;height:140px}.h2x .circ .serif{font-size:42px}.h2x .hero-row,.h2x .two,.h2x .three{grid-template-columns:1fr!important;gap:28px!important}.h2x .three{gap:40px!important}.h2x .corner-tl{left:20px!important;top:88px!important}.h2x .corner-bl{left:20px!important;bottom:28px!important}.h2x .corner-r{right:16px!important}.h2x header{padding:18px 20px!important}.h2x .phone{max-width:100%}.h2x .big{font-size:clamp(88px,30vw,300px)!important}.h2x .photos{grid-template-columns:1fr!important;gap:14px}.h2x .photos .ph{grid-column:auto!important;aspect-ratio:4/3!important}}
@media (prefers-reduced-motion:reduce){.h2x .marquee .track,.h2x .pill .dot{animation:none}}
`;

const EASE = [0.22, 1, 0.36, 1] as const;
const fade = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.25 }, transition: { duration: 0.7, ease: EASE } } as const;

/** Título que entra linha a linha por máscara (cada linha sobe de trás de um clip). */
function Lines({ lines, delay = 0, now = false }: { lines: React.ReactNode[]; delay?: number; now?: boolean }) {
  const reduce = useReducedMotion();
  // Observa o bloco inteiro (não a linha escondida atrás do clip — essa nunca "entra na tela").
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const show = now || inView || !!reduce;
  return (
    <span ref={ref} style={{ display: "block" }}>
      {lines.map((l, i) => (
        <span className="ln" key={i}>
          <motion.span
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: show ? 0 : "110%" }}
            transition={{ duration: 1.1, ease: EASE, delay: delay + i * 0.09 }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Número que conta de 0 até o valor quando entra na tela. */
function Count({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t0 = performance.now(); const dur = 1400;
    let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 4); setN(Math.round(to * e)); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to]);
  return <span ref={ref}>{prefix}{n}{suffix}</span>;
}

/** Palavra da frase cinética: acende conforme o scroll passa por ela. */
function Word({ progress, range, children, strong }: { progress: MotionValue<number>; range: [number, number]; children: string; strong?: boolean }) {
  const color = useTransform(progress, range, ["#3a3a3a", strong ? "#ffffff" : "#8d8d8d"]);
  return <motion.span style={{ color }}>{children} </motion.span>;
}

function Kinetic({ parts }: { parts: { t: string; b?: boolean }[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const words = parts.flatMap((p) => p.t.split(" ").map((w) => ({ w, b: !!p.b })));
  return (
    <p className="kin" ref={ref}>
      {words.map((x, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, Math.min(1, (i + 1.5) / words.length)]} strong={x.b}>{x.w}</Word>
      ))}
    </p>
  );
}

/** Foto real em P&B com parallax leve no scroll; cor no hover. */
function Photo({ src, n, cap, col, ratio }: { src: string; n: string; cap: string; col: string; ratio: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-6%", "6%"]);
  return (
    <motion.div ref={ref} className="ph" style={{ gridColumn: col, aspectRatio: ratio }} {...fade}>
      <motion.img src={src} alt={cap} loading="lazy" style={{ y }} />
      <div className="cap"><span className="mono" style={{ color: "#fff" }}>({n})</span><span className="mono" style={{ color: "#fff", textAlign: "right" }}>{cap}</span></div>
    </motion.div>
  );
}

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const d = t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const h = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return <div className="mono">{d}<br />{h}</div>;
}

const CHAT = [
  { me: true, t: "📎 nota da oficina — pastilhas e óleo, R$ 680" },
  { me: false, t: "Guardei no histórico do Onix. Pastilhas e óleo aos 62.300 km. Pelo seu uso, a próxima troca de óleo cai em novembro — eu te lembro." },
  { me: true, t: "📄 CRLV 2026" },
  { me: false, t: "Documento no cofre. Quando precisar, é só pedir \"meu CRLV\" que eu te mando na hora." },
  { me: false, t: "Seu IPVA vence em 12 dias e apareceu uma multa de R$ 195 na placa. Quer que eu monte o recurso?" },
];

// Fotos reais já usadas no site (public/) — mantidas, agora em tratamento P&B editorial.
const PHOTOS = [
  { src: "/whatsapp-woman.jpg", cap: "Tudo pelo WhatsApp", col: "span 7", ratio: "16/10" },
  { src: "/registro-auto.jpg", cap: "Mandou, registrou", col: "span 5", ratio: "4/5" },
  { src: "/alertas.jpg", cap: "Documentos e avisos no lugar", col: "span 5", ratio: "4/5" },
  { src: "/relatorios.jpg", cap: "Quanto o carro custa, de verdade", col: "span 7", ratio: "16/10" },
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

export function Home() {
  const [params] = useSearchParams();
  const v = params.get("v") === "mono" ? "mono" : "ciano";
  useEffect(() => {
    if (document.querySelector('link[data-h2x]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONTS; l.setAttribute("data-h2x", "1"); document.head.appendChild(l);
  }, []);

  return (
    <div className="h2x" data-v={v}>
      <style>{CSS}</style>

      {/* NAV mínima */}
      <motion.header initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
        style={{ position: "fixed", inset: "0 0 auto 0", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 32px", mixBlendMode: "difference" }}>
        <img src="/totexmotors-logo.png" alt="TotexMotors" style={{ height: 22, width: "auto", filter: "grayscale(1) brightness(2)" }} />
        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/parceiro" className="brk">Parceiros</Link>
          <Link to="/entrar" className="brk">Entrar</Link>
        </nav>
      </motion.header>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <motion.video src="/landing-demo.mp4" autoPlay muted loop playsInline preload="metadata"
          initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 2.2, ease: EASE }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) brightness(.28) contrast(1.1)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(5,5,5,.55) 0%,rgba(5,5,5,.15) 45%,#050505 100%)" }} />
        <div className="ruler" />
        <motion.div className="mono corner-tl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.9 }} style={{ position: "absolute", left: 64, top: 96 }}>TotexCar Co-pilot<br />by Totex Motors</motion.div>
        <motion.div className="mono corner-r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }} style={{ position: "absolute", right: 32, top: 110, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Grátis · sem mensalidade</motion.div>
        <motion.div className="corner-bl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.1 }} style={{ position: "absolute", left: 64, bottom: 40 }}><Clock /></motion.div>

        <div className="wrap" style={{ position: "relative", width: "100%", paddingBottom: 110, paddingTop: 180 }}>
          <h1 className="disp" style={{ fontSize: "clamp(44px,9.6vw,150px)", margin: 0, color: "#e9e9e9", maxWidth: 1180 }}>
            <Lines now delay={0.25} lines={["Seu carro,", "cuidado pelo", <span className="acc" key="w">WhatsApp.</span>]} />
          </h1>
          <div className="hero-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "end", marginTop: 44 }}>
            <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.75 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 560, margin: 0 }}>
              Documentos, notas da oficina, multas, IPVA, gastos. Manda pro Co-pilot: ele guarda, organiza o histórico do carro e te avisa do que importa antes de virar problema.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.95 }}><Link to="/entrar?tab=register" className="pill"><span className="dot" />Começar grátis</Link></motion.div>
          </div>
        </div>
      </section>

      {/* (O PROBLEMA) */}
      <section className="sec">
        <div className="wrap">
          <motion.div className="label" {...fade}>(o problema)</motion.div>
          <motion.h2 className="serif" {...fade} style={{ fontSize: "clamp(30px,4vw,56px)", textAlign: "center", maxWidth: 900, margin: "28px auto 0", color: "#f2f2f2" }}>
            Tudo do seu carro está espalhado. No porta‑luvas, no e‑mail, na memória.
          </motion.h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 640, margin: "26px auto 80px", color: "var(--mute)" }}>
            CRLV num lugar, nota da revisão em outro, e o IPVA você lembra quando chega a multa. Separados, parecem detalhes. Juntos, são o histórico do carro — e ninguém cuida dele por você.
          </motion.p>
          <div>
            {[
              ["01", "Documentos", "CRLV, apólice, nota da oficina, comprovante do IPVA. Onde está cada um na hora que você precisa?"],
              ["02", "Manutenção", "Qual foi a última troca de óleo? Com quantos km? Quanto custou? Quando é a próxima?"],
              ["03", "Vencimentos", "IPVA, licenciamento, seguro, CNH, revisão: o que vence, quando, e o que fazer antes."],
              ["04", "Decisões", "Esse orçamento está caro? Vale consertar ou trocar? Vender agora ou esperar?"],
            ].map(([n, t, d], i) => (
              <motion.div key={n} className={`item hair ${i === 3 ? "star" : ""}`} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }}>
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
              {["Nota da oficina → guardada no histórico", "CRLV → no bolso", "Foto da multa → recurso pronto", "IPVA vencendo → aviso no WhatsApp", "Revisão por km → lembrete", "Cupom → gasto registrado"].map((s) => (
                <span key={s} style={{ padding: "0 36px" }}>{s} <span className="acc">✦</span></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* (NA PRÁTICA) — fotos reais */}
      <section className="sec" style={{ paddingBottom: 60 }}>
        <div className="wrap">
          <motion.div className="label" {...fade} style={{ textAlign: "left", marginBottom: 28 }}>(na prática)</motion.div>
          <div className="photos">
            {PHOTOS.map((p, i) => <Photo key={p.src} {...p} n={String(i + 1).padStart(2, "0")} />)}
          </div>
        </div>
      </section>

      {/* (O CO-PILOT) */}
      <section className="sec">
        <div className="wrap two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <motion.div className="label" {...fade} style={{ textAlign: "left" }}>(o co-pilot)</motion.div>
            <h2 className="disp" style={{ fontSize: "clamp(40px,5.6vw,88px)", margin: "26px 0 28px" }}>
              <Lines lines={["Não é só", "guardar.", <span style={{ color: "var(--mute)" }} key="e">É decidir melhor.</span>]} />
            </h2>
            <motion.p className="serif" {...fade} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 480, margin: 0 }}>
              O Co-pilot lê o que você manda, guarda no histórico do carro e faz a curadoria: o que vence, o que está caro, o que fazer agora. Sugestões com os seus dados — não com gráfico genérico.
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
          {[
            { n: <>R$ 0</>, l: "de mensalidade" },
            { n: <Count to={25} prefix="+" />, l: "tipos de serviço no radar" },
            { n: <Count to={4} />, l: "consultas oficiais no app" },
          ].map(({ n, l }, i) => (
            <motion.div key={l} {...fade} transition={{ ...fade.transition, delay: i * 0.12 }}>
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
          <div className="disp big" style={{ fontSize: "clamp(96px,20vw,300px)", margin: "20px 0 36px", lineHeight: 1.04 }}>
            <Lines lines={[<>R$ <span className="acc">0</span></>]} />
          </div>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 620, margin: "0 auto 40px" }}>
            O Co-pilot é grátis. Sem mensalidade, sem cartão. Você só paga quando pedir um serviço oficial — e o valor aparece antes de confirmar.
          </motion.p>
          <motion.div {...fade}><Link to="/entrar?tab=register" className="pill"><span className="dot" />Criar meu Co-pilot</Link></motion.div>
        </div>
      </section>

      {/* (QUANDO PRECISAR) */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <motion.div className="label" {...fade}>(quando você precisar)</motion.div>
          <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 20px", maxWidth: 1000 }}>
            <Lines lines={["A gente ajuda", "a encontrar."]} />
          </h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 620, margin: "0 auto 70px", color: "var(--mute)" }}>
            O app é grátis. Serviços oficiais e parceiros aparecem só quando fazem sentido naquele momento — e o valor aparece antes de você confirmar.
          </motion.p>
          {SERVICOS.map(([t, d], i) => (
            <motion.div key={t} className={`item hair ${i % 2 ? "star" : ""}`} {...fade} transition={{ ...fade.transition, delay: (i % 3) * 0.07 }}>
              <div className="n">{String(i + 1).padStart(2, "0")}</div>
              <div><h3>{t}</h3><p>{d}</p></div>
            </motion.div>
          ))}
          <div className="hair star" />
        </div>
      </section>

      {/* TIPOGRAFIA CINÉTICA — acende com o scroll (a ponte com a Totex: histórico organizado = valor de revenda) */}
      <section className="sec">
        <div className="wrap">
          <Kinetic parts={[{ t: "Carro com histórico organizado" }, { t: "vale mais", b: true }, { t: "na hora de vender. O Co‑pilot cuida disso" }, { t: "desde o primeiro dia.", b: true }]} />
        </div>
      </section>

      {/* FECHAMENTO */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)", paddingBottom: 80 }}>
        <div className="wrap">
          <h2 className="disp" style={{ fontSize: "clamp(40px,7.4vw,116px)", margin: "0 0 36px", color: "#e9e9e9" }}>
            <Lines lines={["Seu carro já faz", "parte da sua vida.", <span style={{ color: "var(--mute)" }} key="o">Agora organize a dele.</span>]} />
          </h2>
          <motion.div {...fade} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link to="/entrar?tab=register" className="pill"><span className="dot" />Começar grátis</Link>
            <Link to="/parceiro" className="pill" style={{ borderColor: "var(--line)" }}>Sou uma oficina</Link>
          </motion.div>
          <div className="hair" style={{ marginTop: 120, paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div className="mono">TotexCar Co-pilot · Totex Motors<br />© {new Date().getFullYear()} · todos os direitos reservados</div>
            <div className="mono" style={{ textAlign: "right" }}><Link to="/privacy-policy" style={{ color: "inherit", textDecoration: "none" }}>Privacidade</Link> · <Link to="/terms-conditions" style={{ color: "inherit", textDecoration: "none" }}>Termos</Link><br />Carapicuíba · Alphaville · SP</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
