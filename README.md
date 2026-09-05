# Arcturus Industries

Static transition page directing visitors to https://arcturus.vision/.
GitHub Pages serves this repository directly; there is no build step.

## Preview

Run `python3 -m http.server 8000` from the repository and open
http://localhost:8000/. Do not preview through file:// because asset paths
are rooted at the site origin.

## Files

- `index.html`: page copy, links, metadata, and accessible logo fallback.
- `assets/site.css`: responsive layout.
- `assets/site.js`: particle projection, logo transformation, and Web Audio synthesis.
- `assets/logo-points.js`: paired positions and colors sampled from the supplied logo artwork.
- `assets/logo-light.png` and `assets/logo-dark.png`: supplied Vision logo assets.
- `CNAME`: existing arcturus.industries domain configuration.

The first animation is silent. Clicking the logo unlocks procedural sound,
swirls back to Industries in 0.8 seconds, pauses, and transforms to Vision.
The sound button toggles audio, and explicit mute persists across logo clicks
until re-enabled in the same page session. No audio files or external scripts
are downloaded. Sound fades and the audio context sleeps after completion.
Reduced-motion visitors get a static logo; clicking toggles the endpoint.
With JavaScript unavailable, the Vision image and navigation still work.

Legacy HTML URLs contain only redirects to the landing page; their old content,
feeds, and theme assets have been removed. Unknown paths use `404.html`.
The old Blog and Careers links in the arcturus.vision footer still reach the
landing page through these redirects; that separate site's links can be
updated independently.
