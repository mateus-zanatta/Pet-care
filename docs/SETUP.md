# Configuração passo a passo

Este guia leva você de "baixei o código" até "o app rodando no meu celular". Cada passo explica **o que é** e **por que existe**, porque o Firebase e o Expo têm vários nomes que se confundem no começo.

Há **dois caminhos**:

- **Caminho A — sem Firebase na nuvem** (passos 1 e 2): o app no seu celular conversa com os **emuladores** rodando no seu computador. Não precisa de cartão nem do plano Blaze; só de uma conta gratuita do Expo. **Funciona hoje.**
- **Caminho B — Firebase de verdade** (passos 3 a 7): para publicar o app, usar o login do Google e testar o App Check. Exige o plano Blaze.

Comece pelo A.

---

## Glossário rápido

| Termo | O que é, em uma frase |
|---|---|
| **Firebase** | Conjunto de serviços do Google para apps: login, banco de dados, arquivos e código no servidor. |
| **Firestore** | O banco de dados (guarda pets, medicamentos etc. como "documentos"). |
| **Regras de segurança** (`firestore.rules`, `storage.rules`) | Quem pode ler/escrever o quê. É a principal proteção dos dados: o app roda no celular do usuário, então ele **nunca** é confiável sozinho. |
| **Cloud Functions** | Código que roda nos servidores do Google (aqui: excluir conta/pet com tudo que está ligado a eles). |
| **Emuladores** | Versões "de mentira" do Firebase que rodam no seu computador, de graça, para testar sem tocar em dados reais. |
| **Plano Blaze** | Plano do Firebase "pague pelo uso". Tem cota gratuita mensal; para uso pequeno costuma ficar em R$ 0, mas precisa de cartão cadastrado. |
| **Expo / EAS** | Ferramentas para montar o app. **EAS Build** compila o app na nuvem (você não precisa instalar Android Studio nem Xcode). |
| **Development build** | Uma versão especial do app, com as ferramentas de desenvolvimento dentro. Necessária porque o app usa módulos nativos (Firebase, login Google/Apple) que o app "Expo Go" não tem. |
| **App Check** | Selo que prova ao servidor que a chamada veio do *seu app instalado*, e não de um script. Será exigido nas funções do RG Animal (fase 1.5). |

---

## 1. Rodar tudo no seu computador (sem contas)

Pré-requisitos: **Node 22.13+**, **Java 21+** (os emuladores do Firebase usam Java) e Git.

```bash
npm install
npm run typecheck      # confere os tipos TypeScript
npm run lint           # estilo + "nenhum texto fixo no código"
npm test               # testes unitários e de telas
npm run test:emulators # regras de segurança + exclusão de dados (baixa os emuladores na 1ª vez)
```

Se tudo passou, o projeto está saudável. `npm run test:emulators` testa, por exemplo, que ninguém lê o pet de outra pessoa e que excluir a conta apaga *todos* os dados.

---

## 2. Caminho A — o app no celular, sem Firebase na nuvem

**Como funciona:** os emuladores (passo 1) imitam Auth, banco, arquivos e funções no seu computador. O celular acessa o computador pela rede Wi-Fi. Os dados são **de teste** e somem quando você fecha os emuladores. O login com Google fica oculto (precisa do Firebase real); e-mail/senha e "continuar sem cadastro" funcionam, assim como foto, edição e exclusão de pet e de conta.

**O que você precisa:** Node, Java 21, uma conta gratuita em <https://expo.dev>, um celular **Android** na mesma rede Wi-Fi do computador (sem VPN) e a opção "instalar apps de fontes desconhecidas" liberada.

