class GameManager {
    constructor() {
        this.game = null;
        this.onGameStateUpdate = null;
        this.onNewMessage = null;
        this.onGameOver = null;
        this.onVoteUpdate = null;
        this.onRoundStart = null;
    }

    // 创建新游戏
    createGame(playerName) {
        this.game = new Game('LOCAL', 'host');
        // 添加人类玩家
        this.game.addPlayer('host', playerName);
        this.notifyGameStateUpdate();
    }

    // 添加AI玩家
    addAIPlayer() {
        if (!this.game) return;
        const aiName = `AI玩家${this.game.players.size + 1}`;
        this.game.addAIPlayer(aiName);
        this.notifyGameStateUpdate();
    }

    // 开始游戏
    startGame() {
        if (!this.game || this.game.players.size < 4) return false;

        if (this.game.startGame()) {
            this.notifyGameStateUpdate();
            this.handleAIActions();
            return true;
        }
        return false;
    }

    // 结束发言
    finishSpeaking() {
        if (!this.game) return;
        
        if (this.game.finishSpeaking('host')) {
            this.notifyGameStateUpdate();
            if (this.game.state === 'voting') {
                this.notifyVotingStart();
            }
            this.handleAIActions();
        }
    }

    // 投票
    vote(targetId) {
        if (!this.game) return;

        if (this.game.vote('host', targetId)) {
            this.notifyVoteUpdate();
            
            if (!this.game.currentVoter) {
                const result = this.game.calculateVoteResult();
                if (result) {
                    this.notifyGameOver(result);
                } else {
                    this.game.startNewRound();
                    this.notifyRoundStart();
                    this.handleAIActions();
                }
            } else {
                this.handleAIActions();
            }
        }
    }

    // 发送消息
    sendMessage(message) {
        if (!this.game) return;
        
        const chatMessage = {
            playerId: 'host',
            playerName: this.game.players.get('host').name,
            message,
            timestamp: Date.now()
        };
        
        this.game.addChatMessage(chatMessage);
        this.notifyNewMessage(chatMessage);
    }

    // AI行为处理
    async handleAIActions() {
        const aiAction = await this.game.handleAITurn();
        if (!aiAction) return;

        if (aiAction.type === 'speech') {
            const aiPlayer = aiAction.aiPlayer;
            const playerName = this.game.players.get(aiAction.playerId).name;

            let fullMessage = '';
            try {
                for await (const chunk of aiPlayer.generateSpeech()) {
                    fullMessage += chunk;
                    // 通知UI更新AI的发言
                    this.notifyAISpeaking(aiAction.playerId, playerName, chunk);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const chatMessage = {
                    playerId: aiAction.playerId,
                    playerName: playerName,
                    message: fullMessage,
                    timestamp: Date.now()
                };
                this.game.addChatMessage(chatMessage);
                this.notifyNewMessage(chatMessage);

                setTimeout(() => {
                    if (this.game.finishSpeaking(aiAction.playerId)) {
                        this.notifyGameStateUpdate();
                        if (this.game.state === 'voting') {
                            this.notifyVotingStart();
                        }
                        this.handleAIActions();
                    }
                }, 1000);
            } catch (error) {
                console.error('AI发言出错:', error);
                // ... 错误处理 ...
            }
        }

        if (aiAction.type === 'vote') {
            if (this.game.vote(aiAction.playerId, aiAction.targetId)) {
                this.notifyVoteUpdate();
                this.handleAIActions();
            }
        }
    }

    // 通知方法
    notifyGameStateUpdate() {
        if (this.onGameStateUpdate) {
            this.onGameStateUpdate(this.game.getGameState());
        }
    }

    notifyNewMessage(message) {
        if (this.onNewMessage) {
            this.onNewMessage(message);
        }
    }

    notifyGameOver(result) {
        if (this.onGameOver) {
            this.onGameOver(result);
        }
    }

    notifyVoteUpdate() {
        if (this.onVoteUpdate) {
            this.onVoteUpdate({
                votes: Array.from(this.game.votes.entries()),
                nextVoter: this.game.currentVoter
            });
        }
    }

    notifyRoundStart() {
        if (this.onRoundStart) {
            this.onRoundStart({
                round: this.game.currentRound,
                currentSpeaker: this.game.currentSpeaker,
                eliminatedPlayer: this.game.lastEliminatedPlayer
            });
        }
    }

    notifyAISpeaking(playerId, playerName, message) {
        if (this.onAISpeaking) {
            this.onAISpeaking({
                playerId,
                playerName,
                message,
                isComplete: false
            });
        }
    }
}

export default GameManager; 