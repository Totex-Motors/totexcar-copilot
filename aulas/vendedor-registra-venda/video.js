// Linha do tempo do VÍDEO: em cada cena, o que aparece e QUANDO (âncora = trecho da fala em cenas.js;
// o instante vem do áudio gravado, alinhado palavra a palavra com a transcrição local).
// quadro: captura (capturas/*.png) ou "ilu:<nome>:<estado>"; marcas: [elemento, tipo] (acumulam no mesmo quadro).
module.exports = {
  S1: [{ ancora: null, quadro: "ilu:problema:0" }, { ancora: "a sua palavra contra a dele", quadro: "ilu:problema:1" }],
  S2: [
    { ancora: null, quadro: "ilu:caminho:0" },
    { ancora: "registra a venda no seu link", quadro: "ilu:caminho:1" },
    { ancora: "cola a etiqueta", quadro: "ilu:caminho:2" },
    { ancora: "manda a foto do painel", quadro: "ilu:caminho:3" },
    { ancora: "toca em tudo certo", quadro: "ilu:caminho:4" },
    { ancora: "no fim fica a prova", quadro: "ilu:caminho:5" },
  ],
  S3: [
    { ancora: null, quadro: "v01-lista" },
    { ancora: "revisado pode vender", marcas: [["revisado", "sublinhado"]] },
    { ancora: "sem revisao registrada", marcas: [["semrev", "sublinhado"]] },
    { ancora: "na oficina o carro", marcas: [["naoficina", "sublinhado"]] },
  ],
  S4: [
    { ancora: null, quadro: "v02-busca-placa" },
    { ancora: "digite a placa na busca", marcas: [["busca", "circulo"]] },
    { ancora: "confira no carro", marcas: [["placa", "circulo"]] },
  ],
  S5: [
    { ancora: null, quadro: "v03-carro-escolhido" },
    { ancora: "ele fica no topo", marcas: [["placa", "circulo"]] },
    { ancora: "revisado em 06 de novembro", marcas: [["revisado", "sublinhado"]] },
  ],
  S6: [
    { ancora: null, quadro: "v04-cpf-invalido" },
    { ancora: "o cpf e obrigatorio", marcas: [["cpf", "circulo"]] },
    { ancora: "avisa em vermelho", marcas: [["aviso", "sublinhado"]] },
  ],
  S7: [
    { ancora: null, quadro: "v05-cliente-entrega" },
    { ancora: "o numero da etiqueta", marcas: [["etiqueta", "circulo"]] },
    { ancora: "a placa ja vem preenchida", marcas: [["placa", "circulo"]] },
    { ancora: "o km do painel agora", marcas: [["km", "circulo"]] },
    { ancora: "toque em registrar venda", marcas: [["registrar", "circulo"]] },
  ],
  S8: [
    { ancora: null, quadro: "v06-venda-registrada" },
    { ancora: "o cliente ja recebeu", marcas: [["boasvindas", "sublinhado"]] },
    { ancora: "a etiqueta ficou ligada", marcas: [["etiqueta", "sublinhado"]] },
    { ancora: "e a troca de oleo foi", marcas: [["revisao", "sublinhado"]] },
  ],
  S9: [
    { ancora: null, quadro: "e01" },
    { ancora: "confira se o numero", marcas: [["numero", "circulo"]] },
  ],
  S10: [
    { ancora: null, quadro: "w01", marcas: [["pedido", "circulo"]] },
    { ancora: "manda a foto do painel", quadro: "w02", marcas: [["foto", "circulo"]] },
    { ancora: "conferem os sete itens", marcas: [["lista", "circulo"]] },
    { ancora: "toca em tudo certo", marcas: [["botao", "circulo"]] },
  ],
  S11: [
    { ancora: null, quadro: "w03", marcas: [["ok", "circulo"]] },
    { ancora: "no seu link", quadro: "v08-ativou", marcas: [["status", "circulo"]] },
  ],
  S12: [
    { ancora: null, quadro: "ilu:pratica:0" },
    { ancora: "antes avise o lucas", quadro: "ilu:pratica:1" },
    { ancora: "e nao com tem problema", quadro: "ilu:pratica:2" },
  ],
};
