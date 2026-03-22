const DEFAULT_ENDPOINT = '/api/content';

const escapeHtml = (value) =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const readConfig = () => {
	const element = document.getElementById('runtime-content-config');
	if (!element?.textContent) {
		return { endpoint: DEFAULT_ENDPOINT };
	}
	try {
		const parsed = JSON.parse(element.textContent);
		return {
			endpoint: typeof parsed.endpoint === 'string' && parsed.endpoint.trim().length > 0 ? parsed.endpoint.trim() : DEFAULT_ENDPOINT,
		};
	} catch (error) {
		console.warn('Unable to parse runtime content config. Falling back to defaults.', error);
		return { endpoint: DEFAULT_ENDPOINT };
	}
};

const fetchContent = async (endpoint) => {
	const response = await fetch(endpoint, {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
	});
	if (!response.ok) {
		throw new Error(`contentApi responded with ${response.status}`);
	}
	return response.json();
};

const setVisible = (element, visible) => {
	if (!(element instanceof HTMLElement)) {
		return;
	}
	element.hidden = !visible;
};

const setText = (selector, value) => {
	const element = document.querySelector(selector);
	if (!(element instanceof HTMLElement)) {
		return;
	}
	const nextValue = typeof value === 'string' ? value.trim() : '';
	element.textContent = nextValue;
	element.hidden = nextValue.length === 0;
};

const updateMetadata = (content) => {
	const title = content.hero?.title || content.meta?.siteName || "Howlin' At The Moon Fest";
	const description =
		content.hero?.description || `Latest content powered by WeBeFriends for ${content.meta?.siteName || 'this site'}.`;
	const ogImage = content.hero?.background?.src || '/images/moon-bkg.png';

	document.title = title;

	const descriptionTag = document.querySelector('meta[name="description"]');
	if (descriptionTag) {
		descriptionTag.setAttribute('content', description);
	}

	document.querySelectorAll('meta[property="og:title"]').forEach((tag) => tag.setAttribute('content', title));
	document.querySelectorAll('meta[property="og:description"]').forEach((tag) => tag.setAttribute('content', description));
	document.querySelectorAll('meta[property="og:image"]').forEach((tag) => tag.setAttribute('content', ogImage));
	document.querySelectorAll('meta[property="og:image:secure_url"]').forEach((tag) => tag.setAttribute('content', ogImage));
	document.querySelectorAll('meta[name="twitter:image"]').forEach((tag) => tag.setAttribute('content', ogImage));
};

const pickHeroVideo = (videos) =>
	videos.find((video) => Array.isArray(video.placement) && video.placement.includes('hero')) ||
	videos.find((video) => Array.isArray(video.placement) && video.placement.includes('frontpage')) ||
	videos[0];

