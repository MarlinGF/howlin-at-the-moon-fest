export type ImageAsset = {
	src: string;
	alt: string;
};

export type CtaLink = {
	label: string;
	href: string;
};

export type HeroBlock = {
	kicker?: string;
	title: string;
	tagline?: string;
	description?: string;
	primaryCta?: CtaLink;
	secondaryCta?: CtaLink;
	background?: ImageAsset;
};

export type EventDetail = {
	id: string;
	title: string;
	stage: string;
	dayLabel: string;
	area: string;
	start: string;
	end: string;
	description: string;
	image: ImageAsset;
	tags: string[];
};

export type ScheduleDay = {
	dayLabel: string;
	dateLabel: string;
	gatesOpen: string;
	eventIds: string[];
};

export type FestivalStat = {
	label: string;
	value: number | string;
};

export type Sponsor = {
	name: string;
	tier: string;
	description: string;
};

export type FaqItem = {
	question: string;
	answer: string;
};

export type IntegrationMeta = {
	siteSlug: string;
	siteName: string;
	sourcePageId: string;
	generatedAt: string;
};

export type Schedule = {
	days: ScheduleDay[];
};

export type FestivalContent = {
	meta: IntegrationMeta;
	hero?: HeroBlock;
	stats: FestivalStat[];
	events: EventDetail[];
	schedule: Schedule;
	gallery: ImageAsset[];
	sponsors: Sponsor[];
	faqs: FaqItem[];
};

type EventDetailPayload = Omit<EventDetail, 'description' | 'image' | 'tags'> & {
	description?: string;
	image?: ImageAsset;
	tags?: string[];
};

type IntegrationApiResponse = {
	meta?: Partial<IntegrationMeta>;
	hero?: HeroBlock;
	stats?: FestivalStat[];
	events?: EventDetailPayload[];
	schedule?: {
		days?: ScheduleDay[];
	};
	gallery?: ImageAsset[];
	sponsors?: Sponsor[];
	faqs?: FaqItem[];
};

type CacheEntry = {
	data: FestivalContent;
	expiresAt: number;
	staleAt: number;
};

const API_BASE_URL = (import.meta.env.WEBE_API_BASE ?? 'https://webefriends.com/api/integrations').replace(/\/?$/, '');
const DEFAULT_SITE_SLUG = import.meta.env.WEBE_SITE_SLUG ?? 'howlin-yuma';
const API_KEY = import.meta.env.WEBE_API_KEY;

const cache = new Map<string, CacheEntry>();

