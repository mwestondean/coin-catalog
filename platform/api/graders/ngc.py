"""
NGC grader module.
Fee schedule verified March 17, 2026 via NGC Collector Pricing PDF.
Source: https://s3.amazonaws.com/ccg-corporate-production/pdfs/services-and-fees/ngc-us-ngc-en-us.pdf
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal


# --- Fee Schedule (verified March 17, 2026) ---

TIER_FEES: dict[str, Decimal] = {
    "Modern": Decimal("20"),
    "Economy": Decimal("25"),
    "Standard": Decimal("45"),
    "Gold": Decimal("45"),
    "Express": Decimal("80"),
    "WalkThrough": Decimal("175"),
}

TIER_MAX_VALUES: dict[str, Decimal | None] = {
    "Modern": Decimal("3000"),
    "Economy": None,
    "Standard": Decimal("3000"),
    "Gold": Decimal("5000"),
    "Express": Decimal("10000"),
    "WalkThrough": Decimal("25000"),
}

HANDLING_FEE = Decimal("10")  # Per invoice, not per coin

ADD_ON_FEES: dict[str, Decimal] = {
    "fast_track": Decimal("15"),
    "variety_plus": Decimal("20"),
    "mint_error": Decimal("20"),
    "internet_imaging": Decimal("5"),
    "photovision_plus": Decimal("8"),
    "pedigree": Decimal("5"),
    "special_label": Decimal("8"),
}

# Fast Track only available for these tiers
FAST_TRACK_ELIGIBLE_TIERS = {"Standard", "Economy", "Modern"}

MAX_COINS_PER_FORM = 50

# Required description fields per NGC rules
REQUIRED_DESCRIPTION_FIELDS = ["denomination", "year", "km_number"]


@dataclass
class CoinFeeItem:
    coin_id: str
    tier: str
    base_fee: Decimal
    add_ons: dict[str, Decimal] = field(default_factory=dict)

    @property
    def total(self) -> Decimal:
        return self.base_fee + sum(self.add_ons.values())


@dataclass
class FeeBreakdown:
    coin_fees: list[CoinFeeItem]
    handling_fee: Decimal = HANDLING_FEE

    @property
    def subtotal_coins(self) -> Decimal:
        return sum(item.total for item in self.coin_fees)

    @property
    def total(self) -> Decimal:
        return self.subtotal_coins + self.handling_fee

    @property
    def coin_count(self) -> int:
        return len(self.coin_fees)


def tier_for_coin(coin) -> str:
    """Determine NGC tier for a coin based on its attributes.

    For Mexican 20C 1905-1943: Economy tier ($25/coin).
    Non-gold world coins struck before 1990 qualify for Economy.
    """
    year = getattr(coin, "year", None)
    denomination = getattr(coin, "denomination", None)

    if year and year < 1990:
        # Gold denominations would go to Gold tier
        if denomination in ("5_peso",) and year < 1990:
            return "Gold"
        return "Economy"

    return "Standard"


def calculate_fees(coins: list, options: dict | None = None) -> FeeBreakdown:
    """Calculate itemized NGC fees for a list of coins.

    Args:
        coins: List of coin objects (need coin_id, year, denomination, variety_plus_requested)
        options: Optional dict with keys like 'fast_track', 'internet_imaging', etc.
    """
    opts = options or {}
    items = []

    for coin in coins:
        tier = getattr(coin, "tier", None) or tier_for_coin(coin)
        base_fee = TIER_FEES.get(tier, TIER_FEES["Standard"])

        add_ons: dict[str, Decimal] = {}

        if getattr(coin, "variety_plus_requested", False):
            add_ons["variety_plus"] = ADD_ON_FEES["variety_plus"]

        if opts.get("fast_track") and tier in FAST_TRACK_ELIGIBLE_TIERS:
            add_ons["fast_track"] = ADD_ON_FEES["fast_track"]

        if opts.get("internet_imaging"):
            add_ons["internet_imaging"] = ADD_ON_FEES["internet_imaging"]

        if opts.get("photovision_plus"):
            add_ons["photovision_plus"] = ADD_ON_FEES["photovision_plus"]

        if opts.get("pedigree"):
            add_ons["pedigree"] = ADD_ON_FEES["pedigree"]

        if opts.get("special_label"):
            add_ons["special_label"] = ADD_ON_FEES["special_label"]

        items.append(
            CoinFeeItem(
                coin_id=getattr(coin, "coin_id", "unknown"),
                tier=tier,
                base_fee=base_fee,
                add_ons=add_ons,
            )
        )

    return FeeBreakdown(coin_fees=items)


def validate_description(coin) -> list[str]:
    """Validate that a coin has all required NGC description fields.

    Missing description = $5/coin attribution penalty applied to ENTIRE form.
    """
    errors = []

    denomination = getattr(coin, "denomination", None)
    if not denomination:
        errors.append("Denomination is required")

    year = getattr(coin, "year", None)
    if not year:
        errors.append("Year is required")

    km_number = getattr(coin, "km_number", None)
    if not km_number:
        errors.append("KM number is required for NGC attribution")

    return errors


def validate_batch(coins: list) -> list[str]:
    """Validate a batch of coins for NGC submission rules."""
    errors = []

    if len(coins) > MAX_COINS_PER_FORM:
        errors.append(
            f"Batch has {len(coins)} coins, max {MAX_COINS_PER_FORM} per form"
        )

    for coin in coins:
        coin_errors = validate_description(coin)
        if coin_errors:
            coin_id = getattr(coin, "coin_id", "unknown")
            for err in coin_errors:
                errors.append(f"{coin_id}: {err}")

    return errors


def export_form_csv(coins: list) -> str:
    """Export coins as CSV mapped to NGC submission form field order.

    Returns CSV string ready for download.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Line #",
        "Quantity",
        "Country",
        "Denomination",
        "Year/Date",
        "Mint Mark",
        "KM Number",
        "Variety/Attribution",
        "Tier",
        "Declared Value (USD)",
        "VarietyPlus",
        "Notes",
    ])

    for i, coin in enumerate(coins, 1):
        line_num = getattr(coin, "line_number_on_form", i) or i
        writer.writerow([
            line_num,
            1,
            "Mexico",
            getattr(coin, "denomination", ""),
            getattr(coin, "year", ""),
            getattr(coin, "mint_mark", "") or "",
            getattr(coin, "km_number", "") or "",
            getattr(coin, "variety_code", "") or "",
            getattr(coin, "tier", "") or tier_for_coin(coin),
            getattr(coin, "declared_value_usd", "") or "",
            "Yes" if getattr(coin, "variety_plus_requested", False) else "No",
            getattr(coin, "notes", "") or "",
        ])

    return output.getvalue()
