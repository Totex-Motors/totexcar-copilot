# WhatsApp API OFICIAL (Meta / BM) — Guia de setup + Templates prontos

> Migração do Uazapi (não-oficial) para a **Meta Cloud API** (API oficial do WhatsApp Business).
> O sistema é **dual-provider**: a troca é feita no `/admin → Configurações → WhatsApp Oficial (Meta)`
> pelo seletor "Provedor ATIVO". Enquanto estiver em "uazapi", nada muda; ao virar para "meta",
> TODO o sistema (agente, alertas do cron, boas-vindas, campanhas) passa a usar a API oficial.
>
> Última atualização: 2026-07-16.

---

## 1. Por que templates?

Na API oficial existem 2 tipos de mensagem:

| Tipo | Quando | Como |
|---|---|---|
| **Sessão (24h)** | O CLIENTE mandou mensagem há menos de 24h | Texto livre, listas, botões — sem aprovação. É assim que o agente responde. |
| **Iniciada pelo negócio** | Fora da janela de 24h (cron, boas-vindas, campanha) | SÓ por **template pré-aprovado** no BM, com variáveis `{{1}}`, `{{2}}`... |

O código já faz essa separação sozinho: respostas do agente saem como sessão;
alertas/boas-vindas/campanhas saem pelos templates abaixo.

**Custo (Brasil, referência):** conversa de *utilidade* iniciada pelo negócio ≈ US$ 0,008; *marketing*
≈ US$ 0,0625. Conversas de *serviço* (cliente inicia) são gratuitas em volume generoso. Por isso
separar bem utilidade × marketing importa: além da regra, é 8x mais barato.

---

## 2. Passo a passo do BM (fazer 1 vez)

> ⭐ **Atalho (situação real da Totex):** a BM da TotexMotors JÁ é verificada (o CRM TotexGest já
> roda um número oficial nela). Então o passo 1 está FEITO — usar a MESMA BM. Regras de ouro:
> **NÃO reaproveitar o número do TotexGest** (os dois sistemas receberiam as mesmas mensagens e
> responderiam em dobro; a nota de qualidade é por número e um derrubaria o outro). O certo é
> **criar uma WABA separada pro Co-pilot dentro da mesma BM + 1 número novo dedicado** — webhook,
> templates e reputação isolados. O mesmo system user pode ter acesso às duas WABAs.
> (Defesa extra no código: o webhook ignora eventos de outro phone_number_id.)

1. **Business Manager verificado** — ✅ JÁ FEITO (BM TotexMotors, usada pelo TotexGest).
2. **Criar o app** — developers.facebook.com → Create App → tipo **Business** → adicionar o
   produto **WhatsApp** → vincular à BM TotexMotors (criar a WABA nova do Co-pilot).
3. **Número de telefone** — no painel WhatsApp do app, adicionar um **número NOVO** dedicado ao
   Co-pilot. ⚠️ O número NÃO pode estar registrado num WhatsApp comum/Business app ao mesmo tempo
   (o atual do Uazapi continua no ar durante a transição).
4. **Token permanente** — Configurações do negócio → **Usuários do sistema** → criar system user
   (admin) → gerar token com permissões `whatsapp_business_messaging` + `whatsapp_business_management`
   → guardar (é o **Token permanente** do /admin).
5. **IDs** — no painel WhatsApp → API Setup: copiar **Phone Number ID** e **WhatsApp Business
   Account ID (WABA ID)** → colar no /admin.
6. **Webhook** — painel WhatsApp → Configuration → Callback URL:
   `https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/whatsapp-webhook`
   Verify token: o que você definir no /admin (campo "Verify Token"). Clicar **Verify and save**
   (o webhook já responde ao desafio). Depois, em Webhook fields, assinar **messages**.
7. **Criar os templates** (seção 3 abaixo) — WhatsApp Manager → Account tools → **Message templates**
   → Create template → idioma **Português (BR)**. Aprovação típica: minutos a 48h por template.
8. **Virar a chave** — /admin → WhatsApp Oficial (Meta) → Provedor ATIVO = "Meta Cloud API" → Salvar.
   (Rollback: voltar para "uazapi" a qualquer momento.)

