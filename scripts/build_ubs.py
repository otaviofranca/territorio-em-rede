"""Gera data/ubs.json: as UBS de Teresina-PI, a partir dos Dados Abertos do CNES/DATASUS.

Fonte: https://apidadosabertos.saude.gov.br/cnes/estabelecimentos  (API pública, sem chave)
Filtros: município 221100 (Teresina), tipo de unidade 2 (Centro de Saúde/Unidade Básica),
         nome "UNIDADE BASICA DE SAUDE ...", esfera municipal, estabelecimento NÃO desabilitado.

Rode no seu computador, com internet:   python scripts/build_ubs.py
Observações sobre a fonte:
- A API pagina pelo NÚMERO DA PÁGINA em `offset` (0, 1, 2...), com no máximo 20 registros por página.
- O CNES guarda nomes em maiúsculas, sem acento e com campos truncados (ex.: bairro com 20 letras).
  Aqui o texto é reformatado; quando o bairro da UBS corresponde a um bairro da base territorial
  (data/dados.json), o campo `bairroBase` guarda o nome oficial dessa base.
- Isto NÃO é a área de abrangência oficial de cada UBS (isso exige o mapa da FMS/Secretaria).
"""
import json, os, re, sys, time, unicodedata, urllib.request
from datetime import date

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
URL = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=221100&codigo_tipo_unidade=2&limit=20&offset=%d"

def sem_acento_maiusc(w):
    return "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn").upper()


ACENTOS = {sem_acento_maiusc(w): w for w in """São José João Esperança Avião Gavião Árvores Américo André Bárbara Benício Cerâmica Confiança Eulálio
Fé Félix Helvídio Irmã Irmãos Itararé Leônidas Macaúba Mário Onésima Pádua Piçarreira Piauí Princípio Renascença
Ressurreição Satélite Sérgio Setúbal Tânia Três Virgínia Arimatéia Água Conceição Antônio Cândido Egídio""".split()}
MINUSCULAS = {"DA", "DE", "DO", "DAS", "DOS", "E"}
ABREV = {"DR": "Dr.", "DRA": "Dra.", "DEP": "Dep.", "PQ": "Parque", "STA": "Santa", "KM": "Km", "A": "A."}
ROMANOS = {"I", "II", "III", "IV", "V", "VI"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def bonito(txt):
    txt = re.sub(r"\bDIRCEUII\b", "DIRCEU II", txt or "")
    out = []
    for i, w in enumerate(txt.split()):
        if w in ABREV:
            out.append(ABREV[w])
        elif w in ROMANOS:
            out.append(w)
        elif w in MINUSCULAS and i > 0:
            out.append(w.lower())
        elif w in ACENTOS:
            out.append(ACENTOS[w])
        elif len(w) == 1:
            out.append(w)
        else:
            out.append(w.capitalize())
    return " ".join(out)


def turno(t):
    t = (t or "").upper()
    if "MANHA E" in t and "TARDE" in t:
        return "Manhã e tarde"
    if "MANHA" in t and "TARDE" in t and "NOITE" not in t:
        return "Manhã e tarde"
    if "MANHA" in t:
        return "Manhã"
    if "TARDE" in t:
        return "Tarde"
    return t.capitalize()


def pagina(n):
    for t in range(4):
        try:
            r = urllib.request.Request(URL % n, headers={"User-Agent": "Mozilla/5.0"})
            return json.load(urllib.request.urlopen(r, timeout=40)).get("estabelecimentos", [])
        except Exception as e:
            print("  erro", e, "- tentativa", t + 1, file=sys.stderr)
            time.sleep(2 * (t + 1))
    raise SystemExit("API do CNES indisponível")


def baixar():
    vistos, n = {}, 0
    while True:
        lote = pagina(n)
        print("página", n, "->", len(lote), file=sys.stderr)
        for x in lote:
            vistos[x["codigo_cnes"]] = x
        if len(lote) < 20:
            break
        n += 1
        time.sleep(0.3)
    return list(vistos.values())


def bairro_base(bairro_cnes, nome_ubs, bairros, localidades):
    """Bairro da base territorial correspondente. Ordem: bairro igual, localidade igual,
    prefixo (campo truncado no CNES) e nome da UBS contendo o bairro/localidade."""
    nb, nn = norm(bairro_cnes), norm(nome_ubs)
    por_bairro = {norm(b): b for b in bairros}
    por_local = {norm(l): b for l, b in localidades}
    if nb in por_bairro:
        return por_bairro[nb]
    if nb in por_local:
        return por_local[nb]
    for tabela in (por_bairro, por_local):
        for k, v in tabela.items():
            if len(nb) >= 6 and (k.startswith(nb) or nb.startswith(k)):
                return v
    for tabela in (por_bairro, por_local):
        for k, v in tabela.items():
            if len(k) >= 5 and k in nn:
                return v
    return None


def main():
    base = json.load(open(os.path.join(RAIZ, "data", "dados.json"), encoding="utf-8"))["bairros"]
    bairros = [b["nome"] for b in base]
    localidades = [(l["nome"], b["nome"]) for b in base for l in b["localidades"]]
    bruto = baixar()
    ubs = []
    for x in bruto:
        nome = x["nome_fantasia"]
        if "BASICA DE SAUDE" not in nome or x["codigo_motivo_desabilitacao_estabelecimento"] or x["descricao_esfera_administrativa"] != "MUNICIPAL":
            continue
        lat, lng = x["latitude_estabelecimento_decimo_grau"], x["longitude_estabelecimento_decimo_grau"]
        if not lat or not lng:
            continue
        curto = re.sub(r"^UNIDADE BASICA DE SAUDE\s+", "", nome)
        num = (x["numero_estabelecimento"] or "").strip()
        num = "s/n" if num.upper() in ("S/N", "SN", "") else num
        rua = bonito(x["endereco_estabelecimento"] or "")
        ubs.append(
            {
                "id": x["codigo_cnes"],
                "nome": "UBS " + bonito(curto),
                "bairro": bonito(x["bairro_estabelecimento"] or ""),
                "bairroBase": bairro_base(x["bairro_estabelecimento"], curto, bairros, localidades),
                "end": f"{rua}, {num}".strip(", "),
                "cep": x["codigo_cep_estabelecimento"] or "",
                "tel": (x["numero_telefone_estabelecimento"] or "").strip(),
                "turno": turno(x["descricao_turno_atendimento"]),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "atualizado": x["data_atualizacao"],
            }
        )
    ubs.sort(key=lambda u: u["nome"])
    saida = {
        "fonte": "CNES/DATASUS — Dados Abertos (apidadosabertos.saude.gov.br), município 221100 Teresina-PI, tipo 2 (Centro de Saúde/Unidade Básica)",
        "consulta": date.today().isoformat(),
        "aviso": "Localização e cadastro conforme o CNES. Não representa a área de abrangência oficial de cada UBS.",
        "ubs": ubs,
    }
    json.dump(saida, open(os.path.join(RAIZ, "data", "ubs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    com_base = sum(1 for u in ubs if u["bairroBase"])
    print(f"{len(ubs)} UBS gravadas em data/ubs.json ({com_base} com bairro na base territorial).")


if __name__ == "__main__":
    main()
