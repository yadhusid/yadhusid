const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
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
    // Removed WWW to Non-WWW redirect because Render handles domain canonicalization natively.
    // If you ever need manual redirects in the future, implement them here.
    
    // Force HTTPS on Render (optional but recommended)
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    
    next();
});

let otps = {}; // Temp store for password reset OTPs

// ─── MongoDB Connection ──────────────────────────────────────────────────────
let isOfflineMode = false;
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('📦 Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        console.log('⚠️ Network/DNS error detected. Falling back to Local Mock DB for development/sandbox preview.');
        isOfflineMode = true;
        const mock = require('./mock_db.js');
        User = mock.User;
        Category = mock.Category;
        Project = mock.Project;
    });

// ─── Models ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    recoveryEmail: { type: String, default: 'yadhusid@gmail.com' }
});
let User = mongoose.model('User', UserSchema);

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    images: [String],
    order: { type: Number, default: 0 }
});
CategorySchema.virtual('id').get(function(){ return this._id.toHexString(); });
CategorySchema.set('toJSON', { virtuals: true });
let Category = mongoose.model('Category', CategorySchema);

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
BlockSchema.set('toObject', { virtuals: true });

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    coverImage: String,
    coverImageZoom: { type: Number, default: 1 },
    coverImageX: { type: Number, default: 50 },
    coverImageY: { type: Number, default: 50 },
    images: [String], // Media Gallery Bulk Storage
    blocks: [BlockSchema],
    cardBanner: String,
    cardOverlay: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    createdAt: { type: Date, default: Date.now }
});
ProjectSchema.virtual('id').get(function(){ return this._id.toHexString(); });
ProjectSchema.set('toJSON', { virtuals: true });
ProjectSchema.set('toObject', { virtuals: true });
let Project = mongoose.model('Project', ProjectSchema);

