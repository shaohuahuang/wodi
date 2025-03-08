class GameManager {
    constructor() {
        this.roomId = 'LOCAL_GAME';
        this.hostId = 'host';
        this.onGameStateUpdate = null;
        this.onNewMessage = null;
        this.onGameOver = null;
        this.onVoteUpdate = null;
        this.onRoundStart = null;
        this.onAISpeaking = null;
    }

    // 创建新游戏
    createGame(playerName) {
        // 初始化游戏状态，包含房主
        this.gameState = {
            players: [{
                id: 'host',
                name: playerName,
                isAlive: true,
                isHost: true
            }],
            currentPhase: 'waiting',
            myRole: null,
            myWord: null,
            currentSpeaker: null,
            currentVoter: null,
            hostId: 'host'
        };

        console.log('Game created with host:', this.gameState);
        this.notifyGameStateUpdate();
    }

    // 添加AI玩家
    addAIPlayer() {
        if (!this.gameState) return;
        
        // 检查是否达到最大玩家数
        if (this.gameState.players.length >= 8) {
            console.log('已达到最大玩家数量');
            return;
        }

        // 生成AI玩家ID和名字
        const aiName = `AI玩家${this.gameState.players.length}`;
        const aiId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 添加AI玩家到玩家列表
        this.gameState.players.push({
            id: aiId,
            name: aiName,
            isAlive: true,
            isAI: true
        });

        console.log(`Added AI player: ${aiName}`);
        this.notifyGameStateUpdate();
    }

    // 开始游戏
    startGame() {
        if (this.gameState.players.length < 4) return false;

        // 分配角色和词语
        const totalPlayers = this.gameState.players.length;
        const undercoverCount = Math.floor(totalPlayers / 4); // 每4个人1个卧底
        const roles = new Array(totalPlayers).fill('civilian');
        
        // 随机选择卧底
        for (let i = 0; i < undercoverCount; i++) {
            let index;
            do {
                index = Math.floor(Math.random() * totalPlayers);
            } while (roles[index] === 'undercover');
            roles[index] = 'undercover';
        }

        // 获取词语对
        const words = {
            civilian: '手机',
            undercover: '电话'
        };

        // 分配角色和词语给玩家
        this.gameState.players = this.gameState.players.map((player, index) => ({
            ...player,
            role: roles[index],
            word: roles[index] === 'civilian' ? words.civilian : words.undercover
        }));

        // 设置游戏状态
        this.gameState = {
            ...this.gameState,
            currentPhase: 'speaking',
            myRole: roles[0], // 房主的角色
            myWord: roles[0] === 'civilian' ? words.civilian : words.undercover,
            currentSpeaker: this.gameState.players[0].id, // 从第一个玩家开始
            currentRound: 1,
            votes: new Map(),
            speakingOrder: this.gameState.players.map(p => p.id)
        };

        // 通知游戏开始
        this.notifyGameStateUpdate();

        // 如果第一个说话的是AI，开始AI行为
        if (this.gameState.currentSpeaker !== 'host') {
            this.handleAIActions();
        }

        return true;
    }

    // 添加处理AI行为的方法
    async handleAIActions() {
        // 获取当前AI玩家
        const currentPlayer = this.gameState.players.find(p => 
            p.id === this.gameState.currentSpeaker && p.id !== 'host'
        );

        if (!currentPlayer) return;

        // 模拟AI发言
        const aiMessage = `我是${currentPlayer.name}，我觉得这个词是...`;
        
        // 逐字显示AI发言
        for (let i = 0; i < aiMessage.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            this.notifyAISpeaking({
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                message: aiMessage.slice(0, i + 1),
                isComplete: i === aiMessage.length - 1
            });
        }

        // 发送完整消息
        const chatMessage = {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            message: aiMessage,
            timestamp: Date.now()
        };
        this.notifyNewMessage(chatMessage);

        // 延迟后结束AI发言
        setTimeout(() => {
            this.finishSpeaking(currentPlayer.id);
        }, 1000);
    }

    // 修改结束发言方法
    finishSpeaking(playerId) {
        if (this.gameState.currentSpeaker !== playerId) return;

        const currentIndex = this.gameState.speakingOrder.indexOf(playerId);
        const nextIndex = (currentIndex + 1) % this.gameState.speakingOrder.length;

        if (nextIndex === 0) {
            // 一轮发言结束，进入投票阶段
            this.gameState.currentPhase = 'voting';
            this.gameState.currentVoter = this.gameState.speakingOrder[this.gameState.speakingOrder.length - 1];
            this.gameState.votes = new Map();
        } else {
            // 下一个玩家发言
            this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
        }

        this.notifyGameStateUpdate();

        // 如果下一个是AI玩家，自动开始AI行为
        if (this.gameState.currentSpeaker !== 'host' && this.gameState.currentPhase === 'speaking') {
            this.handleAIActions();
        }
    }

    // 投票
    vote(targetId) {
        // 实现投票逻辑
    }

    // 发送消息
    sendMessage(message) {
        const chatMessage = {
            playerId: 'host',
            playerName: this.gameState.players[0].name,
            message,
            timestamp: Date.now()
        };
        this.notifyNewMessage(chatMessage);
    }

    // 通知方法
    notifyGameStateUpdate() {
        if (this.onGameStateUpdate) {
            this.onGameStateUpdate({...this.gameState}); // 发送游戏状态的副本
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

    notifyVoteUpdate(voteData) {
        if (this.onVoteUpdate) {
            this.onVoteUpdate(voteData);
        }
    }

    notifyRoundStart(roundData) {
        if (this.onRoundStart) {
            this.onRoundStart(roundData);
        }
    }

    notifyAISpeaking(speechData) {
        if (this.onAISpeaking) {
            this.onAISpeaking(speechData);
        }
    }
}

export default GameManager; 