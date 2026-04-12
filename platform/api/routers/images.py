import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Coin, User

router = APIRouter(prefix="/images", tags=["Images"])

IMAGE_DIR = Path(os.environ.get("IMAGE_DIR", "/app/images"))
THUMB_DIR = IMAGE_DIR / "thumbs"
THUMB_SIZE = (200, 200)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tiff"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def _ensure_dirs():
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)


def _generate_thumbnail(source_path: Path, thumb_path: Path):
    with Image.open(source_path) as img:
        img.thumbnail(THUMB_SIZE, Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(thumb_path, "JPEG", quality=85)


@router.post("/{coin_id}")
async def upload_images(
    coin_id: str,
    obverse: UploadFile | None = None,
    reverse: UploadFile | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not obverse and not reverse:
        raise HTTPException(status_code=400, detail="At least one image required")

    coin = db.query(Coin).filter(Coin.coin_id == coin_id).first()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")

    _ensure_dirs()
    results = {}

    for side, file in [("O", obverse), ("R", reverse)]:
        if not file:
            continue

        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type {ext} not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 20MB)")

        filename = f"{coin_id}_{side}{ext}"
        filepath = IMAGE_DIR / filename
        filepath.write_bytes(content)

        # Generate thumbnail
        thumb_path = THUMB_DIR / f"{coin_id}_{side}.jpg"
        _generate_thumbnail(filepath, thumb_path)

        if side == "O":
            coin.obverse_image_path = filename
        else:
            coin.reverse_image_path = filename

        results[side] = filename

    from datetime import datetime

    coin.image_capture_date = datetime.now()
    db.commit()

    return {"coin_id": coin_id, "uploaded": results}


@router.get("/{filename}")
def serve_image(
    filename: str,
    user: User = Depends(get_current_user),
):
    filepath = IMAGE_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


@router.get("/thumbs/{filename}")
def serve_thumbnail(
    filename: str,
    user: User = Depends(get_current_user),
):
    thumb_path = THUMB_DIR / filename
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(thumb_path)
