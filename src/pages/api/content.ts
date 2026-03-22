import type { APIRoute } from 'astro';

import { fetchFestivalContent } from '../../lib/webeFriendsClient';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
	const headers = new Headers(init.headers ?? {});
	headers.set('content-type', 'application/json');
	headers.set('cache-control', headers.get('cache-control') ?? 'no-store');

	return new Response(JSON.stringify(body), {
		...init,
		headers,
	});
};

export const GET: APIRoute = async () => {
	if (import.meta.env.PROD) {
		return jsonResponse({
			meta: {
				siteSlug: 'howlin-yuma',
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
	}

	try {
		const content = await fetchFestivalContent();
		return jsonResponse(content);
	} catch (error) {
		console.error('Failed to load festival content', error);
		return jsonResponse(
			{ error: 'Unable to load content' },
			{
				status: 500,
				statusText: 'Content fetch failed',
				headers: { 'cache-control': 'no-store' },
			}
		);
	}
};
