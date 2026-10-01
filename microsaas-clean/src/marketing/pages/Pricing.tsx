import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fade, Lines, Label, Item, Faq, Closing } from "../editorial";

// GRÁTIS — tudo do app sem mensalidade; serviços avulsos só quando pedir (valor aparece antes de confirmar).

const INCLUIDO: [string, string][] = [
  ["Cofre de documentos", "CRLV, apólice, notas da oficina, comprovantes de IPVA e multas guardados no histórico do carro — e devolvidos no WhatsApp quando você pedir."],
  ["Assistente no WhatsApp", "Manda foto, PDF, áudio ou texto. Ele entende, registra na categoria certa e organiza."],
  ["Avisos de vencimento", "IPVA, licenciamento, seguro, CNH e revisão por quilometragem, antes de virar multa."],
  ["Manutenção por km", "Óleo, pastilhas, pneus e revisões com a próxima data prevista pelo seu uso."],
  ["Gastos e consumo", "Combustível, peças, serviços: quanto o carro custa por mês e por quilômetro."],
  ["Curadoria pra decidir", "Esse orçamento está caro? Vale consertar ou trocar? O Co‑pilot responde com os seus dados."],
  ["Valor do carro e Garagem", "FIPE na hora, pedido de recompra e o estoque real da Totex quando pensar em trocar."],
  ["Indique e Ganhe", "Comissão no PIX a cada venda que vier da sua indicação."],
];

const AVULSOS: [string, string][] = [
  ["Raio-X do carro", "Consulta cautelar completa: leilão, sinistro, roubo, gravame e histórico."],
  ["CRLV-e na hora", "O documento digital emitido dentro do app e guardado no cofre."],
  ["Débitos & multas", "IPVA, licenciamento e multas detalhadas por órgão."],
  ["Consulta de CNH", "Pontos, situação e validade da habilitação."],
];

export const Pricing = () => (
  <>
    <section className="top" style={{ paddingBottom: 60, textAlign: "center" }}>
      <div className="wrap">
        <motion.div className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>(grátis)</motion.div>
        <div className="disp big" style={{ fontSize: "clamp(96px,20vw,300px)", margin: "20px 0 36px", lineHeight: 1.04 }}>
          <Lines now delay={0.25} lines={[<>R$ <span className="acc">0</span></>]} />
        </div>
        <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 640, margin: "0 auto 40px" }}>
          Todo o Co‑pilot, pra sempre, sem mensalidade e sem cartão. Dono de carro ou motorista de app. Você só paga por um serviço oficial quando pedir — e o valor aparece antes de confirmar.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.9 }}>
          <Link to="/entrar?tab=register" className="pill"><span className="dot" />Criar meu Co‑pilot</Link>
        </motion.div>
      </div>
    </section>

    <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="wrap">
        <Label>tudo incluído</Label>
        <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 70px", maxWidth: 1000 }}>
          <Lines lines={["Sem plano.", "Sem pegadinha."]} />
        </h2>
        {INCLUIDO.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.07}>{d}</Item>)}
        <div className="hair star" />
      </div>
    </section>

    <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="wrap">
        <Label>serviços avulsos</Label>
        <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 20px", maxWidth: 1000 }}>
          <Lines lines={["Só quando", "você pedir."]} />
        </h2>
        <motion.p className="serif" {...fade} style={{ fontSize: "clamp(18px,1.6vw,22px)", textAlign: "center", maxWidth: 620, margin: "0 auto 70px", color: "var(--mute)" }}>
          Consultas oficiais pagas por uso, no Pix ou cartão, direto no app. Sem assinatura. Laudos e vistorias são feitos por parceiros credenciados.
        </motion.p>
        {AVULSOS.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={i * 0.07}>{d}</Item>)}
        <div className="hair star" />
      </div>
    </section>

    <Faq />
    <Closing lines={["Cuidar do carro", "agora é de graça.", <span style={{ color: "var(--mute)" }} key="o">Comece hoje.</span>]} />
  </>
);

export default Pricing;
