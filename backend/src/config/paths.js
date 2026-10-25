const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/tabletto.db'),
  uploadRoot: process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads')
};
