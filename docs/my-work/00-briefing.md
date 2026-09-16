# My Work: briefing para retomar

Porta de entrada do assunto. Quando voltar ao My Work, comece aqui. A evidência completa,
com arquivo:linha para cada afirmação, está em `01-feedback-analysis.md`.

**Estado em 16/09/2026:** seções 10 e 11 implementadas e em produção (regra do passo por
prazo, filtros, colunas, coluna Language). Em aberto: J2, a mistura A + C dos mockups aguarda
aprovação (B descartada); a lista de consertos no Monday está guardada em `02-monday-fixes.md`; o plano do
Report para team leaders (J5, opção c) está em `03-report-for-team-leaders-plan.md`.

> **Não envie nada à equipe a partir do `01-feedback-analysis.md`.** As respostas prontas
> daquele arquivo foram escritas antes da verificação, e sete delas estão erradas. As
> respostas válidas são as da seção 2 deste documento.

---

## 1. O que chegou

### Jeannette Owens, email de 31/08/2026, "Feedback on My Work area of your app"

> Hi Arnaldo,
>
> I think the biggest win here is it can show all of someone's tasks across all of the
> boards in one place. Potentially very handy for balancing team member workloads.
>
> It would be nice if clicking a task opened up the monday task directly rather than the
> history. Maybe make the option to open the history a secondary option.
>
> But we need to audit and clean up our monday boards I think to make it useful.
>
> I have 700+ tasks showing, most which aren't actually active or relevant. And none of
> them are actually my priority tasks right now.
>
> I know you said you were making filters on the back end of the app to clean up the
> results, but it is the monday boards themselves that need to be cleaned up. Like
> non-english AAAF pages on the publishing board are supposed to skip On-page SEO.
> Something is broken in the automation. Old boards or old tasks with status types not
> recognized as "done" are showing up. Some of these old unused boards and old tasks
> probably could be archived.
>
> Thanks,
> Jeannette Owens

### Segunda revisora, Stephanie Aguirre

O nome não veio no texto, e foi deduzido da captura (as seis linhas estão no nome dela, e
ela escreve "It shows I have 6 that are late"). Confirmado por você em 15/09.

**Item 1 - Portal**

> Here are my summary points after I looked at the "My Work" section of the new portal:
>
> 1. There is no Monday link on the far right of each item
> 2. Most of the overdue items that are showing up in my list are not overdue because of
>    my step in the workflow, but rather other people's steps not being completed on time
>    after mine.
> 3. I know we already talked about this, but tasks are in the list from years ago.
> 4. Certain tasks are still in the list even though the workflow stops with me if I
>    change the status in Monday to something in particular. This is happening with the
>    AAAF photo curation audits. If I mark something as "No edits needed", this should
>    remove the task from my to-do list because there is nothing more that needs to be
>    done (for me or anyone else).
> 5. This is also the same on the BM photo curation audit board when I change the status
>    to "Not Relevant". It still appears in my to-do list even though nothing is going to
>    be done on that page.
> 6. Is there a way to filter the list? Maybe by status or due date? Or to be able to sort
>    from soonest due date to latest, or other sorting options?
> 7. Not reaching our AAAF 2 pages per week goal, only 7 pages in the pipeline to be
>    published, is Wendy holding back because Amy is not sending a lot of pages through?

**Item 4 - Portal**

> The first picture is the portal showing the BM General Audit tasks. It shows I have 6
> that are "late". The second picture is Monday showing the same tasks, however mine are
> marked Done and Jeannette's are marked Stuck. Also, B82 is showing as Stuck on the portal
> but Hasn't Started in Monday. And honestly, that's what a lot of my to-do list is - tasks
> that are stuck on other people's steps

