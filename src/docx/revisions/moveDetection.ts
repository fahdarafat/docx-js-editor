import type {
  BlockContent,
  Document,
  Paragraph,
  ParagraphContent,
  Run,
} from '../../types/document';

export interface ParagraphMove {
  text: string;
  fromBlockIndex: number;
  toBlockIndex: number;
}

export interface RunMove {
  text: string;
  paragraphBlockIndex: number;
  fromRunIndex: number;
  toRunIndex: number;
}

export interface MoveDetectionResult {
  paragraphMoves: ParagraphMove[];
  runMoves: RunMove[];
}

export interface MoveDetectionOptions {
  minParagraphTextLength?: number;
  minRunTextLength?: number;
  detectRunMoves?: boolean;
}

interface ParagraphEntry {
  blockIndex: number;
  text: string;
}

interface RunEntry {
  runIndex: number;
  text: string;
}

export function detectDocumentMoves(
  previous: Document,
  current: Document,
  options: MoveDetectionOptions = {}
): MoveDetectionResult {
  const paragraphMoves = detectParagraphMoves(
    previous.package.document.content,
    current.package.document.content,
    options
  );
  const runMoves =
    options.detectRunMoves === false
      ? []
      : detectRunMoves(
          previous.package.document.content,
          current.package.document.content,
          paragraphMoves,
          options
        );

  return {
    paragraphMoves,
    runMoves,
  };
}

export function detectParagraphMoves(
  previousBlocks: BlockContent[],
  currentBlocks: BlockContent[],
  options: MoveDetectionOptions = {}
): ParagraphMove[] {
  const minParagraphTextLength = options.minParagraphTextLength ?? 1;
  const previousParagraphs = collectParagraphEntries(previousBlocks);
  const currentParagraphs = collectParagraphEntries(currentBlocks);

  if (previousParagraphs.length === 0 || currentParagraphs.length === 0) {
    return [];
  }

  const previousTokens = previousParagraphs.map((entry) => entry.text);
  const currentTokens = currentParagraphs.map((entry) => entry.text);
  const lcsMatches = computeLcsMatches(previousTokens, currentTokens);
  const matchedPrevious = new Set(lcsMatches.map(([prevIdx]) => prevIdx));
  const matchedCurrent = new Set(lcsMatches.map(([, currIdx]) => currIdx));

  const unmatchedCurrentByText = new Map<string, number[]>();
  for (let i = 0; i < currentParagraphs.length; i += 1) {
    if (matchedCurrent.has(i)) continue;
    const text = currentParagraphs[i].text;
    const queue = unmatchedCurrentByText.get(text);
    if (queue) {
      queue.push(i);
    } else {
      unmatchedCurrentByText.set(text, [i]);
    }
  }

  const moves: ParagraphMove[] = [];
  for (let i = 0; i < previousParagraphs.length; i += 1) {
    if (matchedPrevious.has(i)) continue;

    const previousEntry = previousParagraphs[i];
    if (previousEntry.text.trim().length < minParagraphTextLength) {
      continue;
    }

    const candidates = unmatchedCurrentByText.get(previousEntry.text);
    if (!candidates || candidates.length === 0) {
      continue;
    }

    const currentParagraphIndex = candidates.shift();
    if (currentParagraphIndex === undefined) {
      continue;
    }

    const currentEntry = currentParagraphs[currentParagraphIndex];
    if (previousEntry.blockIndex === currentEntry.blockIndex) {
      continue;
    }

    moves.push({
      text: previousEntry.text,
      fromBlockIndex: previousEntry.blockIndex,
      toBlockIndex: currentEntry.blockIndex,
    });
  }

  return moves;
}

