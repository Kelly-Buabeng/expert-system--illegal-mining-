"""Verbatim rule functions from the original Flask backend (testbackend/prolog/kk.py).

Used only as a regression oracle: the rebuilt engine must agree with these
functions on every input for which they return a level. Where they return
``None`` (a gap in the original rules) the rebuilt engine's behaviour is
documented in the README and covered by explicit tests.
"""
# ruff: noqa
# mypy: ignore-errors


def risk_level(deforestation, turbidity, heavy_metals, soil_erosion, reports):
    if (
        deforestation >= 70
        and turbidity > 100
        and heavy_metals > 50
        and soil_erosion > 30
        and reports > 5
    ):
        return "High"
    elif (
        deforestation >= 70
        and turbidity > 100
        and heavy_metals > 50
        and soil_erosion > 30
        and reports <= 5
    ):
        return "Medium"
    elif deforestation < 70 and turbidity <= 100 and heavy_metals <= 50 and soil_erosion <= 30:
        return "Low"


def risk_level_pH_DO(pH, DO):
    if pH < 6.5 and DO < 4:
        return "High"
    elif pH < 6.5 or DO < 4:
        return "Medium"
    elif pH >= 6.5 and DO >= 4:
        return "Low"


def risk_level_biodiversity(biodiversity_loss):
    if biodiversity_loss > 50:
        return "High"
    elif 20 < biodiversity_loss <= 50:
        return "Medium"
    elif biodiversity_loss <= 20:
        return "Low"


def risk_level_air_quality(pm25):
    if pm25 > 150:
        return "High"
    elif 50 < pm25 <= 150:
        return "Medium"
    elif pm25 <= 50:
        return "Low"


def risk_level_noise(noise_level):
    if noise_level > 85:
        return "High"
    elif 60 < noise_level <= 85:
        return "Medium"
    elif noise_level <= 60:
        return "Low"


def risk_level_health(health_reports):
    if health_reports > 10:
        return "High"
    elif 5 < health_reports <= 10:
        return "Medium"
    elif health_reports <= 5:
        return "Low"


def overall_risk(risks):
    if "High" in risks:
        return "High"
    elif "Medium" in risks:
        return "Medium"
    elif all(risk == "Low" for risk in risks):
        return "Low"
