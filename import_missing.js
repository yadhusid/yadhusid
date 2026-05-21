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
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
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

        const catName = 'AMAZING WORKS';
        const projName = 'Dubai Holding Entertainment';
        const projPath = 'C:\\Users\\Yadhu\\Desktop\\BEHANCE\\AMAZING WORKS\\Dubai Holding Entertainment';

        // Get or Create Category
        let category = await Category.findOne({ name: catName });
        if (!category) {
            let slug = slugify(catName);
            category = await Category.create({ name: catName, slug: slug, order: 0 });
            console.log(`Created Category: ${catName}`);
        }

        // Check if project already exists to avoid duplicates
        const existingProj = await Project.findOne({ title: projName });
        if (existingProj) {
            console.log(`Project ${projName} already exists! Deleting it to re-import...`);
            await Project.deleteOne({ _id: existingProj._id });
        }

        const files = fs.readdirSync(projPath, { withFileTypes: true })
            .filter(dirent => dirent.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(dirent.name))
            .map(dirent => dirent.name);

        files.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)) || 0;
            const numB = parseInt(b.match(/\d+/)) || 0;
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });

        console.log(`Found ${files.length} images to upload for ${projName}...`);

        let uploadedUrls = [];
        for (const file of files) {
            const filePath = path.join(projPath, file);
            try {
                const result = await cloudinary.uploader.upload(filePath, {
                    folder: 'portfolio_uploads'
                });
                uploadedUrls.push(result.secure_url);
                console.log(`Uploaded: ${file}`);
            } catch (uploadErr) {
                console.error(`FAILED to upload: ${file}`, uploadErr.message);
            }
        }

        let projSlug = slugify(projName);
        let checkSlug = await Project.findOne({ slug: projSlug });
        if (checkSlug) projSlug = `${projSlug}-${Date.now()}`;

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
            order: 0,
            status: 'published'
        });
        
        console.log(`✅ Successfully imported missing project: ${projName}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        mongoose.disconnect();
    }
}

run();
