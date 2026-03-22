const DIALOG_SELECTOR = 'dialog[data-connected-popup="true"]';
const CLOSE_SELECTOR = '[data-popup-close]';
const ROOT_SELECTOR = '[data-connected-popups-root]';
const DEFAULT_ENDPOINT = '/api/events';
const FRONT_PAGE_PLACEMENTS = new Set(['frontpage', 'front-page', 'homepage', 'home', 'index', 'all', '*']);

const canUseDialogs = () => typeof HTMLDialogElement !== 'undefined';

const getRoot = () => document.querySelector(ROOT_SELECTOR);

const readEndpoint = () => {
	const root = getRoot();
	const configured = root?.dataset.popupsEndpoint;
	if (configured && configured.trim().length > 0) {
		return configured.trim();
	}
	return DEFAULT_ENDPOINT;
};

const rememberDismissed = (id) => {
	if (!id) {
		return;
	}
	try {
		sessionStorage.setItem(`howlin-popup-dismissed-${id}`, '1');
	} catch {
		// Ignore storage failures.
	}
};

const wasDismissed = (id) => {
	if (!id) {
		return false;
	}
	try {
		return sessionStorage.getItem(`howlin-popup-dismissed-${id}`) === '1';
	} catch {
		return false;
	}
};

const closeDialog = (dialog) => {
	if (!(dialog instanceof HTMLDialogElement)) {
		return;
	}
	const popupId = dialog.dataset.popupId;
	rememberDismissed(popupId);
	if (dialog.open) {
		dialog.close();
	}
};

const bindDialog = (dialog) => {
	if (dialog.dataset.popupBound === 'true') {
		return;
	}
	dialog.dataset.popupBound = 'true';
	dialog.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		const closeButton = target.closest(CLOSE_SELECTOR);
		if (closeButton) {
			closeDialog(dialog);
			return;
		}
		if (target === dialog) {
			closeDialog(dialog);
		}
	});
	dialog.addEventListener('close', () => {
		const popupId = dialog.dataset.popupId;
		rememberDismissed(popupId);
	});
};

const normalizePlacement = (value) => {
	if (Array.isArray(value)) {
		return value
			.filter((entry) => typeof entry === 'string')
			.map((entry) => entry.trim().toLowerCase())
			.filter((entry) => entry.length > 0);
	}
	if (typeof value === 'string' && value.trim().length > 0) {
		return [value.trim().toLowerCase()];
	}
	return [];
};

const isFrontPagePopup = (popup) => {
	const placements = normalizePlacement(popup.placement);
	if (placements.length === 0) {
		return true;
	}
	return placements.some((placement) => FRONT_PAGE_PLACEMENTS.has(placement));
};

const createCtaLink = (cta, variant) => {
	const anchor = document.createElement('a');
	anchor.href = cta.href ?? '#';
	anchor.textContent = cta.label ?? 'Learn more';
	anchor.className =
		variant === 'primary'
			? 'inline-flex items-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100 transition hover:border-fuchsia-400 hover:text-white'
			: 'inline-flex items-center gap-2 rounded-full border border-slate-600/80 bg-slate-800/60 px-5 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-100 transition hover:border-fuchsia-400 hover:text-white';
	return anchor;
};