### 2.1 Gerar o app (uma vez)

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init
```

O `eas init` cria o projeto no Expo e mostra um `projectId`. Como o `app.config.ts` é um arquivo de código, o Expo não consegue escrevê-lo sozinho: **cole o ID** na constante `EAS_PROJECT_ID`, no topo do `apps/mobile/app.config.ts` (no lugar de `COLE-AQUI-O-PROJECT-ID`). Na mesma página do projeto (botão **Details** em expo.dev) confira também o **slug** e o **dono** (conta ou organização) e copie para `EXPO_SLUG` e `EXPO_OWNER`. Nada disso é segredo.

Escolha o **identificador do app** (ex.: `br.com.seunome.petcare`) e cadastre-o como variável do projeto:

```bash
npx eas-cli env:set --name APP_IDENTIFIER --value br.com.seunome.petcare --environment development --visibility plaintext
```

Gere o app. O perfil `development-emulators` cria arquivos Firebase **falsos** automaticamente (por isso não precisa de conta Firebase):

```bash
npx eas-cli build --profile development-emulators --platform android
```

Quando terminar (leva alguns minutos; o plano gratuito tem uma cota mensal de builds e fila mais lenta), o Expo mostra um link/QR Code: abra no celular e instale o `.apk`.

### 2.2 Todo dia que for desenvolver

**Terminal 1** — na raiz do projeto, suba os emuladores abertos para a rede local:

```bash
npm run emulators:lan
```

Na primeira vez o Windows pergunta sobre o Firewall (para "Java" e "Node"): **permita em redes privadas**.

**Terminal 2** — suba o Metro, na pasta `apps/mobile`:

```bash
npx expo start --dev-client --clear
```

**Não precisa configurar IP nem `.env.local`.** O app gerado com o perfil `development-emulators` usa um projeto Firebase falso (`demo-petcare`); ao detectá-lo, liga os emuladores sozinho e usa o **mesmo endereço do Metro** (é o mesmo computador). Ao abrir, o terminal mostra linhas como:

```
[firebase] emuladores LIGADOS em 192.168.0.10 (projeto de demonstração "demo-petcare"...)
[firebase] OK    Auth (login) :9099 -> respondeu (HTTP 404)
```

Se alguma porta aparecer como `FALHA`, é rede ou Firewall (veja abaixo). Só se a descoberta automática do endereço falhar, defina manualmente `EXPO_PUBLIC_EMULATOR_HOST=SEU.IP` em `apps/mobile/.env.local` (no Windows, o IP aparece em `ipconfig`).

Abra o app instalado no celular e leia o QR Code. Na aba **Conta** aparece um aviso amarelo confirmando que você está nos emuladores. O painel dos emuladores abre no computador em <http://localhost:4000> e mostra usuários, documentos e arquivos criados pelo app — ótimo para conferir, por exemplo, se "Excluir conta" realmente apagou tudo.

> **Segurança:** `emulators:lan` aceita conexões de qualquer aparelho da sua rede e os emuladores **não têm senha**. Use só em rede de casa/confiável, nunca em Wi-Fi público, e feche quando terminar (`Ctrl+C`).

> **Se o emulador não subir ("port taken" / "Port 8085 is not open") ou o app perder a conexão:** quase sempre sobrou um emulador antigo rodando (a janela foi fechada, o PC entrou em suspensão ou o `Ctrl+C` não terminou o Java). Os comandos `npm run emulators` e `npm run emulators:lan` já **limpam isso sozinhos antes de subir** (encerram só processos Java/Node nas portas dos emuladores; se outro programa estiver na porta, avisam qual é). Para limpar sem subir:
>
> ```bash
> npm run emulators:free
> ```
>
> Para encerrar os emuladores **sempre use `Ctrl+C` na janela deles**, e não feche a janela. Para trocar uma porta, edite `firebase.json` e `firebase.lan.json` **e** `EMULATOR_PORT` em `apps/mobile/src/core/firebase/diagnostics.ts`.

> **O pet aparece no app, mas a foto não é salva e "Excluir" dá `owner-only`:** o app mostra o pet, só que **ele não chegou ao servidor** (emulador do Firestore). O app grava pelo Firestore (protocolo gRPC, que é diferente do `ping` HTTP das outras portas). Ao abrir, o terminal do `expo start` agora mostra uma linha **a mais**, que prova se esse canal funciona:
>
> ```text
> [firebase] OK    Firestore (canal das gravações) -> o servidor respondeu ...
> [firebase] FALHA Firestore (canal das gravações) -> o celular NÃO alcançou o Firestore (firestore/unavailable)
> ```
>
> - **`OK`**: o canal funciona. Se mesmo assim algo faltar, abra <http://localhost:4000/firestore> no computador e veja se a coleção `pets` tem o pet. Se estiver lá, o problema é outro (me mande o log `[erro] ...`).
> - **`FALHA`** (e só o Firestore, `:8085`, aparece como `FALHA` enquanto Auth/Storage/Functions respondem): o Firestore do emulador é um programa **Java** e o Firewall do Windows costuma liberar o Node (Auth, Storage, Functions) mas não o Java. Para conferir sem ferramentas: no **navegador do celular** abra `http://IP-DO-PC:8085` — deve aparecer `Ok`; se der "sem resposta", é o Firewall. Para liberar, abra o **PowerShell como Administrador** e rode (libera só a porta 8085 e só em rede **privada**):
>
>   ```powershell
>   New-NetFirewallRule -DisplayName "Emulador Firestore 8085" -Direction Inbound -Protocol TCP -LocalPort 8085 -Action Allow -Profile Private
>   ```
>
>   Se o seu Wi-Fi estiver classificado como **Pública** (Configurações → Rede e Internet → Wi-Fi → Propriedades da rede → *Tipo de perfil de rede*), troque para **Privada** — é o que o `-Profile Private` exige. Para remover a regra depois: `Remove-NetFirewallRule -DisplayName "Emulador Firestore 8085"`. Não precisa reiniciar nada: abra o app de novo e confira a linha `OK Firestore (canal das gravações)`.
>
>   **Se continuar sem responder**, o motivo mais comum é uma regra de **bloqueio** para o Java (criada quando você clicou em *Cancelar* no aviso "Permitir que o Java acesse a rede?" do Windows). **Regras de bloqueio vencem as de permissão**, então a regra da porta não adianta. No mesmo PowerShell de administrador:
>
>   ```powershell
>   Get-NetFirewallRule -Direction Inbound -Action Block -Enabled True | Where-Object { $_.DisplayName -match 'java|jdk' } | Select-Object DisplayName, Profile
>   ```
>
>   Se aparecer alguma linha, desative essas regras:
>
>   ```powershell
>   Get-NetFirewallRule -Direction Inbound -Action Block -Enabled True | Where-Object { $_.DisplayName -match 'java|jdk' } | Disable-NetFirewallRule
>   ```
>
>   Por fim, confira se o emulador está de fato escutando para a rede (e não só em `127.0.0.1`): rode `netstat -ano | findstr :8085`. Deve aparecer `0.0.0.0:8085` com `LISTENING`. Se aparecer só `127.0.0.1:8085`, você subiu com `npm run emulators` em vez de `npm run emulators:lan`.
>
>   Tudo o que ficou pendente está em [`PENDENCIAS.md`](PENDENCIAS.md).
>
> Quando o servidor não confirma a gravação em 10 s, o app avisa com um alerta ("o servidor não confirmou a gravação... a foto não foi enviada") em vez de falhar em silêncio. Pets antigos que ficaram só no celular (ou de antes de reiniciar os emuladores) não podem ser excluídos: **limpe os dados do app** (Android: Configurações → Apps → o app → Armazenamento → Limpar dados) e cadastre de novo.

