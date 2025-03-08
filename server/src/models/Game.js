const { getRandomWordPair } = require('./wordPairs');
const AIPlayer = require('./AIPlayer');

class Game {
    constructor(roomId, hostId) {
        this.roomId = roomId;
        this.hostId = hostId;
        this.players = new Map(); // 玩家信息
        this.state = 'waiting';   // waiting, speaking, voting, ended
        this.currentRound = 0;
        this.words = getRandomWordPair();
        this.speakingOrder = []; // 发言顺序
        this.currentSpeaker = null;
        this.votes = new Map();   // 投票结果
        this.timeLimit = {
            speaking: 60,         // 发言时限（秒）
            voting: 30           // 投票时限（秒）
        };
        this.timer = null;
        this.lastEliminatedPlayer = null;  // 记录最后被淘汰的玩家
        this.currentVoter = null;  // 添加当前投票者追踪
        this.aiPlayers = new Map(); // 存储AI玩家
        this.chatHistory = [];    // 存储所有聊天记录
        this.voteHistory = [];    // 存储所有投票记录
        this.roundHistory = [];   // 存储每轮的结果
    }

    addPlayer(playerId, username) {
        this.players.set(playerId, {
            id: playerId,
            name: username,
            role: null,
            isAlive: true,
            word: null
        });
    }

    addAIPlayer(name) {
        const aiPlayer = new AIPlayer(name, this.getGameState());
        const aiId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.players.set(aiId, {
            id: aiId,
            name: name,
            role: null,
            isAlive: true,
            word: null,
            isAI: true
        });
        this.aiPlayers.set(aiId, aiPlayer);
        return aiId;
    }

    startGame() {
        if (this.players.size < 4) return false;
        
        // 分配角色
        this.assignRoles();
        // 设置发言顺序
        this.speakingOrder = Array.from(this.players.keys());
        this.shuffleArray(this.speakingOrder);
        this.state = 'speaking';
        this.currentSpeaker = this.speakingOrder[0];
        
        this.aiPlayers.forEach((ai, aiId) => {
            const player = this.players.get(aiId);
            ai.role = player.role;
            ai.word = player.word;
            ai.updateGameState(this.getGameState());
        });
        
        return true;
    }

    assignRoles() {
        const playerIds = Array.from(this.players.keys());
        this.shuffleArray(playerIds);
        
        // 根据玩家数量决定卧底数量
        const undercoverCount = Math.floor(this.players.size / 4);
        
        playerIds.forEach((playerId, index) => {
            const player = this.players.get(playerId);
            if (index < undercoverCount) {
                player.role = 'undercover';
                player.word = this.words.undercover;
            } else {
                player.role = 'civilian';
                player.word = this.words.civilian;
            }
        });
    }

    vote(voterId, targetId) {
        if (!super.vote(voterId, targetId)) return false;
        
        this.addVoteRecord(voterId, targetId);
        return true;
    }

    calculateVoteResult() {
        const eliminated = super.calculateVoteResult();
        if (eliminated) {
            this.addRoundResult(eliminated);
        }
        return eliminated;
    }

