# Report para team leaders: plano (J5, opção c)

Planejado em 16/09/2026. **Passos 1, 2 e 3 feitos em 18/09/2026.** O passo 3 virou controle
seu: Admin → Access levels, grupo **My Work Report**, uma linha para a aba People e outra para
a aba Workload, por nível (você pediu para decidir lá em vez de responder aqui). Padrões iguais
ao que os níveis davam antes: People para Admin Assistant e Team Leader, Workload só para Admin
Assistant. Conferido com os dados de produção: a Jeannette passa a ler só o SEO (5 pessoas, em
vez das 31 da empresa), a Stephanie só o Graphics (o time que ela lidera), e um time que a
pessoa não lidera, digitado na URL, é ignorado. A regra fica em `src/lib/report/view.ts`, usada
pela página, pela página de impressão, pelo PDF e pelo CSV. Faltam os passos 4 (ligar os 10
boards aos projetos do timeclock), 5 (ligar o Report para team leaders no Access levels) e 6
(avisar), que são seus.

**Objetivo.** A Jeannette pediu um jeito de equilibrar a carga do time. Isso é o Report, e a
aba Workload dele. A opção escolhida foi (c): consertar primeiro, abrir depois, para que um
team leader veja o próprio time e não a empresa inteira.

---

## O que foi verificado no código e no banco (16/09)

1. **Acesso.** `access_level_pages` tem `team_leader / report = false` (e `user / report =
   false`). Jeannette e Stephanie são team leader.
2. **Nível.** O Report usa `directoryLevel()` (`src/lib/access/surfaces.ts:211`): nível 3 com
   `dir-full`, nível 2 com `dir-teams-config`, senão 1. Team leader tem `dir-teams-config`,
   então é nível 2.
3. **Abas.** `REPORT_TABS` (`src/components/report/ReportTabs.tsx`): People exige nível 2,
   **Workload exige nível 3**. Ligar o Report para team leaders mostraria Overview, People,
   Where it waits e Method, **sem Workload**.
4. **Escopo "My team" vaza.** `scopesFor(2)` dá Me e My team (`src/lib/report/scope.ts`). Mas
   "My team" monta `{ teamId: sp.team || null }` em três lugares:
   - `src/app/(app)/report/page.tsx:69`
   - `src/app/(app)/report/print/page.tsx:48` (o PDF é gerado a partir desta página)
   - `src/app/(app)/report/csv/route.ts:54`

   Sem time escolhido, `accountsInScope` (`src/lib/report/data.ts:80`) devolve null e nada é
   filtrado: **a empresa inteira**, incluindo quem entregou atrasado e quanto tempo cada
   pessoa segurou cada passo.
5. **Filtro de pessoa do Workload não funciona.** `WorkloadFilters.tsx` escreve `person` na
   URL, e `report/page.tsx` não lê `person` (o tipo dos `searchParams` nem tem esse campo).
6. **Horas do Workload.** Boards sem projeto do timeclock usam a média da empresa (migration
   072; Settings → My Work sources → Boards and timeclock projects).
7. **Quem lidera um time.** `team_members.position` aceita `founder`, `team_leader` e
   `collaborator`. O org chart trata `founder` e `team_leader` como quem lidera
   (`src/lib/org/data.ts:145`).

---

## Plano

### Passo 1: "My team" passa a ser os times que a pessoa lidera

- Uma função só, em `src/lib/report/scope.ts`, usada pelos três lugares do item 4:
  - **Nível 3:** como hoje (o time escolhido, ou todos).
  - **Nível 2:** se o time escolhido é um dos que a pessoa lidera, só ele. Qualquer outro
    caso, os membros de todos os times que ela lidera, juntos. Se não lidera nenhum, cai para
    Me.
- `accountsInScope` passa a aceitar uma lista de times.
- O seletor de time mostra, para o nível 2, só os times que a pessoa lidera.
- Testes: nível 2 sem time vê só os liderados; nível 2 pedindo um time de fora não vê esse
  time; nível 3 continua igual; quem não lidera nada vê só o próprio trabalho.
- View Stage serve para conferir: o escopo é decidido no código a partir da pessoa
  (`getCurrentPerson`), que o View Stage troca.

### Passo 2: consertar o filtro de pessoa do Workload

- `report/page.tsx`, `print/page.tsx` e `csv/route.ts` leem `person`, conferem que a pessoa
  está dentro do escopo do passo 1, e filtram por ela.
- Teste: pessoa de fora do escopo é ignorada, não vaza.

### Passo 3: decidir se team leaders veem o Workload

- **Decisão pendente.**
- Se sim: `minLevel: 2` na aba Workload (`ReportTabs.tsx`), já limitada pelo passo 1.
- Se não: nada a mudar.

### Passo 4: horas mais confiáveis (tarefa de admin, uns 20 minutos)

- Settings → My Work sources → Boards and timeclock projects: ligar os 10 boards com mais
  trabalho ao projeto do timeclock. Sem isso, o Workload estima com a média da empresa e
  avisa.

### Passo 5: ligar

- Admin → Access levels → `team_leader` → Report ligado.
- Conferir com View Stage como a Jeannette: Me, My team só com os times dela, e Workload se o
  passo 3 disser sim.

### Passo 6: avisar

- Dizer à Jeannette e à Stephanie o que passam a ver, e como usar.

---

## Estimativa

| Passo | Esforço |
| --- | --- |
| 1 e 2 | cerca de 1 dia, com testes |
| 3 | minutos, depois da decisão |
| 4 | uns 20 minutos de admin |
| 5 e 6 | minutos |

## Decisões pendentes

1. Team leaders veem o Workload?
2. `founder` conta como quem lidera, como no org chart? (Recomendação: sim.)
3. A aba People (quanto tempo cada pessoa do time segurou cada passo) fica visível para o
   team leader do próprio time? Hoje ela já abre a partir do nível 2.
