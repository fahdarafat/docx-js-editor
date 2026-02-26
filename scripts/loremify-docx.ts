/**
 * DOCX Loremifier
 *
 * Replaces human-readable run text in DOCX XML parts with lorem-ipsum-like
 * text while preserving document structure and per-word lengths.
 *
 * Usage:
 *   bun run docx:loremify -- input.docx
 *   bun run docx:loremify -- input.docx --out-dir sanitized
 *   bun run docx:loremify -- input1.docx input2.docx --suffix .anon
 *   bun run docx:loremify -- input.docx --in-place
 */

import JSZip from 'jszip';
import { promises as fs } from 'fs';
import path from 'path';

type CliOptions = {
  help: boolean;
  inPlace: boolean;
  allXml: boolean;
  outDir?: string;
  suffix: string;
  inputs: string[];
};

type FileStats = {
  xmlFilesUpdated: number;
  wordsReplaced: number;
};

const HELP_TEXT = `docx loremifier

USAGE:
  bun run docx:loremify -- <input1.docx> [input2.docx ...] [options]

OPTIONS:
  --out-dir <dir>   Output directory for generated files
  --suffix <text>   Output filename suffix (default: .lorem)
  --in-place        Overwrite original file(s)
  --all-xml         Replace text in every XML part (advanced)
  -h, --help        Show this help text

EXAMPLES:
  bun run docx:loremify -- sample.docx
  bun run docx:loremify -- sample.docx --out-dir sanitized
  bun run docx:loremify -- a.docx b.docx --suffix .anonymized
  bun run docx:loremify -- sample.docx --in-place
`;

const LOREM_WORDS = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'do',
  'eiusmod',
  'tempor',
  'incididunt',
  'ut',
  'labore',
  'et',
  'dolore',
  'magna',
  'aliqua',
];

const TEXT_TAG_PATTERNS = [
  /<((?:[\w.-]+:)?t)(\s[^>]*)?>([\s\S]*?)<\/\1>/g,
  /<((?:[\w.-]+:)?delText)(\s[^>]*)?>([\s\S]*?)<\/\1>/g,
];

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

class LoremWordGenerator {
  private index = 0;

  next(wordLength: number): string {
    if (wordLength <= 0) return '';

    const base = LOREM_WORDS[this.index % LOREM_WORDS.length];
    this.index += 1;
    return fitWordToLength(base, wordLength);
  }
}

function fitWordToLength(base: string, targetLength: number): string {
  if (targetLength <= base.length) {
    return base.slice(0, targetLength);
  }

  let value = '';
  while (value.length < targetLength) {
    value += base;
  }
  return value.slice(0, targetLength);
}

function applyCasing(source: string, replacement: string): string {
  if (source.toUpperCase() === source) {
    return replacement.toUpperCase();
  }

  if (
    source.length > 0 &&
    source[0] === source[0].toUpperCase() &&
    source.slice(1) === source.slice(1).toLowerCase()
  ) {
    return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
  }

  if (source.toLowerCase() === source) {
    return replacement.toLowerCase();
  }

  return replacement;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (full, entity) => {
    if (entity in XML_ENTITIES) {
      return XML_ENTITIES[entity];
    }

    if (entity.startsWith('#x')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      if (!Number.isNaN(codePoint) && codePoint >= 0) {
        return String.fromCodePoint(codePoint);
      }
      return full;
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      if (!Number.isNaN(codePoint) && codePoint >= 0) {
        return String.fromCodePoint(codePoint);
      }
      return full;
    }

    return full;
  });
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function replaceWordsKeepingLengths(
  value: string,
  generator: LoremWordGenerator
): { text: string; replacedWords: number } {
  let replacedWords = 0;
  const text = value.replace(/[\p{L}\p{N}]+/gu, (word) => {
    replacedWords += 1;
    const replacement = generator.next(word.length);
    return applyCasing(word, replacement);
  });

  return { text, replacedWords };
}

