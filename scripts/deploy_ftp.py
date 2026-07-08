#!/usr/bin/env python3
"""
deploy_ftp.py  —  Production-grade incremental FTP deployment for akinalinsaat.com.

Usage:
    python scripts/deploy_ftp.py                     # diff mode (default)
    python scripts/deploy_ftp.py --diff              # explicit diff
    python scripts/deploy_ftp.py --full              # clean deploy
    python scripts/deploy_ftp.py --diff --checksum   # SHA256 verification
    python scripts/deploy_ftp.py --diff --dry-run    # preview only
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from ftplib import FTP, error_perm
from pathlib import Path
from typing import Iterator, Optional

# Force UTF-8 output on Windows consoles
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ROOT: Path = Path(__file__).resolve().parents[1]

FTP_HOST = "ftp.akinalinsaat.com"
FTP_USER = "unalc@akinalinsaat.com"
FTP_PASS = os.getenv("AKINAL_FTP_PASS")
FTP_PORT = 21
FTP_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY = 3.0  # seconds between retry attempts

# Paths that must never be overwritten on the server.
PROTECTED_REMOTE: frozenset[str] = frozenset({
    "/public_html/api/config.php",
    "/public_html/api/config.local.php",
    "/public_html/.env",
    "/public_html/.env.local",
})

# Local filenames that must never be uploaded regardless of remote path.
PROTECTED_NAMES: frozenset[str] = frozenset({".env", ".env.local"})

# Directory names that are never uploaded or touched.
SKIP_DIRS: frozenset[str] = frozenset({"uploads"})


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
@dataclass
class RemoteEntry:
    """Metadata for one remote file (not directory) from MLSD or NLST."""

    path: str                       # normalised absolute path: /public_html/...
    size: Optional[int]             # None if server did not provide
    mtime: Optional[datetime]       # UTC; None if server did not provide


@dataclass
class HashCapability:
    """Records which FTP hash command the server supports and the algorithm it returns.

    command   — the FTP command prefix, e.g. "XMD5", "XSHA1", "HASH"
    algorithm — a hashlib-compatible name, e.g. "md5", "sha1", "sha256"

    Keeping these together guarantees that the local hash and the remote hash
    always use the same algorithm before any comparison is made.
    """

    command: str
    algorithm: str


@dataclass
class Stats:
    """Accumulates counters and timing for the final summary."""

    uploaded: int = 0
    unchanged: int = 0
    skipped: int = 0          # protected or explicitly excluded dirs
    dirs_created: int = 0
    errors: int = 0
    bytes_uploaded: int = 0
    start_time: float = field(default_factory=time.monotonic)


# ---------------------------------------------------------------------------
# Path utilities
# ---------------------------------------------------------------------------
def normalise(path: str) -> str:
    """Return an absolute, forward-slash path with no trailing slash."""
    return "/" + path.replace("\\", "/").strip("/")


def remote_join(parent: str, name: str) -> str:
    return normalise(f"{parent}/{name}")


def is_protected(local: Path, remote_path: str) -> bool:
    return normalise(remote_path) in PROTECTED_REMOTE or local.name in PROTECTED_NAMES


def iter_local(directory: Path) -> Iterator[Path]:
    """Yield items in a directory sorted for deterministic ordering."""
    return sorted(directory.iterdir())


def count_local_files(directory: Path) -> int:
    """Count uploadable files under directory (excludes SKIP_DIRS)."""
    total = 0
    for item in directory.rglob("*"):
        if item.is_file():
            # Exclude anything inside a skipped directory
            if not any(p.name.lower() in SKIP_DIRS for p in item.parents):
                total += 1
    return total


# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------
_MTIME_TOLERANCE = timedelta(seconds=2)  # FAT/FTP server rounding tolerance


def parse_mlsd_mtime(raw: str) -> Optional[datetime]:
    """Parse MLSD 'modify' fact  (YYYYMMDDHHmmss[.fraction])  → UTC datetime."""
    try:
        return datetime.strptime(raw[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def parse_mdtm_response(response: str) -> Optional[datetime]:
    """Parse '213 YYYYMMDDHHmmss' MDTM response → UTC datetime."""
    try:
        _, value = response.strip().split(" ", 1)
        return datetime.strptime(value[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None


def local_mtime_utc(path: Path) -> datetime:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------
def fmt_bytes(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def fmt_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s}s"


def log(tag: str, message: str) -> None:
    """Print a structured log line.  Tag is left-padded to 9 chars."""
    print(f"  [{tag:<9}] {message}", flush=True)


# ---------------------------------------------------------------------------
# Capability helpers  (free functions — usable before Connection exists)
# ---------------------------------------------------------------------------
def hash_file(path: Path, algorithm: str) -> str:
    """Return hex digest of *path* computed with *algorithm* (a hashlib name).

    Using hashlib.new() instead of hashlib.sha256() etc. makes the algorithm
    a runtime parameter so that local and remote always use the same one.
    """
    h = hashlib.new(algorithm)
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_feat(ftp: FTP) -> frozenset[str]:
    """Send FEAT and return the set of advertised feature keyword tokens (upper-cased).

    Each line of the FEAT response looks like '  MDTM' or '  HASH SHA-256;MD5'.
    We only extract the first token (the feature name) and ignore parameters here;
    callers that care about HASH sub-options parse the raw response separately.
    Returns an empty frozenset when FEAT is unsupported or the connection fails.
    """
    try:
        resp = ftp.sendcmd("FEAT")
        tokens: set[str] = set()
        for line in resp.splitlines():
            stripped = line.strip().upper()
            if not stripped or stripped.startswith("211"):
                continue
            tokens.add(stripped.split()[0])
        return frozenset(tokens)
    except Exception:
        return frozenset()


def _ftp_cmd_supported(ftp: FTP, cmd_prefix: str, known_file: str) -> bool:
    """Return True if the server recognises *cmd_prefix* as a valid command.

    Sends ``cmd_prefix known_file`` and inspects the response code:
      2xx  — command succeeded                          → supported
      550  — file-level error (command was understood)  → supported
      500/501/502 — syntax error / not implemented      → not supported
      any network exception                             → False (conservative)

    Using a real file path avoids the false negative that arises when probing
    commands like MDTM against ``/`` (a directory), which many servers reject
    with 550 even though the command is perfectly functional.
    """
    try:
        ftp.sendcmd(f"{cmd_prefix} {known_file}")
        return True
    except error_perm as exc:
        code = str(exc)[:3]
        return code not in ("500", "501", "502")
    except Exception:
        return False


def detect_hash_support(
    ftp: FTP,
    feat: frozenset[str],
    known_file: Optional[str],
) -> Optional[HashCapability]:
    """Determine which hash command the server supports and which algorithm it returns.

    Probe order — highest reliability first:

    1. HASH (RFC 5797): advertised via FEAT.  We send ``OPTS HASH <algo>``
       to select a specific algorithm before returning, so both sides always
       use the same one.  SHA-256 is preferred; we fall back to SHA-1 then MD5.

    2. XMD5: always returns MD5 (RFC extension, widely deployed on cPanel).

    3. XSHA1: always returns SHA-1 (RFC extension).

    Returns None when no hash command can be confirmed, so the caller does not
    attempt a comparison with an unknown or mismatched algorithm.
    """
    # ── 1. HASH (RFC 5797) ────────────────────────────────────────────────
    if "HASH" in feat:
        # Prefer algorithms in descending strength order.
        for opts_val, local_algo in [
            ("SHA-256", "sha256"),
            ("SHA-512", "sha512"),
            ("SHA-1",   "sha1"),
            ("MD5",     "md5"),
        ]:
            try:
                ftp.sendcmd(f"OPTS HASH {opts_val}")
                return HashCapability(command="HASH", algorithm=local_algo)
            except Exception:
                continue

    # ── 2. XMD5 ──────────────────────────────────────────────────────────
    if "XMD5" in feat or _ftp_cmd_supported(ftp, "XMD5", known_file or "/"):
        # Verify by checking the FEAT token; if FEAT was empty, _ftp_cmd_supported
        # already confirmed the command exists on a real file.
        if known_file or "XMD5" in feat:
            return HashCapability(command="XMD5", algorithm="md5")

    # ── 3. XSHA1 ─────────────────────────────────────────────────────────
    if "XSHA1" in feat or _ftp_cmd_supported(ftp, "XSHA1", known_file or "/"):
        if known_file or "XSHA1" in feat:
            return HashCapability(command="XSHA1", algorithm="sha1")

    return None


# ---------------------------------------------------------------------------
# FTP connection with auto-reconnect
# ---------------------------------------------------------------------------
class Connection:
    """
    Thin FTP wrapper.

    Responsibilities:
    - Connect / reconnect transparently.
    - Probe server capabilities once (MLSD, MDTM, MFMT, hash commands).
    - Upload with retry and optional MFMT preservation of mtime.
    """

    def __init__(self) -> None:
        self._ftp: Optional[FTP] = None
        # Lazy-initialised capability cache.  None = not yet probed.
        self._has_mlsd: Optional[bool] = None
        self._feat: Optional[frozenset[str]] = None   # one FEAT call shared by all checks
        self._has_mdtm: Optional[bool] = None
        self._has_mfmt: Optional[bool] = None
        # False = probed, not supported.  HashCapability = probed, supported.
        self._hash_cap: Optional[HashCapability | bool] = None

    # -- Lifecycle --

    def connect(self) -> None:
        """Open FTP connection and log in."""
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=FTP_TIMEOUT)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.set_pasv(True)   # required through NAT and firewalls; cPanel supports it
        self._ftp = ftp
        log("CONNECT", FTP_HOST)

    def disconnect(self) -> None:
        try:
            if self._ftp:
                self._ftp.quit()
        except Exception:
            pass
        self._ftp = None

    def reconnect(self) -> None:
        log("RECONNECT", "Reconnecting after connection drop...")
        self.disconnect()
        time.sleep(RETRY_DELAY)
        self.connect()

    @property
    def ftp(self) -> FTP:
        assert self._ftp is not None, "FTP not connected"
        return self._ftp

    # -- Capability probing --

    def _get_feat(self) -> frozenset[str]:
        """Return cached FEAT token set (one server round-trip total)."""
        if self._feat is None:
            self._feat = parse_feat(self.ftp)
        return self._feat

    def supports_mdtm(self, known_file: Optional[str] = None) -> bool:
        """Return True if the server supports the MDTM command.

        Detection strategy (avoids false negatives from directory probes):
        1. Check FEAT — most reliable and zero-cost after the first call.
        2. If FEAT didn't advertise MDTM but *known_file* (a real remote file
           path from the index) is supplied, send ``MDTM known_file`` and
           inspect the response code to distinguish "command unknown" (500/502)
           from "file-level error" (e.g. 550, which means the command exists).

        Never probes against ``/`` or a directory because many servers return
        550 for directories even when MDTM is fully functional, which would
        cause a false negative here.
        """
        if self._has_mdtm is None:
            if "MDTM" in self._get_feat():
                self._has_mdtm = True
            elif known_file:
                self._has_mdtm = _ftp_cmd_supported(self.ftp, "MDTM", known_file)
            else:
                # Cannot determine yet without a real file path; be conservative.
                return False
        return bool(self._has_mdtm)

    def supports_mfmt(self) -> bool:
        """Return True if the server supports MFMT (mtime preservation after upload)."""
        if self._has_mfmt is None:
            self._has_mfmt = "MFMT" in self._get_feat()
        return bool(self._has_mfmt)

    def hash_capability(self, known_file: Optional[str] = None) -> Optional[HashCapability]:
        """Return the hash capability the server supports, or None.

        The returned HashCapability carries both the FTP command *and* the
        hashlib algorithm name so that callers always compare the same algorithm
        on both sides.  Once detected the result is cached for the session.
        """
        if self._hash_cap is None:
            cap = detect_hash_support(self.ftp, self._get_feat(), known_file)
            self._hash_cap = cap if cap is not None else False
        return self._hash_cap if isinstance(self._hash_cap, HashCapability) else None

    def get_remote_hash(self, remote_path: str, cap: HashCapability) -> Optional[str]:
        """Return the remote file's hex digest using *cap.command*, or None on failure.

        Response parsing by command type:
          XMD5 / XSHA1  →  ``251 <hexdigest>``  (last token)
          HASH           →  ``213 <ALGO> <range> <hexdigest> <filename>``  (4th token)
        """
        try:
            resp = self.ftp.sendcmd(f"{cap.command} {remote_path}")
            parts = resp.split()
            if cap.command == "HASH" and len(parts) >= 4:
                return parts[3].lower()
            if len(parts) >= 2:
                return parts[-1].lower()
        except Exception:
            pass
        return None

    # -- Directory management --

    def ensure_dir(self, remote_dir: str) -> None:
        """Walk path components and create any that are missing."""
        parts = remote_dir.strip("/").split("/")
        self.ftp.cwd("/")
        for part in parts:
            if not part:
                continue
            try:
                self.ftp.mkd(part)
            except Exception:
                pass
            self.ftp.cwd(part)

    # -- MDTM / MFMT --

    def get_mdtm(self, remote_path: str) -> Optional[datetime]:
        """Query MDTM for a single file's mtime."""
        try:
            resp = self.ftp.sendcmd(f"MDTM {remote_path}")
            return parse_mdtm_response(resp)
        except Exception:
            return None

    def set_mfmt(self, remote_path: str, mtime: datetime) -> None:
        """Set remote file mtime via MFMT so future diffs can compare accurately."""
        if not self.supports_mfmt():
            return
        ts = mtime.strftime("%Y%m%d%H%M%S")
        try:
            self.ftp.sendcmd(f"MFMT {ts} {remote_path}")
        except Exception:
            pass

    # -- Upload with retry --

    def upload(
        self,
        local: Path,
        remote_path: str,
        stats: Stats,
        *,
        progress_label: str,
        dry_run: bool = False,
    ) -> bool:
        """
        Upload local → remote_path with up to MAX_RETRIES attempts.
        Preserves mtime via MFMT after a successful upload.
        Returns True on success.
        """
        remote_dir = "/".join(remote_path.split("/")[:-1]) or "/"
        remote_name = remote_path.split("/")[-1]

        if dry_run:
            log("DRY-RUN", f"would upload  {progress_label}")
            stats.uploaded += 1
            return True

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                self.ensure_dir(remote_dir)
                with open(local, "rb") as fh:
                    self.ftp.storbinary(f"STOR {remote_name}", fh)
                # Preserve local mtime so next diff can use mtime comparison.
                self.set_mfmt(remote_path, local_mtime_utc(local))
                nbytes = local.stat().st_size
                stats.bytes_uploaded += nbytes
                stats.uploaded += 1
                log("UPLOAD", f"{progress_label}  ({fmt_bytes(nbytes)})")
                return True
            except Exception as exc:
                if attempt < MAX_RETRIES:
                    log("WARNING", f"Upload failed (attempt {attempt}/{MAX_RETRIES}): {remote_path} — {exc}")
                    self.reconnect()
                else:
                    log("ERROR", f"Upload abandoned after {MAX_RETRIES} attempts: {remote_path} — {exc}")
                    stats.errors += 1
        return False

    # -- Download for checksum mode --

    def download_bytes(self, remote_path: str) -> Optional[bytes]:
        buf = io.BytesIO()
        try:
            self.ftp.retrbinary(f"RETR {remote_path}", buf.write)
            return buf.getvalue()
        except Exception:
            return None

    # -- Clear directory (full mode) --

    def clear_dir(self, remote_dir: str) -> None:
        """Recursively delete all contents of remote_dir."""
        log("CLEAR", remote_dir)
        self.ensure_dir(remote_dir)
        self.ftp.cwd(remote_dir)
        try:
            names = [n for n in self.ftp.nlst() if n not in (".", "..")]
        except Exception:
            return
        for name in names:
            path = f"{remote_dir}/{name}"
            try:
                self.ftp.delete(name)
            except Exception:
                try:
                    self.clear_dir(path)
                    self.ftp.cwd(remote_dir)
                    self.ftp.rmd(name)
                except Exception as exc:
                    log("WARNING", f"Could not delete {path}: {exc}")


