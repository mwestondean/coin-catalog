from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from database import Base

# --- Enum values (match Postgres ENUMs in 001_initial_schema.sql) ---

DENOMINATIONS = ("20c", "10c", "50c", "un_peso", "5_peso", "8_reales")
CONFIDENCE_LEVELS = ("low", "medium", "high")
GRADERS = ("NGC", "PCGS", "Raw")
SUBMISSION_STATUSES = (
    "staged",
    "on_form",
    "shipped",
    "at_grader",
    "graded",
    "returned",
    "held_back",
)


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))


class Batch(Base):
    __tablename__ = "batches"

    batch_id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    grader = Column(
        Enum(*GRADERS, name="grader_enum", create_type=False), nullable=False
    )
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    shipped_date = Column(Date)
    returned_date = Column(Date)
    invoice_number = Column(Text)

    coins = relationship("Coin", back_populates="batch")


class Coin(Base):
    __tablename__ = "coins"

    # Identity & physical (1-10)
    coin_id = Column(Text, primary_key=True)
    denomination = Column(
        Enum(*DENOMINATIONS, name="denomination_enum", create_type=False),
        nullable=False,
    )
    date_added = Column(DateTime(timezone=True), server_default=func.now())
    year = Column(Integer, nullable=False)
    mint_mark = Column(Text)
    km_number = Column(Text)
    variety_code = Column(Text)
    variety_attribution_source = Column(Text)
    ngc_variety_attribution = Column(Text)
    pcgs_variety_attribution = Column(Text)

    # Provenance & cost (11-13)
    source = Column(Text)
    acquisition_date = Column(Date)
    paid_usd = Column(Numeric(10, 2))

    # Condition assessment (14-16)
    raw_grade_estimate = Column(Text)
    problem_flags = Column(ARRAY(Text), default=[])
    details_risk = Column(Boolean, default=False)

    # Imaging (17-19)
    obverse_image_path = Column(Text)
    reverse_image_path = Column(Text)
    image_capture_date = Column(DateTime(timezone=True))

    # Wager: hand prediction (20-23)
    predicted_grade_hand = Column(Text)
    predicted_details_hand = Column(Boolean)
    confidence_hand = Column(
        Enum(*CONFIDENCE_LEVELS, name="confidence_enum", create_type=False)
    )
    prediction_date_hand = Column(DateTime(timezone=True))

    # Wager: screen prediction (24-26)
    predicted_grade_screen = Column(Text)
    predicted_details_screen = Column(Boolean)
    prediction_date_screen = Column(DateTime(timezone=True))

    # Submission packet (27-34)
    grader = Column(
        Enum(*GRADERS, name="grader_enum", create_type=False),
        nullable=False,
        default="Raw",
    )
    submission_status = Column(
        Enum(*SUBMISSION_STATUSES, name="submission_status_enum", create_type=False),
        nullable=False,
        default="staged",
    )
    tier = Column(Text)
    declared_value_usd = Column(Numeric(10, 2))
    variety_plus_requested = Column(Boolean, default=False)
    submission_invoice_number = Column(Text)
    line_number_on_form = Column(Integer)
    ship_date = Column(Date)

    # Results (35-38)
    cert_number = Column(Text)
    actual_grade = Column(Text)
    actual_details = Column(Text)
    return_date = Column(Date)

    # Pop snapshots
    ngc_pop_at_submission = Column(Integer)
    pcgs_pop_at_submission = Column(Integer)

    # Misc
    notes = Column(Text)
    registry_set_id = Column(Text)
    reviewed_by_admin = Column(Boolean, nullable=False, default=False)

    # FK
    batch_id = Column(Integer, ForeignKey("batches.batch_id"))
    batch = relationship("Batch", back_populates="coins")

    __table_args__ = (
        CheckConstraint("year BETWEEN 1700 AND 2100", name="valid_year"),
        CheckConstraint(
            "line_number_on_form IS NULL OR line_number_on_form BETWEEN 1 AND 50",
            name="valid_line_number",
        ),
    )


class PopReference(Base):
    __tablename__ = "pop_reference"

    pop_id = Column(Integer, primary_key=True)
    km_number = Column(Text, nullable=False)
    year = Column(Integer, nullable=False)
    mint_mark = Column(Text)
    variety_code = Column(Text)
    ngc_total_pop = Column(Integer)
    ngc_top_pop_grade = Column(Text)
    ngc_top_pop_count = Column(Integer)
    pcgs_total_pop = Column(Integer)
    pcgs_top_pop_grade = Column(Text)
    pcgs_top_pop_count = Column(Integer)
    last_refreshed = Column(DateTime(timezone=True))


class VarietyReference(Base):
    __tablename__ = "variety_reference"

    variety_id = Column(Integer, primary_key=True)
    grader = Column(
        Enum(*GRADERS, name="grader_enum", create_type=False), nullable=False
    )
    denomination = Column(
        Enum(*DENOMINATIONS, name="denomination_enum", create_type=False),
        nullable=False,
    )
    year = Column(Integer, nullable=False)
    variety_code = Column(Text, nullable=False)
    official_name = Column(Text)
    description = Column(Text)
    source_url = Column(Text)
    added_date = Column(DateTime(timezone=True), server_default=func.now())


class CoinIdSequence(Base):
    __tablename__ = "coin_id_sequences"

    denomination = Column(
        Enum(*DENOMINATIONS, name="denomination_enum", create_type=False),
        primary_key=True,
    )
    year = Column(Integer, primary_key=True)
    next_seq = Column(Integer, nullable=False, default=1)
