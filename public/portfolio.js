// portfolio.js — dynamically loads categories and projects from the backend API

(async function () {
    let allProjects = [];
    let allCategories = [];
    let activeCategory = 'all';

    const tabsEl = document.getElementById('categoryTabs');
    const gridEl = document.getElementById('projectsGrid');

    // ── Fetch data ─────────────────────────────────────────────────────────────
    async function fetchData() {
        try {
            const [catRes, projRes] = await Promise.all([
                fetch('/api/categories'),
                fetch('/api/projects')
            ]);
            allCategories = await catRes.json();
            allProjects = await projRes.json();
            renderTabs();
            renderProjects('all');
        } catch (err) {
            // Server not running — show static placeholder message
            gridEl.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#a0a0ab;padding:3rem 0;">
                    <p style="font-size:1.1rem;margin-bottom:0.5rem;">Start the server to see your projects here.</p>
                    <p style="font-size:0.9rem;">Run <code style="background:rgba(99,102,241,0.15);padding:0.2rem 0.5rem;border-radius:4px;color:#6366f1;">node server.js</code> in your project folder.</p>
                </div>`;
            tabsEl.style.display = 'none';
        }
    }

    // ── Render category filter tabs ────────────────────────────────────────────
    function renderTabs() {
        if (!allCategories.length) { tabsEl.style.display = 'none'; return; }
        const tabs = [{ id: 'all', name: 'All Work' }, ...allCategories];
        tabsEl.innerHTML = tabs.map(c => `
            <button class="cat-tab ${c.id === 'all' ? 'active' : ''}" data-id="${c.id}" onclick="filterCategory('${c.id}', this)">
                ${c.name}
            </button>`).join('');
    }

    // ── Render project cards ───────────────────────────────────────────────────
    function renderProjects(categoryId) {
        const filtered = categoryId === 'all'
            ? allProjects
            : allProjects.filter(p => p.categoryId === categoryId);

        if (!filtered.length) {
            gridEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#a0a0ab;padding:3rem 0;">No projects in this category yet.</div>`;
            return;
        }

        gridEl.innerHTML = filtered.map((p, i) => {
            const cat = allCategories.find(c => c.id === p.categoryId);
            const delay = ['', 'delay-1', 'delay-2'][i % 3];
            return `
            <div class="project-card fade-up ${delay}">
                <a href="/project.html?id=${p.id}" style="text-decoration:none;color:inherit;">
                    ${p.coverImage
                        ? `<img src="${p.coverImage}" alt="${p.title}" style="width:100%;height:250px;object-fit:cover;">`
                        : `<div class="project-image-placeholder gradient-${(i % 3) + 1}"><span>${cat ? cat.name : 'Project'}</span></div>`}
                    <div class="project-info">
                        ${cat ? `<span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:#6366f1;font-weight:600;">${cat.name}</span>` : ''}
                        <h3 style="margin-top:0.5rem;">${p.title}</h3>
                        <p>${p.description || ''}</p>
                        <span class="project-link">View Case Study →</span>
                    </div>
                </a>
            </div>`;
        }).join('');

        // Trigger scroll observer on new cards
        document.querySelectorAll('#projectsGrid .fade-up').forEach(el => {
            el.classList.remove('visible');
            setTimeout(() => el.classList.add('visible'), 50);
        });
    }

    // ── Expose filter function globally (used in onclick) ──────────────────────
    window.filterCategory = function (id, btn) {
        activeCategory = id;
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        renderProjects(id);
    };

    fetchData();
})();
