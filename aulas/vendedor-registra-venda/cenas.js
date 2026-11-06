// Fonte única da aula "Como o vendedor registra a venda e faz a entrega": gera roteiro.md, storyboard e
// roteiro de gravação. tela: captura real do link do vendedor (dados de demonstração), simulação do
// WhatsApp do cliente (w*) ou ilustração. marcas: [quadro, elemento, tipo]; caixas vêm de caixas.json.
module.exports = {
  titulo: "Como o vendedor registra a venda e faz a entrega",
  subtitulo: "Link de venda · TotexCar Co-pilot · Cardoso Veículos",
  aluno: "Vendedores da Cardoso. Usam o WhatsApp e o celular o dia todo; não precisam saber nada de sistema.",
  situacao: "Fechou a venda de um carro do estoque. Precisa registrar a venda e entregar o carro com tudo conferido.",
  objetivo: "Ao terminar, o vendedor registra a venda no link (carro certo pela placa, cliente com CPF, etiqueta e km), conduz o checklist de entrega com o cliente e só libera o carro depois do “Tudo certo”.",
  exemplo: "João Pereira compra o Chevrolet Onix 2022 prata, placa ABC1D23 (o mesmo que a oficina revisou na outra aula, com 48.212 km). Etiqueta CV-0016, km na entrega 48.230. Cliente, CPF, placa e etiqueta são fictícios.",
  destino: "Celular, enviado pelo WhatsApp junto com o link de venda. Vídeo vertical 1080×1920, 30 fps.",
  visual: "Tela real do link (azul da loja), simulação do WhatsApp do cliente marcada como SIMULAÇÃO, marcações à mão em laranja #FF8500.",
  ilustracoes: {
    problema: `<div class="ilu"><div class="ficha"><b>Onix 2022 prata · vendido</b><div class="lin">Luz do painel na entrega: <span class="vazio">?</span></div><div class="lin">Km na entrega: <span class="vazio">?</span></div><div class="lin">Assistente do cliente: <span class="vazio">não ativado</span></div><div class="grande">?</div></div>
      <div class="balao">Dois dias depois: “Acendeu uma luz no painel. Já estava assim quando eu peguei?”</div><div class="tag">ilustração</div></div>`,
    caminho: `<div class="ilu"><div class="ficha ok"><b>Venda do Onix registrada</b><div class="lin">📲 Link de venda: carro, cliente, etiqueta, km</div><div class="lin">🏷️ Etiqueta CV-0016 no para-brisa</div><div class="lin">📸 Foto do painel enviada pelo cliente</div><div class="lin">✅ “Tudo certo” do cliente</div></div><div class="seta">➜</div><div class="balao verde">Prova da entrega guardada<br><b>e o assistente do carro ativado</b></div><div class="tag">ilustração</div></div>`,
    pratica: `<div class="ilu"><div class="ficha"><b>HB20 2021 branco · BRA2E19</b><div class="lin">Na lista: <span class="vazio">⚠️ Sem revisão registrada</span></div><div class="lin">Cliente quer levar hoje</div>
      <div class="pergunta">1. O que você faz antes de marcar a entrega?<br>2. Na entrega o cliente tocou em “Tem problema”. O carro pode sair?</div></div><div class="tag">ilustração</div></div>`,
  },
  cenas: [
    {
      id: "S1", nome: "O problema", tela: "ilustracao:problema",
      fala: "Você entregou o Onix e o cliente saiu feliz. Dois dias depois ele liga: acendeu uma luz no painel, já estava assim quando eu peguei? Se ninguém conferiu na entrega, vira a sua palavra contra a dele. E o cliente ficou sem o assistente que ia avisar a troca de óleo.",
      mostra: "Ficha do Onix vendido com os campos em branco e o balão do cliente. Ponto de interrogação laranja.",
      eventos: [["“a sua palavra contra a dele”", "o ? laranja aparece na ficha"]],
    },
    {
      id: "S2", nome: "O caminho da venda", tela: "ilustracao:caminho",
      fala: "O caminho certo tem quatro passos. Você registra a venda no seu link. Cola a etiqueta no para-brisa. O cliente escaneia e manda a foto do painel. E ele mesmo toca em Tudo certo. No fim fica a prova de como o carro saiu, e o assistente do carro já começa a trabalhar pro cliente.",
      mostra: "A ficha com os quatro passos marcados um a um e a seta até “Prova da entrega guardada e o assistente do carro ativado”.",
      eventos: [["“registra a venda no seu link”", "1º passo marcado"], ["“Cola a etiqueta”", "2º passo"], ["“manda a foto do painel”", "3º passo"], ["“toca em Tudo certo”", "4º passo e seta até o resultado"]],
    },
    {
      id: "S3", nome: "Seu link e o estoque", tela: "v01-lista",
      marcas: [["v01-lista", "revisado", "sublinhado"], ["v01-lista", "semrev", "sublinhado"], ["v01-lista", "naoficina", "sublinhado"]],
      fala: "Abra o seu link de venda, que o gerente mandou no seu WhatsApp. Ele é só seu: a venda sai no seu nome. Na lista, olhe a linha de baixo de cada carro. Revisado, pode vender. Sem revisão registrada, avise o Lucas antes. Na oficina, o carro ainda está sendo revisado.",
      mostra: "Captura real do link de venda. Sublinhados aparecem em “Revisado”, “Sem revisão registrada” e “Na oficina Pires…”, um por vez.",
      eventos: [["“Revisado, pode vender”", "sublinhado em Revisado"], ["“avise o Lucas antes”", "sublinhado em Sem revisão"], ["“ainda está sendo revisado”", "sublinhado em Na oficina"]],
    },
    {
      id: "S4", nome: "Achar o carro pela placa", tela: "v02-busca-placa",
      marcas: [["v02-busca-placa", "busca", "circulo"], ["v02-busca-placa", "placa", "circulo"]],
      fala: "O jeito mais seguro de achar o carro é pela placa. Digite a placa na busca, aqui ABC1D23, e confira no carro antes de tocar.",
      mostra: "Captura real com “abc1d23” na busca e só o Onix na lista. Contorno na busca e círculo na placa.",
      eventos: [["“Digite a placa na busca”", "contorno na busca"], ["“confira no carro”", "círculo na placa"]],
    },
    {
      id: "S5", nome: "Carro escolhido", tela: "v03-carro-escolhido",
      marcas: [["v03-carro-escolhido", "revisado", "sublinhado"], ["v03-carro-escolhido", "placa", "circulo"]],
      fala: "Tocou no Onix, ele fica no topo. Repare: revisado em 06 de novembro, com 48.212 quilômetros. É a troca de óleo que a oficina registrou. Ela vai junto pro assistente do cliente.",
      mostra: "Captura real com o carro escolhido. Sublinhado em “Revisado em 06/11/2026 · 48.212 km” e círculo na placa.",
      eventos: [["“revisado em 06 de novembro”", "sublinhado na linha verde"]],
    },
    {
      id: "S6", nome: "Dados do cliente", tela: "v04-cpf-invalido",
      marcas: [["v04-cpf-invalido", "cpf", "circulo"], ["v04-cpf-invalido", "aviso", "sublinhado"]],
      fala: "Agora o cliente: nome completo, WhatsApp com DDD e CPF. O CPF é obrigatório. Se um número estiver errado, o link avisa em vermelho na hora. Confira com o cliente e corrija.",
      mostra: "Captura real: CPF com o último dígito errado e o aviso vermelho “CPF inválido”. Contorno no CPF e sublinhado no aviso.",
      eventos: [["“O CPF é obrigatório”", "contorno no CPF"], ["“avisa em vermelho”", "sublinhado no aviso"]],
    },
    {
      id: "S7", nome: "Dados da entrega", tela: "v05-cliente-entrega",
      marcas: [["v05-cliente-entrega", "etiqueta", "circulo"], ["v05-cliente-entrega", "placa", "circulo"], ["v05-cliente-entrega", "km", "circulo"], ["v05-cliente-entrega", "registrar", "circulo"]],
      fala: "Na entrega, o número da etiqueta que vai no para-brisa, aqui CV-0016. A placa já vem preenchida: confira no carro. E o km do painel agora, 48.230. Tudo certo? Toque em Registrar venda.",
      mostra: "Captura real com cliente e entrega preenchidos. Círculos na etiqueta, na placa, no km e no botão, um por vez.",
      eventos: [["“aqui CV-0016”", "círculo na etiqueta"], ["“confira no carro”", "círculo na placa"], ["“48.230”", "círculo no km"], ["“Registrar venda”", "contorno no botão"]],
    },
    {
      id: "S8", nome: "Venda registrada", tela: "v06-venda-registrada",
      marcas: [["v06-venda-registrada", "boasvindas", "sublinhado"], ["v06-venda-registrada", "etiqueta", "sublinhado"], ["v06-venda-registrada", "revisao", "sublinhado"]],
      fala: "Venda registrada. Leia as três linhas. O cliente já recebeu as boas-vindas no WhatsApp. A etiqueta ficou ligada a ele. E a troca de óleo foi pro assistente dele. Se aparecer um aviso amarelo ou vermelho, resolva antes da entrega: etiqueta errada, confira o número; carro sem revisão, avise o Lucas.",
      mostra: "Captura real da confirmação. Sublinhados nas três linhas, uma por vez.",
      eventos: [["“boas-vindas no WhatsApp”", "sublinhado na 1ª linha"], ["“A etiqueta ficou ligada”", "sublinhado na 2ª"], ["“foi pro assistente dele”", "sublinhado na 3ª"]],
    },
    {
      id: "S9", nome: "A etiqueta", tela: "e01",
      fala: "Cole a etiqueta no para-brisa, por dentro, no canto de cima, com o vidro limpo. Confira se o número é o mesmo do cadastro. Peça pro cliente: aponta a câmera aqui.",
      mostra: "Ilustração da etiqueta CV-0016 no para-brisa com a frase “Aponta a câmera aqui”.",
      eventos: [["“o mesmo do cadastro”", "círculo no número CV-0016"]],
    },
    {
      id: "S10", nome: "O checklist com o cliente", tela: "w02",
      fala: "O WhatsApp do cliente abre com o assistente. Ele liga o carro e manda a foto do painel, com o km e sem luz de alerta. Depois vocês dois conferem os sete itens da lista: bateria, painel, pneus e estepe, luzes, ar e limpador, lataria e as chaves e o manual. Tudo ok? Ele toca em Tudo certo.",
      mostra: "Simulação do WhatsApp do cliente (textos reais do Co-pilot): foto do painel com 48.230 km, a lista de itens e o botão “Tudo certo” destacado.",
      eventos: [["“manda a foto do painel”", "destaque na foto"], ["“os sete itens”", "destaque na lista"], ["“toca em Tudo certo”", "destaque no botão"]],
    },
    {
      id: "S11", nome: "Só agora o carro sai", tela: "w03",
      fala: "Pronto: entrega registrada, com data, hora e km. O grupo da loja recebe entrega conferida, com o seu nome. Só agora o carro sai. No seu link, a venda do João passa de Falta escanear pra Ativou.",
      mostra: "Simulação da mensagem “Entrega registrada”; depois corta pra captura real de “Minhas últimas vendas” com o selo “Ativou”.",
      eventos: [["“entrega registrada”", "destaque na mensagem"], ["“passa de Falta escanear pra Ativou”", "troca pra captura v08 com círculo em Ativou"]],
    },
    {
      id: "S12", nome: "Sua vez", tela: "ilustracao:pratica",
      fala: "Sua vez. O cliente quer levar hoje o HB20 branco, placa BRA2E19. Na lista ele aparece sem revisão registrada. O que você faz antes de marcar a entrega? E se na entrega o cliente tocar em Tem problema, o carro pode sair? Pausa. Antes, avise o Lucas pra revisar o carro na oficina. E não: com Tem problema, vocês resolvem primeiro. O carro só sai com o Tudo certo.",
      mostra: "Ficha do HB20 (ilustração) com as duas perguntas. Pausa de 3 s; depois a resposta aparece embaixo de cada pergunta.",
      eventos: [["“Pausa.”", "3 s parados com as perguntas"], ["“avise o Lucas”", "resposta 1 aparece"], ["“só sai com o Tudo certo”", "resposta 2 aparece"]],
    },
  ],
};
