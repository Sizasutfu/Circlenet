const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const zlib = require('zlib');
const dotenv = require('dotenv');
const { google } = require('googleapis');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

let {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = '',
  DATABASE_URL,
  BACKUP_DIR = path.join(__dirname, '..', 'db-backups'),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  GOOGLE_SERVICE_ACCOUNT_KEY_JSON,
  GOOGLE_DRIVE_PARENT_FOLDER_ID,
} = process.env;

// Parse Railway DATABASE_URL if available
if (DATABASE_URL) {
  try {
    const url = new URL(DATABASE_URL);
    DB_HOST = url.hostname;
    DB_PORT = url.port || '3306';
    DB_USER = url.username;
    DB_PASSWORD = url.password;
    DB_NAME = url.pathname.replace('/', '');
    console.log(`✅ Using Railway database: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  } catch (err) {
    console.error('❌ Failed to parse DATABASE_URL:', err.message);
    process.exit(1);
  }
}

if (!DB_NAME) {
  console.error('❌ Missing DB_NAME. Set DATABASE_URL or DB_NAME in circle_backend/.env');
  process.exit(1);
}

if (!GOOGLE_SERVICE_ACCOUNT_KEY_PATH && !GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
  console.error('❌ Missing Google service account credentials. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_KEY_JSON in .env');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `${DB_NAME}-backup-${timestamp}.sql.gz`;
const backupPath = path.resolve(BACKUP_DIR, backupFilename);

async function getDriveClient() {
  let credentials;

  if (GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
    } catch (err) {
      console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY_JSON:', err.message);
      process.exit(1);
    }
  } else {
    const keyFilePath = path.resolve(GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
    if (!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found at ${keyFilePath}`);
      process.exit(1);
    }
    credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function dumpDatabase() {
  return new Promise((resolve, reject) => {
    ensureBackupDir();

    const dumpArgs = [
      '--host', DB_HOST,
      '--port', DB_PORT,
      '--user', DB_USER,
      '--databases', DB_NAME,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--set-gtid-purged=OFF',
    ];

    const env = { ...process.env, MYSQL_PWD: DB_PASSWORD };
    const dumpProcess = spawn('mysqldump', dumpArgs, { env });
    const gzip = zlib.createGzip();
    const outStream = fs.createWriteStream(backupPath);

    dumpProcess.stdout.pipe(gzip).pipe(outStream);

    let stderr = '';
    dumpProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    dumpProcess.on('error', (err) => {
      reject(new Error(`Failed to run mysqldump: ${err.message}`));
    });

    outStream.on('finish', () => {
      if (stderr) {
        console.warn('mysqldump warnings:', stderr.trim());
      }
      resolve(backupPath);
    });

    dumpProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mysqldump exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

async function uploadToDrive(filePath) {
  const drive = await getDriveClient();
  const fileName = path.basename(filePath);

  const metadata = {
    name: fileName,
  };

  if (GOOGLE_DRIVE_PARENT_FOLDER_ID) {
    metadata.parents = [GOOGLE_DRIVE_PARENT_FOLDER_ID];
  }

  const media = {
    mimeType: 'application/gzip',
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: metadata,
    media,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}

async function run() {
  try {
    console.log('🔄 Starting database backup...');
    const dumpPath = await dumpDatabase();
    console.log(`✅ Dump saved locally to ${dumpPath}`);

    console.log('📤 Uploading backup to Google Drive...');
    const uploaded = await uploadToDrive(dumpPath);
    console.log('✅ Upload complete');
    console.log('Drive file ID:', uploaded.id);
    if (uploaded.webViewLink) {
      console.log('Drive view link:', uploaded.webViewLink);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  }
}

run();
