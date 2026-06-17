# Project Summary
- This is an existing portfolio website + CMS
- Public website + CMS dashboard
- Live hosting is Google Cloud Run
- MongoDB is used for structured CMS data
- Cloudinary is used for media/images
- GitHub is the source repository

# Current Architecture
- Public homepage
- Individual project pages
- CMS Overview page
- CMS Projects page
- CMS Homepage Content / Visual Editor page
- Project Wireframe Editor
- Shared navbar
- Shared footer
- Shared contact card

# Main Services / Connections
- Google Cloud Run = live deployment
- GitHub = source control
- MongoDB = homepage/project/category/core skill/contact structured data
- Cloudinary = hero banners, contact banners, thumbnails, project images
- Render.com = removed / should not be used
- Vercel = removed / should not be used

# Important ENV Keys
- MONGODB_URI
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- PORT
- NODE_ENV
- SESSION_SECRET
- ADMIN_USERNAME
- ADMIN_PASSWORD

# Local Development Instructions
- Install dependencies: `npm install`
- Run local server: `npm run dev` or `npm start`
- Local CMS URL: `http://localhost:<PORT>/admin/login` or `http://localhost:<PORT>/admin/dashboard`
- Local homepage URL: `http://localhost:<PORT>`
- Check console/server errors: Check the Node.js terminal for backend errors and browser console for frontend errors.

# Deployment Rules
- Deploy only through Google Cloud Run
- Do not deploy to Render
- Do not deploy to Vercel
- Check local first before pushing
- Push to GitHub only after local validation
- Cloud Run deploys from GitHub/current setup

# CMS Data Rules
- MongoDB structured JSON is the source of truth
- Do not use old static HTML DOM dump saving
- Homepage content must persist through MongoDB
- Project/category/core skills/order data must persist through MongoDB
- Draft/publish logic should be preserved

# Cloudinary Rules
- Store Cloudinary URL + `public_id` in MongoDB
- Do not delete media blindly
- Check whether a `public_id` is still referenced before deletion
- CMS previews should use lightweight 40x40 Cloudinary thumbnails
- Live website/project pages can use original/high-resolution images where needed
- Avoid duplicate uploads where possible

# Project Import Rules
Local image source folder: `C:\Users\Yadhu\Desktop\BEHANCE`

Folder logic:
- First-level folders = categories
- Second-level folders = projects
- `00` image = thumbnail only
- Do not include `00` in gallery
- Numbered images = gallery order

# Current Important UI/UX Requirements
- CMS uses system font stack
- CMS should be compact/dark UI
- Homepage contact card and project page contact card must be the same shared component
- All project pages must use shared footer
- Project editor should be wireframe/block editor, not live iframe editor
- Homepage content editor should be section-based, not DOM-dump editor

# Project Editor Rules
- Project Wireframe panel
- Project Details panel
- Image/text/space/line blocks
- 40x40 thumbnails in CMS
- Replace/duplicate/delete/reorder logic
- Cover thumbnail upload/zoom/reposition logic
- Save draft/publish/preview logic

# Homepage Editor Rules
- Hero Banner editor
- Core Skills description editor
- Projects block editor
- Contact editor
- Contact banner/background upload
- Phone/email/Behance/LinkedIn fields
- Publish homepage logic

# Validation Checklist

## Before editing:
- [ ] run local server
- [ ] verify homepage
- [ ] verify project pages
- [ ] verify CMS overview
- [ ] verify CMS projects
- [ ] verify homepage editor
- [ ] verify project editor
- [ ] verify MongoDB connection
- [ ] verify Cloudinary upload
- [ ] check console errors
- [ ] check remaining Render/Vercel references

## Before live deploy:
- [ ] local test passed
- [ ] commit to GitHub
- [ ] Cloud Run deploy passed
- [ ] live homepage works
- [ ] live CMS works
- [ ] uploads work
- [ ] no console/API errors

# Prompt To Use In A New Anti Gravity Session
```
read this PROJECT_CONTEXT_FOR_ANTIGRAVITY.md file first
scan project folder
confirm current architecture
do not edit until context is understood
continue from current project state
ask before destructive actions
```
