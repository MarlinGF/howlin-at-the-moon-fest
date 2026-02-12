import { onRequest, type Request } from 'firebase-functions/v2/https';

import type { EventsChangedPayload, ProcessResult } from './webeIntegration';
import { processEventsChanged, refreshFestivalContent } from './webeIntegration';

type EventAction = 'created' | 'updated' | 'deleted';

const parsePayload = (rawBody: Buffer): EventsChangedPayload | null => {
	try {
		return JSON.parse(rawBody.toString('utf8')) as EventsChangedPayload;
	} catch (error) {
		console.error('Unable to parse webhook payload.', error);
		return null;
	}
};

const coerceAction = (headerValue: string | undefined, fallback?: EventsChangedPayload['action']): EventAction => {
	if (headerValue) {
		const lowered = headerValue.trim().toLowerCase();
		if (lowered === 'created' || lowered === 'updated' || lowered === 'deleted') {
			return lowered;
		}
	}
	if (fallback === 'created' || fallback === 'updated' || fallback === 'deleted') {
		return fallback;
	}
	return 'updated';
};

const parseTriggeredAt = (value: string | undefined, fallback: Date): Date => {
	if (!value) {
		return fallback;
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return fallback;
	}
	return parsed;
};

const resolveCorrelationId = (req: Request): string => {
	return (
		req.get('WeBe-Correlation-Id') ||
		req.get('X-Request-Id') ||
		req.get('X-Correlation-Id') ||
		`webe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
	);
};

export const webeEvents = onRequest({ timeoutSeconds: 10, cors: false }, async (req, res) => {
	if (req.method !== 'POST') {
		res.status(405).set('Allow', 'POST').send('Method Not Allowed');
		return;
	}

	const payload = parsePayload(req.rawBody);
	if (!payload) {
		res.status(400).send('Invalid payload');
		return;
	}

	const correlationId = resolveCorrelationId(req);
	const action = coerceAction(req.get('WeBe-Event-Action'), payload.action);
	const triggeredAt = parseTriggeredAt(payload.triggeredAt, new Date());
	const siteSlug = payload.siteSlug || req.get('WeBe-Site-Slug') || process.env.WEBE_SITE_SLUG || 'howlin-yuma';

	console.info(`[webe:${correlationId}] Received events.changed webhook (${action}) for site ${siteSlug}.`);

	let result: ProcessResult;
	try {
		result = await processEventsChanged(payload, {
			correlationId,
			triggeredAt,
			action,
			siteSlug,
			pageId: payload.pageId,
		});
	} catch (error) {
		console.error(`[webe:${correlationId}] Failed to process webhook.`, error);
		res.status(500).send('Webhook processing failed');
		return;
	}

	if (result.status === 'processed') {
		// Immediately refresh from WeBeFriends API to ensure Firestore stays in sync
		try {
			const refreshResult = await refreshFestivalContent(siteSlug, {
				reason: 'manual',
				correlationId,
			});
			if (refreshResult.status === 'processed') {
				console.info(`[webe:${correlationId}] Refreshed festival content after webhook.`);
			}
		} catch (error) {
			console.warn(`[webe:${correlationId}] Failed to refresh after webhook.`, error);
			// Don't fail the webhook response if refresh fails; the event was already processed
		}
		res.status(200).send('processed');
		return;
	}

	res.status(200).send(result.reason ?? 'noop');
});
