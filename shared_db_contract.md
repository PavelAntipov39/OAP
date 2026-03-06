# Shared DB Contract — Phase 1

**Дата:** 2026-02-28
**Статус:** Active (Фаза 1 — одна БД Supabase)

---

## Суть контракта

На Фазе 1 ОАП использует **общий Supabase-проект** с внешним контуром данных.
Канонический владелец DDL-миграций: внешний репозиторий-владелец БД (`/supabase/migrations/`).

ОАП **читает и пишет** в следующие объекты БД, но **не создаёт их самостоятельно**.

---

## SQL-объекты, от которых зависит ОАП

### Таблицы

| Таблица | Миграция | Описание |
|---|---|---|
| `agent_tasks` | `0059_agent_tasks.sql` | Задачи агентов — основная таблица |
| `agent_task_context` | `0065_agent_task_context_and_links.sql` | Контекст и ссылки задач |

### RPC (Postgres Functions)

| Функция | Миграция | Описание |
|---|---|---|
| `get_agent_task_brief(task_id)` | `0061_agent_tasks_brief_and_readiness.sql` | Краткое описание задачи |
| `get_agent_task_details(task_id)` | `0062_agent_task_details_rpc.sql` | Детали задачи |
| `get_agent_task_context(task_id)` | `0065_agent_task_context_and_links.sql` | Контекст задачи |

### Дополнительные объекты (телеметрия)

| Объект | Миграция | Описание |
|---|---|---|
| `agent_tasks.status` enum | `0063_agent_tasks_completed_status.sql` | Статусы задачи (completed и др.) |
| `agent_tasks.context_usage` | `0064_agent_task_details_usage.sql` | Использование контекста |

---

## Правила контракта

1. **DDL только через внешний репозиторий-владелец БД.** ОАП не создаёт таблицы/функции напрямую.
2. **ОАП читает и пишет через Supabase client** с `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
3. **RLS включён.** Все запросы выполняются под anon key — убедись, что RLS policies дают нужный доступ.
4. **Breaking changes согласуются** — любое изменение сигнатуры RPC или схемы таблиц требует уведомления команды ОАП.

---

## Переменные окружения (shared)

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Эти же значения должны быть согласованы с текущим владельцем shared DB.

---

## Что будет на Фазе 2

- Возможен отдельный Supabase-проект для ОАП
- DDL-миграции переедут в ОАП-репозиторий
- Этот контракт станет API-контрактом между сервисами
