from django.urls import path
from .views import register, login, user_profile, user_profile_update, user_profile_delete, save_recommendations, get_recommendations, delete_recommendation, user_recommendations, user_mood_history, user_listening_history

urlpatterns = [
    path('register/', register, name='register'),
    path('user/profile/', user_profile, name='user_profile'),
    path('user/profile/update/', user_profile_update, name='user_profile_update'),
    path('user/profile/delete/', user_profile_delete, name='user_profile_delete'),
    path('recommendations/', save_recommendations, name='save_recommendations'),
    path('recommendations/<str:user_id>/', user_recommendations, name='user_recommendations'),
    path('mood_history/<str:user_id>/', user_mood_history, name='user_mood_history'),
    path('listening_history/<str:user_id>/', user_listening_history, name='user_listening_history'),
    path('recommendations/<str:username>/', get_recommendations, name='get_recommendations'),
    path('recommendations/<str:username>/<str:recommendation_id>/', delete_recommendation, name='delete_recommendation'),
    path('recommendations/<str:username>/', delete_recommendation, name='delete_all_recommendations'),  # For deleting all recommendations
    path('login/', login, name='login'),
]
