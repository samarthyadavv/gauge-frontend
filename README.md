# Gauge AI frontend

React and TypeScript workspace for [Gauge AI](https://github.com/samarthyadavv/gauge-ai). Search runs, author evaluation cases, inspect outputs, and compare runs using the same dataset snapshot.

## Local development

Requires Node.js 22 or newer. Run the backend and worker using the [Gauge AI quick start](https://github.com/samarthyadavv/gauge-ai#quick-start--no-docker-or-paid-ai-api-needed). Vite forwards `/api` to `http://127.0.0.1:9200`.

```sh
npm ci
npm run dev
npm run build
```

Set the backend `BASE_URL` to the exact Vite origin you open in your browser while developing against Vite. Use the backend's operator key to sign in.

## Deploy to Netlify

Import this repository in Netlify. `netlify.toml` sets the build command and publish directory. The frontend can be deployed by itself and displays a connection message until the API is available.

To enable sign-in and evaluations, deploy the Gauge FastAPI web service and worker with their database. Set `GAUGE_API_ORIGIN` in Netlify's build environment to the HTTPS origin of that web service, such as `https://api.example.com`, and redeploy. The build generates a same-origin `/api` proxy so the browser can use Gauge's session cookie and CSRF token. Set the backend's `BASE_URL` to the exact HTTPS origin of the Netlify frontend and keep `ADMIN_KEY` and provider keys in the backend environment.

The browser test in `tests/evaluation.spec.ts` expects a test-only Gauge server on port 9201 serving this build, with its test operator key supplied through `E2E_ADMIN_KEY`.
