"use strict";
/* Impressão e exportação em PDF (pela janela de impressão do navegador).
   Monta a folha em #print-area e imprime só ela; a tela normal não é afetada.
   Depende, em tempo de execução, de esc(), S, dev(), findBairro(), fmtData() de app.js e dos textos de conteudo.js. */

function imprimirHTML(corpo, titulo) {
  const area = document.getElementById("print-area"),
    tituloAntes = document.title;
  area.innerHTML = corpo;
  document.body.classList.add("printing");
  if (titulo) document.title = titulo;
  const fim = () => {
    document.body.classList.remove("printing");
    area.innerHTML = "";
    document.title = tituloAntes;
    window.removeEventListener("afterprint", fim);
  };
  window.addEventListener("afterprint", fim);
  setTimeout(() => window.print(), 60);
}

/* ---------- blocos da folha ---------- */
const LOGO = `<svg class="f-logo" viewBox="0 0 36 36" width="34" height="34" aria-hidden="true"><rect width="36" height="36" rx="10" fill="#0e5a66"/><path d="M18 11 11 24M18 11l7 13M11 24h14" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/><g fill="#fff"><circle cx="18" cy="11" r="3.2"/><circle cx="11" cy="24" r="3.2"/><circle cx="25" cy="24" r="3.2"/></g></svg>`;
const fMarca = () => `<div class="f-marca">${LOGO}<div><strong>${esc(NOME_SITE)}</strong><span>Produto Técnico-Tecnológico (PTT) · PROFSAÚDE / UESPI</span></div></div>`;
const fRodape = () => `<div class="f-rod"><p><b>Aviso:</b> ${esc(AVISO)}</p><p>Impresso em ${esc(new Date().toLocaleString("pt-BR"))}. Apoio à reflexão da equipe; não substitui o julgamento clínico nem prescreve condutas.</p></div>`;
/** Folha com cabeçalho e rodapé que se repetem em cada página impressa (thead/tfoot). */
const fFolha = (titulo, sub, corpo) =>
  `<table class="f-folha"><thead><tr><td>${fMarca()}</td></tr></thead><tbody><tr><td><h1 class="f-titulo">${esc(titulo)}</h1>${sub ? `<p class="f-sub">${esc(sub)}</p>` : ""}${corpo}</td></tr></tbody><tfoot><tr><td>${fRodape()}</td></tr></tfoot></table>`;
const fSec = (t, c) => `<section class="f-sec"><h2>${t}</h2>${c}</section>`;
const fTxt = (t) => (t && String(t).trim() ? `<p class="f-txt">${esc(t).replace(/\n/g, "<br>")}</p>` : `<p class="f-vazio">Não preenchido.</p>`);
const fMeta = (linhas) => `<table class="f-meta"><tbody>${linhas.map(([r, v]) => `<tr><th>${esc(r)}</th><td>${v === "" || v == null ? "&nbsp;" : esc(v)}</td></tr>`).join("")}</tbody></table>`;
const fLinhas = (n) => Array.from({ length: n }, () => `<div class="f-l"></div>`).join("");
const fCampo = (rot) => `<div class="f-campo"><span>${esc(rot)}</span><div class="f-l"></div></div>`;
const fCheck = (marcado, txt) => `<div class="f-chk">${marcado ? "&#9746;" : "&#9744;"} ${esc(txt)}</div>`;
const fAssin = (a, b) => `<div class="f-assin"><div>${esc(a)}</div><div>${esc(b)}</div></div>`;
const fQuebra = `<div class="f-quebra"></div>`;

/* ---------- ficha de apoio matricial (preenchida) ---------- */
function fichaMat(m) {
  const mods = m.modalidades || [];
  const modHtml = (m.modalidades || m.outraMod !== undefined)
    ? MODALIDADES.map((x) => fCheck(mods.includes(x), x)).join("") + fCheck(!!m.outraMod, m.outraMod ? "Outro: " + m.outraMod : "Outro: ________________")
    : `<p class="f-txt">${esc((m.eq || []).join(", ") || "—")}</p>`; // registros antigos
  return (
    fMeta([
      ["Data do matriciamento", fmtData(m.data)],
      ["Unidade solicitante (APS)", m.ubsSol || ""],
      ["Profissional de referência", m.profRef || ""],
      ["Serviço matriciado / apoiador", m.apoiador || ""],
      ["Situação", m.st || ""],
    ]) +
    fSec("Modalidade do matriciamento", modHtml) +
    fSec("1. Síntese da discussão / demanda", fTxt(m.sintese || m.enc)) +
    fSec(
      "2. Pactuação de condutas (quem faz o quê?)",
      `<p class="f-rot">Responsabilidades da APS / ESF:</p>${fTxt(m.respAPS)}<p class="f-rot">Responsabilidades do CAPS AD:</p>${fTxt(m.respCAPS)}<p class="f-rot">Ações intersetoriais:</p>${fTxt(m.acoesInter)}`,
    ) +
    fSec("3. Data prevista para reavaliação / retorno", `<p class="f-txt">${m.reavaliacao ? esc(fmtData(m.reavaliacao)) : "Não definida."}</p>`)
  );
}

const matDoCaso = (c) => S.mat.filter((m) => m.casoId === c.id || (!m.casoId && m.caso && m.caso === c.codigo));

