from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Coin, CoinIdSequence, User
from schemas import (
    CoinCreate,
    CoinReconcile,
    CoinResponse,
    CoinUpdate,
    CoinWager,
    Denomination,
    Grader,
    SubmissionStatus,
)

router = APIRouter(prefix="/coins", tags=["Coins"])


def generate_coin_id(db: Session, denomination: str, year: int) -> str:
    """Atomically generate the next coin_id for a (denomination, year) pair."""
    seq_row = (
        db.query(CoinIdSequence)
        .filter(
            CoinIdSequence.denomination == denomination,
            CoinIdSequence.year == year,
        )
        .with_for_update()
        .first()
    )

    if seq_row is None:
        seq_row = CoinIdSequence(denomination=denomination, year=year, next_seq=1)
        db.add(seq_row)
        db.flush()

    coin_id = f"{denomination}-{year}-{seq_row.next_seq:03d}"
    seq_row.next_seq += 1
    db.flush()
    return coin_id


@router.post("/", response_model=CoinResponse, status_code=201)
def create_coin(
    payload: CoinCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coin_id = generate_coin_id(db, payload.denomination.value, payload.year)

    coin = Coin(
        coin_id=coin_id,
        denomination=payload.denomination.value,
        year=payload.year,
        mint_mark=payload.mint_mark,
        km_number=payload.km_number,
        variety_code=payload.variety_code,
        variety_attribution_source=payload.variety_attribution_source,
        ngc_variety_attribution=payload.ngc_variety_attribution,
        pcgs_variety_attribution=payload.pcgs_variety_attribution,
        source=payload.source,
        acquisition_date=payload.acquisition_date,
        paid_usd=payload.paid_usd,
        raw_grade_estimate=payload.raw_grade_estimate,
        problem_flags=payload.problem_flags,
        details_risk=payload.details_risk,
        predicted_grade_hand=payload.predicted_grade_hand,
        predicted_details_hand=payload.predicted_details_hand,
        confidence_hand=payload.confidence_hand.value if payload.confidence_hand else None,
        prediction_date_hand=datetime.now() if payload.predicted_grade_hand else None,
        grader=payload.grader.value,
        tier=payload.tier,
        declared_value_usd=payload.declared_value_usd,
        variety_plus_requested=payload.variety_plus_requested,
        notes=payload.notes,
    )
    db.add(coin)
    db.commit()
    db.refresh(coin)
    return coin


@router.get("/", response_model=list[CoinResponse])
def list_coins(
    denomination: Denomination | None = None,
    year: int | None = None,
    grader: Grader | None = None,
    submission_status: SubmissionStatus | None = None,
    batch_id: int | None = None,
    needs_wager: bool | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Coin)

    if denomination:
        query = query.filter(Coin.denomination == denomination.value)
    if year:
        query = query.filter(Coin.year == year)
    if grader:
        query = query.filter(Coin.grader == grader.value)
    if submission_status:
        query = query.filter(Coin.submission_status == submission_status.value)
    if batch_id is not None:
        query = query.filter(Coin.batch_id == batch_id)
    if needs_wager is True:
        query = query.filter(Coin.predicted_grade_hand.is_(None))
    elif needs_wager is False:
        query = query.filter(Coin.predicted_grade_hand.isnot(None))

    return query.order_by(Coin.date_added.desc()).offset(offset).limit(limit).all()


@router.get("/count")
def count_coins(
    denomination: Denomination | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(sa_func.count(Coin.coin_id))
    if denomination:
        query = query.filter(Coin.denomination == denomination.value)
    if year:
        query = query.filter(Coin.year == year)
    return {"count": query.scalar()}


@router.get("/{coin_id}", response_model=CoinResponse)
def get_coin(
    coin_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coin = db.query(Coin).filter(Coin.coin_id == coin_id).first()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")
    return coin


@router.put("/{coin_id}", response_model=CoinResponse)
def update_coin(
    coin_id: str,
    payload: CoinUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coin = db.query(Coin).filter(Coin.coin_id == coin_id).first()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Wager immutability: cannot change hand prediction via general update
    for protected in ("predicted_grade_hand", "predicted_details_hand", "confidence_hand"):
        if protected in update_data:
            raise HTTPException(
                status_code=400,
                detail=f"Use POST /{coin_id}/wager to set grade predictions",
            )

    # Set screen prediction timestamp if screen grade is being set for the first time
    if (
        "predicted_grade_screen" in update_data
        and update_data["predicted_grade_screen"]
        and not coin.prediction_date_screen
    ):
        update_data["prediction_date_screen"] = datetime.now()

    for field, value in update_data.items():
        setattr(coin, field, value)

    db.commit()
    db.refresh(coin)
    return coin


@router.post("/{coin_id}/wager", response_model=CoinResponse)
def set_wager(
    coin_id: str,
    payload: CoinWager,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coin = db.query(Coin).filter(Coin.coin_id == coin_id).first()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")

    if coin.predicted_grade_hand is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Wager already locked for {coin_id}: {coin.predicted_grade_hand} ({coin.confidence_hand}). Wagers are immutable.",
        )

    coin.predicted_grade_hand = payload.predicted_grade_hand
    coin.predicted_details_hand = payload.predicted_details_hand
    coin.confidence_hand = payload.confidence_hand.value
    coin.prediction_date_hand = datetime.now()

    if payload.raw_grade_estimate:
        coin.raw_grade_estimate = payload.raw_grade_estimate
    if payload.details_risk:
        coin.details_risk = payload.details_risk

    db.commit()
    db.refresh(coin)
    return coin


@router.post("/{coin_id}/reconcile", response_model=CoinResponse)
def reconcile_coin(
    coin_id: str,
    payload: CoinReconcile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coin = db.query(Coin).filter(Coin.coin_id == coin_id).first()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")

    coin.cert_number = payload.cert_number
    coin.actual_grade = payload.actual_grade
    coin.actual_details = payload.actual_details
    coin.return_date = payload.return_date or datetime.now().date()
    coin.submission_status = "returned"

    db.commit()
    db.refresh(coin)
    return coin


@router.delete("/{coin_id}", status_code=204)
def delete_coin(
    coin_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    coin = db.query(Coin).filter(Coin.coin_id == coin_id).first()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")
    db.delete(coin)
    db.commit()
