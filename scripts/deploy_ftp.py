from ftplib import FTP
from pathlib import Path
import os

ROOT = Path(r"C:\Users\Bediz\Documents\akinalinsaat.com")

FTP_HOST = "ftp.akinalinsaat.com"
FTP_USER = "unalc@akinalinsaat.com"
FTP_PASS = os.getenv("AKINAL_FTP_PASS")
FTP_PORT = 21

if not FTP_PASS:
    raise SystemExit("AKINAL_FTP_PASS env değişkeni yok.")

ftp = FTP()
ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
ftp.login(FTP_USER, FTP_PASS)


def ensure_dir(remote_dir: str):
    parts = remote_dir.strip("/").split("/")
    ftp.cwd("/")
    for part in parts:
        if not part:
            continue
        try:
            ftp.mkd(part)
        except Exception:
            pass
        ftp.cwd(part)


def upload_dir(local_dir: Path, remote_dir: str):
    local_dir = Path(local_dir)

    if not local_dir.exists():
        raise SystemExit(f"Local klasör yok: {local_dir}")

    ensure_dir(remote_dir)
    ftp.cwd(remote_dir)

    for item in local_dir.iterdir():
        remote_path = f"{remote_dir}/{item.name}"

        if item.name.lower() == "uploads":
            print("SKIP uploads")
            continue

        if item.is_dir():
            print("DIR", remote_path)
            upload_dir(item, remote_path)
            ftp.cwd(remote_dir)
        else:
            with open(item, "rb") as file:
                ftp.storbinary(f"STOR {item.name}", file)
            print("uploaded", remote_path)


print("Deploy başladı...")
print("dist:", ROOT / "dist")
print("api:", ROOT / "public_html" / "api")

upload_dir(ROOT / "dist", "/public_html")
upload_dir(ROOT / "public_html" / "api", "/public_html/api")

ftp.quit()
print("Deploy tamam.")