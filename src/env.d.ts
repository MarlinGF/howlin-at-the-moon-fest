/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly WEBE_API_KEY?: string;
	readonly WEBE_API_BASE_URL?: string;
	readonly WEBE_API_BASE?: string;
	readonly WEBE_SITE_SLUG?: string;
	readonly WEBE_PAGE_ID?: string;
	readonly WEBE_CHECKOUT_SUCCESS_URL?: string;
	readonly WEBE_CHECKOUT_CANCEL_URL?: string;
	readonly WEBE_WEBHOOK_URL?: string;
	readonly WEBE_WEBHOOK_SECRET?: string;
	readonly WEBE_SERVICE_FEE_FLAT_CENTS?: string;
	readonly WEBE_SERVICE_FEE_PERCENT_BPS?: string;
	readonly PUBLIC_GOOGLE_MAPS_KEY?: string;
	readonly PUBLIC_GOOGLE_MAPS_QUERY?: string;
	readonly PUBLIC_GOOGLE_MAPS_ZOOM?: string;
	readonly PUBLIC_GOOGLE_MAPS_MAP_ID?: string;
	readonly PUBLIC_GOOGLE_MAPS_USE_MAP_ID?: string;
	readonly PUBLIC_FESTIVAL_TIMEZONE?: string;
	readonly PUBLIC_SITE_URL?: string;
	readonly PUBLIC_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
