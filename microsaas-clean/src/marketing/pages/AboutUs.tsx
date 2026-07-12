import { motion } from "framer-motion";
import {
  Linkedin,
  TrendingUp,
  Box,
  Hexagon,
  Layers,
  Command,
  Cpu,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "../lib/utils";
import { CTA } from "../components/CTA";
import { RollingText } from "../components/ui/RollingText";

// --- ASSETS & DATA ---

const stats = [
  { value: "1 app", label: "Para todos os gastos do seu carro" },
  { value: "WhatsApp", label: "Registre gastos por texto, foto ou áudio" },
  { value: "0 vencimento", label: "Nunca mais perca IPVA, seguro ou CNH" },
];

const values = [
  {
    title: "Nossa missão",
    description:
      "Ajudar o dono de carro comum a controlar todos os gastos do veículo em um só lugar e nunca mais perder um vencimento de IPVA, seguro ou CNH.",
    shape: "circle",
  },
  {
    title: "Simples de usar",
    description:
      "Você só manda uma mensagem no WhatsApp — texto, foto do cupom ou áudio — e a nossa IA registra o gasto pra você. Sem planilha, sem complicação.",
    shape: "triangle",
  },
  {
    title: "Nossa visão",
    description:
      "Construir um ecossistema TotexMotors que cuida do seu carro de ponta a ponta: do controle de gastos à avaliação FIPE e à recompra do veículo.",
    shape: "square",
  },
];

const timeline = [
  {
    year: "A TotexMotors",
    description:
      "Nasceu no dia a dia de quem vive de carro: lojistas, donos e apaixonados por automóveis. A gente conhece de perto a dor de não saber pra onde vai o dinheiro do veículo.",
    image:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2070&auto=compress&fit=crop",
    align: "right",
  },
  {
    year: "A ideia",
    description:
      "Combustível, peças, revisões, seguro, IPVA, licenciamento, multas, pneus... Criamos a TotexCar Co-pilot para reunir tudo isso em um app simples, com um agente de IA no WhatsApp pra registrar cada gasto.",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=compress&fit=crop",
    align: "left",
  },
  {
    year: "Hoje",
    description:
      "Além do controle de gastos, alertas de vencimento, controle de km e manutenção, avaliação FIPE, recompra e o Indique e Ganhe — tudo dentro do ecossistema TotexMotors.",
    image:
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2070&auto=compress&fit=crop",
    align: "right",
  },
];

const team = [
  {
    name: "Time TotexMotors",
    role: "Fundadores",
    image:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1000&auto=compress&fit=crop",
  },
  {
    name: "Produto",
    role: "Experiência do usuário",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=compress&fit=crop",
  },
  {
    name: "Tecnologia",
    role: "Engenharia e IA",
    image:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=1000&auto=compress&fit=crop",
  },
  {
    name: "Atendimento",
    role: "Suporte ao cliente",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=1000&auto=compress&fit=crop",
  },
  {
    name: "Parcerias",
    role: "Relacionamento com lojistas",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=compress&fit=crop",
  },
  {
    name: "Marketing",
    role: "Crescimento",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1000&auto=compress&fit=crop",
  },
];

const jobs = [
  {
    title: "Pessoa Desenvolvedora (Produto)",
    type: "Tempo integral",
    location: "Remoto (Brasil)",
  },
  {
    title: "Pessoa de Suporte ao Cliente",
    type: "Tempo integral",
    location: "Remoto (Brasil)",
  },
  {
    title: "Pessoa de Parcerias com Lojistas",
    type: "Tempo integral",
    location: "Remoto (Brasil)",
  },
  {
    title: "Pessoa de Marketing e Crescimento",
    type: "Tempo integral",
    location: "Remoto (Brasil)",
  },
];

const cultureImages = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=compress&fit=crop",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2070&auto=compress&fit=crop",
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=compress&fit=crop",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2070&auto=compress&fit=crop",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2070&auto=compress&fit=crop",
];

// --- SUB-COMPONENTS ---

const SectionBadge = ({ text }: { text: string }) => (
  <div className="flex justify-center mb-6">
    <div className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5">
      <span className="text-[10px] md:text-xs font-bold tracking-widest text-white uppercase">
        {text}
      </span>
    </div>
  </div>
);