> **Se o app não conectar:** confirme que celular e computador estão na mesma rede, que o IP no `.env.local` é o atual (ele pode mudar), que o Firewall permitiu o Java e o Node, e que você reiniciou o `expo start` depois de mudar o `.env.local` (use `--clear`).

---

### 2.3 Testar a importação do RG Animal (Fase 1.5)

A importação lê o PDF no **servidor** (função `importRga`), que no seu caso roda no emulador do seu PC. Nenhum build novo é necessário: é só atualizar o JavaScript.

**Sem usar o seu documento real**, gere um RG Animal **fictício** (todos os dados são inventados) e passe para o celular (cabo USB, Google Drive, WhatsApp para você mesmo...):

```bash
npm run rga:sample
```

Ele cria, em `fixtures/rga-sample/`, o `rga-ficticio.pdf` (para testar o PDF) e o `qr-ficticio.png` (para testar "só imagem com QR"). No app: **Pets → Importar RG Animal → Escolher arquivo**.

**Conferir o SEU PDF real** (sem enviar nada a lugar nenhum): o comando abaixo roda só no seu computador, compara o arquivo com a tabela de posições e mostra, para cada campo, se foi encontrado — **sem imprimir nenhum valor** (nome, RGA, CPF, telefone...), só tamanho e "formato" (`A` = letra, `9` = número):

