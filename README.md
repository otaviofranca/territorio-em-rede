# Território em Rede (protótipo)

Site estático de apoio matricial e territorial: localiza o território do usuário (bairro → CRAS, CREAS, centros de convivência, UBS de referência), mostra mapa e apoia a construção do PTS. Funciona no GitHub Pages, sem servidor.

## Publicar no GitHub Pages
1. Crie um repositório no GitHub (ex.: `territorio-em-rede`) e envie **o conteúdo desta pasta** (index.html, css/, js/, data/, .nojekyll).
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. Em ~1 minuto o site abre em `https://SEU-USUARIO.github.io/territorio-em-rede/`.

## Carregar as UBS
No site, aba **Dados** → importar o KML baixado do Google My Maps da rede de saúde. Para que todos vejam as UBS sem importar, copie o arquivo `.kml` para `data/` e peça a inclusão automática (próximo passo).

## Posições no mapa
O mapa posiciona CRAS/CREAS/centros pelo endereço via OpenStreetMap ao abrir. Para ficar fixo e rápido, rode no seu computador `python3 scripts/geocode.py` e envie o `data/coords.json` gerado.

## Atualizar os dados
Os CSVs ficam fora do site; `scripts/build_json.py` gera `data/dados.json`.

## Limites do protótipo
- Os casos de PTS e registros matriciais ficam **só no navegador** de quem usa (não há login nem banco compartilhado). Para vários usuários com login é preciso um banco externo (ex.: Supabase) — o site continua no GitHub Pages.
- A Base Territorial é de março/2020; confirme com a gestão.
- Use apenas dados fictícios (LGPD).
