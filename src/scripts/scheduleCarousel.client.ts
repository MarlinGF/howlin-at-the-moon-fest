const CAROUSEL_SELECTOR = '[data-schedule-carousel]';
const CARD_SELECTOR = '[data-schedule-card]';
const DESKTOP_QUERY = '(min-width: 1024px)';
const AUTO_SCROLL_INTERVAL = 5000;
const RESTART_DELAY = 2000;

const initCarousel = (container: HTMLElement) => {
	if (container.dataset.carouselInitialized === 'true') {
		return;
	}

	const items = Array.from(container.querySelectorAll<HTMLElement>(CARD_SELECTOR));
	if (items.length <= 1) {
		container.dataset.carouselInitialized = 'true';
		return;
	}

	container.dataset.carouselInitialized = 'true';

	const mediaQuery = window.matchMedia(DESKTOP_QUERY);
	let currentIndex = 0;
	let autoScrollId: number | undefined;
	let restartTimeoutId: number | undefined;
	let scrollUpdateId: number | undefined;

	const clearAutoScroll = () => {
		if (autoScrollId !== undefined) {
			window.clearInterval(autoScrollId);
			autoScrollId = undefined;
		}
	};

	const clearRestart = () => {
		if (restartTimeoutId !== undefined) {
			window.clearTimeout(restartTimeoutId);
			restartTimeoutId = undefined;
		}
	};

	const goToIndex = (index: number) => {
		const target = items[index];
		if (!target) {
			return;
		}
		currentIndex = index;
		const offset = target.offsetLeft - container.offsetLeft;
		container.scrollTo({ left: offset, behavior: 'smooth' });
	};

	const startAutoScroll = () => {
		clearAutoScroll();
		clearRestart();
		if (mediaQuery.matches) {
			return;
		}
		autoScrollId = window.setInterval(() => {
			if (mediaQuery.matches) {
				clearAutoScroll();
				return;
			}
			const nextIndex = (currentIndex + 1) % items.length;
			goToIndex(nextIndex);
		}, AUTO_SCROLL_INTERVAL);
	};

	const restartAutoScroll = () => {
		clearAutoScroll();
		clearRestart();
		if (mediaQuery.matches) {
			return;
		}
		restartTimeoutId = window.setTimeout(() => {
			startAutoScroll();
		}, RESTART_DELAY);
	};

	const updateIndexFromScroll = () => {
		const center = container.scrollLeft + container.clientWidth / 2;
		let bestIndex = currentIndex;
		let bestDistance = Number.POSITIVE_INFINITY;
		items.forEach((item, index) => {
			const itemCenter = item.offsetLeft - container.offsetLeft + item.offsetWidth / 2;
			const distance = Math.abs(itemCenter - center);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		});
		currentIndex = bestIndex;
	};

	const handleScroll = () => {
		if (mediaQuery.matches) {
			return;
		}
		if (scrollUpdateId !== undefined) {
			window.clearTimeout(scrollUpdateId);
		}
		scrollUpdateId = window.setTimeout(() => {
			updateIndexFromScroll();
			restartAutoScroll();
		}, 150);
	};

	const handleInteractionStart = () => {
		clearAutoScroll();
		clearRestart();
	};

	const handleInteractionEnd = () => {
		restartAutoScroll();
	};

	const handleVisibilityChange = () => {
		if (document.hidden) {
			clearAutoScroll();
			clearRestart();
		} else {
			restartAutoScroll();
		}
	};

	const handleMediaChange = () => {
		clearAutoScroll();
		clearRestart();
		if (mediaQuery.matches) {
			currentIndex = 0;
			container.scrollTo({ left: 0, behavior: 'auto' });
		} else {
			restartAutoScroll();
		}
	};

	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					restartAutoScroll();
				} else {
					clearAutoScroll();
					clearRestart();
				}
			});
		},
		{ threshold: 0.25 }
	);

	intersectionObserver.observe(container);

	container.addEventListener('scroll', handleScroll, { passive: true });
	container.addEventListener('pointerdown', handleInteractionStart, { passive: true });
	container.addEventListener('pointerup', handleInteractionEnd, { passive: true });
	container.addEventListener('pointercancel', handleInteractionEnd, { passive: true });
	container.addEventListener('mouseleave', handleInteractionEnd, { passive: true });
	container.addEventListener('touchend', handleInteractionEnd, { passive: true });
	document.addEventListener('visibilitychange', handleVisibilityChange);
	mediaQuery.addEventListener('change', handleMediaChange);

	startAutoScroll();

	const cleanup = () => {
		clearAutoScroll();
		clearRestart();
		if (scrollUpdateId !== undefined) {
			window.clearTimeout(scrollUpdateId);
		}
		container.removeEventListener('scroll', handleScroll);
		container.removeEventListener('pointerdown', handleInteractionStart);
		container.removeEventListener('pointerup', handleInteractionEnd);
		container.removeEventListener('pointercancel', handleInteractionEnd);
		container.removeEventListener('mouseleave', handleInteractionEnd);
		container.removeEventListener('touchend', handleInteractionEnd);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		mediaQuery.removeEventListener('change', handleMediaChange);
		intersectionObserver.disconnect();
	};

	container.addEventListener(
		'astro:before-swap',
		() => {
			cleanup();
		},
		{ once: true }
	);
};

const initAllCarousels = () => {
	const containers = Array.from(document.querySelectorAll<HTMLElement>(CAROUSEL_SELECTOR));
	containers.forEach((container) => {
		initCarousel(container);
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initAllCarousels, { once: true });
} else {
	initAllCarousels();
}

document.addEventListener('astro:page-load', initAllCarousels);
