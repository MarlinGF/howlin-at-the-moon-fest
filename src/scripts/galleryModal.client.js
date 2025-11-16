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
				console.warn('Unable to load dialog-polyfill; gallery dialogs may not behave consistently in older browsers.', error);
				return null;
			});
	}
	return polyfillPromise;
};

const commentStore = new Map();

const formatCommentCount = (count) => (count === 1 ? '1 comment' : `${count} comments`);

const syncGalleryBadges = (storageKey, count) => {
	if (!storageKey) return;
	const label = `${formatCommentCount(count)} on this photo`;
	document.querySelectorAll(`[data-gallery-badge="${storageKey}"]`).forEach((badge) => {
		badge.textContent = String(count);
	});
	document
		.querySelectorAll(`[data-gallery-badge-wrapper="${storageKey}"]`)
		.forEach((wrapper) => {
			wrapper.setAttribute('aria-label', label);
			wrapper.setAttribute('title', label);
			const sr = wrapper.querySelector('[data-gallery-badge-sr]');
			if (sr) {
				sr.textContent = label;
			}
		});
};

const ensureUserState = () => {
	if (!window.webeUser) {
		window.webeUser = { status: 'guest' };
	}
	return window.webeUser;
};

const setUserState = (next) => {
	window.webeUser = next;
	document.dispatchEvent(new CustomEvent('webe:user-change', { detail: next }));
};

const formatDisplayTime = (timestamp) => {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return timestamp;
	}
	return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const renderComments = (container) => {
	const list = container.querySelector('[data-comment-list]');
	if (!list) return;
	const storageKey = container.getAttribute('data-gallery-id');
	const comments = commentStore.get(storageKey) ?? [];
	list.innerHTML = '';
	if (comments.length === 0) {
		const emptyState = document.createElement('li');
		emptyState.className = 'rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400';
		emptyState.textContent = 'No comments yet. Be the first to share your story from this moment.';
		list.append(emptyState);
	} else {
		comments.forEach((comment) => {
			const item = document.createElement('li');
			item.className = 'space-y-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4';
			const header = document.createElement('div');
			header.className = 'flex items-center justify-between text-xs text-slate-400';
			const author = document.createElement('span');
			author.className = 'font-semibold text-slate-100';
			author.textContent = comment.author;
			const time = document.createElement('time');
			time.className = 'text-slate-400';
			time.dateTime = comment.timestamp;
			time.textContent = comment.displayTime;
			header.append(author, time);
			const body = document.createElement('p');
			body.className = 'text-sm text-slate-100';
			body.textContent = comment.text;
			item.append(header, body);
			list.append(item);
		});
	}
	const count = container.querySelector('[data-comment-count]');
	if (count) {
		count.textContent = String(comments.length);
	}
	syncGalleryBadges(storageKey, comments.length);
};

const updateCommentState = (container) => {
	const state = ensureUserState().status;
	const panels = container.querySelectorAll('[data-comment-state]');
	panels.forEach((panel) => {
		panel.classList.toggle('hidden', panel.getAttribute('data-comment-state') !== state);
	});
	const userLabel = container.querySelector('[data-comment-user]');
	if (userLabel) {
		const user = ensureUserState();
		userLabel.textContent = user.status === 'signed-in' ? `Commenting as ${user.name ?? 'WeBeFriends Member'}` : '';
	}
};

const bindGuestFlows = (container, commentBody) => {
	const signInToggle = container.querySelector('[data-comment-show-signin]');
	const signInForm = container.querySelector('[data-comment-signin-form]');
	if (signInToggle && signInForm) {
		signInToggle.addEventListener('click', () => {
			signInForm.classList.remove('hidden');
			signInForm.querySelector('input')?.focus();
		});
		signInForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const formData = new FormData(signInForm);
			const displayName = String(formData.get('displayName') ?? '').trim();
			if (!displayName) return;
			setUserState({ status: 'signed-in', name: displayName });
			signInForm.reset();
			signInForm.classList.add('hidden');
			updateCommentState(container);
			commentBody?.classList.remove('hidden');
			container.querySelector('[data-comment-form] textarea')?.focus();
		});
	}
};

