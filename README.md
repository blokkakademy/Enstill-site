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

## Editing
`index.html` is a compiled, inlined build. For ongoing content edits, change the source design and re-export a fresh `index.html`, then commit it. Brand: Lora (headings) + Carlito/Calibri (body); gold `#BC9656` (accent only), ink `#252523`, warm stone `#F7F5F2`.
