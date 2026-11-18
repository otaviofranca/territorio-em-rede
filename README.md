# Manual Técnico de Apoio Matricial e Territorial

Site estático de apoio matricial e territorial (Teresina-PI): localiza o território do usuário (bairro, localidade, UBS ou endereço → CRAS, CREAS, centros de convivência, UBS de referência), mostra o mapa, apoia a construção do **PTS** e o registro do **apoio matricial**, com impressão/exportação em PDF. Funciona no GitHub Pages, sem servidor.

> Este site constitui o Produto Técnico-Tecnológico (PTT) vinculado a uma pesquisa de Mestrado Profissional aprovada pelo CEP/UESPI (Parecer nº 8.517.678), no âmbito do PROFSAÚDE/UESPI. **Use apenas dados fictícios** (LGPD).

## Telas
| Tela | O que faz |
| --- | --- |
| **Início** | Texto sobre apoio matricial (Chiaverini, 2011) e indicadores da base. |
| **Localizar** | Busca por **bairro ou localidade**, por **UBS (nome)** ou por **endereço**. Ex.: “Vila da Paz” é *localidade* do bairro Três Andares; “UBS Nossa Senhora da Paz” é a UBS dessa localidade. |
| **Mapa** | CRAS, CREAS, centros de convivência e as 91 UBS (CNES) no OpenStreetMap. |
| **PTS** | Texto e Figura 1 (rede), casos, recursos do território, ações, observações; **Exportar / Imprimir resumo do PTS e Matricial** e **formulário em branco**. |
| **Apoio matricial** | Texto “Trabalho em rede e matriciamento” e ficha com identificação (UBS/ESF, profissional, apoiador), modalidade, síntese, pactuação (APS / CAPS AD / intersetorial) e data de reavaliação; imprime cada ficha ou a ficha em branco. |
| **Dados** | Backup dos registros e importação opcional do KML das áreas oficiais de cada UBS. |

Na janela de impressão do navegador, escolha **“Salvar como PDF”** para exportar.

## Publicar no GitHub Pages
**Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.

## UBS
`data/ubs.json` traz as **91 UBS municipais ativas de Teresina** do **CNES/DATASUS** (dados abertos), com endereço, telefone e coordenadas. Para atualizar: `python scripts/build_ubs.py` (precisa de internet).

- O CNES **não** informa a **área de abrangência** de cada UBS. Por isso, para um endereço o site mostra a UBS **mais próxima** e avisa que *não é área oficial*; para um bairro, as UBS cadastradas nele (*possível, confirmar*).
- Se a Fundação Municipal de Saúde fornecer o mapa com as áreas (KML), importe em **Dados**: a UBS passa a ser indicada pela área.
- `bairroBase` liga cada UBS a um bairro da base territorial (por bairro, localidade ou nome); é uma aproximação.

## Posições no mapa
`data/coords.json` (gerado por `python scripts/geocode.py`, Nominatim/OSM) já vem preenchido. Pontos marcados `"aprox": true` estão posicionados só pelo bairro e aparecem mais claros, com aviso. Confira e corrija à mão o que estiver fora do lugar.

## Dados territoriais
`scripts/build_json.py` gera `data/dados.json` a partir de CSVs que **não estão** neste repositório (Base Territorial CRAS/SEMCASPI, março/2020; população do Censo 2010).

## Privacidade e limites
- Casos de PTS e registros matriciais ficam **só no navegador** de quem usa (sem login e sem banco compartilhado). Faça backup em **Dados**.
- A busca por **endereço** envia o texto ao OpenStreetMap (serviço externo); o site pede ciência uma vez por sessão. Buscas por bairro, localidade e UBS não enviam nada para fora. O botão “Ver UBS mais próximas” envia **só o nome do bairro**.
- A base territorial é de 2020; confirme com a gestão antes de uso real.
- A ferramenta apoia a reflexão da equipe e **não prescreve condutas**.

## Estrutura
```
index.html          casca (cabeçalho, rodapé do PTT, área de impressão)
css/style.css       estilos, folha de impressão (.f-*)
js/conteudo.js      textos do manual, aviso de LGPD, modalidades
js/ubs.js           UBS (busca, bairro, mais próximas)
js/imprimir.js      resumo do PTS, ficha de matriciamento e formulários em branco
js/app.js           telas, regras e roteamento
data/               dados.json, ubs.json, coords.json
img/                Figura 1 (Chiaverini, 2011, p. 202)
scripts/            build_json.py, build_ubs.py, geocode.py
```
