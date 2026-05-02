const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// ─── Database (JSON file-based) ───────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultAdmin = bcrypt.hashSync('admin123', 10);
        const initial = {
            users: [{ id: '1', username: 'admin', password: defaultAdmin }],
            categories: [
                { id: uuidv4(), name: 'Campaign Design', slug: 'campaign-design' },
                { id: uuidv4(), name: 'UI/UX Interface', slug: 'uiux-interface' },
                { id: uuidv4(), name: 'Creative Direction', slug: 'creative-direction' }
            ],
            projects: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── Multer (Image Uploads) ───────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'yadhu-portfolio-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.loggedIn = true;
    req.session.username = username;
    res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
    res.json({ loggedIn: !!req.session.loggedIn });
});

// ─── Category Routes ──────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
    res.json(readDB().categories);
});

app.post('/api/categories', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const db = readDB();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const category = { id: uuidv4(), name, slug };
    db.categories.push(category);
    writeDB(db);
    res.json(category);
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
    const db = readDB();
    db.categories = db.categories.filter(c => c.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ─── Project Routes ───────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
    const db = readDB();
    const { category } = req.query;
    let projects = db.projects;
    if (category) projects = projects.filter(p => p.categoryId === category);
    res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
    const db = readDB();
    const project = db.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    // Attach category name
    const cat = db.categories.find(c => c.id === project.categoryId);
    project.categoryName = cat ? cat.name : '';
    res.json(project);
});

app.post('/api/projects', requireAuth, upload.single('coverImage'), (req, res) => {
    const { title, description, categoryId } = req.body;
    if (!title || !categoryId) return res.status(400).json({ error: 'Title and category required' });
    const db = readDB();
    const project = {
        id: uuidv4(),
        title,
        description: description || '',
        categoryId,
        coverImage: req.file ? `/uploads/${req.file.filename}` : null,
        blocks: [],
        createdAt: new Date().toISOString()
    };
    db.projects.push(project);
    writeDB(db);
    res.json(project);
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
    const db = readDB();
    db.projects = db.projects.filter(p => p.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ─── Content Block Routes ─────────────────────────────────────────────────────
// blocks: [ { type: 'text'|'image', content: '...', order: N } ]
app.post('/api/projects/:id/blocks', requireAuth, upload.single('image'), (req, res) => {
    const db = readDB();
    const project = db.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });

    const { type, content } = req.body;
    const block = {
        id: uuidv4(),
        type,
        content: type === 'image' ? (req.file ? `/uploads/${req.file.filename}` : '') : (content || ''),
        order: project.blocks.length
    };
    project.blocks.push(block);
    writeDB(db);
    res.json(block);
});

app.delete('/api/projects/:projectId/blocks/:blockId', requireAuth, (req, res) => {
    const db = readDB();
    const project = db.projects.find(p => p.id === req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Not found' });
    project.blocks = project.blocks.filter(b => b.id !== req.params.blockId);
    writeDB(db);
    res.json({ success: true });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
readDB(); // initialize DB on startup
app.listen(PORT, () => {
    console.log(`\n✅ Portfolio CMS running at http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin/login.html`);
    console.log(`   Default login → username: admin | password: admin123\n`);
});
