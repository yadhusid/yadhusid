# Project Recovery / Restart Brief

## 1. Project Overview
**What this project is about:**
This is a custom-built Portfolio website and CMS for Yadhu Sidharthan, a Creative Graphics Designer. 

**Main Purpose of the Homepage:**
To serve as a public portfolio showcasing the user's projects, design philosophy, and contact information. The homepage dynamically fetches and displays published projects and their categories from the database.

**Main Purpose of the CMS/Admin Page:**
To provide a secure, visual backend interface where the user can manage their portfolio content without writing code. 

**Main Features Built:**
- Custom homepage UI with responsive hero banner, floating pill-shaped navigation, and dynamic project grids.
- Complete Custom CMS Dashboard with features to:
  - Create, edit, publish/draft, and delete projects.
  - Upload media (cover images, block images) automatically synced to Cloudinary.
  - Manage and reorder Categories.
  - Update account passwords via OTP recovery.
- Serverless deployment optimized for Vercel.

**User Roles & Security:**
- Single Admin user access.
- Protected by a login screen utilizing secure session cookies and `bcrypt` password hashing.

---

## 2. Tech Stack
- **Frontend Framework:** Vanilla HTML, CSS, JavaScript.
- **Styling:** Custom CSS combined with a compiled TailwindCSS build (`styles.css`).
- **Backend Framework:** Node.js with Express.js.
- **Database:** MongoDB (using Mongoose ODM).
- **Image/Media Storage:** Cloudinary.
- **Session Management:** `express-session` backed by `connect-mongo`.
- **Major Dependencies:** `express`, `mongoose`, `cloudinary`, `multer` (for file parsing), `bcryptjs`.

---

## 3. Folder Structure
- **`/public/`**: Contains all frontend assets exposed to the web.
  - **`index.html`**: The main Homepage code.
  - **`project.html`**: Dynamic template for viewing a single project.
  - **`/admin/dashboard.html`**: The core CMS interface.
  - **`/admin/login.html`**: The admin login portal.
  - **`styles.css`** / **`script.js`**: Core frontend styling and logic.
- **`server.js`**: The heart of the backend. Contains all API routes (`/api/login`, `/api/projects`, `/api/categories`), database connection logic, Mongoose schemas, and Cloudinary configuration.
- **`vercel.json`**: Routing and serverless configuration for Vercel deployment.

---

## 4. Environment Variables
*Note: This project relies on environment variables stored locally in a `.env` file and remotely in the Vercel Dashboard.*

**Required Variables:**
- `MONGODB_URI`: The connection string to the MongoDB Atlas database.
- `PORT`: The port the local server runs on (typically `3000`).
- `SESSION_SECRET`: A secure string used to encrypt login session cookies.
- `RECOVERY_EMAIL`: The admin's email address used to send OTPs for password resets.
- `CLOUDINARY_CLOUD_NAME`: The unique Cloudinary account identifier.
- `CLOUDINARY_API_KEY`: Authentication key for uploading media to Cloudinary.
- `CLOUDINARY_API_SECRET`: Secret token for Cloudinary authentication.

---

## 5. Deployment & Hosting
- **Hosting Provider:** Vercel.com (Serverless).
- **Configuration:** The `vercel.json` file controls the build. It maps the `/api/*` and `/admin/save-cms` routes to the Node.js backend (`server.js`), while routing everything else statically from the `/public` folder for maximum speed.
- **Redeploying:** Any commit pushed to the GitHub repository's `main` branch will trigger an automatic Vercel build. Alternatively, running `vercel --prod` locally will push a direct deployment.
- **Build/Install Commands:** Managed automatically by Vercel's Node.js preset. 

---

## 6. Domain & DNS
- **Domain:** `yadsid.com` and `www.yadsid.com`.
- **Registrar/DNS Provider:** Atom.com.
- **Setup:** The domain is connected to Vercel via A-records and CNAME records pointing to Vercel's IP addresses (`76.76.21.21` and `76.76.21.93`). If migrating in the future, these DNS records on Atom.com will need to be updated to match the new host.

---

