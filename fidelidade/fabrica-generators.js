/* Fábrica — geradores de LANDING e GUIA a partir da config de um cliente.
   Arquivo externo (não fica dentro de <script> do painel) pra poder conter
   <script>…</script> literais na saída sem quebrar o HTML do painel.
   Expõe window.buildLanding(cfg) e window.buildGuide(cfg). */
(function(){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function clamp(n){ return Math.max(0,Math.min(255,n)); }
  function darken(hex, amt){
    const h=String(hex||'#e8951b').replace('#',''); if(h.length<6) return hex;
    let r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
    r=clamp(Math.round(r*(1-amt))); g=clamp(Math.round(g*(1-amt))); b=clamp(Math.round(b*(1-amt)));
    return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function money(n){ const v=Number(n); return isFinite(v) ? v.toLocaleString('pt-BR') : String(n); }
  function waDigits(v){ return String(v||'').replace(/\D/g,''); }

  /* selo em chamas (svg) — mesmo desenho do app */
  const FIRE='<svg viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
  const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const WAICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>';

  /* ============================ LANDING ============================ */
  window.buildLanding = function(cfg){
    const s=cfg.settings||{}, b=s.brand||{}, L=cfg.landing||{};
    const tenant=cfg.tenant||'loja';
    const name=b.name||'Sua Loja', short=b.shortName||name;
    const ember=b.colorEmber||'#e8951b', flame=b.colorFlame||'#e01e1e', emberInk=darken(ember,0.32);
    const logo=b.logoImgLight||b.logoImg||'';
    const appUrl=(s.appUrl||'').trim().replace(/\/+$/,'')||'#';
    const totexWA=waDigits(L.totexWhatsapp)||'5511947448137';
    const addr=b.address||'';
    const goal=s.goal||10, reward=s.reward||'o prêmio';
    const hasCat=!!(s.capabilities&&s.capabilities.catalog&&s.capabilities.catalog.enabled);
    const hasSor=!!(s.capabilities&&s.capabilities.sorteios&&s.capabilities.sorteios.enabled);
    const asaas = L.checkout==='asaas';
    const freeNote = L.freeMonth ? ' · 1º mês grátis' : '';
    const heroTitle = (L.heroTitle||'').trim() || ('O Cartão Fidelidade da '+name+' já está no ar.');
    const heroText  = (L.heroText||'').trim() || ('O cartão de selos da '+short+' em versão digital: no celular, com '+(hasCat?'cardápio, ':'')+(hasSor?'sorteio ':'')+'indicação e prêmio. Não se perde, traz o cliente de volta e ainda faz ele indicar amigo.');

    // hero: cartão mockado (sem screenshot)
    const selos = Array.from({length:Math.min(goal,10)},(_,i)=>`<div class="slot ${i<6?'on':'off'}">${i<6?FIRE:''}</div>`).join('');
    const mark = logo ? `<img class="mark-img" src="${esc(logo)}" alt="${esc(name)}">`
                      : `<span class="mark-txt">${esc((b.initials||name.slice(0,2)).toUpperCase())}</span>`;

    // presente (opcional)
    const giftBadge = L.gift ? `<span class="gift">🎁 ${esc(L.giftText||'com um presente de boas-vindas')}</span>` : '';

    // features
    const feat = [
      ['🔥','Cartão de selos no celular', 'A cada compra, um selo. Complete '+goal+' e ganhe '+esc(reward)+' — igual ao de papel, só que não se perde.'],
      ['🤝','Cliente indica amigo', 'Cada cliente convida pelo WhatsApp e ganha +1 selo. Vira uma corrente que traz gente nova.'],
      [(hasCat||hasSor)?'📖':'⭐', (hasCat&&hasSor)?'Cardápio + sorteio no app':(hasCat?'Cardápio no app':(hasSor?'Sorteio no app':'Tudo num link só')),
        (hasCat&&hasSor)?'O cliente vê o cardápio com foto e preço, pede no WhatsApp e concorre a prêmios pelo sorteio.':(hasCat?'O cliente vê o cardápio com foto e preço e pede direto no WhatsApp.':(hasSor?'Cada selo é um número da sorte. Mais compras, mais chances no sorteio.':'Cartão, prêmio e indicação no mesmo link — sem instalar nada.'))],
      ['🏷️','QR e cartaz no balcão', 'Escaneia o QR e dá o selo em segundos. Tem cartaz pra imprimir e deixar no balcão.']
    ].map(f=>`<div class="ec"><div class="ic">${f[0]}</div><div><b>${esc(f[1])}</b><p>${esc(f[2])}</p></div></div>`).join('');

    // planos
    const tiers = (L.plans||[]).map(p=>{
      const hot=!!p.hot;
      const waMsg='Oi! Sou da '+name+'. Quero assinar o plano '+(p.name||'')+' (R$ '+money(p.price)+'/mês).';
      const cls = (hot?'btn pri':'btn ghost') + (asaas?' co wa':' wa');
      const dp = asaas ? ' data-plan="'+esc(p.key||'')+'"' : '';
      return `<div class="tier ${hot?'hot':''}">
        ${hot?'<span class="tag">Mais indicado</span>':''}
        <span class="tname">${esc(p.name||'')}</span>
        ${p.cap?`<span class="cap">${esc(p.cap)}</span>`:''}
        <span class="price">R$ ${money(p.price)}<small> /mês${freeNote}</small></span>
        <a class="${cls}"${dp} data-msg="${esc(waMsg)}" href="https://wa.me/${totexWA}" target="_blank" rel="noopener">Assinar ${esc(p.name||'')}</a>
      </div>`;
    }).join('');

    const guideCard = L.guideLink ? `
      <section style="padding-top:8px">
        <div class="eyebrow">Rapidinho</div>
        <h2 style="margin-bottom:18px">Como usar no dia a dia</h2>
        <a class="guiacard" href="${esc(tenant)}-guia.html">
          <span class="gic">📖</span>
          <span class="gtx"><b>Veja o guia com as telas numeradas</b><p>Passo a passo pra ${esc(name)}: dar selo, ${hasCat?'montar o cardápio, ':''}${hasSor?'rodar o sorteio ':''}e como o cliente usa o cartão.</p></span>
          <span class="btn ghost" style="pointer-events:none">Abrir o guia ${ARROW}</span>
        </a>
      </section>` : '';

    const giftSection = L.gift ? `
      <section>
        <div class="giftbox">
          <div class="giftic">🎁</div>
          <div><b>Um presente pra começar</b><p>${esc(L.giftText||'Pra estrear com o pé direito, o primeiro passo é por nossa conta.')}</p></div>
        </div>
      </section>` : '';

    const checkoutScript = asaas ? `
  var CO='${SB_CO()}';
  document.querySelectorAll('a.co[data-plan]').forEach(function(a){
    a.addEventListener('click',function(ev){
      ev.preventDefault();
      var plan=a.getAttribute('data-plan'), wa=a.href, old=a.textContent;
      a.style.pointerEvents='none'; a.textContent='Abrindo checkout…';
      var back=function(){ window.open(wa,'_blank'); a.style.pointerEvents=''; a.textContent=old; };
      fetch(CO,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:plan,cycle:'monthly',tenant:'${esc(tenant)}'})})
        .then(function(r){return r.json();}).then(function(d){ if(d&&d.ok&&d.url){window.location.href=d.url;} else {back();} }).catch(back);
    });
  });` : '';

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} · seu Cartão Fidelidade</title>
<meta name="description" content="O Cartão Fidelidade digital da ${esc(name)} já está no ar — cartão de selos${hasCat?', cardápio':''}${hasSor?', sorteio':''} e indicação no celular.">
<meta name="theme-color" content="${esc(flame)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%94%A5</text></svg>">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(name)} · seu Cartão Fidelidade">
<meta property="og:description" content="O Cartão Fidelidade digital da ${esc(name)} já está no ar.">
${logo?`<meta property="og:image" content="${esc(logo)}">`:''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Spline+Sans+Mono:wght@500;600&display=swap">
<style>
  :root{
    --paper:#f6f0e6; --card:#fffdf8; --ink:#221810; --ink-2:#5c4b3a; --ink-3:#8a7862;
    --line:#e4d8c3; --line-2:#cdbb9c; --ember:${ember}; --ember-ink:${emberInk}; --flame:${flame}; --good:#4f7a3a;
    --disp:'Bricolage Grotesque',system-ui,'Segoe UI',sans-serif; --body:'Newsreader',Georgia,serif; --mono:'Spline Sans Mono',ui-monospace,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;background:var(--paper)}
  body{background:var(--paper);color:var(--ink);font-family:var(--body);font-size:18px;line-height:1.62;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  svg{display:block}
  .wrap{max-width:1060px;margin:0 auto;padding:0 28px}
  .btn{font-family:var(--mono);font-weight:600;font-size:14px;padding:14px 24px;border-radius:12px;border:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;max-width:100%;white-space:normal;text-align:center;transition:transform .15s,box-shadow .2s}
  .btn svg{width:17px;height:17px;flex:none}
  .btn.pri{background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;box-shadow:0 10px 26px -8px rgba(0,0,0,.28)}
  .btn.pri:hover{transform:translateY(-2px)}
  .btn.ghost{background:var(--card);color:var(--ink);border:1.5px solid var(--line-2)}
  .btn.ghost:hover{transform:translateY(-2px);border-color:var(--ember)}
  .btn.wapp{background:rgba(79,122,58,.1);color:var(--good);border:1.5px solid rgba(79,122,58,.3)}
  .btn.lg{padding:17px 30px;font-size:15px}
  .top{border-bottom:1px solid var(--line)}
  .topin{max-width:1060px;margin:0 auto;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .brand{display:flex;align-items:center;gap:11px;font-family:var(--disp);font-weight:800;font-size:17px}
  .mark-img{height:36px;width:auto;border-radius:8px;box-shadow:0 5px 14px rgba(0,0,0,.15);flex:none}
  .mark-txt{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9px;background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;font-family:var(--disp);font-weight:800;font-size:15px}
  .brand small{display:block;font-family:var(--mono);font-size:9px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);margin-top:2px}
  .topcta{padding:11px 18px;font-size:13px}
  .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;padding:56px 0 48px}
  .live-badge{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--flame);background:rgba(0,0,0,.04);border:1px solid var(--line-2);padding:8px 15px;border-radius:100px;margin-bottom:22px}
  .live-badge .dot{width:8px;height:8px;border-radius:50%;background:var(--good)}
  h1{font-family:var(--disp);font-weight:800;font-size:clamp(34px,5.2vw,52px);line-height:1.02;letter-spacing:-.025em;text-wrap:balance}
  h1 em{font-style:normal;color:var(--flame)}
  .dek{font-size:19px;color:var(--ink-2);margin-top:20px;max-width:44ch;line-height:1.5}
  .gift{display:inline-flex;align-items:center;gap:8px;margin-top:16px;font-family:var(--mono);font-size:13px;font-weight:600;color:var(--ember-ink);background:rgba(0,0,0,.04);border:1px dashed var(--line-2);padding:8px 14px;border-radius:100px}
  .hcta{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
  .phone-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}
  .phone{width:290px;max-width:82vw;background:linear-gradient(160deg,#2a1210,#120807);border-radius:38px;padding:12px;box-shadow:0 40px 80px -30px rgba(0,0,0,.5)}
  .screen{border-radius:27px;overflow:hidden;background:#fffdf8;padding:20px 18px 24px}
  .sc-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
  .sc-head .h-nm{font-family:var(--disp);font-weight:800;font-size:15px;flex:1}
  .sc-card{background:linear-gradient(160deg,#1b100b,#0d0705);border-radius:16px;padding:16px;color:#f6ead9}
  .sc-code{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:#c9a67e}
  .sc-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:12px 0 8px}
  .slot{aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .slot.on{background:radial-gradient(circle at 40% 30%,#ffbf66,var(--ember) 58%,var(--ember-ink))}
  .slot.on svg{width:11px;height:11px;fill:#fff}
  .slot.off{border:1.4px dashed rgba(255,255,255,.28)}
  .sc-miss{font-family:var(--mono);font-size:10px;color:#c9a67e;text-align:center}
  section{padding:52px 0}
  .eyebrow{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ember-ink);display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .eyebrow::before{content:"";width:26px;height:2px;background:var(--ember)}
  h2{font-family:var(--disp);font-weight:800;font-size:clamp(26px,4vw,36px);line-height:1.06;letter-spacing:-.02em;text-wrap:balance}
  .ess{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:30px}
  .ec{background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:22px;display:flex;gap:15px;align-items:flex-start}
  .ec .ic{width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,.04);display:flex;align-items:center;justify-content:center;flex:none;font-size:22px}
  .ec b{font-family:var(--disp);font-weight:700;font-size:17px;display:block;margin-bottom:4px}
  .ec p{color:var(--ink-2);font-size:15px;line-height:1.45}
  .giftbox{display:flex;gap:18px;align-items:center;background:var(--card);border:1.5px solid var(--line-2);border-radius:18px;padding:24px 26px}
  .giftbox .giftic{font-size:34px}
  .giftbox b{font-family:var(--disp);font-weight:800;font-size:20px;display:block;margin-bottom:3px}
  .giftbox p{color:var(--ink-2);font-size:15.5px}
  .guiacard{display:flex;align-items:center;gap:22px;background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:26px 28px;flex-wrap:wrap;transition:.15s}
  .guiacard:hover{transform:translateY(-2px);border-color:var(--ember)}
  .guiacard .gic{font-size:34px;flex:none}
  .guiacard .gtx{flex:1;min-width:200px}
  .guiacard b{font-family:var(--disp);font-weight:800;font-size:20px;display:block;margin-bottom:4px}
  .guiacard p{color:var(--ink-2);font-size:15.5px}
  .why{background:var(--card);border:1.5px solid var(--line-2);border-radius:16px;padding:24px 26px;margin-top:26px;color:var(--ink-2);font-size:16.5px;line-height:1.55}
  .why b{color:var(--ink);font-weight:500}
  .tiers{display:grid;grid-template-columns:repeat(${Math.min((L.plans||[]).length||3,3)},1fr);gap:18px;margin-top:22px;align-items:stretch}
  @media(max-width:760px){.tiers{grid-template-columns:1fr}}
  .tier{background:var(--card);border:1.5px solid var(--line-2);border-radius:18px;padding:28px 24px;display:flex;flex-direction:column;gap:7px;position:relative}
  .tier.hot{border-color:var(--ember);box-shadow:0 0 0 3px rgba(0,0,0,.05)}
  .tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;padding:5px 14px;border-radius:100px;white-space:nowrap}
  .tname{font-family:var(--disp);font-weight:700;font-size:19px}
  .cap{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ember-ink);background:rgba(0,0,0,.04);padding:5px 11px;border-radius:8px;align-self:flex-start;margin-top:2px}
  .price{font-family:var(--disp);font-weight:800;font-size:36px;line-height:1;margin:10px 0 2px}
  .price small{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--ink-3)}
  .tier .btn{margin-top:auto;width:100%}
  .plnote{text-align:center;font-family:var(--mono);font-size:13px;color:var(--ink-2);margin-top:22px}
  .plnote b{color:var(--ember-ink)}
  .final{text-align:center;background:var(--card);border:1.5px solid var(--line-2);border-radius:24px;padding:52px 32px;margin-top:8px}
  .final p{color:var(--ink-2);font-size:18px;margin:14px auto 0;max-width:46ch}
  .final .hcta{justify-content:center;margin-top:28px}
  footer{border-top:1px solid var(--line);margin-top:52px;padding:36px 0 48px;text-align:center}
  footer .sig{font-family:var(--disp);font-weight:700;font-size:18px}
  footer .ad{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin-top:8px}
  @media(max-width:860px){.hero{grid-template-columns:1fr;gap:36px;text-align:center;padding:40px 0 44px}.hero .live-badge,.hero .gift{margin-left:auto;margin-right:auto}.dek{margin-left:auto;margin-right:auto}.hcta{justify-content:center}.phone-wrap{order:-1}.ess{grid-template-columns:1fr}}
  @media(max-width:520px){.wrap{padding:0 20px}.topin{padding:14px 20px}.brand{font-size:15px}.mark-img{height:30px}.topcta{padding:10px}.topcta .lbl{display:none}.hcta .btn{width:100%}.final{padding:40px 22px}}
</style>
</head>
<body>
<div class="top"><div class="topin">
  <div class="brand">${mark}Cartão Fidelidade<small>${esc(short)} · por Totex</small></div>
  <a class="btn wapp wa topcta" data-msg="Oi! Sou da ${esc(name)}. Vi a página do meu Cartão Fidelidade." href="https://wa.me/${totexWA}" target="_blank" rel="noopener">${WAICON}<span class="lbl">Falar no WhatsApp</span></a>
</div></div>

<div class="wrap">
  <div class="hero">
    <div>
      <span class="live-badge"><span class="dot"></span> Já está no ar</span>
      <h1>${esc(heroTitle).replace(/\s*no ar\.?\s*$/i,' <em>no ar.</em>')}</h1>
      <p class="dek">${esc(heroText)}</p>
      ${giftBadge}
      <div class="hcta">
        <a class="btn pri lg" href="${esc(appUrl)}" target="_blank" rel="noopener">Ver o cartão funcionando ${ARROW}</a>
        <a class="btn ghost lg" href="#planos">Ver os planos</a>
      </div>
    </div>
    <div class="phone-wrap">
      <div class="phone"><div class="screen">
        <div class="sc-head">${mark}<div class="h-nm">${esc(short)}</div></div>
        <div class="sc-card">
          <div class="sc-code">SEU CARTÃO · ${esc((b.prefix||'LC').toUpperCase())}-0007</div>
          <div class="sc-slots">${selos}</div>
          <div class="sc-miss">Faltam ${Math.max(goal-6,0)} pra ganhar 🔥</div>
        </div>
      </div></div>
      <span style="font-family:var(--mono);font-size:11px;color:var(--ink-3)">a tela do cartão · toque em "ver funcionando"</span>
    </div>
  </div>

  <section>
    <div class="eyebrow">O essencial</div>
    <h2>O que ele faz pela ${esc(name)}</h2>
    <div class="ess">${feat}</div>
  </section>
  ${giftSection}
  ${guideCard}

  <section id="planos">
    <div class="eyebrow">Pra manter no ar</div>
    <h2>Os planos</h2>
    <div class="why">Pra ser 100% transparente: o cartão vive num <b>servidor</b> e num <b>banco de dados na nuvem</b>, com um custo mensal pra ficar sempre no ar, seguro e atualizado. Sem fidelidade: <b>cancela quando quiser</b>.</div>
    <div class="tiers">${tiers}</div>
    <p class="plnote"><b>Sem fidelidade</b> · cancela quando quiser${asaas?' · pagamento no PIX ou cartão':' · fale comigo no WhatsApp pra assinar'}</p>
  </section>

  <section>
    <div class="final">
      <div class="eyebrow" style="justify-content:center">Bora começar</div>
      <h2>Abra o cartão e veja o fogo pegar 🔥</h2>
      <p>Tá tudo pronto. Abra no celular, teste, e qualquer coisa me chama no WhatsApp.</p>
      <div class="hcta">
        <a class="btn pri lg" href="${esc(appUrl)}" target="_blank" rel="noopener">Ver o cartão funcionando ${ARROW}</a>
        <a class="btn wapp lg wa" data-msg="Oi! Sou da ${esc(name)}. Quero falar sobre o Cartão Fidelidade." href="https://wa.me/${totexWA}" target="_blank" rel="noopener">${WAICON}Falar comigo</a>
      </div>
    </div>
  </section>
</div>

<footer><div class="wrap">
  <p class="sig">🔥 Feito com carinho pra ${esc(name)}</p>
  <p class="ad">${addr?esc(addr)+' · ':''}Cartão Fidelidade por Totex</p>
</div></footer>

<script>
(function(){
  var WA='https://wa.me/${totexWA}';
  document.querySelectorAll('a.wa[data-msg]').forEach(function(a){ a.href=WA+'?text='+encodeURIComponent(a.getAttribute('data-msg')); });${checkoutScript}
})();
</script>
</body>
</html>`;
  };

  function SB_CO(){ return 'https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/fidelidade-checkout'; }

  /* ============================ GUIA ============================ */
  window.buildGuide = function(cfg){
    const s=cfg.settings||{}, b=s.brand||{}, tenant=cfg.tenant||'loja';
    const name=b.name||'Sua Loja', short=b.shortName||name, pfx=(b.prefix||'LC').toUpperCase();
    const ember=b.colorEmber||'#e8951b', flame=b.colorFlame||'#e01e1e', emberInk=darken(ember,0.32);
    const goal=s.goal||10, reward=s.reward||'o prêmio';
    const hasCat=!!(s.capabilities&&s.capabilities.catalog&&s.capabilities.catalog.enabled);
    const hasSor=!!(s.capabilities&&s.capabilities.sorteios&&s.capabilities.sorteios.enabled);
    const sor=(s.capabilities&&s.capabilities.sorteios)||{};
    const igHandle=(b.instagramHandle||'').replace(/^@/,'');
    const on6 = Array.from({length:Math.min(goal,10)},(_,i)=>`<div class="asel ${i<6?'on':'off'}">${i<6?FIRE:''}</div>`).join('');

    function screen(deviceInner, tt, td, legend){
      return `<div class="screen-row"><div class="device"><div class="app">${deviceInner}</div></div>
        <div><div class="tt">${esc(tt)}</div><div class="td">${esc(td)}</div><ul class="legend">${legend}</ul></div></div>`;
    }
    function li(n,t,p){ return `<li><span class="lnum">${n}</span><div><b>${esc(t)}</b><p>${p}</p></div></li>`; }

    // telas do dono
    let ownerScreens='';
    ownerScreens += screen(
      `<div class="bar">Novo cliente <span class="tag">ADMIN</span></div><div class="body">
        <div class="fld"><span class="pin" style="top:16px;right:-10px">1</span><label>Nome</label><div class="inp">Maria Souza</div></div>
        <div class="fld"><span class="pin" style="top:16px;right:-10px">2</span><label>WhatsApp</label><div class="inp">(11) 99999-0000</div></div>
        <div class="fld"><span class="pin" style="top:16px;right:-10px">3</span><label>Voucher de indicação (opcional)</label><div class="inp ph">${esc(pfx)}-0007</div></div>
        <div class="abtn pri" style="margin:14px 0 9px"><span class="pin" style="top:-9px;right:-9px">4</span>Cadastrar cliente</div>
        <div class="abtn sec"><span class="pin" style="top:-9px;right:-9px">5</span>📲 Enviar cartão no WhatsApp</div>
      </div>`,
      'Cadastrar um cliente','A porta de entrada. Leva segundos e já manda o cartão pro cliente.',
      li(1,'Nome','Como o cliente aparece na busca e no cartão dele.')+
      li(2,'WhatsApp','Pra localizar o cliente pelo telefone e enviar o cartão. É a "chave" dele.')+
      li(3,'Voucher de indicação','Só quando o cliente veio indicado: o código de quem indicou. Dá <b>+1 selo</b> pra quem trouxe.')+
      li(4,'Cadastrar cliente','Salva e gera o código automático ('+esc(pfx)+'-0001, '+esc(pfx)+'-0002…).')+
      li(5,'Enviar cartão','Abre o WhatsApp com a mensagem e o link prontos.'));

    ownerScreens += screen(
      `<div class="bar">Ficha do cliente <span class="tag">ADMIN</span></div><div class="body">
        <div class="as-head" style="position:relative"><span class="pin" style="top:-4px;right:-10px">1</span><div class="nm">Maria Souza</div><div class="cd">${esc(pfx)}-0008</div></div>
        <div class="counter" style="position:relative"><span class="pin" style="top:-6px;right:64px">2</span>6 de ${goal} selos</div>
        <div class="aselos">${on6}</div>
        <div class="row2" style="margin-bottom:8px"><div class="abtn pri" style="position:relative"><span class="pin" style="top:-9px;right:-9px">3</span>🔥 +1 selo</div><div class="abtn sec" style="position:relative"><span class="pin" style="top:-9px;right:-9px">4</span>↩ Desfazer</div></div>
        <div class="abtn good" style="position:relative"><span class="pin" style="top:-9px;right:-9px">5</span>🏆 Entregar prêmio e zerar</div>
      </div>`,
      'Dar selo e entregar prêmio','A tela que você mais usa. Cada compra = um selo, aqui.',
      li(1,'Código e nome','Confirma que é o cliente certo antes de dar o selo.')+
      li(2,'Selos','Quanto ele já juntou (de '+goal+'). Acesas = selos; apagadas = o que falta.')+
      li(3,'🔥 +1 selo','Cliente comprou → toque aqui. O fogo carimba na hora.')+
      li(4,'↩ Desfazer','Deu selo errado? Remove o último. Tudo fica no histórico.')+
      li(5,'🏆 Entregar prêmio','Aparece ao completar '+goal+'. Entrega '+esc(reward)+' e zera o cartão.'));

    if(hasCat) ownerScreens += screen(
      `<div class="bar">Painel <span class="tag">ADMIN</span></div><div class="body">
        <div class="subtabs"><span>Balcão</span><span class="on">🍗 Cardápio</span><span>Ajustes</span></div>
        <div class="fld"><label>Nome</label><div class="inp">Combo Família</div></div>
        <div class="fld"><span class="pin" style="top:16px;right:-10px">1</span><label>Preço (R$)</label><div class="inp">89,90</div></div>
        <div class="fld"><label>Foto</label><div class="cf-photo"><div class="cf-prev">🍖</div><div class="cf-pick" style="position:relative"><span class="pin" style="top:-9px;right:-9px">2</span>📷 Enviar foto</div></div></div>
        <div class="abtn pri" style="position:relative"><span class="pin" style="top:-9px;right:-9px">3</span>Salvar produto</div>
      </div>`,
      'Montar o cardápio','Na aba 🍗 Cardápio você cria os pratos com preço e foto — é o que o cliente vê no app.',
      li(1,'Nome e preço','O essencial. Preço aceita vírgula (39,90). Categoria organiza (pode deixar vazia).')+
      li(2,'📷 Enviar foto','Escolhe uma foto do celular; vira a miniatura do prato.')+
      li(3,'Salvar produto','Guarda na nuvem e já aparece pro cliente na hora.'));

    if(hasSor) ownerScreens += screen(
      `<div class="bar">Ajustes · Sorteio <span class="tag">ADMIN</span></div><div class="body">
        <div class="chk" style="position:relative"><span class="pin" style="top:-8px;left:-6px">1</span><span class="box">✓</span> Sorteio ativo</div>
        <div class="fld"><span class="pin" style="top:16px;right:-10px">2</span><label>Prêmio</label><div class="inp">${esc(sor.prize||'um combo')}</div></div>
        <div class="fld"><span class="pin" style="top:16px;right:-10px">3</span><label>Data / período</label><div class="inp">${esc(sor.drawAt||'todo fim de mês')}</div></div>
        <div class="abtn pri" style="margin-bottom:8px;position:relative"><span class="pin" style="top:-9px;right:-9px">4</span>Salvar sorteio</div>
        <div class="abtn sec" style="position:relative"><span class="pin" style="top:-9px;right:-9px">5</span>🎲 Sortear ganhador</div>
      </div>`,
      'Configurar e rodar o sorteio','Você decide o prêmio e a data. Na hora, o app sorteia sozinho entre quem tem selos.',
      li(1,'Sorteio ativo','Ligado, o bloco do sorteio aparece no cartão de cada cliente.')+
      li(2,'Prêmio','O que vai ser sorteado. Aparece pro cliente como "Concorra a…".')+
      li(3,'Data / período','Quando será — uma data ou um período.')+
      li(4,'Salvar sorteio','Guarda e atualiza no cartão dos clientes.')+
      li(5,'🎲 Sortear ganhador','No dia, sorteia na hora dando mais chance a quem tem mais selos.'));

    ownerScreens += screen(
      `<div class="bar">Ajustes <span class="tag">ADMIN</span></div><div class="body">
        <div class="fld"><span class="pin" style="top:16px;right:-10px">1</span><label>Selos para o prêmio</label><div class="inp">${goal}</div></div>
        <div class="fld"><span class="pin" style="top:16px;right:-10px">2</span><label>Prêmio</label><div class="inp">${esc(reward)}</div></div>
        <div class="abtn sec" style="margin-bottom:8px;position:relative"><span class="pin" style="top:-9px;right:-9px">3</span>🔑 Trocar PIN</div>
        <div class="abtn pri" style="position:relative"><span class="pin" style="top:-9px;right:-9px">4</span>🖨️ Imprimir cartaz do balcão</div>
      </div>`,
      'Ajustes e cartaz','Configura uma vez e esquece. Backup e cartaz ficam aqui.',
      li(1,'Selos para o prêmio','Quantos selos fecham o cartão. Padrão: '+goal+'.')+
      li(2,'Prêmio','O que o cliente ganha ao completar — aparece no cartão dele.')+
      li(3,'Trocar PIN','Muda a senha de 6 dígitos do Admin.')+
      li(4,'Imprimir cartaz','Gera um cartaz A4 com o QR e a regra pra colar no balcão.'));

    // cliente
    let clientScreens = screen(
      `<div class="bar" style="justify-content:center">${esc(short)}</div><div class="body">
        <div class="as-head"><div class="cd">SEU CARTÃO · ${esc(pfx)}-0008</div></div>
        <div class="counter" style="position:relative;margin-top:8px"><span class="pin" style="top:-6px;right:44px">1</span>6 de ${goal} selos</div>
        <div class="aselos">${on6}</div>
        <div class="vch" style="position:relative;margin:8px 0"><span class="pin" style="top:-9px;right:-9px">2</span>${esc(pfx)}-0008</div>
        <div class="abtn pri" style="position:relative"><span class="pin" style="top:-9px;right:-9px">3</span>🤝 Convidar amigo (+1 selo)</div>
        ${igHandle?`<div class="abtn ig" style="margin-top:8px;position:relative"><span class="pin" style="top:-9px;right:-9px">4</span>📸 Siga no Instagram</div>`:''}
        ${hasSor?`<div class="lucky" style="position:relative"><span class="pin" style="top:-9px;right:-9px">${igHandle?5:4}</span><div class="tt2">🎟️ Sorteio ${esc(short)}</div><div class="num">6</div><div class="lb">números da sorte</div></div>`:''}
      </div>`,
      'O cartão do cliente','É o que ele vê no celular. Bonito, animado e impossível de perder.',
      li(1,'Seus selos','As bolinhas acesas são os selos. Ele mostra essa tela no balcão a cada compra.')+
      li(2,'Código de indicação','O voucher dele. Quando um amigo usa na 1ª compra, ele ganha +1 selo.')+
      li(3,'Convidar amigo','Abre o WhatsApp com o convite pronto.')+
      (igHandle?li(4,'Siga no Instagram','Leva direto pro Instagram'+(igHandle?' (@'+esc(igHandle)+')':'')+'.'):'')+
      (hasSor?li(igHandle?5:4,'Sorteio','Cada selo vira um número da sorte. Mais compras, mais chances.'):''));

    if(hasCat) clientScreens += screen(
      `<div class="bar">Cardápio</div><div class="body">
        <div class="cat-item" style="position:relative"><span class="pin" style="top:-8px;left:30px">1</span><div class="cat-thumb">🍗</div><div class="cat-info"><div class="nm">Frango assado</div><div class="pr">R$ 39,90</div></div></div>
        <div class="cat-item"><div class="cat-thumb">🍖</div><div class="cat-info"><div class="nm">Combo Família</div><div class="pr">R$ 89,90</div></div></div>
        <div class="abtn good" style="margin-top:10px;position:relative"><span class="pin" style="top:-9px;right:-9px">2</span>🛒 Pedir no WhatsApp</div>
      </div>`,
      'O cardápio no app','O cliente toca em "Ver o cardápio" e vê tudo — com foto, preço e pedido pronto.',
      li(1,'Os pratos','Cada item mostra foto, nome e preço que você cadastrou. Atualiza sozinho.')+
      li(2,'Pedir no WhatsApp','Abre seu WhatsApp com o pedido montado. O cliente só confirma.'));

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guia de uso · Cartão Fidelidade da ${esc(name)}</title>
<meta name="robots" content="index">
<meta name="theme-color" content="${esc(flame)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%94%A5</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Spline+Sans+Mono:wght@500;600&display=swap">
<style>
  :root{--bg:#f6f0e6;--bg-2:#efe7d6;--surface:#fffdf8;--ink:#221810;--ink-2:#5c4b3a;--ink-3:#8a7862;--line:#e4d8c3;--line-2:#cdbb9c;--ember:${ember};--flame:${flame};--amber:${emberInk};--good:#4f7a3a;--disp:'Bricolage Grotesque',system-ui,sans-serif;--body:'Newsreader',Georgia,serif;--mono:'Spline Sans Mono',ui-monospace,monospace;--app:#fffdf8;--app-2:#f4ece0;--app-ink:#241a12;--app-line:#e6dac6}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;background:var(--bg)}
  body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  svg{display:block}
  .wrap{max-width:1080px;margin:0 auto;padding:0 32px}
  .top{position:sticky;top:0;z-index:50;background:rgba(246,240,230,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
  .topin{max-width:1080px;margin:0 auto;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;gap:14px}
  .brand{display:flex;align-items:center;gap:11px;font-family:var(--disp);font-weight:800;font-size:17px}
  .mark-img{height:32px;border-radius:8px}
  .mark-txt{width:34px;height:34px;border-radius:9px;background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
  .back{font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--amber)}
  .hero{padding:56px 0 8px;text-align:center}
  .kick{font-family:var(--mono);font-size:11.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--ember);margin-bottom:14px}
  h1{font-family:var(--disp);font-weight:800;font-size:clamp(32px,6vw,54px);line-height:1.02;letter-spacing:-.03em;text-wrap:balance}
  h1 .grad{color:var(--flame)}
  .lead{font-size:19px;color:var(--ink-2);max-width:58ch;margin:18px auto 0}
  section{padding:56px 0}
  .part-h{display:flex;align-items:center;gap:16px;margin-bottom:6px}
  .part-h .bd{width:52px;height:52px;border-radius:15px;background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;display:flex;align-items:center;justify-content:center;flex:none;font-size:24px}
  h2{font-family:var(--disp);font-weight:800;font-size:clamp(26px,4vw,38px);letter-spacing:-.02em}
  .part-sub{color:var(--ink-2);font-size:17px;margin:2px 0 30px;padding-left:68px}
  @media(max-width:640px){.part-sub{padding-left:0}}
  .screen-row{display:grid;grid-template-columns:320px 1fr;gap:44px;align-items:start;padding:34px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(160deg,var(--surface),var(--bg-2));margin-bottom:22px}
  .screen-row .tt{font-family:var(--disp);font-weight:800;font-size:22px;margin-bottom:4px}
  .screen-row .td{color:var(--ink-2);font-size:15.5px;margin-bottom:22px}
  .legend{list-style:none;display:flex;flex-direction:column;gap:14px}
  .legend li{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start}
  .lnum{width:28px;height:28px;border-radius:50%;background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;font-family:var(--mono);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none}
  .legend b{font-family:var(--disp);font-weight:700;font-size:15.5px}
  .legend p{color:var(--ink-2);font-size:14.5px;line-height:1.45;margin-top:2px}
  .device{width:300px;margin:0 auto;background:linear-gradient(160deg,#241a12,#0d0906);border-radius:38px;padding:12px;box-shadow:0 30px 70px -24px rgba(0,0,0,.5);position:sticky;top:88px}
  .app{background:var(--app);color:var(--app-ink);border-radius:27px;overflow:hidden;position:relative;font-size:13px}
  .app .bar{background:linear-gradient(120deg,var(--ember),var(--flame));color:#fff;padding:14px 16px;font-family:var(--disp);font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:space-between}
  .app .bar .tag{font-family:var(--mono);font-size:9px;background:rgba(255,255,255,.22);padding:3px 8px;border-radius:6px;font-weight:400}
  .app .body{padding:16px}
  .fld{position:relative;margin-bottom:11px}
  .fld label{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#8a755d;margin-bottom:5px}
  .inp{background:var(--app-2);border:1px solid var(--app-line);border-radius:9px;padding:10px 11px;font-size:13px}
  .inp.ph{color:#9a866c}
  .abtn{border-radius:10px;padding:11px;text-align:center;font-family:var(--disp);font-weight:700;font-size:12.5px;position:relative;display:flex;align-items:center;justify-content:center;gap:7px}
  .abtn.pri{background:linear-gradient(120deg,var(--ember),var(--flame));color:#fff}
  .abtn.sec{background:#fff;border:1.5px solid var(--app-line)}
  .abtn.good{background:#eaf5e3;border:1.5px solid #bcdcac;color:#3c6a2a}
  .abtn.ig{background:linear-gradient(120deg,#f09433,#e6683c 30%,#dc2743 60%,#bc1888);color:#fff}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .as-head{text-align:center;padding:6px 0 2px}
  .as-head .nm{font-family:var(--disp);font-weight:800;font-size:16px}
  .as-head .cd{font-family:var(--mono);font-size:9.5px;color:#8a755d;letter-spacing:.08em}
  .aselos{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:12px 0}
  .asel{aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .asel.on{background:radial-gradient(circle at 40% 30%,#ffbf66,var(--ember) 55%,var(--amber))}
  .asel.on svg{width:11px;height:11px;fill:#fff}
  .asel.off{border:1.4px dashed #d9b98f}
  .counter{text-align:center;font-family:var(--mono);font-size:11px;color:#8a755d;margin-bottom:10px}
  .vch{background:var(--app-2);border:1px dashed #d9b98f;border-radius:10px;padding:10px;text-align:center;font-family:var(--mono);font-weight:700;font-size:15px;color:var(--flame);letter-spacing:.06em}
  .chk{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#6b584a;margin-bottom:11px;font-family:var(--mono)}
  .chk .box{width:16px;height:16px;border-radius:4px;background:linear-gradient(120deg,var(--ember),var(--flame));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;flex:none}
  .subtabs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
  .subtabs span{font-family:var(--mono);font-size:9.5px;font-weight:600;padding:6px 9px;border-radius:7px;background:var(--app-2);color:#8a755d;white-space:nowrap}
  .subtabs span.on{background:linear-gradient(120deg,var(--ember),var(--flame));color:#fff}
  .cat-item{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;background:var(--app-2);border:1px solid var(--app-line);border-radius:10px;padding:8px;margin-bottom:8px}
  .cat-thumb{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;background:radial-gradient(circle at 40% 30%,#ffd9a0,var(--ember) 70%);flex:none}
  .cat-info .nm{font-family:var(--disp);font-weight:700;font-size:12.5px}
  .cat-info .pr{font-family:var(--mono);font-size:10px;color:#8a755d;margin-top:2px}
  .cf-photo{display:flex;align-items:center;gap:9px}
  .cf-prev{width:52px;height:52px;border-radius:9px;background:radial-gradient(circle at 40% 30%,#ffd9a0,var(--ember) 70%);display:flex;align-items:center;justify-content:center;font-size:24px;flex:none}
  .cf-pick{flex:1;background:#fff;border:1.5px solid var(--app-line);border-radius:9px;padding:9px;text-align:center;font-family:var(--disp);font-weight:700;font-size:11.5px}
  .lucky{background:linear-gradient(180deg,rgba(0,0,0,.05),transparent 75%);border:1px solid var(--app-line);border-radius:12px;padding:12px;text-align:center;margin-top:10px}
  .lucky .tt2{font-family:var(--disp);font-weight:800;font-size:13px;margin-bottom:3px}
  .lucky .num{font-family:var(--disp);font-weight:800;font-size:30px;color:var(--flame);line-height:1}
  .lucky .lb{font-family:var(--mono);font-size:9px;color:#8a755d;text-transform:uppercase}
  .pin{position:absolute;width:24px;height:24px;border-radius:50%;background:linear-gradient(150deg,var(--ember),var(--flame));color:#fff;font-family:var(--mono);font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--app);z-index:6}
  .cta{max-width:900px;margin:10px auto 0;border-radius:26px;padding:52px 32px;text-align:center;color:#fff;background:linear-gradient(150deg,var(--ember),var(--flame))}
  .cta h2{color:#fff;font-size:30px}.cta p{color:rgba(255,255,255,.92);font-size:16px;margin:12px auto 0;max-width:44ch}
  .btn{font-family:var(--mono);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.02em;padding:15px 28px;border-radius:100px;display:inline-flex;align-items:center;gap:9px;margin-top:22px;background:#fff;color:var(--flame)}
  .btn svg{width:17px;height:17px}
  footer{border-top:1px solid var(--line);padding:32px 0 48px;text-align:center;font-family:var(--mono);font-size:12.5px;color:var(--ink-3)}
  @media(max-width:760px){.wrap{padding:0 20px}.topin{padding:13px 20px}.screen-row{grid-template-columns:1fr;gap:26px;padding:24px}.device{position:relative;top:0}}
</style>
</head>
<body>
<div class="top"><div class="topin">
  <a class="brand" href="${esc(tenant)}.html">${b.logoImgLight||b.logoImg?`<img class="mark-img" src="${esc(b.logoImgLight||b.logoImg)}" alt="${esc(name)}">`:`<span class="mark-txt">${esc((b.initials||name.slice(0,2)).toUpperCase())}</span>`}Cartão Fidelidade</a>
  <a class="back" href="${esc(tenant)}.html">← Voltar</a>
</div></div>
<main><div class="wrap">
  <div class="hero">
    <p class="kick">Guia de uso · tela por tela</p>
    <h1>Como usar o Cartão da <span class="grad">${esc(name)}</span></h1>
    <p class="lead">Cada tela numerada, campo a campo: como <b>você administra</b> no balcão${hasCat?' — selos e cardápio':''}${hasSor?' e sorteio':''} — e como o <b>seu cliente usa</b> no celular.</p>
  </div>
  <section>
    <div class="part-h"><span class="bd">👤</span><h2>Para você, dono</h2></div>
    <p class="part-sub">O balcão inteiro no celular. Entre no Admin com seu PIN de 6 dígitos — tudo salva na nuvem sozinho.</p>
    ${ownerScreens}
  </section>
  <section>
    <div class="part-h"><span class="bd">📱</span><h2>Para o seu cliente</h2></div>
    <p class="part-sub">Sem instalar nada — é um link que abre no navegador. Ele acessa pelo código ou pelo telefone.</p>
    ${clientScreens}
  </section>
  <section style="padding-top:10px">
    <div class="cta"><h2>Ficou com dúvida?</h2><p>Chame a Totex no WhatsApp que a gente ajuda a configurar e tirar o máximo do cartão da ${esc(name)}.</p>
      <a class="btn" href="https://wa.me/5511947448137?text=Ol%C3%A1!%20Sou%20da%20${encodeURIComponent(name)}%20e%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20Cart%C3%A3o%20Fidelidade." target="_blank" rel="noopener">${WAICON}Falar no WhatsApp</a>
    </div>
  </section>
</div></main>
<footer>Cartão Fidelidade da ${esc(name)} · por Totex</footer>
</body>
</html>`;
  };
})();
