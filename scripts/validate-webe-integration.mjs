const required = ['WEBE_API_KEY', 'WEBE_SITE_SLUG'];

for (const key of required) {
	if (!process.env[key]?.trim()) {
		console.error(`Missing required env var: ${key}`);
		process.exit(1);
	}
}

const baseOrigin = (process.env.WEBE_API_BASE_URL ?? process.env.WEBE_API_BASE ?? 'https://webefriends.com').replace(/\/+$/, '');
const apiBase = baseOrigin.endsWith('/api/integrations') ? baseOrigin : `${baseOrigin}/api/integrations`;
const siteSlug = process.env.WEBE_SITE_SLUG;
const apiKey = process.env.WEBE_API_KEY;
const contentUrl = `${apiBase}/${siteSlug}`;

const headers = {
	Accept: 'application/json',
	Authorization: `Bearer ${apiKey}`,
	'Content-Type': 'application/json',
	'X-API-Key': apiKey,
};

const safeJson = async (response) => {
	try {
		return await response.json();
	} catch {
		return null;
	}
};

const assertOk = async (response, label) => {
	if (response.ok) {
		return;
	}
	const body = await safeJson(response);
	console.error(`${label} failed with status ${response.status}.`);
	if (body) {
		console.error(JSON.stringify(body, null, 2));
	}
	process.exit(1);
};

const contentResponse = await fetch(contentUrl, {
	headers,
	cache: 'no-store',
});

await assertOk(contentResponse, 'Content fetch');

const contentPayload = await contentResponse.json();
console.log('Content fetch OK');
console.log(
	JSON.stringify(
		{
			siteSlug: contentPayload?.meta?.siteSlug ?? siteSlug,
			pageName: contentPayload?.meta?.pageName ?? contentPayload?.meta?.siteName ?? null,
			heroTitle: contentPayload?.hero?.title ?? null,
			hasProducts: Array.isArray(contentPayload?.products) ? contentPayload.products.length > 0 : false,
			hasMusicStore: Boolean(contentPayload?.musicStore),
			cacheControl: contentResponse.headers.get('cache-control'),
		},
		null,
		2
	)
);

if (process.env.WEBE_VALIDATE_MERCH_CHECKOUT === 'true') {
	const productId = process.env.WEBE_TEST_PRODUCT_ID?.trim();
	if (!productId) {
		console.error('WEBE_VALIDATE_MERCH_CHECKOUT=true requires WEBE_TEST_PRODUCT_ID.');
		process.exit(1);
	}
	const successUrl = process.env.WEBE_CHECKOUT_SUCCESS_URL ?? 'https://example.com/success';
	const cancelUrl = process.env.WEBE_CHECKOUT_CANCEL_URL ?? 'https://example.com/cancel';
	const merchResponse = await fetch(`${contentUrl}/checkout`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			items: [{ productId, quantity: 1 }],
			successUrl,
			cancelUrl,
		}),
	});
	await assertOk(merchResponse, 'Merch checkout');
	const merchPayload = await merchResponse.json();
	console.log('Merch checkout OK');
	console.log(JSON.stringify({ checkoutUrl: merchPayload?.url ?? merchPayload?.checkoutUrl ?? null }, null, 2));
}

if (process.env.WEBE_VALIDATE_MUSIC_CHECKOUT === 'true') {
	const songId = process.env.WEBE_TEST_SONG_ID?.trim();
	if (!songId) {
		console.error('WEBE_VALIDATE_MUSIC_CHECKOUT=true requires WEBE_TEST_SONG_ID.');
		process.exit(1);
	}
	const successUrl = process.env.WEBE_CHECKOUT_SUCCESS_URL ?? 'https://example.com/success';
	const cancelUrl = process.env.WEBE_CHECKOUT_CANCEL_URL ?? 'https://example.com/cancel';
	const musicResponse = await fetch(`${contentUrl}/music/checkout`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			songIds: [songId],
			successUrl,
			cancelUrl,
		}),
	});
	await assertOk(musicResponse, 'Music checkout');
	const musicPayload = await musicResponse.json();
	console.log('Music checkout OK');
	console.log(JSON.stringify({ checkoutUrl: musicPayload?.url ?? musicPayload?.checkoutUrl ?? null }, null, 2));
}
