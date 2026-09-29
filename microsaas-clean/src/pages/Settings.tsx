import React, { useState } from "react";
import { Search, Loader2, Save, User, Car, MessageCircle, ChevronRight } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useUserProfile, useUpdateUserProfile } from "@/hooks/useUserProfile";
import { useVehicle, useCreateAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const WA = "5511963786699";
const COMBUSTIVEIS = ["Flex", "Gasolina", "Etanol", "Diesel", "GNV", "Elétrico", "Híbrido"];
const TIPOS = [["carro", "Carro"], ["moto", "Moto"], ["suv", "SUV"], ["caminhonete", "Caminhonete"], ["van", "Van/Utilitário"], ["outro", "Outro"]];

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div style={full ? { gridColumn: "1 / -1" } : undefined}><label className="lbl">{label}</label>{children}</div>;
}

const Settings = () => {
  const { userId } = useCurrentUser();
  const { data: userProfile, isLoading } = useUserProfile(userId);
  const { vehicle } = useVehicle(userId);
  const updateProfile = useUpdateUserProfile();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [owner, setOwner] = useState({ name: "", phone: "", currency: "BRL", cnh_numero: "", cnh_categoria: "", cnh_vencimento: "" });
  const [car, setCar] = useState({ name: "", type: "carro", marca: "", modelo: "", ano_fabricacao: "", ano_modelo: "", placa: "", renavam: "", chassi: "", cor: "", combustivel: "Flex", hodometro: "", seguradora: "", licenciamento_vencimento: "", ipva_vencimento: "", seguro_vencimento: "", valor_compra: "", data_compra: "" });

  React.useEffect(() => {
    if (userProfile) setOwner({ name: userProfile.name || "", phone: userProfile.phone || "", currency: userProfile.currency || "BRL", cnh_numero: userProfile.cnh_numero || "", cnh_categoria: userProfile.cnh_categoria || "", cnh_vencimento: userProfile.cnh_vencimento || "" });
  }, [userProfile]);
  React.useEffect(() => {
    if (vehicle) setCar({ name: vehicle.name || "", type: vehicle.type || "carro", marca: vehicle.marca || "", modelo: vehicle.modelo || "", ano_fabricacao: vehicle.ano_fabricacao?.toString() || "", ano_modelo: vehicle.ano_modelo?.toString() || "", placa: vehicle.placa || "", renavam: vehicle.renavam || "", chassi: vehicle.chassi || "", cor: vehicle.cor || "", combustivel: vehicle.combustivel || "Flex", hodometro: vehicle.hodometro?.toString() || "", seguradora: vehicle.seguradora || "", licenciamento_vencimento: vehicle.licenciamento_vencimento || "", ipva_vencimento: vehicle.ipva_vencimento || "", seguro_vencimento: vehicle.seguro_vencimento || "", valor_compra: (vehicle as any).valor_compra?.toString() || "", data_compra: (vehicle as any).data_compra || "" });
  }, [vehicle]);

  const handleSave = async () => {
    if (!userId) return;
    try {
      await updateProfile.mutateAsync({ userId, updates: { name: owner.name, phone: (owner.phone || "").replace(/\D/g, ""), currency: owner.currency, cnh_numero: owner.cnh_numero || null, cnh_categoria: owner.cnh_categoria || null, cnh_vencimento: owner.cnh_vencimento || null } });
      const payload = { name: car.name || "Meu veículo", type: car.type, marca: car.marca || null, modelo: car.modelo || null, ano_fabricacao: car.ano_fabricacao ? Number(car.ano_fabricacao) : null, ano_modelo: car.ano_modelo ? Number(car.ano_modelo) : null, placa: car.placa ? car.placa.toUpperCase() : null, renavam: car.renavam || null, chassi: car.chassi ? car.chassi.toUpperCase() : null, cor: car.cor || null, combustivel: car.combustivel || null, hodometro: car.hodometro ? Number(car.hodometro) : 0, seguradora: car.seguradora || null, licenciamento_vencimento: car.licenciamento_vencimento || null, ipva_vencimento: car.ipva_vencimento || null, seguro_vencimento: car.seguro_vencimento || null, valor_compra: car.valor_compra ? Number(car.valor_compra) : null, data_compra: car.data_compra || null };
      if (vehicle) await updateAccount.mutateAsync({ id: vehicle.id, updates: payload });
      else await createAccount.mutateAsync({ user_id: userId, is_active: true, ...payload });
      toast({ title: "Dados salvos ✅", description: "Proprietário e veículo atualizados." });
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const [lookingUp, setLookingUp] = useState(false);
  const handleLookup = async () => {
    const placa = (car.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placa.length < 7) { toast({ title: "Placa incompleta", description: "Ex.: ABC1D23", variant: "destructive" }); return; }
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("vehicle-lookup", { body: { placa } });
      let payload: any = data;
      if (error) { try { payload = await (error as any).context.json(); } catch { throw error; } }
      if (payload?.error) throw new Error(payload.error);
      const v = payload?.vehicle || {};
      setCar((p) => ({ ...p, marca: v.marca || p.marca, modelo: v.modelo || p.modelo, ano_fabricacao: v.ano_fabricacao ? String(v.ano_fabricacao) : p.ano_fabricacao, ano_modelo: v.ano_modelo ? String(v.ano_modelo) : p.ano_modelo, cor: v.cor || p.cor, chassi: v.chassi || p.chassi, renavam: v.renavam || p.renavam, combustivel: v.combustivel || p.combustivel }));
      const got = [v.marca, v.modelo, v.ano_modelo].some(Boolean);
      toast({ title: got ? "Dados encontrados! 🚗" : "Consulta feita", description: got ? "Confira e complete antes de salvar." : "Não veio muita coisa — preencha manualmente." });
    } catch (e: any) {
      const msg = e?.message;
      toast({ title: "Não foi possível consultar", description: msg === "placa_api_nao_configurado" ? "Consulta por placa não ativada." : msg === "placa_invalida" ? "Placa inválida." : "Não achei os dados. Preencha manualmente.", variant: "destructive" });
    } finally { setLookingUp(false); }
  };

  const saving = updateProfile.isPending || createAccount.isPending || updateAccount.isPending;
  const inp = (val: string, set: (v: string) => void, extra?: any) => <input className="field" value={val} onChange={(e) => set(e.target.value)} {...extra} />;

  if (isLoading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;

  return (
    <MgShell title="Meu veículo" back="/veiculo">
      <div className="stack">
        {/* comece pela placa */}
        <section className="card pad" style={{ border: "1px solid rgba(12,110,106,.35)", background: "var(--brand-soft)" }}>
          <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 6, color: "var(--brand-deep)" }}><Search size={16} /> Comece pela placa</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {inp(car.placa, (v) => setCar((p) => ({ ...p, placa: v.toUpperCase() })), { placeholder: "ABC1D23", maxLength: 8, style: { textTransform: "uppercase", fontWeight: 700 }, onKeyDown: (e: any) => e.key === "Enter" && handleLookup() })}
            <button className="sbtn brand" style={{ flex: "none" }} onClick={handleLookup} disabled={lookingUp}>{lookingUp ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar</button>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Digite a placa e o sistema preenche marca, modelo, ano, cor, combustível, chassi e RENAVAM. Confira e ajuste.</p>
        </section>

        {/* proprietário & CNH */}
        <div>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><User size={16} /> Proprietário & CNH</div>
          <section className="card pad"><div className="formgrid">
            <Field label="Nome completo" full>{inp(owner.name, (v) => setOwner((p) => ({ ...p, name: v })))}</Field>
            <Field label="Telefone" full>{inp(owner.phone, (v) => setOwner((p) => ({ ...p, phone: v })), { placeholder: "(11) 90000-0000" })}</Field>
            <Field label="Nº da CNH">{inp(owner.cnh_numero, (v) => setOwner((p) => ({ ...p, cnh_numero: v })), { placeholder: "00000000000" })}</Field>
            <Field label="Categoria">
              <select className="field" value={owner.cnh_categoria} onChange={(e) => setOwner((p) => ({ ...p, cnh_categoria: e.target.value }))}>
                <option value="">—</option>{["A", "B", "AB", "C", "D", "E"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Vencimento da CNH" full>{inp(owner.cnh_vencimento, (v) => setOwner((p) => ({ ...p, cnh_vencimento: v })), { type: "date" })}</Field>
          </div></section>
        </div>

        {/* veículo */}
        <div>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><Car size={16} /> Dados do veículo</div>
          <section className="card pad"><div className="formgrid">
            <Field label="Apelido">{inp(car.name, (v) => setCar((p) => ({ ...p, name: v })), { placeholder: "Meu Civic" })}</Field>
            <Field label="Tipo">
              <select className="field" value={car.type} onChange={(e) => setCar((p) => ({ ...p, type: e.target.value }))}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <Field label="Marca">{inp(car.marca, (v) => setCar((p) => ({ ...p, marca: v })), { placeholder: "Honda" })}</Field>
            <Field label="Modelo">{inp(car.modelo, (v) => setCar((p) => ({ ...p, modelo: v })), { placeholder: "Civic EXL" })}</Field>
            <Field label="Ano fab.">{inp(car.ano_fabricacao, (v) => setCar((p) => ({ ...p, ano_fabricacao: v })), { type: "number", placeholder: "2020" })}</Field>
            <Field label="Ano modelo">{inp(car.ano_modelo, (v) => setCar((p) => ({ ...p, ano_modelo: v })), { type: "number", placeholder: "2021" })}</Field>
            <Field label="Cor">{inp(car.cor, (v) => setCar((p) => ({ ...p, cor: v })), { placeholder: "Prata" })}</Field>
            <Field label="Combustível">
              <select className="field" value={car.combustivel} onChange={(e) => setCar((p) => ({ ...p, combustivel: e.target.value }))}>{COMBUSTIVEIS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </Field>
            <Field label="Hodômetro (km)">{inp(car.hodometro, (v) => setCar((p) => ({ ...p, hodometro: v })), { type: "number", placeholder: "45000" })}</Field>
            <Field label="RENAVAM">{inp(car.renavam, (v) => setCar((p) => ({ ...p, renavam: v })), { placeholder: "00000000000" })}</Field>
            <Field label="Chassi" full>{inp(car.chassi, (v) => setCar((p) => ({ ...p, chassi: v.toUpperCase() })), { placeholder: "9BW..." })}</Field>
          </div></section>
        </div>

        {/* documentos & datas */}
        <div>
          <div className="sec-title" style={{ marginBottom: 10 }}>Documentos & datas</div>
          <section className="card pad"><div className="formgrid">
            <Field label="Seguradora" full>{inp(car.seguradora, (v) => setCar((p) => ({ ...p, seguradora: v })), { placeholder: "Porto Seguro" })}</Field>
            <Field label="Venc. licenciamento">{inp(car.licenciamento_vencimento, (v) => setCar((p) => ({ ...p, licenciamento_vencimento: v })), { type: "date" })}</Field>
            <Field label="Venc. IPVA">{inp(car.ipva_vencimento, (v) => setCar((p) => ({ ...p, ipva_vencimento: v })), { type: "date" })}</Field>
            <Field label="Venc. seguro">{inp(car.seguro_vencimento, (v) => setCar((p) => ({ ...p, seguro_vencimento: v })), { type: "date" })}</Field>
            <Field label="Valor pago">{inp(car.valor_compra, (v) => setCar((p) => ({ ...p, valor_compra: v })), { type: "number", placeholder: "47000" })}</Field>
            <Field label="Data da compra" full>{inp(car.data_compra, (v) => setCar((p) => ({ ...p, data_compra: v })), { type: "date" })}</Field>
          </div></section>
        </div>

        {/* whatsapp */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Oi! Quero registrar um gasto / atualizar o carro")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div><div className="t">Mais fácil pelo WhatsApp</div><div className="s">Manda foto do documento/cupom + km que eu atualizo e lanço sozinho.</div></div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <button className="btn-primary" onClick={handleSave} disabled={saving}><Save size={17} /> {saving ? "Salvando..." : "Salvar dados"}</button>
        <p className="foot-note">Seus dados abastecem os avisos de vencimento, o custo do carro e o "quanto vale".</p>
      </div>
    </MgShell>
  );
};

export default Settings;
