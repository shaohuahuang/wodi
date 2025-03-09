import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';
import ApiKeyInput from '../components/ApiKeyInput';

const Home = ({ gameManager }) => {
    const navigate = useNavigate();
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const username = localStorage.getItem('username');

    const handleLogout = () => {
        localStorage.removeItem('username');
        navigate('/login');
    };

    const handleStartLocalGame = () => {
        // 显示 API Key 输入对话框
        setShowApiKeyInput(true);
    };
    
    const handleApiKeySubmit = (apiKey) => {
        try {
            // 设置 API Key 并创建本地游戏
            gameManager.setApiKey(apiKey);
            createLocalGame();
        } catch (error) {
            console.error('处理 API Key 失败:', error);
            // 可以在这里添加错误提示
        }
    };
    
    const handleApiKeySkip = () => {
        try {
            // 跳过 API Key 设置，使用默认模型
            gameManager.setApiKey(null);
            createLocalGame();
        } catch (error) {
            console.error('跳过 API Key 设置失败:', error);
            // 可以在这里添加错误提示
        }
    };
    
    const createLocalGame = () => {
        try {
            // 创建本地游戏并导航到游戏房间
            gameManager.createGame(username);
            navigate('/room');
        } catch (error) {
            console.error('创建游戏失败:', error);
            // 可以在这里添加错误提示
        }
    };

    return (
        <div className="home">
            <div className="header">
                <h1>谁是卧底</h1>
                <div className="user-info">
                    <span>欢迎, {username}</span>
                    <button onClick={handleLogout} className="logout-button">
                        退出登录
                    </button>
                </div>
            </div>
            
            <div className="game-options">
                <div className="option-card single-option">
                    <h3>单机模式</h3>
                    <p>与AI玩家一起游戏，体验谁是卧底的乐趣</p>
                    <button 
                        onClick={handleStartLocalGame} 
                        className="option-button local-game"
                    >
                        开始游戏
                    </button>
                </div>
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

export default Home; 