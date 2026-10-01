import { Item, PageHead, Closing, Label, Lines, Photo } from "../editorial";

// RECURSOS — o que o Co‑pilot faz hoje, em lista editorial. Nada que não exista no produto.

const RECURSOS: [string, string][] = [
  ["Cofre de documentos", "CRLV, apólice, notas da oficina, comprovantes de IPVA e multas guardados no histórico do carro. Pediu \"meu CRLV\" no WhatsApp, recebeu na hora."],
  ["Assistente no WhatsApp", "Foto da nota, PDF, áudio ou texto: o Co‑pilot entende, registra na categoria certa e guarda. Sem app pra baixar."],
  ["Avisos de vencimento", "IPVA, licenciamento, seguro, CNH e revisão por quilometragem. O aviso chega antes do prazo, não depois da multa."],
  ["Manutenção por km", "Óleo, pastilhas, pneus e revisões com a próxima data prevista pelo seu uso real."],
  ["Gastos e consumo", "Quanto o carro custa por mês e por quilômetro, com o consumo calculado pela foto do painel."],
  ["Recurso de multa", "Chegou uma multa? Manda a foto. O Co‑pilot monta o recurso e acompanha os pontos da CNH."],
  ["Curadoria pra decidir", "Esse orçamento está caro? Vale consertar ou trocar? Vender agora ou esperar? Resposta com os seus dados."],
  ["Radar de serviços", "Oficina, pneu, guincho, lavagem perto de você — parceiros com benefício aparecem primeiro."],
  ["Modo Viagem", "Rota, custo previsto e paradas do seu carro antes de pegar a estrada."],
  ["Valor do carro e Garagem Totex", "FIPE na hora, pedido de recompra e o estoque real quando começar a pensar em trocar."],
  ["Indique e Ganhe", "Comissão no PIX a cada venda que vier da sua indicação."],
];

export const Integrations = () => (
  <>
    <PageHead label="recursos" lines={["Tudo que o", "Co‑pilot faz", <span className="acc" key="c">pelo seu carro.</span>]}>
      Em português, pelo WhatsApp, feito pra quem dirige no Brasil. Documentos, manutenção, vencimentos e as decisões que o carro pede — tudo num lugar só.
    </PageHead>

    <section style={{ paddingBottom: 40 }}>
      <div className="wrap photos">
        <Photo src="/alertas.jpg" cap="Documentos e avisos no lugar" col="span 7" ratio="16/10" n="01" />
        <Photo src="/whatsapp-woman.jpg" cap="Tudo pelo WhatsApp" col="span 5" ratio="4/5" n="02" />
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <Label>o que ele faz</Label>
        <h2 className="disp" style={{ fontSize: "clamp(34px,5vw,80px)", textAlign: "center", margin: "26px auto 70px", maxWidth: 1000 }}>
          <Lines lines={["Guarda. Avisa.", "Ajuda a decidir."]} />
        </h2>
        {RECURSOS.map(([t, d], i) => <Item key={t} n={i + 1} title={t} star={i % 2 === 1} delay={(i % 3) * 0.07}>{d}</Item>)}
        <div className="hair star" />
      </div>
    </section>

    <Closing lines={["Tudo isso", "sem mensalidade.", <span style={{ color: "var(--mute)" }} key="o">Comece pelo WhatsApp.</span>]} />
  </>
);

export default Integrations;
