import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CSS, EASE, fade, useEditorialFonts, Lines, Count, Kinetic, Photo, Clock, Nav, Foot, Label, Item } from "../editorial";

// HOME pública (sistema editorial — ver ../editorial.tsx). Tem nav e rodapé próprios (não usa MarketingLayout).
// ?v=mono força a versão 100% monocromática (comparação).

const CHAT = [
  { me: true, t: "📎 nota da oficina — pastilhas e óleo, R$ 680" },
  { me: false, t: "Guardei no histórico do Onix. Pastilhas e óleo aos 62.300 km. Pelo seu uso, a próxima troca de óleo cai em novembro — eu te lembro." },
  { me: true, t: "📄 CRLV 2026" },
  { me: false, t: "Documento no cofre. Quando precisar, é só pedir \"meu CRLV\" que eu te mando na hora." },
  { me: false, t: "Seu IPVA vence em 12 dias e apareceu uma multa de R$ 195 na placa. Quer que eu monte o recurso?" },
];

// Fotos reais já usadas no site (public/).
const PHOTOS = [
  { src: "/whatsapp-woman.jpg", cap: "Tudo pelo WhatsApp", col: "span 7", ratio: "16/10" },
  { src: "/registro-auto.jpg", cap: "Mandou, registrou", col: "span 5", ratio: "4/5" },
  { src: "/alertas.jpg", cap: "Documentos e avisos no lugar", col: "span 5", ratio: "4/5" },
  { src: "/relatorios.jpg", cap: "Quanto o carro custa, de verdade", col: "span 7", ratio: "16/10" },
];

const PROBLEMA: [string, string][] = [
  ["Documentos", "CRLV, apólice, nota da oficina, comprovante do IPVA. Onde está cada um na hora que você precisa?"],
  ["Manutenção", "Qual foi a última troca de óleo? Com quantos km? Quanto custou? Quando é a próxima?"],
  ["Vencimentos", "IPVA, licenciamento, seguro, CNH, revisão: o que vence, quando, e o que fazer antes."],
  ["Decisões", "Esse orçamento está caro? Vale consertar ou trocar? Vender agora ou esperar?"],
];

const SERVICOS: [string, string][] = [
  ["Raio-X do carro", "Consulta cautelar — leilão, sinistro, roubo e gravame — na hora de comprar ou vender um usado."],
  ["CRLV-e na hora", "O documento digital do veículo emitido dentro do app, guardado e aberto quando você precisar."],
  ["Débitos & multas", "IPVA, licenciamento e multas por órgão, antes do vencimento virar surpresa."],
  ["Consulta de CNH", "Pontos, situação e validade da habilitação — útil quando chega uma multa com pontos."],
  ["Oficinas parceiras", "Perto de você, com um benefício exclusivo pra quem chega pelo Co‑pilot."],
  ["Seguro", "Cotação comparada antes de renovar no automático."],
  ["Garagem Totex", "Quanto o seu carro vale hoje e o estoque real, quando começar a pensar em trocar."],
];

const MARQUEE = ["Nota da oficina → guardada no histórico", "CRLV → no bolso", "Foto da multa → recurso pronto", "IPVA vencendo → aviso no WhatsApp", "Revisão por km → lembrete", "Cupom → gasto registrado"];

