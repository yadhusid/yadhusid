const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    images: [String],
    order: { type: Number, default: 0 }
});
const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // backwards compatibility
    coverImage: { type: String },
    coverImageZoom: { type: Number, default: 1 },
    coverImageX: { type: Number, default: 50 },
    coverImageY: { type: Number, default: 50 },
    images: [String],
    blocks: [{
        type: { type: String, enum: ['image', 'text', 'video', 'spacing'] },
        content: String,
        order: Number,
        radiusTop: { type: Boolean, default: false },
        radiusBottom: { type: Boolean, default: false },
        hasGap: { type: Boolean, default: false }
    }],
    order: { type: Number, default: 0 },
    status: { type: String, default: 'published' },
    createdAt: { type: Date, default: Date.now }
});

const Category = mongoose.model('Category', CategorySchema);
const Project = mongoose.model('Project', ProjectSchema);

const sourceDir = 'C:\\Users\\Yadhu\\Desktop\\BEHANCE';

// Utility for creating slugs
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        // 1. BACKUP
        console.log('\n--- 1. CREATING BACKUP ---');
        const currentCategories = await Category.find().lean();
        const currentProjects = await Project.find().lean();
        
        fs.writeFileSync('backup_categories.json', JSON.stringify(currentCategories, null, 2));
        fs.writeFileSync('backup_projects.json', JSON.stringify(currentProjects, null, 2));
        console.log(`Backed up ${currentCategories.length} categories to backup_categories.json`);
        console.log(`Backed up ${currentProjects.length} projects to backup_projects.json`);

        // 2. IDENTIFY CLOUDINARY ASSETS
        console.log('\n--- 2. IDENTIFYING MEDIA TO DELETE ---');
        let assetsToDelete = [];
        for (const proj of currentProjects) {
            if (proj.images && Array.isArray(proj.images)) {
                proj.images.forEach(img => assetsToDelete.push(img));
            }
            if (proj.coverImage) {
                assetsToDelete.push(proj.coverImage);
            }
            if (proj.blocks && Array.isArray(proj.blocks)) {
                proj.blocks.forEach(block => {
                    if (block.type === 'image' && block.content) {
                        assetsToDelete.push(block.content);
                    }
                });
            }
        }
        for (const cat of currentCategories) {
            if (cat.images && Array.isArray(cat.images)) {
                cat.images.forEach(img => assetsToDelete.push(img));
            }
        }
        
        let publicIds = assetsToDelete.map(url => {
            try {
                let parts = url.split('/');
                let filename = parts.pop();
                let publicId = filename.split('.')[0];
                let folder = parts.pop();
                if(folder && !folder.startsWith('v') && folder !== 'upload') {
                    return folder + '/' + publicId;
                }
                return publicId;
            } catch(e) { return null; }
        }).filter(Boolean);
        
        // ensure unique
        publicIds = [...new Set(publicIds)];

        // 3. DELETE CLOUDINARY ASSETS
        if (publicIds.length > 0) {
            console.log(`Deleting ${publicIds.length} assets from Cloudinary...`);
            // batch delete by 100
            for (let i = 0; i < publicIds.length; i += 100) {
                const batch = publicIds.slice(i, i + 100);
                await cloudinary.api.delete_resources(batch);
                console.log(`Deleted batch of ${batch.length} assets.`);
            }
        } else {
            console.log('No Cloudinary assets to delete.');
        }

        // 4. DELETE DB RECORDS
        console.log('\n--- 3. DELETING DATABASE RECORDS ---');
        await Project.deleteMany({});
        await Category.deleteMany({});
        console.log('All existing projects and categories deleted from MongoDB.');

        // 5. IMPORT PROCESS
        console.log('\n--- 4. STARTING IMPORT ---');
        const catDirs = fs.readdirSync(sourceDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        let catOrder = 0;
        for (const catName of catDirs) {
            console.log(`\nProcessing Category: ${catName}`);
            
            // Create Category
            let slug = slugify(catName);
            // Handle duplicates
            let existingCat = await Category.findOne({ slug });
            if (existingCat) slug = `${slug}-${Date.now()}`;
            
            const category = await Category.create({
                name: catName,
                slug: slug,
                order: catOrder++
            });

            const catPath = path.join(sourceDir, catName);
            const projDirs = fs.readdirSync(catPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            let projOrder = 0;
            for (const projName of projDirs) {
                console.log(`  Importing Project: ${projName}`);
                const projPath = path.join(catPath, projName);
                const files = fs.readdirSync(projPath, { withFileTypes: true })
                    .filter(dirent => dirent.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(dirent.name))
                    .map(dirent => dirent.name);

                files.sort((a, b) => {
                    const numA = parseInt(a.match(/\d+/)) || 0;
                    const numB = parseInt(b.match(/\d+/)) || 0;
                    if(numA !== numB) return numA - numB;
                    return a.localeCompare(b);
                });

                let uploadedUrls = [];
                // Upload images to Cloudinary
                for (const file of files) {
                    const filePath = path.join(projPath, file);
                    try {
                        const result = await cloudinary.uploader.upload(filePath, {
                            folder: 'portfolio_uploads'
                        });
                        uploadedUrls.push(result.secure_url);
                        console.log(`    Uploaded: ${file}`);
                    } catch (uploadErr) {
                        console.error(`    FAILED to upload: ${file}`, uploadErr.message);
                    }
                }

                let projSlug = slugify(projName);
                let existingProj = await Project.findOne({ slug: projSlug });
                if (existingProj) projSlug = `${projSlug}-${Date.now()}`;

                const blocks = [];
                let coverImage = "";

                if (uploadedUrls.length > 0) {
                    coverImage = uploadedUrls[0];
                    for (let i = 1; i < uploadedUrls.length; i++) {
                        blocks.push({
                            type: 'image',
                            content: uploadedUrls[i],
                            order: i - 1,
                            radiusTop: false,
                            radiusBottom: false,
                            hasGap: false
                        });
                    }
                }

                await Project.create({
                    title: projName,
                    slug: projSlug,
                    categoryIds: [category._id],
                    categoryId: category._id,
                    coverImage: coverImage,
                    blocks: blocks,
                    order: projOrder++,
                    status: 'published'
                });
                console.log(`  Saved project: ${projName}`);
            }
        }

        console.log('\n✅ IMPORT COMPLETE!');

    } catch (err) {
        console.error('Error during import:', err);
    } finally {
        mongoose.disconnect();
    }
}

run();
