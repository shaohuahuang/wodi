import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import ApiKeyInput from '../components/ApiKeyInput';

const Login = ({ gameManager }) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);

    useEffect(() => {
        // 检查是否已经登录
        const savedUsername = localStorage.getItem('username');
        if (savedUsername) {
            navigate('/');
        }
    }, [navigate]);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!username.trim()) {
            setError('请输入用户名');
            return;
        }
        
        if (username.length < 2 || username.length > 10) {
            setError('用户名长度应在2-10个字符之间');
            return;
        }
        
        // 显示 API Key 输入界面
        setShowApiKeyInput(true);
    };
    
    const handleApiKeySubmit = (apiKey) => {
        // 设置 API Key
        gameManager.setApiKey(apiKey);
        
        // 保存用户名并导航到主页
        localStorage.setItem('username', username);
        navigate('/');
    };
    
    const handleApiKeySkip = () => {
        // 跳过 API Key 设置，使用默认模型
        gameManager.setApiKey(null);
        
        // 保存用户名并导航到主页
        localStorage.setItem('username', username);
        navigate('/');
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>谁是卧底</h1>
                <p>请输入您的用户名开始游戏</p>
                
                {error && <div className="login-error">{error}</div>}
                
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="输入用户名 (2-10个字符)"
                        maxLength={10}
                    />
                    <button type="submit">开始游戏</button>
                </form>
            </div>
            
            {showApiKeyInput && (
                <ApiKeyInput 
                    onSubmit={handleApiKeySubmit}
                    onSkip={handleApiKeySkip}
                />
            )}
        </div>
    );
};

export default Login; 