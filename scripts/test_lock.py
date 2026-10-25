"""Hash every test file so subagent work can be checked for test edits.

usage: python3 scripts/test_lock.py snapshot|verify [name]

A name keeps separate snapshots for work running in parallel (default: "default").
"""

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"node_modules", ".venv", ".next", "dist", "__pycache__", ".git", "scripts"}
PATTERNS = ("test_*.py", "*_test.py", "conftest.py", "*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx")


def is_test(path: Path) -> bool:
    parts = set(path.relative_to(ROOT).parts)
    if parts & SKIP:
        return False
    if "tests" in parts or "__snapshots__" in parts:
        return True
    return any(path.match(p) for p in PATTERNS)


def collect() -> dict[str, str]:
    out = {}
    for p in sorted(ROOT.rglob("*")):
        if p.is_file() and is_test(p):
            out[str(p.relative_to(ROOT))] = hashlib.sha256(p.read_bytes()).hexdigest()
    return out


def snapshot_path(name: str) -> Path:
    suffix = "" if name == "default" else f"-{name}"
    return ROOT / "scripts" / f".test-snapshot{suffix}.json"


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    snapshot = snapshot_path(sys.argv[2] if len(sys.argv) > 2 else "default")
    if cmd == "snapshot":
        files = collect()
        snapshot.write_text(json.dumps(files, indent=1))
        print(f"snapshot: {len(files)} test files")
        return 0
    if cmd == "verify":
        before = json.loads(snapshot.read_text())
        after = collect()
        changed = [f for f in before if f in after and before[f] != after[f]]
        removed = [f for f in before if f not in after]
        added = [f for f in after if f not in before]
        for label, items in (("CHANGED", changed), ("REMOVED", removed), ("ADDED", added)):
            for f in items:
                print(f"{label}: {f}")
        if changed or removed or added:
            print("test lock: FAILED")
            return 1
        print(f"test lock: OK ({len(after)} files unchanged)")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
