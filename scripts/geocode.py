"""Gera data/coords.json (latitude/longitude de CRAS, CREAS e centros) usando o Nominatim/OpenStreetMap.
Rode no SEU computador, com internet:  python3 scripts/geocode.py   (leva ~1 min; 1 consulta por segundo)
Depois confira no mapa os pontos que ficarem fora do lugar e corrija à mão no coords.json."""
import json, re, time, urllib.request, urllib.parse, os
raiz=os.path.join(os.path.dirname(__file__),"..")
d=json.load(open(os.path.join(raiz,"data","dados.json"),encoding="utf-8"))
limpa=lambda e:re.sub(r"\s+"," ",re.sub(r"n[ºª°]\s*","",re.sub(r"\bs/?n\b[º°]?","",re.sub(r"ponto de refer[eê]ncia:.*","",re.sub(r"\(.*?\)","",e,flags=re.I),flags=re.I),flags=re.I),flags=re.I)).strip()
def geo(q):
    u="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&viewbox=-43.1,-4.8,-42.5,-5.4&q="+urllib.parse.quote(q)
    r=urllib.request.Request(u,headers={"User-Agent":"territorio-em-rede-prototipo"})
    j=json.load(urllib.request.urlopen(r,timeout=30)); time.sleep(1.1)
    return {"lat":float(j[0]["lat"]),"lng":float(j[0]["lon"])} if j else None
itens=[("u:"+u["nome"],u["endereco"],"") for u in d["unidades"]]+[("c:%s"%c["id"],c["endereco"],c["bairro"]) for c in d["centros"]]
out={}
for k,e,b in itens:
    r=geo(limpa(e)+", Teresina, Piauí") or (geo(b+", Teresina, Piauí") if b else None)
    out[k]=r if r else {"fail":True}; print(k,out[k])
json.dump(out,open(os.path.join(raiz,"data","coords.json"),"w"),indent=1)
