#!/usr/bin/env python3
"""Audit a Markdown docs directory before (or after) building a docs site.

Usage:
    python3 -I scripts/audit_docs.py <docs_dir> [--config zensical.toml|mkdocs.yml]

Dependency-free (stdlib only). Prints a Markdown report to stdout and exits 1
if any BLOCKER is found, 0 otherwise.

Blockers: zero or multiple H1s, broken relative links, broken anchors,
missing images, nav entries that point to files that do not exist.
Warnings: pages missing from nav, code fences without a language, pages with no
opening paragraph, absolute (/...) links, very short pages.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote

FENCE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})(.*)$")
HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$")
ATTR_ID_RE = re.compile(r"\{[^}]*#([\w:.-]+)[^}]*\}\s*$")
INLINE_CODE_RE = re.compile(r"(`+)(.+?)\1")
LINK_RE = re.compile(r"(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
REFDEF_RE = re.compile(r"^\s{0,3}\[(?!\^)[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$")
HTML_ID_RE = re.compile(r"""\b(?:id|name)\s*=\s*["']([^"']+)["']""")
EXTERNAL_RE = re.compile(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//)")


def slugify(text: str) -> str:
    """Approximate Python-Markdown's toc slugify."""
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[`*]", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


class Page:
    def __init__(self, path: Path, rel: str):
        self.path = path
        self.rel = rel
        self.fm_title: str | None = None
        self.h1: list[str] = []
        self.anchors: set[str] = set()
        self.words = 0
        self.links: list[tuple[int, str, str, bool]] = []  # line, text, url, is_image
        self.bare_fences: list[int] = []
        self.has_intro = False
        self.placeholders: list[int] = []
        self.snippet = False  # page includes external content via --8<--


def parse_page(path: Path, rel: str) -> Page:
    page = Page(path, rel)
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() in ("---", "..."):
                for fm in lines[1:j]:
                    m = re.match(r"title:\s*(.+)", fm)
                    if m:
                        page.fm_title = m.group(1).strip("\"' ")
                i = j + 1
                break
    fence: tuple[str, int] | None = None
    seen: dict[str, int] = {}
    after_h1 = False
    intro_done = False
    in_comment = False
    for n in range(i, len(lines)):
        line = lines[n]
        lineno = n + 1
        if "{{" in line:
            page.placeholders.append(lineno)
        fm = FENCE_RE.match(line)
        if fence:
            if fm and fm.group(1)[0] == fence[0][0] and len(fm.group(1)) >= len(fence[0]) and not fm.group(2).strip():
                fence = None
            continue
        if fm:
            fence = (fm.group(1), lineno)
            if not fm.group(2).strip():
                page.bare_fences.append(lineno)
            if after_h1 and not intro_done:
                intro_done = True  # code block straight after H1 is not an intro
            continue
        if line.lstrip().startswith("--8<--"):
            page.snippet = True
        if in_comment:
            if "-->" in line:
                in_comment = False
            continue
        if line.lstrip().startswith("<!--"):
            in_comment = "-->" not in line
            continue
        if line.startswith("    ") or line.startswith("\t"):
            continue  # indented code or nested content; skip link scanning
        hm = HEADING_RE.match(line)
        if hm:
            level, text = len(hm.group(1)), hm.group(2)
            am = ATTR_ID_RE.search(text)
            if am:
                anchor = am.group(1)
                text = ATTR_ID_RE.sub("", text).strip()
            else:
                anchor = slugify(text)
            if anchor in seen:
                seen[anchor] += 1
                anchor = f"{anchor}_{seen[anchor] - 1}"
            else:
                seen[anchor] = 1
            page.anchors.add(anchor)
            if level == 1:
                page.h1.append(text)
                after_h1 = True
            elif after_h1 and not intro_done:
                intro_done = True
            continue
        stripped = line.strip()
        for hid in HTML_ID_RE.findall(line):
            page.anchors.add(hid)
        if stripped:
            page.words += len(stripped.split())
            if after_h1 and not intro_done:
                if re.match(r"^(\||!!!|\?\?\?|===|<|[-*+]\s|\d+\.\s|>)", stripped):
                    intro_done = True
                else:
                    page.has_intro = True
                    intro_done = True
        scan = INLINE_CODE_RE.sub("", line)
        for m in LINK_RE.finditer(scan):
            page.links.append((lineno, m.group(2), m.group(3), m.group(1) == "!"))
        rm = REFDEF_RE.match(scan)
        if rm:
            page.links.append((lineno, "ref", rm.group(1), False))
    return page


def collect_nav_strings(obj, out: list[str]) -> None:
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, list):
        for item in obj:
            collect_nav_strings(item, out)
    elif isinstance(obj, dict):
        for v in obj.values():
            collect_nav_strings(v, out)


def read_nav(config: Path) -> tuple[list[str] | None, str]:
    text = config.read_text(encoding="utf-8")
    if config.suffix == ".toml":
        try:
            import tomllib
        except ImportError:
            return None, "tomllib unavailable (needs Python 3.11+); nav check skipped"
        data = tomllib.loads(text)
        nav = data.get("project", {}).get("nav", data.get("nav"))
        if nav is None:
            return None, "no nav in config (all pages are included automatically)"
        out: list[str] = []
        collect_nav_strings(nav, out)
        return out, ""
    # mkdocs.yml: minimal extraction of `.md` paths inside the top-level nav block
    block: list[str] = []
    in_nav = False
    for line in text.splitlines():
        if re.match(r"^nav\s*:", line):
            in_nav = True
            continue
        if in_nav:
            if line and not line[0].isspace() and not line.startswith("-"):
                break
            block.append(line)
    if not in_nav:
        return None, "no nav in config (all pages are included automatically)"
    out = []
    for line in block:
        line = line.split(" #")[0]
        for m in re.finditer(r"([\w./\-]+\.md)\b", line):
            out.append(m.group(1))
    return out, ""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("docs_dir")
    ap.add_argument("--config", help="zensical.toml or mkdocs.yml (enables nav checks)")
    args = ap.parse_args()

    root = Path(args.docs_dir).resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2

    pages: dict[str, Page] = {}
    for p in sorted(root.rglob("*.md")):
        rel = p.relative_to(root).as_posix()
        if any(part.startswith(".") for part in p.relative_to(root).parts):
            continue
        pages[rel] = parse_page(p, rel)

    blockers: list[str] = []
    warnings: list[str] = []

    for rel, pg in pages.items():
        if len(pg.h1) == 0 and pg.snippet:
            warnings.append(f"`{rel}`: H1 and content come from a `--8<--` snippet (not checked)")
            continue
        if len(pg.h1) == 0 and not pg.fm_title:
            blockers.append(f"`{rel}`: no H1 (and no front-matter title)")
        elif len(pg.h1) == 0:
            warnings.append(f"`{rel}`: no H1, relying on front-matter title")
        elif len(pg.h1) > 1:
            blockers.append(f"`{rel}`: {len(pg.h1)} H1 headings ({'; '.join(pg.h1)})")
        if pg.placeholders:
            warnings.append(f"`{rel}`: unreplaced `{{{{` placeholder(s) at line(s) {', '.join(map(str, pg.placeholders[:5]))}")
        for ln in pg.bare_fences:
            warnings.append(f"`{rel}:{ln}`: code fence without a language")
        if pg.h1 and not pg.has_intro:
            warnings.append(f"`{rel}`: no opening paragraph after the H1")
        if pg.words < 30 and not rel.endswith("index.md"):
            warnings.append(f"`{rel}`: only {pg.words} words (stub?)")

        for ln, text, url, is_img in pg.links:
            if EXTERNAL_RE.match(url):
                continue
            if url.startswith("/"):
                warnings.append(f"`{rel}:{ln}`: absolute link `{url}` breaks under a sub-path; use a relative link")
                continue
            target, _, frag = url.partition("#")
            target = unquote(target)
            if not target:
                if frag and frag not in pg.anchors:
                    blockers.append(f"`{rel}:{ln}`: anchor `#{frag}` not found in this page")
                continue
            dest = (pg.path.parent / target).resolve()
            if not dest.exists():
                kind = "image" if is_img else "link"
                blockers.append(f"`{rel}:{ln}`: broken {kind} `{url}`")
                continue
            if dest.is_dir():
                idx = dest / "index.md"
                if idx.exists():
                    dest = idx
                else:
                    continue
            if dest.suffix == ".md" and frag:
                try:
                    drel = dest.relative_to(root).as_posix()
                except ValueError:
                    continue
                tgt = pages.get(drel)
                if tgt and frag not in tgt.anchors:
                    blockers.append(f"`{rel}:{ln}`: anchor `#{frag}` not found in `{drel}`")

    nav_note = "no config given; nav checks skipped"
    if args.config:
        cfg = Path(args.config)
        if not cfg.is_file():
            blockers.append(f"config `{cfg}` not found")
        else:
            nav, note = read_nav(cfg)
            nav_note = note or f"nav read from `{cfg.name}`"
            if nav is not None:
                nav_pages = {s for s in nav if s.endswith(".md")}
                for s in sorted(nav_pages):
                    if s not in pages:
                        blockers.append(f"nav entry `{s}` does not exist in docs dir")
                for rel in pages:
                    if rel not in nav_pages:
                        warnings.append(f"`{rel}`: not referenced in nav")

    print(f"# Docs audit: `{root}`\n")
    print(f"- Pages: {len(pages)}")
    print(f"- Nav: {nav_note}")
    print(f"- Blockers: {len(blockers)}")
    print(f"- Warnings: {len(warnings)}\n")
    print("## Pages\n")
    print("| Page | Title / H1 | Words |")
    print("|---|---|---|")
    for rel, pg in pages.items():
        title = pg.h1[0] if pg.h1 else (pg.fm_title or "(none)")
        print(f"| `{rel}` | {title.replace('|', '/')} | {pg.words} |")
    print("\n## Blockers\n")
    print("\n".join(f"- {b}" for b in blockers) if blockers else "None.")
    print("\n## Warnings\n")
    print("\n".join(f"- {w}" for w in warnings) if warnings else "None.")
    return 1 if blockers else 0


if __name__ == "__main__":
    sys.exit(main())
