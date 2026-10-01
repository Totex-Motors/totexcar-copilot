import { Item, PageHead, Closing } from "../editorial";

// POLÍTICA DE PRIVACIDADE — mesmo conteúdo, em lista editorial numerada.

const SECOES: [string, string][] = [
  ["Quem somos", "O TotexCar Co‑pilot é um assistente de cuidado do carro oferecido pela TotexMotors. Esta política explica, de forma clara e em conformidade com a Lei Geral de Proteção de Dados (LGPD), como tratamos as suas informações quando você usa o Co‑pilot e os serviços relacionados."],
  ["Dados que coletamos", "Para oferecer o serviço, podemos coletar dados que você informa, como nome, e-mail, telefone, número do WhatsApp e dados do seu veículo e da sua CNH. Também tratamos os documentos e gastos que você registra (CRLV, apólice, notas de manutenção, combustível, seguro, IPVA, licenciamento, multas e pneus), inclusive quando enviados por texto, foto, PDF ou áudio ao nosso assistente de inteligência artificial. Registramos ainda informações de uso para melhorar a sua experiência."],
  ["Como usamos seus dados", "Usamos suas informações para guardar e organizar o histórico do seu carro, enviar alertas de vencimento (IPVA, seguro, licenciamento, CNH), acompanhar quilometragem e manutenção, gerar relatórios, consultar a tabela FIPE e operar recursos como recompra, Radar de Serviços e Indique e Ganhe. Não vendemos seus dados pessoais. Compartilhamos informações apenas com parceiros necessários para a prestação do serviço e quando exigido por lei."],
  ["Seus direitos (LGPD)", "Você pode, a qualquer momento, solicitar acesso aos seus dados, corrigir informações incorretas, pedir a exclusão da conta e dos dados, ou revogar consentimentos. Também pode gerenciar os alertas e mensagens que recebe pelo WhatsApp. Adotamos medidas de segurança, como criptografia e servidores protegidos. Nenhum sistema é totalmente imune a riscos, mas trabalhamos continuamente para minimizá-los."],
  ["Fale com a gente", "Se tiver dúvidas sobre esta política ou quiser exercer seus direitos sobre os dados, fale com a TotexMotors pelo e-mail contato@totexmotors.com. Transparência faz parte do nosso trabalho e respondemos o mais rápido possível."],
];

export const PrivacyPolicy = () => (
  <>
    <PageHead label="política de privacidade · atualizada em 15 de novembro de 2024" lines={["Seus dados,", <span className="acc" key="c">suas regras.</span>]}>
      Como a TotexMotors trata as informações que você confia ao Co‑pilot, em conformidade com a LGPD.
    </PageHead>
    <section style={{ paddingBottom: 60 }}>
      <div className="wrap">
        {SECOES.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.06}>{d}</Item>)}
        <div className="hair star" />
      </div>
    </section>
    <Closing lines={["Dúvida sobre", "os seus dados?", <span style={{ color: "var(--mute)" }} key="o">Fala com a gente.</span>]} secondary={["Contato", "/contact"]} />
  </>
);

export default PrivacyPolicy;
