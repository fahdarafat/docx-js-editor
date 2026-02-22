import { test, expect } from '@playwright/test';
import type { Document } from '../../src/types/document';
import { createEmptyDocx, repackDocx } from '../../src/docx/rezip';
import {
  createBaselineSnapshot,
  createTextParagraph,
  extractDocumentXml,
} from '../helpers/track-changes-export';

function createDocumentForExport(
  originalBuffer: ArrayBuffer,
  currentParagraphText: string,
  baselineParagraphText: string
): Document {
  return {
    package: {
      document: {
        content: [createTextParagraph(currentParagraphText)],
      },
    },
    originalBuffer,
    baselineDocument: createBaselineSnapshot(originalBuffer, baselineParagraphText),
  };
}

test.describe('Track Changes Export XML Assertions', () => {
  test('emits insertion wrappers when tracked export is enabled', async () => {
    const originalBuffer = await createEmptyDocx();
    const doc = createDocumentForExport(originalBuffer, 'Tracked insertion', '');

    const exportedBuffer = await repackDocx(doc, {
      trackChanges: {
        enabled: true,
        author: 'Track Tester',
        date: '2026-02-22T12:00:00Z',
      },
    });

    const documentXml = await extractDocumentXml(exportedBuffer);

    expect(documentXml).toContain('<w:ins ');
    expect(documentXml).toContain('w:author="Track Tester"');
    expect(documentXml).toContain('w:date="2026-02-22T12:00:00.000Z"');
    expect(documentXml).toContain('<w:t>Tracked insertion</w:t>');
    expect(documentXml).not.toContain('<w:del ');
  });

  test('emits deletion wrappers with delText when existing text is removed', async () => {
    const originalBuffer = await createEmptyDocx();
    const doc = createDocumentForExport(originalBuffer, 'aseline text', 'Baseline text');

    const exportedBuffer = await repackDocx(doc, {
      trackChanges: {
        enabled: true,
        author: 'Delete Reviewer',
      },
    });

    const documentXml = await extractDocumentXml(exportedBuffer);

    expect(documentXml).toContain('<w:del ');
    expect(documentXml).toContain('w:author="Delete Reviewer"');
    expect(documentXml).toContain('<w:delText>B</w:delText>');
  });

  test('keeps legacy output when tracked export is disabled', async () => {
    const originalBuffer = await createEmptyDocx();
    const doc = createDocumentForExport(originalBuffer, 'Plain save', '');

    const exportedBuffer = await repackDocx(doc, {
      trackChanges: {
        enabled: false,
        author: 'Ignored Author',
      },
    });

    const documentXml = await extractDocumentXml(exportedBuffer);

    expect(documentXml).not.toContain('<w:ins ');
    expect(documentXml).not.toContain('<w:del ');
    expect(documentXml).toContain('<w:t>Plain save</w:t>');
  });
});
