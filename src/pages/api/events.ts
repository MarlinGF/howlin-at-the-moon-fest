import type { APIRoute } from 'astro';

import { fetchFestivalContent } from '../../lib/webeFriendsClient';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
	const headers = new Headers(init.headers ?? {});
	headers.set('content-type', 'application/json');
	headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=30, stale-while-revalidate=120');

	return new Response(JSON.stringify(body), {
		...init,
		headers
	});
};

export const GET: APIRoute = async () => {
	try {
		const content = await fetchFestivalContent();
		return jsonResponse({
			events: content.events ?? [],
			generatedAt: content.meta.generatedAt,
			source: content.meta.sourcePageId,
		});
	} catch (error) {
		console.error('Failed to load festival events', error);
		return jsonResponse(
			{ events: [], error: 'Unable to load events' },
			{
				status: 500,
				statusText: 'Event fetch failed',
				headers: { 'cache-control': 'no-store' }
			}
		);
	}
};