# ---------------------------------------------------------------------------
# Remote directory indexing
# ---------------------------------------------------------------------------
def build_remote_index(
    conn: Connection, remote_root: str
) -> tuple[dict[str, RemoteEntry], set[str]]:
    """Walk the entire remote tree under remote_root in one pass.

    Returns:
        index      — {normalised_path: RemoteEntry} for every remote *file*
        known_dirs — set of normalised paths for every remote *directory*

    Keeping directories in a separate set lets _diff_dir distinguish "directory
    exists on server" from "directory is new" without polluting the file index.
    Uses MLSD for rich metadata (size + mtime).  Falls back to NLST if MLSD
    is unavailable — in that case size and mtime will be None.
    """
    index: dict[str, RemoteEntry] = {}
    known_dirs: set[str] = {normalise(remote_root)}   # root itself is known to exist
    _walk(conn, remote_root, index, known_dirs)
    return index, known_dirs


def _walk(
    conn: Connection,
    remote_dir: str,
    index: dict[str, RemoteEntry],
    known_dirs: set[str],
) -> None:
    """Recursive helper for build_remote_index."""
    try:
        entries = list(conn.ftp.mlsd(remote_dir))
        conn._has_mlsd = True
    except Exception:
        conn._has_mlsd = False
        entries = _nlst_entries(conn, remote_dir)

    for name, facts in entries:
        if name in (".", ".."):
            continue
        ftype = facts.get("type", "file")
        is_dir = ftype in ("dir", "cdir", "pdir")
        entry_path = remote_join(remote_dir, name)

        if is_dir and name.lower() in SKIP_DIRS:
            continue

        if not is_dir:
            size_raw = facts.get("size")
            mtime_raw = facts.get("modify")
            index[entry_path] = RemoteEntry(
                path=entry_path,
                size=int(size_raw) if size_raw else None,
                mtime=parse_mlsd_mtime(mtime_raw) if mtime_raw else None,
            )
        else:
            known_dirs.add(entry_path)
            _walk(conn, entry_path, index, known_dirs)


