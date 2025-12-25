import { describe, expect, it } from 'vitest';

import { buildScheduleFromEvents, filterUpcomingEvents } from './eventUtils';
import type { EventDetail, ScheduleDay } from './webeTypes';

const createEvent = (overrides: Partial<EventDetail>): EventDetail => ({
	id: 'event-id',
	title: 'Sample Event',
	stage: 'Main Stage',
	dayLabel: 'Friday',
	area: 'Court',
	start: new Date().toISOString(),
	end: new Date(Date.now() + 3_600_000).toISOString(),
	description: 'Sample description',
	image: { src: '/image.png', alt: 'Alt text' },
	tags: [],
	...overrides,
});

describe('filterUpcomingEvents', () => {
	it('filters events that have already ended and sorts upcoming ones by start time', () => {
		const now = new Date('2025-01-01T12:00:00.000Z');
		const events: EventDetail[] = [
			createEvent({
				id: 'past',
				start: '2024-12-31T10:00:00.000Z',
				end: '2024-12-31T11:00:00.000Z',
				title: 'Past Event',
				dayLabel: 'Tuesday',
			}),
			createEvent({
				id: 'future-b',
				start: '2025-01-03T18:00:00.000Z',
				end: '2025-01-03T19:30:00.000Z',
				title: 'Second Upcoming',
				dayLabel: 'Friday',
			}),
			createEvent({
				id: 'future-a',
				start: '2025-01-02T18:00:00.000Z',
				end: '2025-01-02T19:00:00.000Z',
				title: 'First Upcoming',
				dayLabel: 'Thursday',
			}),
		];

		const result = filterUpcomingEvents(events, { now });

		expect(result.map((event) => event.id)).toEqual(['future-a', 'future-b']);
		expect(result.every((event) => new Date(event.end).getTime() > now.getTime())).toBe(true);
	});
});

describe('buildScheduleFromEvents', () => {
	it('groups events by calendar day and applies fallback gate times when missing', () => {
		const events = filterUpcomingEvents([
			createEvent({
				id: 'thursday-set',
				start: '2025-01-02T18:00:00.000Z',
				end: '2025-01-02T19:00:00.000Z',
				title: 'Warmup Night',
				dayLabel: 'Thursday',
			}),
			createEvent({
				id: 'friday-set',
				start: '2025-01-03T18:00:00.000Z',
				end: '2025-01-03T19:30:00.000Z',
				title: 'Headliner',
				dayLabel: 'Friday',
				gatesOpenAt: '4:00 PM',
			}),
		], { now: new Date('2025-01-03T12:00:00.000Z') });

		const includeEmptyDays: ScheduleDay[] = [
			{ dayLabel: 'Thursday', dateLabel: 'Jan 02', gatesOpen: '3:00 PM', eventIds: [] },
			{ dayLabel: 'Friday', dateLabel: 'Jan 03', gatesOpen: '3:00 PM', eventIds: [] },
			{ dayLabel: 'Saturday', dateLabel: 'Jan 04', gatesOpen: '2:00 PM', eventIds: [] },
		];

		const schedule = buildScheduleFromEvents(events, {
			fallbackGates: new Map([
				['Thursday', '3:00 PM'],
				['Friday', '5:00 PM'],
			]),
			includeEmptyDays,
		});

		expect(schedule.days).toHaveLength(3);
		const thursdayDay = schedule.days.find((day) => day.dayLabel === 'Thursday');
		expect(thursdayDay).toBeDefined();
		expect(thursdayDay).toMatchObject({
			dayLabel: 'Thursday',
			gatesOpen: '3:00 PM',
			eventIds: [],
		});
		const fridayDay = schedule.days.find((day) => day.dayLabel === 'Friday');
		expect(fridayDay).toMatchObject({
			dayLabel: 'Friday',
			gatesOpen: '4:00 PM',
			eventIds: ['friday-set'],
		});
		const saturdayDay = schedule.days.find((day) => day.dayLabel === 'Saturday');
		expect(saturdayDay).toMatchObject({
			dayLabel: 'Saturday',
			eventIds: [],
		});
	});
});
