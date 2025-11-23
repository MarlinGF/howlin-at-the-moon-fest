import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { firestore } from '../../lib/firebaseAdmin';

const IP_HEADER_CANDIDATES = [
	'x-forwarded-for',
	'x-real-ip',
	'cf-connecting-ip',
	'fastly-client-ip',
	'fly-client-ip',
	'true-client-ip'
];

const getClientIp = (request: Request): string => {
	for (const header of IP_HEADER_CANDIDATES) {
		const value = request.headers.get(header);
		if (value) {
			return value.split(',')[0]?.trim() ?? value;
		}
	}
	return 'unknown';
};

const getVisitorHash = (ip: string, userAgent: string): string => {
	return crypto.createHash('sha256').update(`${ip}|${userAgent}`).digest('hex');
};

export const GET: APIRoute = async ({ request }) => {
	if (import.meta.env.PROD) {
		return new Response(JSON.stringify({ count: 0, stale: true }), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'cache-control': 'no-store'
			}
		});
	}

	const userAgent = request.headers.get('user-agent') ?? 'unknown-agent';
	const clientIp = getClientIp(request);
	const visitorId = getVisitorHash(clientIp, userAgent);
	const dateKey = new Date().toISOString().slice(0, 10);

	const globalRef = firestore.collection('visitorLog').doc('global');
	const dayRef = globalRef.collection('days').doc(dateKey);
	const visitorRef = dayRef.collection('visitors').doc(visitorId);

	try {
		await firestore.runTransaction(async (tx) => {
			const visitorSnap = await tx.get(visitorRef);
			const now = Timestamp.now();

			if (!visitorSnap.exists) {
				tx.set(dayRef, { date: dateKey, updatedAt: now }, { merge: true });
				tx.set(
					visitorRef,
					{
						firstSeenAt: now,
						lastSeenAt: now
					},
					{ merge: true }
				);
				tx.set(
					globalRef,
					{
						count: FieldValue.increment(1),
						updatedAt: now
					},
					{ merge: true }
				);
			} else {
				tx.update(visitorRef, { lastSeenAt: now });
			}
		});

		const globalSnap = await globalRef.get();
		const total = globalSnap.data()?.count ?? 0;

		return new Response(JSON.stringify({ count: total }), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'cache-control': 'no-store'
			}
		});
	} catch (error) {
		console.error('Failed to process visitor-count request', error);
		return new Response(JSON.stringify({ error: 'Unable to fetch visitor count' }), {
			status: 500,
			headers: {
				'content-type': 'application/json',
				'cache-control': 'no-store'
			}
		});
	}
};
