type RuntimeEvent = {
    id: string;
    title: string;
    stage: string;
    dayLabel: string;
    area: string;
    start: string;
    end: string;
    description: string;
    image?: { src: string; alt?: string };
    tags?: string[];
};

type EventsResponse = {
    events?: RuntimeEvent[];
};

type EventsConfig = {
    endpoint?: string;
    timezone?: string;
};

const FALLBACK_ENDPOINT = '/api/events';
const DEFAULT_TIMEZONE = 'America/Phoenix';
const GATES_OPEN_FALLBACK = '10:00 AM';

const readConfigElement = (): EventsConfig | null => {
    const element = document.getElementById('runtime-events-config');
    if (!element) {
        return null;
    }
    const raw = element.textContent?.trim();
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as EventsConfig;
    } catch (error) {
        console.warn('Unable to parse runtime events config. Falling back to defaults.', error);
        return null;
    }
};

const getConfig = (): Required<EventsConfig> => {
    const config = readConfigElement() ?? {};
    return {
        endpoint: config.endpoint ?? FALLBACK_ENDPOINT,
        timezone: config.timezone ?? DEFAULT_TIMEZONE,
    };
};

const formatTimeFactory = (timeZone: string) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
    });
    return (value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return formatter.format(date);
    };
};

const getHeading = (events: RuntimeEvent[]): string => {
    if (events.length === 0) {
        return 'Next Howling';
    }
    const dates = events
        .map((event) => new Date(event.start))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
    const keyed = new Map<string, Date>();
    dates.forEach((date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!keyed.has(key)) {
            keyed.set(key, date);
        }
    });
    const uniqueDates = Array.from(keyed.values());
    if (uniqueDates.length === 0) {
        return 'Next Howling';
    }
    const formatLabel = (date: Date, includeMonth = true) => {
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = date.getDate();
        const suffix = (() => {
            const mod10 = day % 10;
            const mod100 = day % 100;
            if (mod10 === 1 && mod100 !== 11) return 'st';
            if (mod10 === 2 && mod100 !== 12) return 'nd';
            if (mod10 === 3 && mod100 !== 13) return 'rd';
            return 'th';
        })();
        return includeMonth ? `${month} ${day}${suffix}` : `${day}${suffix}`;
    };
    if (uniqueDates.length === 1) {
        return `Next Howling ${formatLabel(uniqueDates[0])}`;
    }
    const [first, second] = uniqueDates;
    if (first.getMonth() === second.getMonth() && first.getFullYear() === second.getFullYear()) {
        const monthLabel = first.toLocaleString('en-US', { month: 'short' });
        return `Next Howling ${monthLabel} ${formatLabel(first, false)} & ${formatLabel(second, false)}`;
    }
    return `Next Howling ${formatLabel(first)} & ${formatLabel(second)}`;
};

const createHighlightCard = (event: RuntimeEvent, formatTime: (value: string) => string): HTMLElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
        'group relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 text-left transition hover:border-fuchsia-400/70 hover:shadow-fuchsia-500/20';
    button.dataset.openModal = `modal-${event.id}`;
    button.innerHTML = `
        <img src="${event.image?.src ?? '/images/events/moonrise.svg'}" alt="${event.image?.alt ?? ''}" class="h-48 w-full object-cover object-center transition duration-500 group-hover:scale-105" />
        <div class="flex flex-col gap-3 p-6">
            <p class="text-xs font-semibold uppercase tracking-[0.4em] text-fuchsia-300/90">${event.stage}</p>
            <h3 class="text-xl font-semibold text-white">${event.title}</h3>
            <p class="text-sm text-slate-300">${formatTime(event.start)} • ${event.dayLabel}</p>
            <div class="flex flex-wrap gap-2">
                ${(event.tags ?? [])
                    .map((tag) => `<span class="rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">${tag.replace('-', ' ')}</span>`)
                    .join('')}
            </div>
        </div>
    `;
    return button;
};

type ScheduleGroup = {
    dayLabel: string;
    dateLabel: string;
    timestamp: number;
    events: RuntimeEvent[];
};

