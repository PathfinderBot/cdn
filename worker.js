const PLC_DIRECTORY = "https://plc.directory";

const PATH_RE = /^\/img\/([^/]+)\/plain\/(did:[^/]+)\/([^@/]+)(?:@([^/]+))?$/;

export default {
  async fetch(request, env, ctx) {
    const plcDirectory = env?.PLC_DIRECTORY ?? PLC_DIRECTORY;
    const cacheMaxAgeSeconds =
      env?.CACHE_MAX_AGE_SECONDS ?? 604800;
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(LANDING_HTML, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    const match = url.pathname.match(PATH_RE);
    if (!match) return new Response("400: Invalid Path", { status: 400 });
    const [_, type, did, cid] = match;

    const cache = caches.default;

    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const pdsUrl = await resolvePds(did, plcDirectory);
    if (!pdsUrl) {
      return new Response("404: PDS not found for this DID", { status: 404 });
    }

    try {
      let blobRes = await fetchBlob(pdsUrl, did, cid);

      if (blobRes.status === 404 && (type === "avatar" || type === "banner")) {
        const originalCid = await findOriginalCidFromProfile(pdsUrl, did, type);
        if (originalCid && originalCid !== cid) {
          blobRes = await fetchBlob(pdsUrl, did, originalCid);
        }
      }

      if (!blobRes.ok) {
        return new Response("404: Asset not found on PDS.", { status: 404 });
      }

      const finalRes = new Response(blobRes.body, blobRes);
      finalRes.headers.set(
        "Cache-Control",
        `public, s-maxage=${cacheMaxAgeSeconds}`
      );
      finalRes.headers.set("X-Proxy-Source", "PDS-Direct");
      finalRes.headers.set("Content-Disposition", "inline");
      ctx.waitUntil(cache.put(request, finalRes.clone()));
      return finalRes;

    } catch (err) {
      return new Response(`502: PDS Error: ${err.message}`, { status: 502 });
    }
  },
};

async function fetchBlob(pdsUrl, did, cid) {
  return fetch(
    `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
  );
}

async function resolvePds(did, plcDirectory) {
  const doc = did.startsWith("did:web:")
    ? await resolveDidWeb(did)
    : await resolveDidPlc(did, plcDirectory);
  if (!doc) return null;
  const pds = doc.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer"
  );
  return pds?.serviceEndpoint ?? null;
}

async function resolveDidPlc(did, plcDirectory) {
  const res = await fetch(`${plcDirectory}/${did}`);
  if (!res.ok) return null;
  return res.json();
}

async function resolveDidWeb(did) {
  const identifier = did.slice("did:web:".length);
  const parts = identifier.split(":");
  const host = decodeURIComponent(parts[0]);
  const didUrl = parts.length === 1
    ? `https://${host}/.well-known/did.json`
    : `https://${host}/${parts.slice(1).map(decodeURIComponent).join("/")}/did.json`;
  const res = await fetch(didUrl);
  if (!res.ok) return null;
  return res.json();
}

async function findOriginalCidFromProfile(pdsUrl, did, type) {
  const res = await fetch(
    `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.value?.[type]?.ref?.$link ?? null;
}

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>cdn.blueat.net — AT Protocol Image CDN</title>
  <meta name="description" content="A drop-in replacement for cdn.bsky.app, powered by Cloudflare Workers. Images are served directly from each user's Personal Data Server (PDS) via DID resolution — no Bluesky relay required." />
  <meta name="keywords" content="Bluesky, AT Protocol, CDN, cdn.bsky.app alternative, PDS, image proxy, Cloudflare Workers, witchsky, atproto" />
  <link rel="canonical" href="https://about.blueat.net/blueat-cdn" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://about.blueat.net/blueat-cdn" />
  <meta property="og:title" content="cdn.blueat.net — AT Protocol Image CDN" />
  <meta property="og:description" content="A drop-in replacement for cdn.bsky.app that serves images directly from users' PDSes via DID resolution, powered by Cloudflare Workers." />
  <meta property="og:site_name" content="BlueAT.net" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="cdn.blueat.net — AT Protocol Image CDN" />
  <meta name="twitter:description" content="A drop-in replacement for cdn.bsky.app, served directly from each user's PDS via Cloudflare Workers." />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "cdn.blueat.net",
    "url": "https://about.blueat.net/blueat-cdn",
    "description": "A drop-in replacement for cdn.bsky.app. Serves AT Protocol images directly from users' Personal Data Servers via DID resolution, powered by Cloudflare Workers.",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any"
  }
  <\/script>

  <!-- Instant redirect — canonical page lives at BlueAT.net -->
  <meta http-equiv="refresh" content="0; url=https://about.blueat.net/blueat-cdn" />
</head>
<body>
  <p>Redirecting to <a href="https://about.blueat.net/blueat-cdn">about.blueat.net/blueat-cdn</a>…</p>
</body>
</html>`;
