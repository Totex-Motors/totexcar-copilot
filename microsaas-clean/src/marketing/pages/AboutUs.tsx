import { motion } from "framer-motion";
import { fade, Lines, Label, Item, Photo, Kinetic, Closing, PageHead } from "../editorial";

// SOBRE — quem faz o Co‑pilot. Sem time fictício, sem vagas inventadas, sem logo de mentira: só o que é verdade.

const MOVE: [string, string][] = [
  ["Nossa missão", "Ajudar o dono de carro comum a ter o histórico do veículo organizado — documentos, manutenção, gastos, vencimentos — e decidir melhor com ele."],
  ["Simples de usar", "Você manda uma mensagem no WhatsApp: foto, PDF, áudio ou texto. O Co‑pilot guarda, registra e avisa. Sem planilha, sem app pra baixar."],
  ["Honestidade", "Nada de promessa que o produto não cumpre. Valor de serviço aparece antes de confirmar; avaliação de carro é validada presencialmente."],
  ["Nossa visão", "Um ecossistema que cuida do carro de ponta a ponta: do cuidado diário à avaliação, à venda e à troca — com a Totex do outro lado do balcão."],
];

const HISTORIA: [string, string][] = [
  ["A Totex Motors", "Nasceu no dia a dia de quem vive de carro: a loja, o balcão, o cliente que chega com o porta-luvas cheio de papel e sem saber a última troca de óleo."],
  ["A ideia", "Se a gente conhece a dor de quem compra, vende e cuida, por que não dar a essa pessoa um co-piloto? Um assistente no WhatsApp que guarda tudo e avisa antes."],
  ["Hoje", "O Co‑pilot cuida de documentos, manutenção, multas e vencimentos, consulta FIPE, fala com oficinas parceiras e conecta o dono à Garagem Totex quando é hora de trocar."],
];

export const AboutUs = () => (
  <>
    <PageHead label="sobre" lines={["Feito por quem", "vive de carro.", <span className="acc" key="c">Todo dia.</span>]}>
      A Totex Motors vende carro em Carapicuíba e em Alphaville. O Co‑pilot nasceu do que a gente vê no balcão: carro bom perde valor por falta de histórico, e dono bom perde prazo por falta de aviso.
    </PageHead>

    <section style={{ paddingBottom: 40 }}>
      <div className="wrap photos">
        <Photo src="/loja-carapicuiba.jpg" cap="Cardoso Veículos · Carapicuíba" col="span 8" ratio="16/9" n="01" />
        <Photo src="/registro-auto.jpg" cap="O cuidado diário" col="span 4" ratio="4/5" n="02" />
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <Label>o que nos move</Label>
        <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 70px", maxWidth: 1000 }}>
          <Lines lines={["Cuidar do carro", "como a gente cuida", "do nosso."]} />
        </h2>
        {MOVE.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.07}>{d}</Item>)}
        <div className="hair star" />
      </div>
    </section>

    <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="wrap two" style={{ alignItems: "start" }}>
        <div>
          <Label left>a história</Label>
          <h2 className="disp" style={{ fontSize: "clamp(40px,5.6vw,88px)", margin: "26px 0 28px" }}>
            <Lines lines={["Do balcão", "pro WhatsApp."]} />
          </h2>
          <motion.p className="serif" {...fade} style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", maxWidth: 480, margin: 0 }}>
            Duas lojas, um estúdio de fotos, um estoque real e um assistente que trabalha pelo dono do carro — não pela loja.
          </motion.p>
        </div>
        <div>
          {HISTORIA.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i === 2} delay={i * 0.08}>{d}</Item>)}
          <div className="hair star" />
        </div>
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <Kinetic parts={[{ t: "A gente vende carro." }, { t: "Mas o Co‑pilot", b: true }, { t: "trabalha pra quem" }, { t: "dirige.", b: true }]} />
      </div>
    </section>

    <Closing lines={["Carapicuíba.", "Alphaville.", <span style={{ color: "var(--mute)" }} key="o">E o seu WhatsApp.</span>]} secondary={["Falar com a gente", "/contact"]} />
  </>
);

export default AboutUs;
