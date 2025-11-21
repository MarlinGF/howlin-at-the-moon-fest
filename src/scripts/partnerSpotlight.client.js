const PARTNER_CARD_SELECTOR = '[data-partner-card]';
const PARTNER_DISMISS_SELECTOR = '[data-partner-dismiss]';
const FOOTER_TARGET_SELECTOR = '[data-partner-footer-target]';
const PARTNER_DETAILS_SELECTOR = '[data-partner-details]';
const PARTNER_TOGGLE_SELECTOR = '[data-partner-toggle]';
const PARTNER_SUMMARY_SELECTOR = '[data-partner-summary]';
const PARTNER_FOOTER_TEASER_SELECTOR = '[data-partner-footer-teaser]';

const initSpotlight = () => {
	const card = document.querySelector(PARTNER_CARD_SELECTOR);
	if (!(card instanceof HTMLElement) || card.dataset.partnerSpotlightInitialized === 'true') {
		return;
	}

	const dismissButton = card.querySelector(PARTNER_DISMISS_SELECTOR);
	const footerTarget = document.querySelector(FOOTER_TARGET_SELECTOR);
	const details = card.querySelector(PARTNER_DETAILS_SELECTOR);
	const toggle = card.querySelector(PARTNER_TOGGLE_SELECTOR);
	const summary = card.querySelector(PARTNER_SUMMARY_SELECTOR);
	const footerTeaser = card.querySelector(PARTNER_FOOTER_TEASER_SELECTOR);
	if (!(dismissButton instanceof HTMLElement) || !(footerTarget instanceof HTMLElement)) {
		return;
	}

	card.dataset.partnerSpotlightInitialized = 'true';
	if (!card.dataset.partnerPlacement) {
		card.dataset.partnerPlacement = 'hero';
	}

	let expanded = false;
	let movedToFooter = false;
	let observer;

	const updateContentState = () => {
		const placement = card.dataset.partnerPlacement ?? 'hero';
		const inFooter = placement === 'footer';

		if (footerTeaser instanceof HTMLElement) {
			footerTeaser.hidden = !(inFooter && !expanded);
		}

		if (summary instanceof HTMLElement) {
			summary.hidden = Boolean(inFooter && !expanded);
		}

		if (details instanceof HTMLElement) {
			details.hidden = !expanded;
		}

		if (toggle instanceof HTMLElement) {
			toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			toggle.textContent = expanded ? 'Show less' : 'Read more';
			toggle.dataset.partnerTogglePlacement = inFooter ? 'footer' : 'hero';
		}
	};

	const setExpandedState = (nextExpanded) => {
		expanded = nextExpanded;
		updateContentState();
	};

	if (toggle instanceof HTMLElement) {
		toggle.addEventListener('click', () => {
			const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
			setExpandedState(!isExpanded);
		});
	}

	setExpandedState(false);

	const resolveDismissTrigger = (eventTarget) => {
		if (eventTarget instanceof Element) {
			return eventTarget.closest(PARTNER_DISMISS_SELECTOR);
		}
		if (eventTarget instanceof Text && eventTarget.parentElement) {
			return eventTarget.parentElement.closest(PARTNER_DISMISS_SELECTOR);
		}
		return null;
	};

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
		footerTarget.insertBefore(card, footerTarget.firstChild);
		if (observer) {
			observer.disconnect();
		}
		card.removeEventListener('click', handleCardClick);
		card.removeEventListener('keydown', handleCardKeydown);
	};

	const handleCardClick = (event) => {
		if (resolveDismissTrigger(event.target)) {
			event.preventDefault();
			moveToFooter();
		}
	};

	const handleCardKeydown = (event) => {
		if (resolveDismissTrigger(event.target)) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				moveToFooter();
			}
		}
	};

	card.addEventListener('click', handleCardClick);
	card.addEventListener('keydown', handleCardKeydown);

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
			card.removeEventListener('click', handleCardClick);
			card.removeEventListener('keydown', handleCardKeydown);
			if (observer) {
				observer.disconnect();
			}
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
