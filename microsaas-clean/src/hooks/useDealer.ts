import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DealerInfo {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  dealership: string | null;
}

export interface ClientNextDue {
  tipo: string;
  date: string;
  days: number | null;
}

export interface DealerClient {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
  subscription_status: string | null;
  coupon_code: string | null;
  dealership: string | null;
  created_at: string | null;
  vehicle: { apelido: string | null; marca: string | null; modelo: string | null; placa: string | null; hodometro: number | null } | null;
  next_due: ClientNextDue | null;
  total_expenses: number;
  expense_count: number;
  last_expense_date: string | null;
}

export interface ClientJourney {
  owner: {
    id: string; name: string | null; email: string | null; phone: string | null;
    plan: string | null; subscription_status: string | null; dealership: string | null;
    coupon_code: string | null; created_at: string | null;
  } | null;
  vehicle: any | null;
  vencimentos: ClientNextDue[];
  expenses: { total: number; count: number; by_category: Record<string, number> };
  recent_expenses: { description: string | null; amount: number; type: string; date: string; odometer: number | null; category: string | null }[];
}

async function callDealer(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("dealer-api", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const useDealerMe = (enabled: boolean) =>
  useQuery({
    queryKey: ["dealer-me"],
    queryFn: async () => {
      const data = await callDealer("me");
      return data.dealer as DealerInfo;
    },
    enabled,
  });

// dealership só tem efeito para admin (preview de uma loja); o lojista é sempre preso à própria
export const useDealerClients = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["dealer-clients", dealership || null],
    queryFn: async () => {
      const data = await callDealer("list_clients", dealership ? { dealership } : {});
      return (data.clients || []) as DealerClient[];
    },
    enabled,
  });

export const useClientJourney = (userId: string | null) =>
  useQuery({
    queryKey: ["client-journey", userId],
    queryFn: async () => {
      const data = await callDealer("client_journey", { user_id: userId });
      return data as ClientJourney;
    },
    enabled: !!userId,
  });

// ===== Conversas (visibilidade do WhatsApp por cliente, somente leitura) =====
export interface ConversaClient {
  id: string;
  name: string | null;
  phone: string | null;
  plan: string | null;
  subscription_status: string | null;
  created_at: string | null;
  last_client_msg_at: string | null;
  msgs_30d: number;
  last_sent_at: string | null;
  fails_30d: number;
  welcome_sent: boolean;
  sponsored: boolean;
  nps_score: number | null;
}

export interface ConversaItem {
  at: string;
  type: "cliente" | "proativa" | "campanha" | "boas_vindas" | "falha" | "registro" | "nps";
  kind?: string | null;
  acao?: string | null;
  texto?: string | null;
  assunto?: string | null;
  ok?: boolean;
  cortesia?: boolean;
  welcome?: boolean;
  car?: string | null;
  nota?: number | null;
  comentario?: string | null;
}

export const useConversas = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["dealer-conversas", dealership || null],
    queryFn: async () => ((await callDealer("conversas_list", dealership ? { dealership } : {})).clients || []) as ConversaClient[],
    enabled,
  });

export const useConversaTimeline = (userId: string | null) =>
  useQuery({
    queryKey: ["dealer-conversa-timeline", userId],
    queryFn: async () => {
      const data = await callDealer("conversa_timeline", { user_id: userId });
      return data as { owner: { id: string; name: string | null; phone: string | null; created_at: string | null } | null; items: ConversaItem[] };
    },
    enabled: !!userId,
  });

// ===== Sucesso do Cliente / Pós-venda =====
export interface PostsaleJourney {
  id: string; dealership: string; customer_name: string | null; customer_phone: string;
  car_desc: string | null; purchase_date: string; coupon_code: string | null;
  status: string; welcome_sent: boolean; nps_asked_at: string | null; nps_score: number | null;
  nps_at: string | null; review_link_sent: boolean; anniversary_sent: boolean; created_at: string;
  transfer?: Record<string, boolean> | null;
  transfer_status?: string;
  vendedor_id?: string | null;
  warranty_until?: string | null;
  revisao_proxima?: string | null;
  sponsored?: boolean;
  sponsored_value?: number;
  sponsor_settled?: boolean;
  user_id?: string | null;
  nps_comment?: string | null;
}
export interface PostsaleStats { total: number; respondidos: number; promotores: number; passivos: number; detratores: number; nps: number | null; cortesias_ativas?: number; cortesias_valor?: number; }
export interface SponsorBalance { lojas: { dealership: string; count: number; total: number }[]; total: number; }
export interface PostsaleConfig { dealership: string; google_review_url: string | null; nps_delay_days: number; }