function loremifyXml(xml: string, generator: LoremWordGenerator): { xml: string; replacedWords: number } {
  let updatedXml = xml;
  let replacedWords = 0;

  for (const pattern of TEXT_TAG_PATTERNS) {
    updatedXml = updatedXml.replace(pattern, (full, tagName: string, attrs: string, text: string) => {
      const decoded = decodeXmlEntities(text);
      const result = replaceWordsKeepingLengths(decoded, generator);
      replacedWords += result.replacedWords;

      if (result.replacedWords === 0) {
        return full;
      }

      const safeText = escapeXmlText(result.text);
      return `<${tagName}${attrs ?? ''}>${safeText}</${tagName}>`;
    });
  }

  return { xml: updatedXml, replacedWords };
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    inPlace: false,
    allXml: false,
    suffix: '.lorem',
    inputs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--in-place') {
      options.inPlace = true;
      continue;
    }

    if (arg === '--all-xml') {
      options.allXml = true;
      continue;
    }

    if (arg === '--out-dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--out-dir requires a directory path');
      }
      options.outDir = path.resolve(value);
      i += 1;
      continue;
    }

    if (arg === '--suffix') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--suffix requires a value');
      }
      options.suffix = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    options.inputs.push(path.resolve(arg));
  }

  return options;
}

function getOutputPath(inputPath: string, options: CliOptions): string {
  if (options.inPlace) {
    return inputPath;
  }

  const ext = path.extname(inputPath) || '.docx';
  const stem = path.basename(inputPath, ext);
  const outputDir = options.outDir ?? path.dirname(inputPath);
  return path.join(outputDir, `${stem}${options.suffix}${ext}`);
}

async function loremifyDocxBuffer(
  buffer: Buffer,
  options: Pick<CliOptions, 'allXml'>
): Promise<{ output: Buffer; stats: FileStats }> {
  const zip = await JSZip.loadAsync(buffer);
  const generator = new LoremWordGenerator();

  let xmlFilesUpdated = 0;
  let wordsReplaced = 0;

  for (const [zipPath, zipFile] of Object.entries(zip.files)) {
    if (zipFile.dir || !zipPath.toLowerCase().endsWith('.xml')) {
      continue;
    }

    if (!shouldProcessXmlPart(zipPath, options.allXml)) {
      continue;
    }

    const xml = await zipFile.async('text');
    const result = loremifyXml(xml, generator);
    wordsReplaced += result.replacedWords;

    if (result.xml !== xml) {
      xmlFilesUpdated += 1;
      zip.file(zipPath, result.xml, {
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
    }
  }

  const output = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    output,
    stats: { xmlFilesUpdated, wordsReplaced },
  };
}

function shouldProcessXmlPart(zipPath: string, allXml: boolean): boolean {
  if (allXml) {
    return true;
  }

  const lower = zipPath.toLowerCase();
  if (lower === 'word/document.xml') return true;
  if (lower === 'word/footnotes.xml') return true;
  if (lower === 'word/endnotes.xml') return true;
  if (lower === 'word/comments.xml') return true;
  if (lower === 'word/commentsextensible.xml') return true;
  if (lower === 'word/commentsextended.xml') return true;

  if (/^word\/header\d+\.xml$/.test(lower)) return true;
  if (/^word\/footer\d+\.xml$/.test(lower)) return true;

  return false;
}

async function processFile(inputPath: string, options: CliOptions): Promise<void> {
  if (!inputPath.toLowerCase().endsWith('.docx')) {
    throw new Error(`Expected a .docx file: ${inputPath}`);
  }

  const outputPath = getOutputPath(inputPath, options);
  const source = await fs.readFile(inputPath);
  const result = await loremifyDocxBuffer(source, options);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, result.output);

  console.log(
    [
      `Input: ${inputPath}`,
      `Output: ${outputPath}`,
      `Updated XML files: ${result.stats.xmlFilesUpdated}`,
      `Words replaced: ${result.stats.wordsReplaced}`,
      '',
    ].join('\n')
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (options.inputs.length === 0) {
    throw new Error('At least one input .docx file is required. Use --help for usage.');
  }

  if (options.inPlace && options.outDir) {
    throw new Error('--in-place and --out-dir cannot be used together');
  }

  for (const inputPath of options.inputs) {
    await processFile(inputPath, options);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
