export type ImageAsset = {
	src: string;
	alt: string;
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
	schedule: Schedule;
	gallery: ImageAsset[];
	sponsors: Sponsor[];
	faqs: FaqItem[];
};
