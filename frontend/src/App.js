import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Profile from './components/Profile';
import Results from './components/Results';
import MoodHistory from './components/MoodHistory';
import ListeningHistory from './components/ListeningHistory';
import Recommendations from './components/Recommendations';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/results" element={<Results />} />
      <Route path="/mood-history" element={<MoodHistory />} />
      <Route path="/listening-history" element={<ListeningHistory />} />
      <Route path="/recommendations" element={<Recommendations />} />
    </Routes>
  );
};

export default App;
