# cdn.blueat.net Worker (AT Protocol Image CDN)

Cloudflare Worker that acts as a drop-in style replacement for Bluesky image CDN endpoints by proxying image blobs directly from a user's Personal Data Server (PDS). It resolves the PDS endpoint from the DID (supports `did:web:` and `did:plc:`) and then fetches the requested blob.

## Quick deploy (to your own Cloudflare account)

1. Install Node.js (LTS).
2. From this folder, run:
   - `npm install`
   - `npm run deploy`
3. If prompted, run `wrangler login` (Wrangler stores your auth token locally).

The included `wrangler.toml` deploys with `workers_dev = true` (so it will be reachable under your Worker subdomain). To serve the real domain (`cdn.blueat.net`), update `wrangler.toml` with your `route` and `zone_id`.

## Configuration

In `wrangler.toml`, you can change:

- `PLC_DIRECTORY`: base URL used to resolve `did:plc:` to a PLC document.
- `CACHE_MAX_AGE_SECONDS`: value used for the `Cache-Control: s-maxage=...` header.

## Local development

- `npm run dev`

## Request format

This worker expects paths like:

`/img/{type}/plain/{did}/{cid}`

Where `{type}` is typically `avatar` or `banner`. Example:

`/img/avatar/plain/did:plc:exampleCid/ExampleImageCid`

## Notes

- Results are cached via `caches.default` and also include `Cache-Control` for downstream caching.
- If the requested `avatar`/`banner` CID is missing, the worker tries to find the current CID from the profile record and retries once.

