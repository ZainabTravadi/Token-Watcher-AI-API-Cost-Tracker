const fs = require('fs');
const path = require('path');

const typesDir = path.resolve(__dirname, '..', 'dist', 'types');

if (!fs.existsSync(typesDir)) {
  console.error('types directory not found:', typesDir);
  process.exit(0);
}

const files = fs.readdirSync(typesDir).filter((f) => f.endsWith('.d.ts'));

for (const file of files) {
  const p = path.join(typesDir, file);
  let text = fs.readFileSync(p, 'utf8');

  // Fix the common missing-extension import of "./types" -> "./types.js"
  const before = 'from "./types"';
  const beforeSingle = "from './types'";
  if (text.includes(before) || text.includes(beforeSingle)) {
    text = text.replace(/from \"\.\/types\"/g, 'from "./types.js"');
    text = text.replace(/from '\.\/types'/g, "from './types.js'");
    fs.writeFileSync(p, text, 'utf8');
    console.log('patched', p);
  }
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir)) {
    const full = path.join(dir, ent);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (ent.endsWith('.d.ts')) {
      let text = fs.readFileSync(full, 'utf8');
      let changed = false;
      if (text.includes('from "./types"') || text.includes("from './types'")) {
        text = text.replace(/from \"\.\/types\"/g, 'from "./types.js"');
        text = text.replace(/from '\.\/types'/g, "from './types.js'");
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(full, text, 'utf8');
        console.log('patched', full);
      }
    }
  }
}

walk(typesDir);

process.exit(0);
