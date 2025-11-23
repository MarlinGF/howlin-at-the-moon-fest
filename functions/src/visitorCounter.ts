import crypto from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { firestore } from './firebaseAdmin';

export const getVisitorHash = (ip: string, userAgent: string): string => {
	return crypto.createHash('sha256').update(`${ip}|${userAgent}`).digest('hex');
};

export const registerVisitor = async (visitorHash: string, dateKey: string): Promise<number> => {
	const globalRef = firestore.collection('visitorLog').doc('global');
	const dayRef = globalRef.collection('days').doc(dateKey);
	const visitorRef = dayRef.collection('visitors').doc(visitorHash);

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
	return globalSnap.data()?.count ?? 0;
};
