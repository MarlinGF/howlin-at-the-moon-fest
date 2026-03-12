import { describe, expect, it, vi } from 'vitest';

import { extractConnectedModules, selectFrontPagePopups } from './connectedModules';

describe('connected modules extraction', () => {
	it('normalizes popup blocks and keeps front page eligible popups', () => {
		const result = extractConnectedModules({
			blocks: [
				{
					type: 'popup',
					enabled: true,
					data: [
						{
							id: 'welcome-popup',
							title: 'Welcome Howlers',
							message: 'Tonight starts at sundown.',
							placement: ['frontpage'],
						},
					],
				},
			],
		});

		expect(result.popups).toHaveLength(1);
		expect(selectFrontPagePopups(result.popups)).toHaveLength(1);
		expect(result.popups[0]?.title).toBe('Welcome Howlers');
	});

	it('normalizes video blocks and media collection videos', () => {
		const result = extractConnectedModules({
			blocks: [
				{
					type: 'video',
					data: [{ src: 'https://cdn.example.com/hero.mp4', title: 'Hero Reel' }],
				},
				{
					type: 'media-collection',
					data: [
						{
							id: 'mc-1',
							items: [{ src: 'https://cdn.example.com/aftermovie.mp4', title: 'Aftermovie' }],
						},
					],
				},
			],
		});

		expect(result.videos.map((video) => video.src)).toContain('https://cdn.example.com/hero.mp4');
		expect(result.videos.map((video) => video.src)).toContain('https://cdn.example.com/aftermovie.mp4');
	});

	it('normalizes gallery from media collections', () => {
		const result = extractConnectedModules({
			blocks: [
				{
					type: 'mediaCollection',
					data: [{ id: 'gallery-1', items: [{ src: '/images/gallery/dome-lights.svg', alt: 'Dome lights' }] }],
				},
			],
		});

		expect(result.gallery).toHaveLength(1);
		expect(result.gallery[0]?.src).toBe('/images/gallery/dome-lights.svg');
	});

	it('handles unknown future blocks without crashing and logs block type', () => {
		const logger = { info: vi.fn(), warn: vi.fn() };
		const result = extractConnectedModules(
			{
				blocks: [{ type: 'future-module-v2', data: { foo: 'bar' } }],
			},
			{ logger, sourcePageId: 'dRh8mZQsh3cm73dDCIEx' }
		);

		expect(result.unknownBlockTypes).toEqual(['future-module-v2']);
		expect(logger.info).toHaveBeenCalledTimes(1);
	});

	it('prefers the latest event payload when event times change', () => {
		const result = extractConnectedModules({
			events: [
				{
					id: 'moonrise-ceremony',
					title: 'Moonrise Ceremony',
					stage: 'Luna Main Stage',
					dayLabel: 'Friday',
					area: 'Courtyard',
					start: '2026-10-18T18:00:00-07:00',
					end: '2026-10-18T19:00:00-07:00',
					description: '',
					image: { src: '/images/events/moonrise.svg', alt: '' },
					tags: [],
				},
			],
			blocks: [
				{
					type: 'events',
					data: [
						{
							id: 'moonrise-ceremony',
							title: 'Moonrise Ceremony',
							stage: 'Luna Main Stage',
							dayLabel: 'Friday',
							area: 'Courtyard',
							start: '2026-10-18T19:30:00-07:00',
							end: '2026-10-18T20:30:00-07:00',
							description: '',
							image: { src: '/images/events/moonrise.svg', alt: '' },
							tags: [],
						},
					],
				},
			],
		});

		expect(result.eventsAll).toHaveLength(1);
		expect(result.eventsAll[0]?.start).toBe('2026-10-18T19:30:00-07:00');
	});
});
