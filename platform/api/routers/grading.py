"""Grading service endpoints: fee calculation, batch validation, CSV export."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from graders import ngc, pcgs
from models import Batch, Coin, User

router = APIRouter(prefix="/grading", tags=["Grading"])

GRADER_MODULES = {
    "NGC": ngc,
    "PCGS": pcgs,
}


def _get_grader(grader_name: str):
    module = GRADER_MODULES.get(grader_name)
    if not module:
        raise HTTPException(status_code=400, detail=f"Unknown grader: {grader_name}")
    return module


@router.post("/fees")
def calculate_fees(
    coin_ids: list[str],
    grader_name: str = "NGC",
    options: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    grader = _get_grader(grader_name)
    coins = db.query(Coin).filter(Coin.coin_id.in_(coin_ids)).all()
    if not coins:
        raise HTTPException(status_code=404, detail="No coins found")

    try:
        breakdown = grader.calculate_fees(coins, options)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))

    return {
        "grader": grader_name,
        "coin_count": breakdown.coin_count,
        "handling_fee": str(breakdown.handling_fee),
        "subtotal_coins": str(breakdown.subtotal_coins),
        "total": str(breakdown.total),
        "items": [
            {
                "coin_id": item.coin_id,
                "tier": item.tier,
                "base_fee": str(item.base_fee),
                "add_ons": {k: str(v) for k, v in item.add_ons.items()},
                "total": str(item.total),
            }
            for item in breakdown.coin_fees
        ],
    }


@router.post("/validate-batch/{batch_id}")
def validate_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    grader = _get_grader(batch.grader)
    coins = db.query(Coin).filter(Coin.batch_id == batch_id).all()

    try:
        errors = grader.validate_batch(coins)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))

    return {
        "batch_id": batch_id,
        "grader": batch.grader,
        "coin_count": len(coins),
        "valid": len(errors) == 0,
        "errors": errors,
    }


@router.get("/export-csv/{batch_id}")
def export_batch_csv(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    grader = _get_grader(batch.grader)
    coins = (
        db.query(Coin)
        .filter(Coin.batch_id == batch_id)
        .order_by(Coin.line_number_on_form)
        .all()
    )

    if not coins:
        raise HTTPException(status_code=400, detail="Batch has no coins")

    try:
        csv_content = grader.export_form_csv(coins)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))

    filename = f"batch_{batch_id}_{batch.grader}_submission.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
