import type {
	ConnectedModule,
	CtaLink,
	EventDetail,
	FaqItem,
	FestivalStat,
	HeroBlock,
	ImageAsset,
	MediaCollection,
	PopupBlock,
	ScheduleDay,
	Sponsor,
	VideoAsset,
} from './webeTypes';

type UnknownRecord = Record<string, unknown>;

type Logger = Pick<Console, 'info' | 'warn'>;

type RawBlock = {
	type?: unknown;
	blockType?: unknown;
	moduleType?: unknown;
	enabled?: unknown;
	visible?: unknown;
	placement?: unknown;
	placements?: unknown;
	data?: unknown;
	payload?: unknown;
	content?: unknown;
	items?: unknown;
	id?: unknown;
	[key: string]: unknown;
};

export type ConnectedModulePayload = {
	hero?: HeroBlock;
	stats?: FestivalStat[];
	events?: unknown;
	schedule?: {
		days?: unknown;
	};
	gallery?: unknown;
	popups?: unknown;
	videos?: unknown;
	mediaCollections?: unknown;
	sponsors?: unknown;
	faqs?: unknown;
	blocks?: unknown;
	modules?: unknown;
	contentBlocks?: unknown;
};

export type ConnectedModuleExtraction = {
	hero?: HeroBlock;
	stats: FestivalStat[];
	eventsAll: EventDetail[];
	scheduleDays: ScheduleDay[];
	gallery: ImageAsset[];
	popups: PopupBlock[];
	videos: VideoAsset[];
	mediaCollections: MediaCollection[];
	sponsors: Sponsor[];
	faqs: FaqItem[];
	modules: ConnectedModule[];
	unknownBlockTypes: string[];
};

const FRONT_PAGE_PLACEMENTS = new Set(['frontpage', 'front-page', 'homepage', 'home', 'index', 'all', '*']);

const ensureRecord = (value: unknown): UnknownRecord | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	return value as UnknownRecord;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const coerceArray = <T>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}
	const record = ensureRecord(value);
	if (!record) {
		return [];
	}
	if (Array.isArray(record.data)) {
		return record.data as T[];
	}
	if (Array.isArray(record.items)) {
		return record.items as T[];
	}
	return Object.values(record) as T[];
};

