# ADR-M6: Portal and preset mapping

## Context
EasyTutor portals: `high_school` (KICD), `university`, `knowledge_explorer`; plus optional `professional`. StashMind concepts: `student`, `learner`. The mapping must live in core config with tests, while KICD alignment remains EasyTutor content.

## Decision
1. `high_school` (KICD) → `student`; KICD alignment stays EasyTutor content.
2. `university` → `student`.
3. `knowledge_explorer` → `learner`.
4. `professional` → optional extra track.
5. The mapping lives in `@stashmind/core` config with unit tests covering each portal → role mapping and a "no unmapped portal" guard.

## Consequences
- **Positive:** Single source of truth for portal mapping; testable; KICD content ownership unchanged.
- **Negative:** Adding new portals requires core config change + test + both-repo adoption behind flag.
- **Cross-links:** ADR-M1 (integration), ADR-M4 (core config), ADR-M7 (flagged rollout). EasyTutor mirrors in `docs/adr/`.
