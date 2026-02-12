const POLYFILL_MODULE_URL = 'https://esm.sh/dialog-polyfill@0.5.6?bundle';
const POLYFILL_STYLES_URL = 'https://esm.sh/dialog-polyfill@0.5.6/dialog-polyfill.css';
const MODAL_SELECTOR = 'dialog[data-event-modal="true"]';

let polyfillPromise;
const processedDialogs = new Set();
const modalMap = new Map();

const ensureStylesheet = () => {
	if (document.querySelector('link[data-dialog-polyfill]')) {
		return;
	}
	const link = document.createElement('link');
	link.setAttribute('rel', 'stylesheet');
	link.setAttribute('href', POLYFILL_STYLES_URL);
	link.setAttribute('data-dialog-polyfill', 'true');
	document.head.append(link);
};

const ensureDialogPolyfill = async () => {
	if (typeof window === 'undefined') {
		return null;
	}
	const supportsDialog = typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;
	if (supportsDialog) {
		return null;
	}
	if (!polyfillPromise) {
		polyfillPromise = import(/* @vite-ignore */ POLYFILL_MODULE_URL)
			.then((module) => {
				ensureStylesheet();
				return module?.default ?? module;
			})
			.catch((error) => {
				console.warn('Unable to load dialog-polyfill; dialogs may not behave consistently in older browsers.', error);
				return null;
			});
	}
	return polyfillPromise;
};

const registerPolyfill = async (dialogs) => {
	const polyfill = await ensureDialogPolyfill();
	if (!polyfill) {
		return;
	}
	dialogs.forEach((dialog) => {
		if (typeof polyfill.registerDialog === 'function') {
			polyfill.registerDialog(dialog);
		}
	});
};

const openDialog = (dialog) => {
	if (typeof dialog.showModal === 'function') {
		dialog.showModal();
	} else {
		dialog.setAttribute('open', '');
	}
};

const closeDialog = (dialog) => {
	if (typeof dialog.close === 'function') {
		dialog.close();
	} else {
		dialog.removeAttribute('open');
	}
};

const refreshModals = async () => {
	const dialogs = Array.from(document.querySelectorAll(MODAL_SELECTOR));
	const newDialogs = dialogs.filter((dialog) => dialog.id && !processedDialogs.has(dialog.id));
	if (newDialogs.length > 0) {
		await registerPolyfill(newDialogs);
		newDialogs.forEach((dialog) => {
			if (dialog.id) {
				processedDialogs.add(dialog.id);
			}
		});
	}
	modalMap.clear();
	dialogs.forEach((dialog) => {
		if (dialog.id) {
			modalMap.set(dialog.id, dialog);
		}
	});
};

const handleDocumentClick = (event) => {
	const rawTarget = event.target instanceof Element ? event.target : null;
	if (!rawTarget) {
		return;
	}
	const openTrigger = rawTarget.closest('[data-open-modal]');
	if (openTrigger) {
		const targetId = openTrigger.getAttribute('data-open-modal');
		if (targetId) {
			const dialog = modalMap.get(targetId);
			if (dialog) {
				openDialog(dialog);
			}
		}
	}
	const closeTrigger = rawTarget.closest('[data-close-modal]');
	if (closeTrigger) {
		const targetId = closeTrigger.getAttribute('data-close-modal');
		if (targetId) {
			const dialog = modalMap.get(targetId);
			if (dialog) {
				closeDialog(dialog);
			}
		}
	}
};

const handleEscape = (event) => {
	if (event.key !== 'Escape') {
		return;
	}
	modalMap.forEach((dialog) => {
		if (dialog.hasAttribute('open') || dialog.open) {
			closeDialog(dialog);
		}
	});
};

export const initEventModals = async () => {
	await refreshModals();
};

export const setupEventModals = () => {
	const launch = () => {
		void refreshModals();
	};
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', launch, { once: true });
	} else {
		launch();
	}
	document.addEventListener('click', handleDocumentClick);
	document.addEventListener('keydown', handleEscape);
	document.addEventListener('astro:page-load', launch);
	document.addEventListener('webe:event-modals-ready', launch);
};

setupEventModals();
