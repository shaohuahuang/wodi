import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Room.css';
import GameSettings from './GameSettings';

const Room = ({ gameManager, username }) => {
    const navigate = useNavigate();
    const [gameState, setGameState] = useState({
        players: [{
            id: 'host',
            name: username,
            isAlive: true,
            isHost: true
        }],
        currentPhase: 'waiting',
        myRole: null,
        myWord: null,
        currentSpeaker: null,
        currentVoter: null,
        hostId: 'host'
    });
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [votes, setVotes] = useState(new Map());
    const [timeLeft, setTimeLeft] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        // 设置事件处理器
        gameManager.onGameStateUpdate = setGameState;
        gameManager.onNewMessage = (msg) => setMessages(prev => [...prev, msg]);
        gameManager.onGameOver = (result) => {
            setGameState(prev => ({ ...prev, currentPhase: 'ended', winner: result.winner }));
            setMessages(prev => [...prev, 
                { system: true, message: result.message },
                { system: true, message: `平民: ${result.civilians.join(', ')}` },
                { system: true, message: `卧底: ${result.undercovers.join(', ')}` }
            ]);
        };
        gameManager.onVoteUpdate = ({ votes: newVotes, nextVoter }) => {
            setVotes(new Map(newVotes));
            setGameState(prev => ({ ...prev, currentVoter: nextVoter }));
        };
        gameManager.onRoundStart = ({ round, currentSpeaker, eliminatedPlayer }) => {
            if (eliminatedPlayer) {
                setMessages(prev => [...prev, {
                    system: true,
                    message: `玩家 ${eliminatedPlayer.name} 被投票出局，身份是${eliminatedPlayer.role === 'undercover' ? '卧底' : '平民'}`
                }]);
            }
            setGameState(prev => ({
                ...prev,
                currentPhase: 'speaking',
                currentSpeaker,
                currentRound: round
            }));
            setVotes(new Map());
        };
        gameManager.onAISpeaking = ({ playerId, playerName, message, isComplete }) => {
            if (!isComplete) {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage && lastMessage.playerId === playerId && !lastMessage.isComplete) {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = {
                            ...lastMessage,
                            message: lastMessage.message + message
                        };
                        return newMessages;
                    } else {
                        return [...prev, { playerId, playerName, message, isComplete: false }];
                    }
                });
            }
        };
        gameManager.onTimerUpdate = setTimeLeft;
    }, [gameManager]);

    useEffect(() => {
        console.log('Current game state:', gameState);
        console.log('Players:', gameState.players);
        console.log('Username:', username);
    }, [gameState, username]);

    const handleStartGame = () => {
        gameManager.startGame();
    };

    const handleFinishSpeaking = () => {
        if (gameState.currentSpeaker === 'host') {
            gameManager.finishSpeaking('host');
        }
    };

    const handleVote = (targetId) => {
        gameManager.vote(targetId);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            gameManager.sendMessage(message);
            setMessage('');
        }
    };

    const handleAddAI = () => {
        gameManager.addAIPlayer();
    };

    const renderMessage = (msg, index) => {
        if (msg.system) {
            return (
                <div key={index} className={`message system-message ${msg.type || ''}`}>
                    {msg.message}
                </div>
            );
        }
        return (
            <div key={index} className="message">
                <strong>{msg.playerName}:</strong> {msg.message}
            </div>
        );
    };

    const getVotesReceived = (playerId) => {
        return Array.from(votes.entries())
            .filter(([voterId, targetId]) => {
                const voter = gameState.players.find(p => p.id === voterId);
                return voter?.isAlive && targetId === playerId;
            }).length;
    };

    const getPlayerVote = (playerId) => {
        return votes.get(playerId);
    };

    // 添加计时器显示
    const renderTimer = () => {
        if (timeLeft <= 0) return null;
        return (
            <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
                剩余时间: {timeLeft}秒
            </div>
        );
    };

    return (
        <div className="room">
            <div className="room-header">
                <div className="room-info">
                    <h2>房间号: {gameManager.roomId}</h2>
                </div>
                <button 
                    onClick={() => {
                        if (gameState.currentPhase !== 'waiting') {
                            if (!window.confirm('游戏正在进行中，退出将影响其他玩家的游戏体验。确定要退出吗？')) {
                                return;
                            }
                        } else if (!window.confirm('确定要退出房间吗？')) {
                            return;
                        }
                        
                        gameManager.leaveRoom();
                        navigate('/');
                    }}
                    className={`leave-room-button ${gameState.currentPhase !== 'waiting' ? 'game-started' : ''}`}
                >
                    退出房间
                </button>
            </div>

            <div className="game-info">
                <div className="current-player-info">
                    <p>你的名字: <span className="highlight">{username}</span></p>
                    <p>你的身份: <span className="highlight">
                        {gameState.myRole === 'undercover' ? '卧底' : 
                         gameState.myRole === 'civilian' ? '平民' : '等待游戏开始'}
                    </span></p>
                    <p>你的词语: <span className="highlight">{gameState.myWord || '等待游戏开始'}</span></p>
                </div>
            </div>

            <div className="players-container">
                <h3>玩家列表 ({gameState.players.length}/8)</h3>
                <div className="players-list">
                    {gameState.players.map(player => (
                        <div key={player.id} 
                            className={`player 
                                ${player.id === 'host' ? 'current-player' : ''} 
                                ${getPlayerVote('host') === player.id ? 'voted-for' : ''}
                                ${gameState.currentPhase === 'speaking' && gameState.currentSpeaker === player.id ? 'speaking' : ''}
                            `}
                        >
                            <div className="player-info">
                                <span className="player-name">{player.name}</span>
                                {player.id === 'host' && <span className="player-tag">(你)</span>}
                                {player.isAI && <span className="ai-tag">AI</span>}
                                {gameState.currentSpeaker === player.id && 
                                    <span className="speaking-tag">正在发言</span>}
                                {!player.isAlive && <span className="dead-tag">已出局</span>}
                                {gameState.currentPhase === 'voting' && (
                                    <span className="votes-tag">
                                        被指认: {getVotesReceived(player.id)} 票
                                    </span>
                                )}
                            </div>
                            <div className="player-actions">
                                {gameState.currentPhase === 'voting' && 
                                 player.id !== 'host' && 
                                 player.isAlive &&
                                 gameState.currentVoter === 'host' &&
                                 (
                                    <button 
                                        onClick={() => handleVote(player.id)}
                                        className={`vote-button ${getPlayerVote('host') === player.id ? 'voted' : ''}`}
                                    >
                                        {getPlayerVote('host') === player.id ? '已投票' : '投票'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {gameState.currentPhase === 'voting' && votes.size > 0 && (
                    <div className="voting-summary">
                        <h4>当前投票情况：</h4>
                        <div className="votes-list">
                            {Array.from(votes.entries()).map(([voterId, targetId]) => {
                                const voter = gameState.players.find(p => p.id === voterId);
                                const target = gameState.players.find(p => p.id === targetId);
                                if (!voter || !target || !voter.isAlive || !target.isAlive) return null;
                                return (
                                    <div key={voterId} className="vote-record">
                                        <span className="voter">{voter.name}</span>
                                        <span className="vote-arrow">→</span>
                                        <span className="target">{target.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {gameState.currentPhase === 'voting' && (
                    <div className="voting-status">
                        {gameState.currentVoter ? (
                            <p className={`current-voter ${gameState.currentVoter === 'host' ? 'your-turn' : ''}`}>
                                {gameState.currentVoter === 'host' ? (
                                    '轮到你投票了'
                                ) : (
                                    `等待 ${gameState.players.find(p => p.id === gameState.currentVoter)?.name} 投票`
                                )}
                            </p>
                        ) : (
                            <p className="voting-complete">投票结束，正在统计结果...</p>
                        )}
                    </div>
                )}
            </div>

            <div className="game-controls">
                {gameState.currentPhase === 'waiting' && (
                    <>
                        <button 
                            onClick={handleStartGame}
                            className="start-game-button"
                            disabled={gameState.players.length < 4}
                        >
                            {gameState.players.length < 4 
                                ? '至少需要4名玩家才能开始游戏'
                                : '开始游戏'
                            }
                        </button>
                        <button 
                            onClick={handleAddAI} 
                            className="add-ai-button"
                        >
                            添加AI玩家
                        </button>
                        <button 
                            onClick={() => setShowSettings(true)}
                            className="settings-button"
                        >
                            游戏设置
                        </button>
                    </>
                )}

                {gameState.currentPhase === 'speaking' && 
                 gameState.currentSpeaker === 'host' && (
                    <button 
                        onClick={handleFinishSpeaking}
                        className="finish-speaking-button"
                    >
                        结束发言
                    </button>
                )}
            </div>

            <div className="chat">
                <div className="messages">
                    {messages.map(renderMessage)}
                </div>
                <form onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="输入消息..."
                    />
                    <button type="submit">发送</button>
                </form>
            </div>

            {gameState.currentPhase === 'ended' && (
                <div className="game-over">
                    <h3 className="game-result">
                        {gameState.winner === 'civilians' ? '平民胜利！' : '卧底胜利！'}
                    </h3>
                    <div className="game-stats">
                        <p>游戏结束！</p>
                        <p>你的身份是: {gameState.myRole === 'undercover' ? '卧底' : '平民'}</p>
                        <p>你的词语是: {gameState.myWord}</p>
                    </div>
                    <button 
                        onClick={() => gameManager.restartGame()}
                        className="restart-game-button"
                    >
                        重新开始游戏
                    </button>
                </div>
            )}

            {renderTimer()}

            {showSettings && (
                <GameSettings
                    settings={gameManager.settings}
                    onUpdate={gameManager.updateSettings.bind(gameManager)}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
}

export default Room; 