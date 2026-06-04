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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 7h-7v-2h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14h-8.027c.13 3.211 3.483 3.312 4.588 2.029h3.168zm-7.686-4h4.965c-.105-1.546-1.436-2.352-2.461-2.352-1.036 0-2.227.831-2.504 2.352zm-5.97-4.227c0-2.486-1.528-4.364-4.667-4.364h-5.403v15.18h5.343c3.125 0 4.939-1.929 4.939-4.705 0-1.765-.895-3.056-2.468-3.513 1.157-.492 2.256-1.603 2.256-2.598zm-7.07-2.128h2.09c1.077 0 1.93.36 1.93 1.636 0 1.393-.896 1.637-1.815 1.637h-2.205v-3.273zm0 9.248v-3.791h2.298c1.334 0 2.193.383 2.193 1.83 0 1.547-1 1.961-2.193 1.961h-2.298z"/></svg>
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