const dedupeByKey = <T>(items: T[], getKey: (item: T) => string): T[] => {
	const seen = new Set<string>();
	const unique: T[] = [];
	for (const item of items) {
		const key = getKey(item);
		if (!key || seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(item);
	}
	return unique;
};

const normalizeCta = (value: unknown): CtaLink | undefined => {
	const record = ensureRecord(value);
	if (!record) {
		return undefined;
	}
	const label = record.label;
	const href = record.href;
	if (!isNonEmptyString(label) || !isNonEmptyString(href)) {
		return undefined;
	}
	return {
		label: label.trim(),
		href: href.trim(),
	};
};

const normalizeImage = (value: unknown): ImageAsset | null => {
	const record = ensureRecord(value);
	if (!record) {
		return null;
	}
	if (!isNonEmptyString(record.src)) {
		return null;
	}
	return {
		src: record.src.trim(),
		alt: isNonEmptyString(record.alt) ? record.alt.trim() : '',
	};
};

const normalizeVideo = (value: unknown): VideoAsset | null => {
	const record = ensureRecord(value);
	if (!record) {
		return null;
	}
	const srcCandidate = isNonEmptyString(record.src)
		? record.src
		: isNonEmptyString(record.url)
			? record.url
			: isNonEmptyString(record.videoUrl)
				? record.videoUrl
				: undefined;
	if (!srcCandidate) {
		return null;
	}
	const source = srcCandidate.trim().toLowerCase();
	const declaredType = isNonEmptyString(record.type) ? record.type.trim().toLowerCase() : '';
	const declaredMediaType = isNonEmptyString(record.mediaType) ? record.mediaType.trim().toLowerCase() : '';
	const declaredMime = isNonEmptyString(record.mimeType) ? record.mimeType.trim().toLowerCase() : '';
	const looksLikeVideo =
		source.endsWith('.mp4') ||
		source.endsWith('.webm') ||
		source.endsWith('.mov') ||
		source.endsWith('.m3u8') ||
		declaredType.includes('video') ||
		declaredMediaType.includes('video') ||
		declaredMime.includes('video');
	if (!looksLikeVideo) {
		return null;
	}
	const placement = normalizePlacement(record.placement ?? record.placements ?? record.position);
	return {
		src: srcCandidate.trim(),
		title: isNonEmptyString(record.title) ? record.title.trim() : undefined,
		description: isNonEmptyString(record.description) ? record.description.trim() : undefined,
		poster: isNonEmptyString(record.poster) ? record.poster.trim() : undefined,
		autoplay: Boolean(record.autoplay),
		loop: record.loop === undefined ? true : Boolean(record.loop),
		muted: record.muted === undefined ? true : Boolean(record.muted),
		playsinline: record.playsinline === undefined ? true : Boolean(record.playsinline),
		placement,
	};
};

const normalizePopup = (value: unknown, index: number): PopupBlock | null => {
	const record = ensureRecord(value);
	if (!record) {
		return null;
	}
	const titleRaw = isNonEmptyString(record.title)
		? record.title
		: isNonEmptyString(record.heading)
			? record.heading
			: undefined;
	if (!titleRaw) {
		return null;
	}
	const id = isNonEmptyString(record.id) ? record.id.trim() : `popup-${index + 1}`;
	const message = isNonEmptyString(record.message)
		? record.message.trim()
		: isNonEmptyString(record.body)
			? record.body.trim()
			: isNonEmptyString(record.description)
				? record.description.trim()
				: undefined;
	const enabled = record.enabled === undefined ? true : Boolean(record.enabled);
	return {
		id,
		title: titleRaw.trim(),
		message,
		placement: normalizePlacement(record.placement ?? record.placements ?? record.position),
		enabled,
		dismissible: record.dismissible === undefined ? true : Boolean(record.dismissible),
		primaryCta: normalizeCta(record.primaryCta ?? record.primaryCTA ?? record.cta),
		secondaryCta: normalizeCta(record.secondaryCta ?? record.secondaryCTA),
	};
};

const normalizeMediaCollection = (value: unknown, index: number): MediaCollection | null => {
	const record = ensureRecord(value);
	if (!record) {
		return null;
	}
	const itemsRaw = coerceArray<unknown>(record.items ?? record.media ?? record.assets ?? record.gallery);
	const items = itemsRaw
		.map((item) => {
			const video = normalizeVideo(item);
			if (video) {
				return video;
			}
			const image = normalizeImage(item);
			if (image) {
				return image;
			}
			return null;
		})
		.filter((item): item is ImageAsset | VideoAsset => Boolean(item));
	if (items.length === 0) {
		return null;
	}
	return {
		id: isNonEmptyString(record.id) ? record.id.trim() : `media-collection-${index + 1}`,
		title: isNonEmptyString(record.title) ? record.title.trim() : undefined,
		description: isNonEmptyString(record.description) ? record.description.trim() : undefined,
		items,
		enabled: record.enabled === undefined ? true : Boolean(record.enabled),
	};
};

const normalizeFestivalStat = (value: unknown): FestivalStat | null => {
	const record = ensureRecord(value);
	if (!record || !isNonEmptyString(record.label)) {
		return null;
	}
	const rawValue = record.value;
	if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
		return null;
	}
	return {
		label: record.label.trim(),
		value: rawValue,
	};
};

const normalizeFaq = (value: unknown): FaqItem | null => {
	const record = ensureRecord(value);
	if (!record || !isNonEmptyString(record.question) || !isNonEmptyString(record.answer)) {
		return null;
	}
	return {
		question: record.question.trim(),
		answer: record.answer.trim(),
	};
};

const normalizeSponsor = (value: unknown): Sponsor | null => {
	const record = ensureRecord(value);
	if (!record || !isNonEmptyString(record.name)) {
		return null;
	}
	return {
		name: record.name.trim(),
		tier: isNonEmptyString(record.tier) ? record.tier.trim() : 'Partner',
		description: isNonEmptyString(record.description) ? record.description.trim() : '',
	};
};

