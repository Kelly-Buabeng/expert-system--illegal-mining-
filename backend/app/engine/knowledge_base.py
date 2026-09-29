"""The illegal-mining pollution knowledge base.

Thresholds are carried over unchanged from the original Prolog rules
(``illegaiminingsystem.pl``) and their Flask port. The only rule added is R1.4,
which closes a gap in the original factor 1 rules (see README, "Behaviour
changes").
"""

from __future__ import annotations

from .model import Condition, Factor, Indicator, RiskLevel, Rule

RULESET_VERSION = "2"

LOW, MEDIUM, HIGH = RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH

ROUTINE_MONITORING = "No action needed beyond routine monitoring."

INDICATORS: tuple[Indicator, ...] = (
    Indicator(
        key="deforestation",
        label="Deforestation",
        unit="%",
        kind="decimal",
        minimum=0,
        maximum=100,
        description="Share of forest cover lost in the assessed area.",
    ),
    Indicator(
        key="turbidity",
        label="Water turbidity",
        unit="NTU",
        kind="decimal",
        minimum=0,
        maximum=10_000,
        description="Cloudiness of nearby surface water.",
    ),
    Indicator(
        key="heavy_metals",
        label="Heavy metal concentration",
        unit="ppb",
        kind="decimal",
        minimum=0,
        maximum=100_000,
        description="Combined heavy metals (e.g. mercury, lead, arsenic) measured in water.",
    ),
    Indicator(
        key="soil_erosion",
        label="Soil erosion",
        unit="%",
        kind="decimal",
        minimum=0,
        maximum=100,
        description="Share of the assessed land showing active erosion.",
    ),
    Indicator(
        key="reports",
        label="Community reports",
        unit="reports",
        kind="integer",
        minimum=0,
        maximum=100_000,
        description="Reports of illegal mining activity received from the community.",
    ),
    Indicator(
        key="ph",
        label="Water pH",
        unit="pH",
        kind="decimal",
        minimum=0,
        maximum=14,
        description="Acidity of nearby surface water.",
    ),
    Indicator(
        key="dissolved_oxygen",
        label="Dissolved oxygen",
        unit="mg/L",
        kind="decimal",
        minimum=0,
        maximum=50,
        description="Oxygen available to aquatic life.",
    ),
    Indicator(
        key="biodiversity_loss",
        label="Biodiversity loss",
        unit="%",
        kind="decimal",
        minimum=0,
        maximum=100,
        description="Estimated decline in local species compared with baseline surveys.",
    ),
    Indicator(
        key="pm25",
        label="PM2.5",
        unit="µg/m³",
        kind="decimal",
        minimum=0,
        maximum=2_000,
        description="Fine particulate matter in the air.",
    ),
    Indicator(
        key="noise_level",
        label="Noise level",
        unit="dB",
        kind="decimal",
        minimum=0,
        maximum=200,
        description="Typical noise level near the site.",
    ),
    Indicator(
        key="health_reports",
        label="Health reports",
        unit="reports",
        kind="integer",
        minimum=0,
        maximum=100_000,
        description="Pollution-related health complaints recorded in the community.",
    ),
)

