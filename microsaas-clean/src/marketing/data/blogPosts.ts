export interface BlogPost {
  id: string;
  title: string;
  excerpt?: string;
  category: string;
  date: string;
  image: string;
  featured?: boolean;
  content?: string; // Conteúdo HTML do post completo
}

const economiaContent = `
  <p class="mb-6 text-gray-300 text-lg leading-relaxed">
    Manter o carro em dia não precisa pesar no bolso. Com alguns hábitos simples e o acompanhamento certo dos gastos, dá pra economizar todo mês sem abrir mão da segurança e do conforto. O segredo está em saber pra onde o seu dinheiro está indo e antecipar os custos antes que eles virem dor de cabeça.
  </p>
  <ul class="list-disc pl-5 space-y-4 mb-12 text-gray-300 text-lg leading-relaxed marker:text-gray-500">
    <li><strong class="text-white">Registre tudo:</strong> "Anote cada abastecimento, peça e revisão pra enxergar o custo real do carro."</li>
    <li><strong class="text-white">Compare preços:</strong> "Pesquise postos e oficinas antes de gastar; pequenas diferenças somam no fim do mês."</li>
    <li><strong class="text-white">Não deixe vencer:</strong> "Pagar IPVA, seguro e licenciamento em dia evita multa, juros e perrengue."</li>
  </ul>

  <h2 class="text-3xl md:text-4xl font-semibold text-white mb-6">Por onde começar</h2>
  <p class="mb-6 text-gray-300 text-lg leading-relaxed">
    O TotexCar Co-pilot facilita esse controle: você manda uma foto do cupom, um áudio ou uma mensagem no WhatsApp e o agente de inteligência artificial registra o gasto pra você. Com o histórico organizado, fica fácil enxergar onde dá pra cortar.
  </p>
  <ul class="list-disc pl-5 space-y-4 mb-8 text-gray-300 text-lg leading-relaxed marker:text-gray-500">
    <li><strong class="text-white">Acompanhe a quilometragem:</strong> "Saiba a hora certa de trocar o óleo, os pneus e fazer a revisão."</li>
    <li><strong class="text-white">Ative os alertas:</strong> "Receba avisos de vencimento de IPVA, CNH, seguro e licenciamento."</li>
    <li><strong class="text-white">Olhe os relatórios:</strong> "Veja quanto o carro custa por mês e planeje os próximos gastos."</li>
  </ul>
  <p class="text-gray-300 text-lg leading-relaxed">
    Com o gasto sob controle, você dirige mais tranquilo e ainda guarda dinheiro no fim do mês. Comece a registrar os gastos do seu carro hoje mesmo e veja a diferença.
  </p>
`;