const fallbackFestivalContentTemplate: FestivalContent = {
	meta: {
		siteSlug: 'howlin-yuma',
		siteName: "Howlin' At The Moon Fest",
		sourcePageId: 'mock-page',
		generatedAt: new Date().toISOString(),
	},
	hero: {
		kicker: 'October 18 – 19 • Yuma Territorial Prison State Historic Park',
		title: "Howlin' At The Moon Fest",
		tagline: 'Desert nights. Cosmic sound. Infinite vibes.',
		description:
			'An immersive desert festival celebrating Southwestern artistry with luminous stages, collaborative installations, and stargazer sessions guided by local legends.',
		primaryCta: { label: 'Get Tickets', href: '#tickets' },
		secondaryCta: { label: 'View Lineup', href: '#schedule' },
		background: {
			src: '/images/hero/moonrise.svg',
			alt: 'Illustrated moon hanging above glowing desert festival stages',
		},
	},
	stats: [
		{ label: 'Stages', value: 4 },
		{ label: 'Artists', value: 24 },
		{ label: 'Art Installations', value: 12 },
		{ label: 'Miles of Neon', value: 6 },
	],
	events: [
		{
			id: 'moonrise-ceremony',
			title: 'Moonrise Ceremony',
			stage: 'Luna Main Stage',
			dayLabel: 'Friday',
			area: 'Historic Courtyard',
			start: '2025-10-18T18:00:00-07:00',
			end: '2025-10-18T19:00:00-07:00',
			description:
				'Kick off the festival with a guided sonic meditation, indigenous drumming, and a collaborative howl that welcomes the moon over the Yuma dunes.',
			image: {
				src: '/images/events/moonrise.svg',
				alt: 'Crowd gathered around a glowing lunar stage at dusk',
			},
			tags: ['featured'],
		},
		{
			id: 'starlit-groove',
			title: 'Starlit Groove Session',
			stage: 'Constellation Dome',
			dayLabel: 'Friday',
			area: 'Upper Yard',
			start: '2025-10-18T19:30:00-07:00',
			end: '2025-10-18T21:00:00-07:00',
			description:
				'Live-electronic fusion set with laser choreography mapped to the night sky and reactive sand-floor projections.',
			image: {
				src: '/images/events/starlit-groove.svg',
				alt: 'Performer silhouetted against starry laser projections inside a dome',
			},
			tags: ['featured', 'new'],
		},
		{
			id: 'midnight-market',
			title: 'Midnight Makers Market',
			stage: 'Luminous Bazaar',
			dayLabel: 'Friday',
			area: 'Moonlit Midway',
			start: '2025-10-18T21:00:00-07:00',
			end: '2025-10-19T00:00:00-07:00',
			description:
				'After-dark market featuring regional artisans, neon glassblowers, cosmic cuisine, and one-night-only collaborations.',
			image: {
				src: '/images/events/midnight-market.svg',
				alt: 'Outdoor night market filled with glowing tents and visitors',
			},
			tags: ['classic'],
		},
		{
			id: 'sunrise-sound-bath',
			title: 'Sunrise Sound Bath',
			stage: 'Dawn Commons',
			dayLabel: 'Saturday',
			area: 'Lower Terrace',
			start: '2025-10-19T06:30:00-07:00',
			end: '2025-10-19T07:30:00-07:00',
			description:
				'Crystal bowl collective with desert botanicals and guided breathing, designed to realign festival-goers for day two.',
			image: {
				src: '/images/events/sunrise-sound-bath.svg',
				alt: 'Participants relaxing on mats during a colorful sunrise sound bath',
			},
			tags: ['new'],
		},
		{
			id: 'lunar-legends',
			title: 'Lunar Legends Showcase',
			stage: 'Legends Lookout',
			dayLabel: 'Saturday',
			area: 'Historic Guard Tower',
			start: '2025-10-19T19:00:00-07:00',
			end: '2025-10-19T21:30:00-07:00',
			description:
				'A curated lineup of Southwestern headliners and surprise guests paying tribute to Yuma\'s musical heritage under a full moon.',
			image: {
				src: '/images/events/lunar-legends.svg',
				alt: 'Band performing on an elevated tower stage with moon backdrop',
			},
			tags: ['featured'],
		},
		{
			id: 'cosmic-closer',
			title: 'Cosmic Closer B2B',
			stage: 'Gravity Well',
			dayLabel: 'Saturday',
			area: 'Outer Yard',
			start: '2025-10-19T22:00:00-07:00',
			end: '2025-10-20T00:30:00-07:00',
			description:
				'An interstellar back-to-back DJ finale with surprise collaborators and a synchronized drone show.',
			image: {
				src: '/images/events/cosmic-closer.svg',
				alt: 'DJs performing with drones lighting up the night sky',
			},
			tags: ['featured', 'classic'],
		},
	],
	schedule: {
		days: [
			{
				dayLabel: 'Friday',
				dateLabel: 'Oct 18',
				gatesOpen: '10:00 AM',
				eventIds: ['moonrise-ceremony', 'starlit-groove', 'midnight-market'],
			},
			{
				dayLabel: 'Saturday',
				dateLabel: 'Oct 19',
				gatesOpen: '10:00 AM',
				eventIds: ['sunrise-sound-bath', 'lunar-legends', 'cosmic-closer'],
			},
		],
	},
	gallery: [
		{ src: '/images/gallery/lantern-walk.svg', alt: 'Guests walking with paper lanterns' },
		{ src: '/images/gallery/dome-lights.svg', alt: 'Light dome pulsing with color' },
		{ src: '/images/gallery/fire-dancers.svg', alt: 'Fire dancers performing at night' },
		{ src: '/images/gallery/drone-show.svg', alt: 'Drone show forming a wolf howling' },
	],
	sponsors: [
		{
			name: 'Lunar Labs',
			tier: 'Premier',
			description: 'Innovators in immersive stage lighting and responsive projection systems.',
		},
		{
			name: 'Desert Bloom Coffee',
			tier: 'Stage',
			description: 'Keeping the overnight crowd energized with roasted-on-site brews.',
		},
		{
			name: 'Yuma Arts Coalition',
			tier: 'Community',
			description: 'Supporting regional creatives through year-round programming.',
		},
		{
			name: 'Stargazer Outfitters',
			tier: 'Stage',
			description: 'Night-vision ready apparel and reflective wear for nocturnal explorers.',
		},
	],
	faqs: [
		{
			question: 'What are the festival hours?',
			answer:
				'Gates open at 10:00 AM each day. Programming runs until 12:30 AM with chill-out zones open until 2:00 AM.',
		},
		{
			question: 'Is re-entry allowed?',
			answer: 'Yes, re-entry is permitted until 10:00 PM each evening with a valid wristband scan.',
		},
		{
			question: 'Are kids welcome?',
			answer:
				'All ages are welcome until 10:00 PM. After 10:00 PM, the festival shifts to 18+ programming. Kids under 12 attend free with a guardian.',
		},
		{
			question: 'What should I bring?',
			answer:
				'Layered clothing, a refillable water bottle, comfortable footwear for uneven terrain, and a light to guide your way between stages.',
		},
	],
};

function clone<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value)) as T;
}

function createFallbackFestivalContent(): FestivalContent {
	const fallback = clone(fallbackFestivalContentTemplate);
	fallback.meta.generatedAt = new Date().toISOString();
	return fallback;
}

