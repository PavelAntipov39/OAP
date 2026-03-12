# ОАП: live-checklist реального handoff между агентами

## Зачем нужен этот документ
`python3 scripts/export_host_agents.py smoke-active-set` проверяет repo-level parity:
- generated adapters существуют;
- active set синхронизирован;
- `handoffTargets` валидны;
- `Codex` mirror generation не имеет drift.

Этого недостаточно, чтобы подтвердить реальную работу handoff внутри внешнего host UI.

Этот checklist нужен для ручной проверки того, что:
- `Claude Code` реально видит project agents;
- `GitHub Copilot` реально видит `.github/agents`;
- `Codex` реально может работать через dispatcher/exported host surface;
- активная тройка (`analyst-agent`, `designer-agent`, `reader-agent`) вызывается по назначению;
- удаленные `data-agent` и `ops-agent` больше не всплывают как active roles.

## Когда прогонять checklist
- после изменения `docs/agents/host_agnostic_agent_catalog.yaml`;
- после изменения `.claude/agents/*.md` или `.github/agents/*.agent.md`;
- после изменения `handoffTargets` у active top-level агентов;
- перед возвращением новой top-level роли в active set;
- перед демонстрацией или production-like rollout, где важен реальный handoff между агентами.

## Предусловия
Перед ручной проверкой обязательно:

1. Прогнать repo-level smoke:
```bash
python3 scripts/export_host_agents.py smoke-active-set
```

2. Прогнать governance gate:
```bash
npm --prefix ops-web run check-agents
```

3. Для release-like проверки прогнать единый UI/runtime gate:
```bash
npm --prefix ops-web run check:release
```

4. Убедиться, что active set совпадает с текущей политикой:
- `analyst-agent`
- `designer-agent`
- `reader-agent`

## Общие критерии успеха
Проверка считается успешной только если одновременно верно все:
- host использует только active top-level set и разрешенных runtime specialists;
- запрос на UI-review уходит в `designer-agent` или `ui-verification`, а не в произвольную роль;
- запрос на cross-doc/context/evidence уходит в `reader-agent` или `retrieval-audit`;
- запрос на glossary/chip/терминологическую консистентность уходит в `terminology-consistency-audit`;
- запрос на product-quality/KPI/decision package уходит в `analyst-agent`;
- ни один host не предлагает `data-agent` или `ops-agent` как active role;
- результат handoff возвращается в bounded виде:
  - что сделал агент,
  - какой output package ожидался,
  - где был verify/fallback.

## Claude Code: live-check

### Что должно быть подключено
- проект открыт из корня репозитория;
- в проекте доступны `.claude/agents/analyst-agent.md`, `.claude/agents/designer-agent.md`, `.claude/agents/reader-agent.md`.

### Сценарий 1. UI-review
Ввод:
`Проверь понятность и визуальную консистентность страницы agents`

Ожидание:
- host выбирает `designer-agent` или делегирует в `ui-verification`;
- в ответе явно видно, что это UX/UI review;
- нет обращения к архивным ролям.

### Сценарий 2. Cross-doc retrieval
Ввод:
`Собери evidence по тому, как в проекте устроен multi-agent handoff`

Ожидание:
- host выбирает `reader-agent` или `retrieval-audit`;
- ответ содержит ссылки на spec/runbook/catalog;
- решение не выдается как “личное мнение без evidence”.

### Сценарий 3. Decision package
Ввод:
`Оцени, нужно ли заводить нового top-level агента для telemetry`

Ожидание:
- host выбирает `analyst-agent`;
- в ответе есть критерии top-level governance;
- результат оформлен как decision/recommendation, а не как implementation.

### Сценарий 4. Terminology consistency
Ввод:
`Проверь, что чипы source_kind/semantic_layer берут label только из glossary и не дублируют префиксы`

Ожидание:
- host делегирует в `terminology-consistency-audit`;
- ответ содержит explicit drift-check по glossary/UI/AGENTS;
- результат фиксирует, где label канонический, а где есть отклонение.

## GitHub Copilot: live-check

### Что должно быть подключено
- проект открыт в VS Code;
- `Agent Mode` включен;
- в репозитории доступны:
  - `.github/agents/analyst-agent.agent.md`
  - `.github/agents/designer-agent.agent.md`
  - `.github/agents/reader-agent.agent.md`

### Сценарии
Использовать те же четыре prompt-сценария, что и для `Claude Code`.

### Дополнительные проверки
- Copilot не должен предлагать handoff в отсутствующий agent id;
- `custom-agent` / `agents:` должны вести только в active роли;
- если host не поддержал handoff нативно, это фиксируется как `partial host support`, а не скрывается.

## Codex: live-check

### Что должно быть подключено
- exporter и dispatcher доступны локально;
- `host-agent-smoke` проходит;
- при необходимости generated mirror пишется в temp или `~/.codex/skills-generated`.

### Сценарий 1. Доступность active set
Проверка:
```bash
python3 scripts/export_host_agents.py smoke-active-set
```

Ожидание:
- `ok: true`
- active set = `analyst-agent`, `designer-agent`, `reader-agent`

### Сценарий 2. Dispatcher surface
Проверка:
```bash
python3 scripts/oap_agent_dispatcher.py list-agents
```

Ожидание:
- dispatcher показывает active top-level и runtime specialists;
- archived роли не выдаются как active top-level.

### Сценарий 3. Bounded run
Проверка:
```bash
python3 scripts/oap_agent_dispatcher.py stage-run --agent-id analyst-agent --task "Assess need for a new top-level telemetry role"
```

Ожидание:
- создается run manifest;
- сохраняется bounded execution envelope;
- handoff остается в рамках allowlist.

### Сценарий 4. Specialist availability (terminology)
Проверка:
```bash
python3 scripts/oap_agent_dispatcher.py list-agents --kind runtime_specialist
```

Ожидание:
- в списке присутствует `terminology-consistency-audit`;
- specialist доступен как runtime branch, но не как top-level role.

## Что фиксировать по итогам ручной проверки
Для каждого host фиксировать минимум:
- дата и время проверки;
- кто проверял;
- какой prompt использовался;
- какой agent/specialist реально был вызван;
- был ли fallback;
- есть ли расхождение с expected routing;
- итог: `pass`, `partial`, `fail`.

Рекомендуемый формат хранения:
- отдельная заметка/отчет в `artifacts/manual_checks/`, если нужна история;
- краткое summary можно добавлять в change report или rollout notes.

## Когда считать host support частичным
Статус `partial` использовать, если:
- repo adapters корректны, но host UI не выполнил handoff нативно;
- handoff возможен только через supervisor wording, а не через явный host-level agent picker;
- host видит agents, но теряет часть metadata/targets.

В таком случае:
- active role не удаляется автоматически;
- но rollout не считается 10/10 до повторной live-проверки.

## Текущий ожидаемый результат для проекта
На текущем active наборе успешная live-проверка означает:
- `analyst-agent` отвечает за decision/gov/KPI;
- `designer-agent` отвечает за UX/UI review;
- `reader-agent` отвечает за context/retrieval/implementation-support;
- runtime specialists используются как bounded branches, а не как новые top-level роли;
- `data-agent` и `ops-agent` остаются архивными и не участвуют в active handoff.
