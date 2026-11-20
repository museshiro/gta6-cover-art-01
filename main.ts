// Vice Cover Studio — entrypoint (Node 22, standard library only).
// Copies the static app and the screenshots into the output directory,
// then writes the dossier that buildDossier derives from them. The
// scorer rebuilds the same dossier from the same files, so the two
// must match byte for byte. Nothing here fetches anything: the app is
// fully static and every asset it needs already lives under app/.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = resolve(process.env.MAKEFUN_BOT_DIR ?? '.');
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? 'out');

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote dossier.json (${dossier.length} bytes) into ${outDir}`);
