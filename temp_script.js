
        let currentProjectId = null;
        let allCategories = [];
        let allProjects = [];
        let coreSkills = [];

        // ———— Auth check ————
        (async () => {
            const res = await fetch('/api/auth-check');
            const data = await res.json();
            if (!data.loggedIn) window.location.href = '/admin/login.html';
            else loadAll();
        })();

        async function logout() {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/admin/login.html';
        }

        // ———— Workspace Navigation ————
        function showPage(name, el) {
            const pages = document.querySelectorAll('.page');
            const railItems = document.querySelectorAll('.rail-item');
            
            pages.forEach(p => p.classList.remove('active'));
            railItems.forEach(n => n.classList.remove('active'));
            
            const targetPage = document.getElementById('page-' + name);
            if (targetPage) targetPage.classList.add('active');
            if (el) el.classList.add('active');
            
            const title = document.getElementById('workspace-title');
            if (name === 'editor') {
                if (title) title.textContent = 'Homepage Content';
                loadHomepageData();
            } else {
                if (name === 'overview') {
                    if (title) title.textContent = 'Overview';
                    loadCategories();
                } else if (name === 'projects') {
                    if (title) title.textContent = 'Projects';
                    loadProjects();
                } else if (name === 'settings') {
                    if (title) title.textContent = 'Settings';
                    loadSettings();
                } else {
                    if (title) title.textContent = 'Management Grid';
                }
            }
            updateStats();
        }

        function focusStageSection(sectionId) {
            const iframe = document.getElementById('visual-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ source: 'cms-dashboard', action: 'scroll-to-section', id: sectionId }, '*');
            }
            document.querySelectorAll('.layer-item').forEach(item => {
                item.classList.toggle('active', item.getAttribute('onclick').includes(sectionId));
            });
        }

        async function publishChanges(e) {
            const btn = e.target;
            const originalText = btn.textContent;
            btn.textContent = 'Publishing...';
            btn.disabled = true;

            try {
                // Request current HTML from iframe
                const iframe = document.getElementById('visual-iframe');
                iframe.contentWindow.postMessage({ source: 'cms-dashboard', action: 'get-html' }, '*');
                
                // The actual fetch is handled in the message listener when 'html-response' arrives
            } catch (err) {
                showToast('Publishing Error', true);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        function showToast(msg, isError=false) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.style.background = isError ? 'var(--danger)' : 'var(--success)';
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }
        // ---------- AUTH & STORAGE SAFEGUARD ----------
        function hasSession() {
            try {
                return document.cookie.split(';')
                    .some(c => c.trim().startsWith('connect.sid='));
            } catch (e) { return false; }
        }

        // ---------- ADD CATEGORY ----------
        async function addCategory() {
            const input = document.getElementById('catName');
            const name = input ? input.value.trim() : '';
            if (!name) {
                showToast('Enter a category name', true);
                return;
            }
            if (!hasSession()) {
                showToast('Session expired – please log in again', true);
                return;
            }
            try {
                const res = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(`Category “${name}” added`);
                    input.value = '';
                    loadCategories();
                } else {
                    throw new Error(data.error || 'Add failed');
                }
            } catch (e) {
                console.error(e);
                showToast(e.message, true);
            }
        }

        async function loadAll() {
            await loadCoreSkills();
            await loadCategories();
            await loadProjects();
            updateStats();
        }

        async function loadCategories() {
            const res = await fetch('/api/categories?t=' + Date.now());
            allCategories = await res.json();
            renderCategories();
            populateCategorySelect();
            renderCategoryFilters();
        }

        async function loadProjects() {
            const res = await fetch('/api/projects?all=true&t=' + Date.now());
            allProjects = await res.json();
            renderProjects();
        }

        function updateStats() {
            document.getElementById('stat-projs').textContent = allProjects.length;
            document.getElementById('stat-cats').textContent = allCategories.length;
        }
        
        async function loadCoreSkills() {
            try {
                const res = await fetch('/api/homepage/skills?t=' + Date.now());
                coreSkills = await res.json();
                renderCoreSkills();
            } catch(err) {
                console.error(err);
            }
        }
        
        let editingSkillIdx = -1;
        async function saveEditSkill(idx) {
            const newName = document.getElementById(`edit-skill-${idx}`).value.trim();
            if(!newName) return;
            coreSkills[idx] = newName;
            editingSkillIdx = -1;
            await saveCoreSkills();
        }

        function renderCoreSkills() {
            const list = document.getElementById('coreSkillsList');
            if(!list) return;
            list.innerHTML = coreSkills.map((skill, idx) => `
                <div class="item-row" draggable="true"
                     ondragstart="handleSkillDragStart(event, ${idx})"
                     ondragover="handleSkillDragOver(event)"
                     ondragleave="handleSkillDragLeave(event)"
                     ondrop="handleSkillDrop(event, ${idx})"
                     style="cursor: grab;">
                    ${editingSkillIdx === idx ? `
                        <input type="text" id="edit-skill-${idx}" value="${skill}" style="flex:1; margin-right:10px; font-size:12px; padding:4px;">
                    ` : `
                        <span style="font-size:0.75rem; font-weight:600; flex:1;">${skill}</span>
                    `}
                    <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                        ${editingSkillIdx === idx ? `
                            <button class="btn-primary" onclick="saveEditSkill(${idx})" style="padding:0.4rem 0.6rem;">Apply</button>
                        ` : `
                            <button class="btn-sm" onclick="editingSkillIdx = ${idx}; renderCoreSkills();" title="Edit" style="padding:0.4rem 0.6rem; display:inline-flex; align-items:center; justify-content:center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        `}
                        <button class="btn-danger" onclick="deleteCoreSkill(${idx})" title="Delete" style="padding:0.4rem 0.6rem; display:inline-flex; align-items:center; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        async function addOverviewCoreSkill() {
            const input = document.getElementById('skillName');
            const name = input ? input.value.trim() : '';
            if(!name) {
                showToast('Enter a skill name', true);
                return;
            }
            coreSkills.push(name);
            input.value = '';
            await saveCoreSkills();
        }
        
        async function deleteCoreSkill(idx) {
            if(confirm('Delete this core skill?')) {
                coreSkills.splice(idx, 1);
                await saveCoreSkills();
            }
        }
        
        async function saveCoreSkills() {
            try {
                const res = await fetch('/api/homepage/skills', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ skills: coreSkills })
                });
                if(res.ok) {
                    renderCoreSkills();
                    showToast('Core Skills updated');
                }
            } catch (err) {
                showToast('Error saving core skills', true);
            }
        }

        let editingCatId = null;
        async function saveEditCategory(id) {
            const newName = document.getElementById(`edit-cat-${id}`).value.trim();
            if(!newName) return;
            try {
                const res = await fetch('/api/categories/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: newName })
                });
                if(res.ok) {
                    editingCatId = null;
                    await loadCategories();
                }
            } catch(e) {
                showToast('Error saving category', true);
            }
        }

        function renderCategories() {
            const list = document.getElementById('catList');
            list.innerHTML = allCategories.map(c => `
                <div class="item-row" draggable="true" 
                     ondragstart="handleCatDragStart(event, '${c.id}')" 
                     ondragover="handleCatDragOver(event)" 
                     ondragleave="handleCatDragLeave(event)"
                     ondrop="handleCatDrop(event, '${c.id}')"
                     style="cursor: grab;">
                    ${editingCatId === c.id ? `
                        <input type="text" id="edit-cat-${c.id}" value="${c.name}" style="flex:1; margin-right:10px; font-size:12px; padding:4px;">
                    ` : `
                        <div style="flex:1;">
                            <div class="item-name">${c.name}</div>
                        </div>
                    `}
                    <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                        ${editingCatId === c.id ? `
                            <button class="btn-primary" onclick="saveEditCategory('${c.id}')" style="padding:0.4rem 0.6rem;">Apply</button>
                        ` : `
                            <button class="btn-sm" onclick="editingCatId = '${c.id}'; renderCategories();" title="Edit" style="padding:0.4rem 0.6rem; display:inline-flex; align-items:center; justify-content:center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        `}
                        <button class="btn-danger" onclick="deleteCategory('${c.id}')" title="Delete" style="padding:0.4rem 0.6rem; display:inline-flex; align-items:center; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>`).join('');
        }

        function populateCategorySelect() {
            const optionsContainer = document.getElementById('dropdownOptions');
            optionsContainer.innerHTML = allCategories.map(c => `
                <div class="custom-dropdown-option" onclick="addCategoryToProject('${c.id}', '${c.name.replace(/'/g, "\\'")}')">
                    ${c.name}
                </div>
            `).join('');
        }

        function toggleCustomDropdown() {
            document.getElementById('dropdownOptions').classList.toggle('show');
        }

        let selectedProjCategories = [];
        function addCategoryToProject(id, name) {
            if (selectedProjCategories.find(c => c.id === id)) return;
            selectedProjCategories.push({ id, name });
            renderSelectedCategories();
            toggleCustomDropdown();
        }

        function removeCategoryFromProject(id) {
            selectedProjCategories = selectedProjCategories.filter(c => c.id !== id);
            renderSelectedCategories();
        }

        function renderSelectedCategories() {
            const container = document.getElementById('selectedCategories');
            container.innerHTML = selectedProjCategories.map(c => `
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:6px 14px; border-radius:50px; font-size:11px; font-weight:600; display:flex; align-items:center; gap:8px;">
                    ${c.name}
                    <span class="btn-close" onclick="removeCategoryFromProject('${c.id}')" style="width: 20px; height: 20px; min-width: 20px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>
                </div>
            `).join('');
        }

        async function addCategory() {
            const name = document.getElementById('catName').value.trim();
            if (!name) return;
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                document.getElementById('catName').value = '';
                loadCategories();
            }
        }

        async function deleteCategory(id) {
            if (!confirm('Delete?')) return;
            await fetch('/api/categories/' + id, { method: 'DELETE' });
            loadCategories();
        }

        function getCatNames(ids) {
            if (!ids || !ids.length) return 'Uncategorized';
            return ids.map(id => {
                const c = allCategories.find(cat => cat.id === id);
                return c ? c.name : 'Unknown';
            }).join(', ');
        }

        let currentProjectFilter = 'all';

        function renderCategoryFilters() {
            const container = document.getElementById('projectCategoryFilters');
            if (!container) return;
            let html = `<button class="btn-sm ${currentProjectFilter === 'all' ? 'active' : ''}" onclick="filterProjectsByCategory('all')" style="white-space: nowrap; border-radius: 100px; font-size: 11px; padding: 0.3rem 0.8rem; background: ${currentProjectFilter === 'all' ? 'var(--accent)' : 'transparent'}; color: ${currentProjectFilter === 'all' ? '#000' : 'var(--muted)'}; border: 1px solid ${currentProjectFilter === 'all' ? 'var(--accent)' : 'var(--border)'};">All Projects</button>`;
            
            allCategories.forEach(cat => {
                const isActive = currentProjectFilter === cat.id;
                html += `<button class="btn-sm ${isActive ? 'active' : ''}" onclick="filterProjectsByCategory('${cat.id}')" style="white-space: nowrap; border-radius: 100px; font-size: 11px; padding: 0.3rem 0.8rem; background: ${isActive ? 'var(--accent)' : 'transparent'}; color: ${isActive ? '#000' : 'var(--muted)'}; border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};">${cat.name}</button>`;
            });
            container.innerHTML = html;
        }

        async function filterProjectsByCategory(catId) {
            currentProjectFilter = catId;
            renderCategoryFilters();
            
            try {
                let url = '/api/projects?all=true&t=' + Date.now();
                if (catId !== 'all') {
                    url += '&category=' + catId;
                }
                const res = await fetch(url);
                allProjects = await res.json();
                renderProjects();
            } catch (err) {
                console.error(err);
            }
        }

        function getOptThumb(url, size = 40) {
            if (!url || !url.includes('cloudinary.com')) return url;
            return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`);
        }

        function renderProjects() {
            const list = document.getElementById('projList');
            let displayProjects = [...allProjects];

            list.innerHTML = displayProjects.map(p => `
                <div class="item-row" draggable="true" 
                     ondragstart="handleProjDragStart(event, '${p.id}')" 
                     ondragover="handleProjDragOver(event)" 
                     ondragleave="handleProjDragLeave(event)"
                     ondrop="handleProjDrop(event, '${p.id}')"
                     style="cursor: grab; display:flex; align-items:center; justify-content:space-between; padding:0.5rem 1rem; border-bottom:1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap:1rem; flex:1; min-width:0;">
                        ${p.coverImage ? `<img src="${getOptThumb(p.coverImage)}" loading="lazy" class="item-thumb" style="width:40px; height:40px; object-fit:cover; border-radius:4px; flex-shrink:0;">` : `<div class="item-thumb" style="width:40px; height:40px; background:#222; border-radius:4px; flex-shrink:0;"></div>`}
                        <div style="min-width:0; overflow:hidden;">
                            <div class="item-name" style="font-size:0.9rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title}</div>
                            <div class="item-meta" style="font-size:0.75rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${getCatNames(p.categoryIds)}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.5rem; align-items: center;">
                        <div style="display:flex; align-items:center; gap:0.5rem; justify-content:center; margin-right: 0.5rem;">
                            <button onclick="toggleProjectStatus('${p.id}', ${p.status !== 'published'})" class="btn-sm" style="font-size:9px; font-weight:bold; padding:0.4rem 0.2rem; color: ${p.status === 'published' ? '#4CAF50' : '#888'}; background: transparent; border: 1px solid ${p.status === 'published' ? 'rgba(76,175,80,0.3)' : 'rgba(136,136,136,0.3)'}; border-radius: 6px; cursor: pointer; display: inline-flex; justify-content: center; width: 44px; text-transform: uppercase;">
                                ${p.status === 'published' ? 'LIVE' : 'DRFT'}
                            </button>
                        </div>
                        <button class="btn-sm" onclick="openBlockModal('${p.id}','${p.title.replace(/'/g,"\\'")}')" title="Edit Blocks" style="padding:0.4rem 0.6rem; display:inline-flex; align-items:center; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="btn-danger" onclick="deleteProject('${p.id}')" title="Delete" style="padding:0.4rem 0.6rem; display:inline-flex; align-items:center; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>`).join('');
        }
        
        async function toggleProjectStatus(id, isPublished) {
            try {
                const res = await fetch('/api/projects/' + id, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ status: isPublished ? 'published' : 'draft' })
                });
                if(res.ok) {
                    showToast('Project status updated');
                    await loadProjects();
                } else {
                    showToast('Error updating status', true);
                    await loadProjects(); // revert visually
                }
            } catch(e) {
                showToast('Error updating status', true);
                await loadProjects();
            }
        }

        let selectedGalleryFiles = [];

        // ———— New Project Cover Upload ————
        function handleNewCoverUpload(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('coverPreviewImg');
                img.src = e.target.result;
                img.style.display = 'block';
                coverImageX = 0;
                coverImageY = 0;
                document.getElementById('coverZoomSlider').value = 1;
                updateCoverTransform();
            };
            reader.readAsDataURL(file);
        }

        // ———— New Project Preview Text ————
        function updateNewProjectPreview() {
            const title = document.getElementById('projTitle').value || 'Project Title';
            const previewTitle = document.getElementById('previewTitle');
            if (previewTitle) previewTitle.textContent = title;
            const catEl = document.getElementById('previewCat');
            if (catEl && selectedProjCategories.length) {
                catEl.textContent = selectedProjCategories.map(c => c.name).join(', ').toUpperCase();
            }
        }

        function handleGalleryUpload(input) {
            const files = Array.from(input.files);
            files.forEach(file => {
                if (!selectedGalleryFiles.some(f => f.name === file.name && f.size === file.size)) {
                    selectedGalleryFiles.push(file);
                }
            });
            renderGalleryThumbnails();
            input.value = '';
        }

        function removeGalleryFile(index) {
            selectedGalleryFiles.splice(index, 1);
            renderGalleryThumbnails();
        }

        function renderGalleryThumbnails() {
            const container = document.getElementById('galleryThumbRow');
            const emptyText = document.getElementById('galleryEmptyText');
            
            const thumbnails = container.querySelectorAll('.gallery-thumb-wrapper');
            thumbnails.forEach(el => el.remove());

            if (selectedGalleryFiles.length === 0) {
                emptyText.style.display = 'block';
                return;
            }
            emptyText.style.display = 'none';

            selectedGalleryFiles.forEach((file, index) => {
                const reader = new FileReader();
                const wrapper = document.createElement('div');
                wrapper.className = 'gallery-thumb-wrapper';
                wrapper.style = 'position: relative; width: 64px; height: 64px; border-radius: 10px; border: 1px solid var(--border); overflow: hidden; background: #000; flex-shrink: 0;';

                const img = document.createElement('img');
                img.style = 'width: 100%; height: 100%; object-fit: cover;';
                
                const deleteBtn = document.createElement('div');
                deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
                deleteBtn.className = 'btn-close';
                deleteBtn.style = 'position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; min-width: 24px; z-index: 10;';
                deleteBtn.onclick = () => removeGalleryFile(index);

                wrapper.appendChild(img);
                wrapper.appendChild(deleteBtn);
                container.appendChild(wrapper);

                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        let isDraggingCover = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        let coverImageX = 0; // translation offset X in px
        let coverImageY = 0; // translation offset Y in px

        function removeCover(e) {
            if (e) e.stopPropagation();
            document.getElementById('projImage').value = '';
            const img = document.getElementById('coverPreviewImg');
            img.style.display = 'none';
            img.src = '';
            coverImageX = 0;
            coverImageY = 0;
            document.getElementById('coverZoomSlider').value = 1;
            updateCoverTransform();
        }

        function startCoverDrag(e) {
            const img = document.getElementById('coverPreviewImg');
            if (img.style.display === 'none') return;
            
            isDraggingCover = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            
            document.getElementById('coverPreviewContainer').style.cursor = 'grabbing';
            
            document.addEventListener('mousemove', dragCover);
            document.addEventListener('mouseup', stopCoverDrag);
            e.preventDefault();
        }

        function dragCover(e) {
            if (!isDraggingCover) return;
            
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            
            const zoom = parseFloat(document.getElementById('coverZoomSlider').value) || 1;
            coverImageX += dx / zoom;
            coverImageY += dy / zoom;
            
            updateCoverTransform();
        }

        function stopCoverDrag() {
            isDraggingCover = false;
            document.getElementById('coverPreviewContainer').style.cursor = 'grab';
            document.removeEventListener('mousemove', dragCover);
            document.removeEventListener('mouseup', stopCoverDrag);
        }

        function updateCoverTransform() {
            const img = document.getElementById('coverPreviewImg');
            const slider = document.getElementById('coverZoomSlider');
            const zoomVal = document.getElementById('coverZoomVal');
            
            const zoom = parseFloat(slider.value) || 1;
            zoomVal.textContent = zoom.toFixed(1) + 'x';
            
            img.style.transform = `scale(${zoom}) translate(${coverImageX}px, ${coverImageY}px)`;
        }

        async function addProject(status = 'draft') {
            const title = document.getElementById('projTitle').value.trim();
            const categoryIds = selectedProjCategories.map(c => c.id);
            const coverFile = document.getElementById('projImage').files[0];

            if (!title) {
                showToast('Please enter a project title', true);
                return;
            }


            const fd = new FormData();
            fd.append('title', title);
            categoryIds.forEach(id => fd.append('categoryIds', id));
            if (coverFile) fd.append('coverImage', coverFile);
            
            // Repositioning & Zoom parameters
            fd.append('coverImageZoom', document.getElementById('coverZoomSlider').value);
            fd.append('coverImageX', coverImageX);
            fd.append('coverImageY', coverImageY);
            
            fd.append('status', status);

            selectedGalleryFiles.forEach(file => {
                fd.append('galleryImages', file);
            });

            const res = await fetch('/api/projects', { method: 'POST', body: fd });
            if (res.ok) {
                showToast(`Project successfully saved as ${status}!`);
                document.getElementById('projTitle').value = '';
                selectedProjCategories = [];
                renderSelectedCategories();
                selectedGalleryFiles = [];
                renderGalleryThumbnails();
                removeCover(null);
                loadProjects();
            } else {
                const errData = await res.json();
                showToast(errData.error || 'Failed to create project', true);
            }
        }

        async function deleteProject(id) {
            if (!confirm('Delete project?')) return;
            const originalProjects = [...allProjects];
            allProjects = allProjects.filter(p => p.id !== id);
            renderProjects();
            showToast('Deleting project...', false, true);
            try {
                const res = await fetch('/api/projects/' + id, { method: 'DELETE' });
                if (!res.ok) throw new Error('Delete failed');
                showToast('Project deleted successfully!');
                loadProjects();
            } catch (err) {
                allProjects = originalProjects;
                renderProjects();
                showToast('Failed to delete project.', true);
            }
        }
        let modalSelectedCategories = [];
        let modalGalleryFiles = [];
        let isDraggingModalCover = false;
        let modalLastMouseX = 0, modalLastMouseY = 0;
        let modalCoverX = 0, modalCoverY = 0;
        let modalCurrentProject = null;

        async function openBlockModal(projectId, title) {
            currentProjectId = projectId;
            showPage('block-editor');
            
            modalSelectedBlockId = null;
            modalSelectedCategories = [];
            modalGalleryFiles = [];
            modalCoverX = 0;
            modalCoverY = 0;
            
            const res = await fetch('/api/projects/' + projectId);
            modalCurrentProject = await res.json();
            
            // Auto-convert gallery to blocks if blocks array is empty
            if (!modalCurrentProject.blocks || modalCurrentProject.blocks.length === 0) {
                if (modalCurrentProject.images && modalCurrentProject.images.length > 0) {
                    modalCurrentProject.blocks = modalCurrentProject.images.map((imgUrl, i) => ({
                        id: 'block_' + Date.now() + '_' + i,
                        type: 'image',
                        content: imgUrl,
                        order: i
                    }));
                    // Save to backend immediately
                    await fetch('/api/projects/' + projectId + '/blocks-bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ blocks: modalCurrentProject.blocks })
                    });
                }
            }
            
            document.getElementById('modalProjTitleEdit').value = modalCurrentProject.title || '';
            
            // Setup Categories
            modalSelectedCategories = (modalCurrentProject.categoryIds || []).map(id => {
                const c = allCategories.find(cat => cat.id === id);
                return { id, name: c ? c.name : 'Unknown' };
            });
            renderModalSelectedCategories();
            populateModalCategorySelect();
            updateModalPreviewText();
            
            // Setup Cover Image
            const coverImg = document.getElementById('modalCoverPreviewImg');
            if (modalCurrentProject.coverImage) {
                coverImg.src = modalCurrentProject.coverImage;
                coverImg.style.display = 'block';
                modalCoverX = modalCurrentProject.coverImageX || 0;
                modalCoverY = modalCurrentProject.coverImageY || 0;
                document.getElementById('modalCoverZoomSlider').value = modalCurrentProject.coverImageZoom || 1;
            } else {
                coverImg.style.display = 'none';
                coverImg.src = '';
                document.getElementById('modalCoverZoomSlider').value = 1;
            }
            updateModalCoverTransform();
            
            loadBlocks();
        }

        function closeBlockModal() {
            showPage('projects');
            currentProjectId = null;
            modalCurrentProject = null;
        }

        // --- Category Logic for Modal ---
        function toggleModalCustomDropdown() {
            document.getElementById('modalDropdownOptions').classList.toggle('show');
        }
        function populateModalCategorySelect() {
            const optionsContainer = document.getElementById('modalDropdownOptions');
            optionsContainer.innerHTML = allCategories.map(c => `
                <div class="custom-dropdown-option" onclick="addCategoryToModalProject('${c.id}', '${c.name.replace(/'/g, "\\'")}')">
                    ${c.name}
                </div>
            `).join('');
        }
        function addCategoryToModalProject(id, name) {
            if (modalSelectedCategories.find(c => c.id === id)) return;
            modalSelectedCategories.push({ id, name });
            renderModalSelectedCategories();
            toggleModalCustomDropdown();
            updateModalPreviewText();
        }
        function removeCategoryFromModalProject(id) {
            modalSelectedCategories = modalSelectedCategories.filter(c => c.id !== id);
            renderModalSelectedCategories();
            updateModalPreviewText();
        }
        function renderModalSelectedCategories() {
            const container = document.getElementById('modalSelectedCategories');
            container.innerHTML = modalSelectedCategories.map(c => `
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:6px 14px; border-radius:50px; font-size:11px; font-weight:600; display:flex; align-items:center; gap:8px;">
                    ${c.name}
                    <span class="btn-close" onclick="removeCategoryFromModalProject('${c.id}')" style="width: 20px; height: 20px; min-width: 20px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>
                </div>
            `).join('');
        }
        
        function updateModalPreviewText() {
            const title = document.getElementById('modalProjTitleEdit').value || 'Project Title';
            document.getElementById('modalPreviewTitle').textContent = title;
            const catNames = modalSelectedCategories.length ? modalSelectedCategories.map(c => c.name).join(', ') : 'CATEGORY';
            document.getElementById('modalPreviewCat').textContent = catNames.toUpperCase();
        }

        // --- Live Preview Rendering ---
        function renderLivePreview() {
            try {
                console.log("renderLivePreview started", modalCurrentProject);
                const container = document.getElementById('livePreviewBlocks');
                container.innerHTML = `<div style="color:red; padding:20px;">DEBUG: blocks length is ${modalCurrentProject.blocks ? modalCurrentProject.blocks.length : 'undefined'}</div>`;
                if (!modalCurrentProject) return;
                
                const sortedBlocks = [...(modalCurrentProject.blocks || [])].sort((a,b) => a.order - b.order);
                console.log("sortedBlocks", sortedBlocks);
            
            if (sortedBlocks.length === 0) {
                container.innerHTML = `<div style="color:red; padding:20px; text-align:center;">DEBUG: blocks array is empty!</div>`;
            } else {
                container.innerHTML = sortedBlocks.map(b => {
                    const isSelected = modalSelectedBlockId === (b._id || b.id);
                    const blockId = b._id || b.id;
                    
                    let leftContent = '';
                    let middleContent = '';
                    let rightContent = '';
                    
                    const deleteBtn = `
                        <button class="btn-danger" onclick="event.stopPropagation(); deleteBlock('${blockId}')" title="Delete" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>`;
                        
                    const duplicateBtn = `
                        <button class="btn-sm" onclick="event.stopPropagation(); duplicateBlock('${blockId}')" title="Duplicate" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--border); border-radius: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>`;

                    if (b.type === 'image' || b.type === 'video' || b.type === 'media') {
                        const blockContent = b.content || b.url || '';
                        const filename = blockContent.split('/').pop() || 'media_file';
                        const isVid = blockContent.match(/\.(mp4|webm)$/i) || b.type === 'video';
                        
                        leftContent = `
                            <div style="width: 40px; height: 40px; border-radius: 6px; overflow: hidden; background: #000; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                ${isVid ? `<video src="${blockContent}" style="width: 100%; height: 100%; object-fit: cover;"></video>` : `<img src="${getOptThumb(blockContent)}" style="width: 100%; height: 100%; object-fit: cover;">`}
                            </div>
                            <span style="font-size: 13px; color: #fff; margin-left: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${filename}</span>
                        `;
                        
                        const replaceBtn = `
                            <button class="btn-sm" onclick="event.stopPropagation(); replaceMediaBlock('${blockId}')" title="Replace Media" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--border); border-radius: 6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </button>`;
                            
                        rightContent = `<div style="display: flex; gap: 8px;">${replaceBtn}${duplicateBtn}${deleteBtn}</div>`;
                        
                    } else if (b.type === 'text') {
                        leftContent = `
                            <div style="width: 40px; height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: serif; font-size: 18px; color: #fff;">T</div>
                        `;
                        
                        middleContent = `
                            <textarea oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'; debounceSaveText('${blockId}', this.value)" style="flex: 1; margin: 0 16px; background: transparent; border: none; color: #fff; font-size: 13px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; resize: none; overflow: hidden; outline: none; text-align: center;" placeholder="Type your text here...">${b.content || ''}</textarea>
                        `;
                        
                        rightContent = `<div style="display: flex; gap: 8px;">${duplicateBtn}${deleteBtn}</div>`;
                        
                    } else if (b.type === 'spacing') {
                        leftContent = `
                            <div style="width: 40px; height: 40px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); background: rgba(255,255,255,0.02); flex-shrink: 0;"></div>
                            <span style="font-size: 13px; color: #fff; margin-left: 12px;">Space</span>
                        `;
                        rightContent = `<div style="display: flex; gap: 8px;">${duplicateBtn}${deleteBtn}</div>`;
                        
                    } else if (b.type === 'divider') {
                        leftContent = `
                            <div style="width: 40px; height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                <div style="width: 20px; height: 2px; background: rgba(255,255,255,0.6);"></div>
                            </div>
                            <span style="font-size: 13px; color: #fff; margin-left: 12px;">Line</span>
                        `;
                        rightContent = `<div style="display: flex; gap: 8px;">${duplicateBtn}${deleteBtn}</div>`;
                    }

                    return `
                        <div id="block-row-${blockId}" draggable="true" ondragstart="handleBlockDragStart(event, '${blockId}')" ondragend="handleBlockDragEnd(event)" ondragover="handleBlockDragOver(event)" ondragleave="handleBlockDragLeave(event)" ondrop="handleBlockDrop(event, '${blockId}')" onclick="selectBlock('${blockId}')" style="cursor: grab; width: 100%; background: var(--input-bg); border-radius: 12px; border: 1px solid var(--border); padding: 0.8rem 1rem; display: flex; align-items: center; justify-content: space-between; transition: border-color 0.2s, opacity 0.2s;">
                            <div style="display: flex; align-items: center; flex: ${b.type === 'text' ? '0' : '1'};">
                                ${leftContent}
                            </div>
                            ${middleContent}
                            <div style="display: flex; align-items: center;">
                                ${rightContent}
                            </div>
                        </div>
                    `;
                }).join('');
            }
            
            setTimeout(() => {
                const textareas = container.querySelectorAll('textarea');
                textareas.forEach(t => {
                    t.style.height = '';
                    t.style.height = t.scrollHeight + 'px';
                });
            }, 10);
            } catch (err) {
                console.error("RENDER ERROR:", err);
                alert("Render error: " + err.message);
            }
        }

        // --- Helper functions for new logic ---
        
        function duplicateBlock(id) {
            const blocks = modalCurrentProject.blocks || [];
            const idx = blocks.findIndex(b => (b._id || b.id) === id);
            if (idx === -1) return;
            const original = blocks[idx];
            const duplicate = { ...original, id: 'block_' + Date.now(), _id: undefined };
            blocks.splice(idx + 1, 0, duplicate);
            blocks.forEach((b, i) => b.order = i);
            modalCurrentProject.blocks = blocks;
            renderLivePreview();
            saveProjectModal('draft');
        }

        let replaceBlockTargetId = null;
        function replaceMediaBlock(id) {
            replaceBlockTargetId = id;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/*';
            input.onchange = async (e) => {
                if (!e.target.files.length) return;
                const file = e.target.files[0];
                const fd = new FormData();
                fd.append('file', file);
                
                const blockRow = document.getElementById('block-row-' + id);
                if (blockRow) blockRow.style.opacity = '0.5';
                showToast('Uploading replacement media...');
                
                try {
                    const uploadRes = await fetch('/api/upload-media', { method: 'POST', body: fd });
                    if (!uploadRes.ok) throw new Error('Upload failed');
                    const uploadData = await uploadRes.json();
                    
                    const patchRes = await fetch('/api/projects/' + currentProjectId + '/blocks/' + id, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: uploadData.url })
                    });
                    
                    if (!patchRes.ok) throw new Error('Failed to update block data');
                    
                    const targetBlock = (modalCurrentProject.blocks || []).find(b => (b._id || b.id) === id);
                    if (targetBlock) {
                        targetBlock.url = uploadData.url;
                        targetBlock.content = uploadData.url;
                    }
                    
                    renderLivePreview();
                    showToast('Image replaced successfully');
                } catch (err) {
                    console.error(err);
                    if (blockRow) blockRow.style.opacity = '1';
                    showToast('Failed to replace media.', true);
                }
            };
            input.click();
        }

        let debounceTextTimeout;
        function debounceSaveText(id, value) {
            clearTimeout(debounceTextTimeout);
            debounceTextTimeout = setTimeout(async () => {
                const block = (modalCurrentProject.blocks || []).find(b => (b._id || b.id) === id);
                if (block) {
                    block.content = value;
                    await fetch('/api/projects/' + currentProjectId + '/blocks-bulk', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ blocks: modalCurrentProject.blocks })
                    });
                }
            }, 500);
        }

        let draggedBlockId = null;
        function handleBlockDragStart(e, id) {
            draggedBlockId = id;
            e.dataTransfer.effectAllowed = 'move';
            e.target.style.opacity = '0.5';
        }
        function handleBlockDragEnd(e) {
            e.target.style.opacity = '1';
        }
        function handleBlockDragOver(e) {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--primary)';
        }
        function handleBlockDragLeave(e) {
            e.currentTarget.style.borderColor = 'transparent';
        }
        async function handleBlockDrop(e, targetId) {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'transparent';
            if (!draggedBlockId || draggedBlockId === targetId) return;

            const blocks = [...(modalCurrentProject.blocks || [])].sort((a,b) => a.order - b.order);
            const draggedIdx = blocks.findIndex(b => (b._id || b.id) === draggedBlockId);
            const targetIdx = blocks.findIndex(b => (b._id || b.id) === targetId);

            if (draggedIdx > -1 && targetIdx > -1) {
                const [draggedItem] = blocks.splice(draggedIdx, 1);
                blocks.splice(targetIdx, 0, draggedItem);
                
                blocks.forEach((b, i) => b.order = i);
                modalCurrentProject.blocks = blocks;
                renderLivePreview();

                await fetch('/api/projects/' + currentProjectId + '/blocks-bulk', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blocks: modalCurrentProject.blocks })
                });
            }
        }

        function openWebsitePreview() {
            if (modalCurrentProject && (modalCurrentProject.id || modalCurrentProject._id)) {
                window.open('/project.html?id=' + (modalCurrentProject.id || modalCurrentProject._id), '_blank');
            } else {
                showToast('Save project first to preview', true);
            }
        }

        // --- Modal Gallery Logic ---
        function handleModalGalleryUpload(input) {
            const files = Array.from(input.files);
            modalGalleryFiles = modalGalleryFiles.concat(files);
            renderModalGalleryThumbnails();
            input.value = '';
        }
        function removeModalGalleryFile(index, isExisting) {
            if (isExisting) {
                if (!modalCurrentProject.gallery) return;
                modalCurrentProject.gallery.splice(index, 1);
            } else {
                modalGalleryFiles.splice(index, 1);
            }
            renderModalGalleryThumbnails();
        }
        function renderModalGalleryThumbnails() {
            const row = document.getElementById('modalGalleryThumbRow');
            const emptyText = document.getElementById('modalGalleryEmptyText');
            
            row.innerHTML = '';
            
            const existingUrls = modalCurrentProject.gallery || [];
            
            if (modalGalleryFiles.length === 0 && existingUrls.length === 0) {
                row.appendChild(emptyText);
                emptyText.style.display = 'block';
                return;
            }
            emptyText.style.display = 'none';
            
            existingUrls.forEach((url, i) => {
                const div = document.createElement('div');
                div.style.cssText = "position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);";
                div.innerHTML = `
                    <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                    <div class="btn-close" onclick="removeModalGalleryFile(${i}, true)" style="position:absolute; top:4px; right:4px; width: 24px; height: 24px; min-width: 24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>
                `;
                row.appendChild(div);
            });
            
            modalGalleryFiles.forEach((file, i) => {
                const reader = new FileReader();
                const div = document.createElement('div');
                div.style.cssText = "position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);";
                reader.onload = (e) => {
                    div.innerHTML = `
                        <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
                        <div class="btn-close" onclick="removeModalGalleryFile(${i}, false)" style="position:absolute; top:4px; right:4px; width: 24px; height: 24px; min-width: 24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>
                    `;
                };
                reader.readAsDataURL(file);
                row.appendChild(div);
            });
        }
        
        // --- Modal Cover Logic ---
        function handleModalCoverUpload(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('modalCoverPreviewImg');
                img.src = e.target.result;
                img.style.display = 'block';
                modalCoverX = 0;
                modalCoverY = 0;
                document.getElementById('modalCoverZoomSlider').value = 1;
                updateModalCoverTransform();
            };
            reader.readAsDataURL(file);
        }
        function removeModalCover(e) {
            if (e) e.stopPropagation();
            document.getElementById('modalProjImage').value = '';
            const img = document.getElementById('modalCoverPreviewImg');
            img.style.display = 'none';
            img.src = '';
            modalCoverX = 0;
            modalCoverY = 0;
            document.getElementById('modalCoverZoomSlider').value = 1;
            modalCurrentProject.coverImage = null; // Mark as removed
            updateModalCoverTransform();
        }
        function startModalCoverDrag(e) {
            const img = document.getElementById('modalCoverPreviewImg');
            if (img.style.display === 'none') return;
            isDraggingModalCover = true;
            modalLastMouseX = e.clientX;
            modalLastMouseY = e.clientY;
            document.getElementById('modalCoverPreviewContainer').style.cursor = 'grabbing';
            document.addEventListener('mousemove', dragModalCover);
            document.addEventListener('mouseup', stopModalCoverDrag);
            e.preventDefault();
        }
        function dragModalCover(e) {
            if (!isDraggingModalCover) return;
            const dx = e.clientX - modalLastMouseX;
            const dy = e.clientY - modalLastMouseY;
            modalLastMouseX = e.clientX;
            modalLastMouseY = e.clientY;
            const zoom = parseFloat(document.getElementById('modalCoverZoomSlider').value) || 1;
            modalCoverX += dx / zoom;
            modalCoverY += dy / zoom;
            updateModalCoverTransform();
        }
        function stopModalCoverDrag() {
            isDraggingModalCover = false;
            document.getElementById('modalCoverPreviewContainer').style.cursor = 'grab';
            document.removeEventListener('mousemove', dragModalCover);
            document.removeEventListener('mouseup', stopModalCoverDrag);
        }
        function updateModalCoverTransform() {
            const img = document.getElementById('modalCoverPreviewImg');
            const slider = document.getElementById('modalCoverZoomSlider');
            const zoomVal = document.getElementById('modalCoverZoomVal');
            const zoom = parseFloat(slider.value) || 1;
            zoomVal.textContent = zoom.toFixed(1) + 'x';
            img.style.transform = `scale(${zoom}) translate(${modalCoverX === 50 ? 0 : modalCoverX}px, ${modalCoverY === 50 ? 0 : modalCoverY}px)`;
            img.style.transformOrigin = 'center center';
        }

        // --- Block Logic ---
        async function loadBlocks() {
            if (!modalCurrentProject || (modalCurrentProject.id && modalCurrentProject.id !== currentProjectId) || (modalCurrentProject._id && modalCurrentProject._id !== currentProjectId)) {
                const res = await fetch('/api/projects/' + currentProjectId);
                modalCurrentProject = await res.json();
            }
            
            // If currently selected block is deleted, reset UI
            if (modalSelectedBlockId && !(modalCurrentProject.blocks || []).find(b => (b._id || b.id) === modalSelectedBlockId)) {
                modalSelectedBlockId = null;
            }
            renderLivePreview();
        }
        
        function selectBlock(id) {
            if (modalSelectedBlockId === id) return; // already selected
            modalSelectedBlockId = id;
            renderLivePreview();
        }
        
        function applyBlockInspectorChanges() {
            if (!modalSelectedBlockId) return;
            const block = (modalCurrentProject.blocks || []).find(b => (b._id || b.id) === modalSelectedBlockId);
            if (!block) return;
            
            let updates = {};
            if (block.type === 'text') {
                const el = document.getElementById('inspectorTextValue');
                updates.content = el.tagName === 'DIV' ? el.innerHTML : el.value;
            }
            
            fetch('/api/projects/' + currentProjectId + '/blocks/' + modalSelectedBlockId, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            }).then(() => {
                showToast('Block updated');
                loadBlocks();
            });
        }
        
        function renderBlockInspector() {
            const inspector = document.getElementById('blockInspector');
            
            const insertionToolbar = `
                <h4 style="margin: 0; font-size: 0.9rem; color: var(--muted); text-transform: uppercase;">Toolbox</h4>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-sm" style="flex: 1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:1.5rem; background: var(--card); border: 1px solid var(--border);" onclick="addBlock('text')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                        Text
                    </button>
                    <button class="btn-sm" style="flex: 1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:1.5rem; background: var(--card); border: 1px solid var(--border);" onclick="document.getElementById('modalBlockImageUpload').click()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        Image
                    </button>
                    <button class="btn-sm" style="flex: 1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:1.5rem; background: var(--card); border: 1px solid var(--border);" onclick="addBlock('spacing')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/><polyline points="19 5 12 5 5 5"/></svg>
                        Spacer
                    </button>
                    <button class="btn-sm" style="flex: 1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:1.5rem; background: var(--card); border: 1px solid var(--border);" onclick="addBlock('divider')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Divider
                    </button>
                </div>
                <input type="file" id="modalBlockImageUpload" multiple accept="image/*" onchange="addMediaBlocks(this)" style="display: none;">
            `;

            if (!modalSelectedBlockId) {
                inspector.innerHTML = insertionToolbar;
                return;
            }
            
            const block = (modalCurrentProject.blocks || []).find(b => (b._id || b.id) === modalSelectedBlockId);
            if (!block) {
                inspector.innerHTML = insertionToolbar;
                return;
            }
            
            if (block.type === 'text') {
                inspector.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1.2rem; background:var(--card); padding:1.5rem; border:1px solid var(--border); border-radius:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="margin:0; font-weight:600;">Edit Text Block</label>
                            <button onclick="deleteBlock('${modalSelectedBlockId}')" style="background:none; border:none; color:#FF416C; font-size:0.75rem; font-weight:600; cursor:pointer;">Delete</button>
                        </div>
                        
                        <div class="rich-text-toolbar" style="display:flex; gap:4px; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px;">
                            <button class="btn-sm" onclick="document.execCommand('bold',false,null)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Bold">B</button>
                            <button class="btn-sm" onclick="document.execCommand('italic',false,null)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Italic">I</button>
                            <button class="btn-sm" onclick="document.execCommand('underline',false,null)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Underline">U</button>
                            <div style="width:1px; background:var(--border); margin:0 4px;"></div>
                            <button class="btn-sm" onclick="document.execCommand('justifyLeft',false,null)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Align Left">L</button>
                            <button class="btn-sm" onclick="document.execCommand('justifyCenter',false,null)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Align Center">C</button>
                            <button class="btn-sm" onclick="document.execCommand('justifyRight',false,null)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Align Right">R</button>
                            <div style="width:1px; background:var(--border); margin:0 4px;"></div>
                            <button class="btn-sm" onclick="const url=prompt('Enter link URL:'); if(url) document.execCommand('createLink',false,url)" style="background:transparent; border:none; color:#fff; cursor:pointer;" title="Link">Link</button>
                        </div>
                        <div id="inspectorTextValue" contenteditable="true" style="width: 100%; min-height: 120px; font-size: 0.85rem; padding: 12px; background: var(--input-bg); border-radius: 12px; color: #fff; border: 1px solid var(--border); overflow-y: auto;">${block.content || ''}</div>
                        
                        <div style="display: flex; gap: 1rem;">
                            <button class="btn-primary" onclick="applyBlockInspectorChanges()" style="flex: 1; padding: 0.8rem 1rem; font-size: 0.85rem;">Apply Changes</button>
                        </div>
                    </div>
                    ${insertionToolbar}
                `;
            } else if (block.type === 'image') {
                inspector.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1.2rem; background:var(--card); padding:1.5rem; border:1px solid var(--border); border-radius:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="margin:0; font-weight:600;">Image Block</label>
                            <button onclick="deleteBlock('${modalSelectedBlockId}')" style="background:none; border:none; color:#FF416C; font-size:0.75rem; font-weight:600; cursor:pointer;">Delete</button>
                        </div>
                        <div style="width: 100%; aspect-ratio: 16/9; background: #111; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);">
                            <img src="${block.url || ''}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                    </div>
                    ${insertionToolbar}
                `;
            } else {
                inspector.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1.2rem; background:var(--card); padding:1.5rem; border:1px solid var(--border); border-radius:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="margin:0; font-weight:600; text-transform:capitalize;">${block.type} Block</label>
                            <button onclick="deleteBlock('${modalSelectedBlockId}')" style="background:none; border:none; color:#FF416C; font-size:0.75rem; font-weight:600; cursor:pointer;">Delete</button>
                        </div>
                    </div>
                    ${insertionToolbar}
                `;
            }
        }
        


        async function applyAllSpace() {
            if (!modalCurrentProject || !modalCurrentProject.blocks || modalCurrentProject.blocks.length === 0) return;
            
            showToast('Applying spaces between blocks...');
            let currentBlocks = [...modalCurrentProject.blocks].sort((a,b) => a.order - b.order);
            let newBlocksArray = [];
            
            for (let i = 0; i < currentBlocks.length; i++) {
                newBlocksArray.push(currentBlocks[i]);
                // If it's not the last block
                if (i < currentBlocks.length - 1) {
                    const nextBlock = currentBlocks[i+1];
                    // If current block is not a space AND next block is not a space
                    if (currentBlocks[i].type !== 'spacing' && nextBlock.type !== 'spacing') {
                        newBlocksArray.push({
                            type: 'spacing',
                            content: '50'
                        });
                    }
                }
            }
            
            // Assign new orders
            newBlocksArray.forEach((b, i) => b.order = i);
            modalCurrentProject.blocks = newBlocksArray;
            renderLivePreview();
            
            try {
                await fetch('/api/projects/' + currentProjectId + '/blocks-bulk', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blocks: modalCurrentProject.blocks })
                });
                
                // Force fetch to get real IDs for new blocks from MongoDB
                const res = await fetch('/api/projects/' + currentProjectId);
                modalCurrentProject = await res.json();
                loadBlocks();
                showToast('Spacing applied successfully!');
            } catch(e) {
                console.error(e);
                showToast('Failed to apply spacing.');
            }
        }

        async function addBlock(type) {
            const fd = new FormData();
            fd.append('type', type);
            if (type === 'text') {
                fd.append('content', 'New Text Block');
            }
            
            const req = await fetch('/api/projects/' + currentProjectId + '/blocks', { method: 'POST', body: fd });
            const newBlock = await req.json();
            
            // force fresh fetch
            const res = await fetch('/api/projects/' + currentProjectId);
            modalCurrentProject = await res.json();
            
            if (modalSelectedBlockId) {
                let blocks = [...(modalCurrentProject.blocks || [])].sort((a,b) => a.order - b.order);
                const selectedIdx = blocks.findIndex(b => (b._id || b.id) === modalSelectedBlockId);
                const newBlockIdx = blocks.findIndex(b => (b._id || b.id) === (newBlock._id || newBlock.id));
                
                if (selectedIdx !== -1 && newBlockIdx !== -1) {
                    const [draggedItem] = blocks.splice(newBlockIdx, 1);
                    blocks.splice(selectedIdx + 1, 0, draggedItem);
                    blocks.forEach((b, i) => b.order = i);
                    
                    modalCurrentProject.blocks = blocks;
                    await fetch('/api/projects/' + currentProjectId + '/blocks-bulk', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ blocks: modalCurrentProject.blocks })
                    });
                }
            }
            
            loadBlocks();
            selectBlock(newBlock._id || newBlock.id);
        }
        
        async function addMediaBlocks(input) {
            const files = Array.from(input.files);
            if (!files.length) return;
            
            showToast('Uploading ' + files.length + ' file(s)...');
            let addedBlocks = [];
            for (let f of files) {
                const fd = new FormData();
                const type = f.type.startsWith('video/') ? 'video' : 'image';
                fd.append('type', type);
                fd.append('image', f);
                const req = await fetch('/api/projects/' + currentProjectId + '/blocks', { method: 'POST', body: fd });
                addedBlocks.push(await req.json());
            }
            input.value = '';
            
            // force fresh fetch
            const res = await fetch('/api/projects/' + currentProjectId);
            modalCurrentProject = await res.json();
            
            if (modalSelectedBlockId && addedBlocks.length > 0) {
                let blocks = [...(modalCurrentProject.blocks || [])].sort((a,b) => a.order - b.order);
                const selectedIdx = blocks.findIndex(b => (b._id || b.id) === modalSelectedBlockId);
                
                if (selectedIdx !== -1) {
                    // Pull all added blocks out of their appended position
                    const newlyAddedIds = addedBlocks.map(b => b._id || b.id);
                    const pulledBlocks = blocks.filter(b => newlyAddedIds.includes(b._id || b.id));
                    blocks = blocks.filter(b => !newlyAddedIds.includes(b._id || b.id));
                    
                    // Insert them right after the selected index
                    const insertIdx = blocks.findIndex(b => (b._id || b.id) === modalSelectedBlockId) + 1;
                    blocks.splice(insertIdx, 0, ...pulledBlocks);
                    
                    blocks.forEach((b, i) => b.order = i);
                    modalCurrentProject.blocks = blocks;
                    
                    await fetch('/api/projects/' + currentProjectId + '/blocks-bulk', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ blocks: modalCurrentProject.blocks })
                    });
                }
            }
            
            loadBlocks();
            showToast('Upload complete!');
            if (addedBlocks.length > 0) selectBlock(addedBlocks[addedBlocks.length - 1]._id || addedBlocks[addedBlocks.length - 1].id);
        }

        async function deleteBlock(bid) {
            const originalBlocks = [...(modalCurrentProject.blocks || [])];
            modalCurrentProject.blocks = originalBlocks.filter(b => (b._id || b.id) !== bid);
            if (modalSelectedBlockId === bid) modalSelectedBlockId = null;
            renderLivePreview();
            if (document.getElementById('blockInspector')) renderBlockInspector();
            showToast('Deleting block...', false, true);

            try {
                const response = await fetch(`/api/projects/${currentProjectId}/blocks/${bid}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Delete failed');
                const res = await fetch('/api/projects/' + currentProjectId);
                modalCurrentProject = await res.json();
                loadBlocks();
                showToast('Block deleted successfully!');
            } catch (err) {
                modalCurrentProject.blocks = originalBlocks;
                renderLivePreview();
                showToast('Failed to delete block. Please try again.', true);
            }
        }
        
        async function saveProjectModal(status) {
            const title = document.getElementById('modalProjTitleEdit').value.trim();
            const categoryIds = modalSelectedCategories.map(c => c.id);
            const coverFile = document.getElementById('modalProjImage').files[0];
            
            if (!title) {
                showToast('Please enter a project title', true);
                return;
            }
            if (categoryIds.length === 0) {
                showToast('Please select at least one category', true);
                return;
            }
            
            const fd = new FormData();
            fd.append('title', title);
            categoryIds.forEach(id => fd.append('categoryIds', id));
            if (coverFile) fd.append('coverImage', coverFile);
            
            // if cover image was removed manually
            if (!coverFile && modalCurrentProject.coverImage === null) {
                fd.append('removeCover', 'true');
            }
            
            fd.append('coverImageZoom', document.getElementById('modalCoverZoomSlider').value);
            fd.append('coverImageX', modalCoverX);
            fd.append('coverImageY', modalCoverY);
            fd.append('status', status);
            
            // Append new gallery images
            modalGalleryFiles.forEach(file => {
                fd.append('galleryImages', file);
            });
            
            // Update existing gallery URLs list if some were deleted
            fd.append('existingGallery', JSON.stringify(modalCurrentProject.images || []));
            
            const res = await fetch('/api/projects/' + currentProjectId, { method: 'PATCH', body: fd });
            if (res.ok) {
                showToast(`Project successfully updated and saved as ${status}!`);
                closeBlockModal();
                loadProjects();
            } else {
                const errData = await res.json();
                showToast(errData.error || 'Failed to update project', true);
            }
        }

        // ———— CMS Handshake ————
        window.addEventListener('message', async (e) => {
            if (e.data.source === 'cms-engine') {
                const { action, data } = e.data;
                if (action === 'element-selected') renderInspector(data);
                if (action === 'canvas-ready') showToast('Visual Editor Connected');
            }
            if (e.data.action === 'html-response') {
                const res = await fetch('/admin/save-cms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: e.data.html })
                });
                if (res.ok) showToast('Published Successfully!');
                const publishBtn = document.getElementById('publish-changes-btn');
                if (publishBtn) {
                    publishBtn.textContent = 'Publish Changes';
                    publishBtn.disabled = false;
                }
            }
        });

        let currentSelectedData = null;
        let originalContent = '';
        let originalHref = '';

        function renderInspector(data) {
            const panel = document.getElementById('properties-panel');
            
            // Common Insertion Toolbar
            const insertionToolbar = `
                <div style="display:flex; gap:0.5rem; margin-bottom:1rem; padding-bottom:0; border-bottom:none;">
                    <button class="btn-sm" onclick="insertElement('space')" style="flex:1; padding:0.5rem; font-size:0.75rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border);" title="Add Spacing Below">+ Space</button>
                    <button class="btn-sm" onclick="insertElement('line')" style="flex:1; padding:0.5rem; font-size:0.75rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border);" title="Add Line Below">+ Line</button>
                    <button class="btn-sm" onclick="insertElement('text')" style="flex:1; padding:0.5rem; font-size:0.75rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border);" title="Add Text Below">+ Text</button>
                </div>
            `;
            
            if (!data || data.type === 'global') {
                currentSelectedData = null;
                panel.innerHTML = `
                    <div style="padding:1rem;">
                        ${insertionToolbar}
                        <div style="padding:2rem 1rem; text-align:center; color:var(--muted); font-size:0.8rem; font-weight:600;">Select an element on the stage to edit.</div>
                    </div>
                `;
                return;
            }
            
            currentSelectedData = data;
            
            if (data.type === 'banner') {
                panel.innerHTML = `
                    <div style="padding:1rem; display:flex; flex-direction:column; gap:1.2rem;">
                        ${insertionToolbar}
                        <div>
                            <label style="display:flex; justify-content:space-between; align-items:center;">
                                Selected Banner
                                ${data.bannerImage ? `<div class="btn-close" onclick="removeInspectorBanner()" style="position:static; width:24px; height:24px; min-width:24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>` : ''}
                            </label>
                            <div id="inspectorBannerPreviewContainer" style="width: 100%; height: 120px; border-radius: 12px; border: 1px solid var(--border); overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 1rem;">
                                ${data.bannerImage ? (data.bannerImage.match(/\.(mp4|webm)$/i) ? `<video src="${data.bannerImage}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>` : `<img src="${data.bannerImage}" style="width: 100%; height: 100%; object-fit: cover;">`) : `<div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Mesh Gradient</div>`}
                            </div>
                            <input type="file" id="inspectorBannerFile" accept="image/*, video/mp4, video/webm" style="display: none;" onchange="previewInspectorBanner(this)">
                            <button class="btn-sm" onclick="document.getElementById('inspectorBannerFile').click()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--border); background: var(--input-bg);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                                Upload Banner
                            </button>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <button class="btn-primary" id="inspector-apply-banner-btn" onclick="applyBannerChanges()" style="flex: 1; padding: 0.8rem 1rem; font-size: 0.85rem;">Apply Changes</button>
                        </div>
                    </div>
                `;
            } else if (data.type === 'hr') {
                panel.innerHTML = `
                    <div style="padding:1rem; display:flex; flex-direction:column; gap:1.2rem;">
                        ${insertionToolbar}
                        <div>
                            <label>Selected Separator Line</label>
                            <div style="width: 100%; height: 40px; border-radius: 12px; border: 1px dashed var(--border); background: var(--input-bg); display: flex; align-items: center; justify-content: center; margin-top:0.5rem;">

                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <button class="btn-sm" onclick="deleteElement()" style="flex: 1; padding: 0.8rem 1rem; font-size: 0.85rem; background: rgba(255,65,108,0.1); border: 1px solid rgba(255,65,108,0.3); color:#FF416C;">Delete Line</button>
                        </div>
                    </div>
                `;
            } else if (data.type === 'space') {
                panel.innerHTML = `
                    <div style="padding:1rem; display:flex; flex-direction:column; gap:1.2rem;">
                        ${insertionToolbar}
                        <div>
                            <label>Selected Spacing Block</label>
                            <div style="width: 100%; height: 60px; border-radius: 12px; border: 1px dashed rgba(255,255,255,0.2); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: center; margin-top:0.5rem;">
                                <span style="font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Blank Space</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <button class="btn-sm" onclick="deleteElement()" style="flex: 1; padding: 0.8rem 1rem; font-size: 0.85rem; background: rgba(255,65,108,0.1); border: 1px solid rgba(255,65,108,0.3); color:#FF416C;">Delete Space</button>
                        </div>
                    </div>
                `;
            } else {
                originalContent = data.content;
                originalHref = data.href || '';
                
                panel.innerHTML = `
                    <div style="padding:1rem; display:flex; flex-direction:column; gap:1.2rem;">
                        ${insertionToolbar}
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label>Selected Text Element (${data.tagName})</label>
                                <button onclick="deleteElement()" style="background:none; border:none; color:#FF416C; font-size:0.75rem; font-weight:600; cursor:pointer;">Delete Text</button>
                            </div>
                            <textarea id="inspectorTextValue" oninput="updateStageContentLive(this.value)" style="width: 100%; min-height: 120px; font-size: 0.85rem; padding: 12px; background: var(--input-bg); border-radius: 12px; color: #fff; border: 1px solid var(--border); resize: vertical; overflow-y: auto;">${data.content}</textarea>
                        </div>
                        ${data.tagName === 'A' ? `
                        <div>
                            <label>Link Destination (URL / Email / Phone)</label>
                            <input type="text" id="inspectorLinkValue" value="${data.href || ''}" style="width: 100%; font-size: 0.85rem; padding: 12px; background: var(--input-bg); border-radius: 12px; color: #fff; border: 1px solid var(--border);">
                        </div>
                        ` : ''}
                        <div>
                            <label>Font Size</label>
                            <input type="text" id="inspectorFontSize" value="${data.style.fontSize || ''}" onchange="updateStageStyle('fontSize', this.value)" style="width: 100%; font-size: 0.85rem; padding: 12px; background: var(--input-bg); border-radius: 12px; color: #fff; border: 1px solid var(--border); margin-top:0.3rem;">
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <button class="btn-primary" onclick="applyInspectorChanges()" style="flex: 1; padding: 0.8rem 1rem; font-size: 0.85rem;">Apply</button>
                            <button class="btn-sm" onclick="undoInspectorChanges()" style="padding: 0.8rem 1.2rem; font-size: 0.85rem; background: rgba(255,255,255,0.06); border: 1px solid var(--border);">Undo</button>
                        </div>
                    </div>
                `;
            }
        }

        function insertElement(type) {
            const iframe = document.getElementById('visual-iframe');
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'insert-element',
                id: currentSelectedData ? currentSelectedData.id : null,
                data: { elementType: type }
            }, '*');
            showToast('Element inserted below selection');
        }

        function deleteElement() {
            if (!currentSelectedData) return;
            const iframe = document.getElementById('visual-iframe');
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'delete-element',
                id: currentSelectedData.id
            }, '*');
            showToast('Element removed');
            renderInspector(null);
        }

        function updateStageStyle(property, value) {
            if (!currentSelectedData) return;
            const iframe = document.getElementById('visual-iframe');
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'update-style',
                id: currentSelectedData.id,
                data: { property, value }
            }, '*');
        }

        function updateStageContentLive(newContent) {
            if (!currentSelectedData) return;
            const iframe = document.getElementById('visual-iframe');
            const linkInput = document.getElementById('inspectorLinkValue');
            const newHref = linkInput ? linkInput.value : '';
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'update-content',
                id: currentSelectedData.id,
                data: { val: newContent, href: newHref }
            }, '*');
        }

        function applyInspectorChanges() {
            if (!currentSelectedData) return;
            const newContent = document.getElementById('inspectorTextValue').value;
            const linkInput = document.getElementById('inspectorLinkValue');
            const newHref = linkInput ? linkInput.value : '';
            
            originalContent = newContent;
            originalHref = newHref;
            showToast('Changes applied locally');
        }

        function undoInspectorChanges() {
            if (!currentSelectedData) return;
            // Restore original content in the stage iframe
            const iframe = document.getElementById('visual-iframe');
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'update-content',
                id: currentSelectedData.id,
                data: { val: originalContent, href: originalHref }
            }, '*');
            // Also restore textarea
            const ta = document.getElementById('inspectorTextValue');
            if (ta) ta.value = originalContent;
            showToast('Text reverted');
        }

        function undoGlobalChanges() {
            const iframe = document.getElementById('visual-iframe');
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'undo'
            }, '*');
            
            // Clear inspector since element might no longer exist or properties might have changed
            renderInspector(null);
            showToast('Reverted previous action');
        }

        // ———— Banner Inspection ————
        function removeInspectorBanner() {
            if (!currentSelectedData) return;
            const iframe = document.getElementById('visual-iframe');
            iframe.contentWindow.postMessage({
                source: 'cms-dashboard',
                action: 'update-banner',
                id: currentSelectedData.id,
                data: { val: '' }
            }, '*');
            
            showToast('Banner removed');
            currentSelectedData.bannerImage = '';
            renderInspector(currentSelectedData);
        }

        function previewInspectorBanner(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                const file = input.files[0];
                reader.onload = function(e) {
                    const container = document.getElementById('inspectorBannerPreviewContainer');
                    if (file.type.startsWith('video/')) {
                        container.innerHTML = `<video src="${e.target.result}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>`;
                    } else {
                        container.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        }

        async function applyBannerChanges() {
            if (!currentSelectedData) return;
            const fileInput = document.getElementById('inspectorBannerFile');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                alert('Please select an image file first.');
                return;
            }
            
            const btn = document.getElementById('inspector-apply-banner-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Uploading...';
            btn.disabled = true;
            
            try {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                
                const res = await fetch('/api/upload-media', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                
                if (!res.ok) throw new Error('Upload failed');
                const result = await res.json();
                
                const iframe = document.getElementById('visual-iframe');
                iframe.contentWindow.postMessage({
                    source: 'cms-dashboard',
                    action: 'update-banner',
                    id: currentSelectedData.id,
                    data: { val: result.url }
                }, '*');
                
                showToast('Banner applied locally');
                currentSelectedData.bannerImage = result.url;
                renderInspector(currentSelectedData);
            } catch (err) {
                alert('Failed to upload banner: ' + err.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // ———— Reordering ————
        let draggedProjId = null;
        function handleProjDragStart(e, id) {
            draggedProjId = id;
            e.currentTarget.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
        function handleProjDragOver(e) {
            e.preventDefault();
            const row = e.currentTarget;
            if (row.classList.contains('dragging')) return;
            row.style.border = '1px dashed var(--accent2)';
        }
        function handleProjDragLeave(e) {
            const row = e.currentTarget;
            row.style.border = '1px solid transparent';
        }
        async function handleProjDrop(e, targetId) {
            e.preventDefault();
            const row = e.currentTarget;
            row.style.border = '1px solid transparent';
            
            if (draggedProjId === targetId) return;
            const projects = [...allProjects];
            const draggedIdx = projects.findIndex(p => p.id === draggedProjId);
            const targetIdx = projects.findIndex(p => p.id === targetId);
            const [draggedItem] = projects.splice(draggedIdx, 1);
            projects.splice(targetIdx, 0, draggedItem);
            allProjects = projects;
            renderProjects();
            try {
                let url = '/api/projects/reorder';
                if (currentProjectFilter !== 'all') {
                    url = `/api/categories/${currentProjectFilter}/project-order`;
                }
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectIds: allProjects.map(p => p.id) })
                });
                if (res.ok) {
                    showToast('Project order saved');
                } else {
                    showToast('Failed to save order', true);
                }
            } catch (err) {
                showToast('Failed to save order', true);
            }
        }

        // Project View Modes
        let projectViewMode = 'list';
        function setProjectView(view) {
            projectViewMode = view;
            const list = document.getElementById('projList');
            if (view === 'grid') {
                list.className = 'compact-grid';
                document.getElementById('btn-proj-grid').classList.add('active');
                document.getElementById('btn-proj-list').classList.remove('active');
            } else {
                list.className = 'compact-list';
                document.getElementById('btn-proj-list').classList.add('active');
                document.getElementById('btn-proj-grid').classList.remove('active');
            }
        }

        // Category Reordering & View Modes
        let categoryViewMode = 'list';
        function setCategoryView(view) {
            categoryViewMode = view;
            const list = document.getElementById('catList');
            if (view === 'grid') {
                list.className = 'compact-grid';
                document.getElementById('btn-cat-grid').classList.add('active');
                document.getElementById('btn-cat-list').classList.remove('active');
            } else {
                list.className = 'compact-list';
                document.getElementById('btn-cat-list').classList.add('active');
                document.getElementById('btn-cat-grid').classList.remove('active');
            }
        }

        let draggedCatId = null;
        function handleCatDragStart(e, id) {
            draggedCatId = id;
            e.currentTarget.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
        function handleCatDragOver(e) {
            e.preventDefault();
            const row = e.currentTarget;
            if (row.classList.contains('dragging')) return;
            row.style.border = '1px dashed var(--accent2)';
        }
        function handleCatDragLeave(e) {
            const row = e.currentTarget;
            row.style.border = '1px solid transparent';
        }
        async function handleCatDrop(e, targetId) {
            e.preventDefault();
            const row = e.currentTarget;
            row.style.border = '1px solid transparent';
            
            if (draggedCatId === targetId) return;
            const categories = [...allCategories];
            const draggedIdx = categories.findIndex(c => c.id === draggedCatId);
            const targetIdx = categories.findIndex(c => c.id === targetId);
            const [draggedItem] = categories.splice(draggedIdx, 1);
            categories.splice(targetIdx, 0, draggedItem);
            allCategories = categories;
            renderCategories();
            
            try {
                const res = await fetch('/api/categories/reorder', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoryIds: allCategories.map(c => c.id) })
                });
                if (res.ok) {
                    showToast('Category order saved');
                } else {
                    showToast('Failed to save order', true);
                }
            } catch (err) {
                showToast('Failed to save order', true);
            }
        }

        async function updatePassword() {
            const currentPassword = document.getElementById('settingsCurrentPass').value;
            const newPassword = document.getElementById('settingsNewPass').value;
            const confirmPassword = document.getElementById('settingsConfirmPass').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                showToast('Please fill all password fields', true);
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast('Passwords do not match', true);
                return;
            }

            try {
                const res = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Password updated successfully');
                    document.getElementById('settingsCurrentPass').value = '';
                    document.getElementById('settingsNewPass').value = '';
                    document.getElementById('settingsConfirmPass').value = '';
                } else {
                    showToast(data.error || 'Failed to update password', true);
                }
            } catch (err) {
                showToast('Failed to update password', true);
            }
        }

        async function loadSettings() {
            try {
                const res = await fetch('/api/user-settings');
                if (res.ok) {
                    const user = await res.json();
                    document.getElementById('settingsRecoveryEmail').value = user.recoveryEmail || '';
                }
            } catch (err) {
                console.error('Failed to load user settings:', err);
            }
        }

        async function updateRecoveryEmail() {
            const recoveryEmail = document.getElementById('settingsRecoveryEmail').value.trim();
            if (!recoveryEmail) {
                showToast('Please enter a valid recovery email', true);
                return;
            }
            try {
                const res = await fetch('/api/update-recovery-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recoveryEmail })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Recovery email saved successfully');
                } else {
                    showToast(data.error || 'Failed to save recovery email', true);
                }
            } catch (err) {
                showToast('Failed to save recovery email', true);
            }
        }

        function triggerEmailReset() {
            document.getElementById('settingsNormalChange').style.display = 'none';
            document.getElementById('settingsEmailReset').style.display = 'block';
            fetch('/api/auth/forgot-password', { method: 'POST' });
            showToast('Verification OTP logged to console');
        }

        function cancelEmailReset() {
            document.getElementById('settingsNormalChange').style.display = 'block';
            document.getElementById('settingsEmailReset').style.display = 'none';
        }

        async function submitEmailReset() {
            const otp = document.getElementById('settingsResetOtp').value.trim();
            const newPassword = document.getElementById('settingsResetNewPass').value;

            if (!otp || !newPassword) {
                showToast('Please fill all fields', true);
                return;
            }

            try {
                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ otp, newPassword })
                });
                if (res.ok) {
                    showToast('Password reset successfully!');
                    cancelEmailReset();
                    document.getElementById('settingsResetOtp').value = '';
                    document.getElementById('settingsResetNewPass').value = '';
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Invalid OTP or error', true);
                }
            } catch (err) {
                showToast('Failed to reset password', true);
            }
        }
        // ———— Homepage Editor Logic ————
        let currentHomepageData = { hero: {}, coreSkills: [] };
        let activeHomepageSection = 'hero';

        async function loadHomepageData() {
            try {
                const res = await fetch('/?t=' + Date.now());
                const html = await res.text();
                const match = html.match(/window\.CMS_DATA\s*=\s*(\{.*?\});/);
                if (match && match[1]) {
                    currentHomepageData = JSON.parse(match[1]);
                }
                if (!currentHomepageData.contact) currentHomepageData.contact = { phones: [], email: '', behance: '', linkedin: '' };
                selectHomepageSection('hero'); // default
            } catch (err) {
                console.error("Error loading homepage data:", err);
            }
        }

        function selectHomepageSection(section) {
            activeHomepageSection = section;
            document.querySelectorAll('#homepage-sections-wireframe .section-card').forEach(c => {
                c.classList.remove('active');
                c.style.borderColor = 'var(--border)';
            });
            const target = document.querySelector(`#homepage-sections-wireframe .section-card[onclick="selectHomepageSection('${section}')"]`);
            if (target) {
                target.classList.add('active');
                target.style.borderColor = '#fff';
            }
            
            const titleEl = document.getElementById('inspector-title');
            const contentEl = document.getElementById('inspector-content');
            
            contentEl.innerHTML = ''; // clear

            if (section === 'hero') {
                titleEl.textContent = 'Hero Banner Settings';
                const isVideo = currentHomepageData.hero?.mediaType === 'video';
                let previewHtml = `<span style="font-size: 12px; color: var(--muted);">No media uploaded</span>`;
                if (currentHomepageData.hero?.mediaUrl) {
                    previewHtml = isVideo 
                        ? `<video src="${currentHomepageData.hero.mediaUrl}" muted autoplay loop style="width:100%; height:100%; object-fit:cover;"></video>`
                        : `<img src="${currentHomepageData.hero.mediaUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                }

                contentEl.innerHTML = `
                    <div class="form-group col" style="margin-top: 0.5rem;">
                        <label>Banner Media (Image or Video)</label>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; width: 100%;">
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <div id="hero-media-preview-box" style="width: 100%; aspect-ratio: 16/9; background: var(--input-bg); border-radius: 8px; border: 1px dashed var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                                    ${previewHtml}
                                    ${currentHomepageData.hero?.mediaUrl ? `<div class="btn-close" onclick="removeHeroMedia()" style="position:absolute; top: 8px; right: 8px; width:24px; height:24px; min-width:24px; background: rgba(0,0,0,0.6); z-index: 10;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>` : ''}
                                </div>
                                <input type="file" id="heroMediaUpload" accept="image/*,video/*" onchange="uploadHeroMedia(this)" style="display: none;">
                                <button class="btn-sm" onclick="document.getElementById('heroMediaUpload').click()" style="background: transparent; border: 1px solid var(--border); padding: 0.5rem; border-radius: 8px; width: 100%;">Upload Media</button>
                                
                                <div style="display: flex; flex-direction: column; padding: 1rem; background: var(--input-bg); border: 1px solid var(--border); border-radius: 12px; gap: 1rem;">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <div style="display: flex; flex-direction: column;">
                                            <div style="font-weight:600; font-size:0.9rem;">Text Shadow</div>
                                        </div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="heroTextShadowToggle" ${currentHomepageData.hero?.textShadow ? 'checked' : ''} onchange="applyHeroTextShadow()">
                                            <span class="slider round"></span>
                                        </label>
                                    </div>
                                    <div class="slider-container" style="display: flex; align-items: center; gap: 1rem;">
                                        <span style="font-size: 0.8rem; color: var(--muted); min-width: 40px;">Depth</span>
                                        <input type="range" id="heroTextShadowSlider" min="0" max="100" value="${currentHomepageData.hero?.textShadowDepth !== undefined ? currentHomepageData.hero.textShadowDepth : 50}" oninput="applyHeroTextShadow()" style="flex: 1; accent-color: var(--accent2);">
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                                <div style="display: flex; flex-direction: column; padding: 1.25rem; background: var(--input-bg); border: 1px solid var(--border); border-radius: 12px; gap: 1.25rem;">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <div style="display: flex; flex-direction: column;">
                                            <div style="font-weight:700; font-size:0.95rem; color:#fff;">Animated Shader Gradient</div>
                                            <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">Turn WebGL fluid gradient animation on or off.</div>
                                        </div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="heroGradientToggle" ${currentHomepageData.hero?.gradientEnabled !== false ? 'checked' : ''} onchange="applyHeroGradientSettings()">
                                            <span class="slider round"></span>
                                        </label>
                                    </div>
                                    
                                    <div id="gradientColorsContainer" style="display: ${currentHomepageData.hero?.gradientEnabled !== false ? 'flex' : 'none'}; flex-direction: column; gap: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                                        <div style="font-weight:600; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted);">Choose 3 Colors</div>
                                        
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
                                            <label style="font-size:0.85rem; color:var(--muted); min-width:80px; margin: 0;">Color 1</label>
                                            <input type="color" id="heroGradientColor1" value="${currentHomepageData.hero?.gradientColor1 || '#9effbe'}" onchange="applyHeroGradientSettings()" style="cursor: pointer; background: transparent; padding: 0; outline: none; flex: none;">
                                        </div>
                                        
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
                                            <label style="font-size:0.85rem; color:var(--muted); min-width:80px; margin: 0;">Color 2</label>
                                            <input type="color" id="heroGradientColor2" value="${currentHomepageData.hero?.gradientColor2 || '#f782ff'}" onchange="applyHeroGradientSettings()" style="cursor: pointer; background: transparent; padding: 0; outline: none; flex: none;">
                                        </div>
                                        
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
                                            <label style="font-size:0.85rem; color:var(--muted); min-width:80px; margin: 0;">Color 3</label>
                                            <input type="color" id="heroGradientColor3" value="${currentHomepageData.hero?.gradientColor3 || '#9c8cff'}" onchange="applyHeroGradientSettings()" style="cursor: pointer; background: transparent; padding: 0; outline: none; flex: none;">
                                        </div>

                                        <div class="slider-container" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted);">
                                                <span>Animation Speed</span>
                                                <span id="heroGradientSpeedVal">${currentHomepageData.hero?.gradientSpeed !== undefined ? (currentHomepageData.hero.gradientSpeed < 0.15 ? 'Slow' : currentHomepageData.hero.gradientSpeed > 0.4 ? 'Fast' : 'Medium') : 'Medium'} (${currentHomepageData.hero?.gradientSpeed !== undefined ? currentHomepageData.hero.gradientSpeed : 0.25})</span>
                                            </div>
                                            <input type="range" id="heroGradientSpeed" min="0.05" max="1.0" step="0.05" value="${currentHomepageData.hero?.gradientSpeed !== undefined ? currentHomepageData.hero.gradientSpeed : 0.25}" oninput="applyHeroGradientSettings()" style="width: 100%; accent-color: var(--accent2);">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (section === 'skills') {
                titleEl.textContent = 'Core Skills Settings';
                
                contentEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; width: 100%;">
                        <div class="form-group col" style="margin-bottom: 0.5rem;">
                            <label>Core Skills Description Paragraph</label>
                            <textarea id="skillsTextInput" rows="4" style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff; width: 100%; resize: vertical;">${currentHomepageData.coreSkillsText !== undefined ? currentHomepageData.coreSkillsText : 'Senior Graphic Designer with 9+ years of experience in branding, creative direction, UI/UX, and AI-integrated design workflows. Proven track record of improving campaign performance, increasing engagement, and reducing production costs through CRO-driven strategies and AI-powered creative execution.'}</textarea>
                            <button class="btn-primary" onclick="applySkillsText()" style="width: 100%; padding: 0.6rem; border-radius: 8px; margin-top: 0.5rem;">Apply text</button>
                        </div>
                        <div style="display: flex; flex-direction: column; padding: 1.25rem; background: var(--input-bg); border: 1px solid var(--border); border-radius: 12px; gap: 1.25rem;">
                            <div style="font-weight:700; font-size:0.95rem; color:#fff;">Text Style Options</div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted);">
                                    <span>Font Size</span>
                                    <span id="skillsFontSizeVal">${currentHomepageData.coreSkillsFontSize || 14}px</span>
                                </div>
                                <input type="range" id="skillsFontSizeSlider" min="12" max="24" value="${currentHomepageData.coreSkillsFontSize || 14}" oninput="applySkillsFontSize(this.value)" style="width: 100%; accent-color: var(--accent2);">
                            </div>
                        </div>
                    </div>
                `;
            } else if (section === 'projects') {
                titleEl.textContent = 'Projects Section Settings';
                contentEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; width: 100%;">
                        <div class="form-group col" style="margin-bottom: 0.5rem;">
                            <label>Projects Description Paragraph</label>
                            <textarea id="projectsTextInput" rows="4" style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff; width: 100%; resize: vertical;">${currentHomepageData.projectsText !== undefined ? currentHomepageData.projectsText : 'This is a secondary paragraph that describes my approach to various branding, UI/UX and other creative challenges over the years.'}</textarea>
                            <button class="btn-primary" onclick="applyProjectsText()" style="width: 100%; padding: 0.6rem; border-radius: 8px; margin-top: 0.5rem;">Apply text</button>
                        </div>
                        <div style="display: flex; flex-direction: column; padding: 1.25rem; background: var(--input-bg); border: 1px solid var(--border); border-radius: 12px; gap: 1.25rem;">
                            <div style="font-weight:700; font-size:0.95rem; color:#fff;">Text Style Options</div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted);">
                                    <span>Font Size</span>
                                    <span id="projectsFontSizeVal">${currentHomepageData.projectsFontSize || 14}px</span>
                                </div>
                                <input type="range" id="projectsFontSizeSlider" min="12" max="24" value="${currentHomepageData.projectsFontSize || 14}" oninput="applyProjectsFontSize(this.value)" style="width: 100%; accent-color: var(--accent2);">
                            </div>
                        </div>
                    </div>
                `;
            } else if (section === 'contact') {
                titleEl.textContent = 'Contact Section';
                const contact = currentHomepageData.contact || { phones: [], email: '', behance: '', linkedin: '' };
                
                let phonesHtml = '';
                (contact.phones || []).forEach((phone, index) => {
                    phonesHtml += `
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <input type="text" value="${phone}" onchange="updateContactPhone(${index}, this.value)" style="flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff;">
                            <button onclick="removeContactPhone(${index})" style="background: none; border: 1px solid #FF416C; color: #FF416C; border-radius: 8px; padding: 0 0.8rem; cursor: pointer;">Remove</button>
                        </div>
                    `;
                });

                contentEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                        <div>
                            <div class="form-group col" style="margin-bottom: 0.5rem;">
                                <label>Contact Background Image</label>
                                <div id="contact-banner-preview-box" style="width: 100%; aspect-ratio: 4/1; background: var(--input-bg); border-radius: 8px; border: 1px dashed var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; position: relative;">
                                    ${contact.bannerUrl ? `<img src="${contact.bannerUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 12px; color: var(--muted);">No banner</span>`}
                                    ${contact.bannerUrl ? `<div class="btn-close" onclick="removeContactBanner()" style="position:absolute; top: 8px; right: 8px; width:24px; height:24px; min-width:24px; background: rgba(0,0,0,0.6);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>` : ''}
                                </div>
                                <input type="file" id="contactBannerUpload" accept="image/*" onchange="uploadContactBanner(this)" style="display: none;">
                                <button class="btn-sm" onclick="document.getElementById('contactBannerUpload').click()" style="background: transparent; border: 1px solid var(--border); padding: 0.5rem; border-radius: 8px; width: 100%;">Upload Background</button>
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; flex-direction: column; padding: 1.25rem; background: var(--input-bg); border: 1px solid var(--border); border-radius: 12px; gap: 1.25rem; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; flex-direction: column;">
                                        <div style="font-weight:700; font-size:0.95rem; color:#fff;">Animated Shader Gradient</div>
                                        <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">Turn WebGL fluid gradient animation on or off for contact.</div>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="contactGradientToggle" ${contact.gradientEnabled !== false ? 'checked' : ''} onchange="applyContactGradientSettings()">
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                                
                                <div id="contactGradientColorsContainer" style="display: ${contact.gradientEnabled !== false ? 'flex' : 'none'}; flex-direction: column; gap: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                                    <div style="font-weight:600; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted);">Choose 3 Colors</div>
                                    
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
                                        <label style="font-size:0.85rem; color:var(--muted); min-width:80px; margin: 0;">Color 1</label>
                                        <input type="color" id="contactGradientColor1" value="${contact.gradientColor1 || '#9effbe'}" onchange="applyContactGradientSettings()" style="cursor: pointer; background: transparent; padding: 0; outline: none; flex: none;">
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
                                        <label style="font-size:0.85rem; color:var(--muted); min-width:80px; margin: 0;">Color 2</label>
                                        <input type="color" id="contactGradientColor2" value="${contact.gradientColor2 || '#f782ff'}" onchange="applyContactGradientSettings()" style="cursor: pointer; background: transparent; padding: 0; outline: none; flex: none;">
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
                                        <label style="font-size:0.85rem; color:var(--muted); min-width:80px; margin: 0;">Color 3</label>
                                        <input type="color" id="contactGradientColor3" value="${contact.gradientColor3 || '#9c8cff'}" onchange="applyContactGradientSettings()" style="cursor: pointer; background: transparent; padding: 0; outline: none; flex: none;">
                                    </div>

                                    <div class="slider-container" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted);">
                                            <span>Animation Speed</span>
                                            <span id="contactGradientSpeedVal">${contact.gradientSpeed !== undefined ? (contact.gradientSpeed < 0.15 ? 'Slow' : contact.gradientSpeed > 0.4 ? 'Fast' : 'Medium') : 'Medium'} (${contact.gradientSpeed !== undefined ? contact.gradientSpeed : 0.25})</span>
                                        </div>
                                        <input type="range" id="contactGradientSpeed" min="0.05" max="1.0" step="0.05" value="${contact.gradientSpeed !== undefined ? contact.gradientSpeed : 0.25}" oninput="applyContactGradientSettings()" style="width: 100%; accent-color: var(--accent2);">
                                    </div>
                                </div>
                            </div>

                            <div class="form-group col" style="margin-bottom: 0.5rem;">
                                <label>Phone Numbers</label>
                                <div id="contactPhonesList">${phonesHtml}</div>
                                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                                    <input type="text" id="newContactPhoneInput" placeholder="e.g. +971 50 123 4567" style="flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff;">
                                    <button class="btn-sm" onclick="addContactPhone()" style="padding: 0 1rem; border: 1px solid var(--border); background: transparent; border-radius: 8px;">Add</button>
                                </div>
                            </div>
                            <div class="form-group col" style="margin-bottom: 0.5rem;">
                                <label>Email Address</label>
                                <input type="email" id="contactEmailInput" value="${contact.email || ''}" placeholder="e.g. hello@example.com" style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff;">
                            </div>
                            <div class="form-group col" style="margin-bottom: 0.5rem;">
                                <label>Behance URL</label>
                                <input type="url" id="contactBehanceInput" value="${contact.behance || ''}" placeholder="https://behance.net/..." style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff;">
                            </div>
                            <div class="form-group col" style="margin-bottom: 0.5rem;">
                                <label>LinkedIn URL</label>
                                <input type="url" id="contactLinkedinInput" value="${contact.linkedin || 'https://www.linkedin.com/in/yadhu-sidharthan-b54862a4/'}" placeholder="https://linkedin.com/in/..." style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: #fff;">
                            </div>
                            
                            <button class="btn-primary" onclick="applyContactChanges()" style="width: 100%; padding: 0.8rem; border-radius: 8px; margin-top: 0.5rem;">Apply Contact Info</button>
                        </div>
                    </div>
                `;
            }
        }

        // --- Field Handlers ---
        function applyProjectsText() {
            currentHomepageData.projectsText = document.getElementById('projectsTextInput').value;
            showToast('Projects text applied locally');
        }
        function applySkillsText() {
            currentHomepageData.coreSkillsText = document.getElementById('skillsTextInput').value;
            showToast('Core Skills text applied locally');
        }
        function applyProjectsText() {
            currentHomepageData.projectsText = document.getElementById('projectsTextInput').value;
            showToast('Projects text applied locally');
        }
        function applySkillsFontSize(val) {
            const display = document.getElementById('skillsFontSizeVal');
            if (display) display.textContent = val + 'px';
            
            if (!currentHomepageData) currentHomepageData = {};
            currentHomepageData.coreSkillsFontSize = parseInt(val, 10);
            
            // Send live preview update to iframe
            const iframe = document.getElementById('visual-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    source: 'cms-dashboard',
                    action: 'update-core-skills-font-size',
                    val: parseInt(val, 10)
                }, '*');
            }
        }
        function applyProjectsFontSize(val) {
            const display = document.getElementById('projectsFontSizeVal');
            if (display) display.textContent = val + 'px';
            
            if (!currentHomepageData) currentHomepageData = {};
            currentHomepageData.projectsFontSize = parseInt(val, 10);
            
            // Send live preview update to iframe
            const iframe = document.getElementById('visual-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    source: 'cms-dashboard',
                    action: 'update-projects-font-size',
                    val: parseInt(val, 10)
                }, '*');
            }
        }
        function removeHeroMedia() {
            if (currentHomepageData.hero) {
                currentHomepageData.hero.mediaUrl = null;
                currentHomepageData.hero.mediaPublicId = null;
                currentHomepageData.hero.mediaType = null;
                
                // Send live preview update to iframe
                const iframe = document.getElementById('visual-iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        source: 'cms-dashboard',
                        action: 'update-hero-media',
                        url: null
                    }, '*');
                }
                
                if (activeHomepageSection === 'hero') selectHomepageSection('hero');
            }
        }
        
        function applyContactChanges() {
            if (!currentHomepageData.contact) currentHomepageData.contact = { phones: [], email: '', behance: '', linkedin: '' };
            currentHomepageData.contact.email = document.getElementById('contactEmailInput').value;
            currentHomepageData.contact.behance = document.getElementById('contactBehanceInput').value;
            currentHomepageData.contact.linkedin = document.getElementById('contactLinkedinInput').value;
            showToast('Contact info applied locally');
        }
        function addContactPhone() {
            const val = document.getElementById('newContactPhoneInput').value.trim();
            if (!val) return;
            if (!currentHomepageData.contact) currentHomepageData.contact = { phones: [], email: '', behance: '', linkedin: '' };
            if (!currentHomepageData.contact.phones) currentHomepageData.contact.phones = [];
            currentHomepageData.contact.phones.push(val);
            if (activeHomepageSection === 'contact') selectHomepageSection('contact');
        }
        function updateContactPhone(index, val) {
            if (currentHomepageData.contact && currentHomepageData.contact.phones) {
                currentHomepageData.contact.phones[index] = val;
            }
        }
        function removeContactPhone(index) {
            if (currentHomepageData.contact && currentHomepageData.contact.phones) {
                currentHomepageData.contact.phones.splice(index, 1);
                if (activeHomepageSection === 'contact') selectHomepageSection('contact');
            }
        }
        
        async function uploadContactBanner(input) {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            
            showToast('Uploading banner...');
            const fd = new FormData();
            fd.append('file', file);
            
            try {
                const res = await fetch('/api/upload-media', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Upload failed');
                const data = await res.json();
                
                if (!currentHomepageData.contact) currentHomepageData.contact = {};
                currentHomepageData.contact.bannerUrl = data.url;
                currentHomepageData.contact.bannerPublicId = data.public_id;
                
                // Send live preview update to iframe
                const iframe = document.getElementById('visual-iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        source: 'cms-dashboard',
                        action: 'update-contact-media',
                        url: data.url
                    }, '*');
                }
                
                if (activeHomepageSection === 'contact') selectHomepageSection('contact'); // re-render
                showToast("Banner uploaded! Don't forget to Publish.");
            } catch (err) {
                console.error(err);
                showToast('Upload failed. Try again.', true);
            }
        }
        
        function removeContactBanner() {
            if (currentHomepageData.contact) {
                currentHomepageData.contact.bannerUrl = null;
                currentHomepageData.contact.bannerPublicId = null;
                
                // Send live preview update to iframe
                const iframe = document.getElementById('visual-iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        source: 'cms-dashboard',
                        action: 'update-contact-media',
                        url: null
                    }, '*');
                }
                
                if (activeHomepageSection === 'contact') selectHomepageSection('contact');
            }
        }

        function applyHeroTextShadow() {
            const checkbox = document.getElementById('heroTextShadowToggle');
            const slider = document.getElementById('heroTextShadowSlider');
            if (!checkbox || !slider) return;

            if (!currentHomepageData.hero) currentHomepageData.hero = {};
            currentHomepageData.hero.textShadow = checkbox.checked;
            currentHomepageData.hero.textShadowDepth = parseInt(slider.value, 10);
            
            // Send live preview update to iframe
            const iframe = document.getElementById('visual-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    source: 'cms-dashboard',
                    action: 'update-hero-shadow',
                    enabled: checkbox.checked,
                    depth: parseInt(slider.value, 10)
                }, '*');
            }
        }

        function applyHeroGradientSettings() {
            const toggle = document.getElementById('heroGradientToggle');
            const c1 = document.getElementById('heroGradientColor1');
            const c2 = document.getElementById('heroGradientColor2');
            const c3 = document.getElementById('heroGradientColor3');
            const speedSlider = document.getElementById('heroGradientSpeed');
            const colorsContainer = document.getElementById('gradientColorsContainer');
            if (!toggle) return;

            if (!currentHomepageData.hero) currentHomepageData.hero = {};
            currentHomepageData.hero.gradientEnabled = toggle.checked;
            
            if (colorsContainer) {
                colorsContainer.style.display = toggle.checked ? 'flex' : 'none';
            }

            if (c1 && c2 && c3) {
                currentHomepageData.hero.gradientColor1 = c1.value;
                currentHomepageData.hero.gradientColor2 = c2.value;
                currentHomepageData.hero.gradientColor3 = c3.value;
            }

            let speed = 0.25;
            if (speedSlider) {
                speed = parseFloat(speedSlider.value);
                currentHomepageData.hero.gradientSpeed = speed;
                const speedValEl = document.getElementById('heroGradientSpeedVal');
                if (speedValEl) {
                    const label = speed < 0.15 ? 'Slow' : speed > 0.4 ? 'Fast' : 'Medium';
                    speedValEl.textContent = `${label} (${speed})`;
                }
            }
            
            // Send live preview update to iframe
            const iframe = document.getElementById('visual-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    source: 'cms-dashboard',
                    action: 'update-hero-gradient',
                    enabled: toggle.checked,
                    color1: c1 ? c1.value : '#9effbe',
                    color2: c2 ? c2.value : '#f782ff',
                    color3: c3 ? c3.value : '#9c8cff',
                    speed: speed
                }, '*');
            }
        }

        function applyContactGradientSettings() {
            const toggle = document.getElementById('contactGradientToggle');
            const c1 = document.getElementById('contactGradientColor1');
            const c2 = document.getElementById('contactGradientColor2');
            const c3 = document.getElementById('contactGradientColor3');
            const speedSlider = document.getElementById('contactGradientSpeed');
            const colorsContainer = document.getElementById('contactGradientColorsContainer');
            if (!toggle) return;

            if (!currentHomepageData.contact) currentHomepageData.contact = {};
            currentHomepageData.contact.gradientEnabled = toggle.checked;
            
            if (colorsContainer) {
                colorsContainer.style.display = toggle.checked ? 'flex' : 'none';
            }

            if (c1 && c2 && c3) {
                currentHomepageData.contact.gradientColor1 = c1.value;
                currentHomepageData.contact.gradientColor2 = c2.value;
                currentHomepageData.contact.gradientColor3 = c3.value;
            }

            let speed = 0.25;
            if (speedSlider) {
                speed = parseFloat(speedSlider.value);
                currentHomepageData.contact.gradientSpeed = speed;
                const speedValEl = document.getElementById('contactGradientSpeedVal');
                if (speedValEl) {
                    const label = speed < 0.15 ? 'Slow' : speed > 0.4 ? 'Fast' : 'Medium';
                    speedValEl.textContent = `${label} (${speed})`;
                }
            }
            
            // Send live preview update to iframe
            const iframe = document.getElementById('visual-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    source: 'cms-dashboard',
                    action: 'update-contact-gradient',
                    enabled: toggle.checked,
                    color1: c1 ? c1.value : '#9effbe',
                    color2: c2 ? c2.value : '#f782ff',
                    color3: c3 ? c3.value : '#9c8cff',
                    speed: speed
                }, '*');
            }
        }

        async function uploadHeroMedia(input) {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            const isVideo = file.type.startsWith('video/');
            
            showToast('Uploading media...');
            const fd = new FormData();
            fd.append('file', file);
            
            try {
                const res = await fetch('/api/upload-media', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Upload failed');
                const data = await res.json();
                
                if (!currentHomepageData.hero) currentHomepageData.hero = {};
                currentHomepageData.hero.mediaUrl = data.url;
                currentHomepageData.hero.mediaPublicId = data.public_id;
                currentHomepageData.hero.mediaType = isVideo ? 'video' : 'image';
                
                // Send live preview update to iframe
                const iframe = document.getElementById('visual-iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        source: 'cms-dashboard',
                        action: 'update-hero-media',
                        url: data.url,
                        type: isVideo ? 'video' : 'image'
                    }, '*');
                }
                
                if (activeHomepageSection === 'hero') selectHomepageSection('hero'); // re-render
                showToast("Media uploaded! Don't forget to Publish.");
            } catch (err) {
                console.error(err);
                showToast('Upload failed. Try again.', true);
            }
        }

        function addCoreSkill() {
            const input = document.getElementById('newSkillInput');
            const val = input.value.trim().toUpperCase();
            if (!val) return;
            
            if (!currentHomepageData.coreSkills) currentHomepageData.coreSkills = [];
            currentHomepageData.coreSkills.push(val);
            input.value = '';
            if (activeHomepageSection === 'skills') selectHomepageSection('skills'); // re-render
        }

        function removeCoreSkill(index) {
            if (currentHomepageData.coreSkills) {
                currentHomepageData.coreSkills.splice(index, 1);
                if (activeHomepageSection === 'skills') selectHomepageSection('skills'); // re-render
            }
        }

        async function saveHomepageData() {
            try {
                const res = await fetch('/api/homepage/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: currentHomepageData })
                });
                if (res.ok) {
                    showToast('Homepage published successfully!');
                    const iframe = document.getElementById('homepage-preview-iframe') || document.getElementById('visual-iframe');
                    if (iframe) iframe.src = '/index.html?t=' + Date.now();
                } else {
                    showToast('Failed to publish', true);
                }
            } catch (err) {
                console.error("Save homepage error:", err);
                showToast('Error publishing', true);
            }
        }
    