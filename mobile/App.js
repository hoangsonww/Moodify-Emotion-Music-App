import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import ResultsPage from './pages/ResultsPage';
import Footer from "./components/Footer";
import NotFoundPage from "./pages/NotFoundPage";
import './styles/styles.css';

function App() {
  return (
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Footer />
      </Router>
  );
}

export default App;
