const Game = require('../models/Game');
const games = new Map();

function getRoomsList() {
    return Array.from(games.entries()).map(([roomId, game]) => ({
        roomId,
        playerCount: game.players.size,
        maxPlayers: 8,
        state: game.state,
        players: Array.from(game.players.values()).map(p => p.name)
    }));
}

function handleGameEvents(io) {
    // 定期广播房间列表更新
    const broadcastRoomsList = () => {
        io.emit('roomsListUpdate', getRoomsList());
    };

    // 每2秒更新一次房间列表
    const roomsUpdateInterval = setInterval(broadcastRoomsList, 2000);

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
        
        // 在连接时立即发送房间列表
        socket.emit('roomsListUpdate', getRoomsList());

        // 创建房间
        socket.on('createRoom', (username) => {
            console.log(`Player ${username} creating room`);
            const roomId = generateRoomId();
            const game = new Game(roomId, socket.id);
            game.addPlayer(socket.id, username);
            games.set(roomId, game);
            
            socket.join(roomId);
            socket.emit('roomCreated', { roomId, playerId: socket.id });
            
            // 广播房间状态
            io.to(roomId).emit('gameStateUpdate', game.getGameState());
            // 立即广播房间列表更新
            broadcastRoomsList();
        });

        // 加入房间
        socket.on('joinRoom', ({ roomId, playerName: username }) => {
            console.log(`Player ${username} trying to join room ${roomId}`);
            const game = games.get(roomId);
            
            if (!game) {
                console.log(`Room ${roomId} not found`);
                socket.emit('joinError', '房间不存在');
                return;
            }
            
            if (game.state !== 'waiting') {
                console.log(`Room ${roomId} game already started`);
                socket.emit('joinError', '游戏已经开始');
                return;
            }

            if (game.players.has(socket.id)) {
                console.log(`Player ${socket.id} already in room`);
                socket.emit('joinError', '你已经在房间中');
                return;
            }

            game.addPlayer(socket.id, username);
            socket.join(roomId);
            
            // 发送玩家加入成功事件
            socket.emit('playerJoined');
            
            // 广播房间状态更新
            io.to(roomId).emit('gameStateUpdate', game.getGameState());
            // 立即广播房间列表更新
            broadcastRoomsList();
            
            console.log(`Player ${username} successfully joined room ${roomId}`);
        });

        // 开始游戏
        socket.on('startGame', (roomId) => {
            const game = games.get(roomId);
            // 检查是否是房主
            if (!game || game.hostId !== socket.id) {
                socket.emit('gameError', '只有房主可以开始游戏');
                return;
            }

            if (game.players.size < 4) {
                socket.emit('gameError', '玩家数量不足，无法开始游戏');
                return;
            }

            if (game.startGame()) {
                game.players.forEach((player, playerId) => {
                    io.to(playerId).emit('gameStarted', {
                        role: player.role,
                        word: player.word,
                        speakingOrder: game.speakingOrder
                    });
                });
                io.to(roomId).emit('gameStateUpdate', game.getGameState());
            }
        });

        // 发言结束
        socket.on('finishSpeaking', (roomId) => {
            const game = games.get(roomId);
            if (!game || game.currentSpeaker !== socket.id) return;

            const currentIndex = game.speakingOrder.indexOf(game.currentSpeaker);
            const nextIndex = (currentIndex + 1) % game.speakingOrder.length;
            
            if (nextIndex === 0) {
                game.state = 'voting';
                io.to(roomId).emit('votingStart');
            } else {
                game.currentSpeaker = game.speakingOrder[nextIndex];
                io.to(roomId).emit('nextSpeaker', { speakerId: game.currentSpeaker });
            }
            
            io.to(roomId).emit('gameStateUpdate', game.getGameState());
        });

        // 投票
        socket.on('vote', ({ roomId, targetId }) => {
            const game = games.get(roomId);
            if (!game) return;

            if (game.vote(socket.id, targetId)) {
                io.to(roomId).emit('voteUpdated', {
                    votes: Array.from(game.votes.entries())
                });

                if (game.votes.size === game.players.size) {
                    const result = game.calculateVoteResult();
                    if (result) {
                        io.to(roomId).emit('gameOver', { winner: result });
                        games.delete(roomId);
                    } else {
                        game.state = 'speaking';
                        game.resetVotes();
                        game.currentRound++;
                        io.to(roomId).emit('nextRound');
                    }
                }
                
                io.to(roomId).emit('gameStateUpdate', game.getGameState());
            }
        });

        // 聊天功能
        socket.on('sendMessage', ({ roomId, message }) => {
            const game = games.get(roomId);
            if (!game) return;

            const player = game.players.get(socket.id);
            io.to(roomId).emit('newMessage', {
                playerId: socket.id,
                playerName: player.name,
                message
            });
        });

        // 请求房间列表
        socket.on('getRoomsList', () => {
            socket.emit('roomsListUpdate', getRoomsList());
        });

        // 断开连接处理
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            
            for (const [roomId, game] of games.entries()) {
                if (game.players.has(socket.id)) {
                    const player = game.players.get(socket.id);

                    // 如果是房主断开连接，转移房主权限给下一个玩家
                    if (game.hostId === socket.id) {
                        const remainingPlayers = Array.from(game.players.keys());
                        const newHostId = remainingPlayers.find(id => id !== socket.id);
                        if (newHostId) {
                            game.transferHost(newHostId);
                        }
                    }

                    const result = game.removePlayer(socket.id);
                    
                    // 广播玩家离开事件
                    io.to(roomId).emit('playerLeft', {
                        playerId: socket.id,
                        playerName: player.name,
                        newState: game.getGameState()
                    });

                    if (result) {
                        io.to(roomId).emit('gameOver', { winner: result });
                        games.delete(roomId);
                    } else if (game.players.size < 4) {
                        io.to(roomId).emit('gameError', '玩家数量不足，游戏终止');
                        games.delete(roomId);
                    }
                    
                    // 更新房间列表
                    broadcastRoomsList();
                    break;
                }
            }
        });

        // 退出房间
        socket.on('leaveRoom', (roomId) => {
            const game = games.get(roomId);
            if (!game) return;

            // 获取玩家信息，用于广播退出消息
            const player = game.players.get(socket.id);
            if (!player) return;

            // 如果是房主退出且还有其他玩家，转移房主权限
            if (game.hostId === socket.id && game.players.size > 1) {
                const remainingPlayers = Array.from(game.players.keys()).filter(id => id !== socket.id);
                game.transferHost(remainingPlayers[0]);
            }

            // 从房间中移除玩家
            socket.leave(roomId);
            const result = game.removePlayer(socket.id);

            // 广播玩家离开事件
            io.to(roomId).emit('playerLeft', {
                playerId: socket.id,
                playerName: player.name,
                newState: game.getGameState()
            });

            if (result) {
                io.to(roomId).emit('gameOver', { winner: result });
                games.delete(roomId);
            } else if (game.players.size === 0) {
                // 如果房间空了，删除房间
                games.delete(roomId);
            } else if (game.players.size < 4 && game.state !== 'waiting') {
                // 如果游戏已经开始且人数不足，终止游戏
                io.to(roomId).emit('gameError', '玩家数量不足，游戏终止');
                games.delete(roomId);
            }

            // 更新房间列表
            broadcastRoomsList();
        });
    });

    // 当服务器关闭时清理定时器
    return () => {
        clearInterval(roomsUpdateInterval);
    };
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

module.exports = { handleGameEvents }; 