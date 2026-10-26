import { useParams } from "react-router-dom";
import { setLinkToken } from "@/hooks/useDealer";
import { LinkShell } from "@/components/link/LinkShell";
import { PreparacaoTab } from "@/components/dealer/PreparacaoTab";
import { OrdensServico } from "@/components/oficina/OrdensServico";

// LINK DO GERENTE DE MANUTENÇÃO: /oficina/{token}. Sem login, só a oficina: preparação dos carros do
// estoque (troca de óleo, filtros e km antes da venda), os carros nas oficinas parceiras (ordens de
// serviço) e a agenda de trocas de óleo dos clientes.
export default function OficinaLink() {
  const { token = "" } = useParams();
  setLinkToken(token);
  return <LinkShell token={token} titulo="Oficina">{() => <><OrdensServico modo="gerente" /><PreparacaoTab trocasNoFim enviarOficina /></>}</LinkShell>;
}
