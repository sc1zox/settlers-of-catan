const fs = require('fs');
const path = require('path');

const version = require('../package.json').version;
const target = path.join(__dirname, '../apps/catan-client/src/shared/app-version.ts');
const content = `export const APP_VERSION = '${version}';\n`;

const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (existing !== content) {
  fs.writeFileSync(target, content);
}
