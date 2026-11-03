# Configuração passo a passo

Este guia leva você de "baixei o código" até "o app rodando no meu celular". Cada passo explica **o que é** e **por que existe**, porque o Firebase e o Expo têm vários nomes que se confundem no começo.

> Você **não precisa de nenhuma conta** para os passos 1 e 2: dá para rodar todos os testes e os emuladores só no seu computador. As contas só entram a partir do passo 3.

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

## 2. Ver o app funcionando com emuladores (ainda sem contas)

O app usa Firebase "nativo", então não roda no app Expo Go: precisa de um **development build** (passo 6). Quando tiver um, você pode apontar o app para os emuladores:

```bash
npm run emulators      # em um terminal; painel em http://localhost:4000
```

No `apps/mobile/.env.local` (copie de `.env.example`):

```
EXPO_PUBLIC_USE_EMULATORS=true
EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2   # emulador Android. iOS Simulator: localhost. Celular físico: o IP do seu computador
```

---

## 3. Criar o projeto no Firebase

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
   Guarde o `projectId` na variável `EAS_PROJECT_ID` (no `.env.local` e nas variáveis do projeto no Expo).
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
