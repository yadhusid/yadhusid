const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MongoDB Connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('📦 Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── Models ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true }
});
CategorySchema.virtual('id').get(function(){ return this._id.toHexString(); });
CategorySchema.set('toJSON', { virtuals: true });
const Category = mongoose.model('Category', CategorySchema);

const BlockSchema = new mongoose.Schema({
    type: { type: String, enum: ['text', 'image'], required: true },
    content: String,
    order: Number
});
BlockSchema.virtual('id').get(function(){ return this._id.toHexString(); });
BlockSchema.set('toJSON', { virtuals: true });

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    coverImage: String,
    blocks: [BlockSchema],
    createdAt: { type: Date, default: Date.now }
});
ProjectSchema.virtual('id').get(function(){ return this._id.toHexString(); });
ProjectSchema.set('toJSON', { virtuals: true });
const Project = mongoose.model('Project', ProjectSchema);

// ─── Cloudinary & Multer ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'portfolio_uploads',
    allowedFormats: ['jpeg', 'png', 'jpg', 'webp', 'gif']
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
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        secure: false // Set to true if using HTTPS but Render handles proxying
    }
}));

function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    
    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.log(`Login failed: User ${username} not found`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Login failed: Password mismatch for ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        req.session.loggedIn = true;
        req.session.username = username;
        res.json({ success: true });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
    res.json({ loggedIn: !!req.session.loggedIn });
});

// ─── Category Routes ──────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/categories', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    try {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const category = new Category({ name, slug });
        await category.save();
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: 'Could not save category' });
    }
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete category' });
    }
});

// ─── Project Routes ───────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category) query.categoryId = category;
        const projects = await Project.find(query).sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id).populate('categoryId');
        if (!project) return res.status(404).json({ error: 'Not found' });
        
        const result = project.toObject();
        result.categoryName = project.categoryId ? project.categoryId.name : '';
        result.categoryId = project.categoryId ? project.categoryId._id : null;
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/projects', requireAuth, upload.single('coverImage'), async (req, res) => {
    const { title, description, categoryId } = req.body;
    if (!title || !categoryId) return res.status(400).json({ error: 'Title and category required' });
    try {
        const project = new Project({
            title,
            description: description || '',
            categoryId,
            coverImage: req.file ? req.file.path : null,
            blocks: []
        });
        await project.save();
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: 'Could not save project' });
    }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete project' });
    }
});

// ─── Content Block Routes ─────────────────────────────────────────────────────
app.post('/api/projects/:id/blocks', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Not found' });

        const { type, content } = req.body;
        const block = {
            type,
            content: type === 'image' ? (req.file ? req.file.path : '') : (content || ''),
            order: project.blocks.length
        };
        project.blocks.push(block);
        await project.save();
        res.json(project.blocks[project.blocks.length - 1]);
    } catch (err) {
        res.status(500).json({ error: 'Could not add block' });
    }
});

app.delete('/api/projects/:projectId/blocks/:blockId', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Not found' });
        project.blocks = project.blocks.filter(b => b._id.toString() !== req.params.blockId);
        await project.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete block' });
    }
});

// ─── Initial Admin Setup ──────────────────────────────────────────────────────
async function ensureAdmin() {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const hashedPassword = bcrypt.hashSync('#Portfolio9020', 10);
            const admin = new User({ username: 'yadhusid', password: hashedPassword });
            await admin.save();
            console.log('👤 Default admin created (yadhusid / #Portfolio9020)');
            
            // Backup admin
            const backupPass = bcrypt.hashSync('yadhu123', 10);
            const backupAdmin = new User({ username: 'yadhu', password: backupPass });
            await backupAdmin.save();
        }
    } catch (err) {
        console.error('Error creating default admin:', err);
    }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    await ensureAdmin();
    console.log(`\n✅ Portfolio CMS running at http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin/login.html`);
});
