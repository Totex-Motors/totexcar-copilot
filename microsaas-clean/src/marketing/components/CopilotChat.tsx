import { motion } from "framer-motion";
import { WhatsAppPhone, type Bubble } from "./WhatsAppPhone";

// "PERGUNTE AO CO-PILOT" — vende a inteligência MOSTRANDO a conversa, não dizendo "temos IA".
// Três conversas, todas com coisas que o produto já faz: custo do mês, dúvida de carro + Radar, multa + recurso.
const CHATS: { title: string; bubbles: Bubble[] }[] = [
  {
    title: "Quanto eu gastei?",
    bubbles: [
      { me: true, text: "Quanto meu carro me custou esse mês?" },
      { text: <>Até agora <strong>R$ 1.248</strong>: 58% combustível, 27% revisão, 15% seguro. Tá <strong>R$ 184 abaixo</strong> da sua média. 👏</> },
      { me: true, text: "E por km?" },
      { text: <>Com os 1.230 km do mês: <strong>R$ 1,01/km</strong>. Quer o detalhe por categoria?</> },
    ],
  },
  {
    title: "Achei um barulho",
    bubbles: [
      { me: true, text: "Tá fazendo um barulho na frente quando eu freio" },
      { text: <>Barulho na frente ao frear costuma ser <strong>pastilha</strong>. Você rodou <strong>11.400 km</strong> desde a última troca — vale olhar.</> },
      { text: <>Quer que eu ache uma oficina perto de você? Tem <strong>parceira com 10% na primeira visita</strong>. 🔧</> },
    ],
  },
  {
    title: "Levei uma multa",
    bubbles: [
      { me: true, text: <>📸 <em>foto do auto de infração</em></> },
      { text: <>Li seu auto: excesso de velocidade, R$ 195,23, 5 pontos. Quando você <strong>recebeu</strong> a notificação?</> },
      { me: true, text: "Semana passada, a infração foi em março" },
      { text: <>⚠️ Notificação fora dos 30 dias (<strong>Art. 281 CTB</strong>). Montei um <strong>modelo de recurso</strong> pra você protocolar ⚖️</> },
    ],
  },
];

export const CopilotChat = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-bold tracking-widest uppercase text-teal-400 mb-4">
          Pergunte ao Co-pilot
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Não é só registrar. <br /><span className="text-gray-400">É entender.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg leading-relaxed">
          Em vez de interpretar dezenas de números, você pergunta. No WhatsApp mesmo. O Co-pilot conhece o seu carro e responde com os seus dados.
        </motion.p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {CHATS.map((c, i) => (
          <motion.div key={c.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
            <p className="text-sm font-semibold text-gray-300 mb-3 text-center">“{c.title}”</p>
            <WhatsAppPhone bubbles={c.bubbles} minHeight={300} />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
