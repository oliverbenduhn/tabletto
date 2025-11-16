const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/medikamente.db');
const backupsDir = path.join(path.dirname(dbPath), 'backups');

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
}

if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupsDir, `backup-${timestamp}.db`);

fs.copyFileSync(dbPath, dest);
console.log('Backup created at', dest);