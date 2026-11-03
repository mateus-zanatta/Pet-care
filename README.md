# Pet Care

App de bem-estar animal (Android e iOS) com três pilares:

1. **Cuidar** — saúde do pet, medicamentos e vacinas.
2. **Resgatar** — passo a passo para quem encontra um animal em perigo.
3. **Denunciar** — organizar provas de maus-tratos e achar o canal oficial.

Stack: Expo (React Native) + TypeScript + Expo Router · Firebase (Auth, Firestore, Storage, Functions).

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/mobile` | O app (Expo Router, em `src/app`) |
| `packages/shared` | Enums e schemas Zod usados pelo app, pelas Functions e (fase 7) pelo painel admin |
| `functions` | Cloud Functions (exclusão de conta e de pet; nas próximas fases: RG Animal, lugares, e-mail) |
| `tests/rules` | Testes das regras de segurança do Firestore e do Storage |
| `docs` | [Configuração passo a passo](docs/SETUP.md) · [Arquitetura e decisões](docs/ARQUITETURA.md) · [Pendências](docs/PENDENCIAS.md) |

## Comandos (na raiz)

```bash
npm install            # instala tudo
npm run typecheck      # TypeScript em todos os pacotes
npm run lint           # ESLint (inclui "nenhum texto fixo no código")
npm test               # testes unitários e de telas
npm run test:emulators # regras de segurança + exclusão de dados (precisa de Java 21)
npm run emulators      # sobe os emuladores do Firebase para desenvolver sem nuvem
```

Para rodar no celular e criar as contas necessárias, siga **[docs/SETUP.md](docs/SETUP.md)**.
