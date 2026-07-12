import { motion } from "framer-motion";
import { CTA } from "../components/CTA";
import { GradientBorder } from "../components/ui/GradientBorder";
import { RollingText } from "../components/ui/RollingText";
import {
  MessageSquare,
  Camera,
  BellRing,
  Gauge,
  BarChart3,
  Car,
  Gift,
  FileText,
  Mic,
} from "lucide-react";
import { Link } from "react-router-dom";

// --- RECURSOS DO APP ---

const integrations = [
  {
    id: "whatsapp-ia",
    name: "Agente de IA no WhatsApp",
    description:
      "Mandou mensagem, foto do cupom ou áudio? O agente de inteligência artificial entende e registra o gasto do carro automaticamente, sem você abrir o app.",
    icon: MessageSquare,
    color:
      "hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]",
    iconColor: "text-[#25D366]",
  },
  {
    id: "foto-cupom",
    name: "Leitura de cupom por foto",
    description:
      "Tire uma foto da nota do posto, da oficina ou da peça. O app lê os dados e lança o valor, a data e a categoria pra você. Chega de digitar.",
    icon: Camera,
    color:
      "hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,184,205,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "audio",
    name: "Registro por áudio",
    description:
      "Sem tempo de digitar? Mande um áudio no WhatsApp dizendo o que gastou e o agente transcreve e organiza o lançamento na hora.",
    icon: Mic,
    color:
      "hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "alertas",
    name: "Alertas de vencimento",
    description:
      "Nunca mais perca o prazo do IPVA, do licenciamento, do seguro ou da CNH. Você recebe o aviso antes do vencimento e evita multa e dor de cabeça.",
    icon: BellRing,
    color:
      "hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,184,205,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "km-manutencao",
    name: "Controle de km e manutenção",
    description:
      "Acompanhe a quilometragem do carro e saiba a hora certa de trocar o óleo, as pastilhas e os pneus. O app lembra você de cada revisão.",
    icon: Gauge,
    color:
      "hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "relatorios",
    name: "Relatórios de gastos",
    description:
      "Veja quanto o seu carro custa por mês com combustível, peças, revisões e impostos. Relatórios claros pra você entender pra onde vai o dinheiro.",
    icon: BarChart3,
    color:
      "hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,184,205,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "fipe-recompra",
    name: "FIPE e recompra",
    description:
      "Consulte o valor do seu carro na tabela FIPE e peça uma proposta de recompra direto pelo app. Saiba quanto vale antes de decidir vender.",
    icon: Car,
    color:
      "hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "indique-ganhe",
    name: "Indique e Ganhe",
    description:
      "Indique carros do marketplace TotexMotors pra amigos e ganhe comissão no PIX a cada venda. Compartilhe o link e acompanhe tudo pelo app.",
    icon: Gift,
    color:
      "hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,184,205,0.1)]",
    iconColor: "text-white",
  },
  {
    id: "dados-veiculo",
    name: "Dados do veículo e CNH",
    description:
      "Guarde os documentos do carro e da sua habilitação em um só lugar. Consulta por placa preenche o cadastro pra você em segundos.",
    icon: FileText,
    color:
      "hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]",
    iconColor: "text-white",
  },
];

// --- VISUAL DO HERO ---

const HeroVisual = () => (
  <div className="relative w-full h-[400px] flex items-center justify-center">
    {/* Background Glow */}
    <div className="absolute w-64 h-64 bg-cyan-600/10 blur-[80px] rounded-full" />

    {/* Orbital Rings */}
    <div className="absolute w-[320px] h-[320px] border border-white/5 rounded-full animate-[spin_60s_linear_infinite]" />
    <div className="absolute w-[220px] h-[220px] border border-white/10 rounded-full animate-[spin_40s_linear_infinite_reverse]" />

    {/* Center Node */}
    <div className="relative z-10 w-24 h-24 rounded-full bg-black border border-white/10 shadow-[0_0_40px_rgba(59,130,246,0.2)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-teal-500/20" />
      <Car size={36} className="relative z-10 text-white" />
    </div>

    {/* Floating Icons */}
    <div className="absolute inset-0 animate-[spin_60s_linear_infinite]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6">
        <div className="w-12 h-12 bg-[#0A0A0A] border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
          <MessageSquare size={20} className="text-[#25D366]" />
        </div>
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6">
        <div className="w-12 h-12 bg-[#0A0A0A] border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
          <BellRing size={20} className="text-cyan-400" />
        </div>
      </div>
      <div className="absolute left-0 top-1/2 -translate-x-6 -translate-y-1/2">
        <div className="w-12 h-12 bg-[#0A0A0A] border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
          <Camera size={20} className="text-teal-400" />
        </div>
      </div>
      <div className="absolute right-0 top-1/2 translate-x-6 -translate-y-1/2">
        <div className="w-12 h-12 bg-[#0A0A0A] border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
          <Gauge size={20} className="text-white" />
        </div>
      </div>
    </div>
  </div>
);

export const Integrations = () => {
  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-teal-600/10 blur-[120px] rounded-full opacity-40" />
        <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-cyan-600/10 blur-[120px] rounded-full opacity-40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 mb-24">
        {/* --- HERO SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-32">
          <div className="flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block border border-white/20 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 mb-8"
            >
              <span className="text-[10px] md:text-xs font-bold tracking-widest text-white uppercase">
                RECURSOS
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-semibold text-white tracking-tight mb-6 leading-[1.1]"
            >
              Tudo que o <br />
              TotexCar Co-pilot <br />
              faz pelo seu carro
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-400 max-w-xl leading-relaxed mb-8"
            >
              Registre gastos pelo WhatsApp com inteligência artificial, receba
              alertas de vencimento e controle a manutenção do seu carro num só
              lugar. Simples, em português e feito pra quem dirige no Brasil.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GradientBorder
                gradient="from-teal-500 via-cyan-500 to-teal-600"
                containerClassName="rounded-full p-[1px]"
              >
                <Link
                  to="/entrar?tab=register"
                  className="px-8 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-900 transition-colors group"
                >
                  <RollingText text="Começar agora" />
                </Link>
              </GradientBorder>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <HeroVisual />
          </motion.div>
        </div>

        {/* --- RECURSOS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className={`bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 group ${item.color}`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <item.icon className={`w-7 h-7 ${item.iconColor}`} />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-3">
                  {item.name}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <CTA />
    </div>
  );
};
