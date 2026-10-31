# Aprovação do app do portal pelo Google (verificação)

Preparado em 31 de outubro de 2026. Objetivo: tirar o aviso "Google hasn't verified this app" e o limite de 100 pessoas.

O app "True North Operations Portal" (projeto 661786204350, dono office@) pede duas permissões que o Google chama de **sensíveis**: `calendar.events` e `calendar.freebusy`. As outras (`openid`, `userinfo.email`, `drive.file`) não precisam de revisão. Nenhuma é **restrita**, então não há auditoria de segurança paga.

## O que já está pronto

| Exigência do Google | Onde está |
|---|---|
| Página inicial pública que diz o que é o app e tem link para a política | https://truenorthportal.online (abre a tela de login, com a descrição e os links embaixo) |
| Política de privacidade com o texto do "Limited Use" | https://truenorthportal.online/legal/privacy |
| Termos de uso | https://truenorthportal.online/legal/terms |
| Domínio autorizado | truenorthportal.online (já cadastrado em Branding) |
| Justificativa de cada permissão | abaixo, em inglês, pronta para colar |
| Roteiro do vídeo | abaixo |

## O que você faz (nesta ordem)

### 1. Verificar o domínio no Google Search Console (10 minutos)

1. Abra https://search.google.com/search-console entrando como **office@truenorthdigitalmarketing.com** (tem que ser o dono do projeto no Google Cloud).
2. "Add property" e escolha **URL prefix**, digitando `https://truenorthportal.online`.
3. Escolha o método **HTML tag**. O Google mostra uma linha assim: `<meta name="google-site-verification" content="XXXXXXXX" />`.
4. **Me mande só o valor de `content`** (o código). Eu coloco a linha no portal, envio para a produção e te aviso. Aí você clica em **Verify**.

(Também dá pelo método "HTML file": você baixa o arquivo `googleXXXX.html` e me manda; eu publico na raiz do site.)

### 2. Gravar o vídeo (5 a 8 minutos de tela, em inglês ou só com legendas em inglês)

Grave a tela do computador, sem áudio se preferir, e suba no YouTube como **Não listado** (Unlisted). Use o portal de **produção** depois que a Agenda abrir, ou o staging (o Google aceita, mas o endereço que aparece deve ser o do domínio verificado; o ideal é a produção).

Roteiro, cena por cena:

1. **O app e a página inicial.** Abra `https://truenorthportal.online`. Mostre a descrição embaixo do login e clique em "Privacy policy" (role a página até a parte "Google API Services User Data Policy").
2. **Entrar no portal** com uma conta da True North.
3. **A tela de consentimento.** Vá em Agenda, Settings, e clique em "+ Connect a Google account". Na tela do Google:
   - **pare 3 segundos com a barra de endereço visível**: o Google exige ver o `client_id=661786204350-...` na URL;
   - mostre o nome "True North Operations Portal" e a lista de permissões;
   - clique em Continue.
4. **calendar.freebusy (horários ocupados).** Volte ao portal. Abra "+ New event", adicione um convidado e clique em "Find a time when everyone is free": mostre os blocos ocupados vindos do Google. Depois abra Agenda settings, "Your booking link", "Preview": mostre que só os horários livres aparecem.
5. **calendar.events (criar, mudar, apagar).** Crie um evento online com um convidado e salve. Abra o Google Calendar em outra aba e mostre o evento lá, com o link do Meet. Mude o horário no portal e mostre a mudança no Google. Apague no portal e mostre que saiu do Google.
6. **Respostas.** Abra o card do evento no portal e mostre a lista de convidados com as respostas (Yes / No / Maybe).
7. **Desconectar.** Em Agenda settings, clique em "Disconnect" na conta: mostre que ela sai (o portal apaga o acesso e avisa o Google).

### 3. Enviar para revisão

1. Abra https://console.cloud.google.com/auth/verification?project=true-north-operations-portal (entrando como office@).
2. Em **Data access**, confira as 5 permissões. Em cada permissão sensível, cole a justificativa abaixo.
3. Cole o link do vídeo do YouTube.
4. Clique em **Submit for verification** / "Prepare for verification" e siga as telas.
5. O Google responde por e-mail para office@, às vezes pedindo ajustes. Me encaminhe o que chegar.

Prazo típico: de alguns dias a 4 semanas.

## Textos para colar (inglês)

**App purpose (descrição geral):**

> The True North Operations Portal is the internal work tool of True North Digital Marketing, used by its team members and contractors. Its Agenda lets each team member connect their Google account so the portal can schedule meetings on their own Google Calendar: it finds times when everyone is free, creates the meeting with a Google Meet link and the guests' invitations, keeps it in step when it changes, and offers a public booking page that shows only the person's free times. The company's shared account connects as the team calendar, where approved time off is written.

**https://www.googleapis.com/auth/calendar.events**

> Used to create, update and delete the events a user makes in the portal on that user's own Google Calendar, with a Google Meet link and the guests they choose, so Google sends the invitations and cancellations; to keep the portal's copy current when the event is changed or deleted in Google Calendar; to read guests' responses (Yes, No, Maybe) and record the user's own response from the portal; and, for the company's team calendar account only, to write approved time off. The portal only acts on events it created or that are on the team calendar. A narrower scope cannot be used: calendar.events.owned does not allow reading guests' responses on the user's own copy of an invitation, and the readonly scopes cannot create events.

**https://www.googleapis.com/auth/calendar.freebusy**

> Used to read only when the user is busy (start and end times, never titles or details), so the portal can show free times when scheduling a meeting with colleagues and offer only free times on the user's public booking page. Busy times are kept for a few minutes and replaced on the next read.

**https://www.googleapis.com/auth/drive.file (não sensível, só para referência)**

> Used only by the company's shared account to save receipts and invoices the portal produces into one folder the administrator picks with Google Picker. The portal sees only that folder and the files it creates.

## Observações

- Até a aprovação, quem não é @truenorthdigitalmarketing.com vê o aviso e clica em "Advanced", e depois em "Go to True North Operations Portal". Limite: 100 pessoas diferentes (hoje, 2).
- Se o Google pedir um logo (Branding, App logo, 120x120 px), isso abre uma "brand verification" de poucos dias; não é obrigatório.