Com duas capturas: a lista do portal (BM - General Audits, passo "Kick-Off", status
"LET'S DO THIS!", badge LATE em todas) e o mesmo board no Monday (Audit = Done,
SEO Review = Stuck ou Hasn't Started Yet).

### Sua observação ao me mandar

Você achou que uma delas tinha visto o Workload, que ainda não está pronto. **Pela
configuração de acesso atual, nenhuma das duas consegue abrir o Report:** as duas são
`team_leader`, e `access_level_pages` tem `team_leader / report = false` (verificado em
14/09). O mais provável é que a pergunta do pipeline (A8) venha do Publishing Goals, e que
o balanceamento de carga (J5) seja uma ideia da Jeannette, não uma reação à tela.

---

## 2. As respostas

Cada item leva uma etiqueta usada em todo o material: **J** para a Jeannette, **A** para a
segunda revisora.

**Veredito:** *falta no portal* (legítimo, não existe, construir) · *bug do portal* (existe
e está errado) · *dados do Monday* (o problema está nos boards) · *não é o My Work*.

**Verificação:** *verificado por mim* significa conferido no banco ou no código em 10/09 ou
14/09. *Afirmado pelos agentes* significa que resistiu à contestação de três agentes, mas
não conferi pessoalmente.

### J1. Clicar na tarefa abrir o Monday, histórico como opção secundária

- **Veredito:** falta no portal. Pequeno, impacto médio.
- **Resposta:** Hoje clicar na linha abre o painel de histórico, e o link do Monday fica na
  última coluna. Só que esse link não aparece para quem não é admin (ver A1), então para ela
  o pedido vale em dobro. Vamos inverter: a linha abre o item no Monday em nova aba, e o
  histórico vira um botão pequeno na linha. Linha sem link continua abrindo o histórico.
  Subitem abre o item pai, porque subitem não tem página própria no Monday.
- **Fase:** 1.

### J2. 700+ tarefas, quase nada ativo, nada é prioridade

- **Veredito:** falta no portal. Médio, impacto alto.
- **Resposta:** O My Work mostra todo passo já atribuído que o Monday não marcou como
  concluído, **sem limite de idade para trabalho aberto**. Não há filtro por status, board
  ou prazo, nem ordenação por coluna. "Priority" é do board, definida por admin, não da
  tarefa, então nunca significa "o que fazer hoje". Dois fatores inflam a lista:
  - rótulos que significam "nada a fazer" e que o board não registrou como concluídos:
    **961 linhas abertas em 18 boards** (verificado por mim);
  - todo campo de pessoa de todo board vira passo automaticamente: **517 passos, todos
    palpites, nenhum revisado** (verificado por mim).
- **Fase:** 2 e 3.
- **Cuidado:** não sugerir ligar a chave de esconder boards parados. Está quebrada (J4).

### J3. Páginas AAAF não-inglês deveriam pular On-page SEO

- **Veredito:** dados do Monday. Mantido.
- **Resposta:** Ela está certa, e o portal só reflete o board. De 518 páginas não-inglês,
  só 191 estão "Not Relevant" em On-page SEO; 204 estão Done, 106 em branco, 17 Stuck. No
  sentido inverso, **95 páginas em inglês estão "Not Relevant"**, e são justamente as que
  deveriam receber On-page SEO. Essas vêm primeiro, porque podem afetar o site no ar. O
  conserto é no Monday: a automação e a limpeza.
- **Verificação:** afirmado pelos agentes, números de 10/09.

### J4. Boards e tarefas antigos com status não reconhecido como "done"

- **Veredito:** falta no portal. Derrubado (era "dados do Monday").
- **Resposta:** Boards antigos já podem ser escondidos hoje, um a um, em Configurações
  (Shown / Not shown), e isso tira as linhas na hora. Existe também uma chave que esconde
  boards sem atividade há seis meses. Está desligada e **está quebrada**: o board escondido
  sai da fila de leitura, a data de atividade dele nunca mais atualiza, e ele nunca volta,
  embora o rótulo da chave prometa que volta. Tarefas antigas: o portal não tem como dizer
  "este rótulo encerra o passo" nem como esconder trabalho aberto antigo. Arquivar no
  Monday funciona: some no próximo pull.
- **Fase:** 2 (filtro de idade) e 3 (override de rótulo, conserto da chave).
- **Verificação:** afirmado pelos agentes.

### J5. Tudo de uma pessoa num só lugar, útil para balancear carga

- **Veredito:** falta no portal. Derrubado (era "já existe").
- **Resposta:** A lista de uma pessoa através de todos os boards já existe: Everyone e
  depois o seletor de pessoa ou time. O limite de 5.000 linhas cai ao escolher. O
  balanceamento existe como aba Workload do Report, mas não chega a ela: **team leader não
  abre o Report** (verificado por mim), e o filtro de pessoa do Workload não funciona
  (escreve na URL, a página não lê). Dentro do My Work não há comparação lado a lado.
- **Decisão sua:** team leaders devem ver o Report?

### A1. Não tem link do Monday à direita de cada item

- **Veredito:** **bug do portal**. Derrubado (era "já existe"). Verificado por mim.
- **Resposta:** Ela está certa. O link existe no código mas está **morto para todo
  não-admin**. `app_settings` só é legível por admin (migration 052); a página lê o nome da
  conta Monday com o cliente da própria pessoa (`data.ts:165`), recebe nulo, e toda linha
  mostra um traço. O link do painel de histórico some junto. Admin vê normalmente, por isso
  ninguém da gestão percebeu. Conserto pequeno: ler esse valor com o cliente privilegiado
  dentro de `loadWorklist`, que o Report também usa.
- **Fase:** 1, primeiro item.

### A2. Os atrasos são de passos de outras pessoas

- **Veredito:** falta no portal. Grande, impacto alto. Mantido.
- **Resposta:** Ela está certa. O portal pega **uma única data por item** e carimba em
  todos os donos de passos daquele item. Não sabe de quem é a vez, então todo passo aberto
  de um item atrasado aparece atrasado, inclusive o que ela já entregou.
- **Fase:** 4 (prazo por passo; "comigo agora" contra "aguardando outro passo").

### A3. Tarefas de anos atrás

- **Veredito:** falta no portal. Derrubado (era "dados do Monday").
- **Resposta:** São linhas abertas sem limite de idade. Parte é do Monday (itens que
  ninguém fechou), mas **parte é fabricada pelo portal**: passo sem coluna de status
  pareada fica aberto para sempre, e nada que ela faça no Monday o fecha (11 passos assim,
  verificado por mim). E a ordenação coloca os mais atrasados, que são os mais velhos, no
  topo da lista.
- **Fase:** 2 (filtro de idade) e 3 (reparar pareamento).

### A4. "No edits needed" em AAAF photo curation deveria tirar da lista

- **Veredito:** falta no portal. Derrubado (era "dados do Monday").
- **Resposta:** O portal não lê o texto do status; só considera concluído o rótulo que o
  próprio board marca como done. Pode ser configuração do board, mas também pode ser o
  portal lendo a coluna errada ou um passo sem par, e nenhuma edição no Monday resolve
  esses dois casos. O portal também não mostra qual coluna está lendo, nem deixa dizer
  "este rótulo encerra o passo".
- **Pista para retomar:** só existem **8 linhas abertas com "No edits needed"** no portal
  inteiro (verificado por mim). Poucas demais para ser só configuração: vale conferir o
  pareamento desse board antes de pedir qualquer mudança no Monday.
- **Fase:** 3.

### A5. "Not Relevant" no BM photo curation continua aparecendo

- **Veredito:** dados do Monday. Mantido.
- **Resposta:** No board BM - Photo Curation Audits, "Not Relevant" nunca foi registrado
  como done naquela coluna, enquanto em outros boards o mesmo rótulo fecha a linha. Conserto
  imediato: o dono do board marca "Not Relevant" como done, e 37 linhas saem no próximo
  pull. **Efeito colateral:** muda as baterias e as barras de progresso desse board no
  Monday, para todos. A alternativa sem esse efeito é o override no portal (fase 3).
- **Verificação:** o total de 961 linhas em 18 boards, verificado por mim; as 37 deste
  board, afirmado pelos agentes.

### A6. Filtrar por status ou prazo, ordenar

- **Veredito:** falta no portal. Pequeno, impacto alto. Mantido.
- **Resposta:** Não existe. Os controles hoje são busca, Mine/Everyone, pessoa, time e
  mostrar concluídos. A lista ordena pela prioridade do board antes do prazo, então nunca
  fica "mais próximo primeiro". A busca finge em parte: digitar "late" também traz tudo com
  "Translate" no nome.
- **Fase:** 2.

### A7. BM General Audits: 6 "late" no portal, Done no Monday; B82 diverge

- **Veredito:** **bug do portal**. Médio, impacto alto. Mantido. Verificado por mim.
- **Resposta:** O portal lê a coluna errada. O passo dela foi pareado com uma coluna que
  nunca fica concluída ("Kick-Off", status "Let's do this!", visível na captura dela):
  **127 linhas, zero concluídas, 116 marcadas atrasadas**. Outro passo do mesmo board
  funciona normalmente: 92 de 113 concluídos. Segundo os agentes, o mesmo erro está em
  "Audit Type" (BM - Publishing) e "Design Needs" (HFA - AI Writing), somando cerca de 500
  badges de atraso no portal. Nada a mudar no Monday.
- **B82, não resolvido:** os agentes dizem que o portal mostra a coluna SEO Review, que
  mudou para "Stuck" em 30/08. A captura do Monday mostra B82 como "Hasn't Started Yet"
  nessa mesma coluna. Reverificar ao retomar.
- **Fase:** 3 (re-parear) e 4 (não pintar atraso em passo que não tem como concluir).

### A8. Meta AAAF de 2 por semana; a Wendy está segurando porque a Amy não manda?

- **Veredito:** não é o My Work; parte já existe. Derrubado.
- **Resposta:** A meta de "2 por semana" é a de **inglês** do AAAF. Nas últimas quatro
  semanas completas (10/08 a 06/09) saíram **0, 0, 0 e 1** (verificado por mim). A fila
  para publicar tem **inglês 5, português 22, espanhol 22, suaíli 22** (verificado por mim).
  O gargalo é inglês, não tradução: não é a Wendy segurando, é pouca página em inglês
  chegando na fila.
  - Onde ver cada página: Publishing Goals, card "Total Items - Not Published", que filtra a
    tabela com Current stage, Assignee e Time in stage (afirmado pelos agentes; não
    conferi na tela).
  - Limite: as etapas do AAAF Publishing não têm coluna de dono, então Assignee mostra seis
    colunas de pessoa juntas. Dizer se é a Amy exige mapear qual coluna de pessoa pertence a
    qual etapa, com quem conhece o board.
  - Se ela contou os 7 no My Work, contou passos, não páginas.
- **Achados paralelos (verificados por mim):** Gad Rukundo publica no AAAF e não está na
  lista de publishers, então o trabalho dele não conta nas metas (1 item até hoje, 0
  recentes). O HFA publicou 32 itens em francês, e não existe meta de francês.

---

## 3. O que a análise achou além do feedback

A varredura independente achou **51 problemas, 17 graves**. Os mais relevantes, todos
afirmados pelos agentes e não conferidos individualmente:

- Um login sem pessoa no Diretório vê, por padrão, a lista de trabalho da empresa inteira.
- Desligar um passo não tem efeito imediato; num board com todos os passos desligados, as
  linhas nunca somem.
- Na visão Everyone, o corte de 5.000 linhas é feito pelo id da linha, não por urgência, e
  gira a cada leitura do Monday.
- "Finished work: all of it" empurra trabalho aberto para fora da visão Everyone.
- O aviso de que um filtro de time está escondendo trabalho nunca consegue aparecer.
- O Report conta trabalho de boards e passos desligados, não mostra a idade dos dados, e o
  PDF e o CSV carimbam a data de impressão ou download, não a da leitura do Monday.
- Nada impede duas leituras do Monday rodando ao mesmo tempo, e a escrita apaga e reinsere
  contra uma chave única, podendo deixar um board pela metade.
- Uma falha num único board derruba a cadeia inteira de leitura e não deixa registro.

---

## 4. Plano de implementação

**O risco que define a ordem.** Toda alavanca deste plano esconde trabalho, e o módulo já
tem um precedente ruim: a chave de boards parados promete trazer o board de volta e não
consegue. Trocar "lista longa demais para confiar" por "lista da qual somem coisas" é pior,
porque linha que falta não gera reclamação até alguém perder um prazo. Por isso, todo filtro
novo precisa: mostrar quantas linhas está escondendo, desfazer em um clique, nunca ser
aplicado em silêncio como padrão, e valer igual no My Work e no Report.

### Fase 1: parar a lista de mentir

*1 a 2 dias. Sem mudança de schema, sem mudança no Monday. Não esconde nada.*

1. Link do Monday para todos: ler o slug com o cliente privilegiado dentro de
   `loadWorklist`, com um teste em que `app_settings` volta vazio.
2. Inverter o clique da linha: linha abre o Monday, histórico vira botão (J1).
3. Contadores contarem o que aparece na tela, não o que foi buscado.
4. Desligar um passo ter efeito imediato.
5. Rodapé de atualização honesto (só boards de fato na fila; contar os nunca lidos) e um
   estado de falha visível para a leitura do Monday.
6. Consertar o aviso de trabalho não vinculado, que hoje nunca aparece.

### Fase 2: dar alavancas a quem usa a página

*Cerca de uma semana. Sem mudança de schema.*

1. Cortar as linhas por urgência (status, depois prazo), não por id.
2. Filtros na URL: status, board, workspace, grupo do Monday, janela de prazo, idade do
   trabalho aberto. Os dados já existem em cada linha; só não são usados.
3. Cabeçalhos ordenáveis, e ordenar por prazo de verdade, sem a prioridade do board na
   frente.
4. Visão padrão enxuta, com "mostrar tudo" em um clique e a contagem do que ficou de fora.
5. Prioridade entrar na busca; parar de reordenar até 5.000 linhas a cada tecla.

### Fase 3: consertar o "concluído"

*1 a 2 semanas. Duas tabelas pequenas. Reverte uma decisão documentada.*

1. Guardar colunas e rótulos dos boards, que já são lidos e jogados fora.
2. Override por coluna: "este rótulo encerra o passo". Reverte a decisão registrada em
   `ingest.ts:14-17` de deixar só o Monday decidir. Tratar como decisão, não como remendo.
3. Re-parear um passo à coluna de status certa, na tela de revisão de passos.
   BM - General Audits é o caso exemplo.
4. Passos que nunca podem ser concluídos no topo da fila de revisão.
5. Revalidar passos confirmados quando a coluna some ou é tomada por outro passo.
6. Consertar a volta da chave de boards parados antes que alguém a ligue.
7. Relatório de rótulos por board, para mirar a limpeza no Monday.

### Fase 4: parar de culpar uma pessoa pelo passo de outra

*Cerca de duas semanas. Mudança de schema e ajuste do Report no mesmo pacote.*

1. Prazo por passo, com a data do board como reserva.
2. Posição do passo carregada na linha; "aguardando outro passo" quando não é a vez dela.
3. Não pintar atraso em linha concluída, nem em passo sem estado de conclusão.
4. Mostrar na grade qual coluna de data é o prazo.
5. O Report mudar junto, senão as duas telas passam a se contradizer.

### Fase 5: leitura confiável e o Report admitir a idade dos dados

*Cerca de duas semanas.*

1. Falha de um board não derrubar a cadeia; tabela registrando cada execução.
2. Retry, espera e timeout nas chamadas ao Monday; paginar as leituras grandes.
3. Guarda do cron sempre ativa; impedir execuções sobrepostas; gravar com upsert.
4. Desativar boards que sumiram do Monday.
5. Report com as mesmas exclusões do My Work, e a idade dos dados na tela, no PDF e no CSV.
6. Consertar o filtro de pessoa do Workload.

---

## 5. O que só o Monday conserta

- Rótulos terminais não registrados como done: 961 linhas em 18 boards. Ou esperar o
  override da fase 3, que evita mexer nas baterias dos boards.
- A automação de skip de On-page SEO do AAAF, e as 95 páginas em inglês marcadas
  Not Relevant.
- Boards sem uso: arquivar no Monday é mais honesto que esconder aqui, e para de gastar
  leitura.
- Itens parados em grupos Done ou Archive sem rótulo de concluído.
- Boards com coluna de dono e sem coluna de status para esse dono.
- Prazos em colunas com nome que o portal não reconhece como prazo.
- Pessoas que saíram, e contas Monday com email diferente do Diretório.
- Qual coluna de pessoa pertence a qual etapa no AAAF e no HFA Publishing.

---

## 6. Decisões que dependem de você

1. Começar pela fase 1?
2. Team leaders devem ver o Report e o Workload? Jeannette e Stephanie são team leader e
   hoje não veem.
3. Aceitar o override de rótulo no portal (fase 3), revertendo a regra de que só o Monday
   decide o que é concluído?
4. Quem conversa com os donos dos boards sobre a limpeza no Monday?
5. Gad Rukundo deve contar como publisher? O francês do HFA deve ter meta?
6. Quais respostas mandar à Jeannette e à Stephanie, e quando: antes da fase 1, ou junto
   com ela?

---

## 7. O que está verificado e o que não está

Números são fotografia do dia em que foram tirados. O Monday muda todo dia.

**Verificado por mim**

- Link do Monday morto para não-admin: código, policy da migration 052, e slug configurado
  (`truenorthdigitalmarketing`). 10/09.
- BM - General Audits: passo com 127 linhas, 0 concluídas, 116 atrasadas; outro passo com
  92 de 113 concluídos. 14/09.
- 961 linhas abertas com rótulo terminal em 18 boards: Not Relevant 664, Not Needed 289,
  No edits needed 8. 14/09.
- 517 passos, todos palpite, nenhum revisado; 11 sem coluna de status pareada. 14/09.
- Jeannette Owens e Stephanie Aguirre são `team_leader`, e `team_leader` não abre o Report.
  14/09.
- Meta e fila do AAAF inglês; Gad Rukundo; francês do HFA. 10/09.

**Afirmado pelos agentes, resistiu à contestação, não conferido por mim**

- Números do On-page SEO do AAAF (518, 191, 204, 106, 17, 95).
- Cerca de 500 badges de atraso vindos dos três boards mal pareados.
- As 37 linhas do BM - Photo Curation Audits.
- A chave de boards parados não conseguir trazer um board de volta.
- O filtro de pessoa do Workload não funcionar.
- Os 51 achados da varredura independente.

**Não resolvido**

- B82 (ver A7).

**Correções**

- No dia 10 eu disse que o BM - General Audits tinha dois passos. A busca por nome pegou
  outro board "General Audits". O certo tem quatro, todos palpite.
- No dia 10 eu disse que cinco veredictos foram derrubados. Foram seis.
- Os agentes falaram em "174 passos" e "942 a 954 linhas". Hoje são 517 e 961. A
  conclusão se mantém; os números acompanham o Monday.

---

## 8. Antes de começar a implementar

- Reverificar os números da seção 7.
- Não ligar a chave de esconder boards parados.
- Não enviar os rascunhos de resposta do `01-feedback-analysis.md`.
- Ler o handoff de design em `Design/My Work : Report/` (`MyWork.dc.html`, `Report.dc.html`,
  `README.md`). Pode já definir os filtros e a ordenação da fase 2. Essa pasta não está no
  git.

---

## 9. Onde está tudo

| O quê | Onde |
| --- | --- |
| Este briefing | `docs/my-work/00-briefing.md` |
| Análise completa, 13 itens com evidência e 51 achados | `docs/my-work/01-feedback-analysis.md` |
| Consertos no Monday, guardados para depois | `docs/my-work/02-monday-fixes.md` |
| Report para team leaders (J5), plano | `docs/my-work/03-report-for-team-leaders-plan.md` |
| Mockups do J2 (só no ambiente local) | `/design-check/team-priority` (modelo decidido) e `/design-check/my-work-priority` (A + C) |
| Handoff de design do módulo (fora do git) | `Design/My Work : Report/` |
| Lista do My Work | `src/components/monday/WorkList.tsx` |
| Leitura, passos, ingest | `src/lib/monday/worklist/` |
| Página | `src/app/(app)/my-work/page.tsx` |
| Report e Workload | `src/lib/report/`, `src/components/report/` |
| Script do workflow de análise | `~/.claude/projects/-Users-arnaldodlanra-Downloads-Claude-01--TN-Op-Portal/3fe03310-9fac-4f58-bc25-d447fdb931c6/workflows/scripts/my-work-feedback-wf_794e258b-918.js` |

---

## 10. Decisões de 15/09 e o que foi feito

Você respondeu ponto a ponto em 15/09. O plano das seções 4 a 6 foi substituído por isto.

| Ponto | Sua decisão | O que foi feito |
| --- | --- | --- |
| J1 | Ícone do Monday na 1ª coluna, ícone de histórico na 2ª | Feito. Clicar na linha não abre mais nada |
| J2 | Prioridade do time, definida pelo team leader | Em 16/09: B descartada, A + C aprovada, e o modelo virou "prioridade do time": o team leader define uma ordem para o time (admin, para qualquer time), e cada pessoa vê os próprios passos nela, só leitura. Mockups em `/design-check/team-priority` (`?only=1`, `2`, `3`) |
| J3 | Lista separada de consertos no Monday | Lista feita; números reconferidos no Monday em 15/09 |
| J4 | Exemplos reais | Varredura feita (seção 11) e filtro "Last change" na lista |
| A1 | Mover para a 1ª coluna | Feito. O link também passa a ser montado para quem não é admin |
| A2 | Só o que está atribuído e não Done | Regra por prazo: cada passo lê o próprio status e o próprio prazo |
| A3 | Só status conectado a uma coluna de Deadline | É a regra do passo (`steps.ts`) |
| A4 | Resolve com A3 | Confirmado para o Assign; restam os "Not Relevant" do AAAF (lista do Monday) |
| A5 | Você marcou Not Relevant como Done no BM Photo Curation | Conferido na configuração do board em 15/09 |
| A6 | Implementar filtros e ordenação | Filtros de status, board, prazo e última alteração; cabeçalhos ordenáveis |
| A7 | Investigar | Confirmado: 14 das 19 linhas dela estão Done no Monday; B82 não é bug |
| A8 | Fora do escopo | Nada |

**A regra do passo.** O Monday não devolve pela API o vínculo do Deadline Mode (conferido nas versões 2024-10 a 2026-01), então o vínculo é lido do layout: cada coluna de data fecha um trecho; o passo é o último status do trecho que pode ficar Done e não é atributo (Priority, Type, Kick-Off, "... Needs"); o dono é a coluna de pessoa mais próxima. Uma pessoa com dois prazos seguidos (Editor 2) fica numa linha só, no estágio em aberto.

**Medido antes de implementar (dry run, 43 boards incluídos, 15/09):** Stephanie 341 abertas → 133; atrasadas 101 → 46. Jeannette 451 → 347; atrasadas 273 → 170. Todos 4.619 → 3.664.

**Dependências.** Migration 082 (`stages` em `monday_board_steps`, `due_col` em `monday_assignments`). O código funciona sem ela, com a regra antiga. Depois dela: descoberta + sincronização completa. A primeira sincronização não grava eventos falsos no histórico (linhas remapeadas e colunas que deixaram de ser passo são ignoradas pelo change log).

**Fica para depois:** J5 (team leaders verem o Report), a fase 5 (leitura resiliente do Monday), marcar "aguardando o passo anterior".

## 11. Exemplos do J4 (15/09)

- Boards com trabalho aberto todo velho: SOP's for the SEO's (54 abertas, nenhuma mexida há mais de 1 ano, várias com contas removidas), SOP's Development (55, 54 velhas), AAAF - General (briefs de estratégia de 2021, On Hold).
- "Not Relevant" que não conta como Done: Subitems of AAAF - Translations · Proof Design (538), Subitems of Graphics - Social Media · Overlays (432), AAAF - SEO & Writing · ReWrite 2 (291), AAAF - Photo Curation Audits · Writing (104).
- Itens em grupos "Completed" ainda abertos: AAAF - Social Media Planning (160), AAAF - Photo Curation Audits (109), AAAF - Schema Audits (36, 34 Stuck).
