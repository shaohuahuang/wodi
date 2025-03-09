import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Room from './components/Room';
import Login from './pages/Login';
import { SocketProvider } from './context/SocketContext';
import GameManager from './GameManager';
import './styles/App.css';

// 创建 GameManager 实例
const gameManager = new GameManager();

function App() {
    // 检查用户是否已登录
    const isLoggedIn = () => {
        return localStorage.getItem('username') !== null;
    };

    return (
        <Router>
            <SocketProvider>
                <Routes>
                    <Route path="/login" element={<Login gameManager={gameManager} />} />
                    <Route 
                        path="/" 
                        element={isLoggedIn() ? <Home gameManager={gameManager} /> : <Navigate to="/login" />} 
                    />
                    <Route 
                        path="/room" 
                        element={isLoggedIn() ? <Room gameManager={gameManager} username={localStorage.getItem('username')} /> : <Navigate to="/login" />} 
                    />
                    <Route 
                        path="/room/:roomId" 
                        element={isLoggedIn() ? <Room gameManager={gameManager} /> : <Navigate to="/login" />} 
                    />
                </Routes>
            </SocketProvider>
        </Router>
    );
}

export default App; 