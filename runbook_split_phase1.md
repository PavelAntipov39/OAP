# Runbook: OAP Phase 1 (shared Supabase)

**Дата:** 2026-03-04

---

## Что фиксирует этот runbook

- OAP работает как отдельный контур (`ops-web`, `docs`, `scripts`, `artifacts`).
- На Фазе 1 используется общий Supabase-проект.
- DDL-миграции управляются во внешнем репозитории-владельце БД.

---

## Как запустить OAP

```bash
cd "/Users/pavelantipov/Downloads/VS Code/ОАП"

# 1. Переменные окружения
cp .env.example .env.local
# Заполни VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY

# 2. Зависимости
npm --prefix ops-web install

# 3. Генерация и проверка
npm --prefix ops-web run prepare-content
npm --prefix ops-web run check-agents
npm --prefix ops-web run build

# 4. Превью
npm --prefix ops-web run preview
# -> http://localhost:4174
```

---

## Ежедневный operational цикл

1. Синхронизировать registry/контент:
   - `npm --prefix ops-web run prepare-content`
2. Проверить контракт манифеста:
   - `npm --prefix ops-web run check-agents`
3. Зафиксировать telemetry (если были изменения workflow):
   - `make agent-log ...`
   - `make agent-telemetry-report`

---

## Архитектурные артефакты

- C4 source: `docs/oap.c4`
- Required view IDs:
  - `oap_context`
  - `oap_containers`
  - `db_rpc_boundary`
  - `security_access`

---

## Ограничения Фазы 1

- Изменения схемы БД делаются только через внешний репозиторий-владелец БД.
- OAP не должен содержать доменную логику внешних продуктов; только agent-ops контур.