def _nlst_entries(conn: Connection, remote_dir: str) -> list[tuple[str, dict]]:
    try:
        conn.ftp.cwd(remote_dir)
        return [(n, {"type": "file"}) for n in conn.ftp.nlst() if n not in (".", "..")]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# File comparison  —  the heart of diff mode
# ---------------------------------------------------------------------------

# Instrumentation: print diagnostics for the first N files to stderr so the
# operator can verify what the comparison engine sees on a real deploy.
# Set DEPLOY_DEBUG=1 in the environment to activate.
_DEBUG = os.getenv("DEPLOY_DEBUG") == "1"
_debug_count = [0]
_DEBUG_LIMIT = 10


def _debug_print(
    local: Path,
    remote: Optional[RemoteEntry],
    conn: Connection,
    decision: bool,
    reason: str,
) -> None:
    """Print one structured diagnostic block to stderr."""
    cap = conn._hash_cap
    cap_label = (
        f"{cap.command}/{cap.algorithm}" if isinstance(cap, HashCapability) else "none"
    )
    remote_size  = str(remote.size)  if (remote and remote.size  is not None) else "N/A"
    remote_mtime = str(remote.mtime) if (remote and remote.mtime is not None) else "N/A"
    print(
        f"\n--- diff diagnostic [{_debug_count[0]}/{_DEBUG_LIMIT}] ---\n"
        f"  LOCAL:            {local}\n"
        f"  REMOTE:           {remote.path if remote else 'NOT IN INDEX'}\n"
        f"  INDEX HIT:        {'yes' if remote else 'no'}\n"
        f"  LOCAL SIZE:       {local.stat().st_size}\n"
        f"  REMOTE SIZE:      {remote_size}\n"
        f"  LOCAL MTIME:      {local_mtime_utc(local)}\n"
        f"  REMOTE MTIME:     {remote_mtime}\n"
        f"  SUPPORTS MFMT:    {'yes' if conn.supports_mfmt() else 'no'}\n"
        f"  HASH CAPABILITY:  {cap_label}\n"
        f"  DECISION:         {'UPLOAD' if decision else 'SKIP'}\n"
        f"  REASON:           {reason}\n",
        file=sys.stderr,
        flush=True,
    )


