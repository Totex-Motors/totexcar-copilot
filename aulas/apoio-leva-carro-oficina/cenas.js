// Fonte única da aula "Como levar o carro pra oficina e trazer de volta" (apoio de manutenção: Léo e Jorginho).
// tela: captura real do link da oficina (/oficina/:token, dados de demonstração) ou ilustração.
// marcas: [quadro, elemento, tipo]; caixas vêm de caixas.json.
module.exports = {
  titulo: "Como levar o carro pra oficina e trazer de volta",
  subtitulo: "Link da oficina · apoio de manutenção · TotexCar Co-pilot · Cardoso Veículos",
  aluno: "Léo e Jorginho, que apoiam o Lucas (gerente de manutenção) e levam os carros do estoque pras oficinas parceiras. Usam o celular e o WhatsApp; não precisam saber nada de sistema.",
  situacao: "Um carro do estoque precisa trocar o óleo antes de ser vendido. Eles levam o carro até a oficina e depois trazem de volta.",
  objetivo: "Ao terminar, o aluno manda o carro pela tela certa (oficina, carro conferido pela placa, km e foto do painel na saída), acompanha até ficar pronto e registra a volta com o km, conferindo a linha do tempo completa.",
  exemplo: "OS #14 · Chevrolet Onix 2022 prata, placa ABC1D23 (fictícia) · sai da loja com 48.200 km pra Pires Transmissão · a oficina registra a troca com 48.212 · volta pra loja com 48.215. É o mesmo Onix das aulas da oficina e dos vendedores.",
  destino: "Celular, enviado pelo WhatsApp junto com o link pessoal. Vídeo vertical 1080×1920, 30 fps.",
  visual: "Tela real do link da oficina (azul da loja) + marcações à mão em laranja #FF8500; ilustrações em fundo branco.",
  ilustracoes: {
    problema: `<div class="ilu"><div class="ficha"><b>Onix 2022 prata · ABC1D23</b><div class="lin">Saiu pra oficina: <span class="vazio">?</span></div><div class="lin">Km na saída: <span class="vazio">?</span></div><div class="lin">Trocaram o óleo? <span class="vazio">?</span></div><div class="lin">Km na volta: <span class="vazio">+40 km</span></div><div class="grande">?</div></div>
      <div class="balao">“Esse carro rodou 40 km a mais. Foi direto pra oficina? O óleo foi trocado?”</div><div class="tag">ilustração</div></div>`,
    os: `<div class="ilu"><div class="ficha ok"><b>OS #14 · ordem de serviço</b><div class="lin">✅ Saiu da loja · 48.200 km · Léo</div><div class="lin">✅ Chegou na oficina · 48.210 km</div><div class="lin">✅ Serviço registrado · 48.212 km</div><div class="lin">✅ Voltou pra loja · 48.215 km · Léo</div></div><div class="seta">➜</div><div class="balao verde">Cada passo com <b>dia, hora, km e nome</b>.<br>O seu trabalho fica registrado.</div><div class="tag">ilustração</div></div>`,
    pratica: `<div class="ilu"><div class="ficha"><b>HB20 2021 branco · BRA2E19 → LTL</b><div class="lin">Painel na saída: 30.110</div><div class="lin">Troca registrada pela oficina: 30.112</div><div class="lin">Painel na volta: 30.180</div>
      <div class="pergunta">1. O que você confere antes de sair da loja?<br>2. O que chama a atenção na volta?</div></div><div class="tag">ilustração</div></div>`,
  },
  cenas: [
    {
      id: "S1", nome: "O problema", tela: "ilustracao:problema",
      fala: "O Onix saiu da loja pra oficina e ninguém anotou nada. Na volta, ele rodou 40 quilômetros a mais. Foi direto pra oficina? Trocaram o óleo? Que dia? Sem registro, ninguém consegue responder. E quem levou o carro fica sem como mostrar que fez tudo certo.",
      mostra: "Ficha do Onix com os campos em branco e “+40 km” na volta. Balão com as perguntas. Ponto de interrogação laranja.",
      eventos: [["“ninguém consegue responder”", "o ? laranja aparece na ficha"]],
    },
    {
      id: "S2", nome: "A ordem de serviço", tela: "ilustracao:os",
      fala: "Pra isso existe a ordem de serviço, a OS. É o pedido da loja pra oficina, com o carro, o serviço e o km. Ela anda em quatro passos: saiu da loja, chegou na oficina, serviço feito, voltou pra loja. Cada passo fica com dia, hora, km e o nome de quem fez. Você faz o primeiro e o último.",
      mostra: "A ficha da OS #14 com os quatro passos marcados um a um; seta até “Cada passo com dia, hora, km e nome”.",
      eventos: [["“saiu da loja”", "1º passo marcado"], ["“voltou pra loja”", "4º passo marcado"], ["“o primeiro e o último”", "círculos no 1º e no 4º passo"]],
    },
    {
      id: "S3", nome: "Seu link", tela: "a01-link",
      marcas: [["a01-link", "mandar", "circulo"]],
      fala: "Abra o seu link da oficina, que o gerente mandou no seu WhatsApp. Ele é só seu: tudo que você fizer sai no seu nome. Pra levar um carro, toque em Mandar carro pra oficina.",
      mostra: "Captura real do link da oficina (Olá, Léo). Contorno no botão “Mandar carro pra oficina”.",
      eventos: [["“Mandar carro pra oficina”", "contorno no botão"]],
    },
    {
      id: "S4", nome: "Escolher a oficina", tela: "a02-oficina",
      marcas: [["a02-oficina", "pires", "circulo"]],
      fala: "Primeiro, pra qual oficina o carro vai. Aqui, a Pires Transmissão. O Lucas te diz qual oficina usar.",
      mostra: "Captura real da janela de envio com a Pires Transmissão escolhida. Contorno na opção.",
      eventos: [["“a Pires Transmissão”", "contorno na Pires"]],
    },
    {
      id: "S5", nome: "Achar o carro pela placa", tela: "a03-busca-placa",
      marcas: [["a03-busca-placa", "busca", "circulo"], ["a03-busca-placa", "placa", "circulo"]],
      fala: "Agora o carro. O jeito mais seguro é pela placa: digite na busca, aqui ABC1D23. Um carro que já está numa oficina aparece apagado e não dá pra escolher.",
      mostra: "Captura real com “abc1d23” na busca e só o Onix na lista. Contorno na busca e círculo na placa.",
      eventos: [["“digite na busca”", "contorno na busca"], ["“aqui ABC1D23”", "círculo na placa"]],
    },
    {
      id: "S6", nome: "Conferir a placa", tela: "a04-carro-placa",
      marcas: [["a04-carro-placa", "cadastro", "sublinhado"], ["a04-carro-placa", "placa", "circulo"]],
      fala: "Tocou no Onix, a placa já vem preenchida. Antes de seguir, olhe a placa do carro na sua frente. Tem que ser a mesma. O serviço de troca de óleo já vem marcado.",
      mostra: "Captura real com o carro escolhido. Sublinhado em “Placa no cadastro” e contorno no campo Placa.",
      eventos: [["“a placa já vem preenchida”", "contorno no campo Placa"], ["“Tem que ser a mesma”", "sublinhado em Placa no cadastro"]],
    },
    {
      id: "S7", nome: "Km e foto na saída", tela: "a05-km-foto-enviar",
      marcas: [["a05-km-foto-enviar", "km", "circulo"], ["a05-km-foto-enviar", "foto", "circulo"], ["a05-km-foto-enviar", "enviar", "circulo"]],
      fala: "Ligue o carro e confira o painel. Digite o km, aqui 48.200, e tire a foto do painel com o km aparecendo. Depois toque em Enviar e avisar a oficina. A oficina recebe o aviso no WhatsApp na hora.",
      mostra: "Captura real com km 48200 e “Foto ok”. Contornos no km, na foto e no botão, um por vez.",
      eventos: [["“aqui 48.200”", "contorno no km"], ["“tire a foto do painel”", "contorno na foto"], ["“Enviar e avisar a oficina”", "contorno no botão"]],
    },
    {
      id: "S8", nome: "A caminho da oficina", tela: "a06-a-caminho",
      marcas: [["a06-a-caminho", "os", "sublinhado"], ["a06-a-caminho", "status", "circulo"]],
      fala: "Pronto. A OS 14 aparece como A caminho da oficina. Agora é levar o carro. O prazo da oficina é de um dia. Se passar, aparece Passou do prazo. E se a oficina pedir algo além do combinado, aparece Extra pra aprovar: chame o Lucas antes de aprovar.",
      mostra: "Captura real da lista com a OS #14. Sublinhado na OS e círculo em “A caminho da oficina”.",
      eventos: [["“A caminho da oficina”", "círculo no status"]],
    },
    {
      id: "S9", nome: "Pronto pra buscar", tela: "a07-pronto",
      marcas: [["a07-pronto", "status", "circulo"], ["a07-pronto", "oleo", "sublinhado"], ["a07-pronto", "voltou", "circulo"]],
      fala: "Quando a oficina registra o serviço, a OS muda pra Pronto pra buscar, com a linha do óleo: 5W30, API SP, Lubrax, 3,5 litros. É a hora de buscar o carro. Chegando na loja, toque em Carro voltou pra loja.",
      mostra: "Captura real com “Pronto p/ buscar”, a linha do óleo e o botão “Carro voltou pra loja”.",
      eventos: [["“Pronto pra buscar”", "círculo no status"], ["“a linha do óleo”", "sublinhado na linha 🛢️"], ["“Carro voltou pra loja”", "contorno no botão"]],
    },
    {
      id: "S10", nome: "Registrar a volta", tela: "a08-volta",
      marcas: [["a08-volta", "km", "circulo"], ["a08-volta", "confirmar", "circulo"]],
      fala: "Digite o km do painel na volta, aqui 48.215, e confirme. Com o km da saída e o da volta, a loja vê quanto o carro rodou no caminho.",
      mostra: "Captura real da janela “Carro voltou pra loja” com 48215. Contornos no km e no Confirmar.",
      eventos: [["“aqui 48.215”", "contorno no km"], ["“e confirme”", "contorno no Confirmar"]],
    },
    {
      id: "S11", nome: "Conferir a linha do tempo", tela: "a09-linha-do-tempo",
      marcas: [["a09-linha-do-tempo", "tempo", "circulo"]],
      fala: "Toque na OS pra ver a linha do tempo. Os quatro passos estão marcados: saiu da loja com 48.200, chegou na oficina, serviço feito com 48.212 e voltou com 48.215. Na saída e na volta, o seu nome.",
      mostra: "Captura real do detalhe da OS #14 com os quatro passos ✅ e o nome Léo. Contorno na linha do tempo.",
      eventos: [["“Os quatro passos estão marcados”", "contorno na linha do tempo"]],
    },
    {
      id: "S12", nome: "Sua vez", tela: "ilustracao:pratica",
      fala: "Sua vez. Você vai levar o HB20 branco, placa BRA2E19, pra LTL. O painel marca 30.110. A oficina registrou a troca com 30.112, e na volta o painel marca 30.180. O que você confere antes de sair da loja? E o que chama a atenção na volta? Pausa. Antes de sair: a oficina, a placa, o km 30.110 e a foto do painel. Na volta: o carro rodou 68 quilômetros depois do serviço. É muito pro caminho. Avise o Lucas.",
      mostra: "Ficha do HB20 (ilustração) com os três km e as duas perguntas. Pausa de 3 s; depois as respostas aparecem embaixo de cada pergunta.",
      eventos: [["“Pausa.”", "3 s parados com as perguntas"], ["“Antes de sair”", "resposta 1 aparece"], ["“Avise o Lucas”", "resposta 2 aparece"]],
    },
  ],
};
