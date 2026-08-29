import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "meeting-fair-scale" / "scripts" / "render_report.py"
sys.path.insert(0, str(SCRIPT.parent))
import render_report  # noqa: E402


class RenderReportTests(unittest.TestCase):
    def load(self, name):
        return json.loads((ROOT / "tests" / "fixtures" / name).read_text(encoding="utf-8"))

    def test_valid_organizer_result_renders(self):
        document = self.load("organizer-shrink.json")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.html"
            render_report.render(document, output)
            html = output.read_text(encoding="utf-8")
        self.assertIn("__MEETING_DATA_B64__", render_report.TEMPLATE_PATH.read_text(encoding="utf-8"))
        self.assertNotIn("__MEETING_DATA_B64__", html)
        self.assertIn("会秤 / Fair Scale", html)

    def test_valid_attendee_result_renders(self):
        document = self.load("attendee-async.json")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.html"
            render_report.render(document, output)
            self.assertGreater(output.stat().st_size, 5000)

    def test_rejects_role_sum_mismatch(self):
        document = self.load("organizer-shrink.json")
        document["roles"][0]["syncCount"] = 0
        with self.assertRaises(render_report.ValidationError):
            render_report.validate_result(document)

    def test_rejects_orphan_agenda_role(self):
        document = self.load("organizer-shrink.json")
        document["agenda"][0]["requiredRoleIds"] = ["missing-role"]
        with self.assertRaises(render_report.ValidationError):
            render_report.validate_result(document)

    def test_cli_returns_nonzero_for_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "broken.json"
            output_path = Path(directory) / "report.html"
            input_path.write_text("{broken", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--input", str(input_path), "--output", str(output_path)],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid JSON", result.stderr)


if __name__ == "__main__":
    unittest.main()
