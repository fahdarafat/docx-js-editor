import type {
  BlockContent,
  Document,
  Paragraph,
  ParagraphContent,
  Run,
} from '../../types/document';
import { revisionizeParagraphRuns, type ParagraphRevisionizeOptions } from './revisionizeParagraph';

export interface RevisionizeDocumentOptions extends ParagraphRevisionizeOptions {}

export function revisionizeDocument(
  previous: Document,
  current: Document,
  options: RevisionizeDocumentOptions = {}
): Document {
  const previousBlocks = previous.package.document.content;
  const currentBlocks = current.package.document.content;
  const nextBlocks: BlockContent[] = [];
  const blockCount = Math.max(previousBlocks.length, currentBlocks.length);

  for (let i = 0; i < blockCount; i += 1) {
    const prevBlock = previousBlocks[i];
    const currBlock = currentBlocks[i];

    if (prevBlock?.type === 'paragraph' && currBlock?.type === 'paragraph') {
      nextBlocks.push(revisionizeParagraphBlock(prevBlock, currBlock, options));
      continue;
    }

    if (!prevBlock && currBlock?.type === 'paragraph') {
      nextBlocks.push(revisionizeParagraphBlock(createEmptyParagraph(), currBlock, options));
      continue;
    }

    if (prevBlock?.type === 'paragraph' && !currBlock) {
      nextBlocks.push(revisionizeParagraphBlock(prevBlock, createEmptyParagraph(), options));
      continue;
    }

    // Non-paragraph fallback: keep current block when present.
    if (currBlock) {
      nextBlocks.push(currBlock);
    }
  }

  return {
    ...current,
    package: {
      ...current.package,
      document: {
        ...current.package.document,
        content: nextBlocks,
      },
    },
  };
}

function revisionizeParagraphBlock(
  previous: Paragraph,
  current: Paragraph,
  options: RevisionizeDocumentOptions
): Paragraph {
  const previousRuns = extractRuns(previous.content);
  const currentRuns = extractRuns(current.content);
  const content = revisionizeParagraphRuns(previousRuns, currentRuns, options);

  return {
    ...current,
    content,
  };
}

function extractRuns(content: ParagraphContent[]): Run[] {
  const runs: Run[] = [];

  for (const item of content) {
    if (item.type === 'run') {
      runs.push(item);
      continue;
    }

    if (item.type === 'hyperlink') {
      for (const child of item.children) {
        if (child.type === 'run') {
          runs.push(child);
        }
      }
    }
  }

  return runs;
}

function createEmptyParagraph(): Paragraph {
  return {
    type: 'paragraph',
    content: [],
  };
}
