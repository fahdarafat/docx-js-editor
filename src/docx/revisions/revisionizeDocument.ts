import type {
  BlockContent,
  Document,
  Paragraph,
  ParagraphContent,
  Run,
} from '../../types/document';
import { revisionizeParagraphRuns, type ParagraphRevisionizeOptions } from './revisionizeParagraph';
import { detectDocumentMoves, type MoveDetectionOptions } from './moveDetection';
import { createRevisionIdAllocator } from './revisionIds';

export interface RevisionizeDocumentOptions extends ParagraphRevisionizeOptions {
  /**
   * Enables the move-detection phase (paragraph/run analysis).
   *
   * This phase is currently preparatory and does not yet emit moveFrom/moveTo wrappers.
   */
  detectMoves?: boolean;
  /**
   * Tuning options for move-detection heuristics.
   */
  moveDetection?: MoveDetectionOptions;
}

export function revisionizeDocument(
  previous: Document,
  current: Document,
  options: RevisionizeDocumentOptions = {}
): Document {
  const allocator = options.allocator ?? createRevisionIdAllocator(1);
  const paragraphOptions: ParagraphRevisionizeOptions = {
    ...options,
    allocator,
  };

  const moveDetectionResult = options.detectMoves
    ? detectDocumentMoves(previous, current, options.moveDetection)
    : null;
  const movedParagraphBlocks = moveDetectionResult
    ? new Set<number>([
        ...moveDetectionResult.paragraphMoves.map((move) => move.fromBlockIndex),
        ...moveDetectionResult.paragraphMoves.map((move) => move.toBlockIndex),
      ])
    : null;

  const previousBlocks = previous.package.document.content;
  const currentBlocks = current.package.document.content;
  const nextBlocks: BlockContent[] = [];
  const blockCount = Math.max(previousBlocks.length, currentBlocks.length);

  for (let i = 0; i < blockCount; i += 1) {
    const prevBlock = previousBlocks[i];
    const currBlock = currentBlocks[i];

    if (
      movedParagraphBlocks?.has(i) &&
      prevBlock?.type === 'paragraph' &&
      currBlock?.type === 'paragraph'
    ) {
      // Phase-1 integration: run the detection phase now, and keep stable diff output
      // until move wrappers are emitted in the serialization/parsing phase.
      nextBlocks.push(revisionizeParagraphBlock(prevBlock, currBlock, paragraphOptions));
      continue;
    }

    if (prevBlock?.type === 'paragraph' && currBlock?.type === 'paragraph') {
      nextBlocks.push(revisionizeParagraphBlock(prevBlock, currBlock, paragraphOptions));
      continue;
    }

    if (!prevBlock && currBlock?.type === 'paragraph') {
      nextBlocks.push(
        revisionizeParagraphBlock(createEmptyParagraph(), currBlock, paragraphOptions)
      );
      continue;
    }

    if (prevBlock?.type === 'paragraph' && !currBlock) {
      nextBlocks.push(
        revisionizeParagraphBlock(prevBlock, createEmptyParagraph(), paragraphOptions)
      );
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
