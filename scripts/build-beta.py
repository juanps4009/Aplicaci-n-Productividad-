#!/usr/bin/env python3
"""Genera dist/beta.html: la app en un solo archivo (CSS y JS incrustados),
lista para publicarse como Artifact y probarla en el celular."""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text()
css = (root / "styles.css").read_text()
js = (root / "app.js").read_text()
version = re.search(r'APP_VERSION = "([^"]+)"', js).group(1)

title = re.search(r"<title>.*?</title>", html, re.S).group(0)
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = body.replace('<script src="app.js"></script>', "")

out = f"{title}\n<style>\n{css}\n</style>\n{body}\n<script>\n{js}\n</script>\n"
dist = root / "dist"
dist.mkdir(exist_ok=True)
(dist / "beta.html").write_text(out)
print(f"dist/beta.html generado (versión {version}, {len(out)//1024} KB)")
