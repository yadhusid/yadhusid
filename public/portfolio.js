let allProjects = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCoreSkills();
    await fetchCategories();
    await fetchProjects();
});

async function fetchCoreSkills() {
    try {
        let cachedString = sessionStorage.getItem('cachedSkills');
        if (cachedString) {
            coreSkills = JSON.parse(cachedString);
            renderCoreSkills();
        }
        const res = await fetch('/api/homepage/skills?t=' + Date.now());
        const fetchedSkills = await res.json();
        const newString = JSON.stringify(fetchedSkills);
        if (newString !== cachedString) {
            coreSkills = fetchedSkills;
            sessionStorage.setItem('cachedSkills', newString);
            renderCoreSkills();
        }
    } catch (err) {
        console.error('Error fetching core skills:', err);
    }
}

function renderCoreSkills(skills = coreSkills) {
    const container = document.getElementById('core-skills-container');
    if (!container || !Array.isArray(skills)) return;

    let html = '';
    skills.forEach(skill => {
        html += `<span class="bg-[#F2F2F2] rounded-full font-bold uppercase flex items-center gap-2 text-[#111] transition-colors hover:bg-black hover:text-white" style="padding:clamp(8px,0.7vw,10px) clamp(14px,1.5vw,20px);font-size:clamp(10px,0.7vw,11px);letter-spacing:0.08em">
                    <div class="w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></div> ${skill}
                </span>`;
    });
    container.innerHTML = html;
}

async function fetchCategories() {
    try {
        let cachedString = sessionStorage.getItem('cachedCats');
        if (cachedString) {
            allCategories = JSON.parse(cachedString);
            renderCategories();
        }
        const res = await fetch('/api/categories?t=' + Date.now());
        const fetchedCats = await res.json();
        const newString = JSON.stringify(fetchedCats);
        if (newString !== cachedString) {
            allCategories = fetchedCats;
            sessionStorage.setItem('cachedCats', newString);
            renderCategories();
        }
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

async function fetchProjects() {
    try {
        let cachedString = sessionStorage.getItem('cachedProjects');
        if (cachedString) {
            allProjects = JSON.parse(cachedString);
            renderProjects();
        }
        const res = await fetch('/api/projects?t=' + Date.now());
        const fetchedProjects = await res.json();
        const newString = JSON.stringify(fetchedProjects);
        
        if (newString !== cachedString) {
            allProjects = fetchedProjects;
            sessionStorage.setItem('cachedProjects', newString);
            renderProjects();
        }
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}

function renderCategories() {
    const filterContainer = document.getElementById('project-categories');
    if (!filterContainer) return;

    // Keep "All Works" button (selected by default)
    let html = `<button class="bg-black border border-black text-white rounded-full font-bold uppercase tracking-widest transition-colors hover:bg-black hover:text-white" style="padding:clamp(8px,0.7vw,10px) clamp(14px,1.5vw,20px);font-size:clamp(10px,0.7vw,11px);" onclick="filterProjects('all', this)">All Works</button>`;
    
    allCategories.forEach(cat => {
        html += `<button class="bg-transparent border border-[#111] rounded-full font-bold uppercase tracking-widest text-[#111] transition-colors hover:bg-black hover:text-white" style="padding:clamp(8px,0.7vw,10px) clamp(14px,1.5vw,20px);font-size:clamp(10px,0.7vw,11px);" onclick="filterProjects('${cat.id}', this)">${cat.name}</button>`;
    });

    filterContainer.innerHTML = html;
}

function filterProjects(categoryId, btn) {
    // Update active button styles
    const buttons = document.querySelectorAll('#project-categories button');
    buttons.forEach(b => {
        b.classList.remove('bg-black', 'text-white', 'border-black');
        b.classList.add('bg-transparent', 'text-[#111]', 'border-[#111]');
    });
    btn.classList.remove('bg-transparent', 'text-[#111]', 'border-[#111]');
    btn.classList.add('bg-black', 'text-white', 'border-black');

    let url = '/api/projects?t=' + Date.now();
    if (categoryId !== 'all') {
        url += '&category=' + categoryId;
    }
    
    fetch(url)
        .then(res => res.json())
        .then(projects => {
            renderProjects(projects);
        })
        .catch(err => console.error('Error fetching filtered projects:', err));
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

    // Helper to get optimized thumbnail
    const getOptThumb = (url) => {
        if (!url || !url.includes('cloudinary.com')) return url;
        return url.replace('/upload/', '/upload/w_1200,q_auto,f_auto/');
    };

    grid.innerHTML = published.map((p, index) => {
        const cats = p.categoryIds ? p.categoryIds.map(id => {
            const c = allCategories.find(cat => (cat.id === id || cat._id === id));
            return c ? c.name : '';
        }).filter(n => n).join(' & ') : 'Project';

        const isFeatured = index === 0;
        const gridClasses = isFeatured ? 'md:col-span-2 md:row-span-2' : 'md:col-span-1 md:row-span-1';
        const aspectClasses = isFeatured ? 'aspect-[3/2.2] md:aspect-[3/2.2] h-full' : 'aspect-[3/2.2]';
        
        // Calculate stagger delay based on index
        const delay = (index % 10) * 100;

        return `
            <a href="project.html?id=${p.id}" class="group block relative overflow-hidden rounded-[24px] bg-[#F9F9F9] border border-[#F2F2F2] transition-all duration-500 hover:shadow-2xl hover:shadow-black/5 ${gridClasses}" style="transform: translateZ(0); opacity: 0; animation: fadeUpReveal 0.6s ease-out ${delay}ms forwards;">
                <div class="overflow-hidden relative w-full h-full ${aspectClasses}">
                    ${p.coverImage 
                        ? `<img src="${getOptThumb(p.coverImage)}" 
                             alt="${p.title}" 
                             loading="lazy"
                             class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                             style="transform: scale(${p.coverImageZoom || 1}) translate(${(p.coverImageX === 50 || !p.coverImageX) ? 0 : p.coverImageX}px, ${(p.coverImageY === 50 || !p.coverImageY) ? 0 : p.coverImageY}px); transform-origin: center center;">`
                        : `<div class="w-full h-full bg-[#EEE] flex items-center justify-center text-[#AAA] font-medium uppercase tracking-widest text-[10px]">No Cover</div>`
                    }
                    ${p.cardOverlay ? `<div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>` : ''}
                    
                    <!-- Hover Overlay Text Stack -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 md:p-8 z-10">
                        <div class="translate-y-4 group-hover:translate-y-0 transition-transform duration-500 flex flex-col gap-1">
                            <h3 class="text-[20px] font-bold tracking-tight text-white">${p.title}</h3>
                        </div>
                    </div>
                </div>
                


                ${p.cardBanner ? `
                    <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-cover bg-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-1.5 group-hover:translate-y-0" 
                         style="background-image: url('${p.cardBanner}');"></div>
                ` : ''}
            </a>
        `;
    }).join('');
}
