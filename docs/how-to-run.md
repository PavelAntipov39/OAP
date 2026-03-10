# OAP How To Run

## Quick start

```bash
cp .env.example .env.local
npm --prefix ops-web install
npm --prefix ops-web run prepare-content
npm --prefix ops-web run check-agents
npm --prefix ops-web run build
npm --prefix ops-web run preview
```

## URL
- `http://localhost:4174`

## Notes
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in `.env.local`.
- For task/telemetry flows, keep `docs/agents/registry.yaml` and `artifacts/*` in sync.

## WUUNU toggle
- Обычный dev запуск (WUUNU off):
  - `npm --prefix ops-web run dev`
- Dev запуск с WUUNU:
  - `npm --prefix ops-web run dev:wuunu`
- Prerequisite:
  - локальный endpoint `127.0.0.1:62704` должен быть поднят desktop app;
  - в `.env.local` должен быть задан `VITE_WUUNU_WS`.
