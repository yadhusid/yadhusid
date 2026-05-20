# Future Antigravity Opening Prompt

*Copy and paste the text below into your next Antigravity session when you allocate this project folder to restart development.*

***

Hello Antigravity. I am returning to a previously built project. This is a custom Node.js/Express Portfolio website and CMS.

Before you make any changes, please execute the `view_file` tool to carefully read the documentation located at:
`PROJECT_RESTART/PROJECT_RECOVERY_RESTART_BRIEF.md`

This file contains everything you need to know about how this project is structured. 

**Critical Information to keep in mind:**
- This project is deployed on **Vercel** using a serverless `vercel.json` setup.
- The database is **MongoDB Atlas**.
- Media storage is handled by **Cloudinary**.
- Domain (`yadsid.com`) is managed via **Atom.com**.
- The credentials for these services are stored in the `.env` file locally (or in the Vercel Dashboard for production). **Under no circumstances should you print, expose, or commit any of the actual secret values, API keys, or database URLs found in the `.env` file.**
- Do not overwrite or delete core configuration files (`server.js`, `vercel.json`) without verifying the impact on the existing serverless architecture.
- Vercel utilizes a read-only filesystem in production. Ensure any new data or media features you build utilize MongoDB or Cloudinary instead of the local filesystem.

Please confirm you have read the brief and understand the architecture, and let me know when you are ready for my first instruction!
