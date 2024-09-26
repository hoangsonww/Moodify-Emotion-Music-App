import matplotlib.pyplot as plt
import pandas as pd
from ai_ml.src.recommendation.music_recommendation import get_music_recommendation

# Sample emotions detected
sample_emotions = ["joy", "sadness", "anger", "love", "fear"]

# Collect recommended genres
recommended_genres = []
for emotion in sample_emotions:
    recommendations = get_music_recommendation(emotion)
    genres = [track['name'] for track in recommendations]
    recommended_genres.extend(genres)

# Analyze the frequency of recommended genres
genre_counts = pd.Series(recommended_genres).value_counts()

# Plot genre recommendations
plt.figure(figsize=(10, 6))
genre_counts.plot(kind='bar', color='lightgreen', edgecolor='black')
plt.title("Most Recommended Music Genres by Emotion")
plt.xlabel("Genre")
plt.ylabel("Frequency")
plt.xticks(rotation=45)
plt.tight_layout()

plt.savefig("visualizations/music_recommendation_trends.png")
plt.show()
