const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const port = 5002; // Backend on 5002

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend dist if it exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// DB Setup
const db = new Database('revision.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    size INTEGER,
    status TEXT,
    content TEXT,
    filename TEXT,
    topic TEXT,
    module TEXT,
    uploadDate INTEGER,
    revisedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    fileId TEXT,
    content TEXT,
    topic TEXT,
    module TEXT,
    updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS windows (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    isOpen INTEGER,
    x TEXT,
    y TEXT,
    width TEXT,
    height TEXT,
    zIndex INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT,
    questions TEXT,
    createdAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS quiz_sessions (
    quizId TEXT PRIMARY KEY,
    currentQuestionIdx INTEGER,
    answers TEXT,
    isReviewing INTEGER,
    scores TEXT,
    updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS quiz_results (
    id TEXT PRIMARY KEY,
    quizId TEXT,
    quizTitle TEXT,
    answers TEXT,
    scores TEXT,
    totalQuestions INTEGER,
    totalMarks INTEGER,
    earnedMarks INTEGER,
    completedAt INTEGER
  );
`);

// Migration for revisedAt column if missing
try {
  db.prepare('ALTER TABLE files ADD COLUMN revisedAt INTEGER').run();
} catch (e) {
  // Column already exists
}
try {
  db.prepare('ALTER TABLE windows ADD COLUMN height TEXT').run();
} catch (e) {
  // Column already exists
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const { PDFParse } = require('pdf-parse');

async function extractText(filePath, mimeType) {
  if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const data = await parser.getText();
      return data.text || '';
    } catch (err) {
      console.error(`Failed to parse PDF ${filePath}:`, err);
      return `Failed to parse PDF: ${err.message}`;
    }
  }
  return `Extracted content mock for ${path.basename(filePath)}.`;
}

// Routes
app.post('/api/upload', upload.array('files'), async (req, res) => {
  const files = req.files;
  const paths = req.body.paths || [];
  const results = [];

  const insert = db.prepare('INSERT INTO files (id, name, type, size, status, content, filename, topic, module, uploadDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const id = Math.random().toString(36).substr(2, 9);
    const name = file.originalname;
    const type = file.mimetype;
    const size = file.size;
    const status = 'unread';
    const filePath = path.join(uploadsDir, file.filename);
    const content = await extractText(filePath, type);
    const filename = file.filename;
    
    // Parse module and topic from path if available
    let module = '';
    let topic = '';
    const relPath = paths[index];
    
    if (relPath) {
      const parts = relPath.split('/');
      if (parts.length > 1) {
        module = parts[0]; // Top level folder
        // Try to clean module name (e.g. "111 - Software Development" -> "Software Development")
        const moduleMatch = module.match(/\d+\s*-\s*(.*)/);
        if (moduleMatch) module = moduleMatch[1].trim();
      }
    }

    // Parse topic from filename (same logic as before)
    const topicMatch = name.match(/ - (.*)\.(pdf|pptx)$/i);
    if (topicMatch) {
      topic = topicMatch[1].trim();
    } else if (module) {
      topic = module;
    }

    const uploadDate = Date.now();
    insert.run(id, name, type, size, status, content, filename, topic, module, uploadDate);
    results.push({ id, name, type, size, status, content, url: `http://192.168.0.41:5002/uploads/${filename}`, topic, module, uploadDate });
  }

  res.json(results);
});

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  const url = `http://192.168.0.41:5002/uploads/${req.file.filename}`;
  res.json({ url });
});

app.get('/api/files', (req, res) => {
  const files = db.prepare('SELECT * FROM files').all();
  const results = files.map(f => ({
    ...f,
    revisedAt: f.revisedAt ? Number(f.revisedAt) : null,
    uploadDate: f.uploadDate ? Number(f.uploadDate) : null,
    url: `http://192.168.0.41:5002/uploads/${f.filename}`
  }));
  res.json(results);
});

app.patch('/api/files/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const file = db.prepare('SELECT status FROM files WHERE id = ?').get(id);
  if (file && file.status === 'unread' && status !== 'unread') {
    db.prepare('UPDATE files SET status = ?, revisedAt = ? WHERE id = ?').run(status, Date.now(), id);
  } else {
    db.prepare('UPDATE files SET status = ? WHERE id = ?').run(status, id);
  }
  res.sendStatus(200);
});

app.patch('/api/files/:id/metadata', (req, res) => {
  const { id } = req.params;
  const { topic, module } = req.body;
  db.prepare('UPDATE files SET topic = ?, module = ? WHERE id = ?').run(topic, module, id);
  res.sendStatus(200);
});

