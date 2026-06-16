from ftplib import FTP
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]

FTP_HOST = "ftp.akinalinsaat.com"
FTP_USER = "unalc@akinalinsaat.com"
FTP_PASS = os.getenv("AKINAL_FTP_PASS")
FTP_PORT = 21

if not FTP_PASS:
    raise SystemExit("AKINAL_FTP_PASS env değişkeni yok.")

ftp = FTP()
ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
ftp.login(FTP_USER, FTP_PASS)

EXCLUDED_REMOTE_PATHS = {
    "/public_html/api/config.php",
    "/public_html/api/config.local.php",
    "/public_html/.env",
    "/public_html/.env.local",
}

EXCLUDED_NAMES = {
    ".env",
    ".env.local",
}


def normalize_remote_path(remote_path: str) -> str:
    return "/" + remote_path.replace("\\", "/").strip("/")


def should_skip_upload(item: Path, remote_path: str) -> bool:
    normalized = normalize_remote_path(remote_path)
    if normalized in EXCLUDED_REMOTE_PATHS:
        return True

    return item.name in EXCLUDED_NAMES


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


def clear_remote_dir(remote_dir: str):
    print(f"Temizleniyor: {remote_dir}")
    ensure_dir(remote_dir)
    ftp.cwd(remote_dir)

    for name in ftp.nlst():
        if name in [".", ".."]:
            continue

        try:
            ftp.delete(name)
            print("deleted", f"{remote_dir}/{name}")
        except Exception:
            try:
                clear_remote_dir(f"{remote_dir}/{name}")
                ftp.cwd(remote_dir)
                ftp.rmd(name)
                print("deleted dir", f"{remote_dir}/{name}")
            except Exception as e:
                print("delete failed", f"{remote_dir}/{name}", e)


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

        if should_skip_upload(item, remote_path):
            print("SKIP protected", remote_path)
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

# Eski Vite hash dosyalarını temizle
clear_remote_dir("/public_html/assets")

# Build çıktısını yükle
upload_dir(ROOT / "dist", "/public_html")

# API dosyalarını yükle
upload_dir(ROOT / "public_html" / "api", "/public_html/api")

ftp.quit()
print("Deploy tamam.")
