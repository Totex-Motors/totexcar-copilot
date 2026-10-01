import { motion } from "framer-motion";
import { fade, Item, PageHead, Faq, Closing, WA } from "../editorial";

// CONTATO — canais reais (WhatsApp, e-mail, lojas). Sem formulário de mentira.

const ZAP = (t: string) => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;

const CANAIS: { t: string; d: string; href: string; cta: string; ext?: boolean }[] = [
  { t: "WhatsApp", d: "O jeito mais rápido. Dúvida, sugestão ou ajuda com o Co‑pilot: chama que a gente responde.", href: ZAP("Oi! Tenho uma dúvida sobre o TotexCar Co‑pilot"), cta: "Chamar no WhatsApp", ext: true },
  { t: "E-mail", d: "contato@totexmotors.com — pra assuntos que pedem anexo ou um texto maior, inclusive LGPD e dados.", href: "mailto:contato@totexmotors.com", cta: "Escrever e-mail", ext: true },
  { t: "Oficinas e serviços", d: "Quer aparecer no Radar do Co‑pilot com um benefício pro dono do carro? O cadastro leva dois minutos e é grátis.", href: "/parceiro", cta: "Clube de Parceiros" },
  { t: "Nas lojas", d: "Cardoso Veículos em Carapicuíba e Cardoso Prime em Alphaville, SP. Avaliação presencial e sessão de fotos no estúdio.", href: ZAP("Quero agendar uma avaliação do meu carro"), cta: "Agendar avaliação", ext: true },
];

export const Contact = () => (
  <>
    <PageHead label="contato" lines={["Fale com", <span className="acc" key="c">a gente.</span>]}>
      Gente de verdade, do outro lado do balcão. Escolha o canal e manda.
    </PageHead>

    <section style={{ paddingBottom: 120 }}>
      <div className="wrap">
        {CANAIS.map((c, i) => (
          <div key={c.t} style={{ position: "relative" }}>
            <Item n={i + 1} title={c.t} star={i % 2 === 1} delay={i * 0.08}>{c.d}</Item>
            <motion.div {...fade} style={{ margin: "-10px 0 34px 96px" }} className="cta-row">
              {c.ext
                ? <a href={c.href} target="_blank" rel="noreferrer" className="pill ghost" style={{ padding: "13px 22px" }}>{c.cta}</a>
                : <a href={c.href} className="pill ghost" style={{ padding: "13px 22px" }}>{c.cta}</a>}
            </motion.div>
          </div>
        ))}
        <div className="hair star" />
        <style>{`@media (max-width:768px){.h2x .cta-row{margin-left:62px!important}}`}</style>
      </div>
    </section>

    <Faq />
    <Closing lines={["Qualquer coisa,", "chama no WhatsApp.", <span style={{ color: "var(--mute)" }} key="o">A gente responde.</span>]} primary={["Começar grátis", "/entrar?tab=register"]} secondary={["Sou uma oficina", "/parceiro"]} />
  </>
);

export default Contact;
