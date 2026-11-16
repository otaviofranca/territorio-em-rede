"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const store={get(k,d){try{const v=JSON.parse(localStorage.getItem("ter:"+k));return v??d}catch{return d}},set(k,v){try{localStorage.setItem("ter:"+k,JSON.stringify(v))}catch{toast("Não foi possível salvar no navegador.")}}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
let D, S={pts:store.get("pts",[]),mat:store.get("mat",[]),ubs:store.get("ubs",null),coords:store.get("coords",{}),cur:store.get("cur",null)}, map=null, view="inicio";

function toast(m){let t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.style.cssText="position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:#1d2733;color:#fff;padding:.6rem 1rem;border-radius:8px;z-index:3000";document.body.append(t)}t.textContent=m;t.style.display="block";clearTimeout(t._h);t._h=setTimeout(()=>t.style.display="none",2600)}

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
const findBairro=q=>{const n=norm(q);return D.bairros.find(b=>norm(b.nome)===n)||D.bairros.find(b=>norm(b.nome).includes(n)&&n.length>3)};

/* ---------- geocodificação (Nominatim/OSM) ---------- */
let lastGeo=0;
async function geo(q,details){
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

/* ---------- KML (UBS) ---------- */
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
function ubsPara(lat,lng){
  if(!S.ubs)return null;
  const p=S.ubs.polys.find(p=>inRing(lng,lat,p.ring)); if(p)return {nome:p.nome,oficial:true};
  if(S.ubs.pts.length){const n=S.ubs.pts.map(u=>({u,d:hav(lat,lng,u.lat,u.lng)})).sort((a,b)=>a.d-b.d)[0];return {nome:n.u.nome,oficial:false,km:n.d}}
  return null;
}
function ubsPorBairro(b){const n=norm(b.nome);return S.ubs?[...S.ubs.pts,...S.ubs.polys].filter(u=>norm(u.nome+" "+u.desc).includes(n)):[]}

/* ---------- PTS ---------- */
function curCase(){return S.pts.find(c=>c.id===S.cur)}
function addToPTS(id,bairro){
  let c=curCase();
  if(!c){c={id:uid(),codigo:"",bairro:bairro||"",demanda:"",objetivos:"",devs:[],acoes:[],obs:"",criado:new Date().toISOString()};S.pts.unshift(c);S.cur=c.id;store.set("cur",c.id)}
  if(!c.devs.includes(id))c.devs.push(id);store.set("pts",S.pts);toast("Adicionado ao PTS "+(c.codigo||"(sem código)"));
}

/* ---------- views ---------- */
const V={};
V.inicio=()=>`<h2>Conheça o território e amplie as possibilidades de cuidado</h2>
<div class="grid">
<div class="card"><h3>1. Localizar</h3>Informe o bairro ou o endereço de um usuário (fictício no protótipo) e veja CRAS, CREAS, centros de convivência e unidade de saúde de referência.</div>
<div class="card"><h3>2. Mapa</h3>Visualize num único mapa as unidades de saúde e os dispositivos comunitários do território.</div>
<div class="card"><h3>3. PTS</h3>Monte o Projeto Terapêutico Singular escolhendo recursos do território. A ferramenta apoia a reflexão da equipe e <b>não prescreve condutas</b>.</div>
<div class="card"><h3>4. Apoio matricial</h3>Registre articulações entre Saúde da Família, eMulti, CAPS, Assistência Social e dispositivos comunitários.</div></div>
<div class="card"><b>Base de dados:</b> ${D.bairros.length} bairros, ${D.unidades.filter(u=>u.tipo==="CRAS").length} CRAS, ${D.unidades.filter(u=>u.tipo==="CREAS").length} CREAS e ${D.centros.length} centros de convivência (Base Territorial/SEMCASPI, março/2020, e listas da SEMCASPI).
<br>${S.ubs?`<span class="tag">UBS importadas: ${S.ubs.pts.length} pontos, ${S.ubs.polys.length} áreas</span>`:`<span class="warn">Unidades de saúde ainda não carregadas. Importe o KML do mapa da rede de saúde em <b>Dados</b>.</span>`}</div>`;

V.localizar=()=>`<h2>Localizar o território do usuário</h2>
<div class="card"><label>Bairro</label><div class="row"><input id="qb" list="lb" placeholder="Digite o bairro"><button class="primary" id="gb">Buscar bairro</button></div>
<datalist id="lb">${D.bairros.map(b=>`<option value="${esc(b.nome)}">`).join("")}</datalist>
<label>ou endereço (rua, número, bairro)</label><div class="row"><input id="qe" placeholder="Ex.: Rua Salitre, 7286, Cidade Jardim"><button class="primary" id="ge">Buscar endereço</button></div>
<p class="muted">A busca por endereço usa o OpenStreetMap e precisa de internet. Use endereços fictícios ou aproximados.</p></div><div id="res"></div>`;
V.localizar.bind=()=>{
  $("#gb").onclick=()=>{const b=findBairro($("#qb").value);if(!b)return $("#res").innerHTML=`<div class="warn">Bairro não encontrado na base.</div>`;mostra(b)};
  $("#ge").onclick=async()=>{const q=$("#qe").value.trim();if(!q)return;$("#res").innerHTML=`<p>Buscando…</p>`;
    try{const r=await geo(q+", Teresina, Piauí");if(!r)return $("#res").innerHTML=`<div class="warn">Endereço não encontrado. Tente só rua e bairro.</div>`;
      const a=r.addr||{},cand=[a.suburb,a.neighbourhood,a.city_district,a.quarter,a.residential].filter(Boolean);let b=null;for(const c of cand){b=findBairro(c);if(b)break}
      mostra(b,r,cand)}catch(e){$("#res").innerHTML=`<div class="warn">Falha na busca (${esc(e.message)}). Verifique a internet.</div>`}};
};
function lista(title,arr,bairro){return arr.length?`<h3>${title}</h3>`+arr.map(d=>`<div class="dev"><div class="t"><b>${esc(d.nome)}</b> <span class="tag">${esc(d.tipo)}</span><br><span class="muted">${esc(d.end)}${d.tel?" · "+esc(d.tel):""}${d.info?"<br>"+esc(d.info):""}</span></div><button class="ghost noprint" data-add="${esc(d.id)}">+ PTS</button></div>`).join(""):""}
function mostra(b,r,cand){
  let h="";
  if(!b)h+=`<div class="warn">${r?`Localizado no mapa, mas não consegui identificar o bairro automaticamente${cand&&cand.length?` (OSM indicou: ${esc(cand.join(", "))})`:""}. Escolha o bairro na caixa acima.`:"Bairro não encontrado."}</div>`;
  let ubsTxt="";
  if(r){const u=ubsPara(r.lat,r.lng);ubsTxt=u?(u.oficial?`<b>${esc(u.nome)}</b> <span class="tag">área de abrangência</span>`:`<b>${esc(u.nome)}</b> <span class="tag">mais próxima (${u.km.toFixed(1)} km), não é área oficial</span>`):`<span class="muted">Importe o KML das UBS em Dados para identificar a unidade de referência.</span>`}
  else if(b){const l=ubsPorBairro(b);ubsTxt=l.length?l.map(u=>`<b>${esc(u.nome)}</b>`).join(", ")+` <span class="tag">possível, confirmar</span>`:`<span class="muted">Informe o endereço (ou importe o KML das UBS) para identificar a unidade de referência.</span>`}
  if(b){const t=territorio(b);
    h+=`<div class="card"><h2>${esc(b.nome)}</h2><span class="tag">${esc(b.regional||"regional n/d")}</span>${b.cras.map(c=>`<span class="tag">CRAS ${esc(c)}</span>`).join("")}
    <p class="muted">População (Censo 2010): ${b.populacao.toLocaleString("pt-BR")} · Famílias no CadÚnico: ${b.familias.toLocaleString("pt-BR")}</p>
    <div class="card"><b>Unidade de saúde de referência:</b> ${ubsTxt}</div>
    ${lista("CRAS de referência",t.cras)}${lista("CREAS da região",t.creas)}${lista("Centros de convivência (SCFV) do CRAS",t.centros)}
    ${t.centros.length?"":`<p class="muted">Nenhum centro de convivência cadastrado para o CRAS deste bairro na lista atual.</p>`}
    ${b.localidades.length?`<h3>Localidades e habitações populares (${b.localidades.length})</h3><p class="muted">${b.localidades.map(l=>esc(l.nome)).join(" · ")}</p>`:""}</div>`;
    $("#res").dataset.b=b.nome;
  } else if(r) h+=`<div class="card">${ubsTxt}</div>`;
  $("#res").innerHTML=h;
  $$("[data-add]").forEach(x=>x.onclick=()=>addToPTS(x.dataset.add,b&&b.nome));
}

V.mapa=()=>`<h2>Mapa do território</h2><div class="card noprint"><div class="row"><label style="margin:0"><input type="checkbox" class="ly" value="CRAS" checked style="width:auto"> CRAS</label><label style="margin:0"><input type="checkbox" class="ly" value="CREAS" checked style="width:auto"> CREAS</label><label style="margin:0"><input type="checkbox" class="ly" value="Centro de Convivência" checked style="width:auto"> Centros de convivência</label><label style="margin:0"><input type="checkbox" class="ly" value="UBS" checked style="width:auto"> UBS</label></div><p class="muted" id="st">Posicionando unidades pelo endereço (OpenStreetMap)…</p></div><div id="map"></div>`;
V.mapa.bind=async()=>{
  map=L.map("map").setView([-5.0892,-42.8019],12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
  const cores={CRAS:"#0b4f8a",CREAS:"#b3261e","Centro de Convivência":"#2e7d32",UBS:"#e69500"}, grp={};
  Object.keys(cores).forEach(k=>grp[k]=L.layerGroup().addTo(map));
  $$(".ly").forEach(c=>c.onchange=()=>c.checked?grp[c.value].addTo(map):map.removeLayer(grp[c.value]));
  if(S.ubs){S.ubs.polys.forEach(p=>L.polygon(p.ring.map(a=>[a[1],a[0]]),{color:cores.UBS,weight:2,fillOpacity:.1}).bindPopup(`<b>${esc(p.nome)}</b><br>${esc(p.desc).slice(0,300)}`).addTo(grp.UBS));
    S.ubs.pts.forEach(u=>L.circleMarker([u.lat,u.lng],{radius:7,color:"#fff",weight:1,fillColor:cores.UBS,fillOpacity:1}).bindPopup(`<b>${esc(u.nome)}</b> (UBS)<br>${esc(u.desc).slice(0,300)}`).addTo(grp.UBS))}
  const dv=devices();let n=0;
  for(const d of dv){ if(!map||view!=="mapa")return;
    const c=await coordOf(d); if(c===undefined){$("#st").textContent="Sem conexão com o serviço de endereços. Os pontos aparecem quando houver internet.";return}
    n++; $("#st").textContent=`Posicionando… ${n}/${dv.length}`;
    if(c){L.circleMarker([c.lat,c.lng],{radius:8,color:"#fff",weight:1,fillColor:cores[d.tipo],fillOpacity:1}).bindPopup(`<b>${esc(d.nome)}</b><br>${esc(d.tipo)}<br>${esc(d.end)}<br>${esc(d.tel||"")}<br><button class="ghost" onclick="addToPTS('${esc(d.id)}')">+ PTS</button>`).addTo(grp[d.tipo])}
  }
  $("#st").textContent="Pronto. Endereços não localizados pelo OSM ficam sem ponto.";
};

V.pts=()=>{const c=curCase();
  return `<h2>Projeto Terapêutico Singular (PTS)</h2><div class="card noprint"><div class="row"><button class="primary" id="np">+ Novo caso (fictício)</button></div><div style="margin-top:.5rem">${S.pts.map(x=>`<span class="tag" style="cursor:pointer;${x.id===S.cur?"background:var(--az);color:#fff":""}" data-open="${x.id}">${esc(x.codigo||"sem código")}</span>`).join("")||`<span class="muted">Nenhum caso ainda.</span>`}</div></div>${c?editor(c):""}`};
function editor(c){
  const b=findBairro(c.bairro),t=b?territorio(b):{cras:[],creas:[],centros:[]},terr=[...t.cras,...t.creas,...t.centros],outros=devices().filter(d=>!terr.find(x=>x.id===d.id));
  const chk=d=>`<label style="font-weight:400;margin:.2rem 0"><input type="checkbox" style="width:auto" data-dev="${esc(d.id)}" ${c.devs.includes(d.id)?"checked":""}> ${esc(d.nome)} <span class="tag">${esc(d.tipo)}</span></label>`;
  return `<div class="card"><label>Código ou apelido fictício (não use nome real)</label><input data-f="codigo" value="${esc(c.codigo)}">
  <label>Bairro de residência</label><input data-f="bairro" list="lb2" value="${esc(c.bairro)}"><datalist id="lb2">${D.bairros.map(x=>`<option value="${esc(x.nome)}">`).join("")}</datalist>
  <label>Situação / demanda</label><textarea rows="3" data-f="demanda">${esc(c.demanda)}</textarea>
  <label>Objetivos do cuidado</label><textarea rows="3" data-f="objetivos">${esc(c.objetivos)}</textarea>
  <h3>Recursos do território ${b?`(${esc(b.nome)})`:""}</h3>${terr.length?terr.map(chk).join(""):`<span class="muted">Informe um bairro válido para ver os recursos.</span>`}
  <details class="noprint"><summary>Outros dispositivos da cidade</summary>${outros.map(chk).join("")}</details>
  <h3>Ações combinadas</h3><table><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th class="noprint"></th></tr>${c.acoes.map((a,i)=>`<tr><td><input data-a="${i}:acao" value="${esc(a.acao)}"></td><td><input data-a="${i}:resp" value="${esc(a.resp)}"></td><td><input data-a="${i}:prazo" value="${esc(a.prazo)}"></td><td class="noprint"><button class="danger" data-ra="${i}">×</button></td></tr>`).join("")}</table><button class="ghost noprint" id="aa">+ Ação</button>
  <label>Observações</label><textarea rows="3" data-f="obs">${esc(c.obs)}</textarea>
  <div class="row noprint" style="margin-top:.8rem"><button class="primary" id="pr">Imprimir / salvar PDF</button><button class="danger" id="dl">Excluir caso</button></div>
  <p class="muted">Ferramenta de apoio à reflexão da equipe. Não substitui o julgamento clínico nem prescreve condutas.</p></div>`}
V.pts.bind=()=>{
  $("#np").onclick=()=>{const c={id:uid(),codigo:"Caso "+(S.pts.length+1),bairro:"",demanda:"",objetivos:"",devs:[],acoes:[],obs:"",criado:new Date().toISOString()};S.pts.unshift(c);S.cur=c.id;store.set("pts",S.pts);store.set("cur",c.id);go("pts")};
  $$("[data-open]").forEach(x=>x.onclick=()=>{S.cur=x.dataset.open;store.set("cur",S.cur);go("pts")});
  const c=curCase();if(!c)return;const save=()=>store.set("pts",S.pts);
  $$("[data-f]").forEach(i=>i.oninput=()=>{c[i.dataset.f]=i.value;save()});
  $$("[data-f=bairro]").forEach(i=>i.onchange=()=>go("pts"));
  $$("[data-dev]").forEach(i=>i.onchange=()=>{c.devs=i.checked?[...new Set([...c.devs,i.dataset.dev])]:c.devs.filter(x=>x!==i.dataset.dev);save()});
  $$("[data-a]").forEach(i=>i.oninput=()=>{const[k,f]=i.dataset.a.split(":");c.acoes[+k][f]=i.value;save()});
  $$("[data-ra]").forEach(i=>i.onclick=()=>{c.acoes.splice(+i.dataset.ra,1);save();go("pts")});
  $("#aa").onclick=()=>{c.acoes.push({acao:"",resp:"",prazo:""});save();go("pts")};
  $("#pr").onclick=()=>window.print();
  $("#dl").onclick=()=>{if(confirm("Excluir este caso?")){S.pts=S.pts.filter(x=>x.id!==c.id);S.cur=S.pts[0]?.id||null;store.set("pts",S.pts);store.set("cur",S.cur);go("pts")}};
};

const EQ=["Saúde da Família (ESF)","eMulti","CAPS","Assistência Social (CRAS/CREAS)","Dispositivo comunitário","Outro"];
V.matricial=()=>`<h2>Apoio matricial</h2><div class="card noprint"><div class="row"><div><label>Data</label><input type="date" id="md" value="${new Date().toISOString().slice(0,10)}"></div><div><label>Caso do PTS</label><select id="mc"><option value="">—</option>${S.pts.map(c=>`<option>${esc(c.codigo)}</option>`).join("")}</select></div></div>
<label>Equipes e serviços envolvidos</label>${EQ.map(e=>`<label style="font-weight:400;display:inline-block;margin-right:1rem"><input type="checkbox" class="eq" style="width:auto" value="${esc(e)}"> ${esc(e)}</label>`).join("")}
<label>Combinado / encaminhamento</label><textarea id="me" rows="3"></textarea>
<label>Situação</label><select id="ms"><option>Em andamento</option><option>Concluído</option><option>Aguardando retorno</option></select>
<p><button class="primary" id="msv">Registrar</button></p></div>
<div class="card"><table><tr><th>Data</th><th>Caso</th><th>Envolvidos</th><th>Combinado</th><th>Situação</th><th></th></tr>${S.mat.map(m=>`<tr><td>${esc(m.data)}</td><td>${esc(m.caso)}</td><td>${esc(m.eq.join(", "))}</td><td>${esc(m.enc)}</td><td>${esc(m.st)}</td><td><button class="danger noprint" data-dm="${m.id}">×</button></td></tr>`).join("")||`<tr><td colspan="6" class="muted">Sem registros.</td></tr>`}</table></div>`;
V.matricial.bind=()=>{
  $("#msv").onclick=()=>{const eq=$$(".eq:checked").map(x=>x.value);if(!eq.length&&!$("#me").value.trim())return toast("Preencha equipes ou combinado.");S.mat.unshift({id:uid(),data:$("#md").value,caso:$("#mc").value,eq,enc:$("#me").value,st:$("#ms").value});store.set("mat",S.mat);go("matricial")};
  $$("[data-dm]").forEach(x=>x.onclick=()=>{S.mat=S.mat.filter(m=>m.id!==x.dataset.dm);store.set("mat",S.mat);go("matricial")});
};

V.dados=()=>`<h2>Dados</h2>
<div class="card"><h3>Unidades de saúde (UBS) — importar KML</h3><p class="muted">No Google My Maps do mapa da rede de saúde: menu ⋮ → "Baixar KML". Envie o arquivo aqui. Se o mapa tiver áreas (polígonos), o sistema identifica a UBS de referência pelo endereço; se tiver só pontos, mostra a mais próxima, avisando que não é área oficial.</p>
<input type="file" id="kml" accept=".kml,.xml,.txt">${S.ubs?`<p><span class="tag">${S.ubs.pts.length} pontos, ${S.ubs.polys.length} áreas carregadas</span> <button class="danger" id="kx">Remover</button></p>`:""}</div>
<div class="card"><h3>Backup dos registros</h3><div class="row"><button class="ghost" id="ex">Baixar backup (JSON)</button><input type="file" id="im" accept=".json"></div><p class="muted">Os casos de PTS e registros matriciais ficam só neste navegador. Faça backup antes de limpar o histórico.</p></div>
<div class="card"><h3>Fontes</h3><p class="muted">Base Territorial CRAS/SEMCASPI (março/2020; população do Censo 2010), listas de CRAS/CREAS e de Centros de Convivência da SEMCASPI, mapa da rede de saúde da FMS Teresina (via KML). Mapas e endereços: OpenStreetMap. A base de 2020 pode estar desatualizada: confirme com a gestão antes de uso real.</p></div>`;
V.dados.bind=()=>{
  $("#kml").onchange=async e=>{const f=e.target.files[0];if(!f)return;const k=parseKML(await f.text());if(!k.pts.length&&!k.polys.length)return toast("Nenhum ponto ou área encontrado no arquivo.");S.ubs=k;store.set("ubs",k);toast("UBS importadas");go("dados")};
  $("#kx")&&($("#kx").onclick=()=>{S.ubs=null;localStorage.removeItem("ter:ubs");go("dados")});
  $("#ex").onclick=()=>{const b=new Blob([JSON.stringify({pts:S.pts,mat:S.mat,ubs:S.ubs},null,1)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="territorio-backup.json";a.click()};
  $("#im").onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());S.pts=j.pts||[];S.mat=j.mat||[];S.ubs=j.ubs||null;store.set("pts",S.pts);store.set("mat",S.mat);store.set("ubs",S.ubs);toast("Backup restaurado");go("dados")}catch{toast("Arquivo inválido.")}};
};

/* ---------- roteamento ---------- */
function go(v){view=v;if(map){map.remove();map=null}$$("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));$("#app").innerHTML=V[v]();V[v].bind&&V[v].bind();window.scrollTo(0,0);history.replaceState(null,"","#"+v)}
window.addToPTS=addToPTS;
(async()=>{
  try{D=await (await fetch("data/dados.json")).json()}catch{$("#app").innerHTML=`<div class="warn">Não foi possível carregar os dados. Se abriu o arquivo direto do computador, publique no GitHub Pages ou rode um servidor local.</div>`;return}
  try{const c=await (await fetch("data/coords.json")).json();S.coords={...c,...S.coords}}catch{}
  $("#nav").onclick=e=>{if(e.target.dataset.v)go(e.target.dataset.v)};
  go(V[location.hash.slice(1)]?location.hash.slice(1):"inicio");
})();
