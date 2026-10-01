import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

// SISTEMA "EDITORIAL MINIMAL" do site público (referência cinetica.studio).
// Preto/branco/cinza com micro-acentos em ciano. 3 fontes com papéis rígidos:
//   Gabarito 900 CAIXA ALTA (display) · Instrument Serif (parágrafos) · Martian Mono (metadados) · Montserrat (corpo)
// Rótulos de seção entre parênteses, hairlines com ✦ no lugar de cards, pílula vazada, muito ar.
// Movimento com framer-motion, respeitando prefers-reduced-motion:
//   títulos entram linha a linha por máscara; frase cinética acende com o scroll; fotos em P&B ganham cor
//   conforme aparecem na rolagem; números contam ao entrar; marquee pausa no hover; pílulas preenchem de ciano.
// Tudo que está no site é o que o produto faz hoje.

export const WA = "5511963786699";
export const FONTS = "https://fonts.googleapis.com/css2?family=Gabarito:wght@700;900&family=Instrument+Serif:ital@0;1&family=Martian+Mono:wght@400&family=Montserrat:wght@400;500&display=swap";

export const CSS = `
.h2x{overflow-x:hidden;min-height:100vh;background:#050505;color:#fff;font-family:Montserrat,system-ui,sans-serif;--acc:#2DD4BF;--mute:#8d8d8d;--line:rgba(255,255,255,.14);--ink2:#bdbdbd;-webkit-font-smoothing:antialiased}
.h2x[data-v="mono"]{--acc:#ffffff}
.h2x a{color:inherit}
.h2x .disp{font-family:Gabarito,Inter,system-ui,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;line-height:.92}
.h2x .serif{font-family:"Instrument Serif",Georgia,"Times New Roman",serif;font-weight:400;line-height:1.18;letter-spacing:-.005em}
.h2x .mono{font-family:"Martian Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);line-height:1.5}
.h2x .label{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);text-align:center}
.h2x .wrap{max-width:1280px;margin:0 auto;padding:0 32px}
.h2x .narrow{max-width:860px;margin:0 auto;padding:0 32px}
.h2x .sec{padding:140px 0}
.h2x .top{padding-top:180px}
.h2x .hair{border-top:1px solid var(--line);position:relative}
.h2x .hair.star::after{content:"✦";position:absolute;right:0;top:-8px;font-size:11px;color:var(--mute);background:#050505;padding-left:8px}
.h2x .pill{display:inline-flex;align-items:center;gap:12px;padding:18px 30px;border:1px solid var(--acc);border-radius:999px;color:#fff;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;background:transparent;cursor:pointer;font-family:Montserrat,system-ui,sans-serif;transition:background .35s cubic-bezier(.22,1,.36,1),color .35s,transform .35s cubic-bezier(.22,1,.36,1),opacity .3s}
.h2x .pill:hover{background:var(--acc);color:#050505;transform:translateY(-1px)}
.h2x .pill:disabled{opacity:.45;cursor:default;transform:none;background:transparent;color:#fff}
.h2x .pill.ghost{border-color:var(--line)}
.h2x .pill .dot{width:6px;height:6px;border-radius:999px;background:var(--acc);animation:h2pulse 2.4s ease-in-out infinite}
.h2x .pill:hover .dot{background:#050505;animation:none}
@keyframes h2pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.6);opacity:.55}}
.h2x .brk{position:relative;padding:10px 16px;font-family:"Martian Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);text-decoration:none;transition:color .3s;white-space:nowrap}
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
.h2x .item{display:grid;grid-template-columns:72px 1fr;gap:24px;padding:34px 0;transition:padding-left .4s cubic-bezier(.22,1,.36,1);color:inherit;text-decoration:none}
.h2x .item:hover{padding-left:10px}
.h2x .item .n{font-family:Gabarito;font-weight:900;font-size:40px;line-height:1;color:var(--mute);transition:color .3s}
.h2x .item:hover .n{color:var(--acc)}
.h2x .item h3{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(22px,2.6vw,34px);line-height:1;margin:0 0 10px;letter-spacing:-.01em}
.h2x .item p{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(19px,1.7vw,24px);line-height:1.3;color:var(--ink2);margin:0}
.h2x .item .meta{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px}
.h2x .kin{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(34px,6.4vw,92px);line-height:.98;letter-spacing:-.015em;color:#3a3a3a}
.h2x .kin b{font-weight:900}
.h2x .acc{color:var(--acc)}
.h2x .ln{display:block;overflow:hidden;padding:.16em 0 .08em;margin:-.16em 0 -.08em}
.h2x .ln>span{display:block;will-change:transform}
.h2x .ph{position:relative;overflow:hidden;background:#0a0a0a;border:1px solid var(--line)}
.h2x .ph img{position:absolute;inset:-12% 0;width:100%;height:124%;object-fit:cover;filter:grayscale(1) contrast(1.05) brightness(.9);transition:filter .9s cubic-bezier(.22,1,.36,1),transform 1.2s cubic-bezier(.22,1,.36,1)}
.h2x .ph.on img{filter:grayscale(0) contrast(1) brightness(1);transform:scale(1.03)}
@media (hover:hover){.h2x .ph:hover img{filter:grayscale(0) contrast(1) brightness(1);transform:scale(1.03)}}
.h2x .ph .cap{position:absolute;left:16px;bottom:14px;right:16px;display:flex;justify-content:space-between;gap:12px;color:#fff;mix-blend-mode:difference}
.h2x .photos{display:grid;grid-template-columns:repeat(12,1fr);gap:20px}
.h2x .faq{border-top:1px solid var(--line)}
.h2x .faq button{width:100%;display:grid;grid-template-columns:72px 1fr 40px;gap:24px;align-items:start;padding:30px 0;background:none;border:0;color:#fff;text-align:left;cursor:pointer;font-family:inherit}
.h2x .faq button .n{font-family:Gabarito;font-weight:900;font-size:28px;line-height:1;color:var(--mute);transition:color .3s}
.h2x .faq button:hover .n,.h2x .faq.open button .n{color:var(--acc)}
.h2x .faq button h3{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(19px,2vw,26px);line-height:1.05;margin:0;letter-spacing:-.01em}
.h2x .faq button .pm{font-family:"Martian Mono",monospace;font-size:18px;color:var(--mute);text-align:right;line-height:1}
.h2x .faq .ans{grid-column:2;padding:0 40px 30px 96px;font-family:"Instrument Serif",Georgia,serif;font-size:clamp(19px,1.7vw,23px);line-height:1.3;color:var(--ink2)}
.h2x .lbl{display:block;font-family:"Martian Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin:26px 0 8px}
.h2x .inp{width:100%;background:transparent;border:0;border-bottom:1px solid var(--line);padding:12px 0;color:#fff;font-family:"Instrument Serif",Georgia,serif;font-size:22px;line-height:1.2;outline:none;border-radius:0;transition:border-color .3s;-webkit-appearance:none;appearance:none}
.h2x .inp::placeholder{color:#4a4a4a}
.h2x .inp:focus{border-bottom-color:var(--acc)}
.h2x select.inp{background:#050505;cursor:pointer}
.h2x select.inp option{background:#0a0a0a;color:#fff;font-family:Montserrat,system-ui,sans-serif;font-size:14px}
.h2x .chip{font-family:"Martian Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:transparent;cursor:pointer;transition:color .3s,border-color .3s}
.h2x .chip:hover,.h2x .chip.on{color:#fff;border-color:var(--acc)}
.h2x .post{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(20px,1.8vw,25px);line-height:1.35;color:var(--ink2)}
.h2x .post p,.h2x .post li{font-family:inherit;font-size:inherit;line-height:inherit;color:inherit;margin:0 0 24px}
.h2x .post ul{list-style:none;padding:0;margin:0 0 48px;border-top:1px solid var(--line)}
.h2x .post li{padding:18px 0;margin:0;border-bottom:1px solid var(--line)}
.h2x .post strong{color:#fff;font-weight:400}
.h2x .post h2{font-family:Gabarito;font-weight:900;text-transform:uppercase;font-size:clamp(28px,3.4vw,46px);line-height:.95;letter-spacing:-.015em;color:#fff;margin:72px 0 24px}
.h2x .mark{color:#fff}
.h2x .err{font-family:"Martian Mono",monospace;font-size:11px;letter-spacing:.08em;color:#ff7b7b;margin-top:18px}
.h2x .two{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.h2x .three{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;text-align:center}
.h2x .foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:22px;margin-top:120px}
.h2x .foot a{text-decoration:none}
.h2x .foot a:hover{color:#fff}
@media (max-width:768px){.h2x .wrap,.h2x .narrow{padding:0 20px}.h2x .sec{padding:96px 0}.h2x .top{padding-top:130px}.h2x .ruler{display:none}.h2x .item{grid-template-columns:48px 1fr;gap:14px;padding:26px 0}.h2x .item .n{font-size:28px}.h2x .circ{width:140px;height:140px}.h2x .circ .serif{font-size:42px}.h2x .hero-row,.h2x .two,.h2x .three{grid-template-columns:1fr!important;gap:28px!important}.h2x .three{gap:40px!important}.h2x .corner-tl{left:20px!important;top:88px!important}.h2x .corner-bl{left:20px!important;bottom:28px!important}.h2x .corner-r{right:16px!important}.h2x header.h2nav{padding:18px 20px!important}.h2x .phone{max-width:100%}.h2x .big{font-size:clamp(88px,30vw,300px)!important}.h2x .photos{grid-template-columns:1fr!important;gap:14px}.h2x .photos .ph{grid-column:auto!important;aspect-ratio:4/3!important}.h2x .faq button{grid-template-columns:40px 1fr 24px;gap:12px;padding:22px 0}.h2x .faq button .n{font-size:20px}.h2x .faq .ans{padding:0 0 24px 52px}.h2x .foot{margin-top:80px}}
@media (prefers-reduced-motion:reduce){.h2x .marquee .track,.h2x .pill .dot{animation:none}}
`;