function normalizeEventDetail(event: EventDetailPayload): EventDetail | null {
	if (!event || !event.id || !event.title || !event.stage || !event.dayLabel || !event.area || !event.start || !event.end) {
		return null;
	}
	if (!event.image || !event.image.src) {
		return null;
	}
	return {
		id: event.id,
		title: event.title,
		stage: event.stage,
		dayLabel: event.dayLabel,
		area: event.area,
		start: event.start,
		end: event.end,
		description: event.description ?? '',
		image: {
			src: event.image.src,
			alt: event.image.alt ?? '',
		},
		tags: event.tags ?? [],
	};
}

function normalizeFestivalContent(payload: IntegrationApiResponse): FestivalContent | null {
	if (!payload.meta || !payload.meta.siteSlug || !payload.meta.siteName || !payload.meta.sourcePageId) {
		return null;
	}
	const events = (payload.events ?? [])
		.map(normalizeEventDetail)
		.filter((event): event is EventDetail => Boolean(event));
	return {
		meta: {
			siteSlug: payload.meta.siteSlug,
			siteName: payload.meta.siteName,
			sourcePageId: payload.meta.sourcePageId,
			generatedAt: payload.meta.generatedAt ?? new Date().toISOString(),
		},
		hero: payload.hero,
		stats: payload.stats ?? [],
		events,
		schedule: {
			days: payload.schedule?.days ?? [],
		},
		gallery: payload.gallery ?? [],
		sponsors: payload.sponsors ?? [],
		faqs: payload.faqs ?? [],
	};
}

function parseCacheControl(header: string | null): { maxAgeMs: number; staleWhileRevalidateMs: number } {
	const defaults = { maxAgeMs: 120_000, staleWhileRevalidateMs: 300_000 };
	if (!header) {
		return defaults;
	}
	const directives = header
		.split(',')
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
	let maxAge = defaults.maxAgeMs;
	let stale = defaults.staleWhileRevalidateMs;
	for (const directive of directives) {
		const [key, value] = directive.split('=').map((part) => part.trim());
		if (key === 'max-age' && value) {
			const parsed = Number(value);
			if (!Number.isNaN(parsed)) {
				maxAge = parsed * 1000;
			}
		}
		if (key === 'stale-while-revalidate' && value) {
			const parsed = Number(value);
			if (!Number.isNaN(parsed)) {
				stale = parsed * 1000;
			}
		}
	}
	return { maxAgeMs: maxAge, staleWhileRevalidateMs: stale };
}

async function requestFestivalContent(siteSlug: string): Promise<{ content: FestivalContent; cache: { maxAgeMs: number; staleWhileRevalidateMs: number } } | null> {
	if (!API_KEY) {
		console.warn('WEBE_API_KEY is not set. Falling back to local mock data.');
		return null;
	}
	const url = `${API_BASE_URL}/${siteSlug}`;
	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'User-Agent': 'HowlinIntegration/1.0 (+astro)',
				'x-api-key': API_KEY,
			},
			cache: 'no-store',
		});
		if (response.status === 401) {
			console.error('WeBeFriends API returned 401 (unauthorized). Check the API key configuration.');
			return null;
		}
		if (response.status === 404) {
			console.error(`WeBeFriends API returned 404. Verify that the site slug "${siteSlug}" is correct.`);
			return null;
		}
		if (!response.ok) {
			console.error(`WeBeFriends API request failed with status ${response.status}.`);
			return null;
		}
		const payload = (await response.json()) as IntegrationApiResponse;
		const normalized = normalizeFestivalContent(payload);
		if (!normalized) {
			console.warn('Received an unexpected payload from WeBeFriends. Falling back to mock data.');
			return null;
		}
		return {
			content: normalized,
			cache: parseCacheControl(response.headers.get('cache-control')),
		};
	} catch (error) {
		console.error('Failed to reach the WeBeFriends API. Falling back to cached or mock data.', error);
		return null;
	}
}

export async function fetchFestivalContent(siteSlug: string = DEFAULT_SITE_SLUG): Promise<FestivalContent> {
	const now = Date.now();
	const cached = cache.get(siteSlug);
	if (cached && now < cached.expiresAt) {
		return clone(cached.data);
	}

	const fallbackWithinStaleWindow = cached && now < cached.staleAt ? cached.data : null;
	const remote = await requestFestivalContent(siteSlug);
	if (remote) {
		const { content, cache: cacheMetadata } = remote;
		cache.set(siteSlug, {
			data: content,
			expiresAt: now + cacheMetadata.maxAgeMs,
			staleAt: now + cacheMetadata.maxAgeMs + cacheMetadata.staleWhileRevalidateMs,
		});
		return clone(content);
	}
	if (fallbackWithinStaleWindow) {
		console.warn('Serving stale WeBeFriends content from cache.');
		return clone(fallbackWithinStaleWindow);
	}
	const fallback = createFallbackFestivalContent();
	cache.set(siteSlug, {
		data: fallback,
		expiresAt: now + 120_000,
		staleAt: now + 420_000,
	});
	return fallback;
}