```bash
npm run rga:inspect -- "C:\\caminho\\do\\seu-rga.pdf"
```

Se algum campo aparecer como `NÃO ENCONTRADO`, ou se o `Creator` for diferente de `JasperReports...`, me mande a saída: ela não tem dado pessoal e me diz exatamente o que ajustar. **Nunca coloque o PDF real no repositório** (a pasta `fixtures/rga-local/` e todo `*.pdf` já estão no `.gitignore`).

### 2.4 Testar medicamentos e lembretes (Fase 2A)

Esta fase usa **notificações**, que são um módulo nativo: é preciso **gerar um novo development build** (uma vez; ele já inclui também a câmera, a impressão e o compartilhamento da Fase 2B, para você não precisar de outro build depois).

1. Instale as dependências novas (o `package-lock.json` mudou):

   ```bash
   npm install
   ```

2. Gere o novo app e instale no celular (o mesmo comando de antes):

   ```bash
   cd apps/mobile
   eas build --profile development-emulators --platform android
   ```

   Enquanto o build não termina, **o app antigo continua abrindo normalmente** com o código novo; só a parte de lembretes avisa "não disponíveis nesta versão".

3. Suba os emuladores e o Metro como sempre (`npm run emulators:lan` e `npx expo start --dev-client --clear`).

**Roteiro de teste (no celular):**

1. Entre com uma conta (e-mail), abra um pet → **Medicamentos** → **Adicionar medicamento**. Preencha nome, dose (ex.: `1/2`), unidade (`comprimido`) e, em "A cada quantas horas", `1` (só para ver os lembretes chegando logo no teste; o app não sugere nada, quem decide é você).
2. Ao salvar, o app **pede permissão de notificações**: aceite.
3. Veja na lista a **próxima dose**. Entre no medicamento: as doses que já passaram aparecem em **"Doses para registrar"** → toque **Dei a dose** ou **Pulei**; elas vão para o **Histórico** (com quem registrou). **Desfazer** apaga o registro.
4. Espere a hora de uma dose: a **notificação** chega com os botões **Dei a dose** / **Pulei**. Toque num botão: o app abre e a dose aparece no histórico. Toque na notificação em si: abre o medicamento.
5. Feche o app por completo e repita o item 4 (a notificação tem que chegar com o app fechado).
6. Teste **Concluir**, **Suspender**, **Voltar a usar** e **Excluir** (os lembretes do medicamento param ao concluir/suspender/excluir).
7. Teste com **horários fixos** (ex.: `08:00` e `20:00`) e com **validade** próxima (os avisos chegam às 09:00).

> Lembrete: com o **Firewall do Windows** bloqueando o Firestore (veja acima), os dados ficam só no celular e não chegam ao servidor — o teste dos itens 1 a 7 funciona, mas nada é gravado no emulador. Libere a porta 8085 para ver os dados em <http://localhost:4000/firestore>.

**Ícone da notificação no Android:** já vem configurado a partir da Fase 3 (plugin `expo-notifications` no `app.config.ts`). Builds gerados antes disso mostram um quadrado cinza no lugar do ícone.

### 2.5 Testar vacinas, linha do tempo, anexos e PDF (Fase 2B)

