import React, { useState } from 'react';
import '../styles/GameSettings.css';

const GameSettings = ({ settings, onUpdate, onClose }) => {
    const [newSettings, setNewSettings] = useState(settings);

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpdate(newSettings);
        onClose();
    };

    return (
        <div className="settings-modal">
            <div className="settings-content">
                <h2>游戏设置</h2>
                <form onSubmit={handleSubmit}>
                    <div className="setting-item">
                        <label>最大玩家数:</label>
                        <input
                            type="number"
                            min="4"
                            max="12"
                            value={newSettings.maxPlayers}
                            onChange={(e) => setNewSettings({
                                ...newSettings,
                                maxPlayers: parseInt(e.target.value)
                            })}
                        />
                    </div>
                    <div className="setting-item">
                        <label>卧底比例:</label>
                        <select
                            value={newSettings.undercoverRatio}
                            onChange={(e) => setNewSettings({
                                ...newSettings,
                                undercoverRatio: parseInt(e.target.value)
                            })}
                        >
                            <option value="3">每3人1个卧底</option>
                            <option value="4">每4人1个卧底</option>
                            <option value="5">每5人1个卧底</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <label>发言时间限制(秒):</label>
                        <input
                            type="number"
                            min="30"
                            max="120"
                            step="10"
                            value={newSettings.speakingTime}
                            onChange={(e) => setNewSettings({
                                ...newSettings,
                                speakingTime: parseInt(e.target.value)
                            })}
                        />
                    </div>
                    <div className="setting-item">
                        <label>投票时间限制(秒):</label>
                        <input
                            type="number"
                            min="10"
                            max="60"
                            step="5"
                            value={newSettings.votingTime}
                            onChange={(e) => setNewSettings({
                                ...newSettings,
                                votingTime: parseInt(e.target.value)
                            })}
                        />
                    </div>
                    <div className="settings-buttons">
                        <button type="submit" className="save-button">保存设置</button>
                        <button type="button" onClick={onClose} className="cancel-button">取消</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GameSettings; 