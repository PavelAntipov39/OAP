# BPMN Sources

This directory stores canonical BPMN diagrams for the project.

## Rules
1. Each diagram is stored as a standalone `.bpmn` file.
2. `docs/bpmn/*.bpmn` is the source of truth for BPMN in all UIs (`web` and `ops-web`).
3. When business flow changes, update the related `.bpmn` file in the same task.
4. Keep diagram id, process name, and labels aligned with current product behavior.

## Current diagrams
1. `character-profile.bpmn` - flow for loading and displaying the character profile.
