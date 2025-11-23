import { applicationDefault, cert, getApps, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId =
	process.env.FIREBASE_PROJECT_ID ??
	process.env.GCLOUD_PROJECT ??
	process.env.GOOGLE_CLOUD_PROJECT ??
	'howling-vs-build';

const options: AppOptions = { projectId };

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
	const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
	options.credential = cert(credentials);
} else {
	try {
		options.credential = applicationDefault();
	} catch (error) {
		// Hosting functions inject default credentials; local emulators may rely on env vars.
	}
}

const app = getApps().length > 0 ? getApps()[0] : initializeApp(options);

export const firestore = getFirestore(app);
