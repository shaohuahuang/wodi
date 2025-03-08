import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import '../styles/Home.css';

const Home = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        setError('');
        if (!playerName.trim()) {
            setError('请输入玩家名称');
            return;
        }
        if (!socket) {
            setError('网络连接失败，请刷新页面重试');
            return;
        }
        
        setLoading(true);
        socket.emit('createRoom', playerName);
        
        socket.once('roomCreated', ({ roomId }) => {
            setLoading(false);
            localStorage.setItem('playerName', playerName);
            alert(`房间创建成功！房间号：${roomId}`);
            navigate(`/room/${roomId}`);
        });

        socket.once('error', (message) => {
            setLoading(false);
            setError(message);
        });
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        setError('');
        if (!playerName.trim() || !roomId.trim()) {
            setError('请输入玩家名称和房间号');
            return;
        }
        if (!socket) {
            setError('网络连接失败，请刷新页面重试');
            return;
        }

        setLoading(true);
        socket.emit('joinRoom', { roomId: roomId.toUpperCase(), playerName });
        
        socket.once('joinError', (message) => {
            setLoading(false);
            setError(message);
        });

        socket.once('playerJoined', () => {
            setLoading(false);
            localStorage.setItem('playerName', playerName);
            navigate(`/room/${roomId.toUpperCase()}`);
        });
    };

    return (
        <div className="home">
            <h1>谁是卧底</h1>
            
            {error && <div className="error">{error}</div>}
            
            <div className="form-container">
                <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="输入你的名字"
                    className="input"
                    disabled={loading}
                />
                
                <div className="buttons">
                    <button 
                        onClick={handleCreateRoom} 
                        className="button"
                        disabled={loading}
                    >
                        {loading ? '处理中...' : '创建房间'}
                    </button>
                    
                    <div className="join-room">
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                            placeholder="输入房间号"
                            className="input"
                            disabled={loading}
                        />
                        <button 
                            onClick={handleJoinRoom} 
                            className="button"
                            disabled={loading}
                        >
                            {loading ? '处理中...' : '加入房间'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home; 