**Dica de transição:** os clientes seguem falando com o número antigo até você divulgar o novo.
Vale disparar UMA campanha no número antigo avisando o novo número + atualizar o `wa.me` do site
(PaymentSuccess/WhatsAppConnectCard usam o número central configurado).

---

## 3. TEMPLATES — copiar e colar no WhatsApp Manager

Regras que já apliquei em todos: nome em `snake_case`; idioma **pt_BR**; variáveis `{{n}}` nunca
no início/fim isoladas de contexto; **sem quebra de linha dentro de variável** (o código já sanitiza).
Na criação, o Meta pede um **exemplo** para cada variável — está na tabela de cada template.

### 3.1 Categoria UTILIDADE (transacional — mais barata, aprovação fácil)

**vencimento_documento**
```
🔔 Lembrete TotexCar Co-pilot: {{1}} {{2}} ({{3}}). Precisa de ajuda? É só responder por aqui.
```
| Var | Conteúdo | Exemplo |
|---|---|---|
| 1 | documento + veículo | o IPVA de Onix 2020 |
| 2 | situação | vence em 7 dias |
| 3 | data | 25/07/2026 |

**parcela_financiamento**
```
🔔 Parcela {{1}} do financiamento {{2}}, de {{3}}, {{4}} ({{5}}). {{6}}
```
| 1 | nº/total | 12/48 |
| 2 | banco | Safra |
| 3 | valor | R$ 1.250,00 |
| 4 | situação | vence HOJE |
| 5 | data | 20/07/2026 |
| 6 | linha digitável ou instrução | Linha digitável (copia e cola): 23793... |

**prazo_recurso_multa**
```
⚖️ O prazo para recorrer de {{1}} {{2}} ({{3}}). {{4}}
```
| 1 | multa + valor | excesso de velocidade (R$ 195,23) |
| 2 | situação | termina em 3 dias |
| 3 | data | 22/07/2026 |
| 4 | instrução | Seu recurso já está PRONTO no app: https://totexcarco-pilot.vercel.app/multas |

**assinatura_vencendo**
```
🔔 Sua assinatura do TotexCar Co-pilot vence {{1}} ({{2}}). Renove para não perder o acesso: {{3}}
```
| 1 | quando | em 3 dias |
| 2 | data | 20/07/2026 |
| 3 | link | https://totexcarco-pilot.vercel.app/plans |

**assinatura_vencida**
```
⚠️ Sua assinatura do TotexCar Co-pilot venceu. Para continuar registrando gastos, consumo e usando o assistente, renove em: {{1}}
```
| 1 | link | https://totexcarco-pilot.vercel.app/plans |

**cortesia_vencendo**
```
🔔 Seu ano de cortesia do TotexCar Co-pilot, oferecido pela {{1}}, termina {{2}} ({{3}}). Continue com o preço de membro de R$ 10,99/mês: {{4}}
```
| 1 | loja | Cardoso Veículos |
| 2 | quando | amanhã |
| 3 | data | 15/07/2027 |
| 4 | link | https://totexcarco-pilot.vercel.app/plans?coupon=CARDOSO90 |

**cortesia_vencida**
```
⚠️ Seu ano de cortesia do TotexCar Co-pilot, oferecido pela {{1}}, chegou ao fim. Continue com tudo (gastos, consumo, revisões e multas) por R$ 10,99/mês, preço de membro: {{2}}
```
| 1 | loja | Cardoso Veículos |
| 2 | link | https://totexcarco-pilot.vercel.app/plans?coupon=CARDOSO90 |

**resumo_pro_semanal**
```
📊 Resumo PRO da semana ({{1}}): faturou {{2}}, gastou {{3}}, resultado {{4}}. {{5}} Mande os prints de ganhos e os cupons que eu cuido do resto! 🚗
```
| 1 | período | 07/07/2026 a 13/07/2026 |
| 2 | receita | R$ 2.380,00 |
| 3 | despesa | R$ 940,00 |
| 4 | resultado | sobrou R$ 1.440,00 |
| 5 | linha do km | 🛣️ 1.240 km rodados, lucro de R$ 1,16 por km. |

