"""
PCGS grader module -- STUB.

Architecture is ready. Implementation deferred until Weston is ready
to submit to PCGS. When that time comes:

1. Research PCGS submission rules and fee schedule
2. Implement the four interface functions below
3. No architecture changes needed; this file is the only touchpoint

See graders/__init__.py for the common interface contract.
"""


def tier_for_coin(coin) -> str:
    raise NotImplementedError(
        "PCGS grader module is not yet implemented. "
        "See graders/pcgs.py for implementation notes."
    )


def calculate_fees(coins: list, options: dict | None = None):
    raise NotImplementedError(
        "PCGS fee calculation is not yet implemented. "
        "NGC module (graders/ngc.py) is the reference implementation."
    )


def validate_description(coin) -> list[str]:
    raise NotImplementedError(
        "PCGS description validation is not yet implemented."
    )


def export_form_csv(coins: list) -> str:
    raise NotImplementedError(
        "PCGS form export is not yet implemented."
    )
