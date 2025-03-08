import React, { useState } from 'react';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (username.trim()) {
            onLogin(username.trim());
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>谁是卧底</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入你的名字"
                        maxLength={10}
                    />
                    <button type="submit" disabled={!username.trim()}>
                        开始游戏
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login; 