/* ---------- documentos ---------- */
/** Resumo do PTS (+ apoio matricial vinculado ao caso). */
function docResumo(c) {
  const b = findBairro(c.bairro),
    recs = c.devs.map(dev).filter(Boolean),
    mats = matDoCaso(c);
  const acoes = c.acoes.length
    ? `<table class="f-tab"><thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>${c.acoes.map((a) => `<tr><td>${esc(a.acao) || "—"}</td><td>${esc(a.resp) || "—"}</td><td>${a.prazo ? esc(fmtData(a.prazo)) : "—"}</td></tr>`).join("")}</tbody></table>`
    : `<p class="f-vazio">Nenhuma ação combinada.</p>`;
  const corpo =
    fMeta([
      ["Caso (código fictício)", c.codigo || ""],
      ["Bairro / localidade de residência", c.bairro || ""],
      ["CRAS de referência", b ? b.cras.join(", ") : ""],
      ["Criado em", c.criado ? fmtData(c.criado.slice(0, 10)) : ""],
    ]) +
    fSec("1. Situação / demanda", fTxt(c.demanda)) +
    fSec("2. Objetivos do cuidado", fTxt(c.objetivos)) +
    fSec(
      "3. Recursos do território",
      recs.length ? `<ul class="f-ul">${recs.map((d) => `<li><b>${esc(d.nome)}</b> (${esc(d.tipo)}) — ${esc(d.end)}${d.tel ? " · " + esc(d.tel) : ""}</li>`).join("")}</ul>` : `<p class="f-vazio">Nenhum recurso selecionado.</p>`,
    ) +
    fSec("4. Ações combinadas", acoes) +
    fSec("5. Observações", fTxt(c.obs)) +
    `<h2 class="f-h2">Apoio matricial vinculado ao caso</h2>` +
    (mats.length ? mats.map((m, i) => `<div class="f-bloco"><h3>Registro ${i + 1} de ${mats.length}</h3>${fichaMat(m)}</div>`).join("") : `<p class="f-vazio">Nenhum registro de apoio matricial vinculado a este caso.</p>`) +
    fAssin("Profissional responsável", "Data: ____ / ____ / ________");
  return fFolha("Resumo do PTS e do Apoio Matricial", "Para anexar ao prontuário, se a unidade assim decidir. Use apenas código ou apelido fictício.", corpo);
}

/** Ficha de apoio matricial de um registro. */
const docMatricial = (m) =>
  fFolha("Ficha de Apoio Matricial (Matriciamento)", "Sem dados que identifiquem o paciente.", fichaMat(m) + fAssin("Profissional da APS / ESF", "Profissional apoiador (CAPS AD / eMulti)"));

/* ---------- formulários em branco ---------- */
function brancoPTS() {
  return fFolha(
    "Projeto Terapêutico Singular (PTS) — formulário em branco",
    "Não escreva nome real do paciente: use código ou apelido.",
    fCampo("Código ou apelido") +
      fCampo("Bairro / localidade de residência") +
      fCampo("CRAS de referência") +
      fSec("1. Situação / demanda", fLinhas(3)) +
      fSec("2. Objetivos do cuidado", fLinhas(2)) +
      fSec("3. Recursos do território", ["CRAS", "CREAS", "Centro de convivência (SCFV)", "UBS de referência", "Outro: ________________"].map((t) => fCheck(false, t)).join("")) +
      fSec(
        "4. Ações combinadas",
        `<table class="f-tab"><thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Feita</th></tr></thead><tbody>${Array.from({ length: 5 }, () => `<tr class="f-alta"><td></td><td></td><td></td><td>&#9744;</td></tr>`).join("")}</tbody></table>`,
      ) +
      fSec("5. Observações", fLinhas(2)) +
      fAssin("Profissional responsável", "Data: ____ / ____ / ________"),
  );
}

function brancoMat() {
  return fFolha(
    "Ficha de Apoio Matricial (Matriciamento) — formulário em branco",
    "Sem dados que identifiquem o paciente.",
    fCampo("Data do matriciamento") +
      fCampo("Unidade solicitante (APS): UBS / Equipe ESF") +
      fCampo("Profissional de referência") +
      fCampo("Serviço matriciado / apoiador (equipe do CAPS AD ou eMulti participante)") +
      fSec("Modalidade do matriciamento", MODALIDADES.map((t) => fCheck(false, t)).join("") + fCheck(false, "Outro: ________________")) +
      fSec("1. Síntese da discussão / demanda<small> — O que motivou o matriciamento e o que a APS já realizou.</small>", fLinhas(3)) +
      fSec(
        "2. Pactuação de condutas (quem faz o quê?)",
        `<p class="f-rot">Responsabilidades da APS / ESF:</p>${fLinhas(2)}<p class="f-rot">Responsabilidades do CAPS AD:</p>${fLinhas(2)}<p class="f-rot">Ações intersetoriais:</p>${fLinhas(2)}`,
      ) +
      fSec("3. Data prevista para reavaliação / retorno", `<div class="f-campo"><span>Data</span><div class="f-l f-curta"></div></div>`) +
      fAssin("Profissional da APS / ESF", "Profissional apoiador (CAPS AD / eMulti)"),
  );
}

/** modo: "ambos" | "pts" | "mat" */
const docBranco = (modo = "ambos") => (modo === "pts" ? brancoPTS() : modo === "mat" ? brancoMat() : brancoPTS() + fQuebra + brancoMat());
