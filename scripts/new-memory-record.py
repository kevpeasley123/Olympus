"""Prepare a versioned memory record; does not write to a vault or collect chats."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import uuid


def prepare(title, projects, kind, body, session=None, observed=None, author="Codex", supersedes=(), corrects=()):
    if not title.strip() or not projects or not body.strip():
        raise ValueError("A title, exact project identity and source-grounded body are required")
    if observed:
        parsed = datetime.fromisoformat(observed.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("observed-at requires a timezone; omit it if unknown")
    values = {
        "schema_version": 1, "record_id": str(uuid.uuid4()), "title": title,
        "type": kind, "project_ids": list(projects), "author": author,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "observed_at": observed, "source_session": session,
        "supersedes": list(supersedes), "corrects": list(corrects),
        "derived_from": [], "source_revisions": {}, "tags": [f"olympus/{kind}"],
    }
    if kind == "decision":
        values["decision_status"] = "proposed"
    if kind == "session-record":
        values["reconciliation"] = "pending"
    # JSON scalar/array notation is also valid YAML. Unknowns remain null.
    front = "\n".join(f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in values.items())
    return f"---\n{front}\n---\n\n# {title}\n\n{body.strip()}\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--title", required=True)
    parser.add_argument("--project", action="append", required=True)
    parser.add_argument("--kind", choices=["session-record", "decision", "reconciliation-record"], default="session-record")
    parser.add_argument("--body-file", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--source-session")
    parser.add_argument("--observed-at")
    parser.add_argument("--author", default="Codex")
    parser.add_argument("--supersedes", action="append", default=[])
    parser.add_argument("--corrects", action="append", default=[])
    args = parser.parse_args()
    text = prepare(args.title, args.project, args.kind, Path(args.body_file).read_text(encoding="utf-8-sig"), args.source_session, args.observed_at, args.author, args.supersedes, args.corrects)
    with Path(args.output).open("x", encoding="utf-8", newline="\n") as output:
        output.write(text)
    print(args.output)


if __name__ == "__main__":
    main()
