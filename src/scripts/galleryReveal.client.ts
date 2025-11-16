const GRID_SELECTOR = '[data-gallery-grid]';
const ITEM_SELECTOR = '[data-gallery-item]';
const SHOW_MORE_SELECTOR = '[data-gallery-show-more]';

const initGrid = (grid: HTMLElement) => {
	if (grid.dataset.galleryRevealInitialized === 'true') {
		return;
	}

	const showMoreButton = grid.parentElement?.querySelector<HTMLButtonElement>(SHOW_MORE_SELECTOR) ?? null;
	if (!showMoreButton) {
		return;
	}

	grid.dataset.galleryRevealInitialized = 'true';

	const revealHiddenItems = () => {
		const hiddenItems = Array.from(
			grid.querySelectorAll<HTMLElement>(`${ITEM_SELECTOR}[data-gallery-mobile-hidden="true"]`)
		);
		if (hiddenItems.length === 0) {
			return;
		}

		hiddenItems.forEach((item) => {
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
	const grids = Array.from(document.querySelectorAll<HTMLElement>(GRID_SELECTOR));
	grids.forEach((grid) => {
		initGrid(grid);
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initAllGrids, { once: true });
} else {
	initAllGrids();
}

document.addEventListener('astro:page-load', initAllGrids);

export {};
