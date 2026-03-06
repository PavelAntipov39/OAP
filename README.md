# ОАП — Operations & Agents Platform

Операционная платформа управления AI-агентами.

## Состав

```
ОАП/
├── ops-web/              # React UI (Vite) — дашборд агентов, задач, телеметрии
├── docs/
│   ├── agents/           # registry.yaml — реестр всех агентов
│   └── subservices/oap/  # Операционные стандарты, схемы, уроки агентов
├── scripts/              # Python/Node скрипты
│   ├── agent_telemetry.py
│   ├── sync_agent_tasks.py
│   ├── visual_explainer_oap.py
│   ├── notify_analyst_digest.mjs
│   └── tests/
├── artifacts/            # Runtime-артефакты (gitignored)
└── .logs/agents/         # Логи агентов (gitignored)
```

## Быстрый старт

```bash
# 1. Скопируй переменные окружения
cp .env.example .env.local
# Заполни VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 2. Установи зависимости
npm --prefix ops-web install

# 3. Сгенерируй контент-индекс
npm --prefix ops-web run prepare-content

# 4. Проверь манифест агентов
npm --prefix ops-web run check-agents

# 5. Собери и запусти
npm --prefix ops-web run build
npm --prefix ops-web run preview
```

## Shared DB contract (Phase 1)

На Фазе 1 ОАП использует общий Supabase-проект с внешним контуром данных.
DDL-миграции управляются в отдельном репозитории-владельце БД.

### SQL-объекты, от которых зависит ОАП

| Объект | Тип | Миграция |
|--------|-----|----------|
| `agent_tasks` | table | 0059_agent_tasks.sql |
| `get_agent_task_details` | RPC | 0062_agent_task_details_rpc.sql |
| `get_agent_task_brief` | RPC | 0061_agent_tasks_brief_and_readiness.sql |
| `agent_task_context` | table | 0065_agent_task_context_and_links.sql |
| `agent_telemetry_*` | tables/RPC | 0059–0065 |

> **Важно:** Не создавай SQL-объекты напрямую в ОАП на Фазе 1.
> Все DDL-изменения делаются в репозитории-владельце БД.

### Переменные окружения (shared)

```
VITE_SUPABASE_URL      → тот же project URL
VITE_SUPABASE_ANON_KEY → тот же anon key
```

## Phase 2 (будущее)

- Отдельный git-репозиторий для ОАП
- Опционально: отдельный Supabase проект
- До тех пор: смотри [runbook_split_phase1.md](./runbook_split_phase1.md)
