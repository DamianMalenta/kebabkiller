// Smoke harness (Faza B+C e2e): seeduje minimalny renderowalny projekt + 1 scene.
// NIE produkcyjne — placeholdery do walidacji lancucha composite -> payload -> WEBM na GPU.
// Uruchom: node --experimental-sqlite scripts/seed-smoke.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { initDatabase } from '../src/db/init.js';
import { createProject } from '../src/db/models.js';
import { updateDirectorProject, linkEpisodeToProject } from '../src/db/directorDeskModels.js';
import {
  createAsset,
  addAssetImage,
  createEpisodePlan,
  upsertPlanScene,
  validateEpisodePlan,
  acceptEpisodePlan,
} from '../src/db/episodeModels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.resolve(ROOT, process.env.DATABASE_PATH || './data/studio.db');
const UPLOADS_DIR = path.resolve(ROOT, process.env.UPLOADS_DIR || './uploads');

async function writePlaceholderImages() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // Postac: PNG z alfa (przezroczyste tlo) — prosta sylwetka.
  const charSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="900">
    <g fill="#1b1b22">
      <circle cx="250" cy="150" r="95"/>
      <rect x="150" y="250" width="200" height="380" rx="60"/>
      <rect x="120" y="280" width="70" height="300" rx="35"/>
      <rect x="310" y="280" width="70" height="300" rx="35"/>
      <rect x="175" y="600" width="65" height="280" rx="30"/>
      <rect x="260" y="600" width="65" height="280" rx="30"/>
    </g>
    <circle cx="218" cy="140" r="14" fill="#e8e8ef"/>
    <circle cx="282" cy="140" r="14" fill="#e8e8ef"/>
  </svg>`;
  await sharp(Buffer.from(charSvg)).png().toFile(path.join(UPLOADS_DIR, 'smoke_char.png'));

  // Tlo: JPG — nocna ulica/neon (gradient + ksztalty).
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0b1026"/>
        <stop offset="100%" stop-color="#2a1240"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#sky)"/>
    <rect y="520" width="1280" height="200" fill="#14141c"/>
    <rect x="120" y="180" width="240" height="340" fill="#1d2340"/>
    <rect x="900" y="140" width="260" height="380" fill="#221a3a"/>
    <rect x="430" y="300" width="120" height="40" fill="#ff2d7e"/>
    <rect x="980" y="220" width="140" height="36" fill="#23e0ff"/>
    <rect x="180" y="240" width="90" height="30" fill="#ffd23f"/>
  </svg>`;
  await sharp(Buffer.from(bgSvg)).jpeg({ quality: 90 }).toFile(path.join(UPLOADS_DIR, 'smoke_loc.jpg'));

  console.log(`[seed] obrazy: ${path.join(UPLOADS_DIR, 'smoke_char.png')} + smoke_loc.jpg`);
}

function run() {
  initDatabase(DB_PATH);

  const stamp = Date.now();
  const project = createProject({ name: `Smoke Test ${stamp}`, description: 'Harness e2e Faza B+C' });
  updateDirectorProject(project.id, {
    canon: { style_tags: ['neon noir', 'cinematic', 'rainy night'], default_i2v_profile: 'I2V_PRODUCTION' },
    generatorTags: [],
  });

  const charAsset = createAsset({ type: 'character', name: `Kebab Killer ${stamp}`, descriptionPl: 'Bohater (placeholder)' });
  const locAsset = createAsset({ type: 'location', name: `Pizzeria Noca ${stamp}`, descriptionPl: 'Lokacja (placeholder)' });

  addAssetImage(charAsset.id, { path: '/uploads/smoke_char.png', label: 'reference', isPrimary: true });
  addAssetImage(locAsset.id, { path: '/uploads/smoke_loc.jpg', label: 'reference', isPrimary: true });

  const plan = createEpisodePlan({
    code: `SMOKE_${stamp}`,
    title: 'Smoke E2E',
    logline: 'Bohater idzie nocna ulica w deszczu, neony migaja.',
    targetDurationSec: 6,
  });
  linkEpisodeToProject(plan.id, project.id);

  upsertPlanScene(plan.id, {
    sortOrder: 0,
    descriptionPl: 'Bohater stoi na mokrej, neonowej ulicy noca; lekki ruch kamery, zywe tlo.',
    durationSec: 4,
    assetId: charAsset.id,
    locationAssetId: locAsset.id,
  });

  const validation = validateEpisodePlan(plan.id);
  console.log('[seed] walidacja:', JSON.stringify(validation));
  if (!validation.ok) {
    throw new Error('Walidacja planu nieudana: ' + validation.errors.join(' '));
  }

  acceptEpisodePlan(plan.id);

  console.log('[seed] GOTOWE');
  console.log('PROJECT_ID=' + project.id);
  console.log('PLAN_ID=' + plan.id);
  console.log('CHAR_REF=' + charAsset.ref_id + ' LOC_REF=' + locAsset.ref_id);
}

await writePlaceholderImages();
run();
