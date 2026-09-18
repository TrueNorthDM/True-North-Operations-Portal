# My Work: consertos no Monday (guardado para depois)

Guardado em 16/09/2026 a seu pedido. Nada aqui é feito pelo portal: o My Work espelha o
Monday, e estes itens são configurações, automações e limpeza nos próprios boards. Cada um
tira linhas das listas das pessoas na sincronização seguinte (seis por dia).

**Números de 15 e 16/09/2026.** Mudam com o Monday todo dia: reconte antes de começar.

**Estado em 18/09, depois das mudanças que você fez no Monday** e de uma leitura completa (12:38
UTC). Passos abertos no My Work: 3.229 → 3.118. As suas mudanças fecharam os 107 "Not Relevant"
do AAAF - Photo Curation Audits (item 3). Os itens 3 e 5 abaixo mostram o que ainda está aberto.

**Decisões que ficaram em aberto:** quem faz cada item, e se o efeito colateral do item 3 é
aceitável.

---

## Em ordem de impacto

### 1. AAAF - Publishing: 95 páginas em inglês marcadas "Not Relevant" em On-Page SEO

- Páginas em inglês deveriam receber On-Page SEO. 95 delas estão como "Not Relevant", ou
  seja, podem ter sido publicadas sem SEO.
- É o primeiro porque afeta o site no ar.
- Contagem de 15/09 (lida do Monday): inglês 481 páginas, 382 Done, 95 Not Relevant, 4 em
  branco.
- **Não é sobre a lista de ninguém.** "Not Relevant" conta como concluído na coluna On-Page SEO
  desse board, então essas páginas não aparecem no My Work (conferido em 18/09: as 609 linhas
  da coluna estão concluídas). O problema é o conteúdo: páginas em inglês deveriam receber
  On-Page SEO, e "Not Relevant" nelas provavelmente está errado. É para a equipe de SEO revisar
  no Monday.

### 2. AAAF - Publishing: automação de pular On-Page SEO nas páginas que não são em inglês (J3)

- A Jeannette apontou: páginas em outros idiomas deveriam pular On-Page SEO, e a automação
  não está fazendo isso.
- De 529 páginas que não são em inglês: 207 Not Relevant (certo), 204 Done, 101 em branco,
  17 Stuck.
- Consertar a automação e acertar as 101 em branco e as 17 Stuck.

### 3. "Not Relevant" contar como Done

A mesma mudança que você fez no BM - Photo Curation Audits em 15/09. Nestas colunas, "Not
Relevant" existe mas não está marcado como concluído, então a linha fica aberta para
sempre.

| Board | Coluna | Linhas abertas (15/09) | Em 18/09, depois da leitura |
| --- | --- | --- | --- |
| Subitems of AAAF - Translations | Proof Design | 538 | 538 |
| Subitems of Graphics - Social Media | Overlays | 432 | 431 |
| AAAF - SEO & Writing | ReWrite 2 | 291 | 291 |
| AAAF - Photo Curation Audits | Writing (mais Approval e Implementation) | 104 | **0, feito** |
| Subitems of HFA - Translations | Proof Design | 15 | 13 |
| Web Dev & Tech Support | Status | 14 | 14 |

Nos boards "Subitems of ...", a configuração é a da coluna de subitem, mudada a partir do board
pai (por exemplo, Proof Design nos subitens do AAAF - Translations).

Cerca de 1.400 linhas saem das listas. **Reconferido em 18/09: 1.422 passos abertos no My Work**
com "Not Relevant" (ou "Canceled") numa coluna em que o Monday não marca esse status como
concluído; a tabela continua certa. Menores, além dela: AAAF - SEO & Writing, Brief Draft SEO
(7); Graphics - Social Media, Overlays (7); AAAF - Schema Audits, Audit (3). **Depois das suas
mudanças de 18/09: 1.315.**

**Efeito colateral:** as barras de progresso desses boards no Monday passam a contar essas
linhas como feitas. É por isso que é uma decisão sua, e não um ajuste técnico.

### 4. Photo Curation Audits (AAAF e BM): "No edits needed" fechar os passos seguintes

- Quando o Assign fica "No edits needed", ninguém mais precisa fazer nada naquela página,
  mas os passos seguintes (Photo Curation Audit, Approval, Writing, Implementation) ficam
  abertos.
- Uma automação no Monday: quando Assign = "No edits needed", marcar os passos seguintes
  como "Not Relevant".
- No portal, o Assign já não aparece mais (não tem prazo, regra de 15/09).

### 5. Itens em grupos "Completed" que continuam abertos

**Recontado em 18/09.** A tabela de 15/09 foi medida antes da regra do passo por prazo entrar,
quando o portal ainda lia a coluna de status errada em vários boards. Com a regra, o grupo
Completed do AAAF - Schema Audits não tem nada aberto (as 883 linhas estão concluídas; você
conferiu no Monday e não achou nada Stuck, e estava certo), e o do AAAF - Social Media Planning
caiu de 160 para 2. Hoje, passos que o My Work mostra em grupos com nome de trabalho terminado:
195. **Depois das suas mudanças e da leitura de 18/09: 88** (o Completed do AAAF - Photo Curation
Audits caiu de 108 para 1).

| Board | Grupo | Passos abertos (status) |
| --- | --- | --- |
| AAAF - Photo Curation Audits | Completed | 108 (107 Not Relevant, 1 Working on it) |
| SOP's for the SEO's | Archive | 28 (sai do My Work com a regra de boards parados) |
| Web Dev & Tech Support | Not Relevant | 14 (Not Relevant) |
| AAAF - Schema Audits | Not Relevant - DO NOT DELETE OR MOVE THESE | 13 (10 Stuck, 3 Not Relevant) |
| BM - General Audits | Completed | 10 (5 Hasn't Started Yet, 3 Stuck, 1 Working on it, 1 Not Relevant) |
| BM - Social Media Planning | Completed | 6 (5 Stuck) |
| Graphics - Social Media | Done | 4 |
| AAAF - General Audits | Completed | 3 |
| Outros 5 boards | Completed ou Not Relevant | 8 |

Os "Not Relevant" desta tabela se resolvem com o item 3. O resto é item movido para um grupo
de terminado sem o status acompanhar: uma automação "ao mover para Completed, marcar Done", ou
uma limpeza única.

### 6. Arquivar o que parou

| Board | Situação |
| --- | --- |
| SOP's for the SEO's | 54 linhas abertas, nenhuma mexida há mais de um ano, várias com contas removidas |
| SOP's Development | 55 linhas abertas, 54 sem mexer há mais de um ano |
| AAAF - General | Briefs de estratégia de 2021, em On Hold |

Arquivar no Monday é mais honesto que esconder no portal, e para de gastar leitura na
sincronização. Esconder o board também é possível: Settings → My Work sources, Shown / Not
shown.

---

## Depois de fazer

Peça uma recontagem: dá para comparar as listas da Jeannette e da Stephanie antes e depois,
como foi feito em 15/09 (Stephanie 341 → 132 abertas, Jeannette 451 → 348).
