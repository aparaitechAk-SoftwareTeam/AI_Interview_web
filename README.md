# Aparaitech Interview Software

One secure monorepo for the Aparaitech candidate interview app and the administrator workflow.

```
mobile/    Expo React Native app (candidate + admin entry)
backend/   Express + MongoDB API
shared/    Interview states and shared status constants
docs/      API guide and device acceptance matrix
postman/   Import-ready REST collection
```

## What is implemented

- Same mobile app for candidate access and administrator sign-in.
- Secure, rate-limited invitation codes; expiry, revocation, reset/reattempt and optional single-use behavior.
- Server-side candidate object authorization. A candidate token cannot access another candidate, resume, interview, event or recording.
- PDF/DOC/DOCX upload with extension, MIME, magic-byte and size checks; private local storage; text extraction and structured resume data.
- Real Gemini adapter architecture. Every question, answer evaluation and final assessment is JSON-schema validated before it is persisted. There is no fabricated AI answer when the provider is unavailable.
- Adaptive question generation from resume evidence, prior Q&A, time/max-question budget and difficulty state; exact duplicate prevention and unique question sequence.
- TTS-to-listening state machine, native speech recognition with text fallback, persisted answer recovery and idempotency keys.
- Camera video/audio recording where Expo Camera is available; private chunk uploads; retryable pending upload metadata; admin-only playback and deletion.
- Candidate app-background / Back-interruption evidence, separately calculated integrity review signal, and no automatic anti-cheat rejection.
- Admin dashboard, candidates, invitation creation/reset, settings, live/current statuses, Q&A evidence, AI evidence summary, recording, termination and audited final decisions.

## Prerequisites

- Node.js 22 or later and npm 10 or later.
- A MongoDB Atlas cluster (or MongoDB 7+ locally).
- A Gemini API key and a valid model access entitlement.
- Android Studio/device for native camera, speech and recording validation.
- An Expo account only if using EAS cloud builds.

## Install

```bash
cd "/Users/vivek/Desktop/Aparaitech Interview Software"
npm install
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

Set these values in `backend/.env`; do not put them in `mobile/.env` or source code.

```dotenv
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/ai_mock_interviews?retryWrites=true&w=majority
MONGODB_DB=ai_mock_interviews
JWT_SECRET=use-a-new-random-64-character-value
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key
ADMIN_USERNAME=administrator
ADMIN_PASSWORD=a-local-development-password-of-at-least-12-characters
SEED_DEMO=true
```

Set the physical-device reachable backend address in `mobile/.env`—use your computer's LAN IP, not `localhost`.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:4000
```

## MongoDB setup

1. In Atlas, create a database user with read/write access only to `ai_mock_interviews`.
2. Add your development IP to Network Access. For production, allow only backend egress addresses.
3. Use a URI whose path includes `/ai_mock_interviews`; the database is created on seed/start.
4. Keep the URI only in `backend/.env`, a secret manager or deployment environment variables.

The credentials provided in the original request are deliberately not written into this repository. Because they were shared in plain text, rotate both the MongoDB password and Gemini API key before production.

## Run

Terminal 1:

```bash
cd "/Users/vivek/Desktop/Aparaitech Interview Software"
npm run seed
npm run dev:backend
```

Terminal 2, quick UI iteration only:

```bash
cd "/Users/vivek/Desktop/Aparaitech Interview Software"
npm run dev:mobile
```

The API health check is `GET http://YOUR_LAN_IP:4000/health`.

## Deploy the API on Render

This repository is an npm workspace: the API depends on the local `shared/` workspace. On Render, deploy from the **repository root** (leave **Root Directory** empty). Do not set it to `backend`, because that excludes `shared/` and can result in missing-package errors.

The included [`render.yaml`](render.yaml) uses these commands:

```bash
Build Command: npm run render-build
Start Command: npm start
Health Check Path: /health
```

Create a Render Blueprint from the repository, or set the same values in an existing Web Service's Settings. In Render's Environment page set `MONGODB_URI`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CORS_ORIGINS`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`. Render generates `JWT_SECRET` from the Blueprint; keep it secret and do not add it to this repository. `PORT` is supplied by Render automatically.

## Build an Android APK without Android Studio

The `preview` EAS profile creates an installable APK on Expo's cloud builders, so it does not require Android Studio, an Android SDK, or a global Expo installation on your computer. It is configured to use the deployed Render API.

```powershell
cd mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile preview
```

On the first build, let EAS create/link the Expo project and generate the Android keystore. After the cloud build finishes, open the provided link on the Android phone and install the APK. For Google Play Store upload, build an AAB instead:

```powershell
npx eas-cli@latest build --platform android --profile production
```

