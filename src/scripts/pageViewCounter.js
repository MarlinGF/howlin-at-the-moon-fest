const COUNTER_ID = 'page-view-counter';
const API_ENDPOINT = '/api/visitor-count';

const formatCount = (value) => {
	if (!Number.isFinite(value)) {
		return '—';
	}
	return value.toLocaleString();
};

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

const renderLoading = () => {
	const container = document.getElementById(COUNTER_ID);
	if (!container) {
		return;
	}

	container.textContent = 'Counting eyes on the page…';
};

const fetchCounter = async () => {
	const container = document.getElementById(COUNTER_ID);
	if (!container) {
		return;
	}

	try {
		const response = await fetch(API_ENDPOINT, {
			method: 'GET',
			cache: 'no-store',
			credentials: 'omit'
		});

		if (!response.ok) {
			throw new Error(`Request failed: ${response.status}`);
		}

		const payload = await response.json();
		const total = Number.parseInt(payload?.count ?? 0, 10);
		renderCounter(Number.isFinite(total) ? total : 0);
	} catch (error) {
		console.error('Page view counter request failed', error);
		renderCounter(Number.NaN);
	}
};

const boot = () => {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return;
	}

	renderLoading();
	void fetchCounter();
};

if (typeof window !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}
}
