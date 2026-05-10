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
            <a href="/project.html?id=${p.id}" class="${bgColor} h-[550px] rounded-[32px] overflow-hidden relative group cursor-pointer hover:shadow-2xl transition-all duration-300 block">
                ${p.coverImage
                    ? `<img src="${p.coverImage}" class="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700">`
                    : ''}
                <div class="absolute inset-0 p-12 ${textColor} flex flex-col justify-between z-10">
                    <div>
                        <h3 class="text-xl font-bold uppercase tracking-widest mb-3 leading-snug">${p.title}</h3>
                        <div class="w-10 h-[1px] ${hrColor} mb-6"></div>
                        <p class="text-[11px] ${descColor} max-w-[200px] leading-relaxed font-light">
                            ${p.description ? p.description.substring(0, 150) + (p.description.length > 150 ? '...' : '') : 'Explore the process and details of this design project.'}
                        </p>
                    </div>
                    <div>
                        <div class="font-bold text-sm mb-1 tracking-widest uppercase opacity-80">${cat ? cat.name : 'Design'}</div>
                        <div class="text-[10px] uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">View Project →</div>
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
