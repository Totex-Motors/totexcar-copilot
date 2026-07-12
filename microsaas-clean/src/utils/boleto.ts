// Decodifica a linha digitável de um boleto BANCÁRIO (47 dígitos) extraindo
// valor e vencimento. É best-effort: o usuário confirma os dados no formulário.
// (Boletos de concessionária/arrecadação — 48 dígitos — não são suportados aqui.)
export function decodeBoleto(raw: string): { valor: number | null; vencimento: string | null } {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length !== 47) return { valor: null, vencimento: null };

  // valor: últimos 10 dígitos do código de barras (posições 37-46 da linha) / 100
  const valorRaw = parseInt(d.substring(37, 47), 10);
  const valor = Number.isFinite(valorRaw) && valorRaw > 0 ? valorRaw / 100 : null;

  // fator de vencimento: 4 dígitos (posições 33-36 da linha)
  const fator = parseInt(d.substring(33, 37), 10);
  let vencimento: string | null = null;
  if (Number.isFinite(fator) && fator > 0) {
    const baseMs = Date.UTC(1997, 9, 7); // 07/10/1997
    const dayMs = 86400000;
    const cycle = 9000; // o fator cicla entre 1000 e 9999 (rollover FEBRABAN)
    const today = Date.now();
    // escolhe o ciclo que cai mais próximo de hoje/futuro (parcelas são recentes/futuras)
    for (let k = 0; k < 5; k++) {
      const due = baseMs + (fator + k * cycle) * dayMs;
      if (due > today - 60 * dayMs) {
        vencimento = new Date(due).toISOString().slice(0, 10);
        break;
      }
    }
  }
  return { valor, vencimento };
}
