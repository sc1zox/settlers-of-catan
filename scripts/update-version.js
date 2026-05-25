const fs = require('fs');
const path = require('path');

const version = process.env.npm_package_version;
if (!version) {
  console.error('npm_package_version env var is not set');
  process.exit(1);
}

const files = [
  'apps/catan-client/src/environments/environment.ts',
  'apps/catan-client/src/environments/environment.prod.ts'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/appVersion: '.*'/, `appVersion: '${version}'`);
    fs.writeFileSync(filePath, content);
    console.log(`Updated version in ${file} to ${version}`);
  } else {
    console.warn(`File not found: ${file}`);
  }
});
