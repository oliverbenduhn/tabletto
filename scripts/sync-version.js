#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Lese Version aus root package.json
const rootPackage = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);
const version = rootPackage.version;

console.log(`Synchronisiere Version ${version}...`);

// Update backend/package.json
const backendPath = path.join(__dirname, '../backend/package.json');
const backendPackage = JSON.parse(fs.readFileSync(backendPath, 'utf8'));
backendPackage.version = version;
fs.writeFileSync(backendPath, JSON.stringify(backendPackage, null, 2) + '\n');
console.log(`✓ backend/package.json → ${version}`);

// Update frontend/package.json
const frontendPath = path.join(__dirname, '../frontend/package.json');
const frontendPackage = JSON.parse(fs.readFileSync(frontendPath, 'utf8'));
frontendPackage.version = version;
fs.writeFileSync(frontendPath, JSON.stringify(frontendPackage, null, 2) + '\n');
console.log(`✓ frontend/package.json → ${version}`);

// Update Header.jsx
const headerPath = path.join(__dirname, '../frontend/src/components/Layout/Header.jsx');
let headerContent = fs.readFileSync(headerPath, 'utf8');
headerContent = headerContent.replace(
  /v\d+\.\d+\.\d+/,
  `v${version}`
);
fs.writeFileSync(headerPath, headerContent);
console.log(`✓ Header.jsx → v${version}`);

console.log(`\n✅ Alle Versionen auf ${version} aktualisiert!`);