const renderHero = (content) => {
	const section = document.querySelector('[data-hero-section]');
	if (!(section instanceof HTMLElement)) {
		return;
	}

	const hero = content.hero;
	setVisible(section, Boolean(hero));
	if (!hero) {
		return;
	}

	section.style.backgroundImage = hero.background?.src
		? `linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)), url(${hero.background.src})`
		: '';
	section.style.backgroundSize = hero.background?.src ? 'cover' : '';
	section.style.backgroundPosition = hero.background?.src ? 'center' : '';

	setText('[data-hero-kicker]', hero.kicker && hero.kicker.toLowerCase() !== 'venue' ? hero.kicker : '');
	setText('[data-hero-title]', hero.title);
	setText('[data-hero-tagline]', hero.tagline);
	setText('[data-hero-description]', hero.description);

	const videos = Array.isArray(content.videos) ? content.videos : [];
	const heroVideo = pickHeroVideo(videos);
	const wrapper = document.querySelector('[data-hero-video-wrapper]');
	const video = document.querySelector('[data-hero-video]');
	if (!(wrapper instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) {
		return;
	}

	setVisible(wrapper, Boolean(heroVideo?.src));
	if (!heroVideo?.src) {
		video.removeAttribute('src');
		video.removeAttribute('poster');
		video.load();
		return;
	}

	if (video.getAttribute('src') !== heroVideo.src) {
		video.setAttribute('src', heroVideo.src);
	}
	if (heroVideo.poster) {
		video.setAttribute('poster', heroVideo.poster);
	} else if (hero.background?.src) {
		video.setAttribute('poster', hero.background.src);
	} else {
		video.removeAttribute('poster');
	}
	video.autoplay = heroVideo.autoplay ?? true;
	video.loop = heroVideo.loop ?? true;
	video.muted = heroVideo.muted ?? true;
	video.playsInline = heroVideo.playsinline ?? true;
	video.setAttribute('aria-label', heroVideo.title ?? 'Festival highlight reel');
	video.load();
};

const renderVideos = (content) => {
	const section = document.querySelector('[data-videos-section]');
	const grid = document.querySelector('[data-videos-grid]');
	if (!(section instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
		return;
	}

	const videos = Array.isArray(content.videos) ? content.videos : [];
	const heroVideo = pickHeroVideo(videos);
	const showcase = videos.filter((video) => video !== heroVideo);
	setVisible(section, showcase.length > 0);
	if (showcase.length === 0) {
		grid.innerHTML = '';
		return;
	}

	grid.innerHTML = showcase
		.map(
			(video) => `
				<article class="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
					<video
						src="${escapeHtml(video.src)}"
						${video.poster ? `poster="${escapeHtml(video.poster)}"` : ''}
						${video.autoplay ? 'autoplay' : ''}
						${video.loop ? 'loop' : ''}
						${video.muted !== false ? 'muted' : ''}
						${video.playsinline !== false ? 'playsinline' : ''}
						controls
						preload="metadata"
						class="aspect-video h-full w-full object-cover"
						aria-label="${escapeHtml(video.title ?? 'Festival video')}"
					></video>
					${
						video.title
							? `<div class="p-4">
								<h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">${escapeHtml(video.title)}</h3>
								${video.description ? `<p class="mt-2 text-sm text-slate-300">${escapeHtml(video.description)}</p>` : ''}
							</div>`
							: ''
					}
				</article>
			`
		)
		.join('');
};

const renderGallery = (content) => {
	const section = document.querySelector('[data-gallery-section]');
	const grid = document.querySelector('[data-gallery-grid]');
	const modalsRoot = document.querySelector('[data-gallery-modals-root]');
	const showMoreButton = document.querySelector('[data-gallery-show-more]');
	if (!(section instanceof HTMLElement) || !(grid instanceof HTMLElement) || !(modalsRoot instanceof HTMLElement)) {
		return;
	}

	const gallery = Array.isArray(content.gallery) ? content.gallery.filter((item) => item?.src) : [];
	setVisible(section, gallery.length > 0);
	if (gallery.length === 0) {
		grid.innerHTML = '';
		modalsRoot.innerHTML = '';
		if (showMoreButton instanceof HTMLElement) {
			showMoreButton.classList.add('hidden');
			showMoreButton.setAttribute('aria-hidden', 'true');
		}
		document.dispatchEvent(new CustomEvent('webe:gallery-ready'));
		document.dispatchEvent(new CustomEvent('webe:gallery-modals-ready'));
		return;
	}

	grid.innerHTML = gallery
		.map((image, index) => {
			const galleryKey = `gallery-${index}`;
			const modalId = `modal-gallery-${index}`;
			const caption = image.alt || `Festival photo ${index + 1}`;
			const isMobileHidden = index >= 3;
			return `
				<button
					type="button"
					class="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 text-left transition hover:border-fuchsia-400/70 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 ${isMobileHidden ? 'hidden sm:block' : ''}"
					data-gallery-toggle
					data-gallery-target="${modalId}"
					data-gallery-id="${galleryKey}"
					data-gallery-item
					data-gallery-mobile-hidden="${isMobileHidden ? 'true' : 'false'}"
				>
					<span
						class="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-200"
						data-gallery-badge-wrapper="${galleryKey}"
						aria-live="polite"
					>
						<span aria-hidden="true">💬</span>
						<span data-gallery-badge="${galleryKey}">0</span>
						<span class="sr-only" data-gallery-badge-sr>0 comments on this photo</span>
					</span>
					<img
						src="${escapeHtml(image.src)}"
						alt="${escapeHtml(image.alt ?? '')}"
						class="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
					/>
					<span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/50 to-transparent px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-200">
						${escapeHtml(caption)}
					</span>
					<span class="sr-only">Open full view of ${escapeHtml(caption)}</span>
				</button>
			`;
		})
		.join('');

	modalsRoot.innerHTML = gallery
		.map((image, index) => {
			const dialogId = `modal-gallery-${index}`;
			const galleryKey = `gallery-${index}`;
			const headingId = `${dialogId}-heading`;
			const caption = image.alt || `Festival photo ${index + 1}`;
			return `
				<dialog
					id="${dialogId}"
					aria-labelledby="${headingId}"
					data-gallery-modal="true"
					data-gallery-id="${galleryKey}"
					class="backdrop:bg-slate-950/85 w-full max-w-4xl rounded-3xl border border-slate-700/60 bg-slate-900/95 p-0 text-slate-100 shadow-2xl"
				>
					<div class="relative flex max-h-[90vh] w-full max-w-4xl flex-col gap-6 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
						<header class="flex items-start justify-between gap-4">
							<div>
								<p class="text-xs uppercase tracking-wide text-fuchsia-300/80">Festival Gallery</p>
								<h3 id="${headingId}" class="text-2xl font-semibold text-slate-100">${escapeHtml(caption)}</h3>
							</div>
							<button
								type="button"
								class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 transition hover:border-fuchsia-400/70 hover:text-fuchsia-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"
								data-gallery-close
							>
								<span aria-hidden="true" class="text-2xl leading-none">×</span>
								<span class="sr-only">Close photo</span>
							</button>
						</header>
						<div class="overflow-hidden rounded-3xl border border-slate-800">
							<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt ?? '')}" class="h-full max-h-[55vh] w-full object-cover" loading="lazy" />
						</div>
						<section
							data-gallery-comment
							data-gallery-id="${galleryKey}"
							class="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
						>
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex items-center gap-2">
									<h4 class="text-lg font-semibold text-slate-100">Comments</h4>
									<span class="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300" data-comment-count>0</span>
								</div>
								<button
									type="button"
									class="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/60 px-4 py-2 text-sm font-medium text-fuchsia-200 transition hover:border-fuchsia-400 hover:bg-fuchsia-500/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"
									data-comment-trigger
								>
									<span aria-hidden="true">💬</span>
									Add a comment
								</button>
							</div>
							<ul class="space-y-3" data-comment-list></ul>
							<div data-comment-body class="hidden space-y-4">
								<div data-comment-state="guest" class="space-y-4">
									<p class="text-sm text-slate-300">
										Remember Howlers, comments live on WeBeFriends. Join the community to post your take.
										<a
											href="https://webefriends.com/signup"
											target="_blank"
											rel="noreferrer"
											class="ml-1 font-semibold text-fuchsia-200 underline-offset-4 hover:underline"
										>
											Sign up for free on WeBeFriends.com
										</a>
									</p>
									<div class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
										<button
											type="button"
											class="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-fuchsia-400/70 hover:text-fuchsia-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"
											data-comment-show-signin
										>
											Already a member? Sign in here
										</button>
										<form data-comment-signin-form class="hidden space-y-3">
											<div class="space-y-1">
												<label for="${dialogId}-email" class="text-sm text-slate-300">Email</label>
												<input type="email" id="${dialogId}-email" name="email" required class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60" />
											</div>
											<div class="space-y-1">
												<label for="${dialogId}-password" class="text-sm text-slate-300">Password</label>
												<input type="password" id="${dialogId}-password" name="password" required class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60" />
											</div>
											<div class="space-y-1">
												<label for="${dialogId}-display-name" class="text-sm text-slate-300">Display name</label>
												<input type="text" id="${dialogId}-display-name" name="displayName" required class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60" />
											</div>
											<button type="submit" class="inline-flex w-full items-center justify-center rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60">
												Sign in and start commenting
											</button>
										</form>
									</div>
								</div>
								<div data-comment-state="signed-in" class="hidden space-y-4">
									<p class="text-sm text-slate-300" data-comment-user></p>
									<form data-comment-form class="space-y-3">
										<label class="space-y-2 text-sm text-slate-200">
											<span>Share your memories from this set</span>
											<textarea required rows="4" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"></textarea>
										</label>
										<div class="flex flex-wrap items-center gap-3">
											<button type="submit" class="inline-flex items-center justify-center rounded-full bg-fuchsia-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60">
												Post comment
											</button>
											<button type="button" class="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-fuchsia-400/70 hover:text-fuchsia-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60" data-comment-signout>
												Sign out
											</button>
										</div>
									</form>
								</div>
							</div>
						</section>
					</div>
				</dialog>
			`;
		})
		.join('');

	if (showMoreButton instanceof HTMLElement) {
		if (gallery.length > 3) {
			showMoreButton.classList.remove('hidden');
			showMoreButton.setAttribute('aria-hidden', 'false');
		} else {
			showMoreButton.classList.add('hidden');
			showMoreButton.setAttribute('aria-hidden', 'true');
		}
	}

	document.dispatchEvent(new CustomEvent('webe:gallery-ready'));
	document.dispatchEvent(new CustomEvent('webe:gallery-modals-ready'));
};

const renderSponsors = (content) => {
	const section = document.querySelector('[data-sponsors-section]');
	const grid = document.querySelector('[data-sponsors-grid]');
	if (!(section instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
		return;
	}
	const sponsors = Array.isArray(content.sponsors) ? content.sponsors : [];
	setVisible(section, sponsors.length > 0);
	grid.innerHTML = sponsors
		.map(
			(sponsor) => `
				<article class="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
					<p class="text-xs font-semibold uppercase tracking-[0.4em] text-fuchsia-300/80">${escapeHtml(sponsor.tier)}</p>
					<h3 class="text-lg font-semibold text-white">${escapeHtml(sponsor.name)}</h3>
					<p class="text-sm text-slate-300">${escapeHtml(sponsor.description)}</p>
				</article>
			`
		)
		.join('');
};

const renderFaqs = (content) => {
	const section = document.querySelector('[data-faq-section]');
	const grid = document.querySelector('[data-faq-grid]');
	if (!(section instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
		return;
	}
	const faqs = Array.isArray(content.faqs) ? content.faqs : [];
	setVisible(section, faqs.length > 0);
	grid.innerHTML = faqs
		.map(
			(faq) => `
				<article class="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
					<h3 class="text-lg font-semibold text-white">${escapeHtml(faq.question)}</h3>
					<p class="text-sm text-slate-300">${escapeHtml(faq.answer)}</p>
				</article>
			`
		)
		.join('');
};

const hydrateContent = async () => {
	const config = readConfig();
	const content = await fetchContent(config.endpoint);
	updateMetadata(content);
	renderHero(content);
	renderVideos(content);
	renderGallery(content);
	renderSponsors(content);
	renderFaqs(content);
};

const bootstrap = () => {
	void hydrateContent().catch((error) => {
		console.error('Failed to hydrate runtime content.', error);
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
	bootstrap();
}

document.addEventListener('astro:page-load', bootstrap);

export {};
