import { Timestamp } from 'firebase-admin/firestore';

import { firestore } from './firebaseAdmin';
import { buildScheduleFromEvents, filterUpcomingEvents } from './eventUtils';
import type {
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

type EventAction = 'created' | 'updated' | 'deleted';

type EventDetailPayload = Omit<EventDetail, 'description' | 'image' | 'tags' | 'metadata'> & {
	description?: string;
	image?: ImageAsset;
	tags?: string[];
	metadata?: Record<string, unknown>;
	date?: string;
};

type IntegrationApiResponse = {
	type?: string;
	action?: EventAction;
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

type StoredEventDoc = {
	eventId: string;
	data?: EventDetail | null;
	deleted?: boolean;
	previousData?: EventDetail | null;
	lastAction?: string;
	lastTriggeredAt?: Timestamp;
	updatedAt?: Timestamp;
};

type SiteDoc = {
	siteSlug: string;
	pageId?: string;
	baseContent?: FestivalContent;
	content?: FestivalContent;
	lastRefreshAt?: Timestamp;
	lastWebhookAction?: string;
	lastWebhookCorrelationId?: string;
	lastWebhookTriggerAt?: Timestamp;
};

export type EventsChangedPayload = {
	type?: string;
	action?: EventAction;
	pageId?: string;
	siteSlug?: string;
	eventId?: string;
	triggeredAt?: string;
	event?: unknown;
	previousEvent?: unknown;
};

export type ProcessResult = {
	status: 'processed' | 'skipped';
	reason?: string;
};

export type RefreshReason = 'scheduler' | 'manual' | 'bootstrap';

const SITES_COLLECTION = 'webeSites';
const EVENTS_SUBCOLLECTION = 'events';
const DEFAULT_SITE_SLUG = process.env.WEBE_SITE_SLUG ?? 'howlin-yuma';
const DEFAULT_SITE_NAME = "Howlin' At The Moon Fest";
const API_BASE_URL = (process.env.WEBE_API_BASE ?? 'https://webefriends.com/api/integrations').replace(/\/?$/, '');
const API_KEY = process.env.WEBE_API_KEY ?? '';

const serializeForStore = <T>(value: T): T => {
	try {
		return JSON.parse(JSON.stringify(value)) as T;
	} catch (error) {
		console.warn('Failed to serialise value for persistence.', error);
		return value;
	}
};

const clone = <T>(value: T): T => serializeForStore(value);

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
	return typeof value === 'string' && value.trim().length > 0;
};

const hasStringId = (value: unknown): value is { id: string } => {
	if (!isRecord(value)) {
		return false;
	}
	const candidate = value as { id?: unknown };
	return isNonEmptyString(candidate.id);
};

const coerceArray = <T>(value: unknown): T[] => {
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
};

const normalizeScheduleDay = (input: unknown): ScheduleDay | null => {
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
};

const normalizeEventDetail = (event: EventDetailPayload): EventDetail | null => {
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
};

const normalizeFestivalContent = (payload: IntegrationApiResponse): FestivalContent | null => {
	const meta = payload.meta ?? {};
	const siteSlug = typeof meta.siteSlug === 'string' && meta.siteSlug.trim().length > 0 ? meta.siteSlug : DEFAULT_SITE_SLUG;
	const siteName = typeof meta.siteName === 'string' && meta.siteName.trim().length > 0 ? meta.siteName : DEFAULT_SITE_NAME;
	const sourcePageId = typeof meta.sourcePageId === 'string' && meta.sourcePageId.trim().length > 0 ? meta.sourcePageId : 'webe-source-page';
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
};

const createMinimalContent = (siteSlug: string, pageId?: string): FestivalContent => ({
	meta: {
		siteSlug,
		siteName: DEFAULT_SITE_NAME,
		sourcePageId: pageId ?? 'webe-source-page',
		generatedAt: new Date().toISOString(),
	},
	hero: undefined,
	stats: [],
	events: [],
	schedule: { days: [] },
	gallery: [],
	sponsors: [],
	faqs: [],
});

const ensureSiteDocument = async (siteSlug: string, pageId?: string): Promise<FestivalContent> => {
	const siteRef = firestore.collection(SITES_COLLECTION).doc(siteSlug);
	const snapshot = await siteRef.get();
	if (!snapshot.exists) {
		const minimal = createMinimalContent(siteSlug, pageId);
		await siteRef.set(
			{
				siteSlug,
				pageId: pageId ?? minimal.meta.sourcePageId,
				baseContent: serializeForStore(minimal),
				content: serializeForStore(minimal),
				eventCount: 0,
				updatedAt: Timestamp.now(),
			},
			{ merge: true }
		);
		return minimal;
	}
	const data = snapshot.data() as SiteDoc | undefined;
	if (data?.baseContent) {
		return clone(data.baseContent);
	}
	const minimal = createMinimalContent(siteSlug, pageId);
	await siteRef.set(
		{
			baseContent: serializeForStore(minimal),
			content: serializeForStore(minimal),
			updatedAt: Timestamp.now(),
		},
		{ merge: true }
	);
	return minimal;
};

const rebuildSiteSnapshot = async (siteSlug: string): Promise<FestivalContent> => {
	const siteRef = firestore.collection(SITES_COLLECTION).doc(siteSlug);
	const siteSnap = await siteRef.get();
	const siteData = siteSnap.data() as SiteDoc | undefined;
	const baseContent = siteData?.baseContent ? clone(siteData.baseContent) : createMinimalContent(siteSlug, siteData?.pageId);
	const fallbackGates = new Map<string, string>();
	baseContent.schedule.days.forEach((day) => {
		fallbackGates.set(day.dayLabel, day.gatesOpen);
	});
	const includeEmptyDays = baseContent.schedule.days.map((day) => ({
		dayLabel: day.dayLabel,
		dateLabel: day.dateLabel,
		gatesOpen: day.gatesOpen,
		eventIds: [],
	}));
	const eventsSnapshot = await siteRef.collection(EVENTS_SUBCOLLECTION).get();
	const events: EventDetail[] = [];
	eventsSnapshot.forEach((doc) => {
		const entry = doc.data() as StoredEventDoc;
		if (entry.deleted) {
			return;
		}
		if (!entry.data) {
			return;
		}
		events.push(entry.data);
	});
	const upcoming = filterUpcomingEvents(events);
	const schedule = buildScheduleFromEvents(upcoming, {
		fallbackGates,
		includeEmptyDays,
	});
	const merged: FestivalContent = {
		...baseContent,
		events: upcoming,
		schedule,
	};
	merged.meta = {
		...baseContent.meta,
		generatedAt: new Date().toISOString(),
	};
	await siteRef.set(
		{
			content: serializeForStore(merged),
			eventCount: upcoming.length,
			updatedAt: Timestamp.now(),
		},
		{ merge: true }
	);
	return merged;
};

const upsertEvent = async (
	siteSlug: string,
	event: EventDetail,
	action: EventAction,
	triggeredAt: Date,
	context: { correlationId: string; pageId?: string }
): Promise<'processed' | 'stale'> => {
	const siteRef = firestore.collection(SITES_COLLECTION).doc(siteSlug);
	const eventRef = siteRef.collection(EVENTS_SUBCOLLECTION).doc(event.id);
	let processed = false;
	await firestore.runTransaction(async (tx) => {
		const snap = await tx.get(eventRef);
		const existing = snap.exists ? (snap.data() as StoredEventDoc) : undefined;
		const previousTrigger = existing?.lastTriggeredAt?.toMillis() ?? 0;
		if (previousTrigger >= triggeredAt.getTime()) {
			return;
		}
		processed = true;
		tx.set(
			eventRef,
			{
				eventId: event.id,
				data: serializeForStore(event),
				deleted: false,
				previousData: existing?.data ?? null,
				lastAction: action,
				lastTriggeredAt: Timestamp.fromDate(triggeredAt),
				updatedAt: Timestamp.now(),
			},
			{ merge: true }
		);
		tx.set(
			siteRef,
			{
				siteSlug,
				pageId: context.pageId ?? existing?.data?.id ?? undefined,
				lastWebhookAction: action,
				lastWebhookCorrelationId: context.correlationId,
				lastWebhookTriggerAt: Timestamp.fromDate(triggeredAt),
				updatedAt: Timestamp.now(),
			},
			{ merge: true }
		);
	});
	return processed ? 'processed' : 'stale';
};

const deleteEvent = async (
	siteSlug: string,
	eventId: string,
	action: EventAction,
	triggeredAt: Date,
	context: { correlationId: string; pageId?: string; previous?: EventDetail | null }
): Promise<'processed' | 'stale'> => {
	const siteRef = firestore.collection(SITES_COLLECTION).doc(siteSlug);
	const eventRef = siteRef.collection(EVENTS_SUBCOLLECTION).doc(eventId);
	let processed = false;
	await firestore.runTransaction(async (tx) => {
		const snap = await tx.get(eventRef);
		const existing = snap.exists ? (snap.data() as StoredEventDoc) : undefined;
		const previousTrigger = existing?.lastTriggeredAt?.toMillis() ?? 0;
		if (previousTrigger >= triggeredAt.getTime()) {
			return;
		}
		processed = true;
		tx.set(
			eventRef,
			{
				eventId,
				data: null,
				deleted: true,
				previousData: existing?.data ?? context.previous ?? null,
				lastAction: action,
				lastTriggeredAt: Timestamp.fromDate(triggeredAt),
				updatedAt: Timestamp.now(),
			},
			{ merge: true }
		);
		tx.set(
			siteRef,
			{
				siteSlug,
				pageId: context.pageId ?? existing?.data?.id ?? undefined,
				lastWebhookAction: action,
				lastWebhookCorrelationId: context.correlationId,
				lastWebhookTriggerAt: Timestamp.fromDate(triggeredAt),
				updatedAt: Timestamp.now(),
			},
			{ merge: true }
		);
	});
	return processed ? 'processed' : 'stale';
};

export const processEventsChanged = async (
	payload: EventsChangedPayload,
	context: { correlationId: string; triggeredAt: Date; action: EventAction; siteSlug: string; pageId?: string }
): Promise<ProcessResult> => {
	const { action, correlationId, triggeredAt } = context;
	const siteSlug = context.siteSlug || payload.siteSlug || DEFAULT_SITE_SLUG;
	const pageId = context.pageId ?? payload.pageId;
	const resolvedEventId = (() => {
		if (isNonEmptyString(payload.eventId)) {
			return payload.eventId;
		}
		if (hasStringId(payload.event)) {
			return payload.event.id;
		}
		return undefined;
	})();
	if (!isNonEmptyString(resolvedEventId)) {
		console.warn(`[webe:${correlationId}] Missing eventId for action ${action}.`);
		return { status: 'skipped', reason: 'missing-event-id' };
	}
	const eventId: string = resolvedEventId.trim();

	await ensureSiteDocument(siteSlug, pageId);

	if (action === 'deleted') {
		const previous = isRecord(payload.previousEvent)
			? normalizeEventDetail(payload.previousEvent as EventDetailPayload)
			: null;
		const status = await deleteEvent(siteSlug, eventId, action, triggeredAt, { correlationId, pageId, previous });
		if (status === 'processed') {
			await rebuildSiteSnapshot(siteSlug);
			console.info(`[webe:${correlationId}] Deleted event ${eventId} for site ${siteSlug}.`);
			return { status: 'processed' };
		}
		console.info(`[webe:${correlationId}] Skipped deletion for event ${eventId}; stale trigger.`);
		return { status: 'skipped', reason: 'stale-event' };
	}

	if (!isRecord(payload.event)) {
		console.warn(`[webe:${correlationId}] Invalid event payload for action ${action}.`);
		return { status: 'skipped', reason: 'invalid-event' };
	}
	const normalizedEvent = normalizeEventDetail(payload.event as EventDetailPayload);
	if (!normalizedEvent) {
		console.warn(`[webe:${correlationId}] Unable to normalise event payload for action ${action}.`);
		return { status: 'skipped', reason: 'invalid-event' };
	}
	const status = await upsertEvent(siteSlug, normalizedEvent, action, triggeredAt, { correlationId, pageId });
	if (status === 'processed') {
		await rebuildSiteSnapshot(siteSlug);
		console.info(`[webe:${correlationId}] Upserted event ${normalizedEvent.id} for site ${siteSlug} (${action}).`);
		return { status: 'processed' };
	}
	console.info(`[webe:${correlationId}] Skipped upsert for event ${normalizedEvent.id}; stale trigger.`);
	return { status: 'skipped', reason: 'stale-event' };
};

const syncEventsWithContent = async (
	siteSlug: string,
	content: FestivalContent,
	reason: RefreshReason,
	triggeredAt: Date
): Promise<void> => {
	const siteRef = firestore.collection(SITES_COLLECTION).doc(siteSlug);
	const eventsRef = siteRef.collection(EVENTS_SUBCOLLECTION);
	const snapshot = await eventsRef.get();
	const existingIds = new Set(snapshot.docs.map((doc) => doc.id));
	const batch = firestore.batch();
	const triggeredTimestamp = Timestamp.fromDate(triggeredAt);
	const now = Timestamp.now();
	content.events.forEach((event) => {
		const sanitised = serializeForStore(event);
		const docRef = eventsRef.doc(event.id);
		batch.set(
			docRef,
			{
				eventId: event.id,
				data: sanitised,
				deleted: false,
				lastAction: reason,
				lastTriggeredAt: triggeredTimestamp,
				updatedAt: now,
			},
			{ merge: true }
		);
		existingIds.delete(event.id);
	});
	existingIds.forEach((eventId) => {
		const docRef = eventsRef.doc(eventId);
		batch.set(
			docRef,
			{
				eventId,
				deleted: true,
				lastAction: `${reason}-removed`,
				lastTriggeredAt: triggeredTimestamp,
				updatedAt: now,
			},
			{ merge: true }
		);
	});
	if (!snapshot.empty || content.events.length > 0) {
		await batch.commit();
	}
};

const fetchRemoteFestivalContent = async (siteSlug: string): Promise<FestivalContent | null> => {
	if (!API_KEY) {
		console.warn('WEBE_API_KEY is not configured; nightly refresh is disabled.');
		return null;
	}
	const url = `${API_BASE_URL}/${siteSlug}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 9_000);
	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'User-Agent': 'HowlinIntegration/1.0 (+firebase-functions)',
				'x-api-key': API_KEY,
			},
			cache: 'no-store',
			signal: controller.signal,
		});
		if (!response.ok) {
			console.error(`WeBeFriends API request failed with status ${response.status}.`);
			return null;
		}
		const payload = (await response.json()) as IntegrationApiResponse;
		const normalized = normalizeFestivalContent(payload);
		if (!normalized) {
			console.warn('Received unexpected payload from WeBeFriends API.');
			return null;
		}
		return normalized;
	} catch (error) {
		console.error('Failed to fetch WeBeFriends content.', error);
		return null;
	} finally {
		clearTimeout(timeout);
	}
};

export const refreshFestivalContent = async (
	siteSlug: string,
	opts: { reason: RefreshReason; correlationId?: string }
): Promise<ProcessResult> => {
	const correlationId = opts.correlationId ?? `refresh-${Date.now()}`;
	const content = await fetchRemoteFestivalContent(siteSlug);
	if (!content) {
		return { status: 'skipped', reason: 'remote-fetch-failed' };
	}
	const siteRef = firestore.collection(SITES_COLLECTION).doc(siteSlug);
	const triggeredAt = new Date();
	await ensureSiteDocument(siteSlug, content.meta.sourcePageId);
	await siteRef.set(
		{
			siteSlug,
			pageId: content.meta.sourcePageId,
			baseContent: serializeForStore(content),
			lastRefreshAt: Timestamp.fromDate(triggeredAt),
			lastWebhookCorrelationId: correlationId,
			updatedAt: Timestamp.now(),
		},
		{ merge: true }
	);
	await syncEventsWithContent(siteSlug, content, opts.reason, triggeredAt);
	await rebuildSiteSnapshot(siteSlug);
	console.info(`[webe:${correlationId}] Refreshed site ${siteSlug} from API.`);
	return { status: 'processed' };
};

export const fetchLiveFestivalContent = async (siteSlug: string = DEFAULT_SITE_SLUG): Promise<FestivalContent | null> => {
	const content = await fetchRemoteFestivalContent(siteSlug);
	return content ? clone(content) : null;
};