**nps_pesquisa**
```
Oi {{1}}! Aqui é da {{2}}. 🙂 De 0 a 10, o quanto você recomendaria a {{2}} a um amigo? Responda só com o número. Sua resposta ajuda demais! 🙏
```
| 1 | nome | Renata |
| 2 | loja | Cardoso Veículos |

**boas_vindas_cortesia**
```
Olá {{1}}! 🎉 Obrigado por comprar seu {{2}} na {{3}}. Sua conta no TotexCar Co-pilot foi ativada com 1 ANO DE CORTESIA da loja: gastos, consumo, revisões, multas e mais, direto neste WhatsApp. Responda esta mensagem para começar. 🚗
```
| 1 | nome | Renata |
| 2 | carro | Nivus |
| 3 | loja | Cardoso Veículos |

> 💡 O "responda esta mensagem para começar" é estratégico: a resposta ABRE a janela de 24h e o
> agente passa a conversar em texto livre.

**transferencia_concluida**
```
✅ Boa notícia, {{1}}! A transferência de propriedade do seu {{2}} foi concluída pela {{3}}. Documentação em dia! Qualquer dúvida, é só responder por aqui. 🎉
```
| 1 | nome | Renata |
| 2 | carro | Nivus |
| 3 | loja | Cardoso Veículos |

**garantia_vencendo**
```
🛡️ A garantia do seu {{1}} (na {{2}}) vence {{3}} ({{4}}). Aproveite para fazer uma revisão ou checagem antes de vencer.
```
| 1 | carro | Nivus |
| 2 | loja | Cardoso Veículos |
| 3 | quando | em 10 dia(s) |
| 4 | data | 26/07/2026 |

**revisao_proxima**
```
🔧 A próxima revisão do seu {{1}} está chegando ({{2}}). Agende com a {{3}} para manter tudo em dia. 🚗
```
| 1 | carro | Nivus |
| 2 | data | 22/07/2026 |
| 3 | loja | Cardoso Veículos |

**transferencia_pendente_loja** *(vai pro LOJISTA)*
```
📄 Pós-venda {{1}}: a transferência de propriedade do cliente {{2}} ({{3}}) está pendente há {{4}} dias. Vale acompanhar para não travar. 🙏
```
| 1 | loja | Cardoso Veículos |
| 2 | cliente | Renata Parentel |
| 3 | carro | Nivus |
| 4 | dias | 18 |

**alerta_nps_loja** *(vai pro LOJISTA)*
```
⚠️ Alerta de pós-venda {{1}}: o cliente {{2}} avaliou a experiência com nota {{3}}. Contato: {{4}}. Vale um contato rápido para recuperar. 📞
```
| 1 | loja | Cardoso Veículos |
| 2 | cliente | Renata Parentel |
| 3 | nota | 4 |
| 4 | telefone | 11980292779 |

**chamado_suporte** *(vai pro DONO/Marco)*
```
🆘 Chamado de suporte ({{1}}): {{2}}, plano {{3}}. Assunto: {{4}}. Resumo: {{5}}. Ticket: {{6}}
```
| 1 | urgência | ALTA |
| 2 | cliente | João · joao@email.com · 11999998888 |
| 3 | plano | premium (active) |
| 4 | assunto | Pagamento não liberado |
| 5 | resumo | Pagou por PIX há 2h e segue bloqueado |
| 6 | ticket | a1b2c3d4 |

**pedido_recompra_loja** *(vai pro LOJISTA)*
```
🚗 Pedido de recompra na {{1}}: {{2}} avaliou o {{3}} pela tabela FIPE e pediu recompra por {{4}}. Contato: {{5}}. Veja os detalhes no Painel do Lojista.
```
| 1 | loja | Cardoso Veículos |
| 2 | cliente | Renata Parentel |
| 3 | carro | VW Nivus 2022 |
| 4 | oferta | R$ 98.500,00 (89% da FIPE R$ 110.674,00) |
| 5 | telefone | 11980292779 |

