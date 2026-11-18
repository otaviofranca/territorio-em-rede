"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const store={get(k,d){try{const v=JSON.parse(localStorage.getItem("ter:"+k));return v??d}catch{return d}},set(k,v){try{localStorage.setItem("ter:"+k,JSON.stringify(v))}catch{toast("Não foi possível salvar no navegador.")}}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const p2=n=>String(n).padStart(2,"0");
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`};
const fmtData=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||"");return m?`${m[3]}/${m[2]}/${m[1]}`:(v?String(v):"—")};
let D, S={pts:store.get("pts",[]),mat:store.get("mat",[]),ubs:store.get("ubs",null),coords:store.get("coords",{}),cur:store.get("cur",null),edit:null}, map=null, mapSeq=0, view="inicio", achados=[];

function toast(m){let t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.setAttribute("role","status");t.style.cssText="position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:#1d2733;color:#fff;padding:.6rem 1rem;border-radius:8px;z-index:3000;max-width:90vw";document.body.append(t)}t.textContent=m;t.style.display="block";clearTimeout(t._h);t._h=setTimeout(()=>t.style.display="none",3000)}
const avisoHtml=()=>`<aside class="aviso-fixo" role="note"><b>Aviso:</b> ${esc(AVISO)}</aside>`;

/* ---------- dados ---------- */
const crasKey=u=>u.nome.replace(/^CRAS\s+/i,"").toUpperCase();
const regiao=u=>(u.nome.toUpperCase().replace(/^(CRAS|CREAS)\s+/,"").split(" ")[0]);
function devices(){ // catálogo único de dispositivos
  const out=[];
  D.unidades.forEach(u=>out.push({id:"u:"+u.nome,tipo:u.tipo,nome:u.nome,end:u.endereco,tel:u.telefone,email:u.email,cras:u.tipo==="CRAS"?crasKey(u):null,regiao:regiao(u),bairro:""}));
  D.centros.forEach(c=>out.push({id:"c:"+c.id,tipo:"Centro de Convivência",nome:c.nome,end:c.endereco+" — "+c.bairro,tel:c.telefone,email:c.email,cras:c.cras,regiao:c.cras.split(" ")[0],bairro:c.bairro,info:[c.grupos,c.publico,c.parceria&&("parceria "+c.parceria)].filter(Boolean).join(" · ")}));
  return out;
}
const dev=id=>devices().find(d=>d.id===id);
function territorio(b){
  const dv=devices(), cras=dv.filter(d=>d.tipo==="CRAS"&&b.cras.includes(d.cras));
  const regs=[...new Set(cras.map(d=>d.regiao))];
  return {cras, creas:dv.filter(d=>d.tipo==="CREAS"&&regs.includes(d.regiao)), centros:dv.filter(d=>d.tipo==="Centro de Convivência"&&b.cras.includes(d.cras))};
}
/* bairro exato, ou bairro que contém a localidade digitada, ou nome parcial */
const findBairro=q=>{const n=norm(q);if(!n)return undefined;return D.bairros.find(b=>norm(b.nome)===n)||D.bairros.find(b=>b.localidades.some(l=>norm(l.nome)===n))||(n.length>3?D.bairros.find(b=>norm(b.nome).includes(n)):undefined)};
/* busca por bairro OU localidade (ex.: "Vila da Paz" é localidade do bairro Três Andares). Devolve [{b, loc?}] */
function buscarLugar(q){
  const n=norm(q);if(!n)return[];
  const ex=D.bairros.filter(b=>norm(b.nome)===n).map(b=>({b}));if(ex.length)return ex;
  const le=[];D.bairros.forEach(b=>b.localidades.forEach(l=>{if(norm(l.nome)===n)le.push({b,loc:l.nome})}));if(le.length)return le;
  if(n.length<3)return[];
  const par=D.bairros.filter(b=>norm(b.nome).includes(n)).map(b=>({b}));
  const lp=[];D.bairros.forEach(b=>b.localidades.forEach(l=>{if(norm(l.nome).includes(n)&&!par.some(p=>p.b===b))lp.push({b,loc:l.nome})}));
  return [...par,...lp].slice(0,20);
}

/* ---------- geocodificação (Nominatim/OSM) ---------- */
let lastGeo=0;
async function geo(q){
  const wait=Math.max(0,1100-(Date.now()-lastGeo));await new Promise(r=>setTimeout(r,wait));lastGeo=Date.now();
  const u="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&viewbox=-43.1,-4.8,-42.5,-5.4&q="+encodeURIComponent(q);
  const r=await fetch(u,{headers:{"Accept-Language":"pt-BR"}});if(!r.ok)throw new Error("geo "+r.status);
  const j=await r.json();return j[0]?{lat:+j[0].lat,lng:+j[0].lon,addr:j[0].address}:null;
}
const limpa=e=>e.replace(/\(.*?\)/g,"").replace(/ponto de refer[eê]ncia:.*/i,"").replace(/\bs\/?n\b[º°]?/ig,"").replace(/n[ºª°]\s*/ig,"").replace(/\s+/g," ").trim();
async function coordOf(d){
  const k=d.id; if(S.coords[k]) return S.coords[k].fail?null:S.coords[k];
  let r=null; try{ r=await geo(limpa(d.end)+", Teresina, Piauí"); if(!r&&d.bairro) r=await geo(d.bairro+", Teresina, Piauí"); }catch(e){return undefined}
  S.coords[k]=r?{lat:r.lat,lng:r.lng}:{fail:true}; store.set("coords",S.coords); return r;
}
/* o texto do endereço digitado vai ao OpenStreetMap: pede ciência uma vez por sessão */
function confirmaEndereco(){
  let ok=false;try{ok=sessionStorage.getItem("ter:end-ok")==="1"}catch{}
  if(ok)return true;
  const r=confirm("Para localizar o endereço, o texto digitado será enviado ao serviço público do OpenStreetMap (fora deste site).\n\nUse apenas endereços fictícios ou aproximados — nunca o endereço real de um usuário.\n\nContinuar?");
  if(r){try{sessionStorage.setItem("ter:end-ok","1")}catch{}}
  return r;
}

/* ---------- KML (UBS: áreas de abrangência oficiais, opcional) ---------- */
function parseKML(txt){
  const x=new DOMParser().parseFromString(txt,"text/xml"), pts=[], polys=[];
  const ring=s=>s.trim().split(/\s+/).map(t=>t.split(",").map(Number)).filter(a=>a.length>=2&&!a.some(isNaN)).map(a=>[a[0],a[1]]);
  $$("Placemark",x).forEach(p=>{
    const nome=(p.querySelector("name")?.textContent||"").trim(), desc=(p.querySelector("description")?.textContent||"").replace(/<[^>]+>/g," ").trim();
    $$("Point coordinates",p).forEach(c=>{const a=ring(c.textContent)[0];if(a)pts.push({nome,desc,lng:a[0],lat:a[1]})});
    $$("Polygon",p).forEach(pg=>{const c=pg.querySelector("outerBoundaryIs coordinates");if(c)polys.push({nome,desc,ring:ring(c.textContent)})});
  });
  return {pts,polys};
}
const inRing=(lng,lat,r)=>{let i=false;for(let a=0,b=r.length-1;a<r.length;b=a++){const[xi,yi]=r[a],[xj,yj]=r[b];if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)i=!i}return i};
const hav=(a,b,c,d)=>{const R=6371,t=x=>x*Math.PI/180,dl=t(c-a),dn=t(d-b),h=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
/* área oficial importada (KML) que contém o ponto, se houver */
const ubsOficial=(lat,lng)=>S.ubs&&S.ubs.polys.find(p=>inRing(lng,lat,p.ring))||null;

/* ---------- UBS: apresentação ---------- */
const ubsHtml=u=>`<b>${esc(u.nome)}</b> <span class="tag t-ubs">UBS</span><span class="muted">${esc(u.end)}${u.bairro?" · "+esc(u.bairro):""}${u.tel?" · "+esc(u.tel):""}${u.turno?" · "+esc(u.turno):""}</span>`;
const ubsFonte=()=>`<span class="muted fonte-ubs">Fonte: CNES/DATASUS${UBSDATA?` (consulta em ${fmtData(UBSDATA.consulta)})`:""}. Não é a área de abrangência oficial: confirme a UBS de referência com a equipe ou o Agente Comunitário de Saúde.</span>`;
const ubsProxHtml=(lat,lng,intro)=>{const p=ubsProximas(lat,lng,3);if(!p.length)return `<span class="muted">Dados de UBS não carregados.</span>`;
  return `${intro||""}<div class="ubs-i">${ubsHtml(p[0].u)} <span class="tag">mais próxima (${p[0].km.toFixed(1)} km)</span></div>`+(p.length>1?`<div class="ubs-o"><span class="muted">Outras próximas:</span> ${p.slice(1).map(q=>`${esc(q.u.nome)} (${q.km.toFixed(1)} km)`).join("; ")}</div>`:"")+ubsFonte()};
function ubsBox(b,r,x){
  if(x.ubs)return `<div class="ubs-i">${ubsHtml(x.ubs)} <span class="tag">UBS selecionada</span> <a class="ext" href="${esc(osmLink(x.ubs))}" target="_blank" rel="noopener">ver no mapa ↗</a></div>${ubsFonte()}`;
  if(r){const of=ubsOficial(r.lat,r.lng);if(of)return `<b>${esc(of.nome)}</b> <span class="tag">área de abrangência (KML importado)</span>`;return ubsProxHtml(r.lat,r.lng)}
  const l=ubsDoBairro(b);
  if(l.length)return l.map(u=>`<div class="ubs-i">${ubsHtml(u)}</div>`).join("")+`<span class="tag">possível, confirmar</span> `+ubsFonte();
  return `<span class="muted">Nenhuma UBS do CNES está cadastrada neste bairro/localidade.</span> <button class="ghost noprint" id="ubsprox">Ver UBS mais próximas (consulta ao OpenStreetMap)</button><div id="ubsprox-res"></div>`;
}

/* ---------- PTS ---------- */
function curCase(){return S.pts.find(c=>c.id===S.cur)}
function novoCaso(bairro){
  let n=S.pts.length+1;while(S.pts.some(c=>c.codigo==="Caso "+n))n++;
  const c={id:uid(),codigo:"Caso "+n,bairro:bairro||"",demanda:"",objetivos:"",devs:[],acoes:[],obs:"",criado:new Date().toISOString()};
  S.pts.unshift(c);S.cur=c.id;store.set("pts",S.pts);store.set("cur",c.id);return c;
}
function addToPTS(id,bairro){
  let c=curCase()||novoCaso(bairro);
  if(!c.devs.includes(id))c.devs.push(id);if(!c.bairro&&bairro)c.bairro=bairro;store.set("pts",S.pts);toast("Adicionado ao PTS "+(c.codigo||"(sem código)"));
}

/* ---------- views ---------- */
const V={};
V.inicio=()=>{const nC=D.unidades.filter(u=>u.tipo==="CRAS").length,nE=D.unidades.filter(u=>u.tipo==="CREAS").length;
return `<section class="hero"><span class="eyebrow">Produto Técnico-Tecnológico · PROFSAÚDE / UESPI</span><h1>${esc(NOME_SITE)}</h1>
<p class="lead">Conheça o território, monte o Projeto Terapêutico Singular com os recursos da rede e registre o apoio matricial entre as equipes.</p>
<div class="cta"><button class="primary lg" data-go="localizar">Localizar um território</button><button class="ghost lg" data-go="mapa">Abrir o mapa</button></div></section>
${TXT_INICIO}
<div class="stats"><div class="stat"><b>${D.bairros.length}</b><span>bairros</span></div><div class="stat"><b>${nC}</b><span>CRAS</span></div><div class="stat"><b>${nE}</b><span>CREAS</span></div><div class="stat"><b>${D.centros.length}</b><span>centros de convivência</span></div><div class="stat"><b>${ubsTodas().length}</b><span>UBS (CNES)</span></div></div>
<div class="grid">
<div class="card step"><div class="num">1</div><h3>Localizar</h3><p>Informe o bairro, a localidade, a UBS ou o endereço (fictício) e veja CRAS, CREAS, centros de convivência e a UBS de referência.</p><button class="link" data-go="localizar">Localizar →</button></div>
<div class="card step"><div class="num">2</div><h3>Mapa</h3><p>Visualize num único mapa as unidades de saúde e os dispositivos comunitários do território.</p><button class="link" data-go="mapa">Abrir o mapa →</button></div>
<div class="card step"><div class="num">3</div><h3>PTS</h3><p>Monte o Projeto Terapêutico Singular escolhendo recursos do território. A ferramenta apoia a reflexão da equipe e <b>não prescreve condutas</b>.</p><button class="link" data-go="pts">Montar um PTS →</button></div>
<div class="card step"><div class="num">4</div><h3>Apoio matricial</h3><p>Registre as articulações entre a APS e o CAPS AD / eMulti, pactue condutas e imprima a ficha.</p><button class="link" data-go="matricial">Registrar →</button></div></div>
<div class="note"><b>Base de dados:</b> Base Territorial/SEMCASPI (março/2020), listas da SEMCASPI e UBS do CNES/DATASUS${UBSDATA?` (consulta em ${fmtData(UBSDATA.consulta)})`:""}.
${S.ubs?`<br><span class="tag t-ubs">Áreas de abrangência importadas (KML): ${S.ubs.pts.length} pontos, ${S.ubs.polys.length} áreas</span>`:""}</div>`};

const lbOpcoes=()=>{const nomes=new Set(D.bairros.map(b=>b.nome)),out=D.bairros.map(b=>`<option value="${esc(b.nome)}">`);
  D.bairros.forEach(b=>b.localidades.forEach(l=>{if(!nomes.has(l.nome)){nomes.add(l.nome);out.push(`<option value="${esc(l.nome)}" label="localidade de ${esc(b.nome)}">`)}}));return out.join("")};
V.localizar=()=>`<h2>Localizar o território do usuário</h2><p class="sub">Busque pelo bairro ou localidade, pela unidade de saúde (UBS) ou por um endereço fictício.</p>
<div class="card"><div class="cols3">
<div><label for="qb">Por bairro ou localidade</label><div class="inline"><input id="qb" list="lb" placeholder="Ex.: Três Andares ou Vila da Paz" autocomplete="off"><button class="primary" id="gb">Buscar</button></div></div>
<div><label for="qu">Por unidade de saúde (UBS)</label><div class="inline"><input id="qu" list="lu" placeholder="Ex.: UBS Nossa Senhora da Paz" autocomplete="off"><button class="primary" id="gu">Buscar</button></div></div>
<div><label for="qe">Por endereço (rua, número, bairro)</label><div class="inline"><input id="qe" placeholder="Ex.: Rua Salitre, 7286, Cidade Jardim" autocomplete="off"><button class="primary" id="ge">Buscar</button></div></div></div>
<datalist id="lb">${lbOpcoes()}</datalist><datalist id="lu">${ubsTodas().map(u=>`<option value="${esc(u.nome)}" label="${esc(u.bairro)}">`).join("")}</datalist>
<p class="muted" style="margin-bottom:0">A busca por <b>endereço</b> envia o texto ao OpenStreetMap (serviço externo) e precisa de internet: use endereços fictícios ou aproximados. As buscas por bairro, localidade e UBS funcionam sem enviar nada para fora.</p></div><div id="res"></div>`;
function aviso(t){$("#res").innerHTML=`<div class="warn" role="alert">${t}</div>`}
function escolher(itens,titulo){achados=itens;$("#res").innerHTML=`<div class="card"><h3 style="margin-top:0">${titulo||"Mais de um resultado. Escolha:"}</h3><div class="row btns">${itens.map((x,i)=>`<button class="ghost" data-pick="${i}">${esc(x.rot)}</button>`).join("")}</div></div>`}
V.localizar.bind=()=>{
  $$(".inline input").forEach(i=>i.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();i.nextElementSibling.click()}}));
  $("#gb").onclick=()=>{const q=$("#qb").value.trim();if(!q)return;const r=buscarLugar(q);
    if(!r.length)return aviso("Bairro ou localidade não encontrado na base. Confira o nome, ou tente pela UBS.");
    if(r.length===1)return mostra(r[0].b,null,null,{loc:r[0].loc});
    escolher(r.map(x=>({rot:x.loc?`${x.loc} (localidade de ${x.b.nome})`:x.b.nome,fn:()=>mostra(x.b,null,null,{loc:x.loc})})))};
  $("#gu").onclick=()=>{const q=$("#qu").value.trim();if(!q)return;const r=ubsBuscar(q);
    if(!r.length)return aviso("Nenhuma UBS encontrada com esse nome. Tente só parte do nome ou o bairro (ex.: “vila da paz”).");
    const ver=u=>{const b=D.bairros.find(x=>x.nome===u.bairroBase);mostra(b||null,null,null,{ubs:u})};
    if(r.length===1)return ver(r[0]);
    escolher(r.map(u=>({rot:`${u.nome} — ${u.bairro}`,fn:()=>ver(u)})))};
  $("#ge").onclick=async()=>{const q=$("#qe").value.trim();if(!q)return;if(!confirmaEndereco())return;$("#res").innerHTML=`<p role="status">Buscando…</p>`;
    try{const r=await geo(q+", Teresina, Piauí");if(!r)return aviso("Endereço não encontrado. Tente só rua e bairro.");
      const a=r.addr||{},cand=[a.suburb,a.neighbourhood,a.city_district,a.quarter,a.residential].filter(Boolean);let b=null;for(const c of cand){const f=buscarLugar(c);if(f.length===1){b=f[0].b;break}}
      mostra(b,r,cand)}catch(e){aviso(`Falha na busca (${esc(e.message)}). Verifique a internet.`)}};
};
const tcls=t=>({CRAS:"t-cras",CREAS:"t-creas","Centro de Convivência":"t-cc"}[t]||"");
function lista(title,arr){return arr.length?`<h3 class="sec">${title} <small>${arr.length}</small></h3>`+arr.map(d=>`<div class="dev"><div class="t"><b>${esc(d.nome)}</b> <span class="tag ${tcls(d.tipo)}">${esc(d.tipo)}</span><span class="muted">${esc(d.end)}${d.tel?" · "+esc(d.tel):""}</span>${d.info?`<span class="muted">${esc(d.info)}</span>`:""}</div><button class="ghost noprint" data-add="${esc(d.id)}">+ PTS</button></div>`).join(""):""}
function mostra(b,r,cand,x={}){
  let h="";
  if(!b&&r)h+=`<div class="warn">Localizado no mapa, mas não consegui identificar o bairro automaticamente${cand&&cand.length?` (OSM indicou: ${esc(cand.join(", "))})`:""}. Use a busca por bairro ou localidade.</div>`;
  if(x.loc&&b)h+=`<div class="note" style="margin:1rem 0">“${esc(x.loc)}” é uma localidade do bairro <b>${esc(b.nome)}</b>.</div>`;
  if(x.ubs&&!b)h+=`<div class="warn">O bairro desta UBS (${esc(x.ubs.bairro)}) não consta na base territorial. Use a busca por bairro ou localidade.</div>`;
  if(b){const t=territorio(b);
    h+=`<div class="card"><div class="res-head"><div><h2>${esc(b.nome)}</h2><span class="tag">${esc(b.regional||"regional n/d")}</span>${b.cras.map(c=>`<span class="tag t-cras">CRAS ${esc(c)}</span>`).join("")}</div>
    <div class="kpis"><div><b>${b.populacao.toLocaleString("pt-BR")}</b><span>habitantes (Censo 2010)</span></div><div><b>${b.familias.toLocaleString("pt-BR")}</b><span>famílias no CadÚnico</span></div></div></div>
    <div class="ubs"><span class="k">Unidade de saúde de referência</span>${ubsBox(b,r,x)}</div>
    ${lista("CRAS de referência",t.cras)}${lista("CREAS da região",t.creas)}${lista("Centros de convivência (SCFV) do CRAS",t.centros)}
    ${t.centros.length?"":`<p class="muted">Nenhum centro de convivência cadastrado para o CRAS deste bairro na lista atual.</p>`}
    ${b.localidades.length?`<h3 class="sec">Localidades e habitações populares <small>${b.localidades.length}</small></h3><div class="chips">${b.localidades.map(l=>`<span>${esc(l.nome)}</span>`).join("")}</div>`:""}</div>`;
    $("#res").dataset.b=b.nome;
  } else if(x.ubs||r) h+=`<div class="card"><div class="ubs"><span class="k">Unidade de saúde de referência</span>${ubsBox(null,r,x)}</div></div>`;
  $("#res").innerHTML=h;
  $$("[data-add]").forEach(y=>y.onclick=()=>addToPTS(y.dataset.add,b&&b.nome));
  const bt=$("#ubsprox");if(bt)bt.onclick=async()=>{bt.disabled=true;bt.textContent="Buscando…";
    try{const g=await geo(b.nome+", Teresina, Piauí");$("#ubsprox-res").innerHTML=g?ubsProxHtml(g.lat,g.lng,`<div class="muted" style="margin:.4rem 0">Estimativa a partir do centro do bairro no OpenStreetMap (não é área oficial):</div>`):`<span class="muted">Não foi possível localizar o bairro no mapa.</span>`;bt.remove()}
    catch(e){bt.disabled=false;bt.textContent="Ver UBS mais próximas (consulta ao OpenStreetMap)";toast("Falha na consulta. Verifique a internet.")}};
}

V.mapa=()=>`<h2>Mapa do território</h2><p class="sub">Unidades de saúde e dispositivos comunitários de Teresina.</p><div class="card noprint"><div class="layers">${[["CRAS","CRAS","t-cras"],["CREAS","CREAS","t-creas"],["Centro de Convivência","Centros de convivência","t-cc"],["UBS",`UBS (${ubsTodas().length})`,"t-ubs"]].map(([v,n,c])=>`<label class="chk"><input type="checkbox" class="ly" value="${v}" checked> <span class="tag ${c}">${n}</span></label>`).join("")}</div><p class="muted" id="st" style="margin-bottom:0">Posicionando unidades…</p></div><div id="map"></div>`;
V.mapa.bind=async()=>{
  const my=++mapSeq, vivo=()=>map&&view==="mapa"&&my===mapSeq;
  map=L.map("map").setView([-5.0892,-42.8019],12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
  const cores={CRAS:"#0b4f8a",CREAS:"#b3261e","Centro de Convivência":"#2e7d32",UBS:"#e69500"}, grp={};
  Object.keys(cores).forEach(k=>grp[k]=L.layerGroup().addTo(map));
  $$(".ly").forEach(c=>c.onchange=()=>c.checked?grp[c.value].addTo(map):map.removeLayer(grp[c.value]));
  ubsTodas().forEach(u=>L.circleMarker([u.lat,u.lng],{radius:7,color:"#fff",weight:1,fillColor:cores.UBS,fillOpacity:1}).bindPopup(`<b>${esc(u.nome)}</b> (UBS)<br>${esc(u.end)}<br>${esc(u.bairro)}${u.tel?`<br>${esc(u.tel)}`:""}<br><em>Fonte: CNES</em>`).addTo(grp.UBS));
  if(S.ubs){S.ubs.polys.forEach(p=>L.polygon(p.ring.map(a=>[a[1],a[0]]),{color:cores.UBS,weight:2,fillOpacity:.1}).bindPopup(`<b>${esc(p.nome)}</b><br>${esc(p.desc.slice(0,300))}`).addTo(grp.UBS))}
  const dv=devices();let n=0,ok=0;
  const marca=(d,c)=>{ok++;L.circleMarker([c.lat,c.lng],{radius:8,color:"#fff",weight:1,fillColor:cores[d.tipo],fillOpacity:c.aprox?.6:1}).bindPopup(`<b>${esc(d.nome)}</b><br>${esc(d.tipo)}<br>${esc(d.end)}<br>${esc(d.tel||"")}${c.aprox?"<br><em>Posição aproximada (pelo bairro).</em>":""}<br><button class="ghost" data-addmap="${esc(d.id)}">+ PTS</button>`).addTo(grp[d.tipo])};
  for(const d of dv){ if(!vivo())return;
    const c=await coordOf(d); if(!vivo())return;
    if(c===undefined){$("#st").textContent="Sem conexão com o serviço de endereços. Os pontos aparecem quando houver internet.";return}
    n++; $("#st").textContent=`Posicionando… ${n}/${dv.length}`;
    if(c)marca(d,c);
  }
  $("#st").textContent=`${ok} de ${dv.length} dispositivos posicionados.${ok<dv.length?" Endereços não localizados ficam sem ponto.":""} UBS: ${ubsTodas().length} (CNES).`;
};

V.pts=()=>{const c=curCase();
  return `<h2>Projeto Terapêutico Singular (PTS)</h2>${TXT_PTS}