app.delete('/api/files', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }

  const deleteFile = db.prepare('DELETE FROM files WHERE id = ?');
  const getFile = db.prepare('SELECT filename FROM files WHERE id = ?');
  const deleteNotes = db.prepare('DELETE FROM notes WHERE fileId = ?');

  const transaction = db.transaction((fileIds) => {
    for (const id of fileIds) {
      const file = getFile.get(id);
      if (file) {
        const filePath = path.join(__dirname, 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      deleteFile.run(id);
      deleteNotes.run(id);
    }
  });

  try {
    transaction(ids);
    res.sendStatus(200);
  } catch (e) {
    console.error('Delete failed:', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.post('/api/import-folder', async (req, res) => {
  const { folderPath } = req.body;
  
  if (!fs.existsSync(folderPath)) {
    return res.status(400).json({ error: 'Path does not exist' });
  }

  const results = [];
  const insert = db.prepare('INSERT INTO files (id, name, type, size, status, content, filename, topic, module, uploadDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  async function processDir(dir) {
    const items = fs.readdirSync(dir);
    const folderName = path.basename(dir);
    // Try to get module name from folder (e.g. "111 - Software Development" -> "Software Development")
    const moduleMatch = folderName.match(/\d+\s*-\s*(.*)/);
    const moduleName = moduleMatch ? moduleMatch[1].trim() : folderName;

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        await processDir(fullPath);
      } else if (item.endsWith('.pdf') || item.endsWith('.pptx')) {
        const id = Math.random().toString(36).substr(2, 9);
        const name = item;
        const type = item.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        const size = stats.size;
        const status = 'unread';
        
        // Copy file to uploads
        const filename = Date.now() + '-' + item;
        const destPath = path.join(__dirname, 'uploads', filename);
        fs.copyFileSync(fullPath, destPath);

        const content = await extractText(destPath, type);

        // Parse filename for topic (e.g. "1. Course intro - Software Development.pdf")
        let topic = '';
        const topicMatch = item.match(/ - (.*)\.(pdf|pptx)$/i);
        if (topicMatch) {
          topic = topicMatch[1].trim();
        } else {
          topic = moduleName; // Default topic to module name
        }

        const uploadDate = Date.now();
        insert.run(id, name, type, size, status, content, filename, topic, moduleName, uploadDate);
        results.push({ id, name, type, size, status, content, url: `http://192.168.0.41:5002/uploads/${filename}`, topic, module: moduleName, uploadDate });
      }
    }
  }

  try {
    await processDir(folderPath);
    res.json(results);
  } catch (err) {
    console.error('Import failed:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

app.get('/api/notes', (req, res) => {
  const notes = db.prepare('SELECT * FROM notes').all();
  const results = notes.map(n => ({
    ...n,
    updatedAt: n.updatedAt ? Number(n.updatedAt) : null
  }));
  res.json(results);
});

app.post('/api/notes', (req, res) => {
  const { fileId, content } = req.body;
  const existing = db.prepare('SELECT id FROM notes WHERE fileId = ?').get(fileId);
  
  if (existing) {
    db.prepare('UPDATE notes SET content = ?, updatedAt = ? WHERE fileId = ?').run(content, Date.now(), fileId);
    res.json({ id: existing.id });
  } else {
    const id = Math.random().toString(36).substr(2, 9);
    db.prepare('INSERT INTO notes (id, fileId, content, updatedAt) VALUES (?, ?, ?, ?)').run(id, fileId, content, Date.now());
    res.json({ id });
  }
});

app.get('/api/windows', (req, res) => {
  const windows = db.prepare('SELECT * FROM windows').all();
  const results = windows.map(w => ({
    id: w.id,
    type: w.type,
    title: w.title,
    isOpen: !!w.isOpen,
    bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
    zIndex: w.zIndex,
    updatedAt: w.updatedAt ? Number(w.updatedAt) : null
  }));
  res.json(results);
});

app.post('/api/windows', (req, res) => {
  const windows = req.body; // Array of windows
  const upsert = db.prepare(`
    INSERT INTO windows (id, type, title, isOpen, x, y, width, height, zIndex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      isOpen = excluded.isOpen,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      zIndex = excluded.zIndex
  `);
  
  const transaction = db.transaction((wins) => {
    for (const w of wins) {
      upsert.run(w.id, w.type, w.title, w.isOpen ? 1 : 0, w.bounds.x, w.bounds.y, w.bounds.width, w.bounds.height, w.zIndex);
    }
  });
  
  transaction(windows);
  res.sendStatus(200);
});

app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const result = {};
  settings.forEach(s => {
    result[s.key] = s.value;
  });
  res.json(result);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  res.sendStatus(200);
});

app.get('/api/quizzes', (req, res) => {
  const quizzes = db.prepare('SELECT * FROM quizzes').all();
  const results = quizzes.map(q => ({
    ...q,
    questions: JSON.parse(q.questions || '[]')
  }));
  res.json(results);
});

app.post('/api/quizzes', (req, res) => {
  const { id, title, questions } = req.body;
  db.prepare('INSERT INTO quizzes (id, title, questions, createdAt) VALUES (?, ?, ?, ?)').run(id, title, JSON.stringify(questions), Date.now());
  res.sendStatus(200);
});

app.get('/api/quiz-sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM quiz_sessions').all();
  const results = sessions.map(s => ({
    quizId: s.quizId,
    currentQuestionIdx: s.currentQuestionIdx,
    answers: JSON.parse(s.answers || '{}'),
    isReviewing: !!s.isReviewing,
    scores: JSON.parse(s.scores || '{}'),
    updatedAt: Number(s.updatedAt)
  }));
  res.json(results);
});

app.post('/api/quiz-sessions', (req, res) => {
  const { quizId, currentQuestionIdx, answers, isReviewing, scores } = req.body;
  db.prepare(`
    INSERT INTO quiz_sessions (quizId, currentQuestionIdx, answers, isReviewing, scores, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(quizId) DO UPDATE SET
      currentQuestionIdx = excluded.currentQuestionIdx,
      answers = excluded.answers,
      isReviewing = excluded.isReviewing,
      scores = excluded.scores,
      updatedAt = excluded.updatedAt
  `).run(
    quizId,
    currentQuestionIdx,
    JSON.stringify(answers || {}),
    isReviewing ? 1 : 0,
    JSON.stringify(scores || {}),
    Date.now()
  );
  res.sendStatus(200);
});

app.delete('/api/quiz-sessions/:quizId', (req, res) => {
  const { quizId } = req.params;
  db.prepare('DELETE FROM quiz_sessions WHERE quizId = ?').run(quizId);
  res.sendStatus(200);
});

app.get('/api/quiz-results', (req, res) => {
  const results = db.prepare('SELECT * FROM quiz_results ORDER BY completedAt DESC').all();
  const parsed = results.map(r => ({
    id: r.id,
    quizId: r.quizId,
    quizTitle: r.quizTitle,
    answers: JSON.parse(r.answers || '{}'),
    scores: JSON.parse(r.scores || '{}'),
    totalQuestions: r.totalQuestions,
    totalMarks: r.totalMarks,
    earnedMarks: r.earnedMarks,
    completedAt: Number(r.completedAt)
  }));
  res.json(parsed);
});

app.post('/api/quiz-results', (req, res) => {
  const { id, quizId, quizTitle, answers, scores, totalQuestions, totalMarks, earnedMarks } = req.body;
  db.prepare(`
    INSERT INTO quiz_results (id, quizId, quizTitle, answers, scores, totalQuestions, totalMarks, earnedMarks, completedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    quizId,
    quizTitle,
    JSON.stringify(answers || {}),
    JSON.stringify(scores || {}),
    totalQuestions,
    totalMarks,
    earnedMarks,
    Date.now()
  );
  res.sendStatus(200);
});

// Update Tracker & Auto-Update
const REPO = 'EmptyRaider101/TapTapRevise';

app.get('/api/check-updates', async (req, res) => {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'TapTapRevise-App' }
    });
    if (!response.ok) {
      if (response.status === 404) {
        // No releases found yet for this repo
        return res.json({
          version: 'v0.0.1',
          url: `https://github.com/${REPO}/releases`,
          assets: []
        });
      }
      throw new Error(`GitHub API failed with status ${response.status}`);
    }
    const data = await response.json();
    res.json({
      version: data.tag_name,
      url: data.html_url,
      assets: data.assets ? data.assets.map(a => ({ name: a.name, url: a.browser_download_url })) : []
    });
  } catch (e) {
    console.error('Update check failed:', e.message || e);
    res.json({
      version: 'v0.0.1',
      url: `https://github.com/${REPO}/releases`,
      assets: []
    });
  }
});

