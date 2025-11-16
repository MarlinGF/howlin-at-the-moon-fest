const PARTNER_CARD_SELECTOR = '[data-partner-card]';
const PARTNER_DISMISS_SELECTOR = '[data-partner-dismiss]';
const FOOTER_TARGET_SELECTOR = '[data-partner-footer-target]';
const PARTNER_DETAILS_SELECTOR = '[data-partner-details]';
const PARTNER_TOGGLE_SELECTOR = '[data-partner-toggle]';

const initSpotlight = () => {
	const card = document.querySelector<HTMLElement>(PARTNER_CARD_SELECTOR);
	if (!card || card.dataset.partnerSpotlightInitialized === 'true') {
		return;
	}

	const dismissButton = card.querySelector<HTMLButtonElement>(PARTNER_DISMISS_SELECTOR);
	const footerTarget = document.querySelector<HTMLElement>(FOOTER_TARGET_SELECTOR);
	const details = card.querySelector<HTMLElement>(PARTNER_DETAILS_SELECTOR);
	const toggle = card.querySelector<HTMLButtonElement>(PARTNER_TOGGLE_SELECTOR);
	if (!dismissButton || !footerTarget) {
		return;
	}

	card.dataset.partnerSpotlightInitialized = 'true';

	let setExpandedState: ((expanded: boolean) => void) | undefined;

	if (details && toggle) {
		setExpandedState = (expanded: boolean) => {
			details.hidden = !expanded;
			toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			toggle.textContent = expanded ? 'Show less' : 'Read more';
		};

		setExpandedState(false);

		toggle.addEventListener('click', () => {
			const expanded = toggle.getAttribute('aria-expanded') === 'true';
			setExpandedState?.(!expanded);
		});
	}

	const moveToFooter = () => {
		dismissButton.remove();
		setExpandedState?.(false);
		footerTarget.appendChild(card);
	};

	dismissButton.addEventListener('click', moveToFooter, { once: true });

	card.addEventListener(
		'astro:before-swap',
		() => {
			dismissButton.removeEventListener('click', moveToFooter);
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
