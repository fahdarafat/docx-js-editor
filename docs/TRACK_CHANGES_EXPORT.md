# Track Changes Export Workflow

This project supports opt-in DOCX export with Word Track Changes markup.

Default behavior is unchanged:

- `save()` / `toBuffer()` without `trackChanges.enabled: true` produces normal non-tracked output.
- Tracked export only runs when explicitly enabled.

## API Surface

`SaveDocxOptions`:

```ts
interface SaveDocxOptions {
  trackChanges?: {
    enabled?: boolean;
    author?: string;
    date?: string; // ISO 8601 recommended
  };
}
```

Available on:

- `DocxEditorRef.save(options?)`
- `DocumentAgent.toBuffer(options?)`
- `DocumentAgent.toBlob(mimeType?, options?)`
- `repackDocx(document, options?)`

## React Usage

```tsx
const buffer = await editorRef.current?.save({
  trackChanges: {
    enabled: true,
    author: 'Reviewer Name',
    date: new Date().toISOString(),
  },
});
```

## Headless Usage

```ts
import { DocumentAgent } from '@eigenpal/docx-js-editor/headless';

const agent = await DocumentAgent.fromBuffer(originalBuffer);
const trackedBuffer = await agent.toBuffer({
  trackChanges: {
    enabled: true,
    author: 'Reviewer Name',
  },
});
```

## Current Export Behavior

When tracked export is enabled, the export pipeline compares the current document against the baseline snapshot and emits tracked insertion/deletion wrappers in WordprocessingML.

Current guarantees:

- Existing save flow remains backward-compatible.
- Author/date metadata is attached to generated revisions.
- If no baseline snapshot exists, export safely falls back to normal non-tracked output.

## Advanced Revision Primitives

The codebase also includes parser/serializer and helper support for:

- Move wrappers (`w:moveFrom` / `w:moveTo`)
- Run/paragraph property changes (`w:rPrChange` / `w:pPrChange`)
- Table property and structural revision elements (`w:tblPrChange`, `w:trPrChange`, `w:tcPrChange`, row/cell structural markers)

These primitives round-trip through parsing/serialization and can be applied programmatically via revision helper modules under `src/docx/revisions/`.
