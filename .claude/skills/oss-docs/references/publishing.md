# Publishing the docs site

Zensical's build output is plain static files in `site/` (`index.html`, `404.html`, `search.json`,
`sitemap.xml`, assets). Any static host works. `zensical serve` is a preview server only.

## GitHub Pages via Actions (recommended default)

1. Repo Settings -> Pages -> Source: **GitHub Actions** (one time; the workflow cannot do this).
2. Copy `assets/pages.yml` to `.github/workflows/docs.yml`; fill in `{{DEFAULT_BRANCH}}`,
   `{{ZENSICAL_VERSION}}` (get it with `uvx zensical --version`), `{{ORG}}`, `{{REPO}}`.
3. Set `site_url` in the config to the final URL (see pitfalls).
4. Push. The workflow builds on PRs (strict, no deploy) and deploys on pushes to the default branch.

Shape of the workflow and why:

- `astral-sh/setup-uv` then `uvx zensical@<ver> build --clean --strict`. Pinning the version means a
  new Zensical release cannot break your docs without a commit; bump it deliberately. No Python
  project files are needed, so it works for TypeScript, Rust or Go repos too.
- `--strict` on PRs makes broken links fail review rather than production. `--clean` avoids stale
  cache (Zensical's own docs advise against CI caching for now).
- `permissions: contents: read, pages: write, id-token: write` are the minimum for `deploy-pages`.
- `concurrency: group: pages, cancel-in-progress: false` serialises deploys so two pushes cannot
  race, and a running deploy is never killed halfway.
- Build and deploy are separate jobs; the deploy job has the `github-pages` environment, which
  yields the live URL in the run summary.
- `upload-pages-artifact` with `path: site`, then `deploy-pages`. Action major versions in the asset
  (`checkout@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`) match the
  official Zensical docs on 2026-10-16; re-check them against https://zensical.org/docs/publish-your-site/.
- `zensical new` also generates a simpler `.github/workflows/docs.yml` (pip based, deploys on push
  to master/main). Replace it with the asset rather than keeping two workflows.

## Another build output must coexist (demo app under a sub-path)

Goal: docs at `https://org.github.io/repo/`, a demo app at `https://org.github.io/repo/demo/`.

1. Build docs to `site/` first.
2. Build the app with its base path set to `/repo/demo/` (Vite `--base=/repo/demo/`, Next
   `basePath`, CRA `homepage`, etc.). If assets are not prefixed, the app loads blank.
3. Copy the app's build output to `site/demo/` **after** the docs build (the docs build with
   `--clean` would otherwise wipe it) and before `upload-pages-artifact`.
4. Link to it from docs with the full URL; strict link checking cannot resolve non-Markdown
   targets. Do not put the app in `docs/` unless it is static and you want Zensical to copy it
   verbatim (any non-Markdown file in `docs_dir` is copied as is).
5. Single-page apps need client-side routing that works under a sub-path and a `404.html`
   fallback copy, because Pages cannot rewrite to `index.html`. Prefer hash routing for demos.
6. Add the app's source paths to the workflow `paths:` filter so app changes redeploy the site.
7. Local check: `python3 -m http.server --directory site 8080` and open `/repo/` paths through a
   path-matching proxy, or at minimum confirm that no asset URL in `site/demo/index.html` starts with
   a bare `/`.

## site_url and base path pitfalls

- **Project pages live under `/repo/`.** `site_url = "https://org.github.io/repo/"` (with the
  trailing slash). Without the sub-path, instant navigation, canonical links, sitemap and
  sometimes assets point at the wrong place.
- **User/org pages** (`org.github.io` repo) and **custom domains at the root** use
  `https://org.github.io/` or `https://docs.example.com/`.
- **Absolute links in Markdown** (`/guides/x/`) ignore the sub-path and 404 on project pages. Use
  relative links to `.md` files; Zensical rewrites them and strict mode verifies them.
- **Case sensitivity:** Pages is case-sensitive, your laptop may not be. Keep filenames lowercase.
- **Don't link to `docs/` GitHub paths** from the site for pages that exist on the site.
- Moving from project page to custom domain changes `site_url`; update it in the same commit.

## Custom domain

1. Add the domain in Settings -> Pages (this is what creates the binding for Actions deploys).
2. DNS: `CNAME docs -> org.github.io` for a subdomain, or A/AAAA records for an apex domain
   (current addresses in GitHub's docs).
3. A `CNAME` file in the repo is not required for Actions-based deploys; if you want one anyway,
   place it at `docs/CNAME` (copied verbatim to `site/CNAME`).
4. Set `site_url` to the domain, enable "Enforce HTTPS" once the certificate is issued.

## Cloudflare Pages

- Build command: `pip install zensical && zensical build --clean` (or `uvx zensical@<ver> build --clean`
  if uv is available in the build image). Output directory: `site`. Set the Python version
  environment variable if the default is older than 3.11.
- Served at the root of `*.pages.dev` or your domain, so `site_url` has no sub-path.
- Preview deployments per PR come for free; the production branch is configurable.

## Netlify

- Build command the same as above; publish directory `site`. Pin Python with `runtime.txt` or the
  `PYTHON_VERSION` environment variable (needs 3.11+).
- Optional `netlify.toml`:

```toml
[build]
  command = "pip install zensical && zensical build --clean"
  publish = "site"
```

- Deploy previews per PR are built in; set `site_url` to the production URL anyway.

## GitLab Pages (from the Zensical docs)

A `pages` job running `pip install zensical && zensical build --clean` and publishing `site`
(GitLab defaults to `public`, so set `pages: publish: site`).

## After the first deploy

Open the live URL in a private window: check CSS loaded, dark mode toggle, search finds a term, a
deep link works on reload, the edit button opens the right file, `/sitemap.xml` and `/404.html` load.
