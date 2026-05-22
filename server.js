const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

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
    order: { type: Number, default: 0 },
    projectOrder: [String]
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
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    order: { type: Number, default: 0 },
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

const multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Dedupe & Upload Logic ──────────────────────────────────────────────────
const MediaSchema = new mongoose.Schema({
    hash: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    size: Number,
    format: String,
    createdAt: { type: Date, default: Date.now }
});
let Media = mongoose.model('Media', MediaSchema);

async function uploadBufferToCloudinary(buffer, mimetype) {
    return new Promise((resolve, reject) => {
        const isVideo = mimetype.startsWith('video/');
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: isVideo ? 'video' : 'auto', folder: 'portfolio_uploads' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
}

async function processFile(file) {
    if (!file) return;
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    let media = await Media.findOne({ hash });
    
    if (media) {
        file.path = media.url;
        file.filename = media.public_id;
    } else {
        const result = await uploadBufferToCloudinary(file.buffer, file.mimetype);
        media = new Media({
            hash,
            url: result.secure_url,
            public_id: result.public_id,
            size: file.size,
            format: result.format
        });
        await media.save();
        file.path = media.url;
        file.filename = media.public_id;
    }
}

const dedupeAndUpload = async (req, res, next) => {
    try {
        const tasks = [];
        if (req.file) {
            tasks.push(processFile(req.file));
        } else if (req.files) {
            if (Array.isArray(req.files)) {
                req.files.forEach(f => tasks.push(processFile(f)));
            } else {
                for (const key in req.files) {
                    req.files[key].forEach(f => tasks.push(processFile(f)));
                }
            }
        }
        await Promise.all(tasks);
        next();
    } catch (err) {
        console.error('Upload Dedupe Error:', err);
        return res.status(500).json({ error: 'Media upload failed' });
    }
};

const upload = {
    single: (name) => [multerUpload.single(name), dedupeAndUpload],
    array: (name, max) => [multerUpload.array(name, max), dedupeAndUpload],
    fields: (fields) => [multerUpload.fields(fields), dedupeAndUpload]
};

// ─── Safe Delete Logic ────────────────────────────────────────────────────────
function extractPublicId(url) {
    if (!url) return null;
    const parts = url.split('/');
    const file = parts.pop();
    const folder = parts.pop();
    if (folder !== 'portfolio_uploads') return null;
    return folder + '/' + file.split('.')[0];
}

async function isMediaInUse(urlOrId) {
    if (!urlOrId) return false;
    // Basic substring check
    const hp = await Homepage.findOne({ key: 'index' });
    if (hp && hp.data) {
        if (hp.data.hero && hp.data.hero.mediaUrl && hp.data.hero.mediaUrl.includes(urlOrId)) return true;
        if (hp.data.contact && hp.data.contact.bannerUrl && hp.data.contact.bannerUrl.includes(urlOrId)) return true;
    }
    const pInUse = await Project.findOne({
        $or: [
            { coverImage: { $regex: urlOrId, $options: 'i' } },
            { images: { $regex: urlOrId, $options: 'i' } },
            { cardBanner: { $regex: urlOrId, $options: 'i' } },
            { "blocks.content": { $regex: urlOrId, $options: 'i' } }
        ]
    });
    if (pInUse) return true;
    return false;
}

async function safeDeleteMedia(url) {
    if (!url) return;
    try {
        const public_id = extractPublicId(url);
        if (!public_id) return;
        
        // Wait briefly to allow DB transactions to finish committing the removal
        await new Promise(r => setTimeout(r, 100)); 
        
        const inUse = await isMediaInUse(public_id);
        if (!inUse) {
            await cloudinary.uploader.destroy(public_id);
            await Media.deleteOne({ public_id });
            console.log('Orphaned media safely deleted:', public_id);
        } else {
            console.log('Media still in use, skipped deletion:', public_id);
        }
    } catch(err) {
        console.error('Safe delete error:', err);
    }
}

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

app.put('/api/categories/:id', requireAuth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const category = await Category.findByIdAndUpdate(req.params.id, { name, slug }, { new: true });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: 'Could not update category' });
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

app.put('/api/categories/:id/project-order', requireAuth, async (req, res) => {
    try {
        const { projectIds } = req.body;
        if (!Array.isArray(projectIds)) return res.status(400).json({ error: 'Invalid projectIds array' });
        await Category.findByIdAndUpdate(req.params.id, { projectOrder: projectIds });
        res.json({ success: true });
    } catch (err) {
        console.error('Category Project Order Error:', err);
        res.status(500).json({ error: 'Could not update category project order' });
    }
});

// ─── Project Routes ───────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        const { category, all } = req.query;
        let query = {};
        if (!all) query.status = 'published';
        if (category) query.categoryIds = category;

        let projects = await Project.find(query).sort({ order: 1 });
        
        if (category) {
            const cat = await Category.findById(category);
            if (cat && cat.projectOrder && cat.projectOrder.length > 0) {
                projects.sort((a, b) => {
                    let idxA = cat.projectOrder.indexOf(a._id.toString());
                    let idxB = cat.projectOrder.indexOf(b._id.toString());
                    if (idxA === -1) idxA = 9999;
                    if (idxB === -1) idxB = 9999;
                    if (idxA !== idxB) return idxA - idxB;
                    return a.order - b.order;
                });
            }
        }

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
    const { title, description, coverImageZoom, coverImageX, coverImageY, cardOverlay, status } = req.body;
    let { categoryIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    
    try {
        if (!categoryIds || (Array.isArray(categoryIds) && categoryIds.length === 0)) {
            let allWorks = await Category.findOne({ name: 'All Works' });
            if (!allWorks) {
                allWorks = new Category({ name: 'All Works', order: 0 });
                await allWorks.save();
            }
            categoryIds = [allWorks._id.toString()];
        }
        
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
        const { title, description, coverImageZoom, coverImageX, coverImageY, cardOverlay, status, categoryIds } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const updates = { title, description, cardOverlay, status };
        if (categoryIds) {
            updates.categoryIds = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
        }

        let oldCoverImage = null;
        if (req.files && req.files.coverImage) {
            oldCoverImage = project.coverImage;
            updates.coverImage = req.files.coverImage[0].path;
        } else if (req.body.removeCover === 'true') {
            oldCoverImage = project.coverImage;
            updates.coverImage = null;
        }

        let newGallery = [];
        if (req.body.existingGallery) {
            try {
                newGallery = JSON.parse(req.body.existingGallery);
            } catch (e) { console.error('existingGallery parse error:', e); }
        } else {
            newGallery = project.images || [];
        }

        if (req.files && req.files.galleryImages) {
            const newGalleryFiles = req.files.galleryImages.map(f => f.path);
            newGallery = newGallery.concat(newGalleryFiles);
        }
        updates.images = newGallery;
        
        if (coverImageZoom !== undefined) updates.coverImageZoom = parseFloat(coverImageZoom) || 1;
        if (coverImageX !== undefined) updates.coverImageX = parseFloat(coverImageX) || 0;
        if (coverImageY !== undefined) updates.coverImageY = parseFloat(coverImageY) || 0;

        const updatedProject = await Project.findByIdAndUpdate(req.params.id, updates, { new: true });
        
        // Cleanup old cover if replaced
        if (oldCoverImage) {
            safeDeleteMedia(oldCoverImage);
        }
        
        res.json(updatedProject);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update project' });
    }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Not found' });
        
        await Project.findByIdAndDelete(req.params.id);
        
        // Clean up associated media
        if (project.coverImage) safeDeleteMedia(project.coverImage);
        if (project.cardBanner) safeDeleteMedia(project.cardBanner);
        if (project.images) project.images.forEach(img => safeDeleteMedia(img));
        if (project.blocks) {
            project.blocks.forEach(b => {
                if ((b.type === 'image' || b.type === 'video') && b.content) {
                    safeDeleteMedia(b.content);
                }
            });
        }
        
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
        const { url } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        project.images = project.images.filter(img => img !== url);
        await project.save();
        
        safeDeleteMedia(url);
        
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: 'Could not delete image' });
    }
});

