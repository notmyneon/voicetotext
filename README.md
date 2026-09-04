# Voice Notes — GitHub Pages + high-accuracy transcription

This version separates the app into two parts:

1. **GitHub Pages (`docs/index.html`)** — the note-taking interface. Notes are stored in the browser with `localStorage`.
2. **Cloudflare Worker (`cloudflare-worker/worker.js`)** — a small secure backend that keeps the OpenAI API key off the public website and sends recorded audio to `gpt-transcribe`.

## What the app does

- Press the microphone to dictate.
- The browser may show a quick live draft while you are speaking.
- Audio is split on natural pauses (or roughly every 18 seconds if you speak continuously).
- Each segment is transcribed by `gpt-transcribe` and appended to the note in the correct order.
- Custom vocabulary can be added in **Transcription settings** to help with names, acronyms, school terms, place names, etc.
- Notes themselves stay in the browser unless you copy or download them.

## Part 1 — Deploy the Cloudflare Worker

### Easiest dashboard method

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a new Worker named something like `voice-notes-transcriber`.
3. Replace the starter code with the contents of `cloudflare-worker/worker.js` and deploy it.
4. Open the Worker **Settings** → **Variables and Secrets**.
5. Add a **Secret** named:

   `OPENAI_API_KEY`

   Paste your OpenAI API key as the value.
6. Add a normal text variable named:

   `ALLOWED_ORIGINS`

   Set it to your GitHub Pages origin, for example:

   `https://YOUR-GITHUB-USERNAME.github.io`

   Do **not** include the repository path here. CORS checks the site origin only.
7. Deploy the settings change.
8. Copy your Worker URL. It should look similar to:

   `https://voice-notes-transcriber.YOUR-SUBDOMAIN.workers.dev`

### Wrangler method

If you already use Node/Wrangler:

```bash
cd cloudflare-worker
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Before deploying, update `ALLOWED_ORIGINS` in `wrangler.jsonc` to your actual GitHub Pages origin.

## Part 2 — Put the site on GitHub Pages

1. Create a GitHub repository, for example `voice-notes`.
2. Upload this project to the repository.
3. In the repository open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose the `main` branch and the `/docs` folder.
6. Save.
7. GitHub will provide a site address similar to:

   `https://YOUR-GITHUB-USERNAME.github.io/voice-notes/`

## Part 3 — Connect the website to the Worker

1. Open the GitHub Pages site.
2. Click **Transcription settings**.
3. Paste the Worker URL.
4. Add any helpful vocabulary you want.
5. Click **Test backend connection**.
6. When it reports **Connected**, click **Save settings**.
7. Press the microphone and dictate.

## Important configuration details

- The OpenAI API key belongs only in the Cloudflare Worker secret. Never paste it into `index.html`, GitHub, or the site's settings box.
- GitHub Pages is served over HTTPS, which is appropriate for browser microphone access.
- `ALLOWED_ORIGINS` limits normal browser access to your GitHub Pages origin. If you later use a custom domain, add it as another comma-separated origin.
- Example with two allowed origins:

  `https://YOUR-GITHUB-USERNAME.github.io,https://notes.example.com`

## Transcription model

The Worker currently uses `gpt-transcribe` with English language guidance and optional context terms supplied from the website settings.

## Storage/privacy behavior

- Note titles and text are saved to the browser's local storage on that device/browser.
- Recorded audio segments are sent to the Worker and then to the transcription API for speech-to-text.
- The Worker does not save audio or notes to a database.
