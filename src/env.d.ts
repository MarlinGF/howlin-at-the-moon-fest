/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly WEBE_API_KEY?: string;
	readonly WEBE_API_BASE?: string;
	readonly WEBE_SITE_SLUG?: string;
	readonly PUBLIC_GOOGLE_MAPS_KEY?: string;
	readonly PUBLIC_GOOGLE_MAPS_QUERY?: string;
	readonly PUBLIC_GOOGLE_MAPS_ZOOM?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}