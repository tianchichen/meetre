import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "meetre" / "scripts" / "render_report.py"
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
        self.assertIn("__MEETING_DATA_B64__", render_report.build_template())
        self.assertNotIn("__MEETING_DATA_B64__", html)
        self.assertNotIn("__LOGO_DATA_URI__", html)
        self.assertIn('class="logo"', html)
        self.assertIn("src=\"data:image/png;base64,", html)

    def test_template_assembles_every_fragment(self):
        """交付物是单文件，但源码分片；缺任何一片都应该在渲染时立刻暴露。"""
        template = render_report.build_template()
        for placeholder in ("__STYLES__", "__BODY__", "__SCRIPT__"):
            self.assertNotIn(placeholder, template)
        self.assertIn("function basicValidate", template)  # js-validate.js
        self.assertIn("function renderBeam", template)  # js-render-scale.js
        self.assertIn("data-perspective", template)  # body.html 的视角切换
        self.assertNotIn("data-outcome-level", template)  # 主报告不再暴露意义不清的结果影响控件
        self.assertNotIn("<link", template)  # 必须保持零外链

    def test_every_fragment_stays_under_the_line_cap(self):
        """把 800 行上限落到片段上：这是拆分模板换来的东西，别让它悄悄退化。"""
        for path in sorted(render_report.TEMPLATE_DIR.iterdir()):
            lines = len(path.read_text(encoding="utf-8").splitlines())
            self.assertLessEqual(lines, 800, f"{path.name} has {lines} lines")

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

    def test_rejects_zero_minimum_sync_minutes(self):
        document = self.load("organizer-shrink.json")
        document["agenda"][0]["minSyncMinutes"] = 0
        with self.assertRaises(render_report.ValidationError):
            render_report.validate_result(document)

    def test_rejects_required_item_in_async_recommendation(self):
        document = self.load("organizer-shrink.json")
        document["recommendation"]["agendaModes"]["date"] = "async"
        with self.assertRaises(render_report.ValidationError):
            render_report.validate_result(document)

    def test_rejects_unknown_outcome_level(self):
        document = self.load("organizer-shrink.json")
        document["meeting"]["outcomeLevel"] = "huge"
        with self.assertRaises(render_report.ValidationError):
            render_report.validate_result(document)

    def test_legacy_v1_without_outcome_analysis_still_renders(self):
        document = self.load("organizer-shrink.json")
        document["meeting"].pop("outcomeLevel")
        document["meeting"].pop("outcomeWhy")
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
