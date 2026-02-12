const CAROUSEL_SELECTOR = '[data-schedule-carousel]';
const CARD_SELECTOR = '[data-schedule-card]';
const DESKTOP_QUERY = '(min-width: 1024px)';
const AUTO_SCROLL_INTERVAL = 5000;
const RESTART_DELAY = 2000;

const initCarousel = (container) => {
	if (!(container instanceof HTMLElement)) {
		return;
	}

	if (container.dataset.carouselInitialized === 'true') {
		return;
	}

	container.dataset.carouselInitialized = 'true';

	const mediaQuery = window.matchMedia(DESKTOP_QUERY);
	const showMoreButton = container.parentElement?.querySelector('[data-schedule-show-more]') ?? null;
	let items = [];
	let currentIndex = 0;
	let autoScrollId;
	let restartTimeoutId;
	let scrollUpdateId;

	const resolveVisibleItems = () =>
		Array.from(container.querySelectorAll(CARD_SELECTOR)).filter((item) => {
			if (!(item instanceof HTMLElement)) {
				return false;
			}
			const rect = item.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		});

	const refreshItems = () => {
		items = resolveVisibleItems();
		if (items.length === 0) {
			currentIndex = 0;
			return;
		}
		if (currentIndex >= items.length) {
			currentIndex = items.length - 1;
		}
		if (currentIndex < 0) {
			currentIndex = 0;
		}
	};

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

	const goToIndex = (index) => {
		refreshItems();
		if (items.length === 0) {
			return;
		}
		const normalizedIndex = ((index % items.length) + items.length) % items.length;
		const target = items[normalizedIndex];
		if (!(target instanceof HTMLElement)) {
			return;
		}
		currentIndex = normalizedIndex;
		const offset = target.offsetLeft - container.offsetLeft;
		container.scrollTo({ left: offset, behavior: 'smooth' });
	};

	const startAutoScroll = () => {
		clearAutoScroll();
		clearRestart();
		refreshItems();
		if (mediaQuery.matches || items.length <= 1) {
			return;
		}
		autoScrollId = window.setInterval(() => {
			if (mediaQuery.matches) {
				clearAutoScroll();
				return;
			}
			refreshItems();
			if (items.length <= 1) {
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
		refreshItems();
		if (items.length === 0) {
			return;
		}
		const center = container.scrollLeft + container.clientWidth / 2;
		let bestIndex = currentIndex;
		let bestDistance = Number.POSITIVE_INFINITY;
		items.forEach((item, index) => {
			if (!(item instanceof HTMLElement)) {
				return;
			}
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
		refreshItems();
		if (mediaQuery.matches) {
			currentIndex = 0;
			container.scrollTo({ left: 0, behavior: 'auto' });
		} else {
			restartAutoScroll();
		}
	};

	const resolveHiddenCards = () =>
		Array.from(container.querySelectorAll(CARD_SELECTOR)).filter((card) => {
			if (!(card instanceof HTMLElement)) {
				return false;
			}
			if (card.dataset.mobileHidden === 'true') {
				return true;
			}
			if (card.classList.contains('hidden')) {
				return true;
			}
			const style = window.getComputedStyle(card);
			return style.display === 'none' || style.visibility === 'hidden';
		});

	const revealAdditionalCards = () => {
		const hiddenCards = resolveHiddenCards();
		if (hiddenCards.length === 0) {
			return;
		}
		hiddenCards.forEach((card) => {
			if (!(card instanceof HTMLElement)) {
				return;
			}
			card.dataset.mobileHidden = 'false';
			card.classList.remove('hidden');
			if (!card.classList.contains('flex')) {
				card.classList.add('flex');
			}
		});
		refreshItems();
		restartAutoScroll();
		if (showMoreButton instanceof HTMLElement) {
			showMoreButton.classList.add('hidden');
			showMoreButton.setAttribute('aria-hidden', 'true');
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
	showMoreButton?.addEventListener('click', revealAdditionalCards, { once: true });

	refreshItems();
	if (items.length > 1) {
		startAutoScroll();
	}

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
		showMoreButton?.removeEventListener('click', revealAdditionalCards);
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
	const containers = Array.from(document.querySelectorAll(CAROUSEL_SELECTOR));
	containers.forEach((container) => {
		if (container instanceof HTMLElement) {
			initCarousel(container);
		}
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initAllCarousels, { once: true });
} else {
	initAllCarousels();
}

document.addEventListener('astro:page-load', initAllCarousels);
document.addEventListener('webe:schedule-ready', initAllCarousels);

export {};
