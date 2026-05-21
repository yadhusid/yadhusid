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
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    images: [String],
    order: { type: Number, default: 0 }
});

const Category = mongoose.model('Category', CategorySchema);
const Project = mongoose.model('Project', ProjectSchema);

const sourceDir = 'C:\\Users\\Yadhu\\Desktop\\BEHANCE';

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        // 1. Fetch current projects and categories
        const currentCategories = await Category.find().lean();
        const currentProjects = await Project.find().lean();

        console.log(`\n--- DB STATUS ---`);
        console.log(`Found ${currentCategories.length} Categories to delete.`);
        console.log(`Found ${currentProjects.length} Projects to delete.`);

        // 2. Identify Cloudinary assets to delete
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
        
        // Extract public IDs from URLs
        // e.g. https://res.cloudinary.com/.../upload/v1234/folder/image.jpg
        let publicIds = assetsToDelete.map(url => {
            try {
                // simple split logic
                let parts = url.split('/');
                let filename = parts.pop();
                let publicId = filename.split('.')[0];
                let folder = parts.pop();
                // skip versions like v123456
                if(folder && !folder.startsWith('v') && folder !== 'upload') {
                    return folder + '/' + publicId;
                }
                return publicId;
            } catch(e) { return null; }
        }).filter(Boolean);

        console.log(`Found ${publicIds.length} Cloudinary assets to delete.`);

        // 3. Scan Local Folder
        console.log(`\n--- LOCAL FOLDER SCAN ---`);
        const newCategories = [];
        let newProjectsCount = 0;
        let newImagesCount = 0;

        const catDirs = fs.readdirSync(sourceDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const catName of catDirs) {
            const catPath = path.join(sourceDir, catName);
            const projDirs = fs.readdirSync(catPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            const projects = [];
            for (const projName of projDirs) {
                const projPath = path.join(catPath, projName);
                const files = fs.readdirSync(projPath, { withFileTypes: true })
                    .filter(dirent => dirent.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(dirent.name))
                    .map(dirent => dirent.name);

                // sorting files logically (1, 2, 10)
                files.sort((a, b) => {
                    const numA = parseInt(a.match(/\d+/)) || 0;
                    const numB = parseInt(b.match(/\d+/)) || 0;
                    if(numA !== numB) return numA - numB;
                    return a.localeCompare(b);
                });

                projects.push({
                    name: projName,
                    imagesCount: files.length,
                    images: files
                });
                newProjectsCount++;
                newImagesCount += files.length;
            }

            newCategories.push({
                name: catName,
                projectsCount: projects.length,
                projects: projects
            });
        }

        console.log(`Found ${newCategories.length} new Categories to import.`);
        console.log(`Found ${newProjectsCount} new Projects to import.`);
        console.log(`Found ${newImagesCount} new Images to upload.`);

        const report = {
            db: {
                categoriesToDelete: currentCategories.length,
                projectsToDelete: currentProjects.length,
                cloudinaryAssetsToDelete: publicIds.length,
                cloudinaryPublicIds: publicIds
            },
            local: {
                categoriesToImport: newCategories.length,
                projectsToImport: newProjectsCount,
                imagesToUpload: newImagesCount,
                categories: newCategories
            }
        };

        fs.writeFileSync('dry_run_report.json', JSON.stringify(report, null, 2));
        console.log('\nDry run completed. Report saved to dry_run_report.json');

    } catch (err) {
        console.error('Error during dry run:', err);
    } finally {
        mongoose.disconnect();
    }
}

run();
