# Pendências (o que ficou para DEPOIS)

Lista viva: quando algo for resolvido, risque ou apague a linha. Cada item diz **por que** está pendente e **como** resolver.

## Bloqueia testes agora (rede do seu computador, não depende de cobrança)

| # | O que | Sintoma | Como resolver |
|---|---|---|---|
| 1 | **O celular não alcança o emulador do Firestore** (porta 8085) | Aviso "O servidor não confirmou a gravação a tempo"; a foto do RG e os anexos não sobem; "Excluir" dá `owner-only`; o terminal mostra `FALHA Firestore (banco) :8085` | Firewall do Windows barrando o **Java**. Passo a passo no `SETUP.md` (seção 2.2, caixa "O pet aparece no app, mas a foto não é salva"). **Não depende do plano Blaze**: os emuladores rodam no seu PC. |

## Depende de ter o Firebase real (plano Blaze e cartão)

| # | O que | Observação |
|---|---|---|
| 2 | Projeto Firebase real e Cloud Functions na nuvem (`importRga`, `deletePet`, `deleteAccount`, `searchPlaces`, `suggestPlace`) | "Caminho B" no `SETUP.md`. Hoje tudo roda nos emuladores. Na nuvem, a `searchPlaces` só alcança o OpenStreetMap no plano **Blaze** (o plano grátis bloqueia acesso a serviços fora do Google). |
| 3 | **App Check** no app (Play Integrity / App Attest) | A Function já tem o interruptor `ENFORCE_APP_CHECK` (desligado). |
| 4 | Login com **Google** e **Apple** de verdade | Precisa do projeto real; Apple exige conta de desenvolvedor paga. |
| 5 | Gerar build **iOS** | Nunca foi testado em iPhone. |
| 14 | **Mapa no Android** (chave do Google Maps) | Exige conta de cobrança no Google Cloud. Sem ela a tela funciona em lista. Como ativar: `SETUP.md`, seção 2.6. |
| 15 | **Google Places** no lugar do OpenStreetMap (opcional, pago) | Só se a cobertura do OSM não bastar. O ponto de troca já existe (`functions/src/places/googleProvider.ts`). |
| 16 | **Política de TTL** do Firestore para `places_cache` (campo `expiresAt`) | Ajuste no console do projeto real, para o cache velho se apagar sozinho. |

## Decisões e melhorias já mapeadas

| # | O que | Fase |
|---|---|---|
| 6 | **Compartilhar o pet** com família, cuidador ou lar temporário (convite) | A regra de segurança já tem os papéis (dono, cuidador, visualizador), mas **falta o convite**: precisa de uma Cloud Function, porque o cliente não pode criar vínculos de outras pessoas. |
| 7 | Receber o PDF do RG pelo **"Compartilhar"** do sistema (ex.: vindo do WhatsApp) | Depois da 1.5 |
| 9 | Exportar PDF e anexos ilimitados só no **Premium**; até 2 pets com medicamentos no plano grátis | Fase 6 |
| 10 | Chaves reais de **Sentry**, **PostHog**, **RevenueCat** e **Resend** | Fase 6 |
| 11 | Lembretes no Android podem atrasar alguns minutos (falta a permissão de "alarme exato") | Decidir se vale pedir e declarar o uso na Play Store. |
| 13 | Painel web admin (canais de denúncia, moderação de locais) | Fase 7 |
| 17 | Limite de buscas por pessoa no "Perto de mim" | O cache já protege; avaliar quando houver uso real. |
| 18 | Tirar a pasta `.expo/` da raiz do repositório | Ela foi commitada por engano (tem um ID da instalação do Expo). O `.gitignore` já a ignora; falta `git rm -r --cached .expo` uma vez. |

## Para validar no aparelho (quando o item 1 estiver resolvido)

- Roteiro de medicamentos e lembretes: `SETUP.md`, seção 2.4.
- Roteiro de vacinas, anexos, código de barras e PDF: `SETUP.md`, seção 2.5.
- Roteiro do Perto de mim: `SETUP.md`, seção 2.6.
- Foto do RG salva no pet (importação do RG Animal): seção 2.3.

## Pequenos cuidados do dia a dia

- Depois de reiniciar os emuladores, os dados do celular ficam "fantasmas": **limpe os dados do app** (Android: Configurações → Apps → o app → Armazenamento → Limpar dados).
- Depois de mudar `firestore.rules` ou `storage.rules`, **reinicie os emuladores** (eles só leem as regras ao iniciar).
- Depois de extrair um zip com bibliotecas novas, rode `npm install` na raiz do projeto.
