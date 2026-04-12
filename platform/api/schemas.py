from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


# --- Enums ---


class Denomination(str, Enum):
    c20 = "20c"
    c10 = "10c"
    c50 = "50c"
    un_peso = "un_peso"
    p5 = "5_peso"
    reales8 = "8_reales"


class Confidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Grader(str, Enum):
    NGC = "NGC"
    PCGS = "PCGS"
    Raw = "Raw"


class SubmissionStatus(str, Enum):
    staged = "staged"
    on_form = "on_form"
    shipped = "shipped"
    at_grader = "at_grader"
    graded = "graded"
    returned = "returned"
    held_back = "held_back"


# --- Auth ---


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str
    password: str = Field(min_length=8)
    role: str = "user"


class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Coins ---


class CoinCreate(BaseModel):
    denomination: Denomination
    year: int = Field(ge=1700, le=2100)
    mint_mark: str | None = None
    km_number: str | None = None
    variety_code: str | None = None
    variety_attribution_source: str | None = None
    ngc_variety_attribution: str | None = None
    pcgs_variety_attribution: str | None = None
    source: str | None = None
    acquisition_date: date | None = None
    paid_usd: Decimal | None = None
    raw_grade_estimate: str | None = None
    problem_flags: list[str] = Field(default_factory=list)
    details_risk: bool = False
    predicted_grade_hand: str | None = None
    predicted_details_hand: bool | None = None
    confidence_hand: Confidence | None = None
    grader: Grader = Grader.Raw
    tier: str | None = None
    declared_value_usd: Decimal | None = None
    variety_plus_requested: bool = False
    notes: str | None = None


class CoinUpdate(BaseModel):
    mint_mark: str | None = None
    km_number: str | None = None
    variety_code: str | None = None
    variety_attribution_source: str | None = None
    ngc_variety_attribution: str | None = None
    pcgs_variety_attribution: str | None = None
    source: str | None = None
    acquisition_date: date | None = None
    paid_usd: Decimal | None = None
    raw_grade_estimate: str | None = None
    problem_flags: list[str] | None = None
    details_risk: bool | None = None
    predicted_grade_screen: str | None = None
    predicted_details_screen: bool | None = None
    grader: Grader | None = None
    submission_status: SubmissionStatus | None = None
    tier: str | None = None
    declared_value_usd: Decimal | None = None
    variety_plus_requested: bool | None = None
    submission_invoice_number: str | None = None
    line_number_on_form: int | None = Field(default=None, ge=1, le=50)
    ship_date: date | None = None
    notes: str | None = None
    batch_id: int | None = None


class CoinWager(BaseModel):
    """Lock in the grade prediction. Immutable once set."""
    predicted_grade_hand: str
    predicted_details_hand: bool = False
    confidence_hand: Confidence
    raw_grade_estimate: str | None = None
    details_risk: bool = False


class CoinReconcile(BaseModel):
    cert_number: str
    actual_grade: str
    actual_details: str | None = None
    return_date: date | None = None


class CoinResponse(BaseModel):
    coin_id: str
    denomination: str
    date_added: datetime
    year: int
    mint_mark: str | None
    km_number: str | None
    variety_code: str | None
    variety_attribution_source: str | None
    ngc_variety_attribution: str | None
    pcgs_variety_attribution: str | None
    source: str | None
    acquisition_date: date | None
    paid_usd: Decimal | None
    raw_grade_estimate: str | None
    problem_flags: list[str]
    details_risk: bool
    obverse_image_path: str | None
    reverse_image_path: str | None
    image_capture_date: datetime | None
    predicted_grade_hand: str | None
    predicted_details_hand: bool | None
    confidence_hand: str | None
    prediction_date_hand: datetime | None
    predicted_grade_screen: str | None
    predicted_details_screen: bool | None
    prediction_date_screen: datetime | None
    grader: str
    submission_status: str
    tier: str | None
    declared_value_usd: Decimal | None
    variety_plus_requested: bool
    submission_invoice_number: str | None
    line_number_on_form: int | None
    ship_date: date | None
    cert_number: str | None
    actual_grade: str | None
    actual_details: str | None
    return_date: date | None
    ngc_pop_at_submission: int | None
    pcgs_pop_at_submission: int | None
    notes: str | None
    registry_set_id: str | None
    batch_id: int | None
    reviewed_by_admin: bool

    model_config = {"from_attributes": True}


# --- Batches ---


class BatchCreate(BaseModel):
    name: str
    grader: Grader


class BatchUpdate(BaseModel):
    name: str | None = None
    shipped_date: date | None = None
    returned_date: date | None = None
    invoice_number: str | None = None


class BatchResponse(BaseModel):
    batch_id: int
    name: str
    grader: str
    created_date: datetime
    shipped_date: date | None
    returned_date: date | None
    invoice_number: str | None
    coin_count: int = 0

    model_config = {"from_attributes": True}


# --- Variety Reference ---


class VarietyReferenceCreate(BaseModel):
    grader: Grader
    denomination: Denomination
    year: int
    variety_code: str
    official_name: str | None = None
    description: str | None = None
    source_url: str | None = None


class VarietyReferenceResponse(BaseModel):
    variety_id: int
    grader: str
    denomination: str
    year: int
    variety_code: str
    official_name: str | None
    description: str | None
    source_url: str | None
    added_date: datetime

    model_config = {"from_attributes": True}