app.post('/api/update', async (req, res) => {
  // This is a placeholder for auto-update logic.
  // In a real standalone app, this would download the new binary and trigger a restart script.
  // For now, we'll just return the info.
  res.json({ message: 'Auto-update triggered. Please check the releases page to download the latest version.' });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const openBrowser = async (url) => {
  try {
    const openPkg = await import('open');
    const openFn = openPkg.default || openPkg;
    await openFn(url);
  } catch (err) {
    console.error('Failed to open browser:', err);
  }
};

app.listen(port, '0.0.0.0', async () => {
  console.log(`Server running at http://localhost:${port}`);

  // Migration of existing mock PDFs
  try {
    const mockPdfs = db.prepare("SELECT * FROM files WHERE name LIKE '%.pdf' AND content LIKE 'Extracted content mock%'").all();
    if (mockPdfs.length > 0) {
      console.log(`Found ${mockPdfs.length} PDF files with mock content. Extracting actual text...`);
      const updateContent = db.prepare('UPDATE files SET content = ? WHERE id = ?');
      for (const f of mockPdfs) {
        const filePath = path.join(uploadsDir, f.filename);
        if (fs.existsSync(filePath)) {
          try {
            const dataBuffer = fs.readFileSync(filePath);
            const parser = new PDFParse({ data: dataBuffer });
            const data = await parser.getText();
            updateContent.run(data.text || '', f.id);
            console.log(`Successfully extracted text for ${f.name}`);
          } catch (e) {
            console.error(`Failed to extract text for ${f.name}:`, e.message);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to migrate existing mock PDFs:", e);
  }

  const targetUrl = fs.existsSync(distPath) ? `http://localhost:${port}` : `http://localhost:5174`;
  await openBrowser(targetUrl);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});
