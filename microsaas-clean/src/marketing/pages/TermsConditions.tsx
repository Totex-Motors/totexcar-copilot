import { Item, PageHead, Closing } from "../editorial";

// TERMOS E CONDIÇÕES — mesmo conteúdo, em lista editorial numerada.

const SECOES: [string, string][] = [
  ["Sobre estes Termos", "Ao criar uma conta e usar o TotexCar Co‑pilot, assistente oferecido pela TotexMotors, você concorda com estes Termos e Condições. Leia com atenção antes de usar. Se você não concordar com algum ponto, basta não utilizar o serviço."],
  ["Como usar o Co‑pilot", "O Co‑pilot ajuda você a guardar documentos, controlar gastos, receber alertas de vencimento e acompanhar a manutenção do seu carro. Você se compromete a fornecer informações verdadeiras, manter seus dados de acesso em sigilo e usar o serviço apenas para fins próprios e legais. Os registros, relatórios e sugestões são ferramentas de organização e não substituem orientação profissional, jurídica ou contábil."],
  ["Responsabilidades e limitações", "Trabalhamos para manter o serviço disponível e as informações corretas, mas ele é oferecido no estado em que se encontra. Dados como tabela FIPE, valores de recompra e consultas por placa dependem de fontes externas e podem mudar. A TotexMotors não se responsabiliza por multas, prazos perdidos ou decisões tomadas com base nas informações do Co‑pilot. Você é responsável por conferir prazos e valores oficiais."],
  ["Pagamentos, alterações e cancelamento", "O Co‑pilot é gratuito. Serviços avulsos são pagos por uso, com o valor informado antes da confirmação. Podemos atualizar estes Termos a qualquer momento, e o uso contínuo significa que você aceita as alterações. Você pode cancelar a sua conta quando quiser, conforme a Política de Privacidade."],
  ["Fale com a gente", "Em caso de dúvidas sobre estes Termos, entre em contato com a TotexMotors pelo e-mail contato@totexmotors.com. Respondemos o mais rápido possível."],
];

export const TermsConditions = () => (
  <>
    <PageHead label="termos e condições · atualizados em 15 de novembro de 2024" lines={["O combinado", <span className="acc" key="c">não sai caro.</span>]}>
      As regras de uso do Co‑pilot, em português claro.
    </PageHead>
    <section style={{ paddingBottom: 60 }}>
      <div className="wrap">
        {SECOES.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.06}>{d}</Item>)}
        <div className="hair star" />
      </div>
    </section>
    <Closing lines={["Dúvida sobre", "os termos?", <span style={{ color: "var(--mute)" }} key="o">Fala com a gente.</span>]} secondary={["Contato", "/contact"]} />
  </>
);

export default TermsConditions;
