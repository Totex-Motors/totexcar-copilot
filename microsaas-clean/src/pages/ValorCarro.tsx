import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Car, Search, MessageCircle, ChevronDown } from "lucide-react";

// Página PÚBLICA "Quanto vale o seu carro" — o QR do shopping cai aqui.
// Visual dark + caixa em neon (glow teal). A pessoa digita a placa, vê o valor FIPE na hora
// (motor quanto-vale) e é convidada a continuar no WhatsApp (captura + ponte pra vender/trocar).
const WA = "5511963786699";
const NEON = "#2FE6D6"; // teal neon da marca

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
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8" style={{ colorScheme: "dark" }}>
      <div className="w-full max-w-md flex flex-col items-center">
        {/* logo */}
        <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-16 w-auto mb-8 object-contain" />

        {/* hero — caixa em neon com glow */}
        <div
          className="w-full rounded-3xl p-6 bg-neutral-950"
          style={{ border: `1.5px solid ${NEON}`, boxShadow: `0 0 24px rgba(47,230,214,0.45), inset 0 0 24px rgba(47,230,214,0.06)` }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NEON }}>
            <Car className="w-4 h-4" /> Avaliação grátis
          </div>
          <h1 className="text-2xl font-extrabold leading-tight mt-1">Quanto vale o seu carro?</h1>
          <p className="text-sm text-neutral-400 mt-1">Descubra na tabela FIPE em segundos. Só a placa.</p>

          <input
            value={placa}
            onChange={(e) => onPlaca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && consultar()}
            placeholder="ABC1D23"
            inputMode="text"
            autoCapitalize="characters"
            className="w-full mt-4 bg-white text-black rounded-xl px-4 py-3 text-xl font-bold tracking-[0.3em] text-center placeholder:tracking-normal placeholder:font-normal placeholder:text-neutral-400 outline-none"
          />
          <button
            onClick={consultar}
            disabled={placa.length < 7 || loading}
            className="w-full mt-3 h-12 rounded-xl font-bold text-base flex items-center justify-center gap-2 text-black transition disabled:opacity-50"
            style={{ background: NEON, boxShadow: `0 0 18px rgba(47,230,214,0.5)` }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? "Consultando..." : "Ver quanto vale"}
          </button>
        </div>

        {/* erro */}
        {res && !res.ok && (
          <div className="w-full mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-center">
            <p className="font-semibold">
              {res.error === "placa_nao_encontrada" ? "Não achei essa placa 😕" : "Não consegui o valor agora"}
            </p>
            <p className="text-sm text-neutral-400 mt-1">
              {res.error === "placa_nao_encontrada" ? "Confere se digitou certinho (ex.: ABC1D23) e tenta de novo." : "Tenta de novo daqui a pouco."}
            </p>
          </div>
        )}

        {/* resultado */}
        {res && res.ok && res.valor && (
          <div
            className="w-full mt-4 rounded-2xl p-5 bg-neutral-950"
            style={{ border: `1px solid rgba(47,230,214,0.5)`, boxShadow: `0 0 18px rgba(47,230,214,0.28)` }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Seu carro na FIPE</div>
            <div className="font-bold text-lg leading-tight mt-1">
              {`${res.marca || ""} ${res.modelo || res.modelo_placa || ""}`.trim()}{res.ano ? ` ${res.ano}` : ""}
            </div>
            <div className="text-4xl font-extrabold mt-2" style={{ color: NEON, textShadow: `0 0 18px rgba(47,230,214,0.5)` }}>{res.valor}</div>
            {res.ref && <div className="text-xs text-neutral-500 mt-1">Tabela FIPE · {res.ref}</div>}

            {res.candidatos && res.candidatos.length > 1 && (
              <div className="mt-3">
                <button onClick={() => setVerMais(!verMais)} className="text-sm font-medium flex items-center gap-1" style={{ color: NEON }}>
                  Não é essa versão? Ver outras <ChevronDown className={`w-4 h-4 transition ${verMais ? "rotate-180" : ""}`} />
                </button>
                {verMais && (
                  <div className="mt-2 divide-y divide-neutral-800 rounded-xl border border-neutral-800 overflow-hidden">
                    {res.candidatos.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-neutral-400 truncate">{c.nome} {c.ano}</span>
                        <span className="font-semibold shrink-0">{c.valor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <a href={waLink()} target="_blank" rel="noreferrer" className="block mt-4">
              <button
                className="w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2"
                style={{ background: "#1FA855", boxShadow: "0 0 16px rgba(31,168,85,0.45)" }}
              >
                <MessageCircle className="w-5 h-5" /> Quero vender ou avaliar pra trocar
              </button>
            </a>
            <p className="text-[11px] text-neutral-500 text-center mt-2">
              Continue no WhatsApp: te aviso quando seu carro valorizar e te ajudo a vender pelo melhor preço.
            </p>
          </div>
        )}

        <p className="text-xs text-neutral-500 text-center mt-8 leading-relaxed">
          <span className="italic">O carro que você procura, ao alcance do seu dedo.</span><br />
          Valor de referência da Tabela FIPE. Avaliação final mediante vistoria.
        </p>
      </div>
    </div>
  );
}
