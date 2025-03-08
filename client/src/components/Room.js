import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import '../styles/Room.css';

const Room = ({ roomId }) => {
    const socket = useSocket();
    const [gameState, setGameState] = useState({
        players: [],
        currentPhase: 'waiting',
        myRole: null,
        myWord: null,
        currentSpeaker: null,
        timeLeft: 0
    });
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [playerName] = useState(localStorage.getItem('playerName') || '未知玩家');

    useEffect(() => {
        if (!socket) return;

        socket.on('gameStateUpdate', (newState) => {
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

        return () => {
            socket.off('gameStateUpdate');
            socket.off('playerJoined');
            socket.off('gameStarted');
            socket.off('nextSpeaker');
            socket.off('votingStart');
            socket.off('gameOver');
            socket.off('newMessage');
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

    return (
        <div className="room">
            <div className="game-info">
                <h2>房间号: {roomId}</h2>
                <div className="current-player-info">
                    <p>你的名字: <span className="highlight">{playerName}</span></p>
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

            {gameState.currentPhase === 'waiting' && (
                <button onClick={handleStartGame}>开始游戏</button>
            )}

            {gameState.currentPhase === 'speaking' && 
             gameState.currentSpeaker === socket.id && (
                <button onClick={handleFinishSpeaking}>结束发言</button>
            )}

            <div className="chat">
                <div className="messages">
                    {messages.map((msg, index) => (
                        <div key={index} className="message">
                            <strong>{msg.playerName}:</strong> {msg.message}
                        </div>
                    ))}
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