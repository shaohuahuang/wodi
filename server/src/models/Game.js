const { getRandomWordPair } = require('./wordPairs');

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

    startGame() {
        if (this.players.size < 4) return false;
        
        // 分配角色
        this.assignRoles();
        // 设置发言顺序
        this.speakingOrder = Array.from(this.players.keys());
        this.shuffleArray(this.speakingOrder);
        this.state = 'speaking';
        this.currentSpeaker = this.speakingOrder[0];
        
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
        // 检查是否是投票阶段
        if (this.state !== 'voting') return false;
        
        // 检查是否轮到该玩家投票
        if (voterId !== this.currentVoter) return false;
        
        // 检查投票者是否存活
        const voter = this.players.get(voterId);
        if (!voter || !voter.isAlive) return false;
        
        // 检查目标玩家是否存活
        const target = this.players.get(targetId);
        if (!target || !target.isAlive) return false;
        
        this.votes.set(voterId, targetId);
        
        // 更新下一个投票者
        this.currentVoter = this.getNextVoter();
        
        return true;
    }

    calculateVoteResult() {
        const voteCount = new Map();
        this.votes.forEach((targetId) => {
            voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1);
        });

        let maxVotes = 0;
        let eliminated = null;
        
        voteCount.forEach((count, playerId) => {
            if (count > maxVotes) {
                maxVotes = count;
                eliminated = playerId;
            }
        });

        if (eliminated) {
            const player = this.players.get(eliminated);
            player.isAlive = false;
            this.lastEliminatedPlayer = {
                id: eliminated,
                name: player.name,
                role: player.role
            };
        }

        return this.checkGameEnd();
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
    }
}

module.exports = Game; 