import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import '../styles/Home.css';

const Home = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rooms, setRooms] = useState([]);
    const username = localStorage.getItem('username');

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

    const handleCreateRoom = () => {
        if (!socket) {
            setError('网络连接失败，请刷新页面重试');
            return;
        }
        
        setLoading(true);
        socket.emit('createRoom', username);
        
        socket.once('roomCreated', ({ roomId }) => {
            setLoading(false);
            navigate(`/room/${roomId}`);
        });

        socket.once('error', (message) => {
            setLoading(false);
            setError(message);
        });
    };

    const handleJoinRoom = (roomId) => {
        if (!socket) {
            setError('网络连接失败，请刷新页面重试');
            return;
        }

        setLoading(true);
        socket.emit('joinRoom', { roomId, playerName: username });
        
        socket.once('joinError', (message) => {
            setLoading(false);
            setError(message);
        });

        socket.once('playerJoined', () => {
            setLoading(false);
            navigate(`/room/${roomId}`);
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('username');
        navigate('/login');
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
            
            {error && <div className="error">{error}</div>}
            
            <div className="create-room">
                <button 
                    onClick={handleCreateRoom} 
                    className="create-button"
                    disabled={loading}
                >
                    {loading ? '创建中...' : '创建新房间'}
                </button>
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
                                    onClick={() => handleJoinRoom(room.roomId)}
                                    disabled={loading || room.state !== 'waiting' || room.playerCount >= room.maxPlayers}
                                >
                                    {room.state !== 'waiting' ? '游戏中' :
                                     room.playerCount >= room.maxPlayers ? '已满' : '加入房间'}
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