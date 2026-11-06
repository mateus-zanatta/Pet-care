# Arquitetura e decisões

## Estrutura

```
Pet-care/
├─ apps/mobile/                 O app (Expo SDK 58, Expo Router em src/app)
│  ├─ app.config.ts             Configuração (identificador, plugins, Firebase por variável de ambiente)
│  ├─ eas.json                  Perfis de build (development, preview, production)
│  └─ src/
│     ├─ app/                   Só ROTAS (telas finas). Nunca coloque testes aqui: viram rotas.
│     ├─ features/              Um módulo por assunto: auth, pets, rga, medications, reminders, health, attachments, nearby, account, legal
│     ├─ components/ui + form/  Botões, campos, chips... acessíveis e com tema
│     ├─ core/                  firebase, i18n, theme, analytics, errors, media, storage, dates
│     ├─ locales/{pt-BR,en}/    TODOS os textos (um JSON por área) + textos nativos (permissões)
│     └─ __tests__/             Testes de telas e de navegação com as rotas reais
├─ packages/shared/             Enums + schemas Zod (fonte única de "o que é um pet")
├─ functions/                   Cloud Functions: deleteAccount, deletePet, importRga, searchPlaces, suggestPlace
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

## Medicamentos e lembretes (Fase 2A)

> **Regra do produto:** o app **nunca** sugere medicamento, dose ou diagnóstico. Só registra o que o veterinário prescreveu e lembra o tutor. Não há lista de medicamentos, dose padrão nem cálculo de dose — e as regras de segurança **rejeitam** qualquer campo fora do esperado (há teste para isso).

| Caminho | Quem acessa | Observações |
|---|---|---|
| `pets/{petId}/medications/{medId}` | membros leem; dono/cuidador escrevem; visualizador só lê | nome, código de barras (digitado), lote, validade, **dose** (valor + unidade + via, texto "como prescrito"), frequência, início/fim, veterinário (nome + CRMV), local (casa / clínica / endereço), situação, observações |
| `pets/{petId}/dose_logs/{medId}_{minutos}` | iguais | "Dei a dose" / "Pulei": horário **agendado**, horário **real**, quem registrou. O ID é remédio + minuto agendado: tocar duas vezes (ou na notificação e no app) **não duplica** |

**Frequência:** "a cada X horas" (1 a 168, a partir de um 1º horário) ou "horários fixos" (até 12 por dia). **Duração:** até uma data (inclusive) ou uso contínuo.

**Cálculo dos horários** (`packages/shared/src/medicationSchedule.ts`, funções puras com testes): `doseTimesBetween` gera as doses em uma janela; `buildReminderPlan` monta o que deve estar agendado (doses ainda não registradas + avisos), ordenado e limitado. Os horários seguem o **relógio local do aparelho**.

**Lembretes** (`apps/mobile/src/features/reminders/`):

- **Janela móvel de 72 h** e **no máximo 60 notificações** (o iOS guarda só 64). O app reagenda tudo quando abre e sempre que medicamentos ou doses mudam. Se a janela ficar sem doses por o app não ser aberto, os lembretes param — por isso a janela é maior que o mínimo de 48 h.
- Avisos além das doses: **fim do tratamento** (véspera e último dia, 09:00) e **validade** (7 dias antes e no dia, 09:00).
- Botões **Dei a dose / Pulei** na notificação: abrem o app e registram (quem e quando vêm do aparelho). A mesma ação nunca é tratada duas vezes.
- Quem só **visualiza** o pet não recebe lembretes de dose. Cada pessoa (dono/cuidador) recebe no **próprio aparelho**.
- O módulo nativo é carregado com tolerância: um build **antigo** do app (sem `expo-notifications`) continua abrindo; só os lembretes ficam indisponíveis, com um aviso na tela.

**Limitações conhecidas (honestidade):**

- **Android**: sem a permissão especial de "alarme exato" (que o Google Play restringe a apps de alarme/calendário), o sistema pode entregar a notificação **alguns minutos depois** do horário (Android 12+). Para lembrete de remédio é aceitável; se virar problema, dá para pedir a permissão e declarar o uso na Play.
- Se o aparelho **mudar de fuso**, os lembretes só se ajustam quando o app abrir de novo.
- **Não validado em aparelho** (veja o roteiro de teste no `SETUP.md`): o cálculo e o texto das notificações têm testes automáticos, mas a entrega real das notificações só dá para conferir no celular.
- Foto da receita, leitura do código de barras, vacinas, linha do tempo de saúde e PDF foram entregues na **Fase 2B** (veja a próxima seção).

## Perto de mim (Fase 3)

| Caminho | Quem acessa | Observações |
|---|---|---|
| `favorite_places/{uid}_{local}` | só a própria pessoa (com conta) | cópia do local favoritado: aparece sem nova busca e no campo "local" dos medicamentos |
| `place_suggestions/{id}` | **só o servidor** | "Sugerir um local" e "Corrigir dados", com `status: pending` (moderação no painel da Fase 7) |
| `suggestion_quota/{uid}_{dia}` | **só o servidor** | limite de 10 sugestões por pessoa por dia |
| `places_cache/{chave}` | **só o servidor** | resultado das buscas por 24 h (e até 7 dias se o provedor cair) |

**Como a busca funciona** (`functions/src/places/`):

1. O app pega a posição (GPS, com permissão "durante o uso") **ou** um endereço digitado (geocodificação do próprio sistema, grátis).
2. **Privacidade:** antes de sair do celular, a posição é arredondada para uma **célula de ~1 km** (`snapToGrid`). O servidor arredonda de novo (defesa extra) e **nunca registra coordenadas** no log. A distância exata de cada local é calculada **só no aparelho**.
3. A Cloud Function `searchPlaces` (funciona **sem cadastro**, com login anônimo) olha o cache. Se não tiver, consulta o **`PlacesProvider`**.
4. **`PlacesProvider`** é uma interface. Hoje: **OpenStreetMap via Overpass** (grátis; `amenity=veterinary`, `shop=pet`, `amenity=animal_shelter`). Pronto para trocar por Google Places (`googleProvider.ts`, escolha com `PLACES_PROVIDER=google`), que é cobrado por uso e ainda não foi implementado.
5. Se o OpenStreetMap estiver fora do ar, o servidor tenta outro servidor público do Overpass; se todos falharem, devolve um resultado antigo do cache (até 7 dias) em vez de deixar a pessoa sem nada.

**No app** (`features/nearby/`): lista do mais perto ao mais longe; filtros por tipo, **Emergência/24 h** (marcação `emergency=yes`, horário `24/7` ou nome com "24h", "emergência", "plantão") e **Aberto agora** (o app interpreta o horário do OSM num subconjunto comum; quando não entende, diz "Horário não informado" em vez de chutar); **Ligar** (`tel:`) e **Como chegar** (Google Maps, Waze e, no iPhone, Apple Maps, por links https, sem chave); favoritar; sugerir/corrigir. O card **"Veterinária mais próxima"** da Home só usa a localização se a pessoa já liberou (não pede permissão sozinho). O **modo emergência** (`/nearby?mode=emergency`, aberto pelo Resgate) põe os atendimentos 24 h primeiro.

**Mapa:** `react-native-maps`. No iPhone usa o Apple Maps (sem chave). No **Android exige uma chave do Google Maps** (e conta de cobrança no Google Cloud): sem ela o build marca o mapa como indisponível e a tela funciona em lista. A chave entra pela variável `GOOGLE_MAPS_ANDROID_API_KEY` no EAS.

**Atribuição:** a licença dos dados do OpenStreetMap (ODbL) exige mostrar "© colaboradores do OpenStreetMap"; o app mostra no rodapé da tela.

**Limitações conhecidas (honestidade):**

- **Cobertura do OpenStreetMap no Brasil é desigual:** em muitas cidades faltam clínicas, telefones ou horários. Por isso existe "Sugerir um local". Se a cobertura não bastar, o caminho é ativar o Google Places (pago).
- Os **servidores públicos do Overpass** são mantidos por voluntários e têm limite de uso. O cache por célula de ~1 km reduz muito as consultas; em volume de produção, considere um servidor próprio ou o Google Places.
- A busca **ainda não tem limite por pessoa** (o cache já protege bastante). As sugestões têm.
- O cache precisa de uma **política de TTL** no Firestore (campo `expiresAt`) para apagar o que envelheceu: é um ajuste no console, no projeto real.
- **Não validado em aparelho:** GPS, permissão, mapa no iPhone e os links de navegação só dá para conferir no celular (roteiro no `SETUP.md`, seção 2.6).

## Centrais de Adoção, Resgate e Denúncia (Fase 4)

**Fluxo de gravação:** o app nunca grava direto. Cada ação chama uma Cloud Function (`functions/src/centrals/`), que
valida com o mesmo schema Zod do app (`packages/shared/src/schemas/centrals.ts`), confere a conta (anônimo não cria)
e aplica um **limite diário por pessoa** numa transação (`rate_limits/{uid}_{central}_{dia}`). O app só lê, e as
regras decidem quem vê o quê.

| Coleção | Quem lê | Observações |
|---|---|---|
| `adoption_listings/{id}` | qualquer pessoa logada | Só cidade/UF; coordenada arredondada (~1 km). Saúde: vacinas, remédios e exames já feitos (texto livre). |
| `adoption_listings/{id}/private/contact` | só quem tem conta | Telefone de quem doa. |
| `rescue_alerts/{id}` | só quem tem conta | Ponto **exato** (sem ele ninguém acha o animal). Qualquer animal: silvestre, cavalo, gado, marinho... |
| `reports/{id}` | só quem denunciou | Denúncia privada; `anonymous` = identidade não repassada no encaminhamento. Status `received` → `forwarded`/`closed` (painel, Fase 7). |
| `rate_limits/{id}` | ninguém (só servidor) | Contadores do limite diário. |

**Fotos:** `adoptions|rescues|reports/{id}/photo-*.jpg` no Storage. O app reduz e recodifica (apaga o GPS do EXIF), envia
para a pasta do registro (as regras do Storage conferem o dono pelo Firestore) e depois avisa a Function, que só aceita
caminhos da pasta do próprio registro.

**Guia do resgate:** 4 etapas (avaliação e aproximação, veterinário, quarentena de 7 a 14 dias, acolhimento) com
checklist salvo no aparelho (`features/rescue/guide.ts`). Nunca indica remédio ou dose: tudo de saúde é "com o veterinário".
Os contatos oficiais (IBAMA 0800 061 8080, 190, 193, 181) funcionam sem conta e sem internet.

**Exclusão de conta:** apaga anúncios, alertas, denúncias, contadores e as fotos de cada um.

## Movimento e animações

Biblioteca: **Reanimated 4** (já vem com o Expo). A biblioteca **Motion** (motion.dev, antiga Framer Motion) é para
React na **web** e não roda em React Native; ela fica para o painel web da Fase 7. A linguagem de movimento está em
`apps/mobile/src/components/motion/motion.ts`:

- **Toque** (`PressableScale`, usado por todo `Button` e `Card`): encolhe para 97% em 120 ms assim que o dedo encosta.
  É uma transição de estilo (roda na thread de interface, sem renderizar a cada quadro).
- **Entradas** (`EnterView`): conteúdo entra de baixo (12 px) em 250 ms, em cascata de 40 ms (no máximo 8 itens).
- **Telas e formulários:** transições **nativas** da plataforma (formulários curtos abrem como modal subindo de baixo). Nada
  de transição de tela refeita em JS, e nada animando por cima de um modal que já está subindo.
- **Curvas:** ease-out forte `cubic-bezier(0.23, 1, 0.32, 1)` para entrar/sair; ease-in-out para mover na tela; nunca ease-in.
- **Reduzir movimento** (configuração do sistema): sem deslocamento nem escala, só esmaecer; telas passam a usar `fade`.
- **Não anima:** troca de abas, digitação, rolagem.

## Segurança de conta

Senha forte com medidor, espera crescente entre tentativas de login, limite diário nas funções e teste que impede
segredos no app. Detalhes e checklist de produção: [`SEGURANCA.md`](SEGURANCA.md).

## Saúde: vacinas, linha do tempo, anexos e PDF (Fase 2B)

| Caminho | Quem acessa | Observações |
|---|---|---|
| `pets/{petId}/vaccines/{id}` | membros leem; dono/cuidador escrevem | nome, data de aplicação, **próxima dose** (opcional), lote, veterinário (nome + CRMV), local, observações, anexos |
| `pets/{petId}/health_events/{id}` | iguais | consulta, vermífugo, antipulgas/carrapatos, exame, cirurgia ou outro: tipo, data, título, descrição/resultado, **próxima data** (opcional), veterinário, local, anexos |
| Storage `pets/{petId}/attachments/{registro}/{id}.jpg\|pdf` | membros leem; dono/cuidador gravam | foto ou PDF de até **10 MB**, no máximo **10 por registro** |

**Linha do tempo** (`healthTimeline.ts`, testada): junta vacinas e registros, do mais recente ao mais antigo, e destaca as "próximas datas". Os medicamentos continuam na própria tela.

**Lembretes de próxima data**: vacinas e registros com data futura avisam na **véspera e no dia, às 09:00**. Esses avisos (e os de fim de tratamento/validade) olham **30 dias** à frente; as doses continuam na janela de 72 h. O limite de 60 notificações vale para tudo junto, e as mais próximas têm prioridade.

**Anexos** (`features/attachments/`): foto da câmera ou da galeria (**sem recorte**, ao contrário da foto do pet), ou PDF. Fotos são reduzidas e **recodificadas em JPEG, o que descarta a localização (EXIF)**; PDFs são enviados como estão. Se o registro no documento falhar, o arquivo enviado é apagado (sem órfãos); se a pessoa exclui o registro, os arquivos vão junto; excluir o pet apaga tudo (a Function `deletePet` remove o prefixo `pets/{id}/`, e há teste disso). A foto da receita é um anexo do medicamento.

**Código de barras** (`expo-camera`): a leitura só **preenche o campo**; o app **não consulta nenhuma base de produtos**, então nunca sugere nem completa nome, dose ou bula. O resultado volta ao formulário por uma "caixa de correio" em memória (`scanInbox.ts`).

**PDF do histórico** (`features/health/report.ts`): HTML → PDF no próprio aparelho (`expo-print`) e compartilhado pelo `expo-sharing`. **Todo texto digitado é escapado** (há teste com `<script>`). Leva: dados do animal, medicamentos "como prescritos", vacinas e linha do tempo. **Não leva**: dados do tutor (nome, telefone), endereço, foto, nem o conteúdo ou o nome dos anexos (só a quantidade). O arquivo fica na pasta temporária do app; o sistema limpa depois.

**Compatibilidade com builds antigos:** `expo-camera`, `expo-print`, `expo-sharing` e `expo-notifications` são carregados com tolerância. Um build do app sem esses módulos continua abrindo; só o recurso afetado avisa "não disponível nesta versão".

**Limitações conhecidas (honestidade):**

- **Não validado em aparelho**: a lógica, os textos e as regras têm testes automáticos, mas câmera, seletor de PDF, compartilhamento e a aparência do PDF só dá para conferir no celular (veja o roteiro no `SETUP.md`).
- A **aparência do PDF** depende do motor de impressão do Android/iOS; tabelas largas podem quebrar linha de forma diferente entre aparelhos.
- A exportação em PDF ainda **não é exclusiva do plano Premium**: o controle de plano chega na Fase 6.
- Anexos enviados **sem conexão** com o servidor ficam pendentes (o Firestore guarda e sincroniza depois), mas o arquivo vai direto ao Storage e precisa de rede.
- Não há busca nem filtro por tipo na linha do tempo (ficaria para uma próxima versão, se fizer falta).

## Importação do RG Animal (Fase 1.5)

Fluxo: o app envia o PDF (ou uma foto/print com o QR) **direto na chamada** da Cloud Function `importRga` (sem gravar no Storage); a função devolve os campos em JSON; o app abre o formulário **pré-preenchido** com selos "lido do RG" / "confira"; só salva quando a pessoa confirma.

| Peça | Onde | Observações |
|---|---|---|
| Contrato (Zod) | `packages/shared/src/schemas/rgaImport.ts` | Não tem campo para CPF/CNPJ: não há como ele trafegar. |
| Leitura do PDF | `functions/src/rga/pdfReader.ts` | pdf.js v6 (build legacy), só 1 página A4, `isEvalSupported:false`*, sem fontes do sistema, sem XFA. |
| Texto → campos | `textItems.ts` + `mapRgaFields.ts` | Pela **posição** (±4 pt), nunca por rótulo (os rótulos são imagem). Nome longo que quebra linha é reunido. |
| Validação | `normalize.ts` | Enums internos (Felina → `cat`), datas ISO com nascimento ≤ emissão ≤ hoje, "Cidade - UF", telefone 10/11 dígitos. RGA fora do formato só **avisa**. |
| QR | `qr.ts` | jsQR; conferência **exata** de host e caminho (`sinpatinhas.mma.gov.br` não aceita `...golpe.com`). QR ≠ texto → "este arquivo pode ter sido alterado". |
| Foto | `photo.ts` | pixels → JPEG com sharp (descarta metadados). |
| Fluxo no app | `apps/mobile/src/features/rga/` | Duplicado por RGA → oferece **atualizar** mostrando o que mudaria. |

\* O pdf.js v6 removeu por completo o caminho que usava `eval`; a opção é passada mesmo assim, para o caso de a dependência ser trocada.

**Privacidade:** CPF/CNPJ é lido só para ser descartado e nunca sai da função (há testes que procuram o CPF fictício em todo o resultado). Nome/telefone do responsável só são salvos com a caixa marcada. Nenhum valor vai para log, Sentry ou PostHog: a função registra só `ok`, `mode`, `reason`, `creator` (nome do gerador do PDF) e códigos de aviso. A pasta com o PDF real fica fora do git.

**Seletor de arquivos:** usa o `File.pickFileAsync` do `expo-file-system` (já presente no app), então esta fase **não exige novo build**. Fotos/prints são reduzidos e recodificados antes do envio (tira o EXIF).

**Pendente (precisa do Firebase real):** App Check no **app** (Play Integrity / App Attest). A função já tem o interruptor `ENFORCE_APP_CHECK` (desligado). O módulo nativo `@react-native-firebase/app-check` entra junto com o projeto real, porque sem ele não há como testar.

**Não validado:** só um PDF real foi analisado pelo autor do documento de requisitos, e eu **não tive acesso a ele**. Os testes usam PDFs fictícios com os valores nas posições da tabela. Rode `npm run rga:inspect` no seu arquivo para confirmar.

## Limitações conhecidas (honestidade)

- **Não foi testado em aparelho/simulador.** O ambiente de desenvolvimento desta fase não tem celular. Foi validado: tipos, lint, 86 testes do app (incluindo telas reais e navegação com as rotas verdadeiras), 31 do pacote compartilhado, 3 das Functions, 28 de regras e 4 de exclusão de dados nos emuladores, o *bundle* Metro (Android e iOS) e o `expo prebuild` com todos os plugins. O primeiro teste real é o seu, com o development build.
- **Login Google/Apple e App Check** dependem de configuração no console e só podem ser exercitados com as suas contas (veja `SETUP.md`).
- **Sem internet** o Firestore guarda localmente e sincroniza depois. Ao criar um pet sem o servidor confirmar a gravação (offline, ou emulador inacessível) a foto **não** é enviada (precisa de rede) e o app **avisa** com um alerta; a pessoa adiciona editando o pet depois.
- A sessão "sem cadastro" é descartada se a pessoa **entrar** numa conta já existente (o Firebase troca de conta); só o *cadastro* e o login social "novo" preservam os dados anônimos.
- Os ícones/splash são os do template.
