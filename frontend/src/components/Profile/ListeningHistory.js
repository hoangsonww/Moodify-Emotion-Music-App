const ListeningHistory = ({ history }) => {
  return (
    <div>
      <h2>Listening History</h2>
      <ul>
        {history.map((song, index) => (
          <li key={index}>{song}</li>
        ))}
      </ul>
    </div>
  );
};

export default ListeningHistory;