export function detectRunMoves(
  previousBlocks: BlockContent[],
  currentBlocks: BlockContent[],
  paragraphMoves: ParagraphMove[],
  options: MoveDetectionOptions = {}
): RunMove[] {
  const minRunTextLength = options.minRunTextLength ?? 1;
  const movedFromBlocks = new Set(paragraphMoves.map((move) => move.fromBlockIndex));
  const movedToBlocks = new Set(paragraphMoves.map((move) => move.toBlockIndex));
  const blockCount = Math.max(previousBlocks.length, currentBlocks.length);
  const runMoves: RunMove[] = [];

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    const previousBlock = previousBlocks[blockIndex];
    const currentBlock = currentBlocks[blockIndex];

    if (
      previousBlock?.type !== 'paragraph' ||
      currentBlock?.type !== 'paragraph' ||
      movedFromBlocks.has(blockIndex) ||
      movedToBlocks.has(blockIndex)
    ) {
      continue;
    }

    const previousRuns = collectRunEntries(previousBlock);
    const currentRuns = collectRunEntries(currentBlock);

    if (previousRuns.length === 0 || currentRuns.length === 0) {
      continue;
    }

    const previousTokens = previousRuns.map((entry) => entry.text);
    const currentTokens = currentRuns.map((entry) => entry.text);
    const lcsMatches = computeLcsMatches(previousTokens, currentTokens);
    const matchedPrevious = new Set(lcsMatches.map(([prevIdx]) => prevIdx));
    const matchedCurrent = new Set(lcsMatches.map(([, currIdx]) => currIdx));

    const unmatchedCurrentByText = new Map<string, number[]>();
    for (let i = 0; i < currentRuns.length; i += 1) {
      if (matchedCurrent.has(i)) continue;
      const text = currentRuns[i].text;
      const queue = unmatchedCurrentByText.get(text);
      if (queue) {
        queue.push(i);
      } else {
        unmatchedCurrentByText.set(text, [i]);
      }
    }

    for (let i = 0; i < previousRuns.length; i += 1) {
      if (matchedPrevious.has(i)) continue;

      const previousEntry = previousRuns[i];
      if (previousEntry.text.trim().length < minRunTextLength) {
        continue;
      }

      const candidates = unmatchedCurrentByText.get(previousEntry.text);
      if (!candidates || candidates.length === 0) {
        continue;
      }

      const currentRunIndex = candidates.shift();
      if (currentRunIndex === undefined) {
        continue;
      }

      const currentEntry = currentRuns[currentRunIndex];
      if (previousEntry.runIndex === currentEntry.runIndex) {
        continue;
      }

      runMoves.push({
        text: previousEntry.text,
        paragraphBlockIndex: blockIndex,
        fromRunIndex: previousEntry.runIndex,
        toRunIndex: currentEntry.runIndex,
      });
    }
  }

  return runMoves;
}

function collectParagraphEntries(blocks: BlockContent[]): ParagraphEntry[] {
  const paragraphs: ParagraphEntry[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    if (block.type !== 'paragraph') continue;

    paragraphs.push({
      blockIndex,
      text: extractParagraphText(block),
    });
  }

  return paragraphs;
}

function collectRunEntries(paragraph: Paragraph): RunEntry[] {
  const runs: RunEntry[] = [];
  const paragraphRuns = extractRuns(paragraph.content);

  for (let runIndex = 0; runIndex < paragraphRuns.length; runIndex += 1) {
    const run = paragraphRuns[runIndex];
    const text = extractRunText(run);
    if (text.length === 0) continue;
    runs.push({
      runIndex,
      text,
    });
  }

  return runs;
}

function extractParagraphText(paragraph: Paragraph): string {
  return extractRuns(paragraph.content)
    .map((run) => extractRunText(run))
    .join('');
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

function extractRunText(run: Run): string {
  return run.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map((item) => item.text)
    .join('');
}

function computeLcsMatches(
  previousTokens: string[],
  currentTokens: string[]
): Array<[number, number]> {
  const lcsTable = buildLcsTable(previousTokens, currentTokens);
  const matches: Array<[number, number]> = [];

  let i = previousTokens.length;
  let j = currentTokens.length;

  while (i > 0 && j > 0) {
    if (previousTokens[i - 1] === currentTokens[j - 1]) {
      matches.push([i - 1, j - 1]);
      i -= 1;
      j -= 1;
      continue;
    }

    if (lcsTable[i - 1][j] >= lcsTable[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  matches.reverse();
  return matches;
}

function buildLcsTable(previousTokens: string[], currentTokens: string[]): number[][] {
  const rows = previousTokens.length + 1;
  const cols = currentTokens.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (previousTokens[i - 1] === currentTokens[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}