export const usePostsaleList = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["postsale-list", dealership || null],
    queryFn: async () => ((await callDealer("postsale_list", dealership ? { dealership } : {})).journeys || []) as PostsaleJourney[],
    enabled,
  });

export const usePostsaleStats = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["postsale-stats", dealership || null],
    queryFn: async () => (await callDealer("postsale_stats", dealership ? { dealership } : {})) as PostsaleStats,
    enabled,
  });

export const usePostsaleConfig = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["postsale-config", dealership || null],
    queryFn: async () => (await callDealer("postsale_config", dealership ? { dealership } : {})) as { config: PostsaleConfig; coupon: string | null },
    enabled,
  });

export const usePostsaleCreate = () =>
  useMutation({
    mutationFn: async (p: { customer_name?: string; customer_phone: string; car_desc?: string; purchase_date?: string; cortesia?: boolean; placa?: string; valor_compra?: number; dealership?: string; tag_label?: string; km_entrega?: number; vehicle_id?: string; vendedor_id?: string }) =>
      callDealer("postsale_create", p),
  });

// estoque da loja (marketplace) pro pós-venda escolher o carro vendido — foto de capa obrigatória
export interface PrepResumo { id: string; data: string; km: number; intervalo_km: number; feito_por: string | null }
export interface EstoqueCarro { id: string; desc: string; versao: string | null; cor: string | null; preco: number | null; km: number | null; capa: string | null; preparacao?: PrepResumo | null }
export const useEstoqueLista = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["estoque-lista", dealership || null],
    queryFn: async () => ((await callDealer("estoque_lista", dealership ? { dealership } : {})).carros || []) as EstoqueCarro[],
    enabled,
    staleTime: 5 * 60_000,
  });

// ===== Etiquetas QR do para-brisa (car_tags) =====
export interface CarTag {
  id: string; label: string; token: string; dealership: string | null; batch: string | null;
  status: "livre" | "vinculada" | "ativa" | "inativa";
  journey_id: string | null; user_id: string | null; account_id: string | null;
  customer_phone: string | null; customer_name: string | null; car_desc: string | null; placa: string | null; km_entrega: number | null;
  bound_at: string | null; activated_at: string | null; transfers: number; scans: number; last_scan_at: string | null; notes: string | null; created_at: string;
}
export const useTagsList = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["car-tags", dealership || null],
    queryFn: async () => (await callDealer("tags_list", dealership ? { dealership } : {})) as { tags: CarTag[]; resumo: { total: number; livres: number; vinculadas: number; ativas: number; scans: number }; logo_url: string | null },
    enabled,
  });
export const useTagsLogoSave = () =>
  useMutation({ mutationFn: async (p: { logo_url: string; dealership?: string }) => callDealer("tags_logo_save", p) });
export const useTagsCreate = () =>
  useMutation({ mutationFn: async (p: { qty: number; prefix?: string; dealership?: string }) => callDealer("tags_create", p) as Promise<{ batch: string; loja: string; app_url: string; tags: { id: string; label: string; token: string }[] }> });
export const useTagsBind = () =>
  useMutation({ mutationFn: async (p: { label: string; journey_id?: string; customer_phone?: string; customer_name?: string; car_desc?: string; placa?: string; km_entrega?: number; dealership?: string }) => callDealer("tags_bind", p) });
export const useTagsDeleteBatch = () =>
  useMutation({ mutationFn: async (p: { batch: string; dealership?: string }) => callDealer("tags_delete_batch", p) as Promise<{ apagadas: number; mantidas: number }> });
export const useTagsUnbind = () =>
  useMutation({ mutationFn: async (p: { label: string; dealership?: string }) => callDealer("tags_unbind", p) });

// Admin: saldo devedor de cortesias por loja + quitar
export const useSponsorBalance = (enabled: boolean) =>
  useQuery({
    queryKey: ["postsale-sponsor-balance"],
    queryFn: async () => (await callDealer("postsale_sponsor_balance")) as SponsorBalance,
    enabled,
  });

