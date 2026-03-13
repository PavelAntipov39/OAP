# ОАП: governance мультиагентной архитектуры

## Назначение
Этот документ фиксирует, когда в ОАП можно заводить новый автономный агент, а когда роль должна остаться процессным агентом.

Host-level каталог ролей `docs/agents/host_agnostic_agent_catalog.yaml` больше не является ручным source-of-truth:
- каноническая metadata живет в `docs/subservices/oap/agents/<agent-id>/OPERATING_PLAN.md`;
- host adapters генерируются напрямую через `python3 scripts/export_host_agents.py`;
- каталог, если нужен runtime consumer, собирается автоматически через `python3 scripts/build_agent_catalog.py` как compatibility artifact.

Цель:
- не раздувать active set без доказанной пользы;
- сохранять единый backbone `0..9.1` и learning core;
- держать переносимость между `Claude`, `GitHub Copilot`, `Codex`;
- не плодить роли, которые дублируют `analyst-agent` или `reader-agent`.

## Канонические типы ролей
- `Автономный агент` = user-facing тип для persistent роли с собственной карточкой и operating plan.
- `Процессный агент (sub-agent)` = user-facing тип для bounded runtime specialist внутри orchestration-цикла.
- Internal schema keys остаются прежними:
  - `top_level`
  - `runtime_specialist`

## Базовое правило
Новый агент по умолчанию **не** становится автономной ролью.

Сначала новая роль должна появляться как процессный агент (`runtime specialist`), и только потом может быть повышена до автономного агента (`top_level`).

## Когда роль может стать автономным агентом
Все условия ниже обязательны одновременно.

1. `Distinct mission`
- у роли есть отдельная миссия, которую нельзя честно описать как подпроцесс уже существующего автономного агента;
- формулировка миссии не должна пересекаться с общей формулировкой `analyst-agent`, `designer-agent` или `reader-agent`.

2. `Measurable task class`
- у роли есть минимум 2-3 повторяемых класса задач;
- эти классы задач можно описать в `useWhen` и `avoidWhen`;
- для них можно сформулировать отдельный output contract.

3. `Bounded delegation model`
- роль умеет делегировать только в заранее одобренные targets;
- у роли есть понятные `stopConditions`;
- роль не вводит свободную mesh-коммуникацию между агентами.

4. `Telemetry viability`
- для роли можно считать минимум:
  - `invocation_count`
  - `completed_task_count`
  - `verification_pass_rate`
  - `handoff_use_rate`
  - `overlap_with_analyst_rate`
  - `host_adapter_sync_status`
- без этих KPI роль не считается production-like автономным агентом.

5. `Host adapter support`
- роль должна экспортироваться в repo-owned adapters:
  - `.claude/agents/*.md`
  - `.github/agents/*.agent.md`
  - `Codex` mirror generation через exporter/dispatcher
- cross-host smoke должен проходить без drift.

## Когда роль должна остаться процессным агентом
Роль не поднимается в автономную, если верно хотя бы одно:
- задача узкая и bounded по одному домену проверки;
- роль нужна только эпизодически внутри `step_3 orchestration` или `step_5 roleWindow`;
- роль не имеет собственного устойчивого task backlog;
- роль дублирует автономного агента и отличается только набором tools;
- роль не имеет переносимого host adapter contract.

## Процедура повышения process agent -> autonomous agent
1. Зафиксировать миссию и contracts в `OPERATING_PLAN.md`.
2. Добавить `OPERATING_PLAN.md`.
3. Подключить telemetry viability KPI.
4. Сгенерировать host adapters.
5. Прогнать:
   - `python3 scripts/export_host_agents.py smoke-active-set`
   - `npm --prefix ops-web run check-agents`
   - live/manual host handoff checklist из `docs/subservices/oap/HOST_HANDOFF_CHECKLIST.md`
   - профильные verify/smoke для роли.
6. Только после этого роль может быть добавлена в active registry как автономный агент.

## Enforcement gate
Правило выше теперь проверяется не только вручную.

`npm --prefix ops-web run check-agents` обязан падать, если active автономный агент:
- отсутствует в active metadata, которую отдает `python3 scripts/export_host_agents.py list-active-agents`;
- отсутствует canonical metadata во frontmatter `docs/subservices/oap/agents/<agent-id>/OPERATING_PLAN.md`;
- не имеет полного top-level host-contract (`mission`, `useWhen`, `avoidWhen`, `inputContract`, `outputContract`, `handoffTargets`, `supportedHosts`, `stopConditions`);
- не поддерживает `codex`, `claude_code`, `github_copilot`;
- выпал из `host-agent-smoke` parity-check или имеет drift по adapters/handoff targets.

## Процедура обратного понижения
Если роль перестала быть целесообразной:
- она не удаляется из истории;
- active profile убирается из registry, после чего host adapters пересобираются, а compatibility catalog обновляется только если он еще нужен consumer'ам;
- docs и lessons переносятся в `archive`;
- `agent_id` остается зарезервированным для возможного возврата.

## Текущее active правило для проекта
Сейчас active set автономных агентов:
- `orchestrator-agent`
- `analyst-agent`
- `designer-agent`
- `reader-agent`

Сейчас active set процессных агентов:
- `retrieval-audit`
- `ui-verification`
- `telemetry-audit`
- `contract-audit`
- `docs-spec-sync`
- `editorial-quality-audit`
- `automation-governance`
- `terminology-consistency-audit`

Для `editorial-quality-audit` правило явно такое:
- это процессный агент, а не автономный;
- он нужен для bounded editorial-review задач: ясность, фактология, отсутствие лишних обещаний в описательном тексте;
- он не заменяет `designer-agent`, `terminology-consistency-audit` или `docs-spec-sync`, а работает рядом с ними на своем узком слое.

Все новые роли сначала идут через процессный агент (`runtime specialist`).

Исключение:
- `orchestrator-agent` допускается как координационный автономный агент, потому что его миссия не дублирует доменные роли и не сводится к одному bounded подпроцессу.
