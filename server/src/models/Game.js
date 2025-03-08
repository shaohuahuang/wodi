const { getRandomWordPair } = require('./wordPairs');

class Game {
    constructor(roomId) {
        this.roomId = roomId;
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
    }

    addPlayer(playerId, playerName) {
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
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
        if (this.state !== 'voting') return false;
        if (!this.players.get(voterId).isAlive) return false;
        
        this.votes.set(voterId, targetId);
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
        }

        return this.checkGameEnd();
    }

    checkGameEnd() {
        let aliveCivilians = 0;
        let aliveUndercovers = 0;

        this.players.forEach(player => {
            if (player.isAlive) {
                if (player.role === 'civilian') aliveCivilians++;
                else aliveUndercovers++;
            }
        });

        if (aliveUndercovers === 0) return 'civilians';
        if (aliveUndercovers >= aliveCivilians) return 'undercovers';
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

        return this.checkGameEnd();
    }

    getGameState() {
        return {
            state: this.state,
            players: Array.from(this.players.values()).map(player => ({
                id: player.id,
                name: player.name,
                isAlive: player.isAlive,
                // 不要在这里返回role和word，以保持游戏公平性
            })),
            currentSpeaker: this.currentSpeaker,
            currentRound: this.currentRound,
            votes: Array.from(this.votes.entries())
        };
    }
}

module.exports = Game; 