export const useSponsorSettle = () =>
  useMutation({
    mutationFn: async (dealership: string) => callDealer("postsale_sponsor_settle", { dealership }),
  });

export const usePostsaleConfigSave = () =>
  useMutation({
    mutationFn: async (p: { google_review_url?: string; nps_delay_days?: number; dealership?: string }) => callDealer("postsale_config_save", p),
  });

export const usePostsaleTransferSave = () =>
  useMutation({
    mutationFn: async (p: { id: string; transfer?: Record<string, boolean>; transfer_status?: string; warranty_until?: string | null; revisao_proxima?: string | null; dealership?: string }) =>
      callDealer("postsale_transfer_save", p),
  });

// ===== Campanhas (WhatsApp) =====
export type CampaignAudience = "all" | "due_soon" | "single" | "selected";

export interface CampaignRecipient {
  id: string;
  name: string | null;
  phone: string | null;
  vehicle: { marca: string | null; modelo: string | null; placa: string | null } | null;
  next_due: ClientNextDue | null;
}

export const useCampaignRecipients = (audience: CampaignAudience, clientId: string | null, enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["campaign-recipients", audience, clientId, dealership || null],
    queryFn: async () => {
      const data = await callDealer("campaign_recipients", { audience, client_id: clientId || undefined, dealership: dealership || undefined });
      return { count: data.count as number, recipients: (data.recipients || []) as CampaignRecipient[] };
    },
    enabled,
  });

export const useDraftMessage = () =>
  useMutation({
    mutationFn: async (brief: string) => {
      const data = await callDealer("draft_message", { brief });
      return data.message as string;
    },
  });

export const useSendCampaign = () =>
  useMutation({
    mutationFn: async (p: { audience: CampaignAudience; message: string; clientId?: string; clientIds?: string[]; dealership?: string }) => {
      const data = await callDealer("send_campaign", { audience: p.audience, message: p.message, client_id: p.clientId, client_ids: p.clientIds, dealership: p.dealership });
      return data as { total: number; sent: number; failed: number; results: { name: string; phone: string; ok: boolean }[] };
    },
  });

// ===== Pós-venda: atendimento com handoff (equipe, grupo, casos) =====
export type PapelEquipe = "vendedor" | "gerente_manutencao" | "gerente_geral";
export interface MembroEquipe { id: string; dealership: string; nome: string; phone: string; papel: PapelEquipe; ativo: boolean }
export interface PosvendaConfig { dealership: string; grupo_id: string | null; grupo_nome: string | null; sla_min: number; horario: Record<string, [string, string]> | null; ativo: boolean }
export interface PosvendaCaso {
  id: string; numero: number; dealership: string; customer_phone: string; customer_name: string | null; car_desc: string | null; placa: string | null;
  motivo: string; resumo: string | null; prioridade: "baixa" | "media" | "alta" | "urgente"; status: "aberto" | "em_atendimento" | "encerrado" | "cancelado";
  nivel: number; nivel_desde: string; assumido_at: string | null; encerrado_at: string | null; encerrado_por: string | null; nota: number | null;
  created_at: string; vendedor_nome: string | null; agente_nome: string | null;
}
export const usePosvenda = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["posvenda", dealership || null],
    queryFn: async () => (await callDealer("posvenda_get", dealership ? { dealership } : {})) as { config: PosvendaConfig; equipe: MembroEquipe[]; horario_texto: string; papeis: Record<string, string> },
    enabled,
  });
export const usePosvendaCasos = (enabled: boolean, filtro: "ativos" | "encerrados" | "todos", dealership?: string) =>
  useQuery({
    queryKey: ["posvenda-casos", filtro, dealership || null],
    queryFn: async () => (await callDealer("posvenda_casos", { filtro, ...(dealership ? { dealership } : {}) })) as { casos: PosvendaCaso[]; motivos: Record<string, string> },
    enabled,
    refetchInterval: 30_000,
  });
export const usePosvendaCaso = (id: string | null, dealership?: string) =>
  useQuery({
    queryKey: ["posvenda-caso", id, dealership || null],
    queryFn: async () => (await callDealer("posvenda_caso", { id, ...(dealership ? { dealership } : {}) })) as { caso: PosvendaCaso; mensagens: { de: string; autor: string | null; texto: string | null; midia: string | null; midia_tipo: string | null; midia_url: string | null; created_at: string }[] },
    enabled: !!id,
    refetchInterval: 15_000,
  });
