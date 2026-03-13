# CLAUDE.md

Este directorio es un espacio de pruebas de IA: experimentación con skills, agentes, prompts y herramientas de Claude Code.

- No es producción
- Uso individual por developer
- Siempre en local

## Code Style Guidelines

Coding standards are provided via the `coding-standards` skill (shared-references plugin).

## Code Generation Rules

After completing all code changes, run `yarn eslint --fix`.
Skip manual typecheck in conversation — CI catches TS errors.

## Rules

- Always run `yarn eslint --fix` after code changes
- Follow coding standards in `coding-standards` skill (shared-references plugin)
- For commit message use the skill `commit-changes` (shared-references plugin)

## Plans

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, include a list of unresolved questions if any. Keep questions extremely concise. No timing estimates.
