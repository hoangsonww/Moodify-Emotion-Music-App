const MoodHistory = ({ moods }) => {
  return (
    <div>
      <h2>Mood History</h2>
      <ul>
        {moods.map((mood, index) => (
          <li key={index}>{mood}</li>
        ))}
      </ul>
    </div>
  );
};

export default MoodHistory;