def needs_upload(
    local: Path,
    remote: Optional[RemoteEntry],
    conn: Connection,
    *,
    checksum_mode: bool,
) -> bool:
    """Return True if *local* should be uploaded to the server.

    Comparison strategy (no local-mtime used):

    --checksum
        Download the remote file and compare SHA-256 digests.  Byte-exact.

    1   File missing on server (not in remote index) → upload.

    2   Server reported no size → upload conservatively.

    3   Sizes differ → upload.

    4   Sizes match → try server hash (XMD5 / XSHA1 / HASH).
        Hash differs   → upload.
        Hash matches   → skip.
        No hash cmd    → skip (size-only match).

    Why no local-mtime comparison:
        Every `npm run build` gives dist/ files a fresh filesystem mtime equal
        to the current clock time.  MFMT stamps the remote with the *previous*
        build's mtime.  On the next run the delta is minutes or hours — always
        exceeding the 2-second tolerance — so every file would re-upload even
        when nothing changed.  Local mtime is the build-clock time, not a
        content fingerprint.  Size + optional server-hash is the correct signal.
    """
    result, reason = _needs_upload_inner(local, remote, conn, checksum_mode=checksum_mode)

    if _DEBUG and _debug_count[0] < _DEBUG_LIMIT:
        _debug_count[0] += 1
        _debug_print(local, remote, conn, result, reason)

    return result


