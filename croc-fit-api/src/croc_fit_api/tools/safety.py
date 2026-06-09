"""Safety guard for health-domain messages (REQ-023, REQ-024)."""

from dataclasses import dataclass

# Red-flag keywords that indicate potential medical/injury context.
# Case-insensitive matching is applied at check time.
_RED_FLAG_TERMS: frozenset[str] = frozenset(
    [
        # injuries
        "dolore acuto",
        "dolore forte",
        "dolore al petto",
        "fianco",
        "infortun",
        "strappo",
        "rottur",
        "lesion",
        "gonfiore",
        "frattur",
        # medical
        "diagnosi",
        "diagnosi medica",
        "farmaci",
        "farmaco",
        "medicinali",
        "medicinale",
        "prescrizione",
        "prescrivi",
        "mal di testa",
        "vertigini",
        "nausea",
        "svenimento",
        "perdita di coscienza",
        # English equivalents
        "sharp pain",
        "chest pain",
        "injury",
        "diagnose",
        "prescription",
        "medication",
        "dizziness",
        "fainted",
        "loss of consciousness",
    ]
)

SAFETY_DISCLAIMER = (
    "\n\n---\n"
    "⚠️ **Attenzione**: questo messaggio contiene riferimenti a sintomi fisici o "
    "condizioni di salute. Le indicazioni dell'AI coach riguardano esclusivamente "
    "l'allenamento e la nutrizione sportiva, **non sostituiscono** una valutazione "
    "medica. In caso di dolore acuto, infortuni o sintomi preoccupanti, consulta "
    "immediatamente un professionista della salute."
)


@dataclass(frozen=True)
class SafetyCheckResult:
    """Result of a safety pre-check on user input.

    Attributes:
        has_red_flag: True if the message contains a red-flag health term.
        matched_terms: Tuple of matched terms (empty if no match).
        disclaimer: Disclaimer string to prepend to response (empty if no flag).
    """

    has_red_flag: bool
    matched_terms: tuple[str, ...]
    disclaimer: str


def check_safety(message: str) -> SafetyCheckResult:
    """Scan a user message for health/injury red-flag terms (REQ-023).

    Does a case-insensitive substring search against a curated list of
    medical and injury keywords. Returns a result with a disclaimer string
    when a match is found; the disclaimer must be appended to the agent
    response before streaming.

    No medical diagnosis or prescription is ever provided (REQ-024).

    Args:
        message: The raw user message text to scan.

    Returns:
        SafetyCheckResult with has_red_flag, matched_terms, and disclaimer.
    """
    lower = message.lower()
    matched = tuple(term for term in _RED_FLAG_TERMS if term in lower)
    if matched:
        return SafetyCheckResult(
            has_red_flag=True,
            matched_terms=matched,
            disclaimer=SAFETY_DISCLAIMER,
        )
    return SafetyCheckResult(has_red_flag=False, matched_terms=(), disclaimer="")
