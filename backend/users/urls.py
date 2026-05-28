from django.urls import path

from .passkey_views import (
    passkey_detail,
    passkey_list,
    passkey_login_begin,
    passkey_login_complete,
    passkey_register_begin,
    passkey_register_complete,
)
from .views import (
    delete_all_recommendations,
    get_recommendations,
    login,
    register,
    reset_password,
    save_recommendations,
    token_refresh,
    user_listening_history,
    user_mood_history,
    user_profile,
    user_profile_delete,
    user_profile_update,
    user_recommendations,
    validate_token,
    verify_username_email,
)

urlpatterns = [
    path("register/", register, name="register"),
    path("login/", login, name="login"),
    path("token/refresh/", token_refresh, name="token_refresh"),
    path("validate_token/", validate_token, name="validate_token"),
    path("verify-username-email/", verify_username_email, name="verify_username_email"),
    path("reset-password/", reset_password, name="reset_password"),
    path("user/profile/", user_profile, name="user_profile"),
    path("user/profile/update/", user_profile_update, name="user_profile_update"),
    path("user/profile/delete/", user_profile_delete, name="user_profile_delete"),
    # --- WebAuthn / passkeys ---
    path("passkeys/register/begin/", passkey_register_begin, name="passkey_register_begin"),
    path("passkeys/register/complete/", passkey_register_complete, name="passkey_register_complete"),
    path("passkeys/login/begin/", passkey_login_begin, name="passkey_login_begin"),
    path("passkeys/login/complete/", passkey_login_complete, name="passkey_login_complete"),
    path("passkeys/", passkey_list, name="passkey_list"),
    path("passkeys/<str:passkey_id>/", passkey_detail, name="passkey_detail"),
    path("recommendations/<str:user_id>/", user_recommendations, name="user_recommendations"),
    path("recommendations/save/<str:user_id>/", save_recommendations, name="save_recommendations"),
    path("recommendations/get/<str:user_id>/", get_recommendations, name="get_recommendations"),
    path("recommendations/delete/<str:user_id>/", delete_all_recommendations, name="delete_all_recommendations"),
    path("mood_history/<str:user_id>/", user_mood_history, name="user_mood_history"),
    path("listening_history/<str:user_id>/", user_listening_history, name="user_listening_history"),
]
