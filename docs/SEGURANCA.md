# Segurança do Tailwag

Este documento explica o que o app faz para proteger contas e dados, e o que **você** precisa ligar no
console do Firebase/Google quando o projeto for para produção (Caminho B, com o plano Blaze).

---

## 1. Login com Google

O código já está pronto (`apps/mobile/src/features/auth/auth.service.ts` e `SocialButtons.tsx`): o botão
**Continuar com Google** aparece sozinho assim que a variável `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` existe.
Sem ela, o botão fica escondido (nada quebra).

Quem está "sem cadastro" (conta anônima) e entra com Google **mantém** o que já registrou: a conta anônima é
vinculada à conta Google.

### Como ligar (não precisa de cobrança)

1. Acesse <https://console.cloud.google.com> e crie (ou escolha) um projeto. No Caminho B, use o mesmo projeto do Firebase.
2. **APIs e serviços → Tela de consentimento OAuth**: tipo "Externo", nome do app, e-mail de suporte. Salve.
3. **Credenciais → Criar credenciais → ID do cliente OAuth**:
   - **Aplicativo da Web** (este é o "ID do cliente da Web"): copie o ID, que termina em `.apps.googleusercontent.com`.
   - **Android**: nome do pacote = o seu `APP_IDENTIFIER` e a **impressão digital SHA-1** do certificado.
     A do build de desenvolvimento aparece em `eas credentials` → Android → *Keystore* (campo SHA1).
4. No site do Expo (expo.dev) → seu projeto → **Environment variables**, crie
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` com o ID da etapa 3 (ambientes *development* e *production*).
5. Gere um novo build (`eas build --profile development-emulators --platform android`, rodado em `apps\mobile`).

No Caminho B, ative também **Authentication → Método de login → Google** no console do Firebase.

> Com os emuladores (Caminho A), o emulador de Authentication aceita o login do Google sem verificar a
> assinatura. Dá para testar o fluxo, mas a conta só existe no emulador.

---

## 2. Senha forte

Regras (em `packages/shared/src/security.ts`, com testes):

- pelo menos **10 caracteres**;
- letra **maiúscula**, letra **minúscula**, **número** e **símbolo**;
- sem 3 caracteres iguais seguidos (`aaa`, `111`);
- sem o **nome** ou o **e-mail** da pessoa;
- sem senhas batidas, mesmo "enfeitadas" (`Senha@2024`, `123456`...).

Na tela de cadastro, um medidor mostra ao vivo a força da senha e o que ainda falta.

**Em produção (Caminho B)**, ligue também no servidor, para que nem uma chamada direta à API aceite senha fraca:
console do Firebase → **Authentication → Configurações → Política de senha** → "Exigir" + os mesmos requisitos
(o console aceita até 30 caracteres de mínimo; use 10). Essa opção existe no Firebase Authentication com Identity Platform.

---

## 3. Espera crescente no login (contra tentativa e erro)

- **No app** (`features/auth/loginGuard.ts`): 2 erros seguidos são livres. A partir do 3º, a próxima tentativa só
  é liberada depois de **2 s, 4 s, 8 s, 16 s...** (dobra a cada erro), até **15 minutos**. A contagem vale por
  e-mail **e** pelo aparelho (trocar de e-mail não zera). O e-mail nunca é guardado, só um resumo (hash SHA-256).
  Depois de 24 h sem erros, a contagem zera. Login certo zera na hora.
- **No servidor**: o Firebase Authentication já bloqueia tentativas em excesso (mensagem "muitas tentativas").
  Essa é a proteção que um atacante **não** contorna.

> Por que as duas? A espera no app protege a pessoa (e dá um retorno claro); o bloqueio do servidor protege contra
> quem chama a API do Firebase direto, sem o app. Para reforçar em produção: **App Check** (seção 6) e, no console,
> **Authentication → Configurações → Proteção contra enumeração de e-mail** (ligada).

---

## 4. Limite de uso (rate limit) nas funções do servidor

Tudo que cria registros nas centrais passa por Cloud Functions com **limite diário por pessoa**, contado numa
transação (duas chamadas simultâneas não furam o limite):

| Central | Limite por dia |
|---|---|
| Anúncios de adoção | 5 |
| Alertas de resgate | 10 |
| Denúncias | 5 |
| Sugestões de local (Perto de mim) | 10 |

Passou do limite, a função responde "limite de hoje atingido" e o app explica. Todas exigem conta (anônimo não cria nada).
Os contadores ficam em `rate_limits/` e `suggestion_quota/`, que o app não consegue ler nem alterar.

---

## 5. "Esconder as variáveis do front"

Num app, **tudo que vai junto pode ser extraído do aparelho**: o código e as variáveis `EXPO_PUBLIC_*`.
Então a regra não é esconder, é **nunca colocar segredo no app**.

- **Podem ficar no app** (são públicas por definição): configuração do Firebase (a segurança vem das regras),
  ID do cliente Google, DSN do Sentry, chave de projeto do PostHog.
- **Nunca no app**: chave do Resend, chave secreta do RevenueCat, conta de serviço do Google, qualquer "secret".
  Elas ficam só nas Cloud Functions, guardadas no Secret Manager:

  ```bash
  firebase functions:secrets:set RESEND_API_KEY
  ```

O teste `apps/mobile/config/publicEnv.test.ts` **quebra** se alguém colocar uma variável pública fora da lista
permitida, com nome de segredo, ou uma chave secreta escrita no código.

---

## 6. Checklist de produção (Caminho B)

- [ ] App Check ligado (Play Integrity no Android, App Attest no iOS) e `ENFORCE_APP_CHECK=true` em `functions/.env`.
- [ ] Política de senha "Exigir" no Authentication (seção 2).
- [ ] Proteção contra enumeração de e-mail ligada.
- [ ] Segredos das Functions no Secret Manager (seção 5).
- [ ] Regras do Firestore e do Storage publicadas (`firebase deploy --only firestore:rules,storage`).
- [ ] Índices publicados (`firebase deploy --only firestore:indexes`).
