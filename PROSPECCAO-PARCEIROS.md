# Prospecção de parceiros pelo próprio Radar (1 a 1, sem disparo em massa)

A ferramenta de captação é o próprio Co-pilot: o Radar de Serviços já devolve nome, telefone e
WhatsApp dos estabelecimentos por categoria e cidade. A prospecção é manual, personalizada e
rastreada. Nada de lista fria, nada de disparo em massa (queima número na Meta e traz gente fria).

## A tática (o que funciona rápido)

1. **Categoria com urgência primeiro.** Guincho, socorro, borracharia, chaveiro, bateria: quem
   busca isso no Radar fecha na hora, e o dono do negócio sabe. Depois: pneus, troca de óleo,
   alinhamento, estética. Oficina mecânica por último (mais conversa, menos urgência).
2. **Uma cidade por vez.** Fecha 5 a 8 parceiros numa cidade antes de abrir outra. O Radar com
   parceiro na categoria "convence" o próximo parceiro da mesma cidade ("o guincho tal já está").
3. **Mensagem 1 a 1, com o nome do negócio e da cidade.** Nunca o mesmo texto cru para 50.
4. **Link personalizado.** O cadastro abre já preenchido com nome, categoria e cidade. O parceiro
   só confirma o WhatsApp e escolhe o benefício. Dois minutos, de verdade.
5. **Pedir indicação a cada aprovado.** "Conhece outro na região que faz guincho/borracharia?"
   Cada parceiro aprovado gera 1 ou 2 contatos quentes.
6. **Ritmo e rotação de números.** Até 25 primeiras mensagens por dia por número, intercalando os
   WhatsApps do celular, sempre com conversa de verdade (responder, agradecer). Isso mantém os
   números saudáveis. Follow-up só 1 vez, 48 h depois. Quem não respondeu em duas tentativas sai.
7. **Medir.** Cada número usa o seu `ref` no link (`?ref=zap1`, `?ref=zap2`…). O painel do admin
   mostra de onde veio cada cadastro (campo *source*).

Meta realista: 25 mensagens/dia → 8 a 12 respostas → 3 a 5 cadastros → 2 a 3 aprovados. Em duas
semanas, uma cidade inteira coberta nas categorias de urgência.

## O link personalizado

```
https://co-pilot.totexmotors.com/parceiro?ref=zap1&n=Guincho+do+Zé&cat=guincho&c=Santana+de+Parnaíba
```

| Parâmetro | O que faz |
|---|---|
| `ref` | identifica o número/pessoa que prospectou (vai para *source* no admin) |
| `n` | nome do negócio, já preenchido |
| `cat` | categoria (`guincho`, `borracharia`, `chaveiro`, `socorro`, `bateria`, `pneus`, `oleo`, `oficina`…) |
| `c` | cidade/bairro, já preenchido |
| `w` | WhatsApp do negócio (opcional, só dígitos) |

Encurtador: pode usar o próprio navegador do WhatsApp; o link longo funciona e o preenchimento
automático vale mais do que a estética do link.

## Mensagens (copiar, trocar o que está entre colchetes)

### 1ª mensagem — abertura (curta, pessoal, com prova)

```
Oi, [nome do negócio]! Aqui é o Marcos, da Totex Motors (lojas de carro em shopping,
Carapicuíba e Alphaville).

Nossos clientes usam um assistente no WhatsApp pra cuidar do carro, e quando alguém precisa
de [guincho] em [Santana de Parnaíba] ele mostra as opções perto. Hoje a [sua empresa] aparece
lá como resultado comum.

Quero colocar vocês como PARCEIRO: aparece primeiro, com selo, e o cliente já chega sabendo
que tem um benefício seu (tipo "10% na primeira visita" ou "diagnóstico grátis").

Não tem mensalidade nem taxa. Você só dá o benefício quando o cliente aparecer.

É grátis pra todo mundo, inclusive pros concorrentes, e ninguém paga pra subir: quem dá o
maior benefício fica no topo. Simples assim.

Cadastro leva 2 minutos, já deixei preenchido:
[link personalizado]

Faz sentido pra vocês?
```

### 2ª mensagem — follow-up (48 h depois, só se não respondeu)

```
[Nome], passando só pra não deixar a mensagem perdida.

Resumo: você entra de graça no radar do Co-pilot da Totex, aparece primeiro quando alguém
da região procura [guincho], e só dá o benefício se o cliente chegar.

Se preferir, me diz o benefício aqui mesmo que eu cadastro pra você.
```

### 3ª mensagem — quando respondeu com dúvida de custo

```
Zero custo, de verdade. A gente ganha quando o dono do carro usa o Co-pilot e volta na loja;
o parceiro ganha cliente novo. Por isso é grátis dos dois lados.

O único "custo" é o benefício que você mesmo escolhe. Pode ser pequeno: um check-up sem
custo, uma lavagem na revisão, 10% na primeira visita.
```

### 4ª mensagem — depois de aprovado (e pedido de indicação)

```
[Nome], aprovado! A [empresa] já aparece primeiro no radar de [guincho] em [cidade], com o
benefício "[benefício]". Seu código de resgate é [CÓDIGO]: o cliente fala ele no balcão.

Conhece alguém de confiança que faz [borracharia / chaveiro / socorro] por aí? Me passa o
contato que eu faço o mesmo convite.
```

## A regra do topo (o argumento que fecha)

- Grátis pra todo mundo, inclusive concorrentes. Ninguém paga pra subir, a gente não escolhe favorito.
- Até **3 por categoria e cidade** ficam no topo com selo. Entra quem declara o **maior benefício em
  reais** pro dono do carro.
- Depois de cada resgate o cliente responde "foi aplicado?". Quem não honra, desce.
- O parceiro vê a posição dele e muda o benefício quando quiser, pelo link
  `co-pilot.totexmotors.com/parceiro?code=CÓDIGO` (o código de resgate dele).
- Quando alguém reclamar que "não apareceu no topo": a resposta é a regra, não o favor.

## O que o admin mostra

- Cadastros pendentes com *source* (o `ref` do link): aprovar/rejeitar em um clique.
- Depois de aprovado: quantas vezes apareceu no Radar (*shown_count*) e quantos resgates
  (*redeem_count*). É o número que você manda pro parceiro no follow-up do mês seguinte.
