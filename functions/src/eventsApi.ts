import type { Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';

import { selectFrontPagePopups } from './connectedModules';
import { firestore } from './firebaseAdmin';
import { filterUpcomingEvents } from './eventUtils';
import type { EventDetail, ImageAsset, PopupBlock } from './webeTypes';
import { fetchLiveFestivalContent } from './webeIntegration';

const SITES_COLLECTION = 'webeSites';
const DEFAULT_SITE_SLUG = process.env.WEBE_SITE_SLUG ?? 'howlin-yuma';

type RuntimeEvent = EventDetail & {
    status?: string;
};

type SiteDoc = {
    content?: {
        events?: unknown;
        popups?: unknown;
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
    if (!image) {
        return null;
    }
    const tags = coerceTags(value.tags);
    const metadata = isRecord(value.metadata) ? (value.metadata as Record<string, unknown>) : undefined;
    const status = typeof value.status === 'string' ? value.status : undefined;
    const normalized: RuntimeEvent = {
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
    return normalized;
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

const filterEvents = (events: RuntimeEvent[], now: Date): EventDetail[] => {
    const published = events.filter((event) => resolveStatus(event) === 'published');
    return filterUpcomingEvents(published, { now });
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

const extractPopups = (data: unknown): PopupBlock[] => {
    if (!isRecord(data)) {
        return [];
    }
    const content = data.content;
    if (!isRecord(content)) {
        return [];
    }
    const popups = content.popups;
    if (!Array.isArray(popups)) {
        return [];
    }
    return popups.filter((entry): entry is PopupBlock => isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string');
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
    const pivot = new Date();

    try {
        const liveContent = await fetchLiveFestivalContent(siteSlug);
        if (liveContent) {
            const sourceEvents = Array.isArray(liveContent.eventsAll) && liveContent.eventsAll.length > 0
                ? liveContent.eventsAll
                : Array.isArray(liveContent.events)
                    ? liveContent.events
                    : [];
            const events = filterUpcomingEvents(sourceEvents, { now: pivot });
            const popups = selectFrontPagePopups(Array.isArray(liveContent.popups) ? liveContent.popups : []);
            res.set('Cache-Control', 'no-store');
            res.status(200).json({
                events,
                popups,
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
            res.status(404).json({ events: [], popups: [] });
            return;
        }
        const doc = snapshot.data() as SiteDoc | undefined;
        const rawEvents = extractEvents(doc ?? {});
        const normalized = rawEvents
            .map((entry) => normalizeEvent(entry))
            .filter((entry): entry is RuntimeEvent => Boolean(entry));
        const filtered = filterEvents(normalized, pivot);
        const storedPopups = extractPopups(doc ?? {});
        const popups = selectFrontPagePopups(storedPopups);
        res.set('Cache-Control', 'no-store');
        res.status(200).json({ events: filtered, popups });
    } catch (error) {
        console.error('eventsApi failed to load events', error);
        res.status(500).json({ events: [], popups: [], error: 'Unable to load events' });
    }
});
