from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, VarietyReference
from schemas import Denomination, Grader, VarietyReferenceCreate, VarietyReferenceResponse

router = APIRouter(prefix="/varieties", tags=["Variety Reference"])


@router.post("/", response_model=VarietyReferenceResponse, status_code=201)
def create_variety(
    payload: VarietyReferenceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = (
        db.query(VarietyReference)
        .filter(
            VarietyReference.grader == payload.grader.value,
            VarietyReference.denomination == payload.denomination.value,
            VarietyReference.year == payload.year,
            VarietyReference.variety_code == payload.variety_code,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Variety already exists for this grader/denomination/year/code combination",
        )

    variety = VarietyReference(
        grader=payload.grader.value,
        denomination=payload.denomination.value,
        year=payload.year,
        variety_code=payload.variety_code,
        official_name=payload.official_name,
        description=payload.description,
        source_url=payload.source_url,
    )
    db.add(variety)
    db.commit()
    db.refresh(variety)
    return variety


@router.get("/", response_model=list[VarietyReferenceResponse])
def list_varieties(
    grader: Grader | None = None,
    denomination: Denomination | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(VarietyReference)
    if grader:
        query = query.filter(VarietyReference.grader == grader.value)
    if denomination:
        query = query.filter(VarietyReference.denomination == denomination.value)
    if year:
        query = query.filter(VarietyReference.year == year)
    return query.order_by(VarietyReference.year, VarietyReference.variety_code).all()


@router.get("/autocomplete")
def autocomplete_varieties(
    q: str = Query(min_length=1),
    denomination: Denomination | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(VarietyReference).filter(
        VarietyReference.variety_code.ilike(f"%{q}%")
    )
    if denomination:
        query = query.filter(VarietyReference.denomination == denomination.value)
    if year:
        query = query.filter(VarietyReference.year == year)
    results = query.limit(20).all()
    return [
        {
            "variety_code": v.variety_code,
            "official_name": v.official_name,
            "grader": v.grader,
        }
        for v in results
    ]


@router.delete("/{variety_id}", status_code=204)
def delete_variety(
    variety_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    variety = (
        db.query(VarietyReference)
        .filter(VarietyReference.variety_id == variety_id)
        .first()
    )
    if not variety:
        raise HTTPException(status_code=404, detail="Variety not found")
    db.delete(variety)
    db.commit()