<div class="card noprint"><div class="row btns"><button class="primary" id="np">+ Novo caso (fictício)</button><button class="ghost" data-print="branco">Imprimir em branco (PTS e Matricial)</button></div><div class="cases">${S.pts.map(x=>`<button class="case${x.id===S.cur?" on":""}" data-open="${x.id}">${esc(x.codigo||"sem código")}</button>`).join("")||`<span class="muted">Nenhum caso ainda.</span>`}</div></div>${c?editor(c):""}${avisoHtml()}`};
function editor(c){
  const b=findBairro(c.bairro),t=b?territorio(b):{cras:[],creas:[],centros:[]},terr=[...t.cras,...t.creas,...t.centros],outros=devices().filter(d=>!terr.find(x=>x.id===d.id));
  const chk=d=>`<label class="chk"><input type="checkbox" data-dev="${esc(d.id)}" ${c.devs.includes(d.id)?"checked":""}> <span class="nm">${esc(d.nome)}</span><span class="tag ${tcls(d.tipo)}">${esc(d.tipo)}</span></label>`;
  return `<div class="card"><div class="cols"><div><label for="f-cod">Código ou apelido fictício (não use nome real)</label><input id="f-cod" data-f="codigo" value="${esc(c.codigo)}"></div>
  <div><label for="f-bai">Bairro ou localidade de residência</label><input id="f-bai" data-f="bairro" list="lb2" value="${esc(c.bairro)}"><datalist id="lb2">${lbOpcoes()}</datalist></div></div>
  <label for="f-dem">Situação / demanda</label><textarea id="f-dem" rows="3" data-f="demanda">${esc(c.demanda)}</textarea>
  <label for="f-obj">Objetivos do cuidado</label><textarea id="f-obj" rows="3" data-f="objetivos">${esc(c.objetivos)}</textarea>
  <h3 class="sec">Recursos do território ${b?`<small>${esc(b.nome)}</small>`:""}</h3>${terr.length?`<div class="chks">${terr.map(chk).join("")}</div>`:`<p class="muted">Informe um bairro ou localidade válido para ver os recursos.</p>`}
  <details class="noprint"><summary>Outros dispositivos da cidade</summary><div class="chks">${outros.map(chk).join("")}</div></details>
  <h3 class="sec">Ações combinadas</h3><div class="tbl"><table><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th class="noprint"></th></tr>${c.acoes.map((a,i)=>`<tr><td><input data-a="${i}:acao" value="${esc(a.acao)}" aria-label="Ação"></td><td><input data-a="${i}:resp" value="${esc(a.resp)}" aria-label="Responsável"></td><td><input type="date" data-a="${i}:prazo" value="${esc(a.prazo)}" aria-label="Prazo"></td><td class="noprint"><button class="danger" data-ra="${i}" aria-label="Remover ação">×</button></td></tr>`).join("")}</table></div><button class="ghost noprint" id="aa">+ Ação</button>
  <label for="f-obs">Observações</label><textarea id="f-obs" rows="3" data-f="obs">${esc(c.obs)}</textarea>
  <div class="row btns noprint" style="margin-top:1.2rem"><button class="primary" data-print="resumo">Exportar / Imprimir resumo do PTS e Matricial</button><button class="danger" id="dl">Excluir caso</button></div>
  <p class="muted noprint">Na janela de impressão, escolha “Salvar como PDF” para exportar. O resumo inclui os registros de apoio matricial vinculados a este caso.</p>
  <p class="muted">Ferramenta de apoio à reflexão da equipe. Não substitui o julgamento clínico nem prescreve condutas.</p></div>`}
V.pts.bind=()=>{
  $("#np").onclick=()=>{novoCaso();go("pts")};
  $$("[data-open]").forEach(x=>x.onclick=()=>{S.cur=x.dataset.open;store.set("cur",S.cur);go("pts")});
  const c=curCase();if(!c)return;const save=()=>store.set("pts",S.pts);
  $$("[data-f]").forEach(i=>i.oninput=()=>{c[i.dataset.f]=i.value;save()});
  $$("[data-f=bairro]").forEach(i=>i.onchange=()=>go("pts"));
  $$("[data-dev]").forEach(i=>i.onchange=()=>{c.devs=i.checked?[...new Set([...c.devs,i.dataset.dev])]:c.devs.filter(x=>x!==i.dataset.dev);save()});
  $$("[data-a]").forEach(i=>i.oninput=()=>{const[k,f]=i.dataset.a.split(":");c.acoes[+k][f]=i.value;save()});
  $$("[data-ra]").forEach(i=>i.onclick=()=>{c.acoes.splice(+i.dataset.ra,1);save();go("pts")});
  $("#aa").onclick=()=>{c.acoes.push({acao:"",resp:"",prazo:""});save();go("pts")};
  $("#dl").onclick=()=>{if(confirm("Excluir este caso?")){S.pts=S.pts.filter(x=>x.id!==c.id);S.cur=S.pts[0]?.id||null;store.set("pts",S.pts);store.set("cur",S.cur);go("pts")}};
};

/* ---------- apoio matricial (ficha conforme o roteiro da pesquisa) ---------- */
const SIT_MAT=["Em andamento","Aguardando retorno","Concluído"];
V.matricial=()=>{
  const m=S.edit&&S.mat.find(x=>x.id===S.edit)||null, v=m||{}, mods=v.modalidades||[];
  const casoSel=v.casoId||(S.cur&&!m?S.cur:"");
  return `<h2>Apoio matricial</h2>${TXT_REDE}
