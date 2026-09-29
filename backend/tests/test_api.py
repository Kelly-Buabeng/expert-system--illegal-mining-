from __future__ import annotations

from pathlib import Path

from flask.testing import FlaskClient

from app import create_app

from .conftest import assessment_payload


def create(client: FlaskClient, community: str = "Tarkwa", **overrides: float) -> dict:
    response = client.post("/api/assessments", json=assessment_payload(community, **overrides))
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_health(client: FlaskClient) -> None:
    assert client.get("/api/health").get_json() == {"status": "ok"}


def test_knowledge_base_describes_indicators_and_rules(client: FlaskClient) -> None:
    data = client.get("/api/knowledge-base").get_json()
    assert data["ruleset_version"] == "2"
    assert data["risk_levels"] == ["Low", "Medium", "High"]
    assert len(data["indicators"]) == 11
    assert [f["id"] for f in data["factors"]] == [
        "land_water", "water_chemistry", "biodiversity", "air_quality", "noise", "community_health",
    ]  # fmt: skip
    first_rule = data["factors"][0]["rules"][0]
    assert first_rule["id"] == "R1.1"
    assert first_rule["conditions"][0] == {
        "indicator": "deforestation",
        "operator": ">=",
        "threshold": 70,
    }
    assert set(data["factors"][0]["recommendations"]) == {"Low", "Medium", "High"}


def test_create_evaluates_and_persists(client: FlaskClient) -> None:
    response = client.post(
        "/api/assessments",
        json=assessment_payload("Tarkwa", pm25=180, noise_level=70),
    )
    assert response.status_code == 201
    record = response.get_json()
    assert response.headers["Location"] == f"/api/assessments/{record['id']}"
    assert record["community"] == "Tarkwa"
    assert record["overall_risk"] == "High"
    assert record["evaluation"]["drivers"] == ["air_quality"]
    assert record["observations"]["pm25"] == 180
    assert record["created_at"].endswith("+00:00")

    fetched = client.get(f"/api/assessments/{record['id']}").get_json()
    assert fetched == record


def test_create_rejects_invalid_input_with_field_errors(client: FlaskClient) -> None:
    payload = assessment_payload(ph=15)
    payload["community"] = " "
    response = client.post("/api/assessments", json=payload)
    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "validation_error"
    assert error["fields"] == {
        "community": "Enter the community name.",
        "observations.ph": "Must be between 0 and 14.",
    }
    assert client.get("/api/assessments").get_json()["total"] == 0


def test_create_requires_json(client: FlaskClient) -> None:
    response = client.post("/api/assessments", data="community=x")
    assert response.status_code == 415
    assert response.get_json()["error"]["code"] == "unsupported_media_type"


def test_create_rejects_malformed_json(client: FlaskClient) -> None:
    response = client.post("/api/assessments", data="{not json", content_type="application/json")
    assert response.status_code == 400
    assert response.get_json()["error"]["fields"] == {"body": "Request body must be a JSON object."}


def test_create_rejects_oversized_body(client: FlaskClient) -> None:
    payload = assessment_payload()
    payload["notes"] = "x" * 70_000
    response = client.post("/api/assessments", json=payload)
    assert response.status_code == 413
    assert response.get_json()["error"]["code"] == "request_entity_too_large"


def test_missing_assessment_is_404(client: FlaskClient) -> None:
    response = client.get("/api/assessments/999")
    assert response.status_code == 404
    assert response.get_json()["error"] == {
        "code": "not_found",
        "message": "Assessment 999 does not exist.",
    }


def test_unknown_api_route_and_method_return_json(client: FlaskClient) -> None:
    assert client.get("/api/nope").get_json()["error"]["code"] == "not_found"
    response = client.delete("/api/assessments/1")
    assert response.status_code == 405
    assert response.get_json()["error"]["code"] == "method_not_allowed"


def test_list_is_newest_first_with_summaries(client: FlaskClient) -> None:
    first = create(client, "Tarkwa")
    second = create(client, "Obuasi", health_reports=20)
    data = client.get("/api/assessments").get_json()
    assert data["total"] == 2
    assert [item["id"] for item in data["items"]] == [second["id"], first["id"]]
    assert data["items"][0]["overall_risk"] == "High"
    assert data["items"][0]["factor_levels"]["community_health"] == "High"
    assert "observations" not in data["items"][0]


def test_list_filters_and_paginates(client: FlaskClient) -> None:
    create(client, "Tarkwa", pm25=200)
    create(client, "Tarkwa Nsuaem", pm25=80)
    create(client, "Obuasi", pm25=200)
    create(client, "100%_club")

    def ids(query: str) -> list[str]:
        return [i["community"] for i in client.get(f"/api/assessments?{query}").get_json()["items"]]

    assert ids("q=tarkwa") == ["Tarkwa Nsuaem", "Tarkwa"]
    assert ids("risk=High") == ["Obuasi", "Tarkwa"]
    assert ids("q=tarkwa&risk=High") == ["Tarkwa"]
    # LIKE wildcards in the search term are matched literally.
    assert ids("q=%25") == ["100%_club"]
    assert ids("q=_") == ["100%_club"]

    page = client.get("/api/assessments?limit=2&offset=2").get_json()
    assert page["total"] == 4 and page["limit"] == 2 and page["offset"] == 2
    assert [i["community"] for i in page["items"]] == ["Tarkwa Nsuaem", "Tarkwa"]


def test_list_rejects_bad_query_parameters(client: FlaskClient) -> None:
    for query, field in [("risk=Severe", "risk"), ("limit=0", "limit"), ("offset=x", "offset")]:
        response = client.get(f"/api/assessments?{query}")
        assert response.status_code == 400
        assert field in response.get_json()["error"]["fields"]


def test_communities_are_distinct_and_most_recent_first(client: FlaskClient) -> None:
    create(client, "Tarkwa")
    create(client, "Obuasi")
    create(client, "tarkwa")
    assert client.get("/api/communities").get_json() == {"items": ["tarkwa", "Obuasi"]}


def test_data_survives_app_restart(tmp_path: Path) -> None:
    config = {"DATABASE_PATH": str(tmp_path / "persist.db"), "LOG_LEVEL": "WARNING"}
    record = create(create_app(config).test_client(), "Dunkwa")
    restarted = create_app(config).test_client()
    assert restarted.get(f"/api/assessments/{record['id']}").get_json() == record


def test_serves_built_frontend_with_spa_fallback(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<div id=root></div>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    client = create_app(
        {"DATABASE_PATH": str(tmp_path / "t.db"), "FRONTEND_DIST": str(dist)}
    ).test_client()
    assert b"console.log" in client.get("/assets/app.js").data
    assert b"id=root" in client.get("/assessments/12").data
    assert client.get("/api/unknown").status_code == 404
