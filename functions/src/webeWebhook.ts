import crypto from 'node:crypto';

import { onRequest, type Request } from 'firebase-functions/v2/https';

import type { EventsChangedPayload, ProcessResult } from './webeIntegration';
import { processEventsChanged, refreshFestivalContent } from './webeIntegration';

const WEBHOOK_SECRET = process.env.WEBE_WEBHOOK_SECRET ?? '';

const normalizeSignature = (header: string | undefined): Buffer | null => {
	if (!header) {
		return null;
	}
	const value = header.trim().toLowerCase().startsWith('sha256=') ? header.trim().slice(7) : header.trim();
	if (value.length !== 64) {
		return null;
	}
	try {
		return Buffer.from(value, 'hex');
	} catch {
		return null;
	}
};

const verifySignature = (rawBody: Buffer, header: string | undefined): boolean => {
	if (!WEBHOOK_SECRET) {
		console.error('WEBE_WEBHOOK_SECRET is not configured. Rejecting webhook.');
		return false;
	}
	const provided = normalizeSignature(header);
	if (!provided) {
		return false;
	}
	const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest();
	if (expected.length !== provided.length) {
		return false;
	}
	return crypto.timingSafeEqual(expected, provided);
};

const parsePayload = (rawBody: Buffer): EventsChangedPayload | null => {
	try {
		return JSON.parse(rawBody.toString('utf8')) as EventsChangedPayload;
	} catch (error) {
		console.error('Unable to parse webhook payload.', error);
		return null;
	}
};

const coerceAction = (headerValue: string | undefined, fallback?: EventsChangedPayload['action']): EventsChangedPayload['action'] => {
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

	if (!verifySignature(req.rawBody, req.get('WeBe-Signature'))) {
		res.status(401).send('Invalid signature');
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
				reason: 'webhook',
				correlationId,
			});
			if (refreshResult.status === 'processed') {
				console.info(`[webe:${correlationId}] Refreshed festival content after webhook.`);
			}
		} catch (error) {
			console.warn(`[webe:${correlationId}] Failed to refresh after webhook.`, error);
			// Don't fail the webhook response if refresh fails; the event was already processed
		}
		res.status(202).send('accepted');
		return;
	}

	res.status(200).send(result.reason ?? 'noop');
});
