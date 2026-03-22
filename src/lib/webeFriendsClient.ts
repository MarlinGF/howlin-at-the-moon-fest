import { firestore } from './firebaseAdmin';
import type { ConnectedModulePayload } from './connectedModules';
import { extractConnectedModules } from './connectedModules';
import { buildScheduleFromEvents, filterUpcomingEvents } from './eventUtils';
import type {
	ConnectedModule,
	CtaLink,
	EventDetail,
	FaqItem,
	FestivalContent,
	FestivalStat,
	HeroBlock,
	ImageAsset,
	IntegrationMeta,
	MediaCollection,
	PopupBlock,
	Schedule,
	ScheduleDay,
	Sponsor,
	VideoAsset,
} from './webeTypes';

export type {
	CtaLink,
	EventDetail,
	FaqItem,
	FestivalContent,
	ConnectedModule,
	FestivalStat,
	HeroBlock,
	ImageAsset,
	IntegrationMeta,
	MediaCollection,
	PopupBlock,
	Schedule,
	ScheduleDay,
	Sponsor,
	VideoAsset,
} from './webeTypes';

type IntegrationApiResponse = ConnectedModulePayload & {
	meta?: Partial<IntegrationMeta>;
};

type CachedFestivalContent = {
	content: FestivalContent;
	cachedAt?: string;
};

const DEFAULT_API_ORIGIN = 'https://webefriends.com';
const API_BASE_URL = (() => {
	const configured =
		import.meta.env.WEBE_API_BASE_URL ??
		import.meta.env.WEBE_API_BASE ??
		DEFAULT_API_ORIGIN;
	const trimmed = configured.replace(/\/+$/, '');
	return trimmed.endsWith('/api/integrations') ? trimmed : `${trimmed}/api/integrations`;
})();
const DEFAULT_SITE_SLUG = import.meta.env.WEBE_SITE_SLUG ?? 'howlin-yuma';
const API_KEY = import.meta.env.WEBE_API_KEY;

const SITES_COLLECTION = 'webeSites';

const serializeForStore = <T>(value: T): T => {
	try {
		return JSON.parse(JSON.stringify(value)) as T;
	} catch (error) {
		console.warn('Unable to serialise integration content for storage', error);
		return value;
	}
};

const readCachedFestivalContent = async (siteSlug: string): Promise<CachedFestivalContent | null> => {
	try {
		const snapshot = await firestore.collection(SITES_COLLECTION).doc(siteSlug).get();
		if (!snapshot.exists) {
			return null;
		}
		const data = snapshot.data();
		if (!data || typeof data !== 'object' || !('content' in data)) {
			return null;
		}
		const content = data.content as FestivalContent | undefined;
		if (!content) {
			return null;
		}
		const cachedAt = typeof data.cachedAt === 'string' ? data.cachedAt : undefined;
		return { content: clone(content), cachedAt };
	} catch (error) {
		console.warn('Unable to load cached WeBeFriends content from Firestore.', error);
		return null;
	}
};

const writeCachedFestivalContent = async (siteSlug: string, content: FestivalContent): Promise<void> => {
	try {
		await firestore
			.collection(SITES_COLLECTION)
			.doc(siteSlug)
			.set(
				{
					siteSlug,
					cachedAt: new Date().toISOString(),
					content: serializeForStore(content),
				},
				{ merge: true }
			);
	} catch (error) {
		console.warn('Unable to cache WeBeFriends content in Firestore.', error);
	}
};


const fallbackFestivalContentTemplate: FestivalContent = (() => {
	const eventsSeed: EventDetail[] = [
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
	];

	return {
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
		events: eventsSeed,
		eventsAll: eventsSeed,
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
		popups: [],
		videos: [
			{
				src: '/videos/howl-crowd.mp4',
				title: 'Crowd highlight reel from Howlin at the Moon',
				autoplay: true,
				loop: true,
				muted: true,
				playsinline: true,
				placement: ['hero', 'frontpage'],
			},
		],
		mediaCollections: [],
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
		modules: [],
	};
})();

function clone<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyFestivalContent(siteSlug: string = DEFAULT_SITE_SLUG): FestivalContent {
	return {
		meta: {
			siteSlug,
			siteName: fallbackFestivalContentTemplate.meta.siteName,
			sourcePageId: 'webe-source-page',
			generatedAt: new Date().toISOString(),
		},
		hero: undefined,
		stats: [],
		events: [],
		eventsAll: [],
		schedule: { days: [] },
		gallery: [],
		popups: [],
		videos: [],
		mediaCollections: [],
		sponsors: [],
		faqs: [],
		modules: [],
	};
}

function createFallbackFestivalContent(): FestivalContent {
	const fallback = clone(fallbackFestivalContentTemplate);
	fallback.meta.generatedAt = new Date().toISOString();
	fallback.modules = [
		{ type: 'hero', enabled: Boolean(fallback.hero), source: 'top-level', itemCount: fallback.hero ? 1 : 0 },
		{ type: 'stats', enabled: fallback.stats.length > 0, source: 'top-level', itemCount: fallback.stats.length },
		{ type: 'events', enabled: fallback.events.length > 0, source: 'top-level', itemCount: fallback.events.length },
		{ type: 'gallery', enabled: fallback.gallery.length > 0, source: 'top-level', itemCount: fallback.gallery.length },
		{ type: 'video', enabled: fallback.videos.length > 0, source: 'top-level', itemCount: fallback.videos.length },
	];
	const fallbackGates = new Map<string, string>();
	fallback.schedule.days.forEach((day) => {
		fallbackGates.set(day.dayLabel, day.gatesOpen);
	});
	const includeEmptyDays = fallback.schedule.days.map((day) => ({
		dayLabel: day.dayLabel,
		dateLabel: day.dateLabel,
		gatesOpen: day.gatesOpen,
		eventIds: [],
	}));
	const upcoming = filterUpcomingEvents(fallback.events);
	fallback.events = upcoming;
	fallback.schedule = buildScheduleFromEvents(upcoming, {
		fallbackGates,
		includeEmptyDays,
	});
	return fallback;
}