const normalizeHero = (value: unknown): HeroBlock | undefined => {
	const record = ensureRecord(value);
	if (!record || !isNonEmptyString(record.title)) {
		return undefined;
	}
	const background = normalizeImage(record.background);
	return {
		title: record.title.trim(),
		kicker: isNonEmptyString(record.kicker) ? record.kicker.trim() : undefined,
		tagline: isNonEmptyString(record.tagline) ? record.tagline.trim() : undefined,
		description: isNonEmptyString(record.description) ? record.description.trim() : undefined,
		primaryCta: normalizeCta(record.primaryCta),
		secondaryCta: normalizeCta(record.secondaryCta),
		background: background ?? undefined,
	};
};

const normalizeScheduleDay = (value: unknown): ScheduleDay | null => {
	const record = ensureRecord(value);
	if (!record || !isNonEmptyString(record.dayLabel) || !isNonEmptyString(record.dateLabel)) {
		return null;
	}
	const eventIds = coerceArray<unknown>(record.eventIds)
		.filter((entry): entry is string => isNonEmptyString(entry))
		.map((entry) => entry.trim());
	return {
		dayLabel: record.dayLabel.trim(),
		dateLabel: record.dateLabel.trim(),
		gatesOpen: isNonEmptyString(record.gatesOpen) ? record.gatesOpen.trim() : '10:00 AM',
		eventIds,
	};
};

const normalizeEvent = (value: unknown): EventDetail | null => {
	const record = ensureRecord(value);
	if (!record) {
		return null;
	}
	const requiredFields = [record.id, record.title, record.stage, record.dayLabel, record.area, record.start, record.end];
	if (!requiredFields.every((field) => isNonEmptyString(field))) {
		return null;
	}
	const id = record.id as string;
	const title = record.title as string;
	const stage = record.stage as string;
	const dayLabel = record.dayLabel as string;
	const area = record.area as string;
	const start = record.start as string;
	const end = record.end as string;
	const image = normalizeImage(record.image);
	if (!image) {
		return null;
	}
	const metadata = ensureRecord(record.metadata) ?? {};
	const tags = coerceArray<unknown>(record.tags)
		.filter((entry): entry is string => isNonEmptyString(entry))
		.map((entry) => entry.trim());
	const event: EventDetail = {
		id: id.trim(),
		title: title.trim(),
		stage: stage.trim(),
		dayLabel: dayLabel.trim(),
		area: area.trim(),
		start: start.trim(),
		end: end.trim(),
		description: isNonEmptyString(record.description) ? record.description.trim() : '',
		image,
		tags,
	};
	if (isNonEmptyString(record.slug)) {
		event.slug = record.slug.trim();
	}
	if (isNonEmptyString(record.gatesOpenAt)) {
		event.gatesOpenAt = record.gatesOpenAt.trim();
	}
	if (isNonEmptyString(record.dateLabel) || isNonEmptyString(record.date)) {
		event.dateLabel = isNonEmptyString(record.dateLabel) ? record.dateLabel.trim() : String(record.date).trim();
	}
	if (record.recurrence !== undefined) {
		event.recurrence = record.recurrence as EventDetail['recurrence'];
	}
	if (Object.keys(metadata).length > 0) {
		event.metadata = { ...metadata };
	}
	return event;
};

const normalizePlacement = (value: unknown): string[] => {
	const values = coerceArray<unknown>(value)
		.filter((entry): entry is string => isNonEmptyString(entry))
		.map((entry) => entry.trim().toLowerCase());
	if (values.length > 0) {
		return values;
	}
	if (isNonEmptyString(value)) {
		return [value.trim().toLowerCase()];
	}
	return ['frontpage'];
};

const moduleTypeAliasMap: Record<string, string> = {
	hero: 'hero',
	stats: 'stats',
	events: 'events',
	event: 'events',
	eventupdates: 'events',
	'event-updates': 'events',
	schedule: 'schedule',
	gallery: 'gallery',
	media: 'mediaCollection',
	mediacollection: 'mediaCollection',
	'media-collection': 'mediaCollection',
	photos: 'gallery',
	images: 'gallery',
	popups: 'popup',
	popup: 'popup',
	announcement: 'popup',
	modal: 'popup',
	videos: 'video',
	video: 'video',
	sponsors: 'sponsors',
	faqs: 'faqs',
	faq: 'faqs',
};

