const GRID_SELECTOR = '[data-gallery-grid]';
const ITEM_SELECTOR = '[data-gallery-item]';
const SHOW_MORE_SELECTOR = '[data-gallery-show-more]';

const initGrid = (grid) => {
	if (!(grid instanceof HTMLElement)) {
		return;
	}

	if (grid.dataset.galleryRevealInitialized === 'true') {
		return;
	}

	const showMoreButton = grid.parentElement?.querySelector(SHOW_MORE_SELECTOR) ?? null;
	if (!(showMoreButton instanceof HTMLElement)) {
		return;
	}

	grid.dataset.galleryRevealInitialized = 'true';

	const revealHiddenItems = () => {
		const hiddenItems = Array.from(
			grid.querySelectorAll(`${ITEM_SELECTOR}[data-gallery-mobile-hidden="true"]`)
		);
		if (hiddenItems.length === 0) {
			return;
		}

		hiddenItems.forEach((item) => {
			if (!(item instanceof HTMLElement)) {
				return;
			}
			item.classList.remove('hidden');
			if (!item.classList.contains('block') && !item.classList.contains('flex')) {
				item.classList.add('block');
			}
			item.dataset.galleryMobileHidden = 'false';
		});

		showMoreButton.classList.add('hidden');
		showMoreButton.setAttribute('aria-hidden', 'true');
	};

	showMoreButton.addEventListener('click', revealHiddenItems, { once: true });

	const cleanup = () => {
		showMoreButton.removeEventListener('click', revealHiddenItems);
	};

	grid.addEventListener(
		'astro:before-swap',
		() => {
			cleanup();
		},
		{ once: true }
	);
};

const initAllGrids = () => {
	const grids = Array.from(document.querySelectorAll(GRID_SELECTOR));
	grids.forEach((grid) => {
		if (grid instanceof HTMLElement) {
			initGrid(grid);
		}
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initAllGrids, { once: true });
} else {
	initAllGrids();
}

document.addEventListener('astro:page-load', initAllGrids);

export {};
