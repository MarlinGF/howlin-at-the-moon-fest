/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly WEBE_API_KEY?: string;
	readonly WEBE_API_BASE?: string;
	readonly WEBE_SITE_SLUG?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}