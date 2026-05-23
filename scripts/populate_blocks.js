const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const ProjectSchema = new mongoose.Schema({}, { strict: false });
    const Project = mongoose.model('Project', ProjectSchema);
    const projects = await Project.find({});
    
    let updated = 0;
    for (const p of projects) {
        const pObj = p.toObject();
        if ((!pObj.blocks || pObj.blocks.length === 0) && pObj.images && pObj.images.length > 0) {
            const blocks = pObj.images.map((url, i) => ({
                type: url.toLowerCase().match(/\.(mp4|webm)$/) ? 'video' : 'image',
                content: url,
                order: i,
                radiusTop: false,
                radiusBottom: false,
                hasGap: true
            }));
            await Project.findByIdAndUpdate(p._id, { $set: { blocks } });
            updated++;
        }
    }
    console.log(`Updated ${updated} projects with blocks!`);
    process.exit(0);
}

run().catch(console.error);
