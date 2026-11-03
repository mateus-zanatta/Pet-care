# Arquitetura e decisões

## Estrutura

```
Pet-care/
├─ apps/mobile/                 O app (Expo SDK 58, Expo Router em src/app)
│  ├─ app.config.ts             Configuração (identificador, plugins, Firebase por variável de ambiente)
│  ├─ eas.json                  Perfis de build (development, preview, production)
│  └─ src/
│     ├─ app/                   Só ROTAS (telas finas). Nunca coloque testes aqui: viram rotas.
│     ├─ features/              Um módulo por assunto: auth, pets, account, legal
│     ├─ components/ui + form/  Botões, campos, chips... acessíveis e com tema
│     ├─ core/                  firebase, i18n, theme, analytics, errors, media, storage, dates
│     ├─ locales/{pt-BR,en}/    TODOS os textos (um JSON por área) + textos nativos (permissões)
│     └─ __tests__/             Testes de telas e de navegação com as rotas reais
├─ packages/shared/             Enums + schemas Zod (fonte única de "o que é um pet")
├─ functions/                   Cloud Functions: deleteAccount, deletePet
├─ tests/rules/                 Testes das regras de segurança (emulador)
├─ firestore.rules · storage.rules · firestore.indexes.json · firebase.json
└─ docs/
```

## Navegação e login

- `src/app/index.tsx` é a rota inicial: logado → `/home`; sem sessão → `/welcome`.
- O layout raiz usa `Stack.Protected`: `welcome` só existe sem sessão; `login/register/forgot-password` existem sem sessão **e** para quem está "sem cadastro"; as abas e as telas de pet só com sessão. Termos e Privacidade são sempre acessíveis.
- **"Continuar sem cadastro"** usa autenticação anônima do Firebase. Ao criar conta depois, o login é **vinculado** à mesma conta (`linkWithCredential`), então nada do que a pessoa registrou se perde.
- Anônimos **não** criam pets (as regras bloqueiam): Resgate, Denúncia e Perto de mim são o uso sem cadastro.

## Modelo de dados (Fase 1)

| Caminho | Quem acessa | Observações |
|---|---|---|
| `users/{uid}` | só o próprio | idioma, nome, aceite dos termos (`consents`). Sem campo de plano: o plano fica em `entitlements`. |
| `entitlements/{uid}` | lê o próprio; **só o servidor escreve** | preenchido pelo webhook do RevenueCat (fase 6) |
| `pets/{petId}` | membros leem; dono/cuidador editam | exclusão **só** pela Function `deletePet` |
| `pet_members/{petId}_{uid}` | a pessoa vê os próprios; o dono vê os do seu pet | `role`: owner, caregiver, viewer. ID determinístico para as regras usarem `exists()` direto |
| `pets/{petId}/…` | membros | saúde, medicamentos, doses, vacinas (fase 2) como **subcoleções**: uma regra só ("é membro?") cobre tudo e a exclusão em cascata é simples |

Pontos de projeto:

- **Criar um pet = um lote com 2 escritas** (o pet e o vínculo de dono). As regras exigem as duas (`existsAfter`), então não existe pet "sem dono".
- Ninguém **lista** pets: só lê por ID, depois de achar o próprio vínculo em `pet_members`. Por isso a busca por RGA duplicado (fase 1.5) parte dos vínculos da própria pessoa.
- Enums são **chaves internas** (`dog`, `female`, `yes`), nunca texto em português → o app funciona em inglês sem migração.
- Idade aproximada guarda `{months, recordedOn}`: a idade exibida acompanha o passar do tempo.
- Campos opcionais apagados no formulário são **removidos** do documento (`deleteField`), não ficam para trás.

## Segurança e privacidade (o que já está feito)

- Regras do Firestore e do Storage com **28 testes** no emulador (quem lê/edita o quê, anônimo, papéis, campos inválidos, tamanho/tipo de arquivo).
- **Exclusão de conta** completa em `deleteAccount`: pets onde é dono (com subcoleções, vínculos de todos e arquivos), vínculos nos pets dos outros, perfil, plano, dados pessoais e, por último, o login. É idempotente. Exige **login recente** (≤ 5 min) — e a Apple tem o acesso **revogado**.
- Fotos: reduzidas e **recodificadas como JPEG** antes do envio, o que descarta o EXIF (localização).
- **Sentry**: só recebe o contexto e o código técnico do erro (nunca a mensagem, que pode ter dados digitados); `beforeSend` apaga usuário, requisição e breadcrumbs.
- **PostHog**: lista fechada de eventos, sem propriedades livres e sem `identify`.
- Mensagens de login **não revelam** se um e-mail tem conta.
- Nenhum texto fixo no código: o ESLint falha se houver texto em JSX; um teste confere que `pt-BR` e `en` têm as mesmas chaves.
- Acessibilidade: alvos de toque ≥ 48 dp, `accessibilityRole/Label/State` nos controles, erros anunciados, fonte do sistema respeitada (até 1,6×), contraste WCAG AA conferido por teste nos dois temas.

## Limitações conhecidas (honestidade)

- **Não foi testado em aparelho/simulador.** O ambiente de desenvolvimento desta fase não tem celular. Foi validado: tipos, lint, 86 testes do app (incluindo telas reais e navegação com as rotas verdadeiras), 31 do pacote compartilhado, 3 das Functions, 28 de regras e 4 de exclusão de dados nos emuladores, o *bundle* Metro (Android e iOS) e o `expo prebuild` com todos os plugins. O primeiro teste real é o seu, com o development build.
- **Login Google/Apple e App Check** dependem de configuração no console e só podem ser exercitados com as suas contas (veja `SETUP.md`).
- **Sem internet** o Firestore guarda localmente e sincroniza depois. Ao criar um pet offline a foto **não** é enviada (precisa de rede); a pessoa adiciona editando o pet depois.
- A sessão "sem cadastro" é descartada se a pessoa **entrar** numa conta já existente (o Firebase troca de conta); só o *cadastro* e o login social "novo" preservam os dados anônimos.
- Os ícones/splash são os do template.
