# File Move Report — Phase 1 Split (Библия → ОАП)

**Дата:** 2026-02-28
**Режим:** copy-first (оригиналы в Библии сохранены, удаление — Фаза 1b после подтверждения)

---

## Скопированные файлы

### ops-web (весь каталог)
| Откуда (Библия) | Куда (ОАП) | Примечание |
|---|---|---|
| `ops-web/` | `ops-web/` | rsync, без node_modules/dist/src/generated |
| `ops-web/src/` | `ops-web/src/` | React компоненты, pages, lib, ui |
| `ops-web/scripts/` | `ops-web/scripts/` | build_content_index, check_agents, prepare_c4 |
| `ops-web/public/` | `ops-web/public/` | статика, bpmn, c4 диаграммы |
| `ops-web/package.json` | `ops-web/package.json` | npm-зависимости |
| `ops-web/vite.config.ts` | `ops-web/vite.config.ts` | Vite конфиг |
| `ops-web/tsconfig*.json` | `ops-web/tsconfig*.json` | TypeScript конфиги |
| `ops-web/playwright.config.ts` | `ops-web/playwright.config.ts` | E2E тесты |

### docs
| Откуда (Библия) | Куда (ОАП) |
|---|---|
| `docs/subservices/oap/` | `docs/subservices/oap/` |
| `docs/agents/registry.yaml` | `docs/agents/registry.yaml` |
| `docs/bible_kb.c4` | `docs/bible_kb.c4` |
| `docs/bpmn/` | `docs/bpmn/` |

### scripts
| Откуда (Библия) | Куда (ОАП) |
|---|---|
| `scripts/agent_telemetry.py` | `scripts/agent_telemetry.py` |
| `scripts/sync_agent_tasks.py` | `scripts/sync_agent_tasks.py` |
| `scripts/visual_explainer_oap.py` | `scripts/visual_explainer_oap.py` |
| `scripts/notify_analyst_digest.mjs` | `scripts/notify_analyst_digest.mjs` |
| `scripts/tests/test_agent_telemetry.py` | `scripts/tests/test_agent_telemetry.py` |
| `scripts/tests/test_sync_agent_tasks.py` | `scripts/tests/test_sync_agent_tasks.py` |
| `scripts/tests/test_visual_explainer_oap.py` | `scripts/tests/test_visual_explainer_oap.py` |

### Корневые файлы
| Откуда (Библия) | Куда (ОАП) |
|---|---|
| `AGENTS.md` | `AGENTS.md` (нужен для OAP KB: QMD Policy, OAP Design Rule, Agent Telemetry) |

---

## Оставлено shared (в Библии, НЕ перемещено)

| Файл/папка | Причина |
|---|---|
| `supabase/migrations/` | Канонический владелец DDL на Фазе 1 — Библия |
| `supabase/functions/` | Edge functions для Bible API |
| `web/` | Bible Reader UI |
| `etl/` | Bible ETL пайплайны |
| `edge-functions/` | Supabase edge functions |
| `data/` | Raw Bible data |
| `client/` | Bible client |
| `docs/schema.md` | Общая схема БД |
| `.specify/specs/` | Bible specs |

---

## Создано новое в ОАП

| Файл | Назначение |
|---|---|
| `.gitignore` | Исключения git |
| `.env.example` | Шаблон переменных окружения |
| `README.md` | Документация + Shared DB Contract |
| `file_move_report.md` | Этот файл |
| `shared_db_contract.md` | Контракт разделяемой БД |
| `runbook_split_phase1.md` | Runbook для Фазы 1 |
| `.logs/agents/` | Runtime логи (gitignored) |
| `artifacts/` | Runtime артефакты (gitignored) |
| `.specify/specs/001-bible-kb/` | Пустой каталог (нужен build_content_index) |

---

## Что НЕ менялось

- Пути в скриптах **не исправлялись** — `build_content_index.mjs` использует `path.resolve(opsRoot, "..")` динамически, что автоматически указывает на `ОАП/` как repoRoot.
- `prepare_c4_assets.mjs` требует `likec4` инструмент — работает если он установлен.

---

## Следующие шаги (после верификации)

1. **Шаг 7 (cleanup):** Удалить из Библии файлы, переехавшие в ОАП (только ops-web, OAP scripts/docs)
2. **Обновить `.gitignore` в Библии** (исключить ops-web, если нужно)
3. **Фаза 2:** Создать отдельные git-репозитории
