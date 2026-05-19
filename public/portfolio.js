let allProjects = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCategories();
    await fetchProjects();
});

async function fetchCategories() {
    try {
        const res = await fetch('/api/categories');
        allCategories = await res.json();
        renderCategories();
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

async function fetchProjects() {
    try {
        const res = await fetch('/api/projects');
        allProjects = await res.json();
        renderProjects();
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}

function renderCategories() {
    const filterContainer = document.getElementById('project-categories');
    if (!filterContainer) return;

    // Keep "All Works" button
    let html = `<button class="bg-black text-white px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all" onclick="filterProjects('all', this)">All Works</button>`;
    
    allCategories.forEach(cat => {
        html += `<button class="bg-[#F2F2F2] px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-[#111] hover:bg-black hover:text-white transition-all" onclick="filterProjects('${cat.id}', this)">${cat.name}</button>`;
    });

    filterContainer.innerHTML = html;
}

function filterProjects(categoryId, btn) {
    // Update active button styles
    const buttons = document.querySelectorAll('#project-categories button');
    buttons.forEach(b => {
        b.classList.remove('bg-black', 'text-white');
        b.classList.add('bg-[#F2F2F2]', 'text-[#111]');
    });
    btn.classList.remove('bg-[#F2F2F2]', 'text-[#111]');
    btn.classList.add('bg-black', 'text-white');

    if (categoryId === 'all') {
        renderProjects(allProjects);
    } else {
        const filtered = allProjects.filter(p => p.categoryIds && p.categoryIds.includes(categoryId));
        renderProjects(filtered);
    }
}

function renderProjects(projects = allProjects) {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    // Only show published projects for public view
    const published = projects.filter(p => p.status === 'published');

    if (published.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-20 text-center text-gray-400">Coming Soon</div>';
        return;
    }

    grid.innerHTML = published.map(p => {
        const cats = p.categoryIds ? p.categoryIds.map(id => {
            const c = allCategories.find(cat => (cat.id === id || cat._id === id));
            return c ? c.name : '';
        }).filter(n => n).join(' & ') : 'Project';

        return `
            <a href="project.html?id=${p.id}" class="group block relative overflow-hidden rounded-[24px] bg-[#F9F9F9] border border-[#F2F2F2] transition-all duration-500 hover:shadow-2xl hover:shadow-black/5" style="transform: translateZ(0);">
                <div class="aspect-[3/2.2] overflow-hidden relative">
                    ${p.coverImage 
                        ? `<img src="${p.coverImage}" 
                             alt="${p.title}" 
                             class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                             style="transform: scale(${p.coverImageZoom || 1}) translate(${(p.coverImageX === 50 || !p.coverImageX) ? 0 : p.coverImageX}px, ${(p.coverImageY === 50 || !p.coverImageY) ? 0 : p.coverImageY}px); transform-origin: center center;">`
                        : `<div class="w-full h-full bg-[#EEE] flex items-center justify-center text-[#AAA] font-medium uppercase tracking-widest text-[10px]">No Cover</div>`
                    }
                    ${p.cardOverlay ? `<div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>` : ''}
                </div>
                
                <div class="p-6 md:p-8 flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-[#AAA]">${cats}</span>
                    <h3 class="text-[20px] font-bold tracking-tight text-[#111] group-hover:text-black transition-colors">${p.title}</h3>
                </div>

                ${p.cardBanner ? `
                    <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-cover bg-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-1.5 group-hover:translate-y-0" 
                         style="background-image: url('${p.cardBanner}');"></div>
                ` : ''}
            </a>
        `;
    }).join('');
}
