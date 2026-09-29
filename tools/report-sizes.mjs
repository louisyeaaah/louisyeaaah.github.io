#!/usr/bin/env node
/**
 * Measure the real cost of every animation library in the production bundle.
 *
 * Reads the emitted chunk files from `dist/`, attributes each one to the
 * library it came from (via the chunk alias configured in vite.config.js),
 * and rewrites `src/lib/bundle-sizes.json` with raw / gzip / brotli sizes.
 * The authored metadata in that file (role, verdict, reasoning) is preserved.
 *
 * Usage:
 *   npm run build && npm run size      # measure a fresh build
 *   node tools/report-sizes.mjs        # re-measure the existing dist/
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const META = join(ROOT, 'src', 'lib', 'bundle-sizes.json');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/**
 * `vendor-gsap-BJZ90ViQ.js` -> `vendor-gsap`.
 * Matching on the known aliases by prefix is deterministic; a regex on the hash
 * is not, because the hash charset overlaps with the `-` separators.
 */
function aliasFor(file, knownAliases) {
  const hit = knownAliases.find((alias) => file.startsWith(`${alias}-`));
  if (hit) return hit;
  return file.replace(/-[A-Za-z0-9_-]{6,}\.(js|css)$/, '').replace(/\.(js|css)$/, '');
}

async function measure(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    }).length,
  };
}

async function collectChunks(knownAliases) {
  const assetsDir = join(DIST, 'assets');
  let files;
  try {
    files = await readdir(assetsDir);
  } catch {
    console.error(`✗ No build found at ${assetsDir}\n  Run \`npm run build\` first.`);
    process.exit(1);
  }

  const chunks = [];
  for (const file of files) {
    if (!file.endsWith('.js') && !file.endsWith('.css')) continue;
    const buffer = await readFile(join(assetsDir, file));
    chunks.push({ file, alias: aliasFor(file, knownAliases), ...(await measure(buffer)) });
  }
  return chunks;
}

/**
 * What the browser actually downloads to render a page: its own HTML, the
 * stylesheet(s) it links, and every script it references or modulepreloads.
 * This is the number that matters — the sum of all chunks is not, because the
 * heavy media libraries are lazily imported.
 */
async function criticalPath(pageHtml, chunks) {
  const html = await readFile(join(DIST, pageHtml), 'utf8');
  const referenced = new Set();

  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    referenced.add(match[1].split('/').pop());
  }

  const files = chunks.filter((chunk) => referenced.has(chunk.file));
  const htmlBytes = await measure(Buffer.from(html));
  return {
    chunks: files,
    html: htmlBytes,
    total: {
      raw: htmlBytes.raw + files.reduce((a, c) => a + c.raw, 0),
      gzip: htmlBytes.gzip + files.reduce((a, c) => a + c.gzip, 0),
      brotli: htmlBytes.brotli + files.reduce((a, c) => a + c.brotli, 0),
    },
  };
}

async function main() {
  const metadata = JSON.parse(await readFile(META, 'utf8'));
  const knownAliases = metadata.libraries.map((library) => library.chunk);
  const chunks = await collectChunks(knownAliases);

  console.log('\n  Production bundle — per chunk\n  ' + '─'.repeat(66));
  console.log(`  ${'chunk'.padEnd(28)}${'raw'.padStart(11)}${'gzip'.padStart(11)}${'brotli'.padStart(11)}`);
  console.log('  ' + '─'.repeat(66));

  let totalRaw = 0;
  let totalGzip = 0;
  let totalBrotli = 0;

  for (const chunk of [...chunks].sort((a, b) => b.raw - a.raw)) {
    totalRaw += chunk.raw;
    totalGzip += chunk.gzip;
    totalBrotli += chunk.brotli;
    console.log(
      `  ${chunk.alias.padEnd(28)}${kb(chunk.raw).padStart(11)}${kb(chunk.gzip).padStart(11)}${kb(chunk.brotli).padStart(11)}`,
    );
  }
  console.log('  ' + '─'.repeat(66));
  console.log(
    `  ${'TOTAL'.padEnd(28)}${kb(totalRaw).padStart(11)}${kb(totalGzip).padStart(11)}${kb(totalBrotli).padStart(11)}\n`,
  );

  // Attribute each library to its chunk.
  let missing = 0;
  for (const library of metadata.libraries) {
    const match = chunks.find((chunk) => chunk.alias === library.chunk);
    if (!match) {
      console.warn(`  ⚠ no chunk named "${library.chunk}" for ${library.name} — sizes left null`);
      library.raw = null;
      library.gzip = null;
      library.brotli = null;
      missing += 1;
      continue;
    }
    library.raw = match.raw;
    library.gzip = match.gzip;
    library.brotli = match.brotli;
  }

  metadata.generatedAt = new Date().toISOString().slice(0, 10);
  metadata.totals = {
    allChunksRaw: totalRaw,
    allChunksGzip: totalGzip,
    allChunksBrotli: totalBrotli,
  };

  // Critical path = what a first visit to each page actually downloads.
  try {
    const mainPage = await criticalPath('index.html', chunks);
    const labPage = await criticalPath('lab.html', chunks);
    metadata.criticalPath = {
      index: {
        gzip: mainPage.total.gzip,
        brotli: mainPage.total.brotli,
        raw: mainPage.total.raw,
        files: mainPage.chunks.map((c) => c.alias),
      },
      lab: {
        gzip: labPage.total.gzip,
        brotli: labPage.total.brotli,
        raw: labPage.total.raw,
        files: labPage.chunks.map((c) => c.alias),
      },
    };

    console.log('  Critical path — first visit, everything actually requested\n  ' + '─'.repeat(66));
    for (const [page, data] of Object.entries(metadata.criticalPath)) {
      console.log(`  ${page.padEnd(8)} raw ${kb(data.raw).padStart(9)}   gzip ${kb(data.gzip).padStart(9)}   brotli ${kb(data.brotli).padStart(9)}`);
      console.log(`           ${data.files.join(', ')}`);
    }
    console.log('  ' + '─'.repeat(66) + '\n');
  } catch (error) {
    console.warn(`  ⚠ critical-path analysis skipped: ${error.message}`);
  }

  await writeFile(META, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log('  Library cost (gzip, sorted)\n  ' + '─'.repeat(66));
  for (const library of [...metadata.libraries].sort((a, b) => (b.gzip || 0) - (a.gzip || 0))) {
    const size = library.gzip === null ? '   n/a' : kb(library.gzip).padStart(8);
    console.log(`  ${size}  ${library.name.padEnd(30)} ${library.verdict}`);
  }
  console.log('  ' + '─'.repeat(66));
  console.log(`  wrote ${META.replace(ROOT + '/', '')}`);
  if (missing) console.log(`  ${missing} library chunk(s) not found — did the build exclude them?`);
  console.log('');
}

await main();
