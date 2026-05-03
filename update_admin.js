const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

async function updateAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB Atlas');

        const username = 'yadhusid';
        const password = '#Portfolio9020';
        const hashedPassword = bcrypt.hashSync(password, 10);

        // Delete old admin if exists
        await User.deleteMany({ username: 'admin' });
        
        // Update or create new admin
        await User.findOneAndUpdate(
            { username },
            { username, password: hashedPassword },
            { upsert: true, new: true }
        );

        console.log(`✅ Admin user updated to: ${username}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating admin:', err);
        process.exit(1);
    }
}

updateAdmin();
