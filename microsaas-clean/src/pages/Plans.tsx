import { Crown, Check, MessageCircle } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { PaymentSuccess } from "@/components/PaymentSuccess";

const WA = "5511963786699";

// PLANOS — o TotexCar Co-pilot (PRO) é gratuito para todos. Esta tela deixou de ser página de
// preços; agora só confirma que o acesso é completo e sem mensalidade. O retorno de pagamento
// legado (?status=success) segue funcionando pra quem tiver uma cobrança antiga em aberto.
const FEATURES = [
  "Controle ilimitado de gastos do carro",
  "Assistente no WhatsApp (foto, áudio e texto)",
  "Alertas de vencimento (IPVA, licenciamento, seguro, CNH)",
  "Manutenção por km e Modo Viagem",
  "Histórico completo do veículo + hodômetro",
  "Relatórios, análises e Garagem (vitrine)",
];

export default function Plans() {
  const [searchParams] = useSearchParams();
  const { user } = useCurrentUser();

  if (searchParams.get("status") === "success") {
    return <PaymentSuccess planName="Totex Care" />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EEF2F0", color: "#13211E", fontFamily: '"IBM Plex Sans",system-ui,sans-serif' }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
            <img src="/totexmotors-logo.png" alt="Totexmotors" style={{ height: 34, width: "auto" }} />
          </Link>
          <Link to="/" style={{ fontSize: 13, fontWeight: 600, color: "#0C6E6A", textDecoration: "none" }}>{user ? "← Voltar ao app" : "Entrar"}</Link>
        </header>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#DCEDEB", color: "#0C6E6A", padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
            <Crown size={15} /> Totex Care
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 8px", letterSpacing: "-.01em" }}>Seu acesso é completo e gratuito</h1>
          <p style={{ fontSize: 14.5, color: "#5D6E69", lineHeight: 1.5, maxWidth: 420, margin: "0 auto" }}>
            O TotexCar Co-pilot agora é <b style={{ color: "#13211E" }}>grátis pra todo mundo</b> — sem mensalidade. É só usar: cuide do carro pelo app e pelo WhatsApp.
          </p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 18, boxShadow: "0 8px 24px rgba(19,33,30,.06)", padding: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Tudo isso incluso, sem pagar nada:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FEATURES.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: "#DDEFE4", color: "#1F8A54", display: "grid", placeItems: "center", flex: "none" }}><Check size={14} /></span>
                <span style={{ fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
          <Link to="/" style={{ textDecoration: "none" }}>
            <button style={{ width: "100%", height: 50, marginTop: 20, borderRadius: 14, background: "#0C6E6A", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", boxShadow: "0 6px 16px rgba(10,83,80,.25)" }}>
              Abrir o app
            </button>
          </Link>
        </div>

        <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Oi! Quero cuidar do meu carro com o Co-pilot 🚗")}`} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, fontSize: 14, fontWeight: 700, color: "#1FA855", textDecoration: "none" }}>
          <MessageCircle size={17} /> Falar com o Co-pilot no WhatsApp
        </a>
      </div>
    </div>
  );
}