const normalizeRawBlock = (value: unknown): { type: string; enabled: boolean; data: unknown; placement: string[] } | null => {
	const record = ensureRecord(value);
	if (!record) {
		return null;
	}
	const typeCandidate = record.type ?? record.blockType ?? record.moduleType;
	if (!isNonEmptyString(typeCandidate)) {
		return null;
	}
	const normalizedToken = typeCandidate.trim().toLowerCase();
	const normalizedType = moduleTypeAliasMap[normalizedToken] ?? normalizedToken;
	const data = record.data ?? record.payload ?? record.content ?? record;
	const enabled = (record.enabled === undefined ? true : Boolean(record.enabled)) && (record.visible === undefined ? true : Boolean(record.visible));
	return {
		type: normalizedType,
		enabled,
		data,
		placement: normalizePlacement(record.placement ?? record.placements),
	};
};

const isImageAsset = (item: ImageAsset | VideoAsset): item is ImageAsset => 'alt' in item;
const isVideoAsset = (item: ImageAsset | VideoAsset): item is VideoAsset => 'src' in item && !('alt' in item);

const topLevelModuleEntries = (payload: ConnectedModulePayload): Array<{ type: string; enabled: boolean; data: unknown }> => {
	return [
		{ type: 'hero', enabled: true, data: payload.hero },
		{ type: 'stats', enabled: true, data: payload.stats },
		{ type: 'events', enabled: true, data: payload.events },
		{ type: 'schedule', enabled: true, data: payload.schedule?.days },
		{ type: 'gallery', enabled: true, data: payload.gallery },
		{ type: 'popup', enabled: true, data: payload.popups },
		{ type: 'video', enabled: true, data: payload.videos },
		{ type: 'mediaCollection', enabled: true, data: payload.mediaCollections },
		{ type: 'sponsors', enabled: true, data: payload.sponsors },
		{ type: 'faqs', enabled: true, data: payload.faqs },
	].filter((entry) => entry.data !== undefined && entry.data !== null);
};

export const isFrontPagePopup = (popup: PopupBlock): boolean => {
	if (!popup.enabled) {
		return false;
	}
	if (!Array.isArray(popup.placement) || popup.placement.length === 0) {
		return true;
	}
	return popup.placement.some((placement) => FRONT_PAGE_PLACEMENTS.has(placement));
};

export const selectFrontPagePopups = (popups: PopupBlock[]): PopupBlock[] => {
	return popups.filter((popup) => isFrontPagePopup(popup));
};

