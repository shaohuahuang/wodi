import React from 'react';
import '../styles/VirtualTable.css';

const VirtualTable = ({ players, gameState, onVote, currentUser, maxPlayers = 8 }) => {
    console.log("VirtualTable rendering with players:", players);
    console.log("Current game state:", gameState);
    
    // 计算玩家在桌子周围的位置
    const positionPlayers = () => {
        // 创建包含空位置的完整数组
        const fullPositions = new Array(maxPlayers).fill(null);
        
        // 找到房主位置
        const hostIndex = players.findIndex(p => p.id === 'host');
        
        if (hostIndex !== -1) {
            // 计算房主应该在的位置 - 底部中间
            const hostPosition = Math.floor(maxPlayers / 2);
            
            // 放置房主
            fullPositions[hostPosition] = players[hostIndex];
            
            // 放置其他玩家 - 顺时针排列
            let currentPosition = (hostPosition + 1) % maxPlayers;
            
            // 先放置AI玩家
            players.forEach((player, index) => {
                if (index !== hostIndex && player.isAI) {
                    fullPositions[currentPosition] = player;
                    currentPosition = (currentPosition + 1) % maxPlayers;
                }
            });
            
            // 再放置其他人类玩家
            players.forEach((player, index) => {
                if (index !== hostIndex && !player.isAI) {
                    fullPositions[currentPosition] = player;
                    currentPosition = (currentPosition + 1) % maxPlayers;
                }
            });
        } else {
            // 如果没有房主，直接按顺序放置
            players.forEach((player, index) => {
                fullPositions[index] = player;
            });
        }
        
        return fullPositions;
    };

    const positionedPlayers = positionPlayers();

    // 获取玩家投票信息
    const getVotesReceived = (playerId) => {
        if (!gameState.votes || !playerId) return 0;
        return Array.from(gameState.votes.entries())
            .filter(([voterId, targetId]) => {
                const voter = players.find(p => p.id === voterId);
                return voter?.isAlive && targetId === playerId;
            }).length;
    };

    const getPlayerVote = (playerId) => {
        if (!gameState.votes || !playerId) return null;
        return gameState.votes.get(playerId);
    };

    // 渲染玩家头像和状态
    const renderPlayer = (player, index, totalPositions) => {
        // 计算玩家位置角度 - 均匀分布在圆周上
        // 我们从顶部开始 (-90度)，然后顺时针分布
        const angle = ((index / totalPositions) * 360) - 90;
        const radius = 40; // 桌子半径百分比
        
        // 转换为CSS位置
        const position = {
            left: `${50 + radius * Math.cos(angle * Math.PI / 180)}%`,
            top: `${50 + radius * Math.sin(angle * Math.PI / 180)}%`
        };

        // 如果是空位置，显示空座位
        if (!player) {
            return (
                <div 
                    key={`empty-${index}`} 
                    className="virtual-player empty-seat"
                    style={position}
                >
                    <div className="player-avatar empty">
                        <div className="empty-avatar">空座</div>
                    </div>
                    <div className="player-info empty">
                        <div className="player-name">等待加入</div>
                    </div>
                </div>
            );
        }

        // 正常玩家渲染
        const isSpeaking = gameState.currentSpeaker === player.id;
        const isVoting = gameState.currentVoter === player.id;
        const isEliminated = !player.isAlive;
        const isCurrentUser = player.id === 'host';
        const votesReceived = getVotesReceived(player.id);
        const playerVote = getPlayerVote(player.id);

        return (
            <div 
                key={player.id} 
                className={`virtual-player ${isSpeaking ? 'speaking' : ''} 
                    ${isVoting ? 'voting' : ''} 
                    ${isEliminated ? 'eliminated' : ''} 
                    ${isCurrentUser ? 'current-user' : ''}`}
                style={position}
            >
                <div className="player-avatar">
                    {player.isAI ? (
                        <div className="ai-avatar">AI</div>
                    ) : (
                        <div className="human-avatar">{player.name.charAt(0).toUpperCase()}</div>
                    )}
                    {isSpeaking && <div className="speaking-indicator"></div>}
                </div>
                <div className="player-info">
                    <div className="player-name">{player.name}</div>
                    {isCurrentUser && gameState.myWord && <div className="player-word">{gameState.myWord}</div>}
                    {votesReceived > 0 && <div className="votes-received">{votesReceived} 票</div>}
                </div>
                
                {/* 投票按钮 */}
                {gameState.currentVoter === 'host' && 
                 !isCurrentUser && 
                 player.isAlive && 
                 (gameState.currentPhase === 'voting' || gameState.currentPhase === 'tiebreaker') && (
                    <button 
                        className={`vote-button ${gameState.currentPhase === 'tiebreaker' ? 'tiebreaker' : ''} 
                            ${getPlayerVote('host') === player.id ? 'voted' : ''}`}
                        onClick={() => onVote(player.id)}
                    >
                        {getPlayerVote('host') === player.id ? '已投票' : '投票'}
                    </button>
                )}
                
                {/* 玩家投票指示 */}
                {playerVote && (
                    <div className="vote-indicator">
                        <div className="vote-arrow"></div>
                        <div className="vote-target">
                            {players.find(p => p.id === playerVote)?.name}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="virtual-table-container">
            <div className="virtual-table">
                <div className="table-surface">
                    {gameState.currentPhase === 'waiting' && (
                        <div className="waiting-prompt">
                            <div>等待游戏开始</div>
                            <div className="player-count">
                                当前玩家: {players.length}/{maxPlayers}
                            </div>
                        </div>
                    )}
                    
                    {gameState.currentPhase === 'speaking' && (
                        <div className="speaking-prompt">
                            {gameState.currentSpeaker === 'host' ? 
                                '轮到你发言' : 
                                `等待 ${players.find(p => p.id === gameState.currentSpeaker)?.name} 发言`}
                        </div>
                    )}
                    
                    {gameState.currentPhase === 'voting' && (
                        <div className="voting-prompt">
                            {gameState.currentVoter === 'host' ? 
                                '轮到你投票' : 
                                `等待 ${players.find(p => p.id === gameState.currentVoter)?.name} 投票`}
                        </div>
                    )}
                    
                    {gameState.currentPhase === 'tiebreaker' && (
                        <div className="tiebreaker-prompt">
                            <div>平票决胜</div>
                            <div className="tied-players">
                                {gameState.tiedPlayers?.map(playerId => {
                                    const player = players.find(p => p.id === playerId);
                                    return (
                                        <span key={playerId} className="tied-player">
                                            {player.name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {gameState.currentPhase === 'ended' && (
                        <div className="game-result-display">
                            <h3>{gameState.winner === 'civilians' ? '平民胜利！' : '卧底胜利！'}</h3>
                        </div>
                    )}
                </div>
            </div>
            
            {/* 玩家位置 */}
            {positionedPlayers.map((player, index) => 
                renderPlayer(player, index, maxPlayers)
            )}
        </div>
    );
};

export default VirtualTable; 