## Development Build — required for real speech recognition

`expo-speech-recognition` includes native code, so Expo Go is not sufficient for a real spoken interview. Camera preview/video recording works with Expo modules, but use a Development Build for the integrated product test.

```bash
cd "/Users/vivek/Desktop/Aparaitech Interview Software/mobile"
npx eas build --platform android --profile development
npx expo start --dev-client
```

Local Android alternative (Android Studio configured):

```bash
cd "/Users/vivek/Desktop/Aparaitech Interview Software/mobile"
npx expo run:android
npx expo start --dev-client
```

## Gemini AI provider

`AI_PROVIDER=gemini` is the supported production adapter. It uses `AI_MODEL` (default: `gemini-3.5-flash-lite`) and automatically tries the configured `AI_FALLBACK_MODELS` when the current Gemini model is rate-limited or unavailable. It applies:

- 20-second timeout and capped retries;
- structured JSON validation with Zod;
- resume-grounded prompts that tell the model not to invent candidate details;
- stored Q&A evidence and final-assessment evidence mapping.

If Gemini is unavailable or returns invalid JSON, the API returns a safe error and preserves the previous answer/progress for retry. It never silently creates a synthetic score.

## Storage

`STORAGE_PROVIDER=local` is included for development. It stores private files under `backend/uploads/`, which is git-ignored and never served as a public static directory. Resume download is candidate-scoped; recording streaming/deletion is administrator-scoped.

For production, replace the `LocalStorageProvider` behind `backend/src/services/storage/local-storage.js` with a private-bucket provider. Maintain the same `putBuffer`, `readBuffer`, `concatenate` and `delete` contract; use short-lived signed reads or the authenticated API proxy, never public object URLs.

### Recording retention on Render

The free Render filesystem is temporary. It can serve a recording only until the service restarts or redeploys, so it cannot guarantee that a recruiter can play a completed recording later. For protected recording retention, use a paid Render service with a persistent disk mounted at `/var/data/uploads`, then set this Render environment variable:

```dotenv
UPLOAD_DIR=/var/data/uploads
```

Persistent disks are attached in the Render service's **Disks** tab and keep only files below their mount path. A private object store is the better choice if you later run more than one API instance. The mobile app now retries recording chunks, persists the finished file locally while it uploads, and shows the upload state in the admin candidate profile.

## Seed and development credentials

`npm run seed` creates/updates the administrator from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. When `SEED_DEMO=true`, it also creates one development-only Rahul Patil invitation and prints its code once in the seed terminal. These values are not hardcoded in source.

## Tests and audit

```bash
cd "/Users/vivek/Desktop/Aparaitech Interview Software"
npm test
npm run lint
cd mobile && npx expo-doctor
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:4000 npx expo export --platform android --output-dir /tmp/aparaitech-android-export
npm audit --omit=dev
```

The acceptance scenarios are in [docs/test-matrix.md](docs/test-matrix.md), and the API guide is in [docs/api.md](docs/api.md). Import [postman/Aparaitech-Interview-API.postman_collection.json](postman/Aparaitech-Interview-API.postman_collection.json) to exercise REST APIs.

## Known platform limitations

- This build records authorized camera video/audio; it does **not** claim to screen-record the whole operating system. Android/iOS full-screen capture needs platform-native capture modules plus OS consent and policy review.
- App background and Android Back events are logged. Face landmarks, gaze direction, head-pose and multiple-face detection are not fabricated: they require a separately integrated on-device vision module and a device privacy review. They are documented as unavailable in system check.
- Native speech availability differs by device language pack, MDM and OS settings. The app presents a manual text-answer recovery path.
- Device-level camera/mic/background/recording verification cannot be performed in this repository without a connected Development Build and your permitted test device.

## Production checklist

- [ ] Rotate any credentials ever pasted into chats, terminals or screenshots.
- [ ] Use production secrets manager and a unique `JWT_SECRET` of 64+ random characters.
- [ ] Enable Atlas IP restrictions, backups, encryption and least-privilege DB accounts.
- [ ] Configure HTTPS API URL, restrictive `CORS_ORIGINS`, monitoring and alerting.
- [ ] Replace local storage with private object storage and lifecycle retention policy.
- [ ] Set the legal consent version and retention period; validate consent copy with counsel.
- [ ] Test every matrix scenario on Android Development Build and document device/OS results.
- [ ] Review Gemini model/data-retention terms, token budget, rate limits and costs.
- [ ] Review `npm audit` output on every release; update Expo/RN when a patched SDK is available.
- [ ] Build release candidates with EAS, then complete real admin/candidate end-to-end verification against a non-production database.
# ai-interview-Application
# Ai-interview-Application
# AI_Interview_web
