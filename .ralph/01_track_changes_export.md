# Ralph Loop Plan - Track Changes Export (Optional Per-Save Toggle)

## Objective
Implement export-time Track Changes generation in incremental Ralph iterations, with default save behavior unchanged and an opt-in tracked export path.

## Tasks
- [x] Task 01 - Create `.ralph` bootstrap and plan file
  - Files: `.ralph/01_track_changes_export.md`, `.ralph/progress.txt`
  - Verify: `bun run typecheck`
  - Targeted tests: none
  - Commit: `feat: Create .ralph track changes export plan scaffold`

- [ ] Task 02 - Add save/export option types and API plumbing
  - Files: `src/components/DocxEditor.tsx`, `src/agent/DocumentAgent.ts`, `src/index.ts`, `src/core.ts`, `src/headless.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npx playwright test e2e/tests/editor.spec.ts --grep "load|edit" --timeout=30000 --workers=4`
  - Commit: `feat: Add track changes save option plumbing`

- [ ] Task 03 - Persist export baseline document snapshot
  - Files: `src/components/DocxEditor.tsx`, `src/agent/DocumentAgent.ts`, `src/types/document.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npx playwright test e2e/tests/text-editing.spec.ts --grep "Type single character" --timeout=30000 --workers=4`
  - Commit: `feat: Persist baseline document snapshot for tracked export`

- [ ] Task 04 - Add revision model primitives for export engine
  - Files: `src/types/content.ts`, `src/types/document.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: none
  - Commit: `feat: Add revision model primitives for track changes export`

- [ ] Task 05 - Implement revision ID allocator and metadata helpers
  - Files: `src/docx/revisions/revisionIds.ts`, `src/docx/revisions/metadata.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/revisionIds.test.ts`
  - Commit: `feat: Add revision ID allocator and metadata helpers`

- [ ] Task 06 - Implement run-level text diff engine
  - Files: `src/docx/revisions/runDiff.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/runDiff.test.ts`
  - Commit: `feat: Add run-level diff engine for tracked revisions`

- [ ] Task 07 - Build paragraph revisionizer (`w:ins`/`w:del`)
  - Files: `src/docx/revisions/revisionizeParagraph.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/revisionizeParagraph.test.ts`
  - Commit: `feat: Generate insertion and deletion wrappers from paragraph diffs`

- [ ] Task 08 - Build document-level revisionizer orchestration
  - Files: `src/docx/revisions/revisionizeDocument.ts`, `src/docx/revisions/index.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/revisionizeDocument.test.ts`
  - Commit: `feat: Add document-level tracked revisionization pipeline`

- [ ] Task 09 - Integrate revisionizer into repack export path
  - Files: `src/docx/rezip.ts`, `src/agent/DocumentAgent.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npx playwright test e2e/tests/editor.spec.ts --grep "save" --timeout=30000 --workers=4`
  - Commit: `feat: Integrate tracked revisionization into DOCX repack export`

- [ ] Task 10 - Add parser/serializer hardening for generated revision output
  - Files: `src/docx/paragraphParser.ts`, `src/docx/serializer/paragraphSerializer.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/paragraphParser.test.ts src/docx/serializer/paragraphSerializer.test.ts`
  - Commit: `feat: Harden revision parsing and serialization round-trip`

- [ ] Task 11 - Add export integration tests (DOCX XML assertions)
  - Files: `e2e/tests/track-changes-export.spec.ts`, `e2e/helpers/*`
  - Verify: `bun run typecheck`
  - Targeted tests: `npx playwright test e2e/tests/track-changes-export.spec.ts --timeout=30000 --workers=4`
  - Commit: `feat: Add E2E tracked export XML assertions`

- [ ] Task 12 - Add move detection phase (paragraph and run moves)
  - Files: `src/docx/revisions/moveDetection.ts`, `src/docx/revisions/revisionizeDocument.ts`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/moveDetection.test.ts`
  - Commit: `feat: Add move detection for tracked export revisions`

- [ ] Task 13 - Add move serialization/parsing support
  - Files: `src/types/content.ts`, `src/docx/paragraphParser.ts`, `src/docx/serializer/paragraphSerializer.ts`, `src/prosemirror/conversion/*`
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/moveSerialization.test.ts`
  - Commit: `feat: Support moveFrom and moveTo tracked revisions`

- [ ] Task 14 - Add paragraph/run property change revision support
  - Files: `src/types/content.ts`, `src/docx/revisions/propertyChanges.ts`, serializer/parser files
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/propertyChanges.test.ts`
  - Commit: `feat: Add paragraph and run property tracked changes`

- [ ] Task 15 - Add table property/structure tracked revisions
  - Files: table parser/serializer plus revision modules
  - Verify: `bun run typecheck`
  - Targeted tests: `npm run test -- src/docx/revisions/tableChanges.test.ts`
  - Commit: `feat: Add table tracked revision support`

- [ ] Task 16 - Documentation and usage examples
  - Files: `README.md`, `docs/*`
  - Verify: `bun run typecheck`
  - Targeted tests: `npx playwright test e2e/tests/track-changes-export.spec.ts --timeout=30000 --workers=4`
  - Commit: `feat: Document tracked changes export workflow`

## Output Contract
Use after each iteration:

```json
RALPH_STATUS: {
  "status": "in_progress" | "complete",
  "current_task": "<task title>" | "none",
  "exit_signal": false | true
}
```
