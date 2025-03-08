import React, { useState, useEffect } from 'react';
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
    const [rooms, setRooms] = useState([]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomsUpdate = (roomsList) => {
            console.log('Rooms list updated:', roomsList);
            setRooms(roomsList);
        };

        socket.on('roomsListUpdate', handleRoomsUpdate);

        // 主动请求房间列表
        socket.emit('getRoomsList');

        return () => {
            socket.off('roomsListUpdate', handleRoomsUpdate);
        };
    }, [socket]);

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

    const handleJoinExistingRoom = (selectedRoomId) => {
        if (!playerName.trim()) {
            setError('请先输入玩家名称');
            return;
        }
        setRoomId(selectedRoomId);
        handleJoinRoom(new Event('click'));
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

            <div className="rooms-list-container">
                <h2>当前可用房间</h2>
                {rooms.length === 0 ? (
                    <p className="no-rooms">暂无可用房间</p>
                ) : (
                    <div className="rooms-grid">
                        {rooms.map(room => (
                            <div key={room.roomId} className="room-card">
                                <div className="room-info">
                                    <h3>房间号: {room.roomId}</h3>
                                    <p>玩家数量: {room.playerCount}/{room.maxPlayers}</p>
                                    <p>状态: {room.state === 'waiting' ? '等待中' : '游戏中'}</p>
                                    <div className="room-players">
                                        <p>玩家列表:</p>
                                        <ul>
                                            {room.players.map((name, index) => (
                                                <li key={index}>{name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <button
                                    className="join-button"
                                    onClick={() => handleJoinExistingRoom(room.roomId)}
                                    disabled={loading || room.state !== 'waiting' || room.playerCount >= room.maxPlayers}
                                >
                                    {room.state !== 'waiting' ? '游戏中' :
                                     room.playerCount >= room.maxPlayers ? '已满' : '加入'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home; 