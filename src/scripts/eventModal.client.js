const POLYFILL_MODULE_URL = 'https://esm.sh/dialog-polyfill@0.5.6?bundle';
const POLYFILL_STYLES_URL = 'https://esm.sh/dialog-polyfill@0.5.6/dialog-polyfill.css';

let polyfillPromise;

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

/**
 * @param {HTMLDialogElement[]} dialogs
 */
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

/**
 * @param {HTMLDialogElement} dialog
 */
const openDialog = (dialog) => {
	if (typeof dialog.showModal === 'function') {
		dialog.showModal();
	} else {
		dialog.setAttribute('open', '');
	}
};

/**
 * @param {HTMLDialogElement} dialog
 */
const closeDialog = (dialog) => {
	if (typeof dialog.close === 'function') {
		dialog.close();
	} else {
		dialog.removeAttribute('open');
	}
};

export const initEventModals = async () => {
	const dialogs = Array.from(document.querySelectorAll('dialog[data-event-modal="true"]'));
	if (dialogs.length === 0) {
		return;
	}

	await registerPolyfill(/** @type {HTMLDialogElement[]} */ (dialogs));

	const modalMap = new Map(dialogs.map((dialog) => [dialog.id, dialog]));

	document.querySelectorAll('[data-open-modal]').forEach((button) => {
		button.addEventListener('click', () => {
			const targetId = button.getAttribute('data-open-modal');
			const dialog = targetId ? modalMap.get(targetId) : undefined;
			if (dialog) {
				openDialog(dialog);
			}
		});
	});

	document.querySelectorAll('[data-close-modal]').forEach((button) => {
		button.addEventListener('click', () => {
			const targetId = button.getAttribute('data-close-modal');
			const dialog = targetId ? modalMap.get(targetId) : undefined;
			if (dialog) {
				closeDialog(dialog);
			}
		});
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			modalMap.forEach((dialog) => {
				if (dialog.hasAttribute('open') || dialog.open) {
					closeDialog(dialog);
				}
			});
		}
	});
};

export const setupEventModals = () => {
	const launch = () => {
		void initEventModals();
	};
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', launch, { once: true });
	} else {
		launch();
	}
};

setupEventModals();
