import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Room from './components/Room';
import GameManager from './GameManager';
import './styles/App.css';

function App() {
    const [gameManager] = useState(() => {
        const manager = new GameManager();
        const savedUsername = localStorage.getItem('username');
        if (savedUsername) {
            manager.createGame(savedUsername);
        }
        return manager;
    });
    const [username, setUsername] = useState(localStorage.getItem('username') || '');

    const handleLogin = (name) => {
        setUsername(name);
        localStorage.setItem('username', name);
        gameManager.createGame(name);
    };

    return (
        <Router>
            <Routes>
                <Route 
                    path="/" 
                    element={
                        username ? 
                            <Navigate to="/room" /> : 
                            <Login onLogin={handleLogin} />
                    } 
                />
                <Route 
                    path="/room" 
                    element={
                        username ? 
                            <Room gameManager={gameManager} username={username} /> : 
                            <Navigate to="/" />
                    } 
                />
            </Routes>
        </Router>
    );
}

export default App; 