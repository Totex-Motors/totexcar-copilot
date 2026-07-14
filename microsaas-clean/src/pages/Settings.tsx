import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Car, CreditCard, Save, MessageCircle, Search, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useUserProfile, useUpdateUserProfile } from "@/hooks/useUserProfile";
import { useVehicle, useCreateAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { FichaTecnicaCard } from "@/components/FichaTecnicaCard";
import { supabase } from "@/integrations/supabase/client";
import React, { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/ui/phone-input";

const COMBUSTIVEIS = ["Flex", "Gasolina", "Etanol", "Diesel", "GNV", "Elétrico", "Híbrido"];
const TIPOS_VEICULO = [
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
  { value: "suv", label: "SUV" },
  { value: "caminhonete", label: "Caminhonete" },
  { value: "van", label: "Van/Utilitário" },
  { value: "outro", label: "Outro" },
];

const Settings = () => {
  const { userId } = useCurrentUser();
  const { data: userProfile, isLoading } = useUserProfile(userId);
  const { vehicle } = useVehicle(userId);
  const updateProfile = useUpdateUserProfile();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [owner, setOwner] = useState({
    name: "",
    phone: "",
    currency: "BRL",
    cnh_numero: "",
    cnh_categoria: "",
    cnh_vencimento: "",
  });

  const [car, setCar] = useState({
    name: "",
    type: "carro",
    marca: "",
    modelo: "",
    ano_fabricacao: "",
    ano_modelo: "",
    placa: "",
    renavam: "",
    chassi: "",
    cor: "",
    combustivel: "Flex",
    hodometro: "",
    seguradora: "",
    licenciamento_vencimento: "",
    ipva_vencimento: "",
    seguro_vencimento: "",
    valor_compra: "",
    data_compra: "",
  });

  React.useEffect(() => {
    if (userProfile) {
      setOwner({
        name: userProfile.name || "",
        phone: userProfile.phone || "",
        currency: userProfile.currency || "BRL",
        cnh_numero: userProfile.cnh_numero || "",
        cnh_categoria: userProfile.cnh_categoria || "",
        cnh_vencimento: userProfile.cnh_vencimento || "",
      });
    }
  }, [userProfile]);

  React.useEffect(() => {
    if (vehicle) {
      setCar({
        name: vehicle.name || "",
        type: vehicle.type || "carro",
        marca: vehicle.marca || "",
        modelo: vehicle.modelo || "",
        ano_fabricacao: vehicle.ano_fabricacao?.toString() || "",
        ano_modelo: vehicle.ano_modelo?.toString() || "",
        placa: vehicle.placa || "",
        renavam: vehicle.renavam || "",
        chassi: vehicle.chassi || "",
        cor: vehicle.cor || "",
        combustivel: vehicle.combustivel || "Flex",
        hodometro: vehicle.hodometro?.toString() || "",
        seguradora: vehicle.seguradora || "",
        licenciamento_vencimento: vehicle.licenciamento_vencimento || "",
        ipva_vencimento: vehicle.ipva_vencimento || "",
        seguro_vencimento: vehicle.seguro_vencimento || "",
        valor_compra: (vehicle as any).valor_compra?.toString() || "",
        data_compra: (vehicle as any).data_compra || "",
      });
    }
  }, [vehicle]);

  const handleSave = async () => {
    if (!userId) return;

    try {
      await updateProfile.mutateAsync({
        userId,
        updates: {
          name: owner.name,
          phone: (owner.phone || "").replace(/\D/g, ""),
          currency: owner.currency,
          cnh_numero: owner.cnh_numero || null,
          cnh_categoria: owner.cnh_categoria || null,
          cnh_vencimento: owner.cnh_vencimento || null,
        },
      });

      const vehiclePayload = {
        name: car.name || "Meu veículo",
        type: car.type,
        marca: car.marca || null,
        modelo: car.modelo || null,
        ano_fabricacao: car.ano_fabricacao ? Number(car.ano_fabricacao) : null,
        ano_modelo: car.ano_modelo ? Number(car.ano_modelo) : null,
        placa: car.placa ? car.placa.toUpperCase() : null,
        renavam: car.renavam || null,
        chassi: car.chassi ? car.chassi.toUpperCase() : null,
        cor: car.cor || null,
        combustivel: car.combustivel || null,
        hodometro: car.hodometro ? Number(car.hodometro) : 0,
        seguradora: car.seguradora || null,
        licenciamento_vencimento: car.licenciamento_vencimento || null,
        ipva_vencimento: car.ipva_vencimento || null,
        seguro_vencimento: car.seguro_vencimento || null,
        valor_compra: car.valor_compra ? Number(car.valor_compra) : null,
        data_compra: car.data_compra || null,
      };

      if (vehicle) {
        await updateAccount.mutateAsync({ id: vehicle.id, updates: vehiclePayload });
      } else {
        await createAccount.mutateAsync({
          user_id: userId,
          is_active: true,
          ...vehiclePayload,
        });
      }

      toast({
        title: "Dados salvos",
        description: "As informações do proprietário e do veículo foram atualizadas.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar os dados.",
        variant: "destructive",
      });
    }
  };

  const [lookingUp, setLookingUp] = useState(false);
  const handleLookup = async () => {
    const placa = (car.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placa.length < 7) {
      toast({ title: "Placa incompleta", description: "Digite a placa completa (ex.: ABC1D23).", variant: "destructive" });
      return;
    }
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("vehicle-lookup", { body: { placa } });
      let payload: any = data;
      if (error) { try { payload = await (error as any).context.json(); } catch { throw error; } }
      if (payload?.error) throw new Error(payload.error);
      const v = payload?.vehicle || {};
      setCar((p) => ({
        ...p,
        marca: v.marca || p.marca,
        modelo: v.modelo || p.modelo,
        ano_fabricacao: v.ano_fabricacao ? String(v.ano_fabricacao) : p.ano_fabricacao,
        ano_modelo: v.ano_modelo ? String(v.ano_modelo) : p.ano_modelo,
        cor: v.cor || p.cor,
        chassi: v.chassi || p.chassi,
        renavam: v.renavam || p.renavam,
        combustivel: v.combustivel || p.combustivel,
      }));
      const got = [v.marca, v.modelo, v.ano_modelo].some(Boolean);
      toast({
        title: got ? "Dados encontrados! 🚗" : "Consulta feita",
        description: got ? "Confira e complete o que faltar antes de salvar." : "Não veio muita coisa dessa placa — preencha manualmente.",
      });
    } catch (e: any) {
      const msg = e?.message;
      toast({
        title: "Não foi possível consultar",
        description: msg === "placa_api_nao_configurado" ? "A consulta por placa ainda não foi ativada pelo administrador."
          : msg === "placa_invalida" ? "Placa inválida."
          : "Não encontramos os dados dessa placa. Você pode preencher manualmente.",
        variant: "destructive",
      });
    } finally {
      setLookingUp(false);
    }
  };

  const saving = updateProfile.isPending || createAccount.isPending || updateAccount.isPending;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Meu Veículo</h1>
        <p className="text-muted-foreground">
          Dados do proprietário, carta de habilitação (CNH) e do veículo
        </p>
      </div>

      {/* Proprietário + CNH */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Proprietário & CNH
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-gradient-primary text-white text-xl font-bold">
                {owner.name ? owner.name.charAt(0).toUpperCase() : "P"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{owner.name || "Proprietário"}</h3>
              <Badge variant="secondary">
                Ativo desde{" "}
                {userProfile?.created_at
                  ? new Date(userProfile.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                  : "N/A"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={owner.name} onChange={(e) => setOwner((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <PhoneInput id="phone" value={owner.phone} onChange={(value) => setOwner((p) => ({ ...p, phone: value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnh_numero" className="flex items-center gap-1">
                <CreditCard className="w-4 h-4" /> Nº da CNH
              </Label>
              <Input
                id="cnh_numero"
                value={owner.cnh_numero}
                onChange={(e) => setOwner((p) => ({ ...p, cnh_numero: e.target.value }))}
                placeholder="00000000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnh_categoria">Categoria CNH</Label>
              <Select value={owner.cnh_categoria} onValueChange={(v) => setOwner((p) => ({ ...p, cnh_categoria: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Ex: B" />
                </SelectTrigger>
                <SelectContent>
                  {["A", "B", "AB", "C", "D", "E"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnh_vencimento">Vencimento da CNH</Label>
              <Input
                id="cnh_vencimento"
                type="date"
                value={owner.cnh_vencimento}
                onChange={(e) => setOwner((p) => ({ ...p, cnh_vencimento: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Veículo */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Dados do Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Placa primeiro: digite e o sistema busca e preenche o resto */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <Label htmlFor="placa" className="flex items-center gap-2 font-semibold">
              <Search className="w-4 h-4 text-primary" /> Comece pela placa
            </Label>
            <div className="flex gap-2">
              <Input
                id="placa"
                value={car.placa}
                onChange={(e) => setCar((p) => ({ ...p, placa: e.target.value.toUpperCase() }))}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="ABC1D23"
                maxLength={8}
                className="uppercase font-medium"
              />
              <Button type="button" className="flex-shrink-0 bg-gradient-primary text-white" onClick={handleLookup} disabled={lookingUp}>
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1.5">Buscar dados</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Digite a placa e o sistema preenche marca, modelo, ano, cor, combustível, chassi e RENAVAM automaticamente. Confira e ajuste se precisar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apelido">Apelido</Label>
              <Input
                id="apelido"
                value={car.name}
                onChange={(e) => setCar((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Meu Civic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={car.type} onValueChange={(v) => setCar((p) => ({ ...p, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_VEICULO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cor">Cor</Label>
              <Input id="cor" value={car.cor} onChange={(e) => setCar((p) => ({ ...p, cor: e.target.value }))} placeholder="Ex: Prata" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input id="marca" value={car.marca} onChange={(e) => setCar((p) => ({ ...p, marca: e.target.value }))} placeholder="Ex: Honda" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" value={car.modelo} onChange={(e) => setCar((p) => ({ ...p, modelo: e.target.value }))} placeholder="Ex: Civic EXL" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ano_fab">Ano fabricação</Label>
              <Input id="ano_fab" type="number" value={car.ano_fabricacao} onChange={(e) => setCar((p) => ({ ...p, ano_fabricacao: e.target.value }))} placeholder="2020" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano_mod">Ano modelo</Label>
              <Input id="ano_mod" type="number" value={car.ano_modelo} onChange={(e) => setCar((p) => ({ ...p, ano_modelo: e.target.value }))} placeholder="2021" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="combustivel">Combustível</Label>
              <Select value={car.combustivel} onValueChange={(v) => setCar((p) => ({ ...p, combustivel: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMBUSTIVEIS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hodometro">Hodômetro (km)</Label>
              <Input id="hodometro" type="number" value={car.hodometro} onChange={(e) => setCar((p) => ({ ...p, hodometro: e.target.value }))} placeholder="45000" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="renavam">RENAVAM</Label>
              <Input id="renavam" value={car.renavam} onChange={(e) => setCar((p) => ({ ...p, renavam: e.target.value }))} placeholder="00000000000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chassi">Chassi</Label>
              <Input id="chassi" value={car.chassi} onChange={(e) => setCar((p) => ({ ...p, chassi: e.target.value.toUpperCase() }))} placeholder="9BW..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_compra">Valor pago no carro</Label>
              <Input id="valor_compra" type="number" step="0.01" value={car.valor_compra} onChange={(e) => setCar((p) => ({ ...p, valor_compra: e.target.value }))} placeholder="Ex.: 47000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_compra">Data da compra</Label>
              <Input id="data_compra" type="date" value={car.data_compra} onChange={(e) => setCar((p) => ({ ...p, data_compra: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seguradora">Seguradora</Label>
              <Input id="seguradora" value={car.seguradora} onChange={(e) => setCar((p) => ({ ...p, seguradora: e.target.value }))} placeholder="Ex: Porto Seguro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seguro_venc">Vencimento do seguro</Label>
              <Input id="seguro_venc" type="date" value={car.seguro_vencimento} onChange={(e) => setCar((p) => ({ ...p, seguro_vencimento: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic_venc">Vencimento do licenciamento</Label>
              <Input id="lic_venc" type="date" value={car.licenciamento_vencimento} onChange={(e) => setCar((p) => ({ ...p, licenciamento_vencimento: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ipva_venc">Vencimento do IPVA</Label>
              <Input id="ipva_venc" type="date" value={car.ipva_vencimento} onChange={(e) => setCar((p) => ({ ...p, ipva_vencimento: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ficha técnica gerada por IA (mesma base do concierge no WhatsApp) */}
      {vehicle && <FichaTecnicaCard vehicle={vehicle} />}

      {/* Assistente WhatsApp */}
      <Card className="border-0 shadow-premium-md bg-gradient-primary text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MessageCircle className="w-5 h-5" />
            Assistente no WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-white/90 text-sm">
          <p>
            Registre gastos do carro mandando <strong>texto, foto do cupom ou áudio</strong> no WhatsApp
            {import.meta.env.VITE_WHATSAPP_NUMBER ? <> para <strong>{import.meta.env.VITE_WHATSAPP_NUMBER}</strong></> : null}.
            A IA lê, identifica o gasto, categoriza e lança automaticamente.
          </p>
          <ul className="list-disc list-inside space-y-1 text-white/80">
            <li>"Abasteci 150 reais hoje, 45200 km" → registra Combustível</li>
            <li>Foto da nota da revisão → registra Manutenção com o total</li>
            <li>"Quanto gastei esse mês?" → o assistente responde</li>
          </ul>
          <p className="text-white/70">
            Use o mesmo número de telefone cadastrado acima. Você também recebe alertas de vencimento
            (licenciamento, IPVA, seguro e CNH) por aqui.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" className="bg-gradient-primary hover:opacity-90" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar dados"}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