    checkGameEnd() {
        let aliveCivilians = 0;
        let aliveUndercovers = 0;
        
        // 获取所有平民和卧底的名字
        const civilians = Array.from(this.players.values())
            .filter(p => p.role === 'civilian')
            .map(p => p.name);
        
        const undercovers = Array.from(this.players.values())
            .filter(p => p.role === 'undercover')
            .map(p => p.name);

        // 计算存活人数
        this.players.forEach(player => {
            if (player.isAlive) {
                if (player.role === 'civilian') aliveCivilians++;
                else aliveUndercovers++;
            }
        });

        // 卧底全部出局或平民只剩一人时，游戏结束
        if (aliveUndercovers === 0 || (aliveCivilians <= 1 && aliveUndercovers > 0)) {
            // 重置游戏状态
            this.resetGameState();
            
            if (aliveUndercovers === 0) {
                return {
                    winner: 'civilians',
                    message: '所有卧底已被找出，平民胜利！',
                    civilians,
                    undercovers
                };
            } else {
                return {
                    winner: 'undercovers',
                    message: '平民人数不足，卧底胜利！',
                    civilians,
                    undercovers
                };
            }
        }

        // 游戏继续
        return null;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    resetVotes() {
        this.votes.clear();
    }

    removePlayer(playerId) {
        // 在删除玩家之前记录是否是房主
        const wasHost = this.hostId === playerId;
        
        // 删除玩家
        this.players.delete(playerId);
        this.votes.delete(playerId);
        
        // 更新发言顺序
        const speakerIndex = this.speakingOrder.indexOf(playerId);
        if (speakerIndex !== -1) {
            this.speakingOrder.splice(speakerIndex, 1);
        }

        // 如果是当前发言者，移到下一个
        if (this.currentSpeaker === playerId) {
            const nextIndex = speakerIndex % this.speakingOrder.length;
            this.currentSpeaker = this.speakingOrder[nextIndex];
        }

        // 如果删除的是房主且还有其他玩家，需要转移房主权限
        if (wasHost && this.players.size > 0) {
            this.hostId = Array.from(this.players.keys())[0];
        }

        return this.checkGameEnd();
    }

    getGameState() {
        const activePlayers = Array.from(this.players.values()).map(player => ({
            id: player.id,
            name: player.name,
            isAlive: player.isAlive,
        }));

        return {
            state: this.state,
            players: activePlayers,
            hostId: this.hostId,
            currentSpeaker: this.currentSpeaker,
            currentVoter: this.currentVoter,  // 添加当前投票者信息
            currentRound: this.currentRound,
            votes: Array.from(this.votes.entries()),
            lastEliminatedPlayer: this.lastEliminatedPlayer
        };
    }

    transferHost(newHostId) {
        if (this.players.has(newHostId)) {
            this.hostId = newHostId;
            return true;
        }
        return false;
    }

    // 获取存活玩家数量
    getAlivePlayersCount() {
        return Array.from(this.players.values()).filter(p => p.isAlive).length;
    }

    // 开始新一轮
    startNewRound() {
        // 重置投票
        this.votes.clear();
        
        // 更新回合数
        this.currentRound++;
        
        // 重新设置游戏状态为发言阶段
        this.state = 'speaking';
        this.currentVoter = null;  // 重置当前投票者
        
        // 更新发言顺序（只包含存活玩家）
        this.speakingOrder = Array.from(this.players.entries())
            .filter(([_, player]) => player.isAlive)
            .map(([id, _]) => id);
        this.shuffleArray(this.speakingOrder);
        
        // 设置第一个发言者
        this.currentSpeaker = this.speakingOrder[0];
    }

    // 开始投票阶段
    startVoting() {
        this.state = 'voting';
        this.votes.clear();
        // 设置第一个投票者（使用发言顺序的反向）
        this.currentVoter = this.speakingOrder[this.speakingOrder.length - 1];
    }

    // 获取下一个投票者
    getNextVoter() {
        const currentIndex = this.speakingOrder.indexOf(this.currentVoter);
        if (currentIndex === -1) return null;
        
        // 反向遍历发言顺序
        let nextIndex = currentIndex - 1;
        while (nextIndex >= 0) {
            const nextVoterId = this.speakingOrder[nextIndex];
            const nextVoter = this.players.get(nextVoterId);
            if (nextVoter && nextVoter.isAlive) {
                return nextVoterId;
            }
            nextIndex--;
        }
        return null;  // 所有人都投票完了
    }

    // 添加重置游戏状态的方法
    resetGameState() {
        this.state = 'waiting';
        this.currentRound = 0;
        this.currentSpeaker = null;
        this.currentVoter = null;
        this.votes.clear();
        this.words = getRandomWordPair();
        this.speakingOrder = [];
        this.lastEliminatedPlayer = null;
        
        // 重置所有玩家状态
        this.players.forEach(player => {
            player.role = null;
            player.word = null;
            player.isAlive = true;
        });

        this.chatHistory = [];
        this.voteHistory = [];
        this.roundHistory = [];
        
        // 重置所有AI玩家的历史记录
        this.aiPlayers.forEach(ai => {
            ai.chatHistory = [];
            ai.voteHistory = [];
            ai.eliminatedPlayers = [];
        });
    }

    // 当收到消息时更新AI的历史记录
    updateAIHistory(message) {
        this.aiPlayers.forEach(ai => {
            ai.addToHistory(message);
        });
    }

    // 处理AI的自动行为
    async handleAITurn() {
        // 检查是否是AI的回合
        if (this.state === 'speaking' && this.isCurrentPlayerAI()) {
            const aiPlayer = this.aiPlayers.get(this.currentSpeaker);
            if (!aiPlayer) return null;

            return {
                type: 'speech',
                playerId: this.currentSpeaker,
                aiPlayer: aiPlayer  // 返回AI玩家实例，而不是直接生成内容
            };
        }
        
        if (this.state === 'voting' && this.isCurrentVoterAI()) {
            const aiPlayer = this.aiPlayers.get(this.currentVoter);
            const alivePlayers = Array.from(this.players.values())
                .filter(p => p.isAlive && p.id !== this.currentVoter);
            const targetId = await aiPlayer.decideVote(alivePlayers);
            return {
                type: 'vote',
                playerId: this.currentVoter,
                targetId: targetId
            };
        }
        
        return null;
    }

    isCurrentPlayerAI() {
        return this.currentSpeaker && this.aiPlayers.has(this.currentSpeaker);
    }

    isCurrentVoterAI() {
        return this.currentVoter && this.aiPlayers.has(this.currentVoter);
    }

    finishSpeaking(playerId) {
        if (this.currentSpeaker !== playerId) return false;

        const currentIndex = this.speakingOrder.indexOf(this.currentSpeaker);
        const nextIndex = (currentIndex + 1) % this.speakingOrder.length;
        
        if (nextIndex === 0) {
            // 开始投票阶段
            this.state = 'voting';
            this.votes.clear();
            // 设置第一个投票者（使用发言顺序的反向）
            this.currentVoter = this.speakingOrder[this.speakingOrder.length - 1];
        } else {
            this.currentSpeaker = this.speakingOrder[nextIndex];
        }
        
        return true;
    }

    // 添加聊天记录
    addChatMessage(message) {
        this.chatHistory.push(message);
        // 同时更新所有AI玩家的历史记录
        this.aiPlayers.forEach(ai => {
            ai.addToHistory(message);
        });
    }

    // 添加投票记录
    addVoteRecord(voterId, targetId) {
        const voter = this.players.get(voterId);
        const target = this.players.get(targetId);
        const voteRecord = {
            round: this.currentRound,
            voter: voter.name,
            target: target.name,
            timestamp: Date.now()
        };
        this.voteHistory.push(voteRecord);
    }

    // 记录每轮结果
    addRoundResult(eliminatedPlayer = null) {
        const roundResult = {
            round: this.currentRound,
            eliminated: eliminatedPlayer ? {
                name: eliminatedPlayer.name,
                role: eliminatedPlayer.role
            } : null,
            votes: Array.from(this.votes.entries()).map(([voterId, targetId]) => ({
                voter: this.players.get(voterId).name,
                target: this.players.get(targetId).name
            }))
        };
        this.roundHistory.push(roundResult);
    }

    // 获取完整的游戏历史
    getGameHistory() {
        return {
            chatHistory: this.chatHistory,
            voteHistory: this.voteHistory,
            roundHistory: this.roundHistory
        };
    }
}

module.exports = Game; 