export const usePosvendaAcao = () =>
  useMutation({ mutationFn: async (p: { action: string } & Record<string, unknown>) => { const { action, ...rest } = p; return callDealer(action, rest); } });

export interface PosvendaStats {
  dias: number; total: number; em_andamento: number; encerrados: number; oportunidades: number; oportunidades_ganhas: number; oportunidades_valor: number; min_ate_assumir: number | null; pct_primeiro_degrau: number | null;
  horas_ate_encerrar: number | null; nota_media: number | null; qtd_notas: number; vindos_do_nps: number;
  por_motivo: { motivo: string; n: number }[]; por_pessoa: { nome: string; casos: number; nota_media: number | null; min_ate_assumir: number | null }[];
}
export const usePosvendaStats = (enabled: boolean, dias: number, dealership?: string) =>
  useQuery({
    queryKey: ["posvenda-stats", dias, dealership || null],
    queryFn: async () => (await callDealer("posvenda_stats", { dias, ...(dealership ? { dealership } : {}) })) as PosvendaStats,
    enabled,
    refetchInterval: 60_000,
  });

export interface Oportunidade {
  id: string; numero: number; tipo: string; customer_phone: string; customer_name: string | null; car_desc: string | null;
  detalhe: string | null; status: "nova" | "em_contato" | "ganha" | "perdida"; valor: number | null; obs: string | null;
  vendedor_id: string | null; vendedor_nome: string | null; created_at: string;
}
export const usePosvendaOportunidades = (enabled: boolean, filtro: "abertas" | "todas", dealership?: string) =>
  useQuery({
    queryKey: ["posvenda-oport", filtro, dealership || null],
    queryFn: async () => (await callDealer("posvenda_oportunidades", { filtro, ...(dealership ? { dealership } : {}) })) as { oportunidades: Oportunidade[]; tipos: Record<string, string> },
    enabled,
    refetchInterval: 60_000,
  });
export interface RespostaLoja { id: string; pergunta: string; resposta: string; ativo: boolean }
export const usePosvendaRespostas = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["posvenda-respostas", dealership || null],
    queryFn: async () => ((await callDealer("posvenda_respostas", dealership ? { dealership } : {})).respostas || []) as RespostaLoja[],
    enabled,
  });

// ===== Preparação do carro antes da venda (troca de óleo/filtro + km) =====
export interface Preparacao {
  id: string; vehicle_id: string | null; car_desc: string | null; placa: string | null; data: string; km: number;
  oleo: boolean; oleo_tipo: string | null; filtro_oleo: boolean; filtro_ar: boolean; filtro_combustivel: boolean; filtro_cabine: boolean;
  intervalo_km: number; obs: string | null; feito_por: string | null; created_at: string;
}
export type TrocaOleoCliente = {
  user_id: string; nome: string | null; telefone: string | null; carro: string | null; placa?: string | null;
  status: "atrasada" | "vencida" | "proxima" | "em_dia" | "sem_ancora" | "sem_carro";
  ultima_troca?: { km: number; data: string } | null; km_hoje?: number; km_estimado?: boolean; leitura_dias?: number | null;
  proxima_km?: number | null; faltam_km?: number | null; data_limite?: string | null; vence_por?: "km" | "tempo" | null;
  ritmo_km_dia?: number; uso_severo?: boolean;
  km_controle?: { pedidos: number; respondidos: number; ignorados_seguidos: number; pendente_desde: string | null; reforco: boolean } | null;
};
export const useOficinaTrocas = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["oficina-trocas", dealership || null],
    queryFn: async () => {
      const r = await callDealer("oficina_trocas", dealership ? { dealership } : {});
      return { resumo: (r.resumo || {}) as Record<string, number>, lista: (r.lista || []) as TrocaOleoCliente[] };
    },
    enabled,
    staleTime: 5 * 60_000,
  });
export const usePreparacoes = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["preparacoes", dealership || null],
    queryFn: async () => ((await callDealer("preparacao_lista", dealership ? { dealership } : {})).preparacoes || []) as Preparacao[],
    enabled,
  });
