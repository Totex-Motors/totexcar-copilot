import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Car, Search, MessageCircle, ChevronDown } from "lucide-react";

// Página PÚBLICA "Quanto vale o seu carro" — o QR do shopping cai aqui.
// A pessoa digita a placa, vê o valor FIPE na hora (motor quanto-vale) e é convidada a continuar
// no WhatsApp (onde a gente captura o contato e faz a ponte pra vender/trocar).
const WA = "5511963786699";

type Resultado = {
  ok: boolean; marca?: string; modelo?: string; modelo_placa?: string; ano?: number;
  valor?: string; ref?: string; error?: string;
  candidatos?: { nome: string; ano: number; valor: string }[];
};

export default function ValorCarro() {
  const [placa, setPlaca] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [verMais, setVerMais] = useState(false);

  const onPlaca = (v: string) => setPlaca(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7));

  const consultar = async () => {
    if (placa.length < 7) return;
    setLoading(true); setRes(null); setVerMais(false);
    try {
      const { data, error } = await supabase.functions.invoke("quanto-vale", { body: { placa } });
      if (error) throw error;
      setRes(data as Resultado);
    } catch {
      setRes({ ok: false, error: "falha" });
    } finally {
      setLoading(false);
    }
  };

  const waLink = () => {
    const carro = res?.ok ? `${res.marca || ""} ${res.modelo || res.modelo_placa || ""}`.trim() : "";
    const txt = res?.ok && res.valor
      ? `Oi! Vi que meu ${carro} vale ${res.valor} na FIPE (placa ${placa}). Quero saber mais 🚗`
      : `Oi! Quero saber quanto vale meu carro, placa ${placa} 🚗`;
    return `https://wa.me/${WA}?text=${encodeURIComponent(txt)}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* topo com a logo */}
        <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-16 w-auto mb-6 object-contain" />

        {/* hero */}
        <div className="w-full rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <Car className="w-4 h-4" /> Avaliação grátis
          </div>
          <h1 className="text-2xl font-extrabold leading-tight mt-1">Quanto vale o seu carro?</h1>
          <p className="text-sm opacity-90 mt-1">Descubra na tabela FIPE em segundos. Só a placa.</p>

          <div className="mt-4 bg-white/15 rounded-2xl p-2 flex gap-2">
            <input
              value={placa}
              onChange={(e) => onPlaca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && consultar()}
              placeholder="ABC1D23"
              inputMode="text"
              autoCapitalize="characters"
              className="flex-1 bg-white text-foreground rounded-xl px-4 py-3 text-lg font-bold tracking-[0.25em] text-center placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground outline-none"
            />
          </div>
          <Button
            onClick={consultar}
            disabled={placa.length < 7 || loading}
            className="w-full mt-2 h-12 bg-white text-primary hover:bg-white/90 font-bold text-base gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? "Consultando..." : "Ver quanto vale"}
          </Button>
        </div>

        {/* resultado */}
        {res && !res.ok && (
          <div className="w-full mt-4 rounded-2xl border border-border bg-card p-5 text-center">
            <p className="font-semibold">
              {res.error === "placa_nao_encontrada" ? "Não achei essa placa 😕" : "Não consegui o valor agora"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {res.error === "placa_nao_encontrada" ? "Confere se digitou certinho (ex.: ABC1D23) e tenta de novo." : "Tenta de novo daqui a pouco."}
            </p>
          </div>
        )}

        {res && res.ok && res.valor && (
          <div className="w-full mt-4 rounded-2xl border border-border bg-card p-5 shadow-premium-md">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seu carro na FIPE</div>
            <div className="font-bold text-lg leading-tight mt-1">
              {`${res.marca || ""} ${res.modelo || res.modelo_placa || ""}`.trim()}{res.ano ? ` ${res.ano}` : ""}
            </div>
            <div className="text-3xl font-extrabold text-primary mt-2">{res.valor}</div>
            {res.ref && <div className="text-xs text-muted-foreground mt-1">Tabela FIPE · {res.ref}</div>}

            {res.candidatos && res.candidatos.length > 1 && (
              <div className="mt-3">
                <button onClick={() => setVerMais(!verMais)} className="text-sm text-primary font-medium flex items-center gap-1">
                  Não é essa versão? Ver outras <ChevronDown className={`w-4 h-4 transition ${verMais ? "rotate-180" : ""}`} />
                </button>
                {verMais && (
                  <div className="mt-2 divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {res.candidatos.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-muted-foreground truncate">{c.nome} {c.ano}</span>
                        <span className="font-semibold shrink-0">{c.valor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <a href={waLink()} target="_blank" rel="noreferrer" className="block mt-4">
              <Button className="w-full h-12 bg-[#1FA855] hover:bg-[#178c46] text-white font-bold gap-2">
                <MessageCircle className="w-5 h-5" /> Quero vender ou avaliar pra trocar
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Continue no WhatsApp: te aviso quando seu carro valorizar e te ajudo a vender pelo melhor preço.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8 leading-relaxed">
          <span className="italic">O carro que você procura, ao alcance do seu dedo.</span><br />
          Valor de referência da Tabela FIPE. Avaliação final mediante vistoria.
        </p>
      </div>
    </div>
  );
}
