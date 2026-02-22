import { describe, expect, test } from 'bun:test';
import type { Document, Paragraph, Run } from '../../types/document';
import { parseParagraph } from '../paragraphParser';
import { serializeParagraph } from '../serializer/paragraphSerializer';
import { parseXmlDocument, type XmlElement } from '../xmlParser';
import { fromProseDoc } from '../../prosemirror/conversion/fromProseDoc';
import { toProseDoc } from '../../prosemirror/conversion/toProseDoc';

function textRun(text: string): Run {
  return {
    type: 'run',
    content: [{ type: 'text', text }],
  };
}

describe('move serialization and parsing', () => {
  test('serializeParagraph emits moveFrom/moveTo wrappers with moveFrom delText payload', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      content: [
        {
          type: 'moveFrom',
          info: { id: 7, author: 'Reviewer' },
          content: [textRun('Old text')],
        },
        {
          type: 'moveTo',
          info: { id: 7, author: 'Reviewer' },
          content: [textRun('New text')],
        },
      ],
    };

    const xml = serializeParagraph(paragraph);

    expect(xml).toContain('<w:moveFrom w:id="7" w:author="Reviewer">');
    expect(xml).toContain('<w:moveTo w:id="7" w:author="Reviewer">');
    expect(xml).toContain('<w:delText>Old text</w:delText>');
    expect(xml).toContain('<w:t>New text</w:t>');
  });

  test('parseParagraph reads moveFrom/moveTo wrappers back into paragraph content', () => {
    const paragraphXml = `
      <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:moveFrom w:id="9" w:author="Reviewer A">
          <w:r><w:delText>Moved away</w:delText></w:r>
        </w:moveFrom>
        <w:moveTo w:id="9" w:author="Reviewer A">
          <w:r><w:t>Moved here</w:t></w:r>
        </w:moveTo>
      </w:p>
    `;
    const root = parseXmlDocument(paragraphXml) as XmlElement | null;
    expect(root).not.toBeNull();
    if (!root) return;

    const paragraph = parseParagraph(root, null, null, null, null, null);

    expect(paragraph.content[0].type).toBe('moveFrom');
    expect(paragraph.content[1].type).toBe('moveTo');

    const moveFrom = paragraph.content[0];
    const moveTo = paragraph.content[1];
    if (moveFrom.type !== 'moveFrom' || moveTo.type !== 'moveTo') return;

    expect(moveFrom.info.id).toBe(9);
    expect(moveTo.info.id).toBe(9);
    expect(moveFrom.content[0].type).toBe('run');
    expect(moveTo.content[0].type).toBe('run');
    if (moveFrom.content[0].type !== 'run' || moveTo.content[0].type !== 'run') return;

    expect(moveFrom.content[0].content[0].type).toBe('text');
    expect(moveTo.content[0].content[0].type).toBe('text');
    if (moveFrom.content[0].content[0].type !== 'text') return;
    if (moveTo.content[0].content[0].type !== 'text') return;
    expect(moveFrom.content[0].content[0].text).toBe('Moved away');
    expect(moveTo.content[0].content[0].text).toBe('Moved here');
  });

  test('ProseMirror conversion preserves move wrappers when paired revision ids are present', () => {
    const document: Document = {
      package: {
        document: {
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'moveFrom',
                  info: { id: 15, author: 'Reviewer B' },
                  content: [textRun('Source')],
                },
                {
                  type: 'moveTo',
                  info: { id: 15, author: 'Reviewer B' },
                  content: [textRun('Destination')],
                },
              ],
            },
          ],
        },
      },
    };

    const pmDoc = toProseDoc(document);
    const roundTripped = fromProseDoc(pmDoc, document);
    const paragraph = roundTripped.package.document.content[0];
    expect(paragraph.type).toBe('paragraph');
    if (paragraph.type !== 'paragraph') return;

    const hasMoveFrom = paragraph.content.some((item) => item.type === 'moveFrom');
    const hasMoveTo = paragraph.content.some((item) => item.type === 'moveTo');
    expect(hasMoveFrom).toBe(true);
    expect(hasMoveTo).toBe(true);
  });
});