export function Home() {
  const [params] = useSearchParams();
  const v = params.get("v") === "mono" ? "mono" : "ciano";
  useEditorialFonts();

  return (
    <div className="h2x" data-v={v}>
      <style>{CSS}</style>
      <Nav />

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <motion.video src="/landing-demo.mp4" autoPlay muted loop playsInline preload="metadata"
          initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 2.2, ease: EASE }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) brightness(.28) contrast(1.1)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(5,5,5,.55) 0%,rgba(5,5,5,.15) 45%,#050505 100%)" }} />
        <div className="ruler" />
        <motion.div className="mono corner-tl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.9 }} style={{ position: "absolute", left: 64, top: 96 }}>TotexCar Co‑pilot<br />by Totex Motors</motion.div>
        <motion.div className="mono corner-r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }} style={{ position: "absolute", right: 32, top: 110, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Grátis · sem mensalidade</motion.div>
        <motion.div className="corner-bl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.1 }} style={{ position: "absolute", left: 64, bottom: 40 }}><Clock /></motion.div>

        <div className="wrap" style={{ position: "relative", width: "100%", paddingBottom: 110, paddingTop: 180 }}>
          <h1 className="disp" style={{ fontSize: "clamp(44px,9.6vw,150px)", margin: 0, color: "#e9e9e9", maxWidth: 1180 }}>
            <Lines now delay={0.25} lines={["Seu carro,", "cuidado pelo", <span className="acc" key="w">WhatsApp.</span>]} />
          </h1>
          <div className="hero-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "end", marginTop: 44 }}>
            <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.75 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 560, margin: 0 }}>
              Documentos, notas da oficina, multas, IPVA, gastos. Manda pro Co‑pilot: ele guarda, organiza o histórico do carro e te avisa do que importa antes de virar problema.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.95 }}><Link to="/entrar?tab=register" className="pill"><span className="dot" />Criar meu Co‑pilot</Link></motion.div>
          </div>
        </div>
      </section>

      {/* (O PROBLEMA) */}
      <section className="sec">
        <div className="wrap">
          <Label>o problema</Label>
          <motion.h2 className="serif" {...fade} style={{ fontSize: "clamp(30px,4vw,56px)", textAlign: "center", maxWidth: 900, margin: "28px auto 0", color: "#f2f2f2" }}>
            Tudo do seu carro está espalhado. No porta‑luvas, no e‑mail, na memória.
          </motion.h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 640, margin: "26px auto 80px", color: "var(--mute)" }}>
            CRLV num lugar, nota da revisão em outro, e o IPVA você lembra quando chega a multa. Separados, parecem detalhes. Juntos, são o histórico do carro — e ninguém cuida dele por você.
          </motion.p>
          <div>
            {PROBLEMA.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i === 3} delay={i * 0.08}>{d}</Item>)}
            <div className="hair star" />
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="track disp" style={{ fontSize: "clamp(20px,2.6vw,34px)", color: "#bdbdbd" }}>
          {[0, 1].map((k) => (
            <span key={k}>{MARQUEE.map((s) => <span key={s} style={{ padding: "0 36px" }}>{s} <span className="acc">✦</span></span>)}</span>
          ))}
        </div>
      </div>

      {/* (NA PRÁTICA) — fotos reais */}
      <section className="sec" style={{ paddingBottom: 60 }}>
        <div className="wrap">
          <div style={{ marginBottom: 28 }}><Label left>na prática</Label></div>
          <div className="photos">
            {PHOTOS.map((p, i) => <Photo key={p.src} {...p} n={String(i + 1).padStart(2, "0")} />)}
          </div>
        </div>
      </section>

      {/* (O CO-PILOT) */}
      <section className="sec">
        <div className="wrap two">
          <div>
            <Label left>o co-pilot</Label>
            <h2 className="disp" style={{ fontSize: "clamp(40px,5.6vw,88px)", margin: "26px 0 28px" }}>
              <Lines lines={["Não é só", "guardar.", <span style={{ color: "var(--mute)" }} key="e">É decidir melhor.</span>]} />
            </h2>
            <motion.p className="serif" {...fade} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 480, margin: 0 }}>
              O Co‑pilot lê o que você manda, guarda no histórico do carro e faz a curadoria: o que vence, o que está caro, o que fazer agora. Sugestões com os seus dados — não com gráfico genérico.
            </motion.p>
          </div>
          <motion.div {...fade}>
            <div className="phone">
              <div className="hd">
                <div className="av">TC</div>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>TotexCar Co‑pilot</div><div className="mono" style={{ fontSize: 9 }}><span className="acc">●</span> online</div></div>
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
        <div className="wrap three">
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
          <Label>grátis</Label>
          <div className="disp big" style={{ fontSize: "clamp(96px,20vw,300px)", margin: "20px 0 36px", lineHeight: 1.04 }}>
            <Lines lines={[<>R$ <span className="acc">0</span></>]} />
          </div>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 620, margin: "0 auto 40px" }}>
            O Co‑pilot é grátis. Sem mensalidade, sem cartão. Você só paga quando pedir um serviço oficial — e o valor aparece antes de confirmar.
          </motion.p>
          <motion.div {...fade}><Link to="/entrar?tab=register" className="pill"><span className="dot" />Criar meu Co‑pilot</Link></motion.div>
        </div>
      </section>

      {/* (QUANDO PRECISAR) */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Label>quando você precisar</Label>
          <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 20px", maxWidth: 1000 }}>
            <Lines lines={["A gente ajuda", "a encontrar."]} />
          </h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 620, margin: "0 auto 70px", color: "var(--mute)" }}>
            O app é grátis. Serviços oficiais e parceiros aparecem só quando fazem sentido naquele momento — e o valor aparece antes de você confirmar.
          </motion.p>
          {SERVICOS.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.07}>{d}</Item>)}
          <div className="hair star" />
        </div>
      </section>

      {/* TIPOGRAFIA CINÉTICA — a ponte com a Totex: histórico organizado = valor de revenda */}
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
            <Link to="/entrar?tab=register" className="pill"><span className="dot" />Criar meu Co‑pilot</Link>
            <Link to="/parceiro" className="pill ghost">Sou uma oficina</Link>
          </motion.div>
          <Foot />
        </div>
      </section>
    </div>
  );
}

export default Home;