function refreshFestivalContent(content: FestivalContent, options?: { now?: Date }): FestivalContent {
	const pivot = options?.now ?? new Date();
	const copy = clone(content);
	copy.popups = Array.isArray(copy.popups) ? copy.popups : [];
	copy.videos = Array.isArray(copy.videos) ? copy.videos : [];
	copy.mediaCollections = Array.isArray(copy.mediaCollections) ? copy.mediaCollections : [];
	copy.modules = Array.isArray(copy.modules) ? copy.modules : [];
	const sourceEvents = Array.isArray(copy.eventsAll) && copy.eventsAll.length > 0 ? copy.eventsAll : copy.events;
	const upcoming = filterUpcomingEvents(sourceEvents, { now: pivot });
	const fallbackGates = new Map<string, string>();
	const includeEmptyDays: ScheduleDay[] = [];
	if (copy.schedule && Array.isArray(copy.schedule.days)) {
		copy.schedule.days.forEach((day) => {
			fallbackGates.set(day.dayLabel, day.gatesOpen);
			includeEmptyDays.push({
				dayLabel: day.dayLabel,
				dateLabel: day.dateLabel,
				gatesOpen: day.gatesOpen,
				eventIds: [],
			});
		});
	}
	copy.eventsAll = sourceEvents.map((event) => ({ ...event }));
	copy.events = upcoming;
	copy.schedule = buildScheduleFromEvents(upcoming, {
		fallbackGates,
		includeEmptyDays,
	});
	return copy;
}

function normalizeFestivalContent(payload: IntegrationApiResponse): FestivalContent | null {
	const meta = payload.meta ?? {};
	const siteSlug = typeof meta.siteSlug === 'string' && meta.siteSlug.trim().length > 0 ? meta.siteSlug : DEFAULT_SITE_SLUG;
	const siteName = typeof meta.siteName === 'string' && meta.siteName.trim().length > 0 ? meta.siteName : fallbackFestivalContentTemplate.meta.siteName;
	const sourcePageId = typeof meta.sourcePageId === 'string' && meta.sourcePageId.trim().length > 0 ? meta.sourcePageId : fallbackFestivalContentTemplate.meta.sourcePageId;
	const generatedAt = typeof meta.generatedAt === 'string' && meta.generatedAt.trim().length > 0 ? meta.generatedAt : new Date().toISOString();
	if (!siteSlug || !siteName || !sourcePageId) {
		return null;
	}
	const extracted = extractConnectedModules(payload, {
		logger: console,
		sourcePageId,
	});
	const scheduleDays = extracted.scheduleDays;
	const fallbackGates = new Map<string, string>();
	scheduleDays.forEach((day) => {
		fallbackGates.set(day.dayLabel, day.gatesOpen);
	});
	const includeEmptyDays = scheduleDays.map((day) => ({
		dayLabel: day.dayLabel,
		dateLabel: day.dateLabel,
		gatesOpen: day.gatesOpen,
		eventIds: [],
	}));
	const eventsAll = extracted.eventsAll;
	const upcomingEvents = filterUpcomingEvents(eventsAll);
	const schedule = buildScheduleFromEvents(upcomingEvents, {
		fallbackGates,
		includeEmptyDays,
	});
	return {
		meta: {
			siteSlug,
			siteName,
			sourcePageId,
			generatedAt,
		},
		hero: extracted.hero,
		stats: extracted.stats,
		events: upcomingEvents,
		eventsAll,
		schedule,
		gallery: extracted.gallery,
		popups: extracted.popups,
		videos: extracted.videos,
		mediaCollections: extracted.mediaCollections,
		sponsors: extracted.sponsors,
		faqs: extracted.faqs,
		modules: extracted.modules,
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
		console.warn('WEBE_API_KEY is not set. Live WeBe content cannot be fetched.');
		return null;
	}
	const url = `${API_BASE_URL}/${siteSlug}`;
	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${API_KEY}`,
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
		console.log('WeBe Payload:', payload);
		const normalized = normalizeFestivalContent(payload);
		console.log('Normalized Content:', normalized);
		console.log('Events After Normalize:', normalized?.events);
		if (!normalized) {
			console.warn('Received an unexpected payload from WeBeFriends.');
			return null;
		}
		return {
			content: normalized,
			cache: parseCacheControl(response.headers.get('cache-control')),
		};
	} catch (error) {
		if (error instanceof TypeError) {
			console.error(
				'WeBeFriends API request failed due to a network or CORS issue. Confirm the origin allowlist and API credentials.',
				error
			);
		} else {
			console.error('Failed to reach the WeBeFriends API. Falling back to cached or mock data.', error);
		}
		return null;
	}
}

export async function fetchFestivalContent(siteSlug: string = DEFAULT_SITE_SLUG): Promise<FestivalContent> {
	const remote = await requestFestivalContent(siteSlug);
	if (remote) {
		const { content } = remote;
		const refreshed = refreshFestivalContent(content, { now: new Date() });
		void writeCachedFestivalContent(siteSlug, refreshed);
		return clone(refreshed);
	}

	const stored = await readCachedFestivalContent(siteSlug);
	if (stored) {
		const { content } = stored;
		const refreshed = refreshFestivalContent(content, { now: new Date() });
		return clone(refreshed);
	}

	return createEmptyFestivalContent(siteSlug);
}
