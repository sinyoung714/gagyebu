Run the calculation tests with Node.js:

    node --test tests/fixed-groups.test.cjs tests/fixed-groups-form.test.cjs

The API source is managed in Supabase. Export the live `api` Edge Function to
`supabase/functions/api/index.ts` (ignored by git), or set `GAGYEBU_API_SOURCE`
to the exported file. Do not publish this legacy source: it contains deployment
credentials. The source changes for grouped payments are recorded in
`supabase/grouped-fixed-payments.patch`.

For the optional mobile browser test, install Playwright in your test runtime,
then run `node tests/fixed-groups-ui.cjs`. Set `CHROMIUM_PATH` if using an existing
Chromium executable. The browser test uses synthetic data and intercepts API
requests; it never writes to the live account.
