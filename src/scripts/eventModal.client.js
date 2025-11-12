import dialogPolyfill from 'dialog-polyfill';
import 'dialog-polyfill/dist/dialog-polyfill.css';

/**
 * @param {HTMLDialogElement[]} dialogs
 */
const registerPolyfill = (dialogs) => {
	const supportsDialog = typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;
	if (supportsDialog) {
		return;
	}
	dialogs.forEach((dialog) => {
		dialogPolyfill.registerDialog(dialog);
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

export const initEventModals = () => {
	const dialogs = Array.from(document.querySelectorAll('dialog[data-event-modal="true"]'));
	if (dialogs.length === 0) {
		return;
	}

	registerPolyfill(/** @type {HTMLDialogElement[]} */ (dialogs));

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
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initEventModals, { once: true });
	} else {
		initEventModals();
	}
};

setupEventModals();