def _needs_upload_inner(
    local: Path,
    remote: Optional[RemoteEntry],
    conn: Connection,
    *,
    checksum_mode: bool,
) -> tuple[bool, str]:
    """Core comparison logic; returns (upload_required, reason_label)."""

    # 1. Missing on server.
    if remote is None:
        return True, "remote missing"

    local_size = local.stat().st_size

    # --checksum: exact content comparison via download.
    if checksum_mode:
        data = conn.download_bytes(remote.path)
        if data is None:
            return True, "remote missing"
        differs = hash_file(local, "sha256") != hashlib.sha256(data).hexdigest()
        return differs, ("hash differs" if differs else "unchanged")

    # 2. No size from server → cannot compare.
    if remote.size is None:
        return True, "metadata unavailable"

    # 3. Size differs → content changed.
    if remote.size != local_size:
        return True, "size differs"

    # 4. Sizes match → try server hash for confirmation.
    #    Server hash is the only reliable content fingerprint available over FTP
    #    without downloading the whole file.  Local mtime is NOT used here because
    #    build tools (Vite, etc.) update file mtimes on every build regardless of
    #    whether the content changed.
    cap = conn.hash_capability(remote.path)
    if cap is not None:
        remote_hash = conn.get_remote_hash(remote.path, cap)
        if remote_hash is not None:
            differs = hash_file(local, cap.algorithm) != remote_hash
            return differs, ("hash differs" if differs else "unchanged")

    # No hash command available: size-only match → accept as unchanged.
    # This carries the same risk as rsync without --checksum, acceptable for
    # content-addressed assets (Vite hash filenames) and typical PHP deployments.
    return False, "unchanged"


