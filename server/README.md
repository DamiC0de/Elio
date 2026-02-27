# Elio Server — API Gateway

Backend Fastify pour l'assistant vocal Elio.

## Stack

- **Fastify 5** + TypeScript strict
- **WebSocket** bidirectionnel (streaming audio)
- **Rate limiting** + CORS

## Quick Start

```bash
cd server
cp .env.example .env
pnpm install
pnpm dev        # Dev mode (hot reload)
```

## Scripts

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Serveur dev avec hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript → dist/ |
| `pnpm start` | Lance la version compilée |
| `pnpm test` | Lance les tests (vitest) |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Healthcheck |
| `/api/v1/ping` | GET | Ping/pong |
| `/ws` | WS | WebSocket (echo pour l'instant) |

## Structure

```
src/
├── config/     # Env vars, configuration
├── plugins/    # Fastify plugins (cors, rate-limit, ws)
├── routes/     # Route handlers
├── services/   # Business logic (à venir)
└── __tests__/  # Tests
```
