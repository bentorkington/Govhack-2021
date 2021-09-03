/// <reference lib="webworker" />
console.log('Service Worker Loading');

import { build, files, timestamp } from '$service-worker';
// import firebase from "firebase/app";
import firebase from 'firebase/app';
import 'firebase/messaging';
import { firebaseConfig } from './lib/firebase/env';

import { getItem, setItem } from 'localforage';

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/8.9.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.9.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

let allowNotifications = false;
getItem('notify', function (err, value: string) {
	if (err === null) {
		console.log('Retried Stored notifications setting: ', value);
		allowNotifications = JSON.parse(value);
	} else {
		setItem('notify', 'false', function (err) {
			console.log("Can't set localforge", err);
		});
	}
});

messaging.onBackgroundMessage((payload) => {
	console.log('[firebase-messaging-sw.js] Received background message ', payload);
});

self.addEventListener('notificationclick', function (event) {
	//For root applications: just change "'./'" to "'/'"
	//Very important having the last forward slash on "new URL('./', location)..."
	const rootUrl = new URL('/').href;
	event.notification.close();
	event.waitUntil(
		clients.matchAll().then((matchedClients) => {
			for (let client of matchedClients) {
				if (client.url.indexOf(rootUrl) >= 0) {
					return client.focus();
				}
			}

			return clients.openWindow(rootUrl).then(function (client) {
				client.focus();
			});
		})
	);
});

// const analytics = firebase.analytics();
// analytics.logEvent('Startup');

const worker = (self as unknown) as ServiceWorkerGlobalScope;
const FILES = `cache${timestamp}`;

// `build` is an array of all the files generated by the bundler,
// `files` is an array of everything in the `static` directory
const to_cache = build.concat(files);
const staticAssets = new Set(to_cache);

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(FILES)
			.then((cache) => cache.addAll(to_cache))
			.then(() => {
				worker.skipWaiting();
			})
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			// delete old caches
			for (const key of keys) {
				if (key !== FILES) await caches.delete(key);
			}

			worker.clients.claim();
			console.log('Service worker Ready');
		})
	);
});

/**
 * Fetch the asset from the network and store it in the cache.
 * Fall back to the cache if the user is offline.
 */
async function fetchAndCache(request: Request) {
	const cache = await caches.open(`offline${timestamp}`);

	try {
		const response = await fetch(request);
		cache.put(request, response.clone());
		return response;
	} catch (err) {
		const response = await cache.match(request);
		if (response) return response;

		throw err;
	}
}

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET' || event.request.headers.has('range')) return;

	const url = new URL(event.request.url);

	// don't try to handle e.g. data: URIs
	const isHttp = url.protocol.startsWith('http');
	const isDevServerRequest = url.hostname === self.location.hostname && url.port !== self.location.port;
	const isStaticAsset = url.host === self.location.host && staticAssets.has(url.pathname);
	const skipBecauseUncached = event.request.cache === 'only-if-cached' && !isStaticAsset;

	if (isHttp && !isDevServerRequest && !skipBecauseUncached) {
		event.respondWith(
			(async () => {
				// always serve static files and bundler-generated assets from cache.
				// if your application has other URLs with data that will never change,
				// set this variable to true for them and they will only be fetched once.
				const cachedAsset = isStaticAsset && (await caches.match(event.request));

				return cachedAsset || fetchAndCache(event.request);
			})()
		);
	}
});

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'NOTIFICATION_SETTINGS') {
		console.log('received event of correct type', event.data.value);
		allowNotifications = JSON.parse(event.data.value);
		setItem('notify', event.data.value, function (err) {
			console.log("Can't set localforge", err);
		});
	}
});