**Não precisa de um novo build** se você já gerou o build da Fase 2A (ele já trazia câmera, impressão e compartilhamento). Se ainda não gerou, siga o 2.4 primeiro.

Mas as **regras de segurança mudaram** (vacinas, registros de saúde e anexos em PDF). Os emuladores só leem as regras quando iniciam:

1. Feche os emuladores com `Ctrl+C` e suba de novo: `npm run emulators:lan`.
2. Atualize o JavaScript do app: `npx expo start --dev-client --clear`.

**Roteiro de teste (no celular):**

1. Abra um pet → **Saúde**. Toque em **Registrar vacina**: preencha nome, data de aplicação e a **data da próxima dose** (aceite a permissão de notificações se pedir). Ao salvar, a vacina abre; ali você anexa documentos.
2. Em **Anexos**: tire uma foto, escolha uma foto da galeria e escolha um **PDF** (deve ficar sem recorte). Abra cada um (abre no navegador), remova um (pede confirmação).
3. Volte a **Saúde** → **Registrar consulta, exame ou outro**: escolha o tipo (ex.: *Vermífugo*), título, data e a **próxima aplicação**. Confira a lista **Próximas datas** e o **Histórico** (mais recente primeiro).
4. Em **Medicamentos** → abra ou crie um medicamento: no formulário, toque em **Ler código de barras com a câmera** e aponte para uma embalagem. O número preenche o campo (você pode editar). Na tela do medicamento, anexe a **foto da receita**.
5. Em **Saúde** → **Exportar histórico em PDF**: o PDF abre na folha de compartilhamento do sistema. Compartilhe para você mesmo (WhatsApp, e-mail...) e **abra o arquivo**: confira os dados do animal, medicamentos, vacinas e a linha do tempo. Confirme que **não aparecem** nome/telefone do tutor, endereço nem foto.
6. Teste a **notificação de próxima data**: crie uma vacina com próxima dose **amanhã**; ela avisa hoje às 09:00 se ainda for antes disso, e amanhã às 09:00 (veja a lista de notificações do app).
7. Exclua uma vacina com anexo e confira (em <http://localhost:4000/storage>) que o arquivo sumiu.

> Sem o Firewall liberado (veja acima), os dados e os anexos ficam só no celular: o teste funciona, mas nada chega ao emulador e o envio de arquivos pode demorar. Se aparecer "o servidor não confirmou", é isso.

### 2.6 Testar o Perto de mim (Fase 3)

Esta fase traz dois módulos nativos novos (**localização** e **mapa**), então é preciso **um novo development build**:

1. Instale as dependências novas (o `package-lock.json` mudou):

   ```bash
   npm install
   ```

2. Gere e instale o novo app (o mesmo comando de antes):

   ```bash
   cd apps/mobile
   eas build --profile development-emulators --platform android
   ```

   Enquanto ele não fica pronto, o app antigo continua abrindo; a aba Perto de mim só avisa que a localização "não está disponível nesta versão" e aceita endereço digitado.

3. **Reinicie os emuladores** (regras e Cloud Functions novas): `Ctrl+C` e `npm run emulators:lan` **na raiz**.

> **De onde vêm os locais:** a Cloud Function roda no emulador **do seu PC** e consulta o OpenStreetMap pela internet do PC. O celular só fala com o seu PC (porta 5001, Node, que já funciona). Por isso a busca funciona **mesmo com o Firewall barrando o Firestore**; só os **favoritos** (gravados no Firestore) ficam presos no celular enquanto a porta 8085 estiver bloqueada.

**Roteiro de teste (no celular):**

1. Abra a aba **Perto de mim**. Leia a explicação e toque em **Usar minha localização**. O sistema pede a permissão "durante o uso": aceite.
2. Confira a lista do mais perto ao mais longe, com tipo, distância, "Aberto agora / Fechado agora / Horário não informado" e endereço.
3. Teste os filtros: **Clínica veterinária / Pet shop / Abrigo/ONG**, **Emergência/24 h** e **Aberto agora**. Se vierem poucos resultados, toque em **Ampliar a busca**.
4. Num local com telefone, toque em **Ligar** (abre o discador). Toque em **Como chegar** e escolha Google Maps ou Waze.
5. Toque em **Trocar local** e digite um endereço (ex.: o de uma clínica que você conhece). Confira se a lista muda.
6. Com uma conta (não anônima): **Favoritar** um local, marcar **Só favoritos**, e depois, em **Medicamentos → Adicionar**, ver o favorito em **"Seus locais favoritos"** no campo local.
7. **Sugerir um local** (no fim da tela) e **Corrigir dados** (no cartão): envie uma sugestão e confira em <http://localhost:4000/firestore> a coleção `place_suggestions` com `status: pending`.
8. **Home:** o card **Veterinária mais próxima** deve mostrar a clínica mais perto (depois que você já liberou a localização no passo 1).
9. **Resgate:** toque em **Ver atendimento de emergência perto de mim**: a lista abre com os atendimentos 24 h primeiro.
10. Negue a permissão (Configurações do Android → Apps → o app → Permissões → Localização → Não permitir) e reabra a aba: deve aparecer **Abrir configurações** e a busca por endereço.

> **Se a busca não trouxer nada** ("O serviço de mapas não respondeu agora"): olhe o terminal dos emuladores. A linha `places_provider_failed` diz o motivo: `HTTP 429` ou `504` é o servidor público do OpenStreetMap ocupado (espere um pouco e tente de novo); erro de conexão quer dizer que o seu PC não alcançou a internet (antivírus ou firewall bloqueando o **Node**). Depois que uma busca dá certo, ela fica guardada por 24 h e não depende mais do OpenStreetMap.

**Mapa no Android (opcional, depende de cobrança):** o mapa usa o Google Maps, que exige uma chave com **conta de cobrança no Google Cloud** (o mesmo tipo de bloqueio do Blaze). Sem a chave, a tela funciona em **lista**, e "Como chegar" abre o app de mapas. Quando tiver a chave: no site do Expo, em *Project → Environment variables*, crie `GOOGLE_MAPS_ANDROID_API_KEY` (ambiente *development*), gere um novo build, e o botão **Lista / Mapa** aparece. No iPhone o mapa usa o Apple Maps e não precisa de chave.

---

## 3. Caminho B — criar o projeto no Firebase (quando o plano Blaze estiver disponível)

1. Acesse <https://console.firebase.google.com> → **Adicionar projeto**. Pode desligar o Google Analytics.
2. **Atualize para o plano Blaze** (Configurações do projeto → Uso e faturamento). É exigido para Cloud Functions e para o Storage em projetos novos.
   **Importante:** logo depois, no Console do Google Cloud → *Faturamento → Orçamentos e alertas*, crie um alerta (ex.: R$ 20/mês) para ser avisado se algo gastar mais que o esperado.
3. **Authentication → Método de login**: ative **E-mail/senha** e **Google**. (Apple: passo 5.)
4. **Firestore Database → Criar banco de dados** → modo de **produção** → localização **`southamerica-east1` (São Paulo)**.
   ⚠️ A localização **não pode ser mudada depois**. São Paulo dá menor latência e ajuda na LGPD.
5. **Storage → Começar** → mesma localização.
6. Registre os apps (ícone de engrenagem → *Seus apps*):
   - **Android**: o *nome do pacote* é o seu `APP_IDENTIFIER` (veja o passo 6; ex.: `br.com.seunome.petcare`).
   - **iOS**: o *ID do pacote* é o mesmo `APP_IDENTIFIER`.
   - Baixe `google-services.json` e `GoogleService-Info.plist` e coloque em `apps/mobile/firebase/` (a pasta já está no `.gitignore`).

> **Dica:** depois de ativar o Google como método de login **e** de cadastrar a impressão digital SHA-1 (passo 4), **baixe o `google-services.json` de novo**. A versão antiga não traz as credenciais do Google.

Conecte o código ao projeto:

```bash
npx firebase login
npx firebase use --add     # escolha o projeto; dê o apelido "default"
```

Publicar regras e funções:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

---

## 4. Login com Google

1. Em *Authentication → Método de login → Google*, copie o **ID do cliente da Web** e cole em `apps/mobile/.env.local`:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   ```
2. **Android** precisa da impressão digital (SHA-1 e SHA-256) do certificado que assina o app. Depois do primeiro build (passo 6), rode `npx eas-cli credentials` (no `apps/mobile`) para ver as impressões digitais e cadastre-as em *Configurações do projeto → seu app Android → Adicionar impressão digital*. Baixe o `google-services.json` de novo.
3. **iOS**: o app lê sozinho o `REVERSED_CLIENT_ID` do `GoogleService-Info.plist`. Nada a fazer.

---

## 5. Login com Apple (obrigatório no iOS)

A App Store **exige** "Entrar com a Apple" sempre que o app oferece login com Google.

1. Conta **Apple Developer** (US$ 99/ano): <https://developer.apple.com/programs/>.
2. No portal da Apple, o *App ID* do seu app precisa da capability **Sign In with Apple** (o EAS cuida disso no build).
3. No Firebase, em *Authentication → Método de login → Apple*, ative e preencha **Team ID**, **Key ID** e a **chave privada (.p8)** de uma chave com *Sign in with Apple*. Esses dados são necessários para a exclusão de conta **revogar** o acesso da Apple, como a Apple exige.

Sem conta Apple Developer você ainda pode desenvolver e testar tudo no **Android**.

---

## 6. Gerar o development build (Expo / EAS)

1. Crie uma conta gratuita em <https://expo.dev>.
2. No terminal:
   ```bash
   cd apps/mobile
   npx eas-cli login
   npx eas-cli init                  # cria o projeto no Expo e mostra um "projectId"
   ```
   Cole o `projectId` na constante `EAS_PROJECT_ID` no topo do `app.config.ts`.
3. **Defina o identificador do app** — é ele que identifica o app nas lojas e **não pode mudar depois de publicado**:
   ```bash
   # exemplo; use um domínio SEU, ao contrário: br.com.seunome.petcare
   npx eas-cli env:set --name APP_IDENTIFIER --value br.com.seunome.petcare --environment development --visibility plaintext
   ```
   (repita para `preview` e `production`). O `app.config.ts` **recusa** gerar build no EAS com o identificador provisório `com.example.petcare`, justamente para evitar um erro caro.
4. Envie os arquivos do Firebase como **variáveis do tipo arquivo** (secretas): no painel <https://expo.dev> → seu projeto → *Environment variables* → *Create variable* → tipo **File**:
   - `GOOGLE_SERVICES_JSON` → `google-services.json`
   - `GOOGLE_SERVICES_PLIST` → `GoogleService-Info.plist`
   Também crie `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (texto, visível).
5. Compile:
   ```bash
   npx eas-cli build --profile development --platform android   # gera um .apk para instalar no celular
   npx eas-cli build --profile development --platform ios      # precisa da conta Apple Developer
   ```
6. Instale o build no aparelho (o EAS mostra um QR Code/link) e rode o servidor de desenvolvimento:
   ```bash
   npx expo start --dev-client
   ```

---

## 7. O que ainda é manual / vem nas próximas fases

- **App Check**: o código das funções já tem o interruptor `ENFORCE_APP_CHECK` (desligado). Será ligado na fase 1.5, junto com o App Check no app (Play Integrity e App Attest).
- **Sentry e PostHog**: já estão no app, mas desligados até você colocar `EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_POSTHOG_KEY`.
- **Textos legais**: Termos e Privacidade são **modelos**. Precisam de revisão de advogado e preenchimento dos campos entre `[colchetes]` em `apps/mobile/src/locales/*/legal.json`.
- **Ícone e splash**: ainda são os do template do Expo.
