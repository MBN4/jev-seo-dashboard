#!/usr/bin/env python3
"""Make AuditPilot-branded copies of an audit's report files.

Run with the audit engine's Python (it already has WeasyPrint):

    <engine>/.venv/bin/python scripts/brand_report.py --src <audit folder> --out <output folder> \
        --name AuditPilot --prefix RK --formats pdf,xlsx,md,digest

The engine's original files are only read, never modified. Branding means:
  - upstream product names in visible text become the brand name or neutral wording,
  - action ids JEV-001 become <PREFIX>-001,
  - the magenta palette becomes the brand green (hue rotation, lightness kept),
  - the PDF is re-rendered from the engine's own report.html with those changes.
"""
from __future__ import annotations

import argparse
import colorsys
import io
import re
import sys
import zipfile
from pathlib import Path

UPSTREAM = re.compile(r"jev", re.I)


def recolor_hex(hex6: str) -> str:
    """Rotate magenta/pink hues to emerald green; leave every other colour alone."""
    r, g, b = (int(hex6[i : i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if s < 0.18 or not (285 / 360 <= h <= 345 / 360):
        return hex6
    nr, ng, nb = colorsys.hls_to_rgb(156 / 360, l, min(1.0, s * 0.85))
    out = "".join(f"{round(c * 255):02x}" for c in (nr, ng, nb))
    return out.upper() if hex6.isupper() else out


def recolor(text: str) -> str:
    text = re.sub(r"#([0-9a-fA-F]{6})\b", lambda m: "#" + recolor_hex(m.group(1)), text)
    # Spreadsheet XML stores colours without '#', as RGB or ARGB attribute values.
    text = re.sub(r'(rgb|val|srgbClr val)="([0-9A-Fa-f]{2})?([0-9A-Fa-f]{6})"', lambda m: f'{m.group(1)}="{m.group(2) or ""}{recolor_hex(m.group(3))}"', text)
    return text


def rebrand_text(text: str, name: str, prefix: str) -> str:
    # Protect local font/file URLs (needed for rendering, never visible).
    keep: list[str] = []

    def stash(m):
        keep.append(m.group(0))
        return f"\x00{len(keep) - 1}\x00"

    text = re.sub(r"file://[^'\")\s]+", stash, text)
    text = re.sub(r"https?://github\.com/[^\s\"'<>)]*jev-seo[^\s\"'<>)]*", "#", text, flags=re.I)
    rules = [
        (r"\bJev SEO audit\b", f"{name} SEO audit"),
        (r"\bjev-seo\b", name),
        (r"\bjevseo\b", name.lower()),
        (r"\bJEV-(\d+)", rf"{prefix}-\1"),
        (r"\bJev judgments\b", "AI judgments"),
        (r"\bJev judgment\b", "AI judgment"),
        (r"\bJev's\b", "the AI's"),
        (r"\bjev-latest\b", "ai-model"),
        (r"\bJev\b", "AI"),
        (r"\bJEV\b", "AI"),
        # identifiers used consistently inside one document (CSS classes, variables, file names)
        (r"(?<![A-Za-z])jev(?=[-_ \"'.;:)\]}])", "brand"),
        (r"(?<![A-Za-z])jev\b", "brand"),
    ]
    for pat, rep in rules:
        text = re.sub(pat, rep, text)
    text = re.sub("\x00(\\d+)\x00", lambda m: keep[int(m.group(1))], text)
    return text


def brand_pdf(src: Path, out: Path, name: str, prefix: str) -> Path | None:
    html_path = src / "report.html"
    if not html_path.is_file():
        return None
    from weasyprint import HTML  # engine environment

    html = recolor(rebrand_text(html_path.read_text(encoding="utf-8"), name, prefix))
    target = out / "report.pdf"
    HTML(string=html, base_url=str(src)).write_pdf(target)
    return target


def recolor_png(data: bytes) -> bytes:
    try:
        from PIL import Image
    except ImportError:
        return data
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    try:
        import numpy as np
    except ImportError:
        return data
    # Vectorised version of recolor_hex: HSV hue rotation of magenta pixels to green.
    arr = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3:]
    hsv = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8), "RGB").convert("HSV")).astype(np.float32)
    h, s = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255
    mask = (s >= 0.18) & (h >= 285) & (h <= 345)
    if not mask.any():
        return data
    hsv[..., 0] = np.where(mask, 156 * 255 / 360, hsv[..., 0])
    hsv[..., 1] = np.where(mask, hsv[..., 1] * 0.85, hsv[..., 1])
    out = np.asarray(Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")).astype(np.float32) / 255.0
    merged = np.concatenate([out, alpha], axis=-1)
    im = Image.fromarray((merged * 255).round().astype(np.uint8), "RGBA")
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def brand_xlsx(src: Path, out: Path, name: str, prefix: str) -> Path | None:
    path = src / "report.xlsx"
    if not path.is_file():
        return None
    target = out / "report.xlsx"
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.endswith((".xml", ".rels")):
                data = recolor(rebrand_text(data.decode("utf-8"), name, prefix)).encode("utf-8")
            elif item.filename.lower().endswith(".png"):
                data = recolor_png(data)
            zout.writestr(item, data)
    return target


def brand_text_file(src: Path, out: Path, filename: str, name: str, prefix: str) -> Path | None:
    path = src / filename
    if not path.is_file():
        return None
    target = out / filename
    target.write_text(rebrand_text(path.read_text(encoding="utf-8"), name, prefix), encoding="utf-8")
    return target


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--name", default="AuditPilot")
    ap.add_argument("--prefix", default="AP")
    ap.add_argument("--formats", default="pdf,xlsx,md,digest")
    args = ap.parse_args(argv)
    src, out = Path(args.src), Path(args.out)
    if not (src / "audit.json").is_file():
        print(f"not an audit folder: {src}", file=sys.stderr)
        return 2
    out.mkdir(parents=True, exist_ok=True)
    made, failed = {}, {}
    builders = {
        "pdf": lambda: brand_pdf(src, out, args.name, args.prefix),
        "xlsx": lambda: brand_xlsx(src, out, args.name, args.prefix),
        "md": lambda: brand_text_file(src, out, "report.md", args.name, args.prefix),
        "digest": lambda: brand_text_file(src, out, "digest.md", args.name, args.prefix),
    }
    # Each format is independent: one failure must not block the others.
    for fmt in args.formats.split(","):
        if fmt not in builders:
            continue
        try:
            made[fmt] = builders[fmt]()
        except Exception as err:  # noqa: BLE001 - reported per format
            failed[fmt] = f"{type(err).__name__}: {err}"[:300]
    for k, v in made.items():
        print(f"{k}: {'written' if v else 'source missing'}")
    for k, v in failed.items():
        print(f"{k}: FAILED {v}")
    leftovers = []
    for k, v in made.items():
        if v and k != "xlsx" and k != "pdf" and UPSTREAM.search(v.read_text(encoding="utf-8", errors="ignore")):
            leftovers.append(k)
    if leftovers:
        print("WARNING upstream name still present in: " + ", ".join(leftovers), file=sys.stderr)
    (out / ".errors.json").write_text(__import__("json").dumps(failed))
    return 3 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
