# ADR-0001: Candidate Intake via n8n + Analyst A/B Loop

## Context
- OAP needs an external intake channel for actionable practices sent by the owner in Telegram (`@Assistant_antipov_bot`).
- Existing repository already has Telegram outbound notifications, but no inbound contract and no A/B task stage.
- Task status model and telemetry require deterministic, auditable transitions and rollback traceability.
- Phase 1 DB ownership remains external, so OAP must define contracts without taking over DDL management here.

## Decision
- Canonical entity name for incoming practices is `candidate` (single term; no mixed `candidat`/`hypothesis` naming).
- Intake architecture is `Telegram -> n8n workflow -> candidate contract -> analyst-agent`.
- Introduce `candidate_processor` as a technical normalization/assessment layer:
  - normalize inbound payload,
  - enforce idempotency by `source_key = telegram:<chat_id>:<message_id>`,
  - produce guarded-auto pre-assessment package for analyst, including:
    - `ab_plan` (`enabled`, `sessions_required`, `pass_rule=target_plus_guardrails`, `target_metric`, `expected_delta_pct`, `guardrails[]`, `rollback_on_fail`);
    - `collaboration_hints` (`suggested_agents[]`, `rationale`).
- Analyst remains the final decision owner for:
  - `candidate_rejected` or `accept_for_ab`,
  - target metric and `cycles_required` (adaptive window `3..8`),
  - `promote` vs `rollback_applied`.
- Extend task status domain with `ab_test` and include telemetry-driven transitions for `candidate_*`, `ab_test_*`, and `rollback_applied`.

## Alternatives considered
- Full decision logic in n8n only.
  - Rejected: weak traceability and difficult versioning for scoring rules.
- No n8n (custom polling service only).
  - Rejected: slower setup and less operational flexibility for non-developers.
- Manual gate for every candidate.
  - Rejected: lower throughput; selected `guarded-auto` provides controlled automation with explicit rejection reasons.

## Consequences
- Positive:
  - fast intake through n8n importable workflow,
  - deterministic status lifecycle with explicit rollback telemetry,
  - consistent candidate terminology across docs/contracts/scripts.
- Costs:
  - more lifecycle statuses to maintain in sync script, UI, and docs,
  - dependency on n8n operational availability for real-time intake.
- Risks:
  - DB contract mismatch until external DDL track is applied.
  - Mitigation: keep strict runtime validation and idempotency key in intake payload.

## Rollout plan
1. Add OAP docs/contracts updates (spec + frontend + datasets + design rules + telemetry docs).
2. Add importable n8n workflow artifact (`artifacts/n8n/oap_candidate_intake_v1.json`).
3. Implement `scripts/candidate_processor.py` with tests.
4. Extend sync/telemetry/UI for `ab_test` and candidate statuses.
5. Apply external DB migrations in owner repository (`candidate_inbox`, status enum extension, indexes, RLS).
6. Verify with:
   - `npm --prefix ops-web run prepare-content`
   - `npm --prefix ops-web run check-agents`
   - `npm --prefix ops-web run build`
   - `python3 -m pytest scripts/tests`
   - `npx -y likec4@latest validate --ignore-layout docs`
