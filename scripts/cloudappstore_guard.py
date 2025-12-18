#!/usr/bin/env python3
import sys
import pathlib
import re

ROOT = pathlib.Path(".").resolve()

# ✅ PWA App Hub Root Whitelist
ROOT_WHITELIST = {
    "index.html",
    "README.md",
    ".gitignore",
    ".nojekyll",
    "apps.json",
    "vercel.json",
    "manifest.json",
    "sw.js",
    ".github",
    "assets",
    "scripts",
    "apps",
    "auto-shorts",
    "bilingual-aligner",
    "clip-shorts",
    "lecture-long",
    "lecture-shorts",
    "slim-lens",
}

# ❌ Python 찌꺼기 금지
PY_TRASH_PATTERNS = [
    r"(^|/)(__pycache__)(/|$)",
    r"\.pyc$",
]

# ❌ 공백 파일명 금지
SPACE_NAME_PATTERN = r"\s"

# ❌ 루트 이미지 금지 (assets/ 외)
ROOT_IMAGE_PATTERNS = [
    r"^[^/]+\.(png|jpg|jpeg|gif|ico|svg|webp)$",
]

# ❌ 루트 JS 금지 (scripts/ 외, sw.js 제외)
ROOT_JS_PATTERN = r"^(?!sw\.js$)[^/]+\.js$"

def is_allowed_root(path: pathlib.Path) -> bool:
    rel = path.relative_to(ROOT)
    if len(rel.parts) != 1:
        return True
    return rel.parts[0] in ROOT_WHITELIST

def matches_any(patterns, rel_str: str) -> bool:
    return any(re.search(pat, rel_str) for pat in patterns)

def main():
    violations = []

    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue

        rel = p.relative_to(ROOT)
        rel_str = rel.as_posix()

        # Skip .git
        if rel_str.startswith(".git/"):
            continue

        # 1) 루트 화이트리스트 위반
        if len(rel.parts) == 1 and not is_allowed_root(p):
            violations.append((rel_str, "ROOT_WHITELIST_VIOLATION"))

        # 2) pycache/pyc 차단
        if matches_any(PY_TRASH_PATTERNS, rel_str):
            violations.append((rel_str, "PY_TRASH_FORBIDDEN"))

        # 3) 공백 파일명 차단
        if re.search(SPACE_NAME_PATTERN, p.name):
            violations.append((rel_str, "SPACE_IN_FILENAME_FORBIDDEN"))

        # 4) 루트 이미지 차단 (assets/ 외)
        if len(rel.parts) == 1 and matches_any(ROOT_IMAGE_PATTERNS, rel_str):
            violations.append((rel_str, "ROOT_IMAGE_FORBIDDEN"))

        # 5) 루트 JS 차단 (sw.js 제외)
        if len(rel.parts) == 1 and re.match(ROOT_JS_PATTERN, rel_str):
            violations.append((rel_str, "ROOT_JS_FORBIDDEN"))

    if violations:
        print("❌ CLOUDAPPSTORE.GUARD FAILED\n")
        for rel_str, kind in violations:
            print(f"- {kind}: {rel_str}")
        print("\nFix these before merging/pushing to main.")
        return 1

    print("✅ CLOUDAPPSTORE.GUARD PASSED")
    return 0

if __name__ == "__main__":
    sys.exit(main())