FACTORS: tuple[Factor, ...] = (
    Factor(
        id="land_water",
        name="Deforestation and pollution",
        description=(
            "Combined evidence of land clearing and river pollution, weighted by how "
            "often the community reports mining activity."
        ),
        indicators=("deforestation", "turbidity", "heavy_metals", "soil_erosion", "reports"),
        rules=(
            Rule(
                "R1.1",
                HIGH,
                (
                    Condition("deforestation", ">=", 70),
                    Condition("turbidity", ">", 100),
                    Condition("heavy_metals", ">", 50),
                    Condition("soil_erosion", ">", 30),
                    Condition("reports", ">", 5),
                ),
            ),
            Rule(
                "R1.2",
                MEDIUM,
                (
                    Condition("deforestation", ">=", 70),
                    Condition("turbidity", ">", 100),
                    Condition("heavy_metals", ">", 50),
                    Condition("soil_erosion", ">", 30),
                    Condition("reports", "<=", 5),
                ),
            ),
            Rule(
                "R1.3",
                LOW,
                (
                    Condition("deforestation", "<", 70),
                    Condition("turbidity", "<=", 100),
                    Condition("heavy_metals", "<=", 50),
                    Condition("soil_erosion", "<=", 30),
                ),
            ),
            Rule(
                "R1.4",
                MEDIUM,
                (
                    Condition("deforestation", ">=", 70),
                    Condition("turbidity", ">", 100),
                    Condition("heavy_metals", ">", 50),
                    Condition("soil_erosion", ">", 30),
                ),
                match="any",
                note=(
                    "Covers readings where some, but not all, land and water indicators "
                    "are past their limits. The original rules gave no result here."
                ),
            ),
        ),
        recommendations={
            HIGH: (
                "Refer the site to the regulator for enforcement, stop excavation and "
                "start planning water treatment and land reclamation."
            ),
            MEDIUM: ("Inspect the site and increase sampling of river turbidity and heavy metals."),
            LOW: ROUTINE_MONITORING,
        },
    ),
    Factor(
        id="water_chemistry",
        name="pH and dissolved oxygen",
        description="Acidic water and low oxygen both point to mining run-off.",
        indicators=("ph", "dissolved_oxygen"),
        rules=(
            Rule(
                "R2.1",
                HIGH,
                (
                    Condition("ph", "<", 6.5),
                    Condition("dissolved_oxygen", "<", 4),
                ),
            ),
            Rule(
                "R2.2",
                MEDIUM,
                (
                    Condition("ph", "<", 6.5),
                    Condition("dissolved_oxygen", "<", 4),
                ),
                match="any",
            ),
            Rule(
                "R2.3",
                LOW,
                (
                    Condition("ph", ">=", 6.5),
                    Condition("dissolved_oxygen", ">=", 4),
                ),
            ),
        ),
        recommendations={
            HIGH: (
                "Advise residents not to drink or fish from affected water and arrange "
                "an alternative water supply."
            ),
            MEDIUM: "Retest water chemistry and check for upstream discharge points.",
            LOW: ROUTINE_MONITORING,
        },
    ),
    Factor(
        id="biodiversity",
        name="Biodiversity loss",
        description="Decline in local species compared with baseline surveys.",
        indicators=("biodiversity_loss",),
        rules=(
            Rule("R3.1", HIGH, (Condition("biodiversity_loss", ">", 50),)),
            Rule(
                "R3.2",
                MEDIUM,
                (
                    Condition("biodiversity_loss", ">", 20),
                    Condition("biodiversity_loss", "<=", 50),
                ),
            ),
            Rule("R3.3", LOW, (Condition("biodiversity_loss", "<=", 20),)),
        ),
        recommendations={
            HIGH: "Commission an ecological survey and plan habitat restoration.",
            MEDIUM: "Repeat species surveys to confirm the trend.",
            LOW: ROUTINE_MONITORING,
        },
    ),
    Factor(
        id="air_quality",
        name="Air quality",
        description="Dust from excavation and processing, measured as PM2.5.",
        indicators=("pm25",),
        rules=(
            Rule("R4.1", HIGH, (Condition("pm25", ">", 150),)),
            Rule(
                "R4.2",
                MEDIUM,
                (
                    Condition("pm25", ">", 50),
                    Condition("pm25", "<=", 150),
                ),
            ),
            Rule("R4.3", LOW, (Condition("pm25", "<=", 50),)),
        ),
        recommendations={
            HIGH: "Issue an air quality advisory and require dust suppression on site.",
            MEDIUM: "Monitor air quality near homes and schools.",
            LOW: ROUTINE_MONITORING,
        },
    ),
    Factor(
        id="noise",
        name="Noise pollution",
        description="Noise from machinery and dredging.",
        indicators=("noise_level",),
        rules=(
            Rule("R5.1", HIGH, (Condition("noise_level", ">", 85),)),
            Rule(
                "R5.2",
                MEDIUM,
                (
                    Condition("noise_level", ">", 60),
                    Condition("noise_level", "<=", 85),
                ),
            ),
            Rule("R5.3", LOW, (Condition("noise_level", "<=", 60),)),
        ),
        recommendations={
            HIGH: "Restrict operating hours and require noise barriers.",
            MEDIUM: "Log noise complaints and measure levels at night.",
            LOW: ROUTINE_MONITORING,
        },
    ),
    Factor(
        id="community_health",
        name="Community health",
        description="Pollution-related health complaints in the community.",
        indicators=("health_reports",),
        rules=(
            Rule("R6.1", HIGH, (Condition("health_reports", ">", 10),)),
            Rule(
                "R6.2",
                MEDIUM,
                (
                    Condition("health_reports", ">", 5),
                    Condition("health_reports", "<=", 10),
                ),
            ),
            Rule("R6.3", LOW, (Condition("health_reports", "<=", 5),)),
        ),
        recommendations={
            HIGH: "Notify district health services and arrange community health screening.",
            MEDIUM: "Share the reports with the local health clinic for follow-up.",
            LOW: ROUTINE_MONITORING,
        },
    ),
)

INDICATORS_BY_KEY: dict[str, Indicator] = {indicator.key: indicator for indicator in INDICATORS}
