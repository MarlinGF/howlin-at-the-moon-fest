import type { Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';

import { firestore } from './firebaseAdmin';
import { fetchLiveFestivalContent } from './webeIntegration';

const SITES_COLLECTION = 'webeSites';
const DEFAULT_SITE_SLUG = process.env.WEBE_SITE_SLUG ?? 'howlin-yuma';
const DAY_MS = 24 * 60 * 60 * 1000;

type ImageAsset = {
    src: string;
    alt?: string;
};

type StoredEvent = {
    id?: string;
    title?: string;
    stage?: string;
    dayLabel?: string;
    area?: string;
    start?: string;
    end?: string;
    description?: string;
    image?: unknown;
    tags?: unknown;
    metadata?: Record<string, unknown>;
    status?: string;
    [key: string]: unknown;
};

type RuntimeEvent = {
    id: string;
    title: string;
    stage: string;
    dayLabel: string;
    area: string;
    start: string;
    end: string;
    description: string;
    image?: ImageAsset;
    tags: string[];
    metadata?: Record<string, unknown>;
    status?: string;
};

type SiteDoc = {
    content?: {
        events?: unknown;
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const coerceImage = (value: unknown): ImageAsset | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }
    const src = value.src;
    if (typeof src !== 'string' || src.trim().length === 0) {
        return undefined;
    }
    const alt = typeof value.alt === 'string' ? value.alt : '';
    return { src, alt };
};

const coerceTags = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim());
};

const normalizeEvent = (value: unknown): RuntimeEvent | null => {
    if (!isRecord(value)) {
        return null;
    }
    const id = typeof value.id === 'string' ? value.id : undefined;
    const title = typeof value.title === 'string' ? value.title : undefined;
    const stage = typeof value.stage === 'string' ? value.stage : undefined;
    const dayLabel = typeof value.dayLabel === 'string' ? value.dayLabel : undefined;
    const area = typeof value.area === 'string' ? value.area : undefined;
    const start = typeof value.start === 'string' ? value.start : undefined;
    const end = typeof value.end === 'string' ? value.end : undefined;
    if (!id || !title || !stage || !dayLabel || !area || !start || !end) {
        return null;
    }
    const description = typeof value.description === 'string' ? value.description : '';
    const image = coerceImage(value.image);
    const tags = coerceTags(value.tags);
    const metadata = isRecord(value.metadata) ? (value.metadata as Record<string, unknown>) : undefined;
    const status = typeof value.status === 'string' ? value.status : undefined;
    return {
        id,
        title,
        stage,
        dayLabel,
        area,
        start,
        end,
        description,
        image,
        tags,
        metadata,
        status,
    };
};

const resolveStatus = (event: RuntimeEvent): string => {
    if (typeof event.status === 'string' && event.status.trim().length > 0) {
        return event.status.trim().toLowerCase();
    }
    const metadataStatus = typeof event.metadata?.status === 'string' ? event.metadata.status : undefined;
    if (metadataStatus && metadataStatus.trim().length > 0) {
        return metadataStatus.trim().toLowerCase();
    }
    return 'published';
};

const isWithinWindow = (event: RuntimeEvent, nowMs: number): boolean => {
    const startMs = Date.parse(event.start);
    if (!Number.isFinite(startMs)) {
        return false;
    }
    if (startMs >= nowMs) {
        return true;
    }
    return nowMs - startMs <= DAY_MS;
};

const filterEvents = (events: RuntimeEvent[], pivot: number): RuntimeEvent[] => {
    return events
        .filter((event) => resolveStatus(event) === 'published' && isWithinWindow(event, pivot))
        .sort((a, b) => {
            const aTime = Date.parse(a.start);
            const bTime = Date.parse(b.start);
            return aTime - bTime;
        })
        .map((event) => ({ ...event }));
};

const extractEvents = (data: unknown): unknown[] => {
    if (!isRecord(data)) {
        return [];
    }
    const content = data.content;
    if (!isRecord(content)) {
        return [];
    }
    const events = content.events;
    if (!Array.isArray(events)) {
        return [];
    }
    return events;
};

const setCorsHeaders = (res: Response) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
};

export const eventsApi = onRequest({ cors: false }, async (req, res) => {
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
            res.status(200).json({
                events: Array.isArray(liveContent.events) ? liveContent.events : [],
                generatedAt: liveContent.meta.generatedAt,
                source: liveContent.meta.sourcePageId ?? 'webe-api',
            });
            return;
        }
    } catch (error) {
        console.error('eventsApi failed to fetch live content.', error);
    }

    try {
        const snapshot = await firestore.collection(SITES_COLLECTION).doc(siteSlug).get();
        if (!snapshot.exists) {
            res.status(404).json({ events: [] });
            return;
        }
        const doc = snapshot.data() as SiteDoc | undefined;
        const rawEvents = extractEvents(doc ?? {});
        const normalized = rawEvents
            .map((entry) => normalizeEvent(entry))
            .filter((entry): entry is RuntimeEvent => Boolean(entry));
        const filtered = filterEvents(normalized, Date.now());
        res.set('Cache-Control', 'no-store');
        res.status(200).json({ events: filtered });
    } catch (error) {
        console.error('eventsApi failed to load events', error);
        res.status(500).json({ events: [], error: 'Unable to load events' });
    }
});
