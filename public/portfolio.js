// portfolio.js — dynamically loads categories and projects from the backend API

(async function () {
    let allProjects = [];
    let allCategories = [];
    let activeCategory = 'all';

    const tabsEl = document.getElementById('project-categories');
    const gridEl = document.getElementById('projectsGrid');

    if (!tabsEl || !gridEl) return; // Exit if not on portfolio page

    // ── Fetch data ─────────────────────────────────────────────────────────────
    async function fetchData() {
        try {
            const [catRes, projRes] = await Promise.all([
                fetch('/api/categories'),
                fetch('/api/projects')
            ]);

            if (!catRes.ok || !projRes.ok) throw new Error('API request failed');

            allCategories = await catRes.json();
            allProjects = await projRes.json();

            renderTabs();
            renderProjects('all');
        } catch (err) {
            console.error('FetchData failed:', err);
            gridEl.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#a0a0ab;padding:3rem 0;">
                    <p style="font-size:1.1rem;margin-bottom:0.5rem;">Your portfolio is ready. Add projects in the CMS to see them here.</p>
                </div>`;
            if (tabsEl) tabsEl.style.display = 'none';
        }
    }

    // ── Render category filter tabs ────────────────────────────────────────────
    function renderTabs() {
        if (!allCategories.length) return;
        const tabs = [{ id: 'all', name: 'All Works' }, ...allCategories];
        tabsEl.innerHTML = tabs.map(c => {
            const isActive = c.id === activeCategory;
            return `
            <button class="bg-[#F2F2F2] px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-[#111] hover:bg-black hover:text-white transition-all${isActive ? ' !bg-black !text-white' : ''}" 
                    data-id="${c.id}" 
                    onclick="filterCategory('${c.id}', this)">
                ${c.name}
            </button>`;
        }).join('');
    }

    // ── Render project cards ───────────────────────────────────────────────────
    function renderProjects(categoryId) {
        let filtered = categoryId === 'all'
            ? allProjects
            : allProjects.filter(p => p.categoryId === categoryId);

        // Filter only published projects for the public view
        filtered = filtered.filter(p => p.status === 'published');

        if (!filtered.length) {
            gridEl.innerHTML = `<div class="col-span-full py-20 text-center text-gray-400 font-medium tracking-widest text-sm">No projects in this category yet.</div>`;
            return;
        }

        const bgColors = ['bg-[#0d0d0d]', 'bg-[#0a0a0a]', 'bg-[#050505]', 'bg-[#111111]'];

        gridEl.innerHTML = filtered.map((p, i) => {
            const cat = allCategories.find(c => c.id === p.categoryId);
            const bgColor = bgColors[i % bgColors.length];
            const isDark = true; // All are dark now
            const textColor = 'text-white';
            const hrColor = 'bg-[#FF4B2B]'; // Signature accent
            const descColor = 'text-white/50';

            return `
            <a href="/project.html?id=${p.id}" class="bg-white h-[380px] rounded-[24px] overflow-hidden relative group cursor-pointer transition-all duration-500 block border border-black/5 hover:shadow-xl">
                ${p.coverImage
                    ? `<img src="${p.coverImage}" class="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105">`
                    : '<div class="absolute inset-0 bg-[#f8f8f8]"></div>'}
                
                <!-- Hover Overlay (Simplified & Lowered) -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 z-10">
                    <div class="translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                        <h3 class="text-lg font-bold text-white tracking-tight leading-tight">${p.title}</h3>
                    </div>
                </div>
            </a>`;
        }).join('');
    }

    // ── Expose filter function globally (used in onclick) ──────────────────────
    window.filterCategory = function (id, btn) {
        activeCategory = id;
        renderTabs(); // Re-render to update tab styles
        renderProjects(id);
    };

    fetchData();
})();
