import { firestore } from './firebaseAdmin';
import { buildScheduleFromEvents, filterUpcomingEvents } from './eventUtils';
import type {
	CtaLink,
	EventDetail,
	FaqItem,
	FestivalContent,
	FestivalStat,
	HeroBlock,
	ImageAsset,
	IntegrationMeta,
	Schedule,
	ScheduleDay,
	Sponsor,
} from './webeTypes';

export type {
	CtaLink,
	EventDetail,
	FaqItem,
	FestivalContent,
	FestivalStat,
	HeroBlock,
	ImageAsset,
	IntegrationMeta,
	Schedule,
	ScheduleDay,
	Sponsor,
} from './webeTypes';

type EventDetailPayload = Omit<EventDetail, 'description' | 'image' | 'tags' | 'metadata'> & {
	description?: string;
	image?: ImageAsset;
	tags?: string[];
	metadata?: Record<string, unknown>;
	date?: string;
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

type CachedFestivalContent = {
	content: FestivalContent;
	cachedAt?: string;
};

const API_BASE_URL = (import.meta.env.WEBE_API_BASE ?? 'https://webefriends.com/api/integrations').replace(/\/?$/, '');
const DEFAULT_SITE_SLUG = import.meta.env.WEBE_SITE_SLUG ?? 'howlin-yuma';
const API_KEY = import.meta.env.WEBE_API_KEY;

const cache = new Map<string, CacheEntry>();
const SITES_COLLECTION = 'webeSites';
const FIRESTORE_CACHE_TTL_MS = 5 * 60 * 1000;

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function coerceArray<T>(value: unknown): T[] {
	if (Array.isArray(value)) {
		return value as T[];
	}
	if (isRecord(value)) {
		const withData = value as { data?: unknown; items?: unknown } & Record<string, unknown>;
		if (Array.isArray(withData.data)) {
			return withData.data as T[];
		}
		if (Array.isArray(withData.items)) {
			return withData.items as T[];
		}
		return Object.values(value) as T[];
	}
	return [];
}

function normalizeScheduleDay(input: unknown): ScheduleDay | null {
	if (!isRecord(input)) {
		return null;
	}
	const dayLabelRaw = input.dayLabel;
	const dateLabelRaw = input.dateLabel;
	const gatesOpenRaw = input.gatesOpen;
	const eventIdsRaw = input.eventIds;
	if (typeof dayLabelRaw !== 'string' || dayLabelRaw.trim().length === 0) {
		return null;
	}
	if (typeof dateLabelRaw !== 'string' || dateLabelRaw.trim().length === 0) {
		return null;
	}
	const gatesOpen = typeof gatesOpenRaw === 'string' && gatesOpenRaw.trim().length > 0 ? gatesOpenRaw : '10:00 AM';
	const eventIds = coerceArray<unknown>(eventIdsRaw).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
	return {
		dayLabel: dayLabelRaw,
		dateLabel: dateLabelRaw,
		gatesOpen,
		eventIds,
	};
}

function createFallbackFestivalContent(): FestivalContent {
	const fallback = clone(fallbackFestivalContentTemplate);
	fallback.meta.generatedAt = new Date().toISOString();
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
	const upcoming = filterUpcomingEvents(copy.events, { now: pivot });
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
	copy.events = upcoming;
	copy.schedule = buildScheduleFromEvents(upcoming, {
		fallbackGates,
		includeEmptyDays,
	});
	return copy;
}

function normalizeEventDetail(event: EventDetailPayload): EventDetail | null {
	if (!event || !event.id || !event.title || !event.stage || !event.dayLabel || !event.area || !event.start || !event.end) {
		return null;
	}
	if (!event.image || !event.image.src) {
		return null;
	}
	const tags = Array.isArray(event.tags)
		? event.tags.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
		: [];
	const detail: EventDetail = {
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
		tags,
	};
	if (typeof event.slug === 'string' && event.slug.trim().length > 0) {
		detail.slug = event.slug.trim();
	}
	if (typeof event.gatesOpenAt === 'string' && event.gatesOpenAt.trim().length > 0) {
		detail.gatesOpenAt = event.gatesOpenAt.trim();
	}
	if (typeof event.date === 'string' && event.date.trim().length > 0) {
		detail.dateLabel = event.date.trim();
	}
	if ('recurrence' in event && event.recurrence !== undefined) {
		detail.recurrence = event.recurrence as EventDetail['recurrence'];
	}
	const knownKeys = new Set([
		'id',
		'title',
		'stage',
		'dayLabel',
		'area',
		'start',
		'end',
		'description',
		'image',
		'tags',
		'slug',
		'gatesOpenAt',
		'date',
		'dateLabel',
		'recurrence',
		'metadata',
	]);
	const metadata: Record<string, unknown> = {};
	if (event.metadata && typeof event.metadata === 'object') {
		Object.assign(metadata, event.metadata);
	}
	Object.entries(event as Record<string, unknown>).forEach(([key, value]) => {
		if (knownKeys.has(key)) {
			return;
		}
		if (value !== undefined && value !== null) {
			metadata[key] = value;
		}
	});
	if (Object.keys(metadata).length > 0) {
		detail.metadata = metadata;
	}
	return detail;
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
	const events = coerceArray<EventDetailPayload>(payload.events)
		.map(normalizeEventDetail)
		.filter((event): event is EventDetail => Boolean(event));
	const scheduleDays = coerceArray<unknown>(payload.schedule?.days)
		.map(normalizeScheduleDay)
		.filter((day): day is ScheduleDay => Boolean(day));
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
	const upcomingEvents = filterUpcomingEvents(events);
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
		hero: payload.hero,
		stats: coerceArray<FestivalStat>(payload.stats),
		events: upcomingEvents,
		schedule,
		gallery: coerceArray<ImageAsset>(payload.gallery),
		sponsors: coerceArray<Sponsor>(payload.sponsors),
		faqs: coerceArray<FaqItem>(payload.faqs),
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
	const now = Date.now();
	const pivot = new Date(now);
	const memoryEntry = cache.get(siteSlug);
	if (memoryEntry && now < memoryEntry.expiresAt) {
		const refreshed = refreshFestivalContent(memoryEntry.data, { now: pivot });
		cache.set(siteSlug, { ...memoryEntry, data: refreshed });
		return clone(refreshed);
	}

	const staleEntry = memoryEntry && now < memoryEntry.staleAt ? memoryEntry.data : null;

	const remote = await requestFestivalContent(siteSlug);
	if (remote) {
		const { content, cache: cacheMetadata } = remote;
		const refreshed = refreshFestivalContent(content, { now: pivot });
		cache.set(siteSlug, {
			data: refreshed,
			expiresAt: now + cacheMetadata.maxAgeMs,
			staleAt: now + cacheMetadata.maxAgeMs + cacheMetadata.staleWhileRevalidateMs,
		});
		void writeCachedFestivalContent(siteSlug, refreshed);
		return clone(refreshed);
	}

	const stored = await readCachedFestivalContent(siteSlug);
	if (stored) {
		const { content, cachedAt } = stored;
		const refreshed = refreshFestivalContent(content, { now: pivot });
		const cachedAtMs = cachedAt ? Date.parse(cachedAt) : Number.NaN;
		const ageMs = Number.isFinite(cachedAtMs) ? now - cachedAtMs : Number.POSITIVE_INFINITY;
		const remainingTtl = Math.max(FIRESTORE_CACHE_TTL_MS - ageMs, 0);
		cache.set(siteSlug, {
			data: refreshed,
			expiresAt: now + remainingTtl,
			staleAt: now + FIRESTORE_CACHE_TTL_MS,
		});
		return clone(refreshed);
	}

	if (staleEntry) {
		console.warn('Serving stale WeBeFriends content from cache.');
		const refreshed = refreshFestivalContent(staleEntry, { now: pivot });
		cache.set(siteSlug, {
			data: refreshed,
			expiresAt: now + 30_000,
			staleAt: now + 30_000,
		});
		return clone(refreshed);
	}

	const fallback = createFallbackFestivalContent();
	const refreshedFallback = refreshFestivalContent(fallback, { now: pivot });
	cache.set(siteSlug, {
		data: refreshedFallback,
		expiresAt: now + 120_000,
		staleAt: now + 420_000,
	});
	void writeCachedFestivalContent(siteSlug, refreshedFallback);
	return clone(refreshedFallback);
}
