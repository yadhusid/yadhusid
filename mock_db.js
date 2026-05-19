const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// Helper to load/save JSON data
function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            users: [
                {
                    _id: 'user1',
                    username: 'yadhusid',
                    password: require('bcryptjs').hashSync('#Portfolio9020', 10),
                    recoveryEmail: 'yadhusid@gmail.com'
                }
            ],
            categories: [
                { _id: 'cat1', id: 'cat1', name: 'Interaction Design', slug: 'interaction-design', order: 0 },
                { _id: 'cat2', id: 'cat2', name: 'Visual Design', slug: 'visual-design', order: 1 }
            ],
            projects: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 4), 'utf8');
        return initial;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4), 'utf8');
}

// Mock User Model
class MockUser {
    constructor(fields) {
        Object.assign(this, fields);
        if (!this._id) this._id = 'mock-user-' + Math.random().toString(36).substr(2, 9);
    }
    
    static async countDocuments() {
        const db = loadDB();
        return db.users.length;
    }

    static async findOne(query) {
        const db = loadDB();
        const found = db.users.find(u => u.username === query.username);
        return found ? new MockUser(found) : null;
    }

    async save() {
        const db = loadDB();
        const idx = db.users.findIndex(u => u.username === this.username || u._id === this._id);
        if (idx !== -1) {
            db.users[idx] = this;
        } else {
            db.users.push(this);
        }
        saveDB(db);
        return this;
    }
}

// Mock Category Model
class MockCategory {
    constructor(fields) {
        Object.assign(this, fields);
        if (!this._id) this._id = 'mock-cat-' + Math.random().toString(36).substr(2, 9);
        this.id = this._id;
    }

    static find() {
        const db = loadDB();
        const items = db.categories.map(c => new MockCategory(c));
        return {
            sort: () => items
        };
    }

    static async findById(id) {
        const db = loadDB();
        const found = db.categories.find(c => c._id === id);
        return found ? new MockCategory(found) : null;
    }

    static async findByIdAndDelete(id) {
        const db = loadDB();
        db.categories = db.categories.filter(c => c._id !== id);
        saveDB(db);
        return { success: true };
    }

    async save() {
        const db = loadDB();
        const idx = db.categories.findIndex(c => c._id === this._id);
        if (idx !== -1) {
            db.categories[idx] = this;
        } else {
            db.categories.push(this);
        }
        saveDB(db);
        return this;
    }
}

// Mock Project Model
class MockProject {
    constructor(fields) {
        Object.assign(this, fields);
        if (!this._id) this._id = 'mock-proj-' + Math.random().toString(36).substr(2, 9);
        this.id = this._id;
        if (!this.blocks) this.blocks = [];
        if (!this.categoryIds) this.categoryIds = [];
        if (!this.images) this.images = [];
    }

    static find() {
        const db = loadDB();
        const items = db.projects.map(p => new MockProject(p));
        return {
            sort: () => items
        };
    }

    static async findById(id) {
        const db = loadDB();
        const found = db.projects.find(p => p._id === id);
        return found ? new MockProject(found) : null;
    }

    static async findByIdAndDelete(id) {
        const db = loadDB();
        db.projects = db.projects.filter(p => p._id !== id);
        saveDB(db);
        return { success: true };
    }

    static async findByIdAndUpdate(id, update, options) {
        const db = loadDB();
        const idx = db.projects.findIndex(p => p._id === id);
        if (idx !== -1) {
            Object.assign(db.projects[idx], update);
            saveDB(db);
            return new MockProject(db.projects[idx]);
        }
        return null;
    }

    static async bulkWrite(ops) {
        const db = loadDB();
        ops.forEach(op => {
            if (op.updateOne) {
                const id = op.updateOne.filter._id;
                const update = op.updateOne.update;
                const found = db.projects.find(p => p._id === id);
                if (found) {
                    if (update.order !== undefined) found.order = update.order;
                }
            }
        });
        saveDB(db);
        return { success: true };
    }

    async save() {
        const db = loadDB();
        const idx = db.projects.findIndex(p => p._id === this._id);
        if (idx !== -1) {
            db.projects[idx] = this;
        } else {
            db.projects.push(this);
        }
        saveDB(db);
        return this;
    }
}

module.exports = {
    User: MockUser,
    Category: MockCategory,
    Project: MockProject
};
