import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFns = vi.hoisted(() => ({
	collection: vi.fn(),
	doc: vi.fn(),
	get: vi.fn(),
	set: vi.fn(),
}));

vi.mock('./firebaseAdmin', () => ({
	firestore: {
		collection: mockFns.collection,
	},
}));

describe('fetchFestivalContent', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockFns.collection.mockReturnValue({
			doc: mockFns.doc,
		});
		mockFns.doc.mockReturnValue({
			get: mockFns.get,
			set: mockFns.set,
		});
	});

	it('does not persist fallback content when no cached doc exists', async () => {
		mockFns.get.mockResolvedValue({
			exists: false,
		});

		const { fetchFestivalContent } = await import('./webeFriendsClient');
		await fetchFestivalContent('howlin-yuma');

		expect(mockFns.set).not.toHaveBeenCalled();
	});

	it('returns cached event data without overwriting Firestore when remote is unavailable', async () => {
		const cachedStart = '2099-10-18T16:00:00-07:00';
		const cachedEnd = '2099-10-18T17:00:00-07:00';
		mockFns.get.mockResolvedValue({
			exists: true,
			data: () => ({
				cachedAt: new Date().toISOString(),
				content: {
					meta: {
						siteSlug: 'howlin-yuma',
						siteName: "Howlin' At The Moon Fest",
						sourcePageId: 'webe-page',
						generatedAt: new Date().toISOString(),
					},
					hero: undefined,
					stats: [],
					events: [
						{
							id: 'event-today',
							title: 'Today Event',
							stage: 'Main',
							dayLabel: 'Sunday',
							area: 'Yuma',
							start: cachedStart,
							end: cachedEnd,
							description: '',
							image: { src: '/images/events/moonrise.svg', alt: '' },
							tags: [],
						},
					],
					eventsAll: [
						{
							id: 'event-today',
							title: 'Today Event',
							stage: 'Main',
							dayLabel: 'Sunday',
							area: 'Yuma',
							start: cachedStart,
							end: cachedEnd,
							description: '',
							image: { src: '/images/events/moonrise.svg', alt: '' },
							tags: [],
						},
					],
					schedule: { days: [] },
					gallery: [],
					popups: [],
					videos: [],
					mediaCollections: [],
					sponsors: [],
					faqs: [],
					modules: [],
				},
			}),
		});

		const { fetchFestivalContent } = await import('./webeFriendsClient');
		const result = await fetchFestivalContent('howlin-yuma');

		expect(result.events).toHaveLength(1);
		expect(result.events[0]?.start).toBe(cachedStart);
		expect(mockFns.set).not.toHaveBeenCalled();
	});
});
