import type { EventDetail, Schedule, ScheduleDay } from './webeTypes';

const DEFAULT_GATES_TIME = '10:00 AM';

const isoKeyForDate = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const formatDateLabel = (date: Date): string => {
	return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
};

type GatesLookup = Map<string, string>;

const createGatesLookup = (fallback?: Map<string, string> | Record<string, string>): GatesLookup => {
	if (!fallback) {
		return new Map();
	}
	if (fallback instanceof Map) {
		return new Map(fallback.entries());
	}
	return new Map(Object.entries(fallback));
};

const cloneEvent = (event: EventDetail): EventDetail => ({
	...event,
	image: { ...event.image },
	tags: Array.isArray(event.tags) ? [...event.tags] : [],
	metadata: event.metadata ? { ...event.metadata } : undefined,
});

export const filterUpcomingEvents = (events: EventDetail[], options?: { now?: Date }): EventDetail[] => {
	const pivot = options?.now ?? new Date();
	const pivotTime = pivot.getTime();
	return events
		.map((event) => {
			const startTime = new Date(event.start).getTime();
			const endTime = new Date(event.end).getTime();
			return { event, startTime, endTime };
		})
		.filter(({ startTime, endTime }) => Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > pivotTime)
		.sort((a, b) => a.startTime - b.startTime)
		.map(({ event }) => cloneEvent(event));
};

const resolveGatesOpen = (
	dayLabel: string,
	isoDateKey: string,
	gatesOpenCandidates: Array<string | undefined>,
	lookup: GatesLookup
): string => {
	for (const candidate of gatesOpenCandidates) {
		if (typeof candidate === 'string' && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}
	const fromIso = lookup.get(isoDateKey);
	if (fromIso && fromIso.trim().length > 0) {
		return fromIso.trim();
	}
	const fromDayLabel = lookup.get(dayLabel);
	if (fromDayLabel && fromDayLabel.trim().length > 0) {
		return fromDayLabel.trim();
	}
	return DEFAULT_GATES_TIME;
};

export const buildScheduleFromEvents = (
	events: EventDetail[],
	options?: {
		fallbackGates?: Map<string, string> | Record<string, string>;
		includeEmptyDays?: ScheduleDay[];
	}
): Schedule => {
	const lookup = createGatesLookup(options?.fallbackGates);
	const groups = new Map<string, { dayLabel: string; date: Date; items: Array<{ event: EventDetail; startTime: number }> }>();

	events.forEach((event) => {
		const startDate = new Date(event.start);
		if (Number.isNaN(startDate.getTime())) {
			return;
		}
		const isoKey = isoKeyForDate(startDate);
		const existing = groups.get(isoKey);
		const normalizedEvent = cloneEvent(event);
		const entry = { event: normalizedEvent, startTime: startDate.getTime() };
		if (existing) {
			existing.items.push(entry);
		} else {
			groups.set(isoKey, {
				dayLabel: event.dayLabel || startDate.toLocaleString('en-US', { weekday: 'long' }),
				date: startDate,
				items: [entry],
			});
		}
	});

	const scheduleDays: ScheduleDay[] = Array.from(groups.entries())
		.map(([isoKey, value]) => {
			value.items.sort((a, b) => a.startTime - b.startTime);
			return {
				key: isoKey,
				dayLabel: value.dayLabel,
				date: value.date,
				events: value.items.map((item) => item.event),
			};
		})
		.sort((a, b) => a.date.getTime() - b.date.getTime())
		.map((entry) => {
			const eventIds = entry.events.map((event) => event.id);
			const gatesOpenCandidates = entry.events.map((event) => event.gatesOpenAt);
			return {
				dayLabel: entry.dayLabel,
				dateLabel: formatDateLabel(entry.date),
				gatesOpen: resolveGatesOpen(entry.dayLabel, entry.key, gatesOpenCandidates, lookup),
				eventIds,
			};
		});

	if (options?.includeEmptyDays && options.includeEmptyDays.length > 0) {
		const existingKeys = new Set(scheduleDays.map((day) => day.dayLabel));
		options.includeEmptyDays.forEach((day) => {
			if (!existingKeys.has(day.dayLabel)) {
				scheduleDays.push({ ...day, eventIds: [] });
			}
		});
	}

	return {
		days: scheduleDays,
	};
};
