const STORAGE_KEY = 'parascene.likes.v1';

function getCreationLikeId(creation) {
	if (!creation) return null;

	const id = creation.created_image_id
		?? creation.creation_id
		?? creation.id
		?? creation.image_id
		?? creation.slug;

	if (id === null || id === undefined) return null;
	return String(id);
}

function readLikedIdSet() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Set();

		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return new Set(parsed.map(String));
		}

		if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ids)) {
			return new Set(parsed.ids.map(String));
		}
	} catch {
		// ignore malformed local storage
	}

	return new Set();
}

function writeLikedIdSet(set) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
	} catch {
		// ignore quota / disabled storage errors
	}
}

function toSafeInt(value, fallback = 0) {
	const n = Number.parseInt(String(value ?? ''), 10);
	return Number.isFinite(n) ? n : fallback;
}

export function getCreationBaseLikeCount(creation) {
	if (!creation) return 0;

	// Prefer API-like naming, but allow a few variants.
	if (creation.like_count !== undefined && creation.like_count !== null) {
		return Math.max(0, toSafeInt(creation.like_count, 0));
	}

	if (creation.likeCount !== undefined && creation.likeCount !== null) {
		return Math.max(0, toSafeInt(creation.likeCount, 0));
	}

	if (creation.likes !== undefined && creation.likes !== null) {
		return Math.max(0, toSafeInt(creation.likes, 0));
	}

	return 0;
}

// What the UI should show given our local like state.
export function getCreationLikeCount(creation) {
	const base = getCreationBaseLikeCount(creation);
	return base + (isCreationLiked(creation) ? 1 : 0);
}

export function isCreationLiked(creation) {
	const id = getCreationLikeId(creation);
	if (!id) return false;

	return readLikedIdSet().has(id);
}

export function setCreationLiked(creation, liked) {
	const id = getCreationLikeId(creation);
	if (!id) return false;

	const set = readLikedIdSet();
	if (liked) {
		set.add(id);
	} else {
		set.delete(id);
	}

	writeLikedIdSet(set);
	return set.has(id);
}

export function toggleCreationLiked(creation) {
	const id = getCreationLikeId(creation);
	if (!id) return false;

	const set = readLikedIdSet();
	const next = !set.has(id);

	if (next) {
		set.add(id);
	} else {
		set.delete(id);
	}

	writeLikedIdSet(set);
	return next;
}

export function applyLikeButtonState(buttonEl, liked, animate = false) {
	if (!(buttonEl instanceof HTMLElement)) return;

	buttonEl.setAttribute('aria-pressed', liked ? 'true' : 'false');
	buttonEl.classList.toggle('is-liked', Boolean(liked));

	if (!animate) return;

	// Restart animation even if clicked rapidly.
	buttonEl.classList.remove('is-like-animating');
	// eslint-disable-next-line no-unused-expressions
	buttonEl.offsetWidth;
	buttonEl.classList.add('is-like-animating');

	const svg = buttonEl.querySelector('svg');
	if (!(svg instanceof SVGElement)) return;

	svg.addEventListener('animationend', () => {
		buttonEl.classList.remove('is-like-animating');
	}, { once: true });
}

function getLikeCountEl(buttonEl) {
	if (!(buttonEl instanceof HTMLElement)) return null;

	const preferred = buttonEl.querySelector('[data-like-count]');
	if (preferred instanceof HTMLElement) return preferred;

	// Back-compat for existing markup (feed uses this class today)
	const fallback = buttonEl.querySelector('.feed-card-action-count');
	if (fallback instanceof HTMLElement) return fallback;

	return null;
}

function setDisplayedLikeCount(buttonEl, creation, likedOverride) {
	const countEl = getLikeCountEl(buttonEl);
	if (!countEl) return;

	const base = getCreationBaseLikeCount(creation);
	const liked = typeof likedOverride === 'boolean'
		? likedOverride
		: isCreationLiked(creation);
	const displayed = Math.max(0, base + (liked ? 1 : 0));
	countEl.textContent = String(displayed);
}

export function initLikeButton(buttonEl, creation) {
	if (!(buttonEl instanceof HTMLElement)) return false;

	const id = getCreationLikeId(creation);
	if (id) buttonEl.dataset.likeId = id;
	buttonEl.dataset.likeButton = 'true';
	buttonEl.dataset.likeBaseCount = String(getCreationBaseLikeCount(creation));

	const liked = isCreationLiked(creation);
	applyLikeButtonState(buttonEl, liked, false);
	setDisplayedLikeCount(buttonEl, creation, liked);
	return liked;
}

const rootsWithListener = new WeakSet();

export function enableLikeButtons(root = document) {
	const target = root instanceof Document ? root : (root instanceof HTMLElement ? root : null);
	if (!target) return;
	if (rootsWithListener.has(target)) return;
	rootsWithListener.add(target);

	target.addEventListener('click', (e) => {
		const el = e.target;
		if (!(el instanceof Element)) return;

		const button = el.closest('button[data-like-button], button[data-like-id]');
		if (!(button instanceof HTMLButtonElement)) return;

		const id = button.dataset.likeId;
		if (!id) return;

		const baseCount = toSafeInt(button.dataset.likeBaseCount, null);
		const baseCreation = { like_count: baseCount !== null ? baseCount : undefined };

		e.preventDefault();
		e.stopPropagation();

		const set = readLikedIdSet();
		const next = !set.has(id);
		if (next) {
			set.add(id);
		} else {
			set.delete(id);
		}
		writeLikedIdSet(set);

		// Always recompute from base + local liked state (don’t trust rendered text).
		setDisplayedLikeCount(button, baseCreation, next);
		applyLikeButtonState(button, next, next);
	}, { capture: true });
}

