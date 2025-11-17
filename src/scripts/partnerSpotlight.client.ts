const PARTNER_CARD_SELECTOR = '[data-partner-card]';
const PARTNER_DISMISS_SELECTOR = '[data-partner-dismiss]';
const FOOTER_TARGET_SELECTOR = '[data-partner-footer-target]';
const PARTNER_DETAILS_SELECTOR = '[data-partner-details]';
const PARTNER_TOGGLE_SELECTOR = '[data-partner-toggle]';
const PARTNER_SUMMARY_SELECTOR = '[data-partner-summary]';
const PARTNER_FOOTER_TEASER_SELECTOR = '[data-partner-footer-teaser]';

const initSpotlight = () => {
	const card = document.querySelector<HTMLElement>(PARTNER_CARD_SELECTOR);
	if (!card || card.dataset.partnerSpotlightInitialized === 'true') {
		return;
	}

	const dismissButton = card.querySelector<HTMLButtonElement>(PARTNER_DISMISS_SELECTOR);
	const footerTarget = document.querySelector<HTMLElement>(FOOTER_TARGET_SELECTOR);
	const details = card.querySelector<HTMLElement>(PARTNER_DETAILS_SELECTOR);
	const toggle = card.querySelector<HTMLButtonElement>(PARTNER_TOGGLE_SELECTOR);
	const summary = card.querySelector<HTMLElement>(PARTNER_SUMMARY_SELECTOR);
	const footerTeaser = card.querySelector<HTMLElement>(PARTNER_FOOTER_TEASER_SELECTOR);
	if (!dismissButton || !footerTarget) {
		return;
	}

	card.dataset.partnerSpotlightInitialized = 'true';
	if (!card.dataset.partnerPlacement) {
		card.dataset.partnerPlacement = 'hero';
	}

	let expanded = false;
	let movedToFooter = false;
	let observer: IntersectionObserver | undefined;

	const updateContentState = () => {
		const placement = card.dataset.partnerPlacement ?? 'hero';
		const inFooter = placement === 'footer';

		if (footerTeaser) {
			footerTeaser.hidden = !(inFooter && !expanded);
		}

		if (summary) {
			summary.hidden = Boolean(inFooter && !expanded);
		}

		if (details) {
			details.hidden = !expanded;
		}

		if (toggle) {
			toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			toggle.textContent = expanded ? 'Show less' : 'Read more';
			toggle.dataset.partnerTogglePlacement = inFooter ? 'footer' : 'hero';
		}
	};

	const setExpandedState = (nextExpanded: boolean) => {
		expanded = nextExpanded;
		updateContentState();
	};

	if (toggle) {
		toggle.addEventListener('click', () => {
			const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
			setExpandedState(!isExpanded);
		});
	}

	setExpandedState(false);

	const moveToFooter = () => {
		if (movedToFooter) {
			return;
		}

		movedToFooter = true;
		dismissButton.remove();
		card.dataset.partnerPlacement = 'footer';
		card.classList.add('partner-card--footer');
		footerTarget.dataset.partnerFooterState = 'with-card';
		setExpandedState(false);
		footerTarget.prepend(card);
		observer?.disconnect();
	};

	dismissButton.addEventListener('click', moveToFooter, { once: true });

	observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting && entry.boundingClientRect.bottom <= 0) {
					moveToFooter();
				}
			});
		},
		{ threshold: [0, 0.25] }
	);

	observer.observe(card);

	card.addEventListener(
		'astro:before-swap',
		() => {
			dismissButton.removeEventListener('click', moveToFooter);
			observer?.disconnect();
		},
		{ once: true }
	);
};

const initAllSpotlights = () => {
	initSpotlight();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initAllSpotlights, { once: true });
} else {
	initAllSpotlights();
}

document.addEventListener('astro:page-load', initAllSpotlights);

export {};