export const extractConnectedModules = (
	payload: ConnectedModulePayload,
	options?: { logger?: Logger; sourcePageId?: string }
): ConnectedModuleExtraction => {
	const logger = options?.logger ?? console;
	const modules: ConnectedModule[] = [];
	const unknownTypes = new Set<string>();
	const topLevelHero = normalizeHero(payload.hero);
	const topLevelStats: FestivalStat[] = coerceArray<unknown>(payload.stats)
		.map((entry) => normalizeFestivalStat(entry))
		.filter((entry): entry is FestivalStat => Boolean(entry));
	const topLevelEvents: EventDetail[] = coerceArray<unknown>(payload.events)
		.map((entry) => normalizeEvent(entry))
		.filter((entry): entry is EventDetail => Boolean(entry));
	const topLevelScheduleDays: ScheduleDay[] = coerceArray<unknown>(payload.schedule?.days)
		.map((entry) => normalizeScheduleDay(entry))
		.filter((entry): entry is ScheduleDay => Boolean(entry));
	const topLevelGallery: ImageAsset[] = coerceArray<unknown>(payload.gallery)
		.map((entry) => normalizeImage(entry))
		.filter((entry): entry is ImageAsset => Boolean(entry));
	const topLevelPopups: PopupBlock[] = coerceArray<unknown>(payload.popups)
		.map((entry, index) => normalizePopup(entry, index))
		.filter((entry): entry is PopupBlock => Boolean(entry));
	const topLevelVideos: VideoAsset[] = coerceArray<unknown>(payload.videos)
		.map((entry) => normalizeVideo(entry))
		.filter((entry): entry is VideoAsset => Boolean(entry));
	const topLevelMediaCollections: MediaCollection[] = coerceArray<unknown>(payload.mediaCollections)
		.map((entry, index) => normalizeMediaCollection(entry, index))
		.filter((entry): entry is MediaCollection => Boolean(entry));
	const topLevelSponsors: Sponsor[] = coerceArray<unknown>(payload.sponsors)
		.map((entry) => normalizeSponsor(entry))
		.filter((entry): entry is Sponsor => Boolean(entry));
	const topLevelFaqs: FaqItem[] = coerceArray<unknown>(payload.faqs)
		.map((entry) => normalizeFaq(entry))
		.filter((entry): entry is FaqItem => Boolean(entry));

	let blockHero: HeroBlock | undefined;
	let sawHeroBlock = false;
	const blockStats: FestivalStat[] = [];
	let sawStatsBlock = false;
	const blockEvents: EventDetail[] = [];
	let sawEventsBlock = false;
	const blockScheduleDays: ScheduleDay[] = [];
	let sawScheduleBlock = false;
	const blockGallery: ImageAsset[] = [];
	let sawGalleryBlock = false;
	const blockPopups: PopupBlock[] = [];
	let sawPopupBlock = false;
	const blockVideos: VideoAsset[] = [];
	let sawVideoBlock = false;
	const blockMediaCollections: MediaCollection[] = [];
	let sawMediaCollectionBlock = false;
	const blockSponsors: Sponsor[] = [];
	let sawSponsorsBlock = false;
	const blockFaqs: FaqItem[] = [];
	let sawFaqsBlock = false;

	for (const entry of topLevelModuleEntries(payload)) {
		modules.push({
			type: entry.type,
			enabled: entry.enabled,
			source: 'top-level',
			itemCount: Array.isArray(entry.data) ? entry.data.length : entry.data ? 1 : 0,
		});
	}

	const rawBlocks = [
		...coerceArray<unknown>(payload.blocks),
		...coerceArray<unknown>(payload.modules),
		...coerceArray<unknown>(payload.contentBlocks),
	];

	const normalizedBlocks = rawBlocks
		.map((entry) => normalizeRawBlock(entry))
		.filter((entry): entry is { type: string; enabled: boolean; data: unknown; placement: string[] } => Boolean(entry));

	for (const block of normalizedBlocks) {
		const dataList = Array.isArray(block.data) ? block.data : [block.data];
		switch (block.type) {
			case 'hero': {
				sawHeroBlock = true;
				const candidate = normalizeHero(block.data);
				if (block.enabled && candidate) {
					blockHero = candidate;
				}
				break;
			}
			case 'stats': {
				sawStatsBlock = true;
				if (block.enabled) {
					blockStats.push(
						...dataList
							.map((entry) => normalizeFestivalStat(entry))
							.filter((entry): entry is FestivalStat => Boolean(entry))
					);
				}
				break;
			}
			case 'events': {
				sawEventsBlock = true;
				if (block.enabled) {
					blockEvents.push(
						...coerceArray<unknown>(block.data)
							.map((entry) => normalizeEvent(entry))
							.filter((entry): entry is EventDetail => Boolean(entry))
					);
				}
				break;
			}
			case 'schedule': {
				sawScheduleBlock = true;
				if (block.enabled) {
					blockScheduleDays.push(
						...coerceArray<unknown>(block.data)
							.map((entry) => normalizeScheduleDay(entry))
							.filter((entry): entry is ScheduleDay => Boolean(entry))
					);
				}
				break;
			}
			case 'gallery': {
				sawGalleryBlock = true;
				if (block.enabled) {
					blockGallery.push(
						...coerceArray<unknown>(block.data)
							.map((entry) => normalizeImage(entry))
							.filter((entry): entry is ImageAsset => Boolean(entry))
					);
				}
				break;
			}
			case 'popup': {
				sawPopupBlock = true;
				if (block.enabled) {
					const popupItems = coerceArray<unknown>(block.data);
					popupItems.forEach((entry, index) => {
						const normalized = normalizePopup(entry, blockPopups.length + index);
						if (!normalized) {
							return;
						}
						normalized.enabled = normalized.enabled && block.enabled;
						normalized.placement = normalized.placement.length > 0 ? normalized.placement : block.placement;
						blockPopups.push(normalized);
					});
				}
				break;
			}
			case 'video': {
				sawVideoBlock = true;
				if (block.enabled) {
					blockVideos.push(
						...coerceArray<unknown>(block.data)
							.map((entry) => normalizeVideo(entry))
							.filter((entry): entry is VideoAsset => Boolean(entry))
							.map((entry) => ({
								...entry,
								placement: entry.placement && entry.placement.length > 0 ? entry.placement : block.placement,
							}))
					);
				}
				break;
			}
			case 'mediaCollection': {
				sawMediaCollectionBlock = true;
				if (block.enabled) {
					const collections = coerceArray<unknown>(block.data)
						.map((entry, index) => normalizeMediaCollection(entry, blockMediaCollections.length + index))
						.filter((entry): entry is MediaCollection => Boolean(entry));
					blockMediaCollections.push(...collections.map((entry) => ({ ...entry, enabled: entry.enabled && block.enabled })));
				}
				break;
			}
			case 'sponsors': {
				sawSponsorsBlock = true;
				if (block.enabled) {
					blockSponsors.push(
						...coerceArray<unknown>(block.data)
							.map((entry) => normalizeSponsor(entry))
							.filter((entry): entry is Sponsor => Boolean(entry))
					);
				}
				break;
			}
			case 'faqs': {
				sawFaqsBlock = true;
				if (block.enabled) {
					blockFaqs.push(
						...coerceArray<unknown>(block.data)
							.map((entry) => normalizeFaq(entry))
							.filter((entry): entry is FaqItem => Boolean(entry))
					);
				}
				break;
			}
			default: {
				unknownTypes.add(block.type);
				break;
			}
		}
		modules.push({
			type: block.type,
			enabled: block.enabled,
			source: 'block',
			itemCount: dataList.length,
		});
	}

	const mediaCollections = sawMediaCollectionBlock ? blockMediaCollections : topLevelMediaCollections;
	const videos = sawVideoBlock ? blockVideos : topLevelVideos;
	const gallery = sawGalleryBlock ? blockGallery : topLevelGallery;
	const stats = sawStatsBlock ? blockStats : topLevelStats;
	const eventsAll = sawEventsBlock ? blockEvents : topLevelEvents;
	const scheduleDays = sawScheduleBlock ? blockScheduleDays : topLevelScheduleDays;
	const popups = sawPopupBlock ? blockPopups : topLevelPopups;
	const sponsors = sawSponsorsBlock ? blockSponsors : topLevelSponsors;
	const faqs = sawFaqsBlock ? blockFaqs : topLevelFaqs;
	const hero = sawHeroBlock ? blockHero : topLevelHero;

	const collectionGallery: ImageAsset[] = [];
	const collectionVideos: VideoAsset[] = [];
	for (const collection of mediaCollections) {
		for (const item of collection.items) {
			if (isImageAsset(item)) {
				collectionGallery.push(item);
			}
			if (isVideoAsset(item)) {
				collectionVideos.push(item);
			}
		}
	}

	const dedupedStats = dedupeByKey(stats, (item) => item.label.toLowerCase());
	const dedupedEvents = dedupeByKey(eventsAll.reverse(), (item) => item.id).reverse();
	const dedupedScheduleDays = dedupeByKey(scheduleDays, (item) => `${item.dayLabel}-${item.dateLabel}`.toLowerCase());
	const dedupedGallery = dedupeByKey(
		collectionGallery.length > 0 ? collectionGallery : gallery,
		(item) => item.src
	);
	const dedupedPopups = dedupeByKey(popups, (item) => item.id);
	const dedupedVideos = dedupeByKey([...videos, ...collectionVideos], (item) => item.src);
	const dedupedCollections = dedupeByKey(mediaCollections, (item) => item.id);
	const dedupedSponsors = dedupeByKey(sponsors, (item) => item.name.toLowerCase());
	const dedupedFaqs = dedupeByKey(faqs, (item) => item.question.toLowerCase());

	if (unknownTypes.size > 0) {
		const sorted = Array.from(unknownTypes).sort();
		logger.info('WeBeFriends: dropped unsupported block types.', {
			pageId: options?.sourcePageId,
			types: sorted,
		});
	}

	return {
		hero,
		stats: dedupedStats,
		eventsAll: dedupedEvents,
		scheduleDays: dedupedScheduleDays,
		gallery: dedupedGallery,
		popups: dedupedPopups,
		videos: dedupedVideos,
		mediaCollections: dedupedCollections,
		sponsors: dedupedSponsors,
		faqs: dedupedFaqs,
		modules,
		unknownBlockTypes: Array.from(unknownTypes).sort(),
	};
};

// Add future block mappings in one place:
// Update `moduleTypeAliasMap` and the `switch (block.type)` branch in `extractConnectedModules`.
