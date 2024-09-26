from django.contrib import admin
from .models import UserProfile
from django.utils.translation import gettext_lazy as _

admin.site.site_header = _("Emotion-Based Music App Admin")
admin.site.site_title = _("Emotion-Based Music App Admin Portal")
admin.site.index_title = _("Emotion-Based Music App Admin Portal")

admin.site.site_header = "Emotion-Based Music App Admin"
admin.site.site_title = "Music App Admin Portal"
admin.site.index_title = "Welcome to the Music App Admin"


class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('username', 'created_at')
    search_fields = ('username',)

admin.site.register(UserProfile, UserProfileAdmin)