### 3.2 Categoria MARKETING (promocional — exige opt-out, mais cara)

**convite_copilot_loja** *(boas-vindas SEM cortesia — tem cupom/oferta → marketing)*
```
Olá {{1}}! 🎉 Obrigado por comprar {{2}} na {{3}}. Como nosso cliente, você tem acesso ao TotexCar Co-pilot, o assistente do seu carro no WhatsApp (gastos, consumo, revisões, multas e mais), com um bônus especial. Ative em: {{4}}
```
| 1 | nome | Renata |
| 2 | carro | seu Nivus |
| 3 | loja | Cardoso Veículos |
| 4 | link | https://totexcarco-pilot.vercel.app/entrar?tab=register&coupon=CARDOSO90 |

**radar_match** *(carro do desejo chegou — "back in stock" = marketing)*
```
🎯 Radar Totex: apareceu um carro que combina com o que você procura ({{1}}): {{2}} por {{3}}. Veja: {{4}} — Gostou? Responda que eu aviso a loja do seu interesse na hora. 😉
```
| 1 | desejo | Fiat Argo |
| 2 | carro | Fiat Argo Drive 1.3 2022, 45.000 km |
| 3 | preço | R$ 72.900 |
| 4 | link | https://totexmotors.com/veiculo/abc123?ref=XYZ |

**aniversario_compra**
```
🎉 Faz 1 ano que você comprou seu {{1}} na {{2}}! Obrigado pela confiança. Precisando de qualquer coisa com o carro, é só chamar. E se pensar em trocar, a gente te ajuda. 🚗
```
| 1 | carro | Nivus |
| 2 | loja | Cardoso Veículos |

**campanha_loja** *(campanhas do Painel do Lojista)*
```
Olá {{1}}! Mensagem da {{2}}: {{3}} Para não receber novidades da loja, responda SAIR.
```
| 1 | nome | Renata |
| 2 | loja | Cardoso Veículos |
| 3 | mensagem | A revisão do seu carro está com 20% de desconto esta semana. Agende já! |

> ⚠️ `campanha_loja` é o único template "coringa" (corpo variável). O Meta às vezes REJEITA
> templates com variável muito aberta. Se rejeitar: reenviar para análise com um exemplo bem
> concreto, ou criar 2-3 variações fixas (oferta_revisao, lembrete_vencimento_oferta, etc.).
> O opt-out ("responda SAIR") é obrigatório de política pra marketing.

---

## 4. O que já está pronto no código (não precisa mexer)

- `supabase/functions/_shared/wa.ts` — transporte dual + registry dos templates (fonte da verdade,
  com o texto equivalente enviado no modo uazapi).
- `whatsapp-webhook` — aceita os DOIS formatos de webhook (Uazapi e Meta), inclusive verificação
  GET (`hub.challenge`), mídia (foto/áudio/PDF) baixada pela Graph API, e respostas de lista interativa.
- `car-expiration-alerts` — todos os alertas do cron mapeados para os templates.
- `dealer-api` — boas-vindas (cortesia = utilidade / bônus = marketing), transferência concluída,
  campanhas via `campanha_loja`.
- `support-agent` e `buyback` — notificações por template.
- `/admin` — card "WhatsApp Oficial (Meta)" com o seletor de provider + credenciais.

## 5. Checklist da virada (D-day)

1. ☐ BM verificado, número novo ativo, token permanente gerado
2. ☐ Phone Number ID + WABA ID + Verify Token salvos no /admin
3. ☐ Webhook verificado no app do Meta (campo **messages** assinado)
4. ☐ Os 21 templates criados e **APROVADOS** (conferir no WhatsApp Manager)
5. ☐ Testar: mandar "oi" pro número novo → agente responde com menu
6. ☐ Testar template: registrar uma cortesia de teste → boas-vindas chega
7. ☐ /admin → Provedor ATIVO = **Meta Cloud API** → Salvar
8. ☐ Avisar clientes do número novo (campanha no número antigo) + atualizar wa.me do site
9. ☐ Uazapi fica de rollback por 30 dias; depois, cancelar
