import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Собирает оба расширения в dist/chrome и dist/firefox.
 *
 * core импортируется адаптерами напрямую из исходников (в нём нет
 * обращений к chrome или browser), поэтому бандлить нужно только
 * на выходе — никакой отдельной сборки самого core не требуется.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');

rmSync(OUT, { recursive: true, force: true });

async function buildTarget(name, { background, backgroundFormat, manifest }) {
  const outDir = join(OUT, name);
  mkdirSync(outDir, { recursive: true });

  const common = { bundle: true, platform: 'browser', target: 'es2022', logLevel: 'info' };

  await esbuild.build({
    ...common,
    entryPoints: [join(ROOT, 'packages', background)],
    outfile: join(outDir, 'background.js'),
    format: backgroundFormat,
  });

  await esbuild.build({
    ...common,
    entryPoints: [join(ROOT, 'packages/ui/popup.ts')],
    outfile: join(outDir, 'popup.js'),
    format: 'esm',
  });

  await esbuild.build({
    ...common,
    entryPoints: [join(ROOT, 'packages/ui/options.ts')],
    outfile: join(outDir, 'options.js'),
    format: 'esm',
  });

  cpSync(join(ROOT, 'packages', manifest), join(outDir, 'manifest.json'));
  for (const file of ['popup.html', 'popup.css', 'options.html']) {
    cpSync(join(ROOT, 'packages/ui', file), join(outDir, file));
  }
  const optionsCss = join(ROOT, 'packages/ui/options.css');
  if (existsSync(optionsCss)) cpSync(optionsCss, join(outDir, 'options.css'));

  mkdirSync(join(outDir, 'icon'), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    cpSync(join(ROOT, 'icon', `icon-${size}.png`), join(outDir, 'icon', `icon-${size}.png`));
  }

  console.log(`собрано: dist/${name}`);
}

await buildTarget('chrome', {
  background: 'ext-chrome/src/background.ts',
  backgroundFormat: 'esm', // MV3 service worker с "type": "module"
  manifest: 'ext-chrome/manifest.json',
});

await buildTarget('firefox', {
  background: 'ext-firefox/src/background.ts',
  backgroundFormat: 'iife', // manifest v2 background.scripts — обычный скрипт
  manifest: 'ext-firefox/manifest.json',
});