const createDialogElement = (popup) => {
	const dialog = document.createElement('dialog');
	dialog.id = `popup-${popup.id}`;
	dialog.dataset.connectedPopup = 'true';
	dialog.dataset.popupId = popup.id;
	dialog.dataset.popupEnabled = popup.enabled !== false ? 'true' : 'false';
	dialog.className = 'backdrop:bg-slate-950/80 w-full max-w-xl rounded-3xl border border-slate-700/60 bg-slate-900/95 p-0 text-slate-100 shadow-2xl';
	dialog.setAttribute('aria-labelledby', `popup-title-${popup.id}`);

	const container = document.createElement('div');
	container.className = 'flex flex-col gap-6 p-8';
	dialog.appendChild(container);

	const header = document.createElement('div');
	header.className = 'flex items-start justify-between gap-4';
	container.appendChild(header);

	const title = document.createElement('h2');
	title.id = `popup-title-${popup.id}`;
	title.className = 'text-2xl font-bold text-white';
	title.textContent = popup.title;
	header.appendChild(title);

	if (popup.dismissible !== false) {
		const closeButton = document.createElement('button');
		closeButton.type = 'button';
		closeButton.dataset.popupClose = 'true';
		closeButton.setAttribute('aria-label', 'Close popup');
		closeButton.className = 'flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/60 text-slate-300 transition hover:border-slate-500 hover:text-white';
		closeButton.textContent = '×';
		header.appendChild(closeButton);
	}

	if (popup.message) {
		const message = document.createElement('p');
		message.className = 'text-base text-slate-200';
		message.textContent = popup.message;
		container.appendChild(message);
	}

	if (popup.primaryCta || popup.secondaryCta) {
		const ctaRow = document.createElement('div');
		ctaRow.className = 'flex flex-wrap gap-3';
		if (popup.primaryCta) {
			ctaRow.appendChild(createCtaLink(popup.primaryCta, 'primary'));
		}
		if (popup.secondaryCta) {
			ctaRow.appendChild(createCtaLink(popup.secondaryCta, 'secondary'));
		}
		container.appendChild(ctaRow);
	}

	return dialog;
};

const renderPopups = (popups) => {
	const root = getRoot();
	if (!root) {
		return [];
	}
	root.innerHTML = '';
	const fragment = document.createDocumentFragment();
	popups.forEach((popup) => {
		fragment.appendChild(createDialogElement(popup));
	});
	root.appendChild(fragment);
	return Array.from(root.querySelectorAll(DIALOG_SELECTOR));
};

const parsePopups = (payload) => {
	const popups = Array.isArray(payload?.popups) ? payload.popups : [];
	return popups
		.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.title === 'string')
		.map((entry) => ({
			...entry,
			enabled: entry.enabled !== false,
			dismissible: entry.dismissible !== false,
			placement: normalizePlacement(entry.placement),
		}))
		.filter((popup) => popup.enabled)
		.filter(isFrontPagePopup);
};

const fetchPopups = async (endpoint) => {
	const response = await fetch(endpoint, {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
	});
	if (!response.ok) {
		throw new Error(`connectedPopups responded with ${response.status}`);
	}
	const payload = await response.json();
	return parsePopups(payload);
};

const launch = (dialogsParam) => {
	if (!canUseDialogs()) {
		return;
	}
	const dialogs = dialogsParam ?? Array.from(document.querySelectorAll(DIALOG_SELECTOR));
	if (dialogs.length === 0) {
		return;
	}
	dialogs.forEach((dialog) => {
		if (dialog instanceof HTMLDialogElement) {
			bindDialog(dialog);
		}
	});
	const nextPopup = dialogs.find((dialog) => {
		if (!(dialog instanceof HTMLDialogElement)) {
			return false;
		}
		if (dialog.dataset.popupEnabled === 'false') {
			return false;
		}
		return !wasDismissed(dialog.dataset.popupId);
	});
	if (nextPopup instanceof HTMLDialogElement && !nextPopup.open) {
		nextPopup.showModal();
	}
};

const hydratePopups = async () => {
	const endpoint = readEndpoint();
	if (!endpoint) {
		return;
	}
	try {
		const popups = await fetchPopups(endpoint);
		if (popups.length === 0) {
			return;
		}
		const dialogs = renderPopups(popups);
		if (dialogs.length > 0) {
			launch(dialogs);
		}
	} catch (error) {
		console.warn('Unable to refresh connected popups.', error);
	}
};

const bootstrap = () => {
	launch();
	void hydratePopups();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
	bootstrap();
}