const GlowingShape = ({ type }: { type: string }) => {
  return (
    <div className="relative w-full h-48 bg-[#080808] rounded-t-2xl overflow-hidden flex items-center justify-center border-b border-white/5">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent" />

      {/* Shape */}
      <div className="relative z-10">
        {type === "circle" && (
          <div className="relative w-20 h-20 rounded-full border-2 border-transparent bg-gradient-to-r from-cyan-500 to-teal-500 [mask-image:linear-gradient(white,white),linear-gradient(white,white)] [mask-clip:content-box,border-box] [mask-composite:exclude] p-[2px] shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <div className="absolute inset-0 rounded-full bg-black/50" />
          </div>
        )}
        {type === "triangle" && (
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
              <path
                d="M50 15 L85 80 L15 80 Z"
                stroke="url(#tri-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]"
              />
              <defs>
                <linearGradient
                  id="tri-gradient"
                  x1="15"
                  y1="80"
                  x2="50"
                  y2="15"
                >
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#F97316" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}
        {type === "square" && (
          <div className="relative w-16 h-16 rounded-2xl border-2 border-transparent bg-gradient-to-br from-cyan-500 to-teal-500 [mask-image:linear-gradient(white,white),linear-gradient(white,white)] [mask-clip:content-box,border-box] [mask-composite:exclude] shadow-[0_0_30px_rgba(20,184,166,0.3)]" />
        )}
      </div>
    </div>
  );
};

const InvestorLogo = ({ name, icon: Icon }: { name: string; icon: any }) => (
  <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0">
    <Icon size={24} className="text-white" />
    <span className="text-lg font-semibold text-white">{name}</span>
  </div>
);

// --- NEW SECTIONS ---

const CultureCarousel = () => {
  return (
    <div className="w-full py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white max-w-4xl tracking-tight">
          Paixão por carros <br />
          e cuidado com quem <br />
          dirige
        </h2>
      </div>

      <div className="relative w-full">
        {/* Gradient Mask for "Center Focus" Effect */}
        {/* This creates the 25% opacity fade on the sides while keeping the center fully visible */}
        <div className="absolute inset-0 z-20 pointer-events-none bg-[linear-gradient(90deg,#050505e6_0%,transparent_20%,transparent_80%,#050505e6_100%)]" />

        <div className="flex gap-8 animate-scroll pl-[50vw]">
          {[...cultureImages, ...cultureImages, ...cultureImages].map(
            (src, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 w-[300px] md:w-[500px] aspect-[4/3] rounded-3xl overflow-hidden border border-white/10"
              >
                <img
                  src={src}
                  alt="Culture"
                  className="w-full h-full object-cover"
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const CareersSection = () => {
  return (
    <div id="career" className="max-w-7xl mx-auto px-6 py-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Left Column: Info */}
        <div className="lg:col-span-5 flex flex-col items-start">
          <div className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 mb-8">
            <span className="text-[10px] md:text-xs font-bold tracking-widest text-white uppercase">
              CARREIRAS
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            Vagas <br />
            abertas
          </h2>

          <div className="space-y-4 mb-10">
            <h3 className="text-lg font-medium text-white">
              Ficou com alguma dúvida?
            </h3>
            <p className="text-gray-400 leading-relaxed max-w-sm">
              Fala com a gente! Entre em contato e nosso time responde rapidinho.
            </p>
          </div>

          <button
            className="px-8 py-3 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-colors group"
            name="contact-us"
          >
            <RollingText text="Fale com a gente" />
          </button>
        </div>

        {/* Right Column: Job List */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {jobs.map((job, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-[#0A0A0A] border border-white/10 hover:border-white/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all"
            >
              <div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors">
                  {job.title}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {job.type}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {job.location}
                  </div>
                </div>
              </div>

              <button
                className="px-6 py-2.5 rounded-lg border border-white/10 text-white text-sm font-medium hover:bg-white hover:text-black transition-all whitespace-nowrap group"
                name="apply"
              >
                <RollingText text="Candidatar" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---

export const AboutUs = () => {
  return (
    <div className="relative w-full min-h-screen pt-32 px-6 bg-[#050505] overflow-x-hidden">
      {/* 1. HERO SECTION */}
      <div className="max-w-7xl mx-auto flex flex-col mb-24 px-4 md:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-fit"
        >
          <div className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-full px-5 py-1.5">
            <span className="text-[11px] md:text-xs font-medium tracking-widest text-white uppercase">
              Sobre nós
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-[80px] font-semibold text-white leading-[1.1] tracking-tight mt-8 mb-16 max-w-4xl"
        >
          O controle do seu carro, do jeito mais simples possível
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative w-full aspect-[16/9] md:aspect-[21/9] lg:h-[600px] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl"
        >
          <img
            src="https://www.dropbox.com/scl/fi/opuu4kptmdm6uuflqq1mc/2944.jpg?rlkey=k9z31yya2z0fo9ws35ats4ukn&st=uahu5vo4&raw=1"
            alt="Team working together"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
        </motion.div>
      </div>

      {/* 2. STATS SECTION */}
      <div className="max-w-7xl mx-auto mb-32 px-4 md:px-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 flex flex-col gap-2"
            >
              <div className="text-4xl md:text-5xl font-bold text-white">
                {stat.value}
              </div>
              <div className="text-gray-400 text-sm md:text-base">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3. VALUES SECTION */}
      <div className="max-w-7xl mx-auto mb-32 px-4 md:px-0">
        <SectionBadge text="Nossos valores" />
        <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-16">
          O que nos move <br /> todos os dias
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((val, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors group"
            >
              <GlowingShape type={val.shape} />
              <div className="p-8">
                <h3 className="text-xl font-bold text-white mb-4">
                  {val.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {val.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 4. TIMELINE SECTION */}
      <div className="max-w-5xl mx-auto mb-32 relative px-4 md:px-0">
        {/* Center Line */}
        <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2 md:translate-x-0" />

        <div className="space-y-16 md:space-y-24">
          {timeline.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={cn(
                "relative flex flex-col md:flex-row items-center gap-8 md:gap-16",
                item.align === "left" ? "md:flex-row-reverse" : ""
              )}
            >
              {/* Timeline Dot */}
              <div className="absolute left-8 md:left-1/2 top-0 md:top-8 w-3 h-3 bg-cyan-500 rounded-full -translate-x-1/2 md:translate-x-1/2 shadow-[0_0_10px_#3B82F6] z-10" />

              {/* Image Side */}
              <div className="w-full md:w-1/2 pl-16 md:pl-0">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={item.image}
                    alt={item.year}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>

              {/* Content Side */}
              <div className="w-full md:w-1/2 pl-16 md:pl-0 text-left">
                <div className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {item.year}
                </div>
                <p className="text-gray-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 5. INVESTORS SECTION */}
      <div className="max-w-7xl mx-auto mb-32 text-center px-4 md:px-0">
        <SectionBadge text="Ecossistema" />
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">
          Parte do ecossistema <br /> TotexMotors
        </h2>

        <div className="flex flex-wrap justify-center gap-12 md:gap-20">
          <InvestorLogo name="company" icon={Box} />
          <InvestorLogo name="Logoipsum" icon={Layers} />
          <InvestorLogo name="business" icon={Hexagon} />
          <InvestorLogo name="Logoipsum" icon={Command} />
          <InvestorLogo name="startup" icon={TrendingUp} />
          <div className="w-full hidden md:block" />{" "}
          {/* Line break for visual alignment if needed */}
          <InvestorLogo name="Logoipsum" icon={Layers} />
          <InvestorLogo name="application" icon={Cpu} />
          <InvestorLogo name="Logoipsum" icon={Hexagon} />
        </div>
      </div>

      {/* 6. TEAM SECTION */}
      <div id="teams" className="max-w-7xl mx-auto mb-32 px-4 md:px-0">
        <SectionBadge text="Nosso time" />
        <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-16">
          Quem cuida da Totex <br /> CAR FINANCE
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {team.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-4 relative">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                {/* LinkedIn Icon */}
                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-lg border border-white/10 hover:bg-white hover:text-black transition-colors cursor-pointer text-white">
                  <Linkedin size={18} />
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">
                {member.name}
              </h3>
              <p className="text-gray-400 text-sm">{member.role}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 7. CULTURE CAROUSEL */}
      <CultureCarousel />

      {/* 8. CAREERS SECTION */}
      <CareersSection />

      {/* 9. CTA SECTION */}
      <div className="pb-20">
        <CTA />
      </div>
    </div>
  );
};
