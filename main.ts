// gta6-cover-art-01 entry program (Node 22, standard library only).
//
// The app is plain static files in app/ beside this file: a browser opens
// app/index.html offline and it works with no network. This program hands
// the entry in by copying app/ and screenshots/ into the grader's output
// directory and writing the dossier the judge reads, using the kit's own
// buildDossier library (vendor/makefun-app.ts, unchanged).
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the gate's own limits, so a dossier built here
// can never be one the scorer would refuse for size: at most 4 screenshots
// of 256 KiB each, at most 993 files and 48 MiB under app/, and no app
// path over 1000 bytes. The dossier text itself is capped at 160 KiB.
// buildDossier reads the output directory we just filled, so the order
// above matters: copy first, then build the dossier from the copy.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
