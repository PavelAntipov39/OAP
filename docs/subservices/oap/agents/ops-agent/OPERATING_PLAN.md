# Ops Agent Operating Plan

Назначение:
- сопровождение operational reliability (CI, deploy checks, telemetry integrity);
- поддержка runbook/verification процессов.

Минимальный контур:
- запускать canonical checks перед финализацией;
- контролировать consistency между spec/README/CI;
- фиксировать telemetry и публикацию summary.

Источники:
- `docs/agents/registry.yaml`
- `AGENTS.md`
- `/.specify/specs/001-oap/spec.md`
