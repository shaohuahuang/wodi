import React, { useState } from 'react';
import '../styles/ApiKeyInput.css';

const ApiKeyInput = ({ onSubmit, onSkip }) => {
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!apiKey.trim()) {
            setError('请输入 API Key');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            // 简化验证过程，直接调用 onSubmit
            onSubmit(apiKey.trim());
        } catch (error) {
            console.error('API Key 处理失败:', error);
            setError('处理 API Key 时出错，请重试');
            setIsLoading(false);
        }
    };

    return (
        <div className="api-key-container">
            <div className="api-key-card">
                <h2>输入 DeepSeek API Key</h2>
                <p>为了提供更好的游戏体验，请输入您的 DeepSeek API Key。</p>
                <p className="api-key-note">您的 API Key 仅在本地使用，不会被发送到服务器。</p>
                
                {error && <div className="api-key-error">{error}</div>}
                
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="输入您的 DeepSeek API Key"
                        className="api-key-input"
                    />
                    
                    <div className="api-key-buttons">
                        <button 
                            type="submit" 
                            className="api-key-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? '处理中...' : '提交'}
                        </button>
                        
                        <button 
                            type="button" 
                            className="api-key-skip"
                            onClick={onSkip}
                            disabled={isLoading}
                        >
                            跳过（使用默认模型）
                        </button>
                    </div>
                </form>
                
                <div className="api-key-help">
                    <p>如何获取 DeepSeek API Key?</p>
                    <ol>
                        <li>访问 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer">DeepSeek 平台</a></li>
                        <li>注册或登录您的账户</li>
                        <li>在个人设置中创建 API Key</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyInput; 