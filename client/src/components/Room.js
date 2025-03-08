import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Room.css';

const Room = ({ roomId }) => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [gameState, setGameState] = useState({
        players: [],
        currentPhase: 'waiting',
        myRole: null,
        myWord: null,
        currentSpeaker: null,
        timeLeft: 0,
        hostId: null
    });
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [username] = useState(localStorage.getItem('username') || '未知玩家');

    useEffect(() => {
        if (!socket) return;

        socket.on('gameStateUpdate', (newState) => {
            console.log('Received game state update:', newState);
            setGameState(prev => ({
                ...prev,
                ...newState
            }));
        });

        socket.on('playerJoined', ({ players }) => {
            setGameState(prev => ({ ...prev, players }));
        });

        socket.on('gameStarted', ({ role, word, speakingOrder }) => {
            setGameState(prev => ({
                ...prev,
                currentPhase: 'speaking',
                myRole: role,
                myWord: word,
                currentSpeaker: speakingOrder[0]
            }));
        });

        socket.on('nextSpeaker', ({ speakerId }) => {
            setGameState(prev => ({ ...prev, currentSpeaker: speakerId }));
        });

        socket.on('votingStart', () => {
            setGameState(prev => ({ ...prev, currentPhase: 'voting' }));
        });

        socket.on('gameOver', ({ winner }) => {
            setGameState(prev => ({ ...prev, currentPhase: 'ended', winner }));
        });

        socket.on('newMessage', (message) => {
            setMessages(prev => [...prev, message]);
        });

        socket.on('playerLeft', ({ playerId, playerName, newState }) => {
            console.log(`Player ${playerName} left the room`);
            setGameState(prev => ({
                ...prev,
                ...newState
            }));
            setMessages(prev => [...prev, {
                system: true,
                message: `玩家 ${playerName} 离开了房间`
            }]);
        });

        return () => {
            socket.off('gameStateUpdate');
            socket.off('playerJoined');
            socket.off('gameStarted');
            socket.off('nextSpeaker');
            socket.off('votingStart');
            socket.off('gameOver');
            socket.off('newMessage');
            socket.off('playerLeft');
        };
    }, [socket]);

    const handleStartGame = () => {
        socket.emit('startGame', roomId);
    };

    const handleFinishSpeaking = () => {
        socket.emit('finishSpeaking', roomId);
    };

    const handleVote = (targetId) => {
        socket.emit('vote', { roomId, targetId });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            socket.emit('sendMessage', { roomId, message });
            setMessage('');
        }
    };

    const handleLeaveRoom = () => {
        if (gameState.currentPhase !== 'waiting') {
            if (!window.confirm('游戏正在进行中，退出将影响其他玩家的游戏体验。确定要退出吗？')) {
                return;
            }
        } else if (!window.confirm('确定要退出房间吗？')) {
            return;
        }
        
        socket.emit('leaveRoom', roomId);
        navigate('/');
    };

    const renderMessage = (msg, index) => {
        if (msg.system) {
            return (
                <div key={index} className="message system-message">
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

    return (
        <div className="room">
            <div className="room-header">
                <div className="room-info">
                    <h2>房间号: {roomId}</h2>
                    {gameState.hostId === socket?.id && (
                        <span className="host-tag">你是房主</span>
                    )}
                </div>
                <button 
                    onClick={handleLeaveRoom}
                    className={`leave-room-button ${gameState.currentPhase !== 'waiting' ? 'game-started' : ''}`}
                >
                    退出房间
                </button>
            </div>

            <div className="game-info">
                <h2>房间号: {roomId}</h2>
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
                        <div key={player.id} className={`player ${player.id === socket?.id ? 'current-player' : ''}`}>
                            <div className="player-info">
                                <span className="player-name">{player.name}</span>
                                {player.id === socket?.id && <span className="player-tag">(你)</span>}
                                {gameState.currentSpeaker === player.id && 
                                    <span className="speaking-tag">正在发言</span>}
                                {!player.isAlive && <span className="dead-tag">已出局</span>}
                            </div>
                            {gameState.currentPhase === 'voting' && 
                             player.id !== socket?.id && 
                             player.isAlive && (
                                <button 
                                    onClick={() => handleVote(player.id)}
                                    className="vote-button"
                                >
                                    投票
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {gameState.currentPhase === 'waiting' && gameState.hostId === socket?.id && (
                <button 
                    onClick={handleStartGame}
                    className="start-game-button"
                >
                    开始游戏
                </button>
            )}

            {gameState.currentPhase === 'speaking' && 
             gameState.currentSpeaker === socket.id && (
                <button onClick={handleFinishSpeaking}>结束发言</button>
            )}

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
        </div>
    );
}

export default Room; 