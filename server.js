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

// ─── Domain & SSL Middleware ──────────────────────────────────────────────────
app.use((req, res, next) => {
    // Redirect WWW to Non-WWW
    if (req.headers.host && req.headers.host.slice(0, 4) === 'www.') {
        const newHost = req.headers.host.slice(4);
        return res.redirect(301, `${req.protocol}://${newHost}${req.originalUrl}`);
    }
    
    // Force HTTPS on Render (optional but recommended)
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    
    next();
});

let otps = {}; // Temp store for password reset OTPs

// ─── MongoDB Connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('📦 Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── Models ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    recoveryEmail: { type: String, default: 'yadhusid@gmail.com' }
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
    type: { type: String, enum: ['text', 'image', 'video', 'spacing', 'divider'], required: true },
    content: String,
    order: Number,
    radiusTop: { type: Boolean, default: false },
    radiusBottom: { type: Boolean, default: false },
    hasGap: { type: Boolean, default: false }
});
BlockSchema.virtual('id').get(function(){ return this._id.toHexString(); });
BlockSchema.set('toJSON', { virtuals: true });

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    coverImage: String,
    images: [String], // Media Gallery Bulk Storage
    blocks: [BlockSchema],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'yadhu-portfolio-secret-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for secure cookies behind proxy (Render)
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
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

app.post('/api/auth/forgot-password', (req, res) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps['yadhusid@gmail.com'] = otp;
    console.log(`\n🔑 [AUTH] RESET OTP for yadhusid@gmail.com: ${otp}\n`);
    res.json({ success: true, message: 'OTP sent' });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { otp, newPassword } = req.body;
    if (otps['yadhusid@gmail.com'] === otp) {
        try {
            const user = await User.findOne({ username: 'yadhusid' });
            if (!user) return res.status(404).json({ error: 'User not found' });
            
            user.password = await bcrypt.hash(newPassword, 10);
            await user.save();
            delete otps['yadhusid@gmail.com'];
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Database error' });
        }
    } else {
        res.status(400).json({ error: 'Invalid or expired OTP' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
    res.json({ loggedIn: !!req.session.loggedIn, username: req.session.username });
});

// Change Password
app.post('/api/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Incorrect current password' });
        
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Invalid Project ID' });
        }
        
        const project = await Project.findById(req.params.id).populate('categoryId');
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const result = project.toObject();
        result.categoryName = project.categoryId ? project.categoryId.name : '';
        result.categoryId = project.categoryId ? project.categoryId._id : null;
        
        res.json(result);
    } catch (err) {
        console.error('API Error:', err);
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

        const { type, content, radiusTop, radiusBottom, hasGap } = req.body;
        const block = {
            type,
            content: (type === 'image' || type === 'video') ? (req.file ? req.file.path : (content || '')) : (content || ''),
            order: project.blocks.length,
            radiusTop: radiusTop === 'true',
            radiusBottom: radiusBottom === 'true',
            hasGap: hasGap === 'true'
        };
        project.blocks.push(block);
        await project.save();
        res.json(project.blocks[project.blocks.length - 1]);
    } catch (err) {
        res.status(500).json({ error: 'Could not add block' });
    }
});

// Bulk Gallery Upload
app.post('/api/projects/:id/gallery', requireAuth, upload.array('images', 10), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const newImages = req.files.map(file => file.path);
        project.images = [...(project.images || []), ...newImages];
        await project.save();
        
        res.json({ success: true, images: project.images });
    } catch (err) {
        console.error('Bulk Upload Error:', err);
        res.status(500).json({ error: 'Bulk upload failed' });
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

// ─── Visual CMS Save Route ───────────────────────────────────────────────────
app.post('/admin/save-cms', requireAuth, (req, res) => {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: 'Missing HTML content' });

    try {
        const fs = require('fs');
        const path = require('path');
        const indexPath = path.join(__dirname, 'public', 'index.html');
        
        fs.writeFileSync(indexPath, html, 'utf8');
        console.log('✅ CMS Changes Published to index.html');
        res.json({ success: true });
    } catch (err) {
        console.error('CMS Save Error:', err);
        res.status(500).json({ error: 'Failed to save changes' });
    }
});

// Update Project Status
app.patch('/api/projects/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const project = await Project.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: 'Could not update status' });
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

// ─── Visual Editor Saving ──────────────────────────────────────────────────
app.post('/admin/save-cms', requireAuth, (req, res) => {
    const { html } = req.body;
    console.log('[CMS] Save attempt received. HTML Length:', html?.length || 0);
    
    if (!html) return res.status(400).json({ error: 'HTML content required' });

    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        fs.writeFileSync(indexPath, html, 'utf8');
        console.log('✅ index.html updated successfully');
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error saving CMS changes:', err);
        res.status(500).json({ error: 'FileSystem Error: ' + err.message });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    await ensureAdmin();
    console.log(`\n✅ Portfolio CMS running at http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin/login.html`);
});

app.put('/api/projects/:projectId/blocks/reorder', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Not found' });
        const { blockIds } = req.body;
        if (!Array.isArray(blockIds)) return res.status(400).json({ error: 'Invalid blockIds array' });
        
        const blockMap = new Map();
        project.blocks.forEach(b => blockMap.set(b._id.toString(), b));
        
        const reorderedBlocks = [];
        blockIds.forEach((id, idx) => {
            if (blockMap.has(id)) {
                const b = blockMap.get(id);
                b.order = idx;
                reorderedBlocks.push(b);
            }
        });
        
        project.blocks = reorderedBlocks;
        await project.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not reorder blocks' });
    }
});
