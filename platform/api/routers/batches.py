from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Batch, Coin, User
from schemas import BatchCreate, BatchResponse, BatchUpdate

router = APIRouter(prefix="/batches", tags=["Batches"])


def _batch_response(batch: Batch, coin_count: int) -> dict:
    return {
        "batch_id": batch.batch_id,
        "name": batch.name,
        "grader": batch.grader,
        "created_date": batch.created_date,
        "shipped_date": batch.shipped_date,
        "returned_date": batch.returned_date,
        "invoice_number": batch.invoice_number,
        "coin_count": coin_count,
    }


@router.post("/", response_model=BatchResponse, status_code=201)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = Batch(name=payload.name, grader=payload.grader.value)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return _batch_response(batch, 0)


@router.get("/", response_model=list[BatchResponse])
def list_batches(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batches = (
        db.query(Batch, sa_func.count(Coin.coin_id).label("coin_count"))
        .outerjoin(Coin, Coin.batch_id == Batch.batch_id)
        .group_by(Batch.batch_id)
        .order_by(Batch.created_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_batch_response(b, count) for b, count in batches]


@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = (
        db.query(Batch, sa_func.count(Coin.coin_id).label("coin_count"))
        .outerjoin(Coin, Coin.batch_id == Batch.batch_id)
        .filter(Batch.batch_id == batch_id)
        .group_by(Batch.batch_id)
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch, count = result
    return _batch_response(batch, count)


@router.put("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)

    db.commit()
    db.refresh(batch)

    coin_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    return _batch_response(batch, coin_count)


@router.post("/{batch_id}/add-coins", response_model=BatchResponse)
def add_coins_to_batch(
    batch_id: int,
    coin_ids: list[str],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    current_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    if current_count + len(coin_ids) > 50:
        raise HTTPException(
            status_code=400,
            detail=f"Batch would exceed 50-coin limit. Currently {current_count} coins, trying to add {len(coin_ids)}.",
        )

    coins = db.query(Coin).filter(Coin.coin_id.in_(coin_ids)).all()
    if len(coins) != len(coin_ids):
        found = {c.coin_id for c in coins}
        missing = [cid for cid in coin_ids if cid not in found]
        raise HTTPException(status_code=404, detail=f"Coins not found: {missing}")

    for coin in coins:
        coin.batch_id = batch_id
        coin.submission_status = "on_form"

    db.commit()

    total_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    return _batch_response(batch, total_count)


@router.post("/{batch_id}/remove-coins", response_model=BatchResponse)
def remove_coins_from_batch(
    batch_id: int,
    coin_ids: list[str],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coins = (
        db.query(Coin)
        .filter(Coin.coin_id.in_(coin_ids), Coin.batch_id == batch_id)
        .all()
    )
    for coin in coins:
        coin.batch_id = None
        coin.submission_status = "staged"
        coin.line_number_on_form = None

    db.commit()

    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    coin_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    return _batch_response(batch, coin_count)


@router.post("/{batch_id}/ship", response_model=BatchResponse)
def ship_batch(
    batch_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark batch shipped: set invoice + ship_date, cascade coins to 'shipped'."""
    from datetime import date as _date

    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    invoice_number = payload.get("invoice_number")
    ship_date_str = payload.get("ship_date")
    if not invoice_number:
        raise HTTPException(status_code=400, detail="invoice_number required")

    batch.invoice_number = invoice_number
    batch.shipped_date = _date.fromisoformat(ship_date_str) if ship_date_str else _date.today()

    db.query(Coin).filter(Coin.batch_id == batch_id).update(
        {"submission_status": "shipped", "submission_invoice_number": invoice_number,
         "ship_date": batch.shipped_date}
    )
    db.commit()
    db.refresh(batch)

    coin_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    return _batch_response(batch, coin_count)


@router.post("/{batch_id}/mark-at-grader", response_model=BatchResponse)
def mark_at_grader(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    db.query(Coin).filter(Coin.batch_id == batch_id).update(
        {"submission_status": "at_grader"}
    )
    db.commit()

    coin_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    return _batch_response(batch, coin_count)


@router.post("/{batch_id}/receive", response_model=BatchResponse)
def receive_batch(
    batch_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark batch returned from grader. Does NOT reconcile individual coins --
    that happens per-coin via /coins/{id}/reconcile as cert numbers are assigned."""
    from datetime import date as _date

    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    returned_date_str = payload.get("returned_date")
    batch.returned_date = (
        _date.fromisoformat(returned_date_str) if returned_date_str else _date.today()
    )

    # Only flip coins that haven't been individually reconciled yet
    db.query(Coin).filter(
        Coin.batch_id == batch_id, Coin.actual_grade.is_(None)
    ).update({"submission_status": "graded"})
    db.commit()
    db.refresh(batch)

    coin_count = db.query(Coin).filter(Coin.batch_id == batch_id).count()
    return _batch_response(batch, coin_count)


@router.delete("/{batch_id}", status_code=204)
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Unstage all coins in this batch
    db.query(Coin).filter(Coin.batch_id == batch_id).update(
        {"batch_id": None, "submission_status": "staged", "line_number_on_form": None}
    )
    db.delete(batch)
    db.commit()
