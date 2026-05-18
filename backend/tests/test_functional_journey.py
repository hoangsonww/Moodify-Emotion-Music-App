"""End-to-end functional test: a complete user journey through the real API.

Every step goes through the full Django + DRF stack (URL routing,
middleware, the MongoJWT authenticator, mongoengine documents on an
in-memory MongoDB). Nothing is mocked.
"""

from rest_framework.test import APIClient

from users.documents import User


def test_full_user_journey(api_client, make_user):
    # 1. Register a new account.
    reg = api_client.post(
        "/users/register/",
        {"username": "journey", "password": "password123", "email": "journey@example.com"},
        format="json",
    )
    assert reg.status_code == 201

    # 2. Log in -> receive an access + refresh token pair.
    login = api_client.post(
        "/users/login/",
        {"username": "journey", "password": "password123"},
        format="json",
    )
    assert login.status_code == 200
    access, refresh = login.data["access"], login.data["refresh"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    # 3. The access token validates.
    assert api_client.get("/users/validate_token/").status_code == 200

    # 4. Registration created the profile.
    profile = api_client.get("/users/user/profile/")
    assert profile.status_code == 200
    assert profile.data["username"] == "journey"
    assert profile.data["email"] == "journey@example.com"
    pid = profile.data["id"]

    # 5. Mood history round-trips.
    assert api_client.post(f"/users/mood_history/{pid}/", {"mood": "joy"}, format="json").status_code == 201
    assert api_client.get(f"/users/mood_history/{pid}/").data["mood_history"] == ["joy"]

    # 6. Listening history round-trips.
    assert (
        api_client.post(
            f"/users/listening_history/{pid}/", {"track": "Song A"}, format="json"
        ).status_code
        == 201
    )
    assert api_client.get(f"/users/listening_history/{pid}/").data["listening_history"] == ["Song A"]

    # 7. Recommendations round-trip.
    track = {"name": "Song A", "artist": "Artist", "external_url": "https://example/x"}
    assert (
        api_client.post(
            f"/users/recommendations/{pid}/", {"recommendations": [track]}, format="json"
        ).status_code
        == 201
    )
    assert len(api_client.get(f"/users/recommendations/{pid}/").data["recommendations"]) == 1

    # 8. The refresh token yields a fresh access token that still works.
    refreshed = api_client.post("/users/token/refresh/", {"refresh": refresh}, format="json")
    assert refreshed.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
    assert api_client.get("/users/user/profile/").status_code == 200

    # 9. Another user cannot read this user's history.
    make_user(username="intruder", email="intruder@example.com")
    from users.tokens import issue_tokens

    intruder = APIClient()
    intruder.credentials(
        HTTP_AUTHORIZATION=f"Bearer {issue_tokens(User.objects(username='intruder').first())['access']}"
    )
    assert intruder.get(f"/users/mood_history/{pid}/").status_code == 403

    # 10. Unauthenticated access is refused.
    anon = APIClient()
    assert anon.get("/users/user/profile/").status_code in (401, 403)

    # 11. Account deletion removes the user and the profile.
    assert api_client.delete("/users/user/profile/delete/").status_code == 200
    assert User.objects(username="journey").first() is None

    # 12. The deleted user can no longer authenticate.
    relogin = api_client.post(
        "/users/login/", {"username": "journey", "password": "password123"}, format="json"
    )
    assert relogin.status_code == 401
