/**
 * One-time converter: strips a vendor spreadsheet export (Page/Box/Slot columns,
 * per-game availability checkboxes, the Excel sprite formula, etc.) down to the
 * only 5 fields the pipeline actually reads: dex, name, formName, genderSuffix,
 * keyword. Run once per source sheet whenever the upstream spreadsheet changes —
 * the output is what gets committed and read by generate-living-form-full.js /
 * verify.js. The vendor's own column layout never needs to be tracked in git.
 *
 * This is the only place that needs to know the vendor sheet's column positions;
 * everything downstream is vendor-agnostic.
 *
 * Usage: node normalize-sheet.js <input.csv> <output.csv>
 */
const fs = require('fs');

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += char;
  }
  fields.push(current.trim());
  return fields;
}

function csvField(v) {
  if (v == null) return '';
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node normalize-sheet.js <input.csv> <output.csv>');
  process.exit(1);
}

const lines = fs.readFileSync(inputPath, 'utf-8').split('\n');
const out = ['dex,name,formName,genderSuffix,keyword'];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const fields = parseCsvLine(line);
  const dex = fields[8] || '';
  const name = fields[7] || '';
  const formName = fields[11] || '';
  const genderSuffix = fields[15] || '';
  const keyword = fields[fields.length - 1] || '';
  out.push([dex, name, formName, genderSuffix, keyword].map(csvField).join(','));
}

fs.writeFileSync(outputPath, out.join('\n') + '\n');
console.log(`Wrote ${out.length - 1} rows to ${outputPath}`);
