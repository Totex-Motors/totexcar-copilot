import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  MessageCircle,
  Camera,
  Search,
  Bell,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Globe,
} from "lucide-react";
import { Link } from "react-router-dom";

// Número do agente no WhatsApp (somente dígitos, com DDI 55)
const AGENT_NUMBER = "5515981615862";
const AGENT_DISPLAY = "(15) 98161-5862";
const WELCOME_MSG =
  "Oi, TotexCar Co-pilot! Acabei de assinar o plano para acompanhar e organizar minhas despesas com meu carro 🚗";
const WHATSAPP_LINK = `https://wa.me/${AGENT_NUMBER}?text=${encodeURIComponent(WELCOME_MSG)}`;

const STEPS = [
  {
    icon: Camera,
    title: "Tire uma foto do gasto",
    desc: "Cupom de combustível, nota da revisão, multa, IPVA… Nos abastecimentos, mande também a foto do hodômetro: é assim que eu meço seu consumo (km/L)!",
    color: "text-teal-600 bg-teal-500/10",
  },
  {
    icon: MessageCircle,
    title: "Envie no WhatsApp",
    desc: "Mande a foto, um áudio ou um texto neste chat. A IA lê, categoriza e registra o gasto pra você.",
    color: "text-blue-600 bg-blue-500/10",
  },
  {
    icon: Search,
    title: "Pergunte quando precisar",
    desc: 'Digite uma pergunta. Ex.: "quanto gastei esse mês?" ou "qual o vencimento do IPVA?".',
    color: "text-purple-600 bg-purple-500/10",
  },
  {
    icon: Bell,
    title: "Receba alertas de vencimento",
    desc: "Eu aviso antes de vencer IPVA, licenciamento, seguro e CNH. Nunca mais pague multa por esquecimento!",
    color: "text-amber-600 bg-amber-500/10",
  },
];

export function PaymentSuccess({ planName = "Totex Care" }: { planName?: string }) {
  const [copied, setCopied] = useState(false);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-md mx-auto space-y-8">
        {/* Confirmação */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-11 h-11 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mt-1">
              Seu plano <span className="font-semibold text-primary">{planName}</span> já está ativo.
            </p>
          </div>
        </div>

        {/* Card WhatsApp */}
        <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.06] p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold leading-tight">Fale com o TotexCar Co-pilot no WhatsApp!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Abra o WhatsApp e mande sua primeira mensagem pro <strong>TotexCar Co-pilot</strong>. É por lá
                que você registra gastos, mede o consumo e analisa multas.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-background border px-3 py-2.5">
            <span className="font-medium text-sm">{AGENT_DISPLAY}</span>
            <button
              onClick={copyNumber}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="block">
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold gap-2" size="lg">
              <MessageCircle className="w-4 h-4" /> Abrir WhatsApp <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>

        {/* Como começar */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 font-bold">
            <Sparkles className="w-5 h-5 text-primary" /> Como começar a usar
          </h3>
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 flex gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Passo {i + 1}
                  </p>
                  <p className="font-semibold leading-tight">{s.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Painel web */}
        <div className="rounded-xl border bg-card p-5 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Acesse também pelo navegador</p>
            <p className="text-sm text-muted-foreground mt-1">
              Veja seus gastos organizados no painel, com relatórios, gráficos e os vencimentos do veículo.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" className="w-full">Ir para o painel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