## 7. Database
- **Provider:** MongoDB Atlas.
- **Connection:** Handled via Mongoose in `server.js` using the `MONGODB_URI`.
- **Collections/Models:**
  - `Users`: Stores admin credentials (hashed password).
  - `Categories`: Stores portfolio categories (e.g., UI/UX, Sprint).
  - `Projects`: Stores all project data, including complex arrays of JSON objects representing content "blocks" (text, image, video).
  - `Homepages`: Stores cached HTML states for the visual editor.
  - `sessions`: Automatically created by `connect-mongo` to track active admin logins.

---

## 8. Cloudinary / Media Storage
- **Configuration:** Initialized in `server.js` using the `CLOUDINARY_*` environment variables.
- **Upload Logic:** When a user uploads an image via the CMS, the file is intercepted by `multer` (in memory) within `server.js` and pushed securely to the Cloudinary API. 
- **Storage:** Cloudinary returns a permanent, optimized image URL which is then saved into the MongoDB `Projects` collection. No images are saved directly to the Vercel filesystem (which is read-only).

---

## 9. GitHub Repository
- **Connection:** The project is version-controlled via Git and pushed to a remote GitHub repository (`origin`).
- **Branch:** `main`.
- **Reconnecting:** To start fresh, run `git clone [REPO_URL]`. 

---

## 10. CMS/Admin Instructions
- **Access:** Visit `https://www.yadsid.com/admin/login.html`
- **Login:** Enter the Admin username and password. Inputs are automatically trimmed of invisible spaces to prevent autofill errors.
- **Managing Categories:** You can add new categories, delete old ones, or drag-and-drop to reorder them in the Overview tab.
- **Managing Projects:** Use the Projects tab to create new portfolio entries. You can assign categories, upload cover images, toggle "Published/Draft" status, and build custom layouts using text and image blocks.
- **Limitation to Note:** Because Vercel caches files aggressively, API endpoints (like fetching categories) have been equipped with "cache-busting" timestamps to ensure the CMS always reflects immediate changes. 

---

## 11. Homepage Instructions
- **Structure:** The homepage (`public/index.html`) is highly customized with CSS variables for responsive padding and curves.
- **Dynamic Content:** A script (`public/portfolio.js`) fetches the latest published Projects and Categories from the MongoDB backend and injects them into the DOM upon page load.
- **Design Logic:** Features a floating, pill-shaped glass navigation bar and a visually centered hero banner that adapt their curvature (`border-radius`) fluidly based on screen width.

---

## 12. Local Setup Instructions
To restart this project on a fresh machine:
1. **Requirements:** Install Node.js (v18+ recommended) and Git.
2. **Clone:** `git clone [YOUR_GITHUB_REPO_URL]`
3. **Install Dependencies:** Open the folder in your terminal and run `npm install`.
4. **Environment Setup:** Create a new file named `.env` in the root folder. Copy the keys listed in Section 4 and paste your actual secret credentials next to them. 
5. **Run Locally:** Execute `node server.js`. The site will be live at `http://localhost:3000`.
6. **Testing:** Open `http://localhost:3000/admin/login.html` to test the CMS, and `http://localhost:3000/` to test the homepage.
7. **Deploying:** Ensure the Vercel CLI is installed (`npm i -g vercel`), link the project using `vercel link`, and deploy using `vercel --prod`. Ensure all ENV variables are added to the Vercel dashboard.

---

## 13. Important Warnings
- **CRITICAL:** **NEVER commit the `.env` file to GitHub.** This contains your database passwords and Cloudinary secrets. If exposed, bad actors can delete or alter your data.
- **CRITICAL:** Do not delete the MongoDB Atlas cluster or Cloudinary account. Vercel only hosts the *code*; your actual data and images live on MongoDB and Cloudinary. 
- **Read-Only Filesystem:** Vercel's serverless environment does not allow saving files directly to the server. All media uploads must go through Cloudinary, and all data changes must go through MongoDB. Attempting to use `fs.writeFileSync` in production will fail or be erased on the next deploy.
- **Local Scripts:** Files like `test_login.js`, `update_index.js`, and `update_mongo.js` are temporary debug scripts and have been added to `.gitignore`. They are not required for production.