const groupEventsByDay = (events: RuntimeEvent[]): ScheduleGroup[] => {
    const groups = new Map<string, { dayLabel: string; date: Date; events: RuntimeEvent[] }>();
    events.forEach((event) => {
        const startDate = new Date(event.start);
        if (Number.isNaN(startDate.getTime())) {
            return;
        }
        const key = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const normalizedDayLabel = event.dayLabel || startDate.toLocaleString('en-US', { weekday: 'long' });
        if (!groups.has(key)) {
            groups.set(key, { dayLabel: normalizedDayLabel, date: startDate, events: [] });
        }
        groups.get(key)?.events.push(event);
    });
    return Array.from(groups.values())
        .map((entry) => ({
            dayLabel: entry.dayLabel,
            dateLabel: entry.date.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
            timestamp: entry.date.getTime(),
            events: entry.events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
};

const createScheduleCard = (
    group: ScheduleGroup,
    index: number,
    formatTime: (value: string) => string
): HTMLElement => {
    const card = document.createElement('div');
    card.className =
        'flex min-w-[85vw] flex-shrink-0 snap-center flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-8 transition-transform lg:min-w-0';
    card.dataset.scheduleCard = 'true';
    if (index >= 3) {
        card.dataset.mobileHidden = 'true';
        card.classList.add('hidden');
        card.classList.add('lg:flex');
    } else {
        card.dataset.mobileHidden = 'false';
    }
    card.innerHTML = `
        <div class="flex items-baseline justify-between gap-4">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300/80">${group.dateLabel}</p>
                <h3 class="text-2xl font-semibold text-white">${group.dayLabel}</h3>
            </div>
            <p class="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">Gates ${GATES_OPEN_FALLBACK}</p>
        </div>
        <ul class="space-y-4">
            ${group.events
                .map((event) => `
                    <li class="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-fuchsia-400/70">
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">${event.stage}</p>
                                <h4 class="text-lg font-semibold text-white">${event.title}</h4>
                            </div>
                            <div class="flex flex-col items-start text-sm font-medium text-slate-200 sm:items-end sm:text-right">
                                <span>
                                    ${formatTime(event.start)}<span class="mx-2 text-slate-500">–</span>${formatTime(event.end)}
                                </span>
                                <span class="mt-1 text-xs font-normal text-slate-500/80">The shows usually end 30-45 minutes after the moon rises.</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-3 text-sm text-slate-300">
                            <span class="rounded-full bg-emerald-500/20 px-3 py-1">${event.area}</span>
                            <button type="button" class="rounded-full border border-slate-600/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-fuchsia-400 hover:text-white" data-open-modal="modal-${event.id}">Details</button>
                        </div>
                    </li>
                `)
                .join('') ||
            '<li class="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">Set list coming soon. Check back once new events are assigned in WeBeFriends.</li>'}
        </ul>
    `;
    return card;
};

const createModal = (event: RuntimeEvent, formatTime: (value: string) => string): HTMLDialogElement => {
    const dialog = document.createElement('dialog');
    dialog.id = `modal-${event.id}`;
    dialog.dataset.eventModal = 'true';
    dialog.className =
        'backdrop:bg-slate-950/80 w-full max-w-2xl rounded-3xl border border-slate-700/60 bg-slate-900/95 p-0 text-slate-100 shadow-2xl';
    dialog.setAttribute('aria-labelledby', `modal-title-${event.id}`);
    const tagMarkup = (event.tags ?? [])
        .map(
            (tag) =>
                `<li class="rounded-full border border-slate-600/70 bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">${tag.replace('-', ' ')}</li>`
        )
        .join('');
    dialog.innerHTML = `
        <div class="flex flex-col gap-6 p-8">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-300/80">${event.stage}</p>
                    <h3 id="modal-title-${event.id}" class="mt-2 text-3xl font-bold text-white">${event.title}</h3>
                </div>
                <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/60 text-slate-300 transition hover:border-slate-500 hover:text-white" data-close-modal="modal-${event.id}">
                    <span class="sr-only">Close modal</span>
                    &times;
                </button>
            </div>
            <img src="${event.image?.src ?? '/images/events/moonrise.svg'}" alt="${event.image?.alt ?? ''}" class="h-60 w-full rounded-2xl object-cover object-center" />
            <div class="flex flex-wrap gap-4 text-sm text-slate-200">
                <div class="flex items-center gap-2">
                    <span class="inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                    <span>${event.dayLabel}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
                    <span>${formatTime(event.start)} – ${formatTime(event.end)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="inline-flex h-2 w-2 rounded-full bg-fuchsia-400"></span>
                    <span>${event.area}</span>
                </div>
            </div>
            <p class="text-base leading-relaxed text-slate-100">${event.description}</p>
            ${tagMarkup ? `<ul class="flex flex-wrap gap-2">${tagMarkup}</ul>` : ''}
        </div>
    `;
    return dialog;
};

const renderHighlights = (events: RuntimeEvent[], formatTime: (value: string) => string) => {
    const container = document.querySelector<HTMLElement>('[data-event-highlights]');
    if (!container) {
        return;
    }
    if (events.length === 0) {
        container.innerHTML =
            '<div class="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">No upcoming events yet. Check back soon.</div>';
        return;
    }
    container.innerHTML = '';
    events.slice(0, 2).forEach((event) => {
        container.appendChild(createHighlightCard(event, formatTime));
    });
};

const renderSchedule = (events: RuntimeEvent[], formatTime: (value: string) => string) => {
    const container = document.querySelector<HTMLElement>('[data-event-schedule]');
    const showMoreButton = document.querySelector<HTMLButtonElement>('[data-schedule-show-more]');
    if (!container) {
        return;
    }
    if (container.dataset.carouselInitialized) {
        delete container.dataset.carouselInitialized;
    }
    const groups = groupEventsByDay(events);
    if (groups.length === 0) {
        container.innerHTML =
            '<div class="rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">We are booking the next round of sets. Refresh soon!</div>';
        showMoreButton?.classList.add('hidden');
        showMoreButton?.setAttribute('aria-hidden', 'true');
        return;
    }
    container.innerHTML = '';
    groups.forEach((group, index) => {
        container.appendChild(createScheduleCard(group, index, formatTime));
    });
    if (showMoreButton) {
        if (groups.length > 3) {
            showMoreButton.classList.remove('hidden');
            showMoreButton.setAttribute('aria-hidden', 'false');
        } else {
            showMoreButton.classList.add('hidden');
            showMoreButton.setAttribute('aria-hidden', 'true');
        }
    }
    document.dispatchEvent(new CustomEvent('webe:schedule-ready'));
};

const renderModals = (events: RuntimeEvent[], formatTime: (value: string) => string) => {
    const container = document.querySelector('[data-event-modals-root]');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    events.forEach((event) => {
        container.appendChild(createModal(event, formatTime));
    });
    document.dispatchEvent(new CustomEvent('webe:event-modals-ready'));
};

const updateHeading = (events: RuntimeEvent[]) => {
    const heading = document.querySelector<HTMLElement>('[data-next-howling-heading]');
    if (!heading) {
        return;
    }
    heading.textContent = getHeading(events);
};

const fetchEvents = async (endpoint: string): Promise<RuntimeEvent[]> => {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new Error(`eventsApi responded with ${response.status}`);
    }
    const payload = (await response.json()) as EventsResponse;
    if (!payload || !Array.isArray(payload.events)) {
        return [];
    }
    return payload.events;
};

const renderErrorStates = () => {
    const highlightContainer = document.querySelector<HTMLElement>('[data-event-highlights]');
    if (highlightContainer) {
        highlightContainer.innerHTML =
            '<div class="rounded-3xl border border-rose-800/60 bg-rose-950/50 p-6 text-sm text-rose-100">Unable to load upcoming events right now.</div>';
    }
    const scheduleContainer = document.querySelector<HTMLElement>('[data-event-schedule]');
    if (scheduleContainer) {
        scheduleContainer.innerHTML =
            '<div class="rounded-3xl border border-rose-800/60 bg-rose-950/50 p-6 text-sm text-rose-100">Unable to load the schedule at this time.</div>';
    }
};

const bootstrapEvents = async () => {
    try {
        const config = getConfig();
        const formatTime = formatTimeFactory(config.timezone);
        const events = await fetchEvents(config.endpoint);
        updateHeading(events);
        renderHighlights(events, formatTime);
        renderSchedule(events, formatTime);
        renderModals(events, formatTime);
    } catch (error) {
        console.error('Failed to hydrate runtime events.', error);
        renderErrorStates();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void bootstrapEvents();
    });
} else {
    void bootstrapEvents();
}

export {};
