import { onRequest, type Request } from 'firebase-functions/v2/https';

import { getVisitorHash, registerVisitor } from './visitorCounter';

const IP_HEADER_CANDIDATES = [
	'x-forwarded-for',
	'x-real-ip',
	'cf-connecting-ip',
	'fastly-client-ip',
	'fly-client-ip',
	'true-client-ip'
];

const getClientIp = (req: Request): string => {
	for (const header of IP_HEADER_CANDIDATES) {
		const value = req.get(header);
		if (value) {
			return value.split(',')[0]?.trim() ?? value;
		}
	}
	return (req.ip ?? 'unknown').toString();
};

export const visitorCount = onRequest(async (req, res) => {
	try {
		const userAgent = req.get('user-agent') ?? 'unknown-agent';
		const ip = getClientIp(req);
		const visitorHash = getVisitorHash(ip, userAgent);
		const dateKey = new Date().toISOString().slice(0, 10);
		const count = await registerVisitor(visitorHash, dateKey);

		res.set('Cache-Control', 'no-store');
		res.status(200).json({ count });
	} catch (error) {
		console.error('visitorCount failed', error);
		res.set('Cache-Control', 'no-store');
		res.status(500).json({ error: 'Unable to fetch visitor count' });
	}
});
