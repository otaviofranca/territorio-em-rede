"use strict";
/* Textos do manual (conteúdo fornecido pela pesquisa). Não depende de outros scripts. */

const NOME_SITE = "Manual Técnico de Apoio Matricial e Territorial";

const PTT =
  "Este site constitui o Produto Técnico-Tecnológico (PTT) vinculado a uma pesquisa de Mestrado Profissional aprovada pelo Comitê de Ética em Pesquisa (CEP/UESPI, Parecer nº 8.517.678) desenvolvido no âmbito do MESTRADO PROFISSIONAL EM SAÚDE DA FAMÍLIA (PROFSAÚDE), como requisito parcial para a obtenção do título de mestre(a) em Saúde Pública/Família, vinculado à Universidade Estadual do Piauí (UESPI).";

const AVISO =
  "Ferramenta de apoio pedagógico e gerencial. Não utilize nomes reais de pacientes. Os dados inseridos nesta simulação ficam salvos apenas localmente no navegador do usuário e não são armazenados em servidores externos, em conformidade com a LGPD e as diretrizes éticas de pesquisa.";

/* ---- Aba inicial ---- */
const TXT_INICIO = `<section class="card texto">
  <h2>Apoio matricial</h2>
  <p>O matriciamento é um modo de produzir saúde, no qual duas ou mais equipes, em um processo de construção compartilhada, criam uma proposta de intervenção pedagógico-terapêutica.</p>
  <p>A proposta busca integrar os conhecimentos das equipes e construir estratégias de cuidado que considerem o contexto de vida do usuário, sua família e seu território.</p>
  <p>O matriciamento constitui-se numa ferramenta de transformação, não só do processo de saúde e doença, mas de toda a realidade dessas equipes e comunidades.</p>
  <p class="ref"><b>Referência da citação:</b> (CHIAVERINI, 2011, p. 14).</p>
</section>`;

/* ---- Aba do PTS ---- */
const TXT_PTS = `<section class="card texto">
  <h3>Projeto Terapêutico Singular (PTS)</h3>
  <div class="texto-fig">
    <div>
      <p>Cada indivíduo e sua família têm seu projeto terapêutico, que depende de suas redes pessoais, sociais e dos recursos da comunidade, da rede de serviços de saúde e intersetoriais necessárias.</p>
      <p>O PTS deve considerar a singularidade de cada pessoa, reconhecendo suas relações, potencialidades, necessidades e os recursos disponíveis em seu território.</p>
      <p>Segundo Sluzki (1997, p. 37), no trabalho em redes, as fronteiras do indivíduo não estão limitadas por sua pele, mas incluem tudo aquilo com que o sujeito interage, como família e meio ambiente. O sistema significativo do indivíduo também abrange seus vínculos interpessoais, incluindo família, amigos, relações de trabalho, estudo, inserção comunitária e práticas sociais.</p>
      <p class="ref"><b>Fonte:</b> Sluzki (1997, p. 37 apud CHIAVERINI, 2011, p. 202).</p>
    </div>
    <figure class="fig">
      <figcaption><b>Figura 1 –</b> Diversos equipamentos e atores interagindo de forma dinâmica numa rede.</figcaption>
      <img src="img/figura-1-rede.jpeg" width="1774" height="984" alt="Diagrama em elipses: o indivíduo está dentro da família, que está dentro da rede social, que está dentro da comunidade. A escola e os serviços de saúde são elipses que atravessam essas camadas.">
      <p class="ref">Fonte: Chiaverini (2011, p. 202).</p>
    </figure>
  </div>
</section>`;

/* ---- Aba do apoio matricial ---- */
const TXT_REDE = `<section class="card texto">
  <h3>Trabalho em rede e matriciamento</h3>
  <p>Rede é sempre algo que une, que entrelaça, que apanha, que amortece, que interconecta, que comunica, que vincula por meio de sua ligação, de seus nós, e que por isso, quando bem instrumentalizada na saúde, possibilita a melhor visão do sistema, seja do indivíduo, de sua família ou de sua comunidade, melhorando a resolubilidade da atenção.</p>
  <p class="ref"><b>Referência:</b> (CHIAVERINI, 2011, p. 199).</p>
  <p>O matriciamento é um exercício da rede em que a atenção primária (ESF), junto à saúde mental, constrói projetos terapêuticos, incluindo qualquer ator da rede necessário para aquele indivíduo e sua família. E a principal ferramenta no ambiente da Estratégia de Saúde da Família é, sem dúvida, a comunicação. É por meio dela que emanam diagnósticos e intervenções. Mais do que isso, qualquer procedimento, por mais técnico e científico que seja, jamais será possível sem o intermédio da comunicação.</p>
  <p class="ref"><b>Referência:</b> (CHIAVERINI, 2011, p. 177).</p>
</section>`;

/* ---- Modalidades do matriciamento ---- */
const MODALIDADES = [
  "Discussão de caso em reunião de equipe",
  "Interconsulta / Atendimento conjunto",
  "Visita domiciliar compartilhada",
  "Articulação intersetorial no território",
];
