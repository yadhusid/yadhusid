const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BEHANCE_DIR = 'C:\\Users\\Yadhu\\Desktop\\BEHANCE';
const BACKUP_FILE = path.join(__dirname, `project_backup_${Date.now()}.json`);

const ProjectSchema = new mongoose.Schema({
    title: String,
    description: String,
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    coverImage: String,
    coverImageZoom: { type: Number, default: 1 },
    coverImageX: { type: Number, default: 50 },
    coverImageY: { type: Number, default: 50 },
    images: [String],
    cardBanner: String,
    cardOverlay: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    order: { type: Number, default: 0 },
    blocks: []
});
const Project = mongoose.model('Project', ProjectSchema);

const CategorySchema = new mongoose.Schema({
    name: String,
    order: Number,
    projectOrder: [String]
});
const Category = mongoose.model('Category', CategorySchema);

const MediaSchema = new mongoose.Schema({
    hash: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    size: Number,
    format: String,
    createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model('Media', MediaSchema);

async function uploadFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    let media = await Media.findOne({ hash });
    
    if (media) return { url: media.url, public_id: media.public_id };
    
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'portfolio_uploads', resource_type: 'auto' },
            async (error, result) => {
                if (error) return reject(error);
                media = new Media({
                    hash,
                    url: result.secure_url,
                    public_id: result.public_id,
                    size: buffer.length,
                    format: result.format
                });
                await media.save();
                resolve({ url: result.secure_url, public_id: result.public_id });
            }
        );
        stream.end(buffer);
    });
}

function extractPublicId(url) {
    if (!url) return null;
    const parts = url.split('/');
    const file = parts.pop();
    const folder = parts.pop();
    if (folder !== 'portfolio_uploads') return null;
    return folder + '/' + file.split('.')[0];
}

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const isDryRun = !process.argv.includes('--execute');
    
    // BACKUP
    console.log('Backing up current projects...');
    const existingProjects = await Project.find({});
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(existingProjects, null, 2));
    console.log(`Backed up ${existingProjects.length} projects to ${BACKUP_FILE}`);
    
    // Parse Folders
    const categories = fs.readdirSync(BEHANCE_DIR).filter(f => fs.statSync(path.join(BEHANCE_DIR, f)).isDirectory());
    
    let totalProjectsToCreate = 0;
    let totalImagesToUpload = 0;
    
    const plan = [];
    
    for (const catName of categories) {
        const catPath = path.join(BEHANCE_DIR, catName);
        const projects = fs.readdirSync(catPath).filter(f => fs.statSync(path.join(catPath, f)).isDirectory());
        
        const catPlan = { name: catName, projects: [] };
        
        for (const projName of projects) {
            const projPath = path.join(catPath, projName);
            const files = fs.readdirSync(projPath).filter(f => /\.(jpg|jpeg|png|webp|avif|mp4|webm)$/i.test(f)).sort();
            
            let coverFile = null;
            const galleryFiles = [];
            
            for (const f of files) {
                if (f.startsWith('00')) coverFile = path.join(projPath, f);
                else galleryFiles.push(path.join(projPath, f));
            }
            
            if (!coverFile && files.length > 0) {
                coverFile = path.join(projPath, files[0]);
                galleryFiles.splice(0, 1);
            }
            
            catPlan.projects.push({ name: projName, coverFile, galleryFiles });
            totalProjectsToCreate++;
            if (coverFile) totalImagesToUpload++;
            totalImagesToUpload += galleryFiles.length;
        }
        plan.push(catPlan);
    }
    
    if (isDryRun) {
        console.log('\n--- DRY RUN PLAN ---');
        plan.forEach(c => {
            console.log(`Category: ${c.name}`);
            c.projects.forEach(p => {
                console.log(`  Project: ${p.name}`);
                console.log(`    Cover: ${p.coverFile ? path.basename(p.coverFile) : 'None'}`);
                console.log(`    Gallery: ${p.galleryFiles.length} images`);
            });
        });
        console.log(`\nTotal New Projects: ${totalProjectsToCreate}`);
        console.log(`Total Images to Upload: ${totalImagesToUpload}`);
        console.log('\nRun with --execute to perform the import and replace old projects.');
        process.exit(0);
    }
    
    // EXECUTE
    console.log('\n--- EXECUTING IMPORT ---');
    
    // Process Categories & Projects
    let projectOrder = 0;
    const newProjectIds = [];
    
    for (const cat of plan) {
        let category = await Category.findOne({ name: cat.name });
        if (!category) {
            category = new Category({ name: cat.name, order: await Category.countDocuments() });
            await category.save();
        }
        
        const catProjectOrder = [];
        
        for (const p of cat.projects) {
            console.log(`Importing Project: ${p.name}...`);
            let coverUrl = null;
            if (p.coverFile) {
                const res = await uploadFile(p.coverFile);
                coverUrl = res.url;
            }
            
            const galleryUrls = [];
            for (const gf of p.galleryFiles) {
                const res = await uploadFile(gf);
                galleryUrls.push(res.url);
            }
            
            const proj = new Project({
                title: p.name,
                categoryIds: [category._id],
                coverImage: coverUrl,
                images: galleryUrls,
                status: 'published',
                order: projectOrder++
            });
            await proj.save();
            newProjectIds.push(proj._id);
            catProjectOrder.push(proj._id.toString());
        }
        
        // Update category project order
        category.projectOrder = catProjectOrder;
        await category.save();
    }
    
    console.log('\n--- IMPORT SUCCESSFUL ---');
    
    // Delete old projects and their media
    console.log('\nCleaning up old projects...');
    const oldProjectIds = existingProjects.map(p => p._id);
    for (const oldProj of existingProjects) {
        // Collect media to delete safely
        const mediaUrls = [];
        if (oldProj.coverImage) mediaUrls.push(oldProj.coverImage);
        if (oldProj.cardBanner) mediaUrls.push(oldProj.cardBanner);
        if (oldProj.images) mediaUrls.push(...oldProj.images);
        if (oldProj.blocks) {
            oldProj.blocks.forEach(b => {
                if ((b.type === 'image' || b.type === 'video') && b.content) mediaUrls.push(b.content);
            });
        }
        
        // Delete project
        await Project.findByIdAndDelete(oldProj._id);
        
        // Let safe media cleanup handle the cloudinary assets when they are orphaned
        for (const url of mediaUrls) {
            const public_id = extractPublicId(url);
            if (!public_id) continue;
            // Check if still used by NEW projects or homepage
            const hp = await mongoose.connection.collection('homepages').findOne({ key: 'index' });
            let inUse = false;
            if (hp && hp.data) {
                if (hp.data.hero && hp.data.hero.mediaUrl && hp.data.hero.mediaUrl.includes(public_id)) inUse = true;
                if (hp.data.contact && hp.data.contact.bannerUrl && hp.data.contact.bannerUrl.includes(public_id)) inUse = true;
            }
            
            const pInUse = await Project.findOne({
                $or: [
                    { coverImage: { $regex: public_id, $options: 'i' } },
                    { images: { $regex: public_id, $options: 'i' } },
                    { cardBanner: { $regex: public_id, $options: 'i' } },
                    { "blocks.content": { $regex: public_id, $options: 'i' } }
                ]
            });
            if (pInUse) inUse = true;
            
            if (!inUse) {
                try {
                    await cloudinary.uploader.destroy(public_id);
                    await Media.deleteOne({ public_id });
                    console.log(`Cleaned up orphaned media: ${public_id}`);
                } catch(e) {}
            }
        }
    }
    
    console.log('\nAll done!');
    process.exit(0);
}

run().catch(console.error);
