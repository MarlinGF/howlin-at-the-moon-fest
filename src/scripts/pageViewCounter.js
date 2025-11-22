const STORAGE_KEY = 'hatm-page-views-2025-11-reset';
const LEGACY_STORAGE_KEYS = ['hatm-page-views'];
const COUNTER_ID = 'page-view-counter';

const formatCount = (value) => value.toLocaleString();

const renderCounter = (count) => {
	const container = document.getElementById(COUNTER_ID);
	if (!container) {
		return;
	}

	const wrapper = document.createElement('span');
	wrapper.className = 'spvc-counter';

	const icon = document.createElement('img');
	icon.src = '/images/eyes-looking.gif';
	icon.alt = 'Page views icon';
	icon.className = 'spvc-icon';

	const text = document.createElement('span');
	text.className = 'spvc-count';
	text.textContent = `${formatCount(count)} views`;

	wrapper.append(icon, document.createTextNode(' '), text);
	container.replaceChildren(wrapper);
};

const incrementCounter = () => {
	let current = 0;
	try {
		LEGACY_STORAGE_KEYS.forEach((key) => {
			if (key !== STORAGE_KEY) {
				window.localStorage.removeItem(key);
			}
		});
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = Number.parseInt(stored, 10);
			if (Number.isFinite(parsed) && parsed >= 0) {
				current = parsed;
			}
		}
	} catch (error) {
		// localStorage may be disabled; fall back to zero.
		current = 0;
	}

	const next = current + 1;

	try {
		window.localStorage.setItem(STORAGE_KEY, String(next));
	} catch (error) {
		// Ignore storage write errors (e.g., Safari private mode).
	}

	renderCounter(next);
};

const boot = () => {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return;
	}

	const container = document.getElementById(COUNTER_ID);
	if (!container) {
		return;
	}

	incrementCounter();
};

if (typeof window !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}
}
