import dialogPolyfill from 'dialog-polyfill';
import 'dialog-polyfill/dist/dialog-polyfill.css';

const registerPolyfill = (dialogs: HTMLDialogElement[]) => {
	const supportsDialog = typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;
	if (supportsDialog) {
		return;
	}
	dialogs.forEach((dialog) => {
		dialogPolyfill.registerDialog(dialog);
	});
};

const openDialog = (dialog: HTMLDialogElement) => {
	if (typeof dialog.showModal === 'function') {
		dialog.showModal();
	} else {
		dialog.setAttribute('open', '');
	}
};

const closeDialog = (dialog: HTMLDialogElement) => {
	if (typeof dialog.close === 'function') {
		dialog.close();
	} else {
		dialog.removeAttribute('open');
	}
};

const initEventModals = () => {
	const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[data-event-modal="true"]'));
	if (dialogs.length === 0) {
		return;
	}

	registerPolyfill(dialogs);

	const modalMap = new Map(dialogs.map((dialog) => [dialog.id, dialog]));

	document.querySelectorAll<HTMLElement>('[data-open-modal]').forEach((button) => {
		button.addEventListener('click', () => {
			const targetId = button.getAttribute('data-open-modal');
			const dialog = targetId ? modalMap.get(targetId) : undefined;
			if (dialog) {
				openDialog(dialog);
			}
		});
	});

	document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach((button) => {
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
				if (dialog.hasAttribute('open') || (dialog as HTMLDialogElement).open) {
					closeDialog(dialog);
				}
			});
		}
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initEventModals, { once: true });
} else {
	initEventModals();
}
