import { describe, expect, test } from 'bun:test';
import type { BlockContent, Document, Paragraph, Run } from '../../types/document';
import { detectDocumentMoves, detectParagraphMoves, detectRunMoves } from './moveDetection';
import { revisionizeDocument } from './revisionizeDocument';

function textRun(text: string): Run {
  return {
    type: 'run',
    content: [{ type: 'text', text }],
  };
}

function paragraphFromRuns(...texts: string[]): Paragraph {
  return {
    type: 'paragraph',
    content: texts.map((text) => textRun(text)),
  };
}

function paragraph(text: string): Paragraph {
  return paragraphFromRuns(text);
}

function documentFromBlocks(...content: BlockContent[]): Document {
  return {
    package: {
      document: {
        content,
      },
    },
  };
}

describe('moveDetection', () => {
  test('detectParagraphMoves finds true paragraph moves without flagging shifted neighbors', () => {
    const previousBlocks: BlockContent[] = [
      paragraph('Alpha'),
      paragraph('Beta'),
      paragraph('Gamma'),
    ];
    const currentBlocks: BlockContent[] = [
      paragraph('Beta'),
      paragraph('Gamma'),
      paragraph('Alpha'),
    ];

    const moves = detectParagraphMoves(previousBlocks, currentBlocks);

    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({
      text: 'Alpha',
      fromBlockIndex: 0,
      toBlockIndex: 2,
    });
  });

  test('detectRunMoves finds run reordering within a stable paragraph', () => {
    const previousBlocks: BlockContent[] = [paragraphFromRuns('One', 'Two', 'Three')];
    const currentBlocks: BlockContent[] = [paragraphFromRuns('Two', 'Three', 'One')];

    const runMoves = detectRunMoves(previousBlocks, currentBlocks, []);

    expect(runMoves).toHaveLength(1);
    expect(runMoves[0]).toEqual({
      text: 'One',
      paragraphBlockIndex: 0,
      fromRunIndex: 0,
      toRunIndex: 2,
    });
  });

  test('detectDocumentMoves suppresses run move detection for paragraphs already detected as moved', () => {
    const previous = documentFromBlocks(paragraphFromRuns('Move', 'Me'), paragraph('Stable'));
    const current = documentFromBlocks(paragraph('Stable'), paragraphFromRuns('Move', 'Me'));

    const moves = detectDocumentMoves(previous, current);

    expect(moves.paragraphMoves).toHaveLength(1);
    expect(moves.runMoves).toHaveLength(0);
  });
});

describe('revisionizeDocument move-detection phase', () => {
  test('shares a single allocator across paragraphs when revisionizing', () => {
    const previous = documentFromBlocks(paragraph('Alpha'), paragraph('Beta'));
    const current = documentFromBlocks(paragraph('Alpha plus'), paragraph('Beta plus'));

    const result = revisionizeDocument(previous, current);

    const firstParagraph = result.package.document.content[0];
    const secondParagraph = result.package.document.content[1];
    expect(firstParagraph.type).toBe('paragraph');
    expect(secondParagraph.type).toBe('paragraph');
    if (firstParagraph.type !== 'paragraph' || secondParagraph.type !== 'paragraph') return;

    const firstInsertion = firstParagraph.content.find((item) => item.type === 'insertion');
    const secondInsertion = secondParagraph.content.find((item) => item.type === 'insertion');

    expect(firstInsertion?.type).toBe('insertion');
    expect(secondInsertion?.type).toBe('insertion');
    if (!firstInsertion || firstInsertion.type !== 'insertion') return;
    if (!secondInsertion || secondInsertion.type !== 'insertion') return;

    expect(firstInsertion.info.id).toBe(1);
    expect(secondInsertion.info.id).toBe(2);
  });
});
