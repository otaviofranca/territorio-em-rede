"use strict";
/* UBS de Teresina (CNES/DATASUS), carregadas de data/ubs.json. Depende de norm() e hav() de app.js em tempo de execução. */
let UBSDATA = null;

async function carregarUBS() {
  try {
    const r = await fetch("data/ubs.json");
    if (r.ok) UBSDATA = await r.json();
  } catch {}
}

const ubsTodas = () => (UBSDATA ? UBSDATA.ubs : []);
const ubsChave = (u) => norm([u.nome, u.bairro, u.bairroBase, u.end].join(" "));

/** Busca por nome/bairro/endereço: todas as palavras digitadas precisam aparecer. Ex.: "vila da paz". */
function ubsBuscar(q) {
  const t = norm(q).split(" ").filter(Boolean);
  if (!t.length) return [];
  return ubsTodas()
    .filter((u) => {
      const k = ubsChave(u);
      return t.every((w) => k.includes(w));
    })
    .slice(0, 15);
}

/** UBS cujo bairro (ou localidade) do CNES corresponde ao bairro da base territorial. */
const ubsDoBairro = (b) => ubsTodas().filter((u) => u.bairroBase === b.nome);

/** As `n` UBS mais próximas de um ponto, com a distância em km. */
const ubsProximas = (lat, lng, n = 3) =>
  ubsTodas()
    .map((u) => ({ u, km: hav(lat, lng, u.lat, u.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);

const osmLink = (u) => `https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lng}#map=17/${u.lat}/${u.lng}`;