const manutencaoContent = `
  <p class="mb-6 text-gray-300 text-lg leading-relaxed">
    Cuidar da manutenção na hora certa é o que mantém o carro rodando bem e evita gastos grandes lá na frente. Muita gente só lembra da revisão quando o problema já apareceu, e aí o conserto sai bem mais caro. Acompanhar a quilometragem e os prazos faz toda a diferença.
  </p>
  <ul class="list-disc pl-5 space-y-4 mb-12 text-gray-300 text-lg leading-relaxed marker:text-gray-500">
    <li><strong class="text-white">Troca de óleo:</strong> "Siga o intervalo de quilometragem indicado pelo fabricante e não deixe passar."</li>
    <li><strong class="text-white">Pneus e freios:</strong> "Cheque o desgaste com frequência; segurança não tem preço."</li>
    <li><strong class="text-white">Documentos em dia:</strong> "IPVA, licenciamento, seguro e CNH precisam estar sempre regularizados."</li>
  </ul>

  <h2 class="text-3xl md:text-4xl font-semibold text-white mb-6">Deixe o app lembrar por você</h2>
  <p class="mb-6 text-gray-300 text-lg leading-relaxed">
    No TotexCar Co-pilot você cadastra a quilometragem do carro e recebe avisos quando chega a hora de cada revisão. Os alertas de vencimento garantem que nenhum prazo importante passe batido, e tudo fica registrado de forma simples.
  </p>
  <ul class="list-disc pl-5 space-y-4 mb-8 text-gray-300 text-lg leading-relaxed marker:text-gray-500">
    <li><strong class="text-white">Histórico completo:</strong> "Toda revisão e troca de peça fica salva pra consulta."</li>
    <li><strong class="text-white">Consulta FIPE:</strong> "Saiba quanto o carro vale e acompanhe a valorização."</li>
    <li><strong class="text-white">Tudo pelo WhatsApp:</strong> "Registre gastos e tire dúvidas conversando com o agente de IA."</li>
  </ul>
  <p class="text-gray-300 text-lg leading-relaxed">
    Manutenção em dia é carro mais seguro, mais econômico e que vale mais na hora de vender. Organize tudo num só lugar e dirija sem preocupação.
  </p>
`;

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "Como economizar combustível no dia a dia",
    excerpt:
      "Dicas práticas pra rodar mais gastando menos: calibragem dos pneus, direção econômica e como acompanhar o consumo do seu carro mês a mês.",
    category: "FEATURED",
    date: "20 MAR, 2026",
    image:
      "https://images.unsplash.com/photo-1545262810-77515befe149?q=80&w=2069&auto=compress&fit=crop",
    featured: true,
    content: economiaContent,
  },
  {
    id: "2",
    title: "Não perca o prazo do IPVA e do licenciamento",
    excerpt:
      "Entenda os prazos, evite multas e juros e descubra como receber alertas de vencimento direto no celular.",
    category: "DOCUMENTOS",
    date: "13 MAR, 2026",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=2070&auto=compress&fit=crop",
    content: manutencaoContent,
  },
  {
    id: "3",
    title: "Quando trocar o óleo pela quilometragem",
    excerpt:
      "Saiba o intervalo certo de troca pra cada tipo de óleo e por que seguir a quilometragem protege o motor e o seu bolso.",
    category: "MANUTENÇÃO",
    date: "16 FEV, 2026",
    image:
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=2070&auto=compress&fit=crop",
    content: manutencaoContent,
  },
  {
    id: "4",
    title: "Vale a pena vender o carro pela FIPE?",
    excerpt:
      "Como funciona a tabela FIPE, o que muda o valor do seu carro e quando a recompra pode ser um bom negócio.",
    category: "FIPE",
    date: "16 FEV, 2026",
    image:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2070&auto=compress&fit=crop",
    content: economiaContent,
  },
  {
    id: "5",
    title: "Registre seus gastos pelo WhatsApp com IA",
    excerpt:
      "Mande foto do cupom, áudio ou mensagem e deixe o agente de inteligência artificial lançar o gasto do carro pra você.",
    category: "APP",
    date: "16 FEV, 2026",
    image:
      "https://images.unsplash.com/photo-1611746872915-64382b5c76da?q=80&w=1470&auto=compress&fit=crop",
    content: economiaContent,
  },
  {
    id: "6",
    title: "Checklist de manutenção pra carro novo e usado",
    excerpt:
      "Pneus, freios, óleo e revisões: o que conferir e com que frequência pra manter o carro seguro e econômico.",
    category: "MANUTENÇÃO",
    date: "16 FEV, 2026",
    image:
      "https://images.unsplash.com/photo-1632823469850-1b7b1e8b7e1e?q=80&w=2015&auto=compress&fit=crop",
    content: manutencaoContent,
  },
  {
    id: "7",
    title: "Indique e Ganhe: comissão no PIX a cada venda",
    excerpt:
      "Indique carros do marketplace TotexMotors pra amigos, compartilhe seu link e receba comissão no PIX quando a venda acontece.",
    category: "APP",
    date: "16 FEV, 2026",
    image:
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=2070&auto=compress&fit=crop",
    content: economiaContent,
  },
];
