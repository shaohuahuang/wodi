import React from 'react';
import { BrowserRouter as Router, Route, Routes, useParams, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Room from './components/Room';
import './styles/App.css';

// 路由保护组件
const ProtectedRoute = ({ children }) => {
    const username = localStorage.getItem('username');
    if (!username) {
        return <Navigate to="/login" />;
    }
    return children;
};

function App() {
    return (
        <SocketProvider>
            <Router>
                <div className="App">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Home />
                            </ProtectedRoute>
                        } />
                        <Route path="/room/:roomId" element={
                            <ProtectedRoute>
                                <RoomWrapper />
                            </ProtectedRoute>
                        } />
                    </Routes>
                </div>
            </Router>
        </SocketProvider>
    );
}

// 包装Room组件以获取URL参数
const RoomWrapper = () => {
    const { roomId } = useParams();
    return <Room roomId={roomId} />;
};

export default App; 