export const EASE = [0.22, 1, 0.36, 1] as const;
export const fade = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.25 }, transition: { duration: 0.7, ease: EASE } } as const;

/** Injeta as fontes do Google uma única vez. */
export function useEditorialFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-h2x]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONTS; l.setAttribute("data-h2x", "1"); document.head.appendChild(l);
  }, []);
}

/** Título que entra linha a linha por máscara (cada linha sobe de trás de um clip). */
export function Lines({ lines, delay = 0, now = false }: { lines: ReactNode[]; delay?: number; now?: boolean }) {
  const reduce = useReducedMotion();
  // Observa o bloco inteiro (não a linha escondida atrás do clip — essa nunca "entra na tela").
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const show = now || inView || !!reduce;
  return (
    <span ref={ref} style={{ display: "block" }}>
      {lines.map((l, i) => (
        <span className="ln" key={i}>
          <motion.span initial={reduce ? false : { y: "110%" }} animate={{ y: show ? 0 : "110%" }} transition={{ duration: 1.1, ease: EASE, delay: delay + i * 0.09 }}>
            {l}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Número que conta de 0 até o valor quando entra na tela. */
export function Count({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
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

function Word({ progress, range, children, strong }: { progress: MotionValue<number>; range: [number, number]; children: string; strong?: boolean }) {
  const color = useTransform(progress, range, ["#3a3a3a", strong ? "#ffffff" : "#8d8d8d"]);
  return <motion.span style={{ color }}>{children} </motion.span>;
}

/** Frase cinética: acende palavra por palavra conforme o scroll (e apaga ao voltar). */
export function Kinetic({ parts }: { parts: { t: string; b?: boolean }[] }) {
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

/** Foto real em P&B com parallax leve; ganha cor conforme aparece na rolagem (e no mouse). */
export function Photo({ src, n, cap, col, ratio, to }: { src: string; n?: string; cap: string; col?: string; ratio: string; to?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-6%", "6%"]);
  const on = useInView(ref, { amount: 0.45 });
  const inner = (
    <>
      <motion.img src={src} alt={cap} loading="lazy" style={{ y }} />
      <div className="cap">{n && <span className="mono" style={{ color: "#fff" }}>({n})</span>}<span className="mono" style={{ color: "#fff", textAlign: "right", marginLeft: "auto" }}>{cap}</span></div>
    </>
  );
  return (
    <motion.div ref={ref} className={`ph ${on ? "on" : ""}`} style={{ gridColumn: col, aspectRatio: ratio }} {...fade}>
      {to ? <Link to={to} style={{ position: "absolute", inset: 0 }}>{inner}</Link> : inner}
    </motion.div>
  );
}

export function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const d = t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const h = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return <div className="mono">{d}<br />{h}</div>;
}

/** Rótulo de seção entre parênteses. */
export function Label({ children, left }: { children: ReactNode; left?: boolean }) {
  return <motion.div className="label" {...fade} style={left ? { textAlign: "left" } : undefined}>({children})</motion.div>;
}

/** Item numerado com hairline (lista editorial). */
export function Item({ n, title, children, star, to, meta, delay = 0 }: { n: string | number; title: ReactNode; children?: ReactNode; star?: boolean; to?: string; meta?: ReactNode; delay?: number }) {
  const num = typeof n === "number" ? String(n).padStart(2, "0") : n;
  const body = (
    <>
      <div className="n">{num}</div>
      <div>{meta && <div className="meta">{meta}</div>}<h3>{title}</h3>{children && <p>{children}</p>}</div>
    </>
  );
  const cls = `item hair ${star ? "star" : ""}`;
  return to
    ? <motion.div {...fade} transition={{ ...fade.transition, delay }}><Link to={to} className={cls}>{body}</Link></motion.div>
    : <motion.div className={cls} {...fade} transition={{ ...fade.transition, delay }}>{body}</motion.div>;
}

/** Nav fixa, mínima, com cantos em colchete; mix-blend pra funcionar sobre foto e fundo. */
export function Nav() {
  return (
    <motion.header className="h2nav" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.4 }}
      style={{ position: "fixed", inset: "0 0 auto 0", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 32px", mixBlendMode: "difference" }}>
      <Link to="/" aria-label="TotexCar Co‑pilot"><img src="/totexmotors-logo.png" alt="TotexMotors" style={{ height: 22, width: "auto", filter: "grayscale(1) brightness(2)" }} /></Link>
      <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link to="/parceiro" className="brk">Parceiros</Link>
        <Link to="/entrar" className="brk">Entrar</Link>
      </nav>
    </motion.header>
  );
}

const FOOT_LINKS: [string, string][] = [["Grátis", "/pricing"], ["Recursos", "/integrations"], ["Blog", "/blogs"], ["Sobre", "/about"], ["Contato", "/contact"], ["Parceiros", "/parceiro"]];

/** Rodapé em mono com hairline. */
export function Foot() {
  return (
    <div className="hair foot">
      <div className="mono">
        TotexCar Co‑pilot · Totex Motors<br />© {new Date().getFullYear()} · todos os direitos reservados<br />
        <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          {FOOT_LINKS.map(([t, to], i) => <span key={to}>{i > 0 && <span style={{ marginRight: 10 }}>·</span>}<Link to={to}>{t}</Link></span>)}
        </span>
      </div>
      <div className="mono" style={{ textAlign: "right" }}>
        <Link to="/privacy-policy">Privacidade</Link> · <Link to="/terms-conditions">Termos</Link><br />Carapicuíba · Alphaville · SP<br />
        <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer">WhatsApp</a> · <a href="mailto:contato@totexmotors.com">contato@totexmotors.com</a>
      </div>
    </div>
  );
}

/** Fechamento padrão: título em 3 linhas + pílulas + rodapé. */
export function Closing({ lines, primary = ["Começar grátis", "/entrar?tab=register"], secondary = ["Sou uma oficina", "/parceiro"] }: { lines?: ReactNode[]; primary?: [string, string]; secondary?: [string, string] | null }) {
  const L = lines ?? ["Seu carro já faz", "parte da sua vida.", <span style={{ color: "var(--mute)" }} key="o">Agora organize a dele.</span>];
  return (
    <section className="sec" style={{ borderTop: "1px solid var(--line)", paddingBottom: 80 }}>
      <div className="wrap">
        <h2 className="disp" style={{ fontSize: "clamp(40px,7.4vw,116px)", margin: "0 0 36px", color: "#e9e9e9" }}><Lines lines={L} /></h2>
        <motion.div {...fade} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link to={primary[1]} className="pill"><span className="dot" />{primary[0]}</Link>
          {secondary && <Link to={secondary[1]} className="pill ghost">{secondary[0]}</Link>}
        </motion.div>
        <Foot />
      </div>
    </section>
  );
}

export const FAQS: [string, string][] = [
  ["Como registro um gasto ou um documento?", "É só mandar no WhatsApp do Co‑pilot: a foto da nota da oficina, o PDF do CRLV, o cupom do posto, um áudio ou uma mensagem. Ele entende, guarda no histórico do carro e registra na categoria certa."],
  ["Posso guardar documentos?", "Sim. CRLV, apólice do seguro, notas de manutenção, comprovantes de IPVA e multas ficam no cofre de documentos. Quando precisar, é só pedir \"meu CRLV\" que ele te manda na hora."],
  ["Como recebo os avisos de vencimento?", "O Co‑pilot acompanha as datas do carro e da sua CNH e avisa pelo WhatsApp antes de vencer: IPVA, licenciamento, seguro, CNH e revisão por quilometragem."],
  ["Preciso instalar algo?", "Não. Você usa pelo WhatsApp e, se quiser, abre o painel completo no navegador, no celular ou no computador."],
  ["Quanto custa?", "Nada. O Co‑pilot é grátis, sem mensalidade e sem cartão. Você só paga por serviços avulsos quando pedir (Raio-X do carro, CRLV-e, débitos e multas, consulta de CNH), e o valor aparece antes de confirmar."],
  ["Meus dados estão seguros?", "Sim. Seus dados ficam criptografados e só você tem acesso às informações do seu carro. Nada é compartilhado sem a sua autorização."],
];

/** Perguntas frequentes em lista numerada (acordeão). */
export function Faq({ items = FAQS }: { items?: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="wrap">
        <Label>perguntas frequentes</Label>
        <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 70px", maxWidth: 1000 }}><Lines lines={["O que mais", "perguntam."]} /></h2>
        <div>
          {items.map(([q, a], i) => (
            <motion.div key={q} className={`faq ${open === i ? "open" : ""}`} {...fade} transition={{ ...fade.transition, delay: (i % 3) * 0.06 }}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{q}</h3>
                <span className="pm">{open === i ? "−" : "+"}</span>
              </button>
              <motion.div initial={false} animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }} style={{ overflow: "hidden" }}>
                <div className="ans">{a}</div>
              </motion.div>
            </motion.div>
          ))}
          <div className="hair star" />
        </div>
      </div>
    </section>
  );
}

/** Cabeçalho padrão das páginas internas: rótulo + título display + parágrafo serifado. */
export function PageHead({ label, lines, children, align = "left" }: { label: string; lines: ReactNode[]; children?: ReactNode; align?: "left" | "center" }) {
  const c = align === "center";
  return (
    <section className="top" style={{ paddingBottom: 90 }}>
      <div className="wrap">
        <motion.div className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ textAlign: c ? "center" : "left" }}>({label})</motion.div>
        <h1 className="disp" style={{ fontSize: "clamp(44px,8.4vw,132px)", margin: "26px 0 0", color: "#e9e9e9", textAlign: c ? "center" : "left", maxWidth: c ? 1100 : 1180, marginLeft: c ? "auto" : 0, marginRight: c ? "auto" : 0 }}>
          <Lines now delay={0.25} lines={lines} />
        </h1>
        {children && (
          <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}
            style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 640, margin: c ? "40px auto 0" : "40px 0 0", textAlign: c ? "center" : "left" }}>
            {children}
          </motion.p>
        )}
      </div>
    </section>
  );
}
