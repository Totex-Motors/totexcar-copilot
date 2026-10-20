import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Search, Car, Tag, ChevronLeft } from "lucide-react";
import { maskCpf, cpfValido } from "@/lib/cpf";

// LINK DO VENDEDOR: /venda/{token}. Tela única, pensada pro celular, SÓ com o cadastro da venda — sem login
// e sem o resto do painel. O token é pessoal (gerado no painel, aba Atendimento → Equipe) e já identifica
// o vendedor e a loja: a venda sai no nome dele, o cliente recebe as boas-vindas e a etiqueta é vinculada.

type Carro = { id: string; desc: string; versao: string | null; cor: string | null; preco: number | null; km: number | null; capa: string | null; preparacao?: { data: string; km: number } | null };
type Venda = { id: string; cliente: string; carro: string | null; data: string; etiqueta: string | null; ativou: boolean };
type Info = { loja: string; vendedor: { nome: string }; carros: Carro[]; aviso: string | null; vendas: Venda[] };

const dataBR = (s?: string | null) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const kmBR = (n?: number | null) => (n ? `${Number(n).toLocaleString("pt-BR")} km` : "");
const ERROS: Record<string, string> = {
  telefone_invalido: "Confira o WhatsApp do cliente (com DDD).",
  cpf_invalido: "Confira o CPF do cliente: o número não é válido.",
  link_invalido: "Este link não vale mais. Peça um novo ao gerente.",
};
const ERRO_ETIQUETA: Record<string, string> = {
  etiqueta_nao_encontrada: "não existe uma etiqueta com esse número",
  etiqueta_de_outra_loja: "a etiqueta é de outra loja",
  telefone_invalido: "telefone inválido",
};

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("dealer-api", { body });
  if (error) {
    let msg = String(error.message || error);
    try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function VendaRapida() {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carro, setCarro] = useState<Carro | null>(null);
  const [fora, setFora] = useState(false);
  const [busca, setBusca] = useState("");
  const [f, setF] = useState({ nome: "", whats: "", cpf: "", carro: "", placa: "", etiqueta: "", km: "" });
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [ok, setOk] = useState<any>(null);

  const carregar = async () => {
    try { setInfo(await chamar({ action: "venda_info", t: token })); }
    catch (e: any) { setErro(ERROS[e?.message] || "Não consegui abrir agora. Confira a internet e tente de novo."); }
  };
  useEffect(() => { carregar(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (info?.carros || []).filter((c) => !q || `${c.desc} ${c.versao || ""} ${c.cor || ""}`.toLowerCase().includes(q)).slice(0, 40);
  }, [info, busca]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const novo = () => { setOk(null); setCarro(null); setFora(false); setBusca(""); setF({ nome: "", whats: "", cpf: "", carro: "", placa: "", etiqueta: "", km: "" }); carregar(); window.scrollTo(0, 0); };

  const registrar = async () => {
    setFalha(null);
    if (!carro && !(fora && f.carro.trim())) { setFalha("Escolha o carro do estoque (ou marque que está fora do estoque e escreva o modelo)."); return; }
    if (!f.nome.trim()) { setFalha("Informe o nome do cliente."); return; }
    if (f.whats.replace(/\D/g, "").length < 10) { setFalha(ERROS.telefone_invalido); return; }
    if (!cpfValido(f.cpf)) { setFalha(ERROS.cpf_invalido); return; }
    setEnviando(true);
    try {
      const r = await chamar({
        action: "venda_registrar", t: token,
        customer_name: f.nome.trim(), customer_phone: f.whats, customer_cpf: f.cpf.replace(/\D/g, ""),
        car_desc: fora ? f.carro.trim() : [carro!.desc, carro!.cor].filter(Boolean).join(" "),
        vehicle_id: carro?.id || undefined,
        placa: f.placa.trim() || undefined,
        tag_label: f.etiqueta.trim() || undefined,
        km_entrega: Number(f.km) > 0 ? Number(f.km) : undefined,
      });
      setOk({ ...r, cliente: f.nome.trim().split(" ")[0], carro: fora ? f.carro.trim() : carro!.desc, semPrep: !fora && !carro?.preparacao, etiquetaDigitada: f.etiqueta.trim() });
      window.scrollTo(0, 0);
    } catch (e: any) {
      setFalha(ERROS[e?.message] || `Não consegui registrar: ${e?.message || "erro"}. Tente de novo.`);
    } finally { setEnviando(false); }
  };

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center max-w-sm space-y-3"><p className="text-3xl">🔒</p><h1 className="text-lg font-semibold">{erro}</h1></div>
    </div>
  );
  if (!info) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-[#0b1f6b] text-white px-4 pt-5 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="text-[11px] font-bold tracking-widest text-teal-300 uppercase">{info.loja} · Co-pilot</div>
          <h1 className="text-xl font-extrabold mt-0.5">Nova venda</h1>
          <div className="text-sm text-blue-100">Vendedor: <b className="text-white">{info.vendedor.nome}</b></div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-1 space-y-4 pt-4">
        {ok ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-bold text-lg"><CheckCircle2 className="w-6 h-6" /> Venda registrada</div>
              <p className="text-sm"><b>{ok.cliente}</b> · {ok.carro}</p>
              <ul className="text-sm space-y-1.5">
                <li>{ok.welcome_sent ? "✅ O cliente recebeu a mensagem de boas-vindas no WhatsApp." : "⚠️ A mensagem de boas-vindas não saiu. Avise o gerente."}</li>
                {ok.tag ? <li>✅ Etiqueta <b>{ok.tag.label}</b> vinculada a este cliente.</li>
                  : ok.tag_error ? <li className="text-red-700">❌ Etiqueta {ok.etiquetaDigitada} não vinculada: {ERRO_ETIQUETA[ok.tag_error] || ok.tag_error}. Confira o número.</li>
                  : <li className="text-amber-700">⚠️ Sem etiqueta informada. Vincule no painel antes da entrega.</li>}
                {ok.revisado ? <li>🛠️ Troca de óleo da preparação ligada ao Co-pilot do cliente.</li>
                  : ok.semPrep ? <li className="text-amber-700">⚠️ Este carro está sem troca de óleo registrada. Avise o gerente de manutenção antes da entrega.</li> : null}
              </ul>
              <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm">
                <b>Agora, na entrega:</b> cole a etiqueta no para-brisa e peça pro cliente escanear. O Co-pilot faz o <b>checklist de entrega</b> com ele (foto do painel e “Tudo certo”). Só libere o carro depois do OK.
              </div>
              <Button className="w-full h-11" onClick={novo}>Registrar outra venda</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 1. CARRO */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Car className="w-4 h-4 text-primary" /> 1. Carro vendido</div>
                {carro ? (
                  <div className="flex items-center gap-3">
                    {carro.capa ? <img src={carro.capa} alt="" className="w-20 h-14 rounded-md object-cover shrink-0" /> : <div className="w-20 h-14 rounded-md bg-muted shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{carro.desc}</div>
                      <div className="text-xs text-muted-foreground">{[carro.versao, carro.cor].filter(Boolean).join(" · ")}</div>
                      {carro.preparacao ? <div className="text-xs text-green-700 font-medium">🛠️ Revisado em {dataBR(carro.preparacao.data)} · {kmBR(carro.preparacao.km)}</div>
                        : <div className="text-xs text-amber-700 font-medium">⚠️ Sem troca de óleo registrada</div>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setCarro(null)}><ChevronLeft className="w-4 h-4" /> Trocar</Button>
                  </div>
                ) : fora ? (
                  <div className="space-y-1"><Label className="text-xs">Modelo e ano</Label><Input value={f.carro} onChange={(e) => set("carro", e.target.value)} placeholder="Ex.: Onix 2020 prata" /></div>
                ) : (
                  <>
                    <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-3 text-muted-foreground" /><Input className="pl-8 h-10" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busque: modelo, ano ou cor" /></div>
                    <div className="max-h-72 overflow-y-auto divide-y rounded-md border bg-white">
                      {lista.map((c) => (
                        <button key={c.id} type="button" onClick={() => setCarro(c)} className="w-full flex items-center gap-2.5 p-2 text-left active:bg-muted">
                          {c.capa ? <img src={c.capa} alt="" loading="lazy" className="w-16 h-11 rounded object-cover shrink-0" /> : <div className="w-16 h-11 rounded bg-muted shrink-0" />}
                          <span className="min-w-0">
                            <span className="block text-sm truncate">{c.desc}</span>
                            <span className="block text-[11.5px] text-muted-foreground truncate">{[c.versao, c.cor].filter(Boolean).join(" · ")}</span>
                            <span className={`block text-[11px] font-medium ${c.preparacao ? "text-green-700" : "text-amber-700"}`}>{c.preparacao ? "🛠️ Revisado" : "⚠️ Sem troca de óleo registrada"}</span>
                          </span>
                        </button>
                      ))}
                      {!lista.length && <div className="p-3 text-sm text-muted-foreground">{info.carros.length ? "Nenhum carro com essa busca." : "Estoque indisponível agora."}</div>}
                    </div>
                  </>
                )}
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input type="checkbox" className="w-4 h-4" checked={fora} onChange={(e) => { setFora(e.target.checked); if (e.target.checked) setCarro(null); }} />
                  O carro não está no estoque
                </label>
              </CardContent>
            </Card>

            {/* 2. CLIENTE */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold">2. Cliente</div>
                <div className="space-y-1"><Label className="text-xs">Nome</Label><Input className="h-10" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo" autoComplete="off" /></div>
                <div className="space-y-1"><Label className="text-xs">WhatsApp com DDD</Label><Input className="h-10" type="tel" inputMode="tel" value={f.whats} onChange={(e) => set("whats", e.target.value)} placeholder="11 98765-4321" /></div>
                <div className="space-y-1">
                  <Label className="text-xs">CPF do cliente (obrigatório)</Label>
                  <Input className={`h-10 ${f.cpf.replace(/\D/g, "").length === 11 && !cpfValido(f.cpf) ? "border-red-400" : ""}`} inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" autoComplete="off" />
                  {f.cpf.replace(/\D/g, "").length === 11 && !cpfValido(f.cpf) && <div className="text-xs text-red-700">CPF inválido. Confira os números com o cliente.</div>}
                </div>
              </CardContent>
            </Card>

            {/* 3. ENTREGA */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Tag className="w-4 h-4 text-primary" /> 3. Entrega</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Etiqueta nº</Label><Input className="h-10" value={f.etiqueta} onChange={(e) => set("etiqueta", e.target.value.toUpperCase())} placeholder="CV-0016" /></div>
                  <div className="space-y-1"><Label className="text-xs">Placa</Label><Input className="h-10" value={f.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} /></div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Km na entrega</Label><Input className="h-10" type="number" inputMode="numeric" value={f.km} onChange={(e) => set("km", e.target.value)} placeholder="48200" /></div>
                </div>
              </CardContent>
            </Card>

            {falha && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{falha}</div>}
            <Button className="w-full h-12 text-base" disabled={enviando} onClick={registrar}>{enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar venda"}</Button>
            <p className="text-xs text-center text-muted-foreground">O cliente recebe a mensagem de boas-vindas do Co-pilot na hora.</p>
          </>
        )}

        {!!info.vendas.length && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="font-semibold mb-2">Minhas últimas vendas</div>
              <div className="divide-y">
                {info.vendas.map((v) => (
                  <div key={v.id} className="py-2 flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0"><div className="truncate"><b>{v.cliente}</b>{v.carro ? ` · ${v.carro}` : ""}</div><div className="text-xs text-muted-foreground">{dataBR(v.data)}{v.etiqueta ? ` · ${v.etiqueta}` : ""}</div></div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${v.ativou ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{v.ativou ? "Ativou" : "Falta escanear"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
