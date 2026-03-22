import type { Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';

import { firestore } from './firebaseAdmin';
import type { FestivalContent } from './webeTypes';
import { fetchLiveFestivalContent } from './webeIntegration';

const SITES_COLLECTION = 'webeSites';
const DEFAULT_SITE_SLUG = process.env.WEBE_SITE_SLUG ?? 'howlin-yuma';

type SiteDoc = {
	content?: FestivalContent;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const setCorsHeaders = (res: Response) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.set('Access-Control-Allow-Headers', 'Content-Type');
};

const normalizeStoredContent = (value: unknown, siteSlug: string): FestivalContent | null => {
	if (!isRecord(value) || !isRecord(value.meta)) {
		return null;
	}
	const meta = value.meta;
	if (
		typeof meta.siteSlug !== 'string' ||
		typeof meta.siteName !== 'string' ||
		typeof meta.sourcePageId !== 'string' ||
		typeof meta.generatedAt !== 'string'
	) {
		return null;
	}

	return {
		meta: {
			siteSlug: meta.siteSlug,
			siteName: meta.siteName,
			sourcePageId: meta.sourcePageId,
			generatedAt: meta.generatedAt,
		},
		hero: isRecord(value.hero) ? (clone(value.hero) as FestivalContent['hero']) : undefined,
		stats: Array.isArray(value.stats) ? clone(value.stats) : [],
		events: Array.isArray(value.events) ? clone(value.events) : [],
		eventsAll: Array.isArray(value.eventsAll) ? clone(value.eventsAll) : [],
		schedule:
			isRecord(value.schedule) && Array.isArray(value.schedule.days)
				? { days: clone(value.schedule.days) }
				: { days: [] },
		gallery: Array.isArray(value.gallery) ? clone(value.gallery) : [],
		popups: Array.isArray(value.popups) ? clone(value.popups) : [],
		videos: Array.isArray(value.videos) ? clone(value.videos) : [],
		mediaCollections: Array.isArray(value.mediaCollections) ? clone(value.mediaCollections) : [],
		sponsors: Array.isArray(value.sponsors) ? clone(value.sponsors) : [],
		faqs: Array.isArray(value.faqs) ? clone(value.faqs) : [],
		modules: Array.isArray(value.modules) ? clone(value.modules) : [],
	};
};

const createEmptyContent = (siteSlug: string): FestivalContent => ({
	meta: {
		siteSlug,
		siteName: "Howlin' At The Moon Fest",
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
});

export const contentApi = onRequest({ cors: false }, async (req, res) => {
	console.log('CONTENT FUNCTION HIT');
	setCorsHeaders(res);

	if (req.method === 'OPTIONS') {
		res.status(204).send('');
		return;
	}

	if (req.method !== 'GET') {
		res.status(405).set('Allow', 'GET, OPTIONS').send('Method Not Allowed');
		return;
	}

	const siteSlug = process.env.WEBE_SITE_SLUG ?? DEFAULT_SITE_SLUG;

	try {
		const liveContent = await fetchLiveFestivalContent(siteSlug);
		if (liveContent) {
			res.set('Cache-Control', 'no-store');
			res.status(200).json(liveContent);
			return;
		}
	} catch (error) {
		console.error('contentApi failed to fetch live content.', error);
	}

	try {
		const snapshot = await firestore.collection(SITES_COLLECTION).doc(siteSlug).get();
		const doc = snapshot.data() as SiteDoc | undefined;
		const normalized = normalizeStoredContent(doc?.content, siteSlug) ?? createEmptyContent(siteSlug);
		res.set('Cache-Control', 'no-store');
		res.status(200).json(normalized);
	} catch (error) {
		console.error('contentApi failed to load content.', error);
		res.set('Cache-Control', 'no-store');
		res.status(500).json({ error: 'Unable to load content' });
	}
});
