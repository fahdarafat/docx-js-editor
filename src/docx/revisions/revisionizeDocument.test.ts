import { describe, expect, test } from 'bun:test';
import type { Document, Paragraph, Run } from '../../types/document';
import { createRevisionIdAllocator } from './revisionIds';
import { revisionizeDocument } from './revisionizeDocument';

function textRun(text: string, formatting?: Run['formatting']): Run {
  return {
    type: 'run',
    ...(formatting ? { formatting } : {}),
    content: [{ type: 'text', text }],
  };
}

function paragraph(text: string): Paragraph {
  return {
    type: 'paragraph',
    content: [textRun(text)],
  };
}

function documentFromParagraphs(...paragraphs: Paragraph[]): Document {
  return {
    package: {
      document: {
        content: paragraphs,
      },
    },
  };
}

describe('revisionizeDocument', () => {
  test('adds insertion wrappers for inserted text in matching paragraphs', () => {
    const previous = documentFromParagraphs(paragraph('Alpha Beta'));
    const current = documentFromParagraphs(paragraph('Alpha Gamma Beta'));
    const allocator = createRevisionIdAllocator(10);

    const result = revisionizeDocument(previous, current, {
      allocator,
      insertionMetadata: { author: 'Reviewer A' },
    });

    const firstParagraph = result.package.document.content[0];
    expect(firstParagraph.type).toBe('paragraph');
    if (firstParagraph.type === 'paragraph') {
      const insertions = firstParagraph.content.filter((item) => item.type === 'insertion');
      expect(insertions).toHaveLength(1);
      expect(insertions[0].info.id).toBe(10);
      expect(insertions[0].info.author).toBe('Reviewer A');
    }
  });

  test('adds deletion wrappers when paragraph content is removed', () => {
    const previous = documentFromParagraphs(paragraph('Keep'), paragraph('Remove me'));
    const current = documentFromParagraphs(paragraph('Keep'));
    const allocator = createRevisionIdAllocator(20);

    const result = revisionizeDocument(previous, current, { allocator });

    expect(result.package.document.content).toHaveLength(2);
    const secondParagraph = result.package.document.content[1];
    expect(secondParagraph.type).toBe('paragraph');
    if (secondParagraph.type === 'paragraph') {
      const deletions = secondParagraph.content.filter((item) => item.type === 'deletion');
      expect(deletions).toHaveLength(1);
      expect(deletions[0].info.id).toBe(20);
    }
  });

  test('adds insertion wrappers for newly added paragraphs', () => {
    const previous = documentFromParagraphs(paragraph('Keep'));
    const current = documentFromParagraphs(paragraph('Keep'), paragraph('Added line'));
    const allocator = createRevisionIdAllocator(30);

    const result = revisionizeDocument(previous, current, { allocator });

    expect(result.package.document.content).toHaveLength(2);
    const secondParagraph = result.package.document.content[1];
    expect(secondParagraph.type).toBe('paragraph');
    if (secondParagraph.type === 'paragraph') {
      const insertions = secondParagraph.content.filter((item) => item.type === 'insertion');
      expect(insertions).toHaveLength(1);
      expect(insertions[0].info.id).toBe(30);
    }
  });
});