# ---------------------------------------------------------------------------
# Full deploy (clear + upload everything)
# ---------------------------------------------------------------------------
def deploy_full(
    conn: Connection,
    stats: Stats,
    local_dir: Path,
    remote_dir: str,
    *,
    dry_run: bool,
    _counter: list[int],
    _total: int,
) -> None:
    """Recursively upload every file unconditionally."""
    conn.ensure_dir(remote_dir)
    conn.ftp.cwd(remote_dir)
    for item in iter_local(local_dir):
        remote_path = remote_join(remote_dir, item.name)
        if item.is_dir():
            if item.name.lower() in SKIP_DIRS:
                log("SKIP", f"{remote_path}  (excluded dir)")
                stats.skipped += 1
                continue
            conn.ensure_dir(remote_path)
            deploy_full(conn, stats, item, remote_path,
                        dry_run=dry_run, _counter=_counter, _total=_total)
            conn.ftp.cwd(remote_dir)
        else:
            if is_protected(item, remote_path):
                log("PROTECTED", remote_path)
                stats.skipped += 1
                continue
            _counter[0] += 1
            label = f"[{_counter[0]}/{_total}] {remote_path}"
            conn.upload(item, remote_path, stats, progress_label=label, dry_run=dry_run)


# ---------------------------------------------------------------------------
# Diff deploy (incremental)
# ---------------------------------------------------------------------------
def deploy_diff(
    conn: Connection,
    stats: Stats,
    local_roots: list[tuple[Path, str]],
    *,
    checksum_mode: bool,
    dry_run: bool,
) -> None:
    """
    Incremental deployment:
    1. Count local files for progress display.
    2. Build a single remote index covering all remote roots.
    3. Walk each local root, compare against index, upload only what changed.
    """
    # Step 1: count
    total = sum(count_local_files(ld) for ld, _ in local_roots)
    counter = [0]   # mutable for nested recursion

    # Step 2: index
    print(f"\n  Building remote index...", flush=True)
    remote_index: dict[str, RemoteEntry] = {}
    known_dirs: set[str] = set()
    for _, remote_root in local_roots:
        try:
            sub_index, sub_dirs = build_remote_index(conn, remote_root)
            remote_index.update(sub_index)
            known_dirs.update(sub_dirs)
        except Exception as exc:
            log("WARNING", f"Could not index {remote_root}: {exc}")
    print(f"  Remote entries indexed: {len(remote_index)}", flush=True)
    print(f"  Remote dirs indexed:   {len(known_dirs)}", flush=True)
    print(f"  Local files to check:  {total}\n", flush=True)

    # Step 3: walk and upload
    for local_root, remote_root in local_roots:
        _diff_dir(conn, stats, local_root, remote_root, remote_index, known_dirs,
                  checksum_mode=checksum_mode, dry_run=dry_run,
                  counter=counter, total=total)


