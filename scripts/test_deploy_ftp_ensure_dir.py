"""
Local-only regression tests for the deploy_ftp.py dry-run MKD safety repair.

Uses only unittest.mock-style fakes — no network connection, no FTP server,
no credentials, no production access. Run with:

    python scripts/test_deploy_ftp_ensure_dir.py

or:

    python -m unittest scripts.test_deploy_ftp_ensure_dir -v
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import deploy_ftp as dftp  # noqa: E402


class FakeFTP:
    """Records every command issued; never touches a real network or server.

    cwd() succeeds for any path unless explicitly listed in fail_cwd_for,
    simulating "directory does not exist yet" without needing full FTP
    filesystem semantics — sufficient to prove mutation gating.
    """

    def __init__(self, fail_cwd_for: frozenset[str] = frozenset()):
        self.calls: list[tuple] = []
        self.fail_cwd_for = fail_cwd_for

    def cwd(self, path: str) -> None:
        self.calls.append(("CWD", path))
        if path in self.fail_cwd_for:
            raise Exception("550 No such directory")

    def mkd(self, path: str) -> None:
        self.calls.append(("MKD", path))

    def storbinary(self, cmd: str, fh) -> None:
        self.calls.append(("STOR", cmd))

    def delete(self, path: str) -> None:
        self.calls.append(("DELE", path))

    def rmd(self, path: str) -> None:
        self.calls.append(("RMD", path))

    def sendcmd(self, cmd: str) -> str:
        self.calls.append(("SENDCMD", cmd))
        return "200 ok"

    def nlst(self):
        return []

    def mlsd(self, path: str):
        return iter([])

    def mutating_calls(self) -> list[tuple]:
        return [c for c in self.calls if c[0] in ("MKD", "STOR", "DELE", "RMD")]


def make_conn(fake_ftp: FakeFTP) -> dftp.Connection:
    conn = dftp.Connection()
    conn._ftp = fake_ftp
    return conn


class EnsureDirDryRunTests(unittest.TestCase):
    def test_dry_run_existing_dir_never_calls_mkd(self):
        ftp = FakeFTP()
        conn = make_conn(ftp)
        conn.ensure_dir("/public_html/api", dry_run=True)
        self.assertEqual(ftp.mutating_calls(), [])

    def test_dry_run_missing_dir_does_not_crash_and_never_calls_mkd(self):
        ftp = FakeFTP(fail_cwd_for=frozenset({"newdir"}))
        conn = make_conn(ftp)
        # Must not raise, even though "newdir" doesn't exist yet.
        conn.ensure_dir("/public_html/newdir", dry_run=True)
        self.assertEqual(ftp.mutating_calls(), [])

    def test_non_dry_run_still_calls_mkd_for_each_path_component(self):
        ftp = FakeFTP()
        conn = make_conn(ftp)
        conn.ensure_dir("/public_html/api", dry_run=False)
        mkd_paths = [c[1] for c in ftp.calls if c[0] == "MKD"]
        self.assertEqual(mkd_paths, ["public_html", "api"])

    def test_non_dry_run_default_parameter_unchanged(self):
        """dry_run defaults to False — existing callers that don't pass it
        keep issuing MKD exactly as before this repair."""
        ftp = FakeFTP()
        conn = make_conn(ftp)
        conn.ensure_dir("/public_html/api")
        mkd_paths = [c[1] for c in ftp.calls if c[0] == "MKD"]
        self.assertEqual(mkd_paths, ["public_html", "api"])

    def test_no_stor_mfmt_dele_rmd_introduced_by_dry_run_path(self):
        ftp = FakeFTP()
        conn = make_conn(ftp)
        conn.ensure_dir("/public_html/api", dry_run=True)
        kinds = {c[0] for c in ftp.calls}
        self.assertFalse(kinds & {"STOR", "DELE", "RMD"})
        # MFMT is sent via sendcmd() by set_mfmt(), never called from
        # ensure_dir() at all — confirm no sendcmd calls leaked in either.
        self.assertNotIn("SENDCMD", kinds)


class DiffDirDryRunTests(unittest.TestCase):
    def _make_local_tree(self, tmp: str) -> Path:
        local_dir = Path(tmp)
        (local_dir / "file.txt").write_text("hello")
        sub = local_dir / "sub"
        sub.mkdir()
        (sub / "nested.txt").write_text("x")
        return local_dir

    def test_new_remote_dir_dry_run_never_calls_mkd(self):
        """known_dirs empty -> remote_dir and its subdir are both 'new'."""
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP()
            conn = make_conn(ftp)
            stats = dftp.Stats()
            dftp._diff_dir(
                conn, stats, local_dir, "/public_html/newroot",
                index={}, known_dirs=set(),
                checksum_mode=False, dry_run=True,
                counter=[0], total=10,
            )
            self.assertEqual(ftp.mutating_calls(), [])

    def test_known_existing_remote_dir_dry_run_never_calls_mkd(self):
        """Regression test for the exact bug fixed: remote_dir already in
        known_dirs previously called ensure_dir() with no dry_run gating at
        all, unconditionally issuing MKD even during --dry-run."""
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP()
            conn = make_conn(ftp)
            stats = dftp.Stats()
            known_dirs = {dftp.normalise("/public_html/api")}
            dftp._diff_dir(
                conn, stats, local_dir, "/public_html/api",
                index={}, known_dirs=known_dirs,
                checksum_mode=False, dry_run=True,
                counter=[0], total=10,
            )
            self.assertEqual(ftp.mutating_calls(), [])

    def test_new_remote_dir_non_dry_run_calls_mkd(self):
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP()
            conn = make_conn(ftp)
            stats = dftp.Stats()
            dftp._diff_dir(
                conn, stats, local_dir, "/public_html/newroot",
                index={}, known_dirs=set(),
                checksum_mode=False, dry_run=False,
                counter=[0], total=10,
            )
            mkd_calls = [c for c in ftp.calls if c[0] == "MKD"]
            self.assertTrue(len(mkd_calls) >= 1)

    def test_known_existing_remote_dir_non_dry_run_unchanged_behavior(self):
        """Existing-directory handling under non-dry-run is unchanged: mkd
        is still attempted (best-effort, swallowed if already present).
        upload() also calls ensure_dir() defensively before STOR
        (pre-existing, unrelated to this repair), so this checks the
        expected path components are present rather than an exact call
        count, which would be brittle against that unrelated behavior."""
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = Path(tmp)
            (local_dir / "file.txt").write_text("hello")
            ftp = FakeFTP()
            conn = make_conn(ftp)
            stats = dftp.Stats()
            known_dirs = {dftp.normalise("/public_html/api")}
            dftp._diff_dir(
                conn, stats, local_dir, "/public_html/api",
                index={}, known_dirs=known_dirs,
                checksum_mode=False, dry_run=False,
                counter=[0], total=10,
            )
            mkd_paths = {c[1] for c in ftp.calls if c[0] == "MKD"}
            self.assertEqual(mkd_paths, {"public_html", "api"})


class SyncFrontendSourceMirrorDryRunTests(unittest.TestCase):
    def test_dry_run_never_calls_mkd(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "package.json").write_text("{}")
            src_dir = root / "src"
            src_dir.mkdir()
            (src_dir / "main.tsx").write_text("// x")

            orig_root, orig_items = dftp.ROOT, dftp.FRONTEND_SOURCE_ITEMS
            try:
                dftp.ROOT = root
                dftp.FRONTEND_SOURCE_ITEMS = ("package.json", "src")
                ftp = FakeFTP()
                conn = make_conn(ftp)
                stats = dftp.Stats()
                dftp.sync_frontend_source_mirror(
                    conn, stats, checksum_mode=False, dry_run=True
                )
                self.assertEqual(ftp.mutating_calls(), [])
            finally:
                dftp.ROOT, dftp.FRONTEND_SOURCE_ITEMS = orig_root, orig_items


class DeployFullDryRunCwdTests(unittest.TestCase):
    """Gate D3a: deploy_full()'s two direct cwd(remote_dir) calls used to be
    unguarded — under --full --dry-run against a top-level remote directory
    that doesn't exist yet, ensure_dir(dry_run=True) correctly declines to
    create it, but the following bare cwd(remote_dir) would then raise.
    These tests exercise both call sites through Connection.safe_cwd()."""

    def _make_local_tree(self, tmp: str) -> Path:
        local_dir = Path(tmp)
        (local_dir / "file.txt").write_text("hello")
        sub = local_dir / "sub"
        sub.mkdir()
        (sub / "nested.txt").write_text("x")
        return local_dir

    def test_dry_run_missing_top_dir_completes_without_raising_or_mutating(self):
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP(fail_cwd_for=frozenset({"/public_html/newroot"}))
            conn = make_conn(ftp)
            stats = dftp.Stats()
            # Must not raise.
            dftp.deploy_full(
                conn, stats, local_dir, "/public_html/newroot",
                dry_run=True, _counter=[0], _total=10,
            )
            self.assertEqual(ftp.mutating_calls(), [])

    def test_dry_run_existing_top_dir_completes_and_exercises_both_cwd_sites(self):
        """fail_cwd_for empty -> cwd always succeeds, so both the top-of-
        function cwd and the post-recursion return-to-parent cwd (the two
        formerly-direct call sites) are both exercised via safe_cwd()."""
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP()
            conn = make_conn(ftp)
            stats = dftp.Stats()
            dftp.deploy_full(
                conn, stats, local_dir, "/public_html/api",
                dry_run=True, _counter=[0], _total=10,
            )
            self.assertEqual(ftp.mutating_calls(), [])
            cwd_paths = [c[1] for c in ftp.calls if c[0] == "CWD"]
            # Both the parent dir and the nested "sub" dir were navigated
            # into and back out of.
            self.assertIn("/public_html/api", cwd_paths)
            self.assertIn("/public_html/api/sub", cwd_paths)

    def test_non_dry_run_missing_top_dir_real_cwd_failure_still_raises(self):
        """A genuine (non-dry-run) CWD failure must never be silently
        converted into success — safe_cwd() only swallows failures under
        dry_run."""
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP(fail_cwd_for=frozenset({"/public_html/newroot"}))
            conn = make_conn(ftp)
            stats = dftp.Stats()
            with self.assertRaises(Exception):
                dftp.deploy_full(
                    conn, stats, local_dir, "/public_html/newroot",
                    dry_run=False, _counter=[0], _total=10,
                )

    def test_non_dry_run_existing_top_dir_unchanged_behavior(self):
        """Non-dry-run traversal of an existing directory still creates
        (best-effort) dirs and uploads files exactly as before this repair."""
        with tempfile.TemporaryDirectory() as tmp:
            local_dir = self._make_local_tree(tmp)
            ftp = FakeFTP()
            conn = make_conn(ftp)
            stats = dftp.Stats()
            dftp.deploy_full(
                conn, stats, local_dir, "/public_html/api",
                dry_run=False, _counter=[0], _total=10,
            )
            mkd_paths = {c[1] for c in ftp.calls if c[0] == "MKD"}
            stor_calls = [c for c in ftp.calls if c[0] == "STOR"]
            self.assertEqual(mkd_paths, {"public_html", "api", "sub"})
            self.assertEqual(len(stor_calls), 2)  # file.txt + sub/nested.txt


if __name__ == "__main__":
    unittest.main()
