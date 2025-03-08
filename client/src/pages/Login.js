import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import '../styles/Login.css';

const Login = () => {
    const navigate = useNavigate();
    const socket = useSocket();
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // 如果已经登录，直接跳转到首页
        const loggedInUser = localStorage.getItem('username');
        if (loggedInUser) {
            // 如果已登录，先请求房间列表再跳转
            if (socket) {
                socket.emit('getRoomsList');
            }
            navigate('/');
        }
    }, [navigate, socket]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!username.trim()) {
            setError('请输入用户名');
            return;
        }

        // 存储用户名
        localStorage.setItem('username', username.trim());
        
        // 登录成功后，先请求房间列表再跳转
        if (socket) {
            socket.emit('getRoomsList');
        }
        
        navigate('/');
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>谁是卧底</h1>
                <h2>用户登录</h2>
                {error && <div className="error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入用户名"
                            maxLength={10}
                        />
                    </div>
                    <button type="submit" className="login-button">
                        进入游戏
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login; 