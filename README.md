# enStill — enstill.life

Static marketing site for enStill. One self-contained page, no build step, no framework.

## Contents
- `index.html` — the entire site (all six sections: Home, Start Here, Private Work, Organizations, Athlete Support, About/FAQ). All styles, scripts, fonts, and logos are inlined; it works offline and needs nothing else to run.
- `netlify.toml` — tells Netlify to publish the repo root with no build command.
- `assets/` — logo source files (optimized, transparent PNG) kept for reference. The site does not load them at runtime; they are already embedded in `index.html`.

## Deploy (Netlify)
1. Push this repo to GitHub.
2. Netlify → **Add new site → Import from Git** → pick this repo.
3. Build command: **none**. Publish directory: **`.`** (root). `netlify.toml` already sets this.
4. Deploy.

## Custom domain (enstill.life)
Handled separately from the code: in Netlify → **Domain settings → Add custom domain → enstill.life**, then update the domain's nameservers (or A / CNAME records) at the registrar (GoDaddy) to point at Netlify. DNS propagation can take up to a few hours.

## SEO & social metadata
`index.html` carries **static** head tags (title, description, canonical, Open Graph, Twitter card) so crawlers and link-preview bots see real values without running JS. The share image is `assets/og-image.png` (1200×630). Absolute URLs point at `https://enstill.life` — if the final domain changes, update `og:url`, `canonical`, and both image URLs. A rebuilt `index.html` must keep these static tags (the runtime also sets per-page titles on navigation).

## Intronaut Series registration toggle
The Start Here signup has two states, driven by the `registrationOpen` flag in the source design (Tweaks panel → Intronaut Series):

- **`registrationOpen: false`** (default, "collecting interest") — form intro: "Share your name and email to receive details about the next available series." Confirmation says details will follow when registration information is ready.
- **`registrationOpen: true`** ("cohort open") — intro and confirmation switch to registration language. Also set **`seriesDates`** (free text, e.g. `Begins Sept 9 · Tuesdays, 6–7pm ET`) and it is woven into both messages automatically. Leave `seriesDates` empty and the copy still reads correctly without dates.

To open or close a cohort: flip `registrationOpen` (and set/clear `seriesDates`) in the source design, re-export `index.html`, commit. No copy edits needed — both states are already written.

## Editing
`index.html` is a compiled, inlined build. For ongoing content edits, change the source design and re-export a fresh `index.html`, then commit it. Brand: Lora (headings) + Carlito/Calibri (body); gold `#BC9656` (accent only), ink `#252523`, warm stone `#F7F5F2`.

## Forms (Netlify Forms)
The four lead-capture forms post to Netlify Forms — no backend, no keys. Form names: `intronaut-series`, `private-work`, `organizations`, `athlete-support`. Because the page is JS-rendered, `index.html` also contains four **static hidden detection forms** at the top of `<body>` (that is how Netlify discovers them at deploy — do not remove them; a rebuilt `index.html` must keep them). Each live form submits with a `form-name` field + a `bot-field` honeypot.

After the first successful deploy:
- **Netlify dashboard → Forms** shows submissions per form.
- Set up email notifications there (Forms → Settings → Form notifications) — e.g. subject-line labels like `[enStill] Private Work inquiry`. This is configured in Netlify, not in the HTML.
- Send a live test submission on each form and confirm it appears in the dashboard before launch.

