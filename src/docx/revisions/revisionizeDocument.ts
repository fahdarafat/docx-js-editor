import type {
  BlockContent,
  Document,
  Paragraph,
  ParagraphContent,
  TableCell,
  TableRow,
  Table,
  Run,
} from '../../types/document';
import { revisionizeParagraphRuns, type ParagraphRevisionizeOptions } from './revisionizeParagraph';
import { detectDocumentMoves, type MoveDetectionOptions } from './moveDetection';
import { createRevisionIdAllocator } from './revisionIds';

const REALIGN_LOOKAHEAD = 64;

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

  let prevIndex = 0;
  let currIndex = 0;

  while (prevIndex < previousBlocks.length || currIndex < currentBlocks.length) {
    const prevBlock = previousBlocks[prevIndex];
    const currBlock = currentBlocks[currIndex];

    if (!prevBlock && currBlock) {
      appendInsertedBlock(nextBlocks, currBlock, paragraphOptions);
      currIndex += 1;
      continue;
    }

    if (prevBlock && !currBlock) {
      appendDeletedBlock(nextBlocks, prevBlock, paragraphOptions);
      prevIndex += 1;
      continue;
    }

    if (!prevBlock || !currBlock) {
      break;
    }

    if (blocksAreEquivalent(prevBlock, currBlock)) {
      appendPairedBlocks(
        nextBlocks,
        prevBlock,
        currBlock,
        prevIndex,
        currIndex,
        movedParagraphBlocks,
        paragraphOptions
      );
      prevIndex += 1;
      currIndex += 1;
      continue;
    }

    const nextCurrMatch = findMatchingBlockIndex(
      currentBlocks,
      currIndex + 1,
      prevBlock,
      REALIGN_LOOKAHEAD
    );
    const nextPrevMatch = findMatchingBlockIndex(
      previousBlocks,
      prevIndex + 1,
      currBlock,
      REALIGN_LOOKAHEAD
    );

    if (
      nextCurrMatch !== -1 &&
      (nextPrevMatch === -1 || nextCurrMatch - currIndex <= nextPrevMatch - prevIndex)
    ) {
      while (currIndex < nextCurrMatch) {
        appendInsertedBlock(nextBlocks, currentBlocks[currIndex], paragraphOptions);
        currIndex += 1;
      }
      continue;
    }

    if (nextPrevMatch !== -1) {
      while (prevIndex < nextPrevMatch) {
        appendDeletedBlock(nextBlocks, previousBlocks[prevIndex], paragraphOptions);
        prevIndex += 1;
      }
      continue;
    }

    appendPairedBlocks(
      nextBlocks,
      prevBlock,
      currBlock,
      prevIndex,
      currIndex,
      movedParagraphBlocks,
      paragraphOptions
    );
    prevIndex += 1;
    currIndex += 1;
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

function appendPairedBlocks(
  result: BlockContent[],
  previous: BlockContent,
  current: BlockContent,
  previousIndex: number,
  currentIndex: number,
  movedParagraphBlocks: Set<number> | null,
  options: RevisionizeDocumentOptions
): void {
  if (previous.type === 'paragraph' && current.type === 'paragraph') {
    if (movedParagraphBlocks?.has(previousIndex) || movedParagraphBlocks?.has(currentIndex)) {
      // Keep move-detected paragraphs revisionized through the same allocator path.
      result.push(revisionizeParagraphBlock(previous, current, options));
      return;
    }

    result.push(revisionizeParagraphBlock(previous, current, options));
    return;
  }

  if (previous.type === 'table' && current.type === 'table') {
    result.push(revisionizeTableBlock(previous, current, options));
    return;
  }

  // Non-paragraph fallback: keep current block when present.
  result.push(current);
}

function appendInsertedBlock(
  result: BlockContent[],
  block: BlockContent | undefined,
  options: RevisionizeDocumentOptions
): void {
  if (!block) return;
  if (block.type === 'paragraph') {
    result.push(revisionizeParagraphBlock(createEmptyParagraph(), block, options));
    return;
  }
  result.push(block);
}

function appendDeletedBlock(
  result: BlockContent[],
  block: BlockContent | undefined,
  options: RevisionizeDocumentOptions
): void {
  if (!block) return;
  if (block.type === 'paragraph') {
    result.push(revisionizeParagraphBlock(block, createEmptyParagraph(), options));
  }
}

function findMatchingBlockIndex(
  blocks: BlockContent[],
  startIndex: number,
  target: BlockContent,
  lookahead: number
): number {
  const maxIndex = Math.min(blocks.length, startIndex + lookahead);
  for (let i = startIndex; i < maxIndex; i += 1) {
    if (blocksAreEquivalent(blocks[i], target)) {
      return i;
    }
  }
  return -1;
}

function blocksAreEquivalent(previous: BlockContent, current: BlockContent): boolean {
  if (previous.type !== current.type) {
    return false;
  }

  if (previous.type === 'paragraph' && current.type === 'paragraph') {
    return getParagraphAnchor(previous) === getParagraphAnchor(current);
  }

  if (previous.type === 'table' && current.type === 'table') {
    return getTableAnchor(previous) === getTableAnchor(current);
  }

  return false;
}

function getParagraphAnchor(paragraph: Paragraph): string {
  return `${paragraph.formatting?.styleId ?? ''}|${extractRuns(paragraph.content)
    .flatMap((run) =>
      run.content
        .filter((content): content is { type: 'text'; text: string } => content.type === 'text')
        .map((content) => content.text)
    )
    .join('')}`;
}

function getTableAnchor(table: Table): string {
  const rows = table.rows.map((row) =>
    row.cells
      .map((cell) =>
        cell.content
          .filter((content): content is Paragraph => content.type === 'paragraph')
          .map((paragraph) => getParagraphAnchor(paragraph))
          .join('||')
      )
      .join('|')
  );
  return `${table.formatting?.styleId ?? ''}|${rows.join('::')}`;
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

function revisionizeTableBlock(
  previous: Table,
  current: Table,
  options: RevisionizeDocumentOptions
): Table {
  const rowCount = Math.max(previous.rows.length, current.rows.length);
  const rows: TableRow[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const previousRow = previous.rows[rowIndex];
    const currentRow = current.rows[rowIndex];

    if (!currentRow) {
      continue;
    }

    if (!previousRow) {
      rows.push(currentRow);
      continue;
    }

    rows.push({
      ...currentRow,
      cells: revisionizeTableCells(previousRow.cells, currentRow.cells, options),
    });
  }

  return {
    ...current,
    rows,
  };
}

function revisionizeTableCells(
  previousCells: TableCell[],
  currentCells: TableCell[],
  options: RevisionizeDocumentOptions
): TableCell[] {
  const cellCount = Math.max(previousCells.length, currentCells.length);
  const cells: TableCell[] = [];

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const previousCell = previousCells[cellIndex];
    const currentCell = currentCells[cellIndex];

    if (!currentCell) {
      continue;
    }

    if (!previousCell) {
      cells.push(currentCell);
      continue;
    }

    cells.push({
      ...currentCell,
      content: revisionizeTableCellContent(previousCell.content, currentCell.content, options),
    });
  }

  return cells;
}

function revisionizeTableCellContent(
  previous: (Paragraph | Table)[],
  current: (Paragraph | Table)[],
  options: RevisionizeDocumentOptions
): (Paragraph | Table)[] {
  const revisedBlocks = revisionizeDocument(
    createDocumentFromBlocks(previous),
    createDocumentFromBlocks(current),
    options
  ).package.document.content;

  return revisedBlocks.filter(
    (block): block is Paragraph | Table => block.type === 'paragraph' || block.type === 'table'
  );
}

function createDocumentFromBlocks(blocks: BlockContent[]): Document {
  return {
    package: {
      document: {
        content: blocks,
      },
    },
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
