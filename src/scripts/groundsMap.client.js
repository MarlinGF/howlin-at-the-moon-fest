const FESTIVAL_DARK_STYLE = [
	{ elementType: 'geometry', stylers: [{ color: '#0b1120' }] },
	{ elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
	{ elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
	{ featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
	{ featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
	{ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14532d' }] },
	{ featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
	{ featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#f9fafb' }] },
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4c1d95' }] },
	{ featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#312e81' }] },
	{ featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

let mapsPromise;
let loadedMapIds = new Set();

const DERIVED_DARK_STYLE = FESTIVAL_DARK_STYLE;

const ensureMapsSdk = (key, mapId, useMapId = false) => {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('Google Maps can only be loaded in the browser.'));
	}
	if (window.google?.maps) {
		return Promise.resolve(window.google.maps);
	}
	if (!key) {
		return Promise.reject(new Error('Missing Google Maps API key.'));
	}
	if (mapsPromise) {
		return mapsPromise;
	}
	mapsPromise = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		let src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
		const mapIds = new Set();
		if (useMapId && mapId) {
			mapIds.add(mapId);
		}
		document.querySelectorAll('[data-map-container][data-map-use-cloud="true"]').forEach((node) => {
			const candidate = node.getAttribute('data-map-map-id')?.trim();
			if (candidate) {
				mapIds.add(candidate);
			}
		});
		loadedMapIds = mapIds;
		if (mapIds.size > 0) {
			src += `&map_ids=${Array.from(mapIds)
				.map((id) => encodeURIComponent(id))
				.join(',')}`;
		}
		script.src = src;
		script.async = true;
		script.onerror = () => reject(new Error('Failed to load Google Maps SDK.'));
		script.onload = () => {
			if (window.google?.maps) {
				resolve(window.google.maps);
			} else {
				reject(new Error('Google Maps SDK did not initialise correctly.'));
			}
		};
		document.head.append(script);
	});
	return mapsPromise;
};

const parseCoordinate = (maps, value) => {
	if (!value) {
		return null;
	}
	const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
	if (!match) {
		return null;
	}
	const lat = Number(match[1]);
	const lng = Number(match[2]);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		return null;
	}
	return new maps.LatLng(lat, lng);
};

const geocodeQuery = (maps, query) =>
	new Promise((resolve, reject) => {
		const geocoder = new maps.Geocoder();
		geocoder.geocode({ address: query }, (results, status) => {
			if (status === 'OK' && results && results[0]?.geometry?.location) {
				resolve(results[0].geometry.location);
				return;
			}
			reject(new Error(`Geocoding failed: ${status}`));
		});
	});

const toggleElement = (element, hidden) => {
	if (!element) return;
	element.classList.toggle('hidden', hidden);
	if (!hidden) {
		element.classList.add('flex');
	} else {
		element.classList.remove('flex');
	}
};

const showError = (container) => {
	const error = container.querySelector('[data-map-error]');
	const loading = container.querySelector('[data-map-loading]');
	if (loading) {
		loading.classList.add('hidden');
	}
	if (error) {
		toggleElement(error, false);
		setTimeout(() => {
			toggleElement(error, true);
		}, 6000);
	}
};

const renderMap = async (container, maps, options = {}) => {
	const preferCloudStyle = options.preferCloudStyle === true;
	const canvas = container.querySelector('[data-map-canvas]');
	if (!canvas) {
		return;
	}
	const zoomValue = Number.parseInt(container.getAttribute('data-map-zoom') ?? '', 10);
	const zoom = Number.isFinite(zoomValue) ? zoomValue : 15;
	const mapId = container.getAttribute('data-map-map-id')?.trim();
	const query = container.getAttribute('data-map-query') ?? '';
	const label = container.getAttribute('data-map-label') || 'Festival Grounds';

	let location;
	const coordinate = parseCoordinate(maps, query);
	if (coordinate) {
		location = coordinate;
	} else if (query) {
		location = await geocodeQuery(maps, query);
	} else {
		throw new Error('No map query provided.');
	}

	const useMapId = Boolean(mapId) && preferCloudStyle;
	const mapOptions = {
		center: location,
		zoom,
		mapId: useMapId ? mapId : undefined,
		styles: useMapId ? undefined : DERIVED_DARK_STYLE,
		mapTypeControl: false,
		streetViewControl: false,
		fullscreenControl: true,
	};

	const map = new maps.Map(canvas, mapOptions);
	new maps.Marker({ map, position: location, title: label });

	canvas.classList.remove('hidden');
	canvas.classList.add('block');
};

const initialiseContainer = (container) => {
	if (container.hasAttribute('data-map-initialized')) {
		return;
	}
	container.setAttribute('data-map-initialized', 'true');
	const toggle = container.querySelector('[data-map-toggle]');
	if (!toggle) {
		return;
	}
	const loading = container.querySelector('[data-map-loading]');
	const preferCloudStyle = container.getAttribute('data-map-use-cloud') === 'true';
	toggle.addEventListener('click', () => {
		if (toggle.dataset.loading === 'true') {
			return;
		}
		const key = container.getAttribute('data-map-key');
		if (!key) {
			console.warn('Set PUBLIC_GOOGLE_MAPS_KEY to enable the live Google Map.');
			return;
		}
		const requestedMapId = container.getAttribute('data-map-map-id')?.trim();
		toggle.dataset.loading = 'true';
		toggle.disabled = true;
		if (loading) {
			toggleElement(loading, false);
		}
		ensureMapsSdk(key, requestedMapId, preferCloudStyle)
			.then((maps) => renderMap(container, maps, { preferCloudStyle }))
			.then(() => {
				toggle.remove();
			})
			.catch((error) => {
				console.error('Unable to render Google Map', error);
				showError(container);
				toggle.disabled = false;
			})
			.finally(() => {
				toggle.dataset.loading = 'false';
				if (loading) {
					toggleElement(loading, true);
				}
			});
	});
};

const initGroundsMap = () => {
	document.querySelectorAll('[data-map-container]').forEach(initialiseContainer);
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initGroundsMap, { once: true });
} else {
	initGroundsMap();
}

document.addEventListener('astro:page-load', initGroundsMap);
