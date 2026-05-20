const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

let User;

try {
  User = mongoose.model('User');
} catch {
  User = mongoose.model('User', UserSchema);
}

async function updateAdmin() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from .env file');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    const users = [
      { username: 'yadhusid', password: '#Portfolio9020' },
      { username: 'yadhu', password: 'yadhu123' }
    ];

    for (const u of users) {
      const hashedPassword = bcrypt.hashSync(u.password, 10);

      await User.findOneAndUpdate(
        { username: u.username },
        { username: u.username, password: hashedPassword },
        { upsert: true, new: true }
      );

      console.log(`User ${u.username} updated.`);
    }

    console.log('Admin users update completed.');
    await mongoose.connection.close();
    process.exit(0);

  } catch (err) {
    console.error('Error updating admin:', err.message);
    process.exit(1);
  }
}

updateAdmin();