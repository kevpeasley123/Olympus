import importlib.util
import json
from pathlib import Path
import unittest
import uuid

spec = importlib.util.spec_from_file_location("record_preparer", Path(__file__).with_name("new-memory-record.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def frontmatter(text):
    return {line.split(": ", 1)[0]: json.loads(line.split(": ", 1)[1]) for line in text.split("---\n")[1].strip().splitlines()}

class RecordPreparation(unittest.TestCase):
    def test_distinct_milestones_share_source_session_not_record_identity(self):
        first = frontmatter(module.prepare("First", ["olympus"], "session-record", "Verified outcome", "chat-1"))
        second = frontmatter(module.prepare("Second", ["olympus"], "session-record", "Later outcome", "chat-1"))
        self.assertEqual(first["source_session"], second["source_session"])
        self.assertNotEqual(uuid.UUID(first["record_id"]), uuid.UUID(second["record_id"]))
        self.assertIsNone(first["observed_at"])
        self.assertNotIn("source_date", first)
    def test_decisions_default_to_proposals_and_corrections_keep_ids(self):
        values = frontmatter(module.prepare("Choice", ["olympus", "ledger"], "decision", "Proposed rationale", supersedes=["old-1"]))
        self.assertEqual(values["decision_status"], "proposed")
        self.assertEqual(values["project_ids"], ["olympus", "ledger"])
        self.assertEqual(values["supersedes"], ["old-1"])
    def test_source_time_requires_timezone_and_required_inputs_are_checked(self):
        with self.assertRaises(ValueError): module.prepare("Choice", ["olympus"], "session-record", "Evidence", observed="2026-10-08T20:00:00")
        with self.assertRaises(ValueError): module.prepare("Choice", [], "session-record", "Evidence")

if __name__ == "__main__": unittest.main()