const bindSignedInFlows = (container, commentBody, trigger) => {
	const commentForm = container.querySelector('[data-comment-form]');
	if (commentForm) {
		commentForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const textarea = commentForm.querySelector('textarea');
			if (!textarea) return;
			const value = textarea.value.trim();
			if (!value) return;
			const storageKey = container.getAttribute('data-gallery-id');
			const user = ensureUserState();
			const comments = commentStore.get(storageKey) ?? [];
			const timestamp = new Date().toISOString();
			comments.push({
				text: value,
				timestamp,
				displayTime: formatDisplayTime(timestamp),
				author: user.name ?? 'WeBeFriends Member',
			});
			commentStore.set(storageKey, comments);
			renderComments(container);
			textarea.value = '';
			commentBody?.classList.add('hidden');
			const dialog = container.closest('dialog');
			if (dialog && typeof dialog.scrollTo === 'function') {
				dialog.scrollTo({ top: 0, behavior: 'smooth' });
			}
			trigger?.focus();
		});
	}
	const signOutButton = container.querySelector('[data-comment-signout]');
	if (signOutButton) {
		signOutButton.addEventListener('click', () => {
			setUserState({ status: 'guest' });
			updateCommentState(container);
			commentBody?.classList.add('hidden');
		});
	}
};

const bindCommentContainer = (container) => {
	if (container.hasAttribute('data-gallery-bound')) return;
	container.setAttribute('data-gallery-bound', 'true');
	const commentBody = container.querySelector('[data-comment-body]');
	const trigger = container.querySelector('[data-comment-trigger]');
	renderComments(container);
	updateCommentState(container);
	bindGuestFlows(container, commentBody);
	bindSignedInFlows(container, commentBody, trigger);
	if (trigger && commentBody) {
		trigger.addEventListener('click', () => {
			commentBody.classList.remove('hidden');
			updateCommentState(container);
			if (ensureUserState().status === 'signed-in') {
				container.querySelector('[data-comment-form] textarea')?.focus();
			}
		});
	}
};

const openDialog = (dialog) => {
	if (typeof dialog.showModal === 'function') {
		dialog.showModal();
	}
};

const closeDialog = (dialog) => {
	if (typeof dialog.close === 'function') {
		dialog.close();
	}
};

const registerDialogs = async (dialogs) => {
	const polyfill = await ensureDialogPolyfill();
	dialogs.forEach((dialog) => {
		if (dialog.hasAttribute('data-dialog-bound')) return;
		dialog.setAttribute('data-dialog-bound', 'true');
		if (polyfill && typeof polyfill.registerDialog === 'function') {
			polyfill.registerDialog(dialog);
		}
	});
};

const initGalleryModals = async () => {
	ensureUserState();
	const dialogs = Array.from(document.querySelectorAll('dialog[data-gallery-modal="true"]'));
	if (dialogs.length === 0) return;
	await registerDialogs(dialogs);
	dialogs.forEach((dialog) => {
		const key = dialog.id;
		const openers = document.querySelectorAll(`[data-gallery-target="${key}"]`);
		openers.forEach((opener) => {
			opener.addEventListener('click', () => openDialog(dialog));
		});
		const closer = dialog.querySelector('[data-gallery-close]');
		if (closer) {
			closer.addEventListener('click', () => closeDialog(dialog));
		}
		dialog.addEventListener('cancel', (event) => {
			event.preventDefault();
			closeDialog(dialog);
		});
		const commentContainer = dialog.querySelector('[data-gallery-comment]');
		if (commentContainer) {
			bindCommentContainer(commentContainer);
		}
	});
};

const rerenderOnUserChange = () => {
	document.addEventListener('webe:user-change', () => {
		const containers = document.querySelectorAll('[data-gallery-comment]');
		containers.forEach((container) => {
			updateCommentState(container);
		});
	});
};

const bootstrap = () => {
	if (document.documentElement.hasAttribute('data-gallery-init')) return;
	document.documentElement.setAttribute('data-gallery-init', 'true');
	rerenderOnUserChange();
	void initGalleryModals();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
	bootstrap();
}

document.addEventListener('astro:page-load', () => {
	void initGalleryModals();
});
