const DIALOG_SELECTOR = 'dialog[data-connected-popup="true"]';
const CLOSE_SELECTOR = '[data-popup-close]';

const canUseDialogs = () => typeof HTMLDialogElement !== 'undefined';

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

const launch = () => {
	if (!canUseDialogs()) {
		return;
	}
	const dialogs = Array.from(document.querySelectorAll(DIALOG_SELECTOR));
	dialogs.forEach((dialog) => {
		bindDialog(dialog);
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

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', launch, { once: true });
} else {
	launch();
}