def _diff_dir(
    conn: Connection,
    stats: Stats,
    local_dir: Path,
    remote_dir: str,
    index: dict[str, RemoteEntry],
    known_dirs: set[str],
    *,
    checksum_mode: bool,
    dry_run: bool,
    counter: list[int],
    total: int,
) -> None:
    """Recursive helper for deploy_diff.

    known_dirs contains the normalised paths of every directory confirmed to
    exist on the server during the initial index walk.  We use it to decide
    whether to log [MKDIR] and increment dirs_created — avoiding false reports
    for directories that already exist.
    """
    remote_norm = normalise(remote_dir)
    # Create the directory only if it was not seen during the remote walk.
    if remote_norm not in known_dirs:
        if not dry_run:
            conn.ensure_dir(remote_dir)
            log("MKDIR", remote_dir)
        else:
            log("DRY-RUN", f"would mkdir  {remote_dir}")
        stats.dirs_created += 1
    else:
        conn.ensure_dir(remote_dir)  # still needed to set FTP CWD correctly

    for item in iter_local(local_dir):
        remote_path = remote_join(remote_dir, item.name)
        if item.is_dir():
            if item.name.lower() in SKIP_DIRS:
                stats.skipped += 1
                continue
            if normalise(remote_path) not in known_dirs:
                if not dry_run:
                    conn.ensure_dir(remote_path)
                    log("MKDIR", remote_path)
                else:
                    log("DRY-RUN", f"would mkdir  {remote_path}")
                stats.dirs_created += 1
            _diff_dir(conn, stats, item, remote_path, index, known_dirs,
                      checksum_mode=checksum_mode, dry_run=dry_run,
                      counter=counter, total=total)
        else:
            if is_protected(item, remote_path):
                log("PROTECTED", remote_path)
                stats.skipped += 1
                continue
            counter[0] += 1
            remote_entry = index.get(normalise(remote_path))
            if needs_upload(item, remote_entry, conn, checksum_mode=checksum_mode):
                label = f"[{counter[0]}/{total}] {remote_path}"
                conn.upload(item, remote_path, stats, progress_label=label, dry_run=dry_run)
            else:
                stats.unchanged += 1
                log("UNCHANGED", f"[{counter[0]}/{total}] {remote_path}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def print_summary(stats: Stats) -> None:
    elapsed = time.monotonic() - stats.start_time
    speed = int(stats.bytes_uploaded / elapsed) if elapsed > 0 else 0
    width = 44
    sep = "═" * width
    print(f"""
╔{sep}╗
║{"DEPLOY ÖZET / SUMMARY":^{width}}║
╠{sep}╣
║  {"Yüklenen dosya / Uploaded":<30} {stats.uploaded:>10}  ║
║  {"Değişmeyen   / Unchanged":<30} {stats.unchanged:>10}  ║
║  {"Korumalı/skip / Skipped":<30} {stats.skipped:>10}  ║
║  {"Klasör oluştu / Dirs created":<30} {stats.dirs_created:>10}  ║
║  {"Hata          / Errors":<30} {stats.errors:>10}  ║
║  {"Yüklenen veri / Bytes uploaded":<30} {fmt_bytes(stats.bytes_uploaded):>10}  ║
║  {"Transfer hızı / Speed":<30} {fmt_bytes(speed) + "/s":>10}  ║
║  {"Toplam süre   / Elapsed":<30} {fmt_duration(elapsed):>10}  ║
╚{sep}╝""", flush=True)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="deploy_ftp.py",
        description="Production-grade incremental FTP deployment for akinalinsaat.com",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--diff", action="store_true",
                      help="Incremental deploy — upload only changed/missing files (default)")
    mode.add_argument("--full", action="store_true",
                      help="Full clean deploy — clear assets/ then upload everything")
    p.add_argument("--checksum", action="store_true",
                   help="Use SHA256 comparison instead of size/mtime (slower, exact; diff only)")
    p.add_argument("--dry-run", action="store_true",
                   help="Preview what would be uploaded without transferring anything")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    full_mode: bool = args.full
    checksum_mode: bool = args.checksum
    dry_run: bool = args.dry_run

    if not FTP_PASS:
        raise SystemExit("Error: AKINAL_FTP_PASS environment variable is not set.")
    if checksum_mode and full_mode:
        raise SystemExit("Error: --checksum is only applicable in diff mode.")

    mode_label = "FULL" if full_mode else ("DIFF + CHECKSUM" if checksum_mode else "DIFF")
    prefix = "[DRY-RUN] " if dry_run else ""
    print(f"\n{'='*52}", flush=True)
    print(f"  {prefix}Deploy başladı — mode: {mode_label}", flush=True)
    print(f"{'='*52}\n", flush=True)

    stats = Stats()
    conn = Connection()
    conn.connect()

    try:
        if full_mode:
            # Count before clearing so the progress denominator is correct.
            dist_total = count_local_files(ROOT / "dist")
            api_total = count_local_files(ROOT / "public_html" / "api")
            total = dist_total + api_total
            counter: list[int] = [0]

            print("\n  --- Clearing old assets ---", flush=True)
            if not dry_run:
                conn.clear_dir("/public_html/assets")

            print("\n  --- Uploading dist/ ---", flush=True)
            deploy_full(conn, stats, ROOT / "dist", "/public_html",
                        dry_run=dry_run, _counter=counter, _total=total)

            print("\n  --- Uploading api/ ---", flush=True)
            deploy_full(conn, stats, ROOT / "public_html" / "api", "/public_html/api",
                        dry_run=dry_run, _counter=counter, _total=total)
        else:
            deploy_diff(
                conn, stats,
                local_roots=[
                    (ROOT / "dist",                  "/public_html"),
                    (ROOT / "public_html" / "api",   "/public_html/api"),
                ],
                checksum_mode=checksum_mode,
                dry_run=dry_run,
            )
    finally:
        conn.disconnect()

    print_summary(stats)

    if stats.errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