app.delete('/api/projects/:projectId/blocks/:blockId', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const block = project.blocks.id(req.params.blockId);
        let blockContent = null;
        if (block && (block.type === 'image' || block.type === 'video')) {
            blockContent = block.content;
        }

        project.blocks.pull(req.params.blockId);
        await project.save();
        
        if (blockContent) safeDeleteMedia(blockContent);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete block' });
    }
});

// Upload media for CMS visual editing
app.post('/api/upload-media', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path, public_id: req.file.filename });
});

// Admin Media Cleanup Script
app.post('/api/admin/media-cleanup', requireAuth, async (req, res) => {
    try {
        const { action } = req.body;
        
        let resources = [];
        let next_cursor = null;
        do {
            const result = await cloudinary.search
                .expression('folder:portfolio_uploads')
                .max_results(500)
                .next_cursor(next_cursor)
                .execute();
            resources = resources.concat(result.resources);
            next_cursor = result.next_cursor;
        } while (next_cursor);
        
        const referencedPublicIds = new Set();
        
        const hp = await Homepage.findOne({ key: 'index' });
        if (hp && hp.data) {
            if (hp.data.hero && hp.data.hero.mediaUrl) {
                const pid = extractPublicId(hp.data.hero.mediaUrl);
                if (pid) referencedPublicIds.add(pid);
            }
            if (hp.data.contact && hp.data.contact.bannerUrl) {
                const pid = extractPublicId(hp.data.contact.bannerUrl);
                if (pid) referencedPublicIds.add(pid);
            }
        }
        
        const projects = await Project.find({});
        projects.forEach(p => {
            if (p.coverImage) {
                const pid = extractPublicId(p.coverImage);
                if (pid) referencedPublicIds.add(pid);
            }
            if (p.cardBanner) {
                const pid = extractPublicId(p.cardBanner);
                if (pid) referencedPublicIds.add(pid);
            }
            if (p.images) {
                p.images.forEach(img => {
                    const pid = extractPublicId(img);
                    if (pid) referencedPublicIds.add(pid);
                });
            }
            if (p.blocks) {
                p.blocks.forEach(b => {
                    if ((b.type === 'image' || b.type === 'video') && b.content) {
                        const pid = extractPublicId(b.content);
                        if (pid) referencedPublicIds.add(pid);
                    }
                });
            }
        });
        
        const orphaned = [];
        const inUse = [];
        
        resources.forEach(res => {
            if (referencedPublicIds.has(res.public_id)) {
                inUse.push(res.public_id);
            } else {
                orphaned.push(res.public_id);
            }
        });
        
        if (action === 'cleanup') {
            const deleted = [];
            for (const pid of orphaned) {
                try {
                    await cloudinary.uploader.destroy(pid);
                    await Media.deleteOne({ public_id: pid });
                    deleted.push(pid);
                } catch(e) { console.error('Cloudinary destroy failed:', e); }
            }
            return res.json({ success: true, deletedCount: deleted.length, deleted });
        }
        
        res.json({
            success: true,
            totalCloudinaryAssets: resources.length,
            inUseCount: inUse.length,
            orphanedCount: orphaned.length,
            inUse,
            orphaned
        });
        
    } catch (err) {
        console.error('Media cleanup error:', err);
        res.status(500).json({ error: 'Failed to run cleanup' });
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

// ─── CMS Homepage Content Model ───────────────────────────────────────────────
// Increment this version whenever a structural/layout change is made to public/index.html via Git.
// This invalidates old CMS MongoDB caches so they don't overwrite new frontend layouts.
const LAYOUT_VERSION = "2.3";

// Persists homepage HTML to MongoDB instead of filesystem (required for ephemeral disks / Render)
const HomepageSchema = new mongoose.Schema({
    key: { type: String, default: 'index', unique: true },
    html: { type: String, required: false },
    data: { type: Object, default: {} },
    version: { type: String, default: "1.0" },
    updatedAt: { type: Date, default: Date.now },
    coreSkills: { type: [String], default: ["UI/UX", "PRINT", "CREATIVE DIRECTION"] }
});
let Homepage;
try { Homepage = mongoose.model('Homepage'); } catch(e) { Homepage = mongoose.model('Homepage', HomepageSchema); }

// Serve homepage: inject MongoDB CMS data into static index.html
app.get(['/', '/index.html'], async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'index.html');
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Homepage not found');
        }
        
        let htmlContent = fs.readFileSync(filePath, 'utf8');
        const record = await Homepage.findOne({ key: 'index' });
        
        // Build injection payload
        let cmsData = {};
        if (record) {
            cmsData = record.data || {};
            if (!cmsData.coreSkills && record.coreSkills) cmsData.coreSkills = record.coreSkills;
            // Migration fallback: if data is empty but html exists, we can't easily parse it on server, 
            // but the new system relies on structured data.
        }
        
        const scriptInjection = `<script>window.CMS_DATA = ${JSON.stringify(cmsData)};</script>`;
        htmlContent = htmlContent.replace('</head>', `${scriptInjection}\n</head>`);
        
        return res.type('html').send(htmlContent);
    } catch(e) { 
        console.error("Error serving homepage:", e);
        const filePath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
        return res.status(500).send('Internal Error');
    }
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

// ─── Homepage CMS Data Saving ──────────────────────────────────────────────────
app.post('/api/homepage/data', requireAuth, async (req, res) => {
    const { data } = req.body;
    console.log('[CMS] Saving structured homepage data');
    
    if (!data) return res.status(400).json({ error: 'Data required' });

    try {
        await Homepage.findOneAndUpdate(
            { key: 'index' },
            { $set: { data: data, updatedAt: new Date() } },
            { upsert: true, new: true }
        );
        console.log('✅ Homepage structured data saved to MongoDB');

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error saving CMS data:', err);
        res.status(500).json({ error: 'Failed to save changes' });
    }
});

// ─── Core Skills API ──────────────────────────────────────────────────────────
app.get('/api/homepage/skills', async (req, res) => {
    try {
        let record = await Homepage.findOne({ key: 'index' });
        if (!record) {
            record = await Homepage.create({ key: 'index', html: '<!-- Default -->' });
        }
        res.json(record.coreSkills || ["UI/UX", "PRINT", "CREATIVE DIRECTION"]);
    } catch(err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/homepage/skills', requireAuth, async (req, res) => {
    const { skills } = req.body;
    try {
        let record = await Homepage.findOne({ key: 'index' });
        if (!record) {
            record = await Homepage.create({ key: 'index', html: '<!-- Default -->', coreSkills: skills });
        } else {
            record.coreSkills = skills;
            await record.save();
        }
        res.json({ success: true, skills: record.coreSkills });
    } catch(err) {
        res.status(500).json({ error: 'Server error' });
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

// Bulk Insert Blocks (for auto-convert)
app.post('/api/projects/:id/blocks-bulk', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const { blocks } = req.body;
        if (Array.isArray(blocks)) {
            blocks.forEach(b => {
                project.blocks.push({
                    type: b.type,
                    content: b.content,
                    order: b.order || project.blocks.length
                });
            });
            await project.save();
        }
        res.json(project.blocks);
    } catch(err) {
        res.status(500).json({ error: 'Could not bulk create blocks' });
    }
});

module.exports = app;
