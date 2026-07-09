// Shared Contact Card Renderer
async function renderSharedContactCard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let contactData = null;
    
    // First try to use window.CMS_DATA if it's already injected
    if (window.CMS_DATA && window.CMS_DATA.contact) {
        contactData = window.CMS_DATA.contact;
    } else {
        // Fallback to fetching it
        try {
            const res = await fetch('/api/homepage/data');
            const data = await res.json();
            contactData = data.contact || {};
        } catch (e) {
            console.error('Failed to fetch contact data for shared card', e);
            contactData = {};
        }
    }

    const bannerUrl = contactData.bannerUrl || '';
    let mediaHtml = '';
    if (bannerUrl) {
        const isVideo = bannerUrl.includes('/video/upload/') || bannerUrl.match(/\.(mp4|webm|ogg|mov)$/i);
        if (isVideo) {
            mediaHtml = `<video src="${bannerUrl}" muted autoplay loop playsinline style="width:100%; height:100%; object-fit:cover;"></video>`;
        } else {
            mediaHtml = `<img src="${bannerUrl}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`;
        }
    }

    const phones = (contactData.phones && contactData.phones.length > 0) ? contactData.phones : ['+971 523325687'];
    let phoneLinksHtml = phones.map(phone => `
        <a href="tel:${phone.replace(/\s+/g, '')}" class="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-full text-[13px] font-semibold flex items-center gap-3 w-full transition-all duration-300 hover:-translate-y-[2px] active:scale-95">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            ${phone}
        </a>
    `).join('');

    const emailAddress = contactData.email || 'yadhusid@gmail.com';
    let emailLinkHtml = '';
    if (emailAddress) {
        emailLinkHtml = `
            <a href="mailto:${emailAddress}" class="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-full text-[13px] font-semibold flex items-center gap-3 w-full lowercase transition-all duration-300 hover:-translate-y-[2px] active:scale-95">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                ${emailAddress}
            </a>
        `;
    }

    const behanceUrl = contactData.behance || 'https://www.behance.net/yadhusid';
    let behanceLinkHtml = '';
    if (behanceUrl) {
        behanceLinkHtml = `
            <a href="${behanceUrl}" target="_blank" rel="noopener noreferrer" class="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-full text-[13px] font-semibold flex items-center gap-3 w-full transition-all duration-300 hover:-translate-y-[2px] active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 640 640" fill="currentColor"><path d="M185.577 119.517c18.862 0 35.847 1.642 51.331 5.008 15.52 3.236 28.63 8.752 39.757 16.24 10.996 7.512 19.476 17.516 25.748 29.989 6 12.354 9 27.862 9 46.229 0 19.878-4.476 36.355-13.512 49.63-9.118 13.24-22.358 24-40.122 32.516 24.236 6.993 42.118 19.24 54.118 36.627 11.989 17.516 17.753 38.504 17.753 63.225 0 19.996-3.886 37.11-11.469 51.615-7.748 14.634-18.248 26.492-31.11 35.634-12.993 9.236-27.993 15.992-44.753 20.363-16.642 4.346-33.756 6.626-51.45 6.626H0V119.553l185.601.012-.023-.048zm232.042 31.76h159.616v38.883l-159.616-.012v-38.883.012zm35.469 293.448c11.764 11.469 28.63 17.233 50.646 17.233 15.745 0 29.516-4.016 40.867-12.012 11.35-7.996 18.248-16.465 20.882-25.229l68.965.012c-11.126 34.347-27.874 58.749-50.859 73.5-22.642 14.753-50.35 22.241-82.5 22.241-22.524 0-42.627-3.65-60.757-10.772-18.119-7.24-33.237-17.35-45.993-30.638-12.366-13.24-22.11-28.984-28.996-47.493-6.756-18.354-10.229-38.752-10.229-60.744 0-21.367 3.52-41.245 10.477-59.623 7.122-18.52 16.878-34.359 29.87-47.753 12.98-13.382 28.229-24 46.24-31.748 17.883-7.76 37.631-11.646 59.505-11.646 24.107 0 45.225 4.642 63.356 14.126 18 9.355 32.87 21.993 44.492 37.749 11.646 15.768 19.878 33.874 25.004 54.107 5.126 20.232 6.875 41.35 5.469 63.508H433.706c0 22.359 7.512 43.76 19.358 55.1l.024.082zm89.871-149.707c-9.236-10.24-25.122-15.874-44.233-15.874-12.52 0-22.866 2.114-31.11 6.366-8.115 4.229-14.752 9.473-19.878 15.745-4.997 6.248-8.516 13.004-10.465 20.102-1.996 6.874-3.236 13.24-3.65 18.756l127.502-.012c-1.878-19.984-8.752-34.736-18.118-45.106l-.047.023zm-368.662-16.524c15.355 0 28.099-3.65 38.091-11.008 9.992-7.24 14.752-19.24 14.752-35.752 0-9.106-1.63-16.76-4.878-22.642-3.354-5.87-7.76-10.512-13.37-13.748-5.516-3.355-11.74-5.646-19.099-6.886-7.122-1.358-14.634-1.984-22.24-1.984H86.576v91.973h87.745l-.024.047zm4.748 167.59c8.528 0 16.642-.757 24.213-2.528 7.748-1.748 14.634-4.359 20.363-8.35 5.752-3.887 10.641-8.989 14.114-15.745 3.52-6.638 5.126-15.118 5.126-25.477 0-20.232-5.764-34.748-17.114-43.512-11.351-8.646-26.47-12.874-45.214-12.874H86.552V445.93l92.493-.012v.165z"/></svg>
                Live Behance Portfolio
            </a>
        `;
    }

    const linkedinUrl = contactData.linkedin || 'https://www.linkedin.com/in/yadhu-sidharthan-b54862a4/';
    const linkedinLinkHtml = `
        <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-full text-[13px] font-semibold flex items-center gap-3 w-full transition-all duration-300 hover:-translate-y-[2px] active:scale-95">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            LinkedIn Profile
        </a>
    `;

    container.innerHTML = `
        <div class="rounded-[32px] reeded-gradient p-[6%] md:p-[4%] text-white relative overflow-hidden flex flex-col md:flex-row md:items-start lg:items-center justify-between gap-8 md:gap-[4vw] global-margin" id="contact-banner-container">
            <!-- Media Layer -->
            <div class="media-layer" id="contact-media-layer">
                ${mediaHtml}
            </div>
            
            <!-- Left Column: CTA -->
            <div class="relative z-10 w-full md:w-1/2 lg:w-1/2 flex flex-col justify-center">
                <h2 class="text-[clamp(32px,5vw,64px)] font-bold tracking-tight mb-[6vw] md:mb-[3vw] leading-[1.02] md:leading-[0.95] max-w-[500px]">
                    Let's Create<br>Something<br>Extraordinary
                </h2>
                <p class="text-white/90 text-[13px] font-medium">
                    Available for freelance opportunities and collaborations.
                </p>
            </div>
            
            <!-- Right Column: Contact & Social Links -->
            <div class="relative z-10 w-full md:w-full lg:w-1/2 mt-6 md:mt-10 lg:mt-0 flex flex-col lg:items-end justify-center">
                <div class="flex flex-col gap-2.5 w-full md:max-w-[320px]" id="contact-links-container">
                    ${phoneLinksHtml}
                    ${emailLinkHtml}
                    ${behanceLinkHtml}
                    ${linkedinLinkHtml}
                </div>
            </div>
        </div>
    `;

    // Re-initialize WebGL Shader Gradient if available
    if (typeof initShaderGradients === 'function') {
        initShaderGradients();
    }
}
window.renderSharedContactCard = renderSharedContactCard;
