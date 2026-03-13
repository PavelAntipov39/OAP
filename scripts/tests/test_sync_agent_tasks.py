from __future__ import annotations

import importlib.util
import datetime as dt
import json
from pathlib import Path
import unittest
from uuid import UUID


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "sync_agent_tasks.py"
    spec = importlib.util.spec_from_file_location("sync_agent_tasks", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


sync = _load_module()


class SyncAgentTasksTests(unittest.TestCase):
    def test_build_db_schema_candidates_requires_explicit_legacy_schema(self):
        self.assertEqual(sync.build_db_schema_candidates("oap"), ["oap"])
        self.assertEqual(sync.build_db_schema_candidates("bible"), ["bible"])
        self.assertEqual(sync.build_db_schema_candidates(None), ["oap"])

    def test_build_db_schema_candidates_rejects_unknown_schema(self):
        with self.assertRaises(ValueError):
            sync.build_db_schema_candidates("unknown")

    def test_slugify_falls_back_to_hash_for_non_ascii(self):
        slug = sync.slugify("Авто-проверка локализации статусов")
        self.assertTrue(slug.startswith("name-"))
        self.assertGreaterEqual(len(slug), 10)

    def test_build_seed_tasks_contains_improvements_and_recommendations(self):
        registry = {
            "agents": [
                {
                    "id": "analyst-agent",
                    "role": "analyst",
                    "improvements": [
                        {
                            "id": "imp-contract-schema",
                            "title": "Контрактная валидация рекомендаций",
                            "priority": "Высокий",
                            "promptPath": "docs/subservices/oap/agents-card.schema.json",
                            "problem": "нет обязательных полей",
                            "solution": "добавить schema check",
                            "effect": "рост прозрачности",
                            "ownerSection": "Логика карточки",
                            "detectionBasis": "review findings",
                            "targetMetric": "recommendation_action_rate",
                            "expectedDelta": ">= 15%",
                            "validationDate": "2026-03-15",
                            "promptTitle": "Промт",
                            "promptMarkdown": "- сделать проверку",
                            "promptSourceUrl": "https://example.com/schema",
                            "ice": {"impact": 9, "confidence": 8, "ease": 7},
                        }
                    ],
                    "analystRecommendations": [
                        "Связать рекомендации с task outcomes.",
                    ],
                },
                {
                    "id": "designer-agent",
                    "role": "designer",
                }
            ]
        }
        seeds = sync.build_seed_tasks(registry, "analyst-agent")
        by_type = {item["origin_type"] for item in seeds}
        self.assertEqual(by_type, {"improvement", "recommendation"})
        self.assertEqual(len({item["external_key"] for item in seeds}), len(seeds))
        improvement = next(item for item in seeds if item["origin_type"] == "improvement")
        recommendation = next(item for item in seeds if item["origin_type"] == "recommendation")
        self.assertIn("task_brief", improvement)
        self.assertEqual(improvement["task_brief"]["goal"], "Контрактная валидация рекомендаций")
        self.assertTrue(isinstance(improvement["task_brief"]["target_artifacts"], list))
        self.assertEqual(improvement["task_brief"]["origin_context"]["linked_improvement_id"], "imp-contract-schema")
        self.assertIsNone(improvement["task_brief"]["origin_context"]["origin_cycle_id"])
        self.assertEqual(improvement["task_brief"]["linked_elements"][0]["type"], "improvement")
        context_package = improvement["task_brief"]["context_package"]
        self.assertIn("operational_memory", context_package)
        self.assertIn("collaboration_plan", context_package)
        self.assertIn("ab_test_plan", context_package)
        self.assertIn("strategy", context_package["collaboration_plan"])
        self.assertIn("spawned_instances", context_package["collaboration_plan"])
        self.assertIn("interaction_mode", context_package["collaboration_plan"])
        self.assertIn("interaction_phases", context_package["collaboration_plan"])
        self.assertIn("roundtable_policy", context_package["collaboration_plan"])
        self.assertIn("orchestration_budget", context_package["collaboration_plan"])
        self.assertEqual(context_package["ab_test_plan"]["pass_rule"], "target_plus_guardrails")
        self.assertGreaterEqual(context_package["ab_test_plan"]["sessions_required"], 3)
        self.assertLessEqual(context_package["ab_test_plan"]["sessions_required"], 8)
        self.assertIn("task_brief", recommendation)
        self.assertEqual(recommendation["task_brief"]["expected_outcome"], "")
        self.assertEqual(recommendation["task_brief"]["priority_reason"], "requires_clarification")
        self.assertEqual(recommendation["task_brief"]["origin_context"]["link_mode"], "none")
        self.assertIsNone(recommendation["task_brief"]["origin_context"]["origin_cycle_id"])
        rec_context = recommendation["task_brief"]["context_package"]
        self.assertIn("operational_memory", rec_context)
        self.assertIn("collaboration_plan", rec_context)
        self.assertIn("ab_test_plan", rec_context)
        self.assertIn("reuse_candidates", rec_context["collaboration_plan"])
        self.assertIn("created_profiles", rec_context["collaboration_plan"])
        self.assertIn("host_execution_strategy", rec_context["collaboration_plan"])

    def test_recommendation_object_links_improvement_explicitly(self):
        registry = {
            "agents": [
                {
                    "id": "reader-agent",
                    "improvements": [
                        {
                            "id": "imp-ux-rules",
                            "title": "Контрактная валидация рекомендаций",
                            "problem": "Рекомендации без структуры",
                            "solution": "Ввести JSON schema",
                            "effect": "Единый формат",
                            "priority": "Высокий",
                            "ownerSection": "Логика карточки",
                            "detectionBasis": "review findings",
                            "targetMetric": "recommendation_action_rate",
                            "baselineWindow": "last_14_days",
                            "expectedDelta": ">= 15%",
                            "validationDate": "2026-03-15",
                            "promptTitle": "Промт",
                            "promptPath": "docs/subservices/oap/agents-card.schema.json",
                            "promptMarkdown": "- сделать проверку",
                            "promptSourceUrl": "https://example.com/schema",
                            "ice": {"impact": 8, "confidence": 8, "ease": 7},
                        }
                    ],
                    "analystRecommendations": [
                        {
                            "id": "rec-rules-1",
                            "text": "Добавить обязательную валидацию контракта карточки через schema check в CI.",
                            "linkedImprovementId": "imp-ux-rules",
                            "contextToTask": {
                                "summary": "Контекст задачи для исполнителя",
                                "why_now": "Высокий риск регрессии",
                                "execution_notes": ["Обновить schema", "Проверить CI"],
                            },
                        }
                    ],
                }
            ]
        }

        seeds = sync.build_seed_tasks(registry, "analyst-agent")
        recommendation = next(item for item in seeds if item["origin_type"] == "recommendation")
        brief = recommendation["task_brief"]

        self.assertEqual(brief["origin_context"]["link_mode"], "explicit")
        self.assertEqual(brief["origin_context"]["recommendation_id"], "rec-rules-1")
        self.assertEqual(brief["origin_context"]["linked_improvement_id"], "imp-ux-rules")
        self.assertEqual(brief["context_to_task"]["summary"], "Контекст задачи для исполнителя")
        self.assertIn("linked_elements", brief)
        self.assertTrue(any(item.get("type") == "improvement" for item in brief["linked_elements"]))
        self.assertGreaterEqual(len(brief["acceptance_criteria"]), 1)

    def test_collaboration_plan_immediate_promotion_appends_registry_profile(self):
        registry = {
            "agents": [
                {
                    "id": "analyst-agent",
                    "role": "analyst",
                }
            ]
        }

        first_plan = sync.build_collaboration_plan(
            task_id="imp:reader:retrieval-audit",
            root_agent_id="analyst-agent",
            hint_text="retrieval evidence qmd context audit",
            suggested_agents=[],
            rationale="Need specialist retrieval audit.",
            registry=registry,
            target_metric="evidence_link_coverage",
            owner_section="memory_context",
            linked_snapshot=None,
        )

        self.assertGreaterEqual(len(first_plan["created_profiles"]), 1)
        created_profile_id = first_plan["created_profiles"][0]["id"]
        self.assertTrue(any(item.get("id") == created_profile_id for item in registry["agents"]))

        second_plan = sync.build_collaboration_plan(
            task_id="imp:reader:retrieval-audit-second",
            root_agent_id="analyst-agent",
            hint_text="retrieval evidence qmd context audit",
            suggested_agents=[],
            rationale="Need specialist retrieval audit.",
            registry=registry,
            target_metric="evidence_link_coverage",
            owner_section="memory_context",
            linked_snapshot=None,
        )

        self.assertEqual(second_plan["created_profiles"], [])

    def test_execute_seed_collaboration_plans_uses_dispatcher_and_honors_limit(self):
        calls: list[str] = []

        class _DispatcherStub:
            @staticmethod
            def execute_collaboration_plan(*, task_id, collaboration_plan, log_dir):
                calls.append(f"{task_id}:{log_dir}")
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "interaction_mode": collaboration_plan.get("interaction_mode"),
                    "phases": collaboration_plan.get("interaction_phases", []),
                    "runs_total": len(collaboration_plan.get("spawned_instances", [])),
                }

        original_dispatcher = sync.DISPATCHER
        sync.DISPATCHER = _DispatcherStub()
        try:
            tasks = [
                {
                    "external_key": "task-1",
                    "task_brief": {
                        "context_package": {
                            "collaboration_plan": {
                                "interaction_mode": "sequential",
                                "interaction_phases": [{"phase_id": "phase_1_framing"}],
                                "spawned_instances": [{"instance_id": "inst-1"}],
                            }
                        }
                    },
                },
                {
                    "external_key": "task-2",
                    "task_brief": {
                        "context_package": {
                            "collaboration_plan": {
                                "interaction_mode": "mixed_phased",
                                "interaction_phases": [{"phase_id": "phase_1_framing"}, {"phase_id": "phase_2_parallel_audit"}],
                                "spawned_instances": [{"instance_id": "inst-2"}],
                            }
                        }
                    },
                },
            ]

            report = sync.execute_seed_collaboration_plans(tasks, log_dir=Path(".logs/agents"), limit=1)
        finally:
            sync.DISPATCHER = original_dispatcher

        self.assertEqual(report["attempted"], 1)
        self.assertEqual(report["completed"], 1)
        self.assertEqual(report["failed"], 0)
        self.assertEqual(report["results"][0]["task_id"], "task-1")
        self.assertEqual(len(calls), 1)

    def test_execute_seed_collaboration_plans_collects_failures_and_skips_missing_plan(self):
        class _DispatcherStub:
            @staticmethod
            def execute_collaboration_plan(*, task_id, collaboration_plan, log_dir):
                raise RuntimeError(f"boom:{task_id}")

        original_dispatcher = sync.DISPATCHER
        sync.DISPATCHER = _DispatcherStub()
        try:
            tasks = [
                {
                    "external_key": "task-skip",
                    "task_brief": {"context_package": {}},
                },
                {
                    "external_key": "task-fail",
                    "task_brief": {
                        "context_package": {
                            "collaboration_plan": {
                                "interaction_mode": "mixed_phased",
                                "interaction_phases": [{"phase_id": "phase_1_framing"}],
                                "spawned_instances": [{"instance_id": "inst-fail"}],
                            }
                        }
                    },
                },
            ]

            report = sync.execute_seed_collaboration_plans(tasks, log_dir=Path(".logs/agents"))
        finally:
            sync.DISPATCHER = original_dispatcher

        self.assertEqual(report["attempted"], 1)
        self.assertEqual(report["completed"], 0)
        self.assertEqual(report["failed"], 1)
        self.assertEqual(report["skipped"], 1)
        self.assertEqual(report["results"][0]["status"], "skipped")
        self.assertEqual(report["results"][1]["status"], "failed")
        self.assertIn("boom:task-fail", report["results"][1]["error"])

    def test_execute_seed_collaboration_plans_skips_tasks_with_non_ready_status(self):
        class _DispatcherStub:
            @staticmethod
            def execute_collaboration_plan(*, task_id, collaboration_plan, log_dir):
                raise AssertionError("dispatcher must not be called for non-eligible status")

        original_dispatcher = sync.DISPATCHER
        sync.DISPATCHER = _DispatcherStub()
        try:
            tasks = [
                {
                    "external_key": "task-done",
                    "task_brief": {
                        "context_package": {
                            "collaboration_plan": {
                                "interaction_mode": "sequential",
                                "interaction_phases": [{"phase_id": "phase_1_framing"}],
                                "spawned_instances": [{"instance_id": "inst-done"}],
                            }
                        }
                    },
                }
            ]

            report = sync.execute_seed_collaboration_plans(
                tasks,
                log_dir=Path(".logs/agents"),
                eligible_statuses_by_task={"task-done": "done"},
            )
        finally:
            sync.DISPATCHER = original_dispatcher

        self.assertEqual(report["attempted"], 0)
        self.assertEqual(report["completed"], 0)
        self.assertEqual(report["skipped"], 1)
        self.assertEqual(report["results"][0]["reason"], "task_status_not_eligible(done)")

    def test_seed_tasks_keep_explicit_origin_cycle_id_only_when_provided(self):
        registry = {
            "agents": [
                {
                    "id": "designer-agent",
                    "improvements": [
                        {
                            "id": "imp-tooltip",
                            "title": "Tooltip standard",
                            "problem": "Missing help",
                            "solution": "Add tooltip coverage",
                            "effect": "Less ambiguity",
                            "priority": "Высокий",
                            "originCycleId": "cycle-20260306-ux",
                        }
                    ],
                    "analystRecommendations": [
                        {
                            "id": "rec-tooltip-1",
                            "text": "Добавить подсказки для сложных метрик.",
                            "originCycleId": "cycle-20260306-ux",
                        }
                    ],
                }
            ]
        }

        seeds = sync.build_seed_tasks(registry, "analyst-agent")
        by_type = {item["origin_type"]: item for item in seeds}

        self.assertEqual(by_type["improvement"]["task_brief"]["origin_context"]["origin_cycle_id"], "cycle-20260306-ux")
        self.assertEqual(by_type["recommendation"]["task_brief"]["origin_context"]["origin_cycle_id"], "cycle-20260306-ux")

    def test_normalize_event_status_mapping(self):
        self.assertEqual(sync.normalize_event_status("candidate_received"), "backlog")
        self.assertEqual(sync.normalize_event_status("candidate_assessed"), "ready")
        self.assertEqual(sync.normalize_event_status("candidate_rejected"), "backlog")
        self.assertEqual(sync.normalize_event_status("ab_test_started"), "ab_test")
        self.assertEqual(sync.normalize_event_status("ab_test_checkpoint"), "ab_test")
        self.assertEqual(sync.normalize_event_status("ab_test_passed"), "in_review")
        self.assertEqual(sync.normalize_event_status("ab_test_failed"), "backlog")
        self.assertEqual(sync.normalize_event_status("rollback_applied"), "backlog")
        self.assertEqual(sync.normalize_event_status("recommendation_suggested"), "ready")
        self.assertEqual(sync.normalize_event_status("started"), "in_progress")
        self.assertEqual(sync.normalize_event_status("completed"), "in_review")
        self.assertEqual(sync.normalize_event_status("verify_started"), "in_review")
        self.assertEqual(sync.normalize_event_status("verify_passed"), "done")
        self.assertEqual(sync.normalize_event_status("verify_failed"), "backlog")
        self.assertEqual(sync.normalize_event_status("review_passed"), "done")
        self.assertEqual(sync.normalize_event_status("recommendation_applied", "success"), "done")
        self.assertEqual(sync.normalize_event_status("deployed"), "completed")
        self.assertEqual(sync.normalize_event_status("release_done"), "completed")
        self.assertEqual(sync.normalize_event_status("completed", "deployed"), "completed")
        self.assertEqual(sync.normalize_event_status("completed", None, "deploy"), "completed")
        self.assertEqual(sync.normalize_event_status("step_error"), "backlog")
        self.assertIsNone(sync.normalize_event_status("queued"))

    def test_seed_generation_is_idempotent_by_external_key(self):
        registry = {
            "agents": [
                {
                    "id": "reader-agent",
                    "improvements": [{"title": "Fix flicker", "priority": "Средний"}],
                    "analystRecommendations": ["Fix flicker"],
                }
            ]
        }
        first = sync.build_seed_tasks(registry, "analyst-agent")
        second = sync.build_seed_tasks(registry, "analyst-agent")
        first_keys = sorted(item["external_key"] for item in first)
        second_keys = sorted(item["external_key"] for item in second)
        self.assertEqual(first_keys, second_keys)

    def test_ab_test_plan_helpers(self):
        self.assertEqual(sync.clamp_sessions_required(1), 3)
        self.assertEqual(sync.clamp_sessions_required(20), 8)
        self.assertEqual(sync.compute_sessions_required(21.0), 3)
        self.assertEqual(sync.compute_sessions_required(0.4), 8)
        plan = sync.build_ab_test_plan(
            enabled=True,
            target_metric="recommendation_action_rate",
            expected_delta=">= 15%",
        )
        self.assertEqual(plan["pass_rule"], "target_plus_guardrails")
        self.assertEqual(plan["sessions_required"], 4)
        self.assertTrue(plan["rollback_on_fail"])

    def test_suggest_collaboration_agents_excludes_executor(self):
        suggested = sync.suggest_collaboration_agents(
            source_agent_id="reader-agent",
            executor_agent_id="analyst-agent",
            available_agent_ids={"analyst-agent", "reader-agent", "designer-agent"},
            hint_text="UI redesign for retrieval quality metrics",
        )
        self.assertNotIn("analyst-agent", suggested)
        self.assertIn("reader-agent", suggested)
        self.assertIn("designer-agent", suggested)

    def test_resolve_executor_routes_complex_task_to_orchestrator(self):
        resolved = sync.resolve_executor_agent_id(
            default_executor_agent_id="analyst-agent",
            available_agent_ids={"analyst-agent", "orchestrator-agent", "designer-agent"},
            hint_text="Нужно проверить retrieval evidence и UI карточки",
            target_metric="evidence_link_coverage",
            owner_section="UI",
            linked_snapshot={
                "problem": "Риски в telemetry и contract связках",
                "solution": "Нужна согласованная фазовая оркестрация",
            },
        )
        self.assertEqual(resolved, "orchestrator-agent")

    def test_resolve_executor_keeps_default_on_simple_scope(self):
        resolved = sync.resolve_executor_agent_id(
            default_executor_agent_id="analyst-agent",
            available_agent_ids={"analyst-agent", "orchestrator-agent"},
            hint_text="Переименовать заголовок в блоке карточки",
            target_metric="",
            owner_section="",
            linked_snapshot=None,
        )
        self.assertEqual(resolved, "analyst-agent")

    def test_task_context_fixture_contract(self):
        fixture_path = Path(__file__).resolve().parent / "fixtures" / "task_context_package_v2.json"
        payload = json.loads(fixture_path.read_text(encoding="utf-8"))
        self.assertIn("operational_memory", payload)
        self.assertIn("collaboration_plan", payload)
        self.assertIn("ab_test_plan", payload)
        self.assertIn("strategy", payload["collaboration_plan"])
        self.assertIn("spawned_instances", payload["collaboration_plan"])
        self.assertIn("orchestration_budget", payload["collaboration_plan"])
        self.assertEqual(payload["ab_test_plan"]["pass_rule"], "target_plus_guardrails")
        self.assertGreaterEqual(int(payload["ab_test_plan"]["sessions_required"]), 3)
        self.assertLessEqual(int(payload["ab_test_plan"]["sessions_required"]), 8)

    def test_extract_markdown_acceptance_criteria(self):
        markdown = """
        ## Критерии приемки
        - schema check проходит
        - карточка показывает ICE
        - schema check проходит
        """
        criteria = sync.extract_markdown_acceptance_criteria(markdown)
        self.assertEqual(criteria, ["schema check проходит", "карточка показывает ICE"])

    def test_json_default_serializes_datetime_and_uuid(self):
        value = dt.datetime(2026, 2, 26, 14, 40, 0, tzinfo=dt.timezone.utc)
        uuid_value = UUID("00000000-0000-0000-0000-000000000001")
        self.assertEqual(sync.json_default(value), "2026-02-26T14:40:00Z")
        self.assertEqual(sync.json_default(uuid_value), "00000000-0000-0000-0000-000000000001")


if __name__ == "__main__":
    unittest.main()
