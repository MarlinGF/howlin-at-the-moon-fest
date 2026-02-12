import { randomUUID } from 'crypto';

import { onSchedule } from 'firebase-functions/v2/scheduler';

import { refreshFestivalContent } from './webeIntegration';

const SITE_SLUG = process.env.WEBE_SITE_SLUG ?? 'howlin-yuma';

export const webeNightlyRefresh = onSchedule({
	schedule: 'every day 03:30',
	timeZone: 'America/Phoenix',
}, async () => {
	const correlationId = `scheduler-${typeof randomUUID === 'function' ? randomUUID() : Date.now()}`;
	try {
		const result = await refreshFestivalContent(SITE_SLUG, {
			reason: 'scheduler',
			correlationId,
		});
		if (result.status !== 'processed') {
			console.warn(`[webe:${correlationId}] Nightly refresh skipped: ${result.reason ?? 'unknown reason'}.`);
		}
	} catch (error) {
		console.error(`[webe:${correlationId}] Nightly refresh failed.`, error);
	}
});