<div class="card noprint"><h3 style="margin-top:0">${m?"Editar registro de matriciamento":"Novo registro de matriciamento"}</h3>
<p class="muted">Não informe dados que identifiquem o paciente (nome, prontuário, endereço, telefone).</p>
<div class="cols"><div><label for="md">Data do matriciamento</label><input type="date" id="md" value="${esc(v.data||hojeISO())}"></div><div><label for="mc">Caso do PTS (opcional)</label><select id="mc"><option value="">— sem vínculo —</option>${S.pts.map(c=>`<option value="${esc(c.id)}"${c.id===casoSel?" selected":""}>${esc(c.codigo||"sem código")}${c.bairro?" · "+esc(c.bairro):""}</option>`).join("")}</select></div></div>
<h3 class="sec">Identificação dos serviços e profissionais</h3>
<div class="cols"><div><label for="mu">Unidade solicitante (APS)</label><input id="mu" list="lub" placeholder="UBS / Equipe ESF" maxlength="200" value="${esc(v.ubsSol)}" autocomplete="off"><datalist id="lub">${ubsTodas().map(u=>`<option value="${esc(u.nome)}">`).join("")}</datalist></div><div><label for="mp">Profissional de referência</label><input id="mp" placeholder="Nome ou função do profissional da APS" maxlength="200" value="${esc(v.profRef)}"></div></div>
<label for="ma">Serviço matriciado / apoiador</label><input id="ma" list="lap" placeholder="Equipe do CAPS AD ou eMulti participante" maxlength="200" value="${esc(v.apoiador)}" autocomplete="off"><datalist id="lap"><option value="CAPS AD"><option value="eMulti"><option value="CAPS AD e eMulti"></datalist>
<h3 class="sec">Modalidade do matriciamento</h3>
<div class="chks">${MODALIDADES.map(x=>`<label class="chk"><input type="checkbox" class="mod" value="${esc(x)}"${mods.includes(x)?" checked":""}> <span class="nm">${esc(x)}</span></label>`).join("")}<label class="chk"><input type="checkbox" id="mo-x"${v.outraMod?" checked":""}> <span class="nm">Outro:</span><input id="mo" placeholder="Qual?" maxlength="200" value="${esc(v.outraMod)}" aria-label="Outra modalidade" style="min-height:0;padding:.25rem .5rem"></label></div>
<h3 class="sec">1. Síntese da discussão / demanda</h3><p class="muted" style="margin-top:0">O que motivou o matriciamento e o que a APS já realizou.</p>
<textarea id="m1" rows="3" maxlength="3000" aria-label="Síntese da discussão / demanda">${esc(v.sintese||(m&&!m.sintese?m.enc:""))}</textarea>
<h3 class="sec">2. Pactuação de condutas (quem faz o quê?)</h3>
<label for="m2a">Responsabilidades da APS / ESF</label><textarea id="m2a" rows="2" maxlength="3000" placeholder="Ex.: acompanhamento clínico, busca ativa do ACS, renovação de receita.">${esc(v.respAPS)}</textarea>
<label for="m2b">Responsabilidades do CAPS AD</label><textarea id="m2b" rows="2" maxlength="3000" placeholder="Ex.: acolhimento em crise, grupo terapêutico, manejo de abstinência.">${esc(v.respCAPS)}</textarea>
<label for="m2c">Ações intersetoriais</label><textarea id="m2c" rows="2" maxlength="3000" placeholder="Ex.: acionamento do CRAS/CREAS, rede comunitária.">${esc(v.acoesInter)}</textarea>
<h3 class="sec">3. Data prevista para reavaliação / retorno</h3>
<div class="cols"><div><label for="m3">Data prevista</label><input type="date" id="m3" value="${esc(v.reavaliacao)}"><p class="muted" style="margin:.3rem 0 0">Garante a longitudinalidade e evita que o caso “caia no esquecimento”.</p></div><div><label for="ms">Situação</label><select id="ms">${SIT_MAT.map(s=>`<option${(v.st||"Em andamento")===s?" selected":""}>${s}</option>`).join("")}</select></div></div>
<div class="row btns" style="margin-top:1.2rem"><button class="primary" id="msv">${m?"Salvar alterações":"Registrar"}</button>${m?`<button class="ghost" id="mcx">Cancelar edição</button>`:""}<button class="ghost" data-print="mat-branco">Imprimir ficha em branco</button></div></div>
<div class="card"><h3 style="margin-top:0">Registros</h3><div class="tbl"><table><tr><th>Data</th><th>Caso</th><th>Unidade solicitante → Apoiador</th><th>Modalidade</th><th>Reavaliação</th><th>Situação</th><th class="noprint"></th></tr>${S.mat.map(matLinha).join("")||`<tr><td colspan="7" class="empty">Sem registros ainda.</td></tr>`}</table></div></div>${avisoHtml()}`};
function matLinha(m){
  const c=m.casoId?S.pts.find(x=>x.id===m.casoId):null, caso=c?c.codigo:(m.caso||"—");
  const mods=(m.modalidades||m.eq||[]).concat(m.outraMod?["Outro: "+m.outraMod]:[]).join("; ")||"—";
  const venc=m.reavaliacao&&m.reavaliacao<hojeISO()&&m.st!=="Concluído";
  return `<tr><td>${esc(fmtData(m.data))}</td><td>${esc(caso)}</td><td>${esc(m.ubsSol||"—")}<br><span class="muted">→ ${esc(m.apoiador||"—")}</span></td><td>${esc(mods)}</td><td>${m.reavaliacao?esc(fmtData(m.reavaliacao)):"—"}${venc?` <span class="tag t-creas">vencida</span>`:""}</td><td>${esc(m.st)}</td><td class="noprint" style="white-space:nowrap"><button class="ghost" data-print="mat:${esc(m.id)}">Imprimir</button> <button class="ghost" data-em="${esc(m.id)}">Editar</button> <button class="danger" data-dm="${esc(m.id)}" aria-label="Excluir registro">×</button></td></tr>`;
}
V.matricial.bind=()=>{
  $("#msv").onclick=()=>{
    const mods=$$(".mod:checked").map(x=>x.value), outro=$("#mo-x").checked?$("#mo").value.trim():"", sintese=$("#m1").value.trim();
    if(!$("#md").value)return toast("Informe a data do matriciamento.");
    if(!mods.length&&!outro&&!$("#mo-x").checked&&!sintese)return toast("Marque a modalidade ou escreva a síntese da discussão.");
    const c=S.pts.find(x=>x.id===$("#mc").value);
    const reg={data:$("#md").value,casoId:c?c.id:"",caso:c?c.codigo:"",ubsSol:$("#mu").value.trim(),profRef:$("#mp").value.trim(),apoiador:$("#ma").value.trim(),modalidades:mods,outraMod:outro,sintese,respAPS:$("#m2a").value.trim(),respCAPS:$("#m2b").value.trim(),acoesInter:$("#m2c").value.trim(),reavaliacao:$("#m3").value,st:$("#ms").value};
    if(S.edit){S.mat=S.mat.map(x=>x.id===S.edit?{...x,...reg,eq:undefined,enc:undefined}:x);S.edit=null;toast("Registro atualizado.")}
    else{S.mat.unshift({id:uid(),criado:new Date().toISOString(),...reg});toast("Registro adicionado.")}
    store.set("mat",S.mat);go("matricial");
  };
  $("#mcx")&&($("#mcx").onclick=()=>{S.edit=null;go("matricial")});
  $$("[data-em]").forEach(x=>x.onclick=()=>{S.edit=x.dataset.em;go("matricial")});
  $$("[data-dm]").forEach(x=>x.onclick=()=>{if(!confirm("Excluir este registro de apoio matricial?"))return;S.mat=S.mat.filter(m=>m.id!==x.dataset.dm);if(S.edit===x.dataset.dm)S.edit=null;store.set("mat",S.mat);go("matricial")});
};

V.dados=()=>`<h2>Dados</h2>
<div class="card"><h3>Unidades de saúde (UBS)</h3><p class="muted"><b>${ubsTodas().length} UBS</b> de Teresina já estão incluídas no site, a partir do CNES/DATASUS${UBSDATA?` (consulta em ${fmtData(UBSDATA.consulta)})`:""}. Elas permitem buscar a UBS por nome e indicar a mais próxima de um endereço, mas <b>não representam a área de abrangência oficial</b>.</p>
<h3>Áreas de abrangência oficiais — importar KML (opcional)</h3><p class="muted">Se a Fundação Municipal de Saúde fornecer o mapa com as áreas (polígonos) de cada UBS, importe o KML aqui (no Google My Maps: menu ⋮ → "Baixar KML"). O sistema passa a indicar a UBS de referência pela área, sem a ressalva de “mais próxima”.</p>
<input type="file" id="kml" accept=".kml,.xml,.txt">${S.ubs?`<p><span class="tag">${S.ubs.pts.length} pontos, ${S.ubs.polys.length} áreas carregadas</span> <button class="danger" id="kx">Remover</button></p>`:""}</div>
<div class="card"><h3>Backup dos registros</h3><div class="row"><button class="ghost" id="ex">Baixar backup (JSON)</button><input type="file" id="im" accept=".json"></div><p class="muted">Os casos de PTS e registros matriciais ficam só neste navegador. Faça backup antes de limpar o histórico.</p></div>
<div class="card"><h3>Fontes</h3><p class="muted">Base Territorial CRAS/SEMCASPI (março/2020; população do Censo 2010), listas de CRAS/CREAS e de Centros de Convivência da SEMCASPI; UBS: Cadastro Nacional de Estabelecimentos de Saúde (CNES/DATASUS, dados abertos). Mapas e endereços: OpenStreetMap. A base de 2020 pode estar desatualizada: confirme com a gestão antes de uso real.</p></div>`;
V.dados.bind=()=>{
  $("#kml").onchange=async e=>{const f=e.target.files[0];if(!f)return;const k=parseKML(await f.text());if(!k.pts.length&&!k.polys.length)return toast("Nenhum ponto ou área encontrado no arquivo.");S.ubs=k;store.set("ubs",k);toast("Áreas importadas");go("dados")};
  $("#kx")&&($("#kx").onclick=()=>{S.ubs=null;localStorage.removeItem("ter:ubs");go("dados")});
  $("#ex").onclick=()=>{const b=new Blob([JSON.stringify({pts:S.pts,mat:S.mat,ubs:S.ubs},null,1)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="territorio-backup.json";a.click()};
  $("#im").onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());S.pts=j.pts||[];S.mat=j.mat||[];S.ubs=j.ubs||null;store.set("pts",S.pts);store.set("mat",S.mat);store.set("ubs",S.ubs);toast("Backup restaurado");go("dados")}catch{toast("Arquivo inválido.")}};
};

/* ---------- impressão (botões data-print) ---------- */
function imprimir(que){
  if(que==="branco")return imprimirHTML(docBranco("ambos"),"PTS e Matricial em branco");
  if(que==="mat-branco")return imprimirHTML(docBranco("mat"),"Ficha de matriciamento em branco");
  if(que==="resumo"){const c=curCase();if(!c)return toast("Selecione ou crie um caso de PTS.");return imprimirHTML(docResumo(c),"Resumo do PTS e Matricial - "+(c.codigo||"caso"))}
  if(que.startsWith("mat:")){const m=S.mat.find(x=>x.id===que.slice(4));if(m)imprimirHTML(docMatricial(m),"Ficha de apoio matricial")}
}

/* ---------- roteamento ---------- */
function go(v){view=v;if(map){map.remove();map=null}$$("#nav button").forEach(b=>(b.classList.toggle("on",b.dataset.v===v),b.toggleAttribute("aria-current",b.dataset.v===v)));$("#app").innerHTML=V[v]();V[v].bind&&V[v].bind();window.scrollTo(0,0);history.replaceState(null,"","#"+v);document.title=(({inicio:"Início",localizar:"Localizar",mapa:"Mapa",pts:"PTS",matricial:"Apoio matricial",dados:"Dados"})[v]||v)+" · "+NOME_SITE}
window.addToPTS=addToPTS;
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g&&g.dataset.go&&V[g.dataset.go])return go(g.dataset.go);
  const am=e.target.closest("[data-addmap]");if(am)return addToPTS(am.dataset.addmap);
  const pk=e.target.closest("[data-pick]");if(pk){const it=achados[+pk.dataset.pick];if(it)it.fn();return}
  const pr=e.target.closest("[data-print]");if(pr)imprimir(pr.dataset.print);
});
window.addEventListener("hashchange",()=>{const v=location.hash.slice(1);if(V[v]&&v!==view&&D)go(v)});
(async()=>{
  try{D=await (await fetch("data/dados.json")).json()}catch{$("#app").innerHTML=`<div class="warn">Não foi possível carregar os dados. Se abriu o arquivo direto do computador, publique no GitHub Pages ou rode um servidor local.</div>`;return}
  await carregarUBS();
  try{const c=await (await fetch("data/coords.json")).json();S.coords={...c,...S.coords}}catch{}
  $("#nav").onclick=e=>{if(e.target.dataset.v)go(e.target.dataset.v)};
  go(V[location.hash.slice(1)]?location.hash.slice(1):"inicio");
})();