// ─── Cloudinary & Multer ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    const isGif = file.mimetype === 'image/gif';
    return {
      folder: 'portfolio_uploads',
      resource_type: isVideo ? 'video' : 'image',
      allowedFormats: isVideo ? ['mp4', 'webm'] : ['jpeg', 'png', 'jpg', 'webp', 'gif'],
      transformation: isGif ? [] : undefined
    };
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Force no-cache on admin pages and API routes so Render CDN/Edge never serves stale files
app.use((req, res, next) => {
    if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'yadhu-portfolio-secret-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for secure cookies behind proxy (Render/PaaS)
    store: process.env.MONGODB_URI ? MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60, // 1 day in seconds
        autoRemove: 'native'
    }) : undefined,
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

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ username: 'yadhusid' });
        const email = user ? user.recoveryEmail : 'yadhusid@gmail.com';
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otps[email] = otp;
        console.log(`\n🔑 [AUTH] RESET OTP for ${email}: ${otp}\n`);
        res.json({ success: true, message: 'OTP sent' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { otp, newPassword } = req.body;
    try {
        const user = await User.findOne({ username: 'yadhusid' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const email = user.recoveryEmail || 'yadhusid@gmail.com';
        if (otps[email] === otp) {
            user.password = await bcrypt.hash(newPassword, 10);
            await user.save();
            delete otps[email];
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid or expired OTP' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
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

// User settings data
app.get('/api/user-settings', requireAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username }).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update recovery email
app.post('/api/update-recovery-email', requireAuth, async (req, res) => {
    const { recoveryEmail } = req.body;
    if (!recoveryEmail) return res.status(400).json({ error: 'Recovery email is required' });
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.recoveryEmail = recoveryEmail;
        await user.save();
        res.json({ success: true, message: 'Recovery email updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Category Routes ──────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1 });
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

app.put('/api/categories/reorder', requireAuth, async (req, res) => {
    try {
        const { categoryIds } = req.body;
        if (!Array.isArray(categoryIds)) return res.status(400).json({ error: 'Invalid categoryIds array' });
        
        const bulkOps = categoryIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { order: index }
            }
        }));
        
        await Category.bulkWrite(bulkOps);
        res.json({ success: true });
    } catch (err) {
        console.error('Category Reorder Error:', err);
        res.status(500).json({ error: 'Could not reorder categories' });
    }
});

// ─── Project Routes ───────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category) query.categoryIds = category;
        const projects = await Project.find(query).sort({ order: 1, createdAt: -1 });
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
        
        const project = await Project.findById(req.params.id).populate('categoryIds');
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const result = project.toJSON();
        result.categoryNames = project.categoryIds ? project.categoryIds.map(c => c.name) : [];
        result.categoryIds = project.categoryIds ? project.categoryIds.map(c => c._id) : [];
        
        res.json(result);
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

const projectFields = upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 20 }
]);

app.post('/api/projects', requireAuth, projectFields, async (req, res) => {
    const { title, description, categoryIds, coverImageZoom, coverImageX, coverImageY, cardOverlay, status } = req.body;
    if (!title || !categoryIds) return res.status(400).json({ error: 'Title and categories required' });
    try {
        const coverFile = req.files && req.files.coverImage ? req.files.coverImage[0].path : null;
        const galleryFiles = req.files && req.files.galleryImages ? req.files.galleryImages.map(f => f.path) : [];

        const project = new Project({
            title,
            description: description || '',
            categoryIds: Array.isArray(categoryIds) ? categoryIds : [categoryIds],
            coverImage: coverFile,
            coverImageZoom: coverImageZoom || 1,
            coverImageX: coverImageX || 50,
            coverImageY: coverImageY || 50,
            images: galleryFiles,
            cardBanner: '',
            cardOverlay: cardOverlay === 'true',
            status: status || 'draft',
            blocks: []
        });
        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Project creation error:', err);
        res.status(500).json({ error: 'Could not save project' });
    }
});

app.patch('/api/projects/:id', requireAuth, projectFields, async (req, res) => {
    try {
        const updates = { ...req.body };
        
        if (updates.categoryIds) {
            updates.categoryIds = Array.isArray(updates.categoryIds) ? updates.categoryIds : [updates.categoryIds];
        }
        
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Not found' });
        
        if (req.files && req.files.coverImage) {
            updates.coverImage = req.files.coverImage[0].path;
        } else if (updates.removeCover === 'true') {
            updates.coverImage = null;
        }
        
        let newGallery = [];
        if (updates.existingGallery) {
            try {
                newGallery = JSON.parse(updates.existingGallery);
            } catch (e) { console.error('existingGallery parse error:', e); }
        } else {
            newGallery = project.images || [];
        }
        
        if (req.files && req.files.galleryImages) {
            const uploadedUrls = req.files.galleryImages.map(f => f.path);
            newGallery = newGallery.concat(uploadedUrls);
        }
        updates.images = newGallery;
        
        // Ensure numeric types for cover positions
        if (updates.coverImageZoom !== undefined) updates.coverImageZoom = parseFloat(updates.coverImageZoom) || 1;
        if (updates.coverImageX !== undefined) updates.coverImageX = parseFloat(updates.coverImageX) || 0;
        if (updates.coverImageY !== undefined) updates.coverImageY = parseFloat(updates.coverImageY) || 0;

        const updatedProject = await Project.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json(updatedProject);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update project' });
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

app.delete('/api/projects/:id/gallery', requireAuth, async (req, res) => {
    try {
        const { imageUrl } = req.query;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        project.images = (project.images || []).filter(img => img !== imageUrl);
        await project.save();
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete gallery image' });
    }
});

app.delete('/api/projects/:projectId/blocks/:blockId', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Not found' });
        project.blocks = project.blocks.filter(b => {
            if (!b._id) return true;
            return b._id.toString() !== req.params.blockId;
        });
        await project.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete block' });
    }
});

// Upload media for CMS visual editing
app.post('/api/upload-media', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path });
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

// ─── CMS Homepage Content Model ───────────────────────────────────────────────
// Increment this version whenever a structural/layout change is made to public/index.html via Git.
// This invalidates old CMS MongoDB caches so they don't overwrite new frontend layouts.
const LAYOUT_VERSION = "2.0";

// Persists homepage HTML to MongoDB instead of filesystem (required for ephemeral disks / Render)
const HomepageSchema = new mongoose.Schema({
    key: { type: String, default: 'index', unique: true },
    html: { type: String, required: true },
    version: { type: String, default: "1.0" },
    updatedAt: { type: Date, default: Date.now }
});
let Homepage;
try { Homepage = mongoose.model('Homepage'); } catch(e) { Homepage = mongoose.model('Homepage', HomepageSchema); }

// Serve homepage: prefer MongoDB CMS cache ONLY if it matches the current LAYOUT_VERSION
app.get(['/', '/index.html'], async (req, res) => {
    try {
        const record = await Homepage.findOne({ key: 'index' });
        // Serve from MongoDB if we have a record and its layout version is up to date
        if (record && record.html && record.version === LAYOUT_VERSION) {
            return res.type('html').send(record.html);
        }
    } catch(e) { /* fall through */ }
    
    // Fallback: serve the deployed file (if MongoDB is empty or version is outdated)
    const filePath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    res.status(404).send('Homepage not found');
});

// ─── Explicit Admin Routes (bypass Edge CDN caching) ────────────────────────
// CDN caches static files from /public — serving admin HTML via Express
// ensures the no-cache headers above are applied and the LATEST code is always served.
app.get('/admin/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});
app.get('/admin/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});
app.get('/admin/editor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'editor.html'));
});

// Temporary route to sync file to DB
app.get('/api/sync-html', async (req, res) => {
    try {
        const fs = require('fs');
        const newHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
        let record = await Homepage.findOne({ key: 'index' });
        if (record) {
            record.html = newHtml;
            await record.save();
        } else {
            await Homepage.create({ key: 'index', html: newHtml });
        }
        res.send('Synced index.html to MongoDB successfully!');
    } catch(e) {
        res.status(500).send(e.toString());
    }
});

// ─── Visual Editor Saving ──────────────────────────────────────────────────
app.post('/admin/save-cms', requireAuth, async (req, res) => {
    const { html } = req.body;
    console.log('[CMS] Save attempt received. HTML Length:', html?.length || 0);
    
    if (!html) return res.status(400).json({ error: 'HTML content required' });

    try {
        // Robust cleaning of CMS-specific artifacts before saving
        const cleanedHtml = html
            .replace(/<div[^>]*class="[^"]*cms-floating-toolbar[^"]*"[\s\S]*?<\/div>/g, '')
            .replace(/<div[^>]*class="[^"]*cms-bottom-toolbar[^"]*"[\s\S]*?<\/div>/g, '')
            .replace(/<div[^>]*class="[^"]*cms-sidebar[^"]*"[\s\S]*?<\/div>/g, '')
            .replace(/\s*cms-(hover|selected|enabled|active-element|active-item)\s*/g, ' ')
            .replace(/style="[^"]*outline:[^"]*"/g, '')
            .replace(/contenteditable="true"/g, '')
            .replace(/spellcheck="false"/g, '');

        // Primary: Save to MongoDB (works on ephemeral PaaS environments like Render)
        await Homepage.findOneAndUpdate(
            { key: 'index' },
            { html: cleanedHtml, version: LAYOUT_VERSION, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        console.log('✅ Homepage HTML saved to MongoDB (Render-compatible)');

        // Secondary: Also try filesystem save for local/traditional deployments
        try {
            const indexPath = path.join(__dirname, 'public', 'index.html');
            fs.writeFileSync(indexPath, cleanedHtml, 'utf8');
            console.log('✅ index.html also updated on filesystem');
        } catch (fsErr) {
            console.log('ℹ️ Filesystem write skipped (read-only environment):', fsErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error saving CMS changes:', err);
        res.status(500).json({ error: 'Save Error: ' + err.message });
    }
});

app.put('/api/projects/reorder', requireAuth, async (req, res) => {
    try {
        const { projectIds } = req.body;
        if (!Array.isArray(projectIds)) return res.status(400).json({ error: 'Invalid projectIds array' });
        
        const bulkOps = projectIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { order: index }
            }
        }));
        
        await Project.bulkWrite(bulkOps);
        res.json({ success: true });
    } catch (err) {
        console.error('Reorder Error:', err);
        res.status(500).json({ error: 'Could not reorder projects' });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    const checkConnection = setInterval(async () => {
        if (mongoose.connection.readyState === 1 || isOfflineMode) {
            clearInterval(checkConnection);
            try {
                await ensureAdmin();
            } catch (err) {
                console.error('Error during ensureAdmin:', err);
            }
        }
    }, 500);
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

module.exports = app;
