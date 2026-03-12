export type ImageAsset = {
	src: string;
	alt: string;
};

export type VideoAsset = {
	src: string;
	title?: string;
	description?: string;
	poster?: string;
	autoplay?: boolean;
	loop?: boolean;
	muted?: boolean;
	playsinline?: boolean;
	placement?: string[];
};

export type CtaLink = {
	label: string;
	href: string;
};

export type HeroBlock = {
	kicker?: string;
	title: string;
	tagline?: string;
	description?: string;
	primaryCta?: CtaLink;
	secondaryCta?: CtaLink;
	background?: ImageAsset;
};

export type EventDetail = {
	id: string;
	title: string;
	stage: string;
	dayLabel: string;
	area: string;
	start: string;
	end: string;
	description: string;
	image: ImageAsset;
	tags: string[];
	slug?: string;
	recurrence?: string | Record<string, unknown>;
	gatesOpenAt?: string;
	dateLabel?: string;
	metadata?: Record<string, unknown>;
};

export type ScheduleDay = {
	dayLabel: string;
	dateLabel: string;
	gatesOpen: string;
	eventIds: string[];
};

export type FestivalStat = {
	label: string;
	value: number | string;
};

export type Sponsor = {
	name: string;
	tier: string;
	description: string;
};

export type FaqItem = {
	question: string;
	answer: string;
};

export type PopupBlock = {
	id: string;
	title: string;
	message?: string;
	placement: string[];
	enabled: boolean;
	dismissible: boolean;
	primaryCta?: CtaLink;
	secondaryCta?: CtaLink;
};

export type MediaCollection = {
	id: string;
	title?: string;
	description?: string;
	items: Array<ImageAsset | VideoAsset>;
	enabled: boolean;
};

export type ConnectedModule = {
	type: string;
	enabled: boolean;
	source: 'top-level' | 'block';
	itemCount: number;
};

export type IntegrationMeta = {
	siteSlug: string;
	siteName: string;
	sourcePageId: string;
	generatedAt: string;
};

export type Schedule = {
	days: ScheduleDay[];
};

export type FestivalContent = {
	meta: IntegrationMeta;
	hero?: HeroBlock;
	stats: FestivalStat[];
	events: EventDetail[];
	eventsAll: EventDetail[];
	schedule: Schedule;
	gallery: ImageAsset[];
	popups: PopupBlock[];
	videos: VideoAsset[];
	mediaCollections: MediaCollection[];
	sponsors: Sponsor[];
	faqs: FaqItem[];
	modules: ConnectedModule[];
};
