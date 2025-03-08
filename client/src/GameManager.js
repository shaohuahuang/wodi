// 添加词语对数据
const WORD_PAIRS = [
    { civilian: '手机', undercover: '电话' },
    { civilian: '可乐', undercover: '雪碧' },
    { civilian: '笔记本电脑', undercover: '平板电脑' },
    { civilian: '微信', undercover: 'QQ' },
    { civilian: '支付宝', undercover: '微信支付' },
    { civilian: '百度', undercover: '谷歌' },
    { civilian: '西瓜', undercover: '哈密瓜' },
    { civilian: '篮球', undercover: '排球' },
    { civilian: '眼镜', undercover: '隐形眼镜' },
    { civilian: '耳机', undercover: '音响' }
];

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
        this.messages = [];  // 添加消息历史记录
        this.gameState = {
            players: [],
            currentPhase: 'waiting',
            myRole: null,
            myWord: null,
            currentSpeaker: null,
            currentVoter: null,
            hostId: 'host'
        };
        this.wordPairs = [...WORD_PAIRS];
        this.settings = {
            maxPlayers: 8,
            minPlayers: 4,
            undercoverRatio: 4, // 每4个人1个卧底
            votingTime: 30, // 投票时间限制（秒）
            speakingTime: 60, // 发言时间限制（秒）
        };
        this.timer = null;
        this.timeLeft = 0;
        this.onTimerUpdate = null;
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
        if (this.gameState.players.length < this.settings.minPlayers) return false;
        if (this.gameState.players.length > this.settings.maxPlayers) return false;

        // 随机选择一对词语
        const wordPairIndex = Math.floor(Math.random() * this.wordPairs.length);
        const words = this.wordPairs[wordPairIndex];

        // 分配角色和词语
        const totalPlayers = this.gameState.players.length;
        const undercoverCount = Math.floor(totalPlayers / this.settings.undercoverRatio); // 每4个人1个卧底
        const roles = new Array(totalPlayers).fill('civilian');
        
        // 随机选择卧底
        for (let i = 0; i < undercoverCount; i++) {
            let index;
            do {
                index = Math.floor(Math.random() * totalPlayers);
            } while (roles[index] === 'undercover');
            roles[index] = 'undercover';
        }

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

    // 调用大模型接口
    async callLLM(prompt, onChunk) {
        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: "deepseek-r1:8b",
                    prompt: prompt,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error('API调用失败');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullMessage = '';
            let isThinking = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            const text = data.response;
                            // 检查是否进入或退出思考模式
                            if (text.includes('<think>')) {
                                isThinking = true;
                            }
                            if (text.includes('</think>')) {
                                isThinking = false;
                                continue;
                            }
                            
                            // 只有在非思考模式下才显示文本
                            if (!isThinking && !text.includes('<think>') && !text.includes('</think>')) {
                                fullMessage += text;
                                onChunk(text);
                            }
                        }
                    } catch (e) {
                        console.error('解析响应出错:', e);
                    }
                }
            }

            return fullMessage;
        } catch (error) {
            console.error('调用大模型接口出错:', error);
            return '对不起，我现在有点混乱...';
        }
    }

    // 修改AI行为处理方法
    async handleAIActions() {
        const currentPlayer = this.gameState.players.find(p => 
            p.id === this.gameState.currentSpeaker && p.id !== 'host'
        );

        if (!currentPlayer) return;

        // 构建提示词
        const prompt = this.buildAIPrompt(currentPlayer);
        
        try {
            // 逐字输出AI的发言
            const fullMessage = await this.callLLM(prompt, (chunk) => {
                this.notifyAISpeaking({
                    playerId: currentPlayer.id,
                    playerName: currentPlayer.name,
                    message: chunk,
                    isComplete: false
                });
            });

            // 添加到消息历史记录
            const chatMessage = {
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                message: fullMessage,
                timestamp: Date.now(),
                type: 'speech'
            };
            this.messages.push(chatMessage);

            // 通知AI发言完成
            this.notifyAISpeaking({
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                message: fullMessage,
                isComplete: true
            });

            // 延迟后结束AI发言
            setTimeout(() => {
                this.finishSpeaking(currentPlayer.id);
            }, 1000);
        } catch (error) {
            console.error('AI发言出错:', error);
            const errorMessage = {
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                message: '对不起，我现在有点混乱...',
                timestamp: Date.now(),
                type: 'speech'
            };
            this.messages.push(errorMessage);
            this.notifyAISpeaking({
                ...errorMessage,
                isComplete: true
            });
            
            // 即使出错也要继续游戏
            setTimeout(() => {
                this.finishSpeaking(currentPlayer.id);
            }, 1000);
        }
    }

    // 构建AI提示词
    buildAIPrompt(currentPlayer) {
        const gameInfo = {
            currentRound: this.gameState.currentRound,
            totalPlayers: this.gameState.players.length,
            myWord: currentPlayer.word,
            myRole: currentPlayer.role,
            previousSpeeches: this.messages
                .filter(m => m.type === 'speech')
                .map(m => ({
                    playerName: m.playerName,
                    content: m.message
                }))
        };

        return `你正在参与一个谁是卧底游戏，你需要扮演一个普通的游戏玩家"${currentPlayer.name}"。
你的词语是"${currentPlayer.word}"，身份是${currentPlayer.role === 'undercover' ? '卧底' : '平民'}。

要求：
1. 你的回答要像一个真实的玩家，语气要自然随意
2. 描述要基于你的词语的实际特征，但要含糊其辞
3. 不要重复其他玩家已经说过的特征或描述
4. 发言要简短自然，控制在30个字以内
5. 如果是平民：
   - 要描述你词语的独特特征，但不能直接说出这个词
   - 要基于词语的真实属性来描述，避免编造不存在的特征
6. 如果是卧底：
   - 要假装理解其他人的描述，适当跟随大家的思路
   - 描述时要基于你的词语，但要让它听起来像在描述平民的词
   - 要巧妙地误导，但不要过分明显

之前的发言：
${gameInfo.previousSpeeches.map(s => `${s.playerName}: ${s.content}`).join('\n')}

请直接给出你的发言内容，不要有任何解释或推理过程。记住要说一些新的、未被提及过的特征。`;
    }

    // 修改结束发言方法
    finishSpeaking(playerId) {
        this.stopTimer();
        console.log('Finishing speech for player:', playerId); // 调试日志

        // 检查是否是当前发言者
        if (this.gameState.currentSpeaker !== playerId) {
            console.log('Not current speaker:', playerId);
            return;
        }

        // 获取下一个发言者
        const currentIndex = this.gameState.speakingOrder.indexOf(playerId);
        const nextIndex = (currentIndex + 1) % this.gameState.speakingOrder.length;
        console.log('Current index:', currentIndex, 'Next index:', nextIndex);

        if (nextIndex === 0) {
            // 一轮发言结束，进入投票阶段
            this.gameState.currentPhase = 'voting';
            this.gameState.currentVoter = this.gameState.speakingOrder[this.gameState.speakingOrder.length - 1];
            this.gameState.votes = new Map();
            console.log('Round finished, entering voting phase');
        } else {
            // 下一个玩家发言
            this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
            console.log('Next speaker:', this.gameState.currentSpeaker);
        }

        // 更新游戏状态
        this.notifyGameStateUpdate();

        // 如果下一个是AI玩家，自动开始AI行为
        if (this.gameState.currentSpeaker !== 'host' && this.gameState.currentPhase === 'speaking') {
            console.log('Starting AI actions for next speaker');
            setTimeout(() => {
                this.handleAIActions();
            }, 1000); // 给一个短暂的延迟，让UI有时间更新
        }
    }

    // 投票
    vote(targetId) {
        this.stopTimer();
        if (this.gameState.currentPhase !== 'voting' || 
            this.gameState.currentVoter !== 'host') return;

        // 记录投票
        this.gameState.votes.set('host', targetId);
        
        // 添加投票记录到消息
        const voter = this.gameState.players.find(p => p.id === 'host');
        const target = this.gameState.players.find(p => p.id === targetId);
        const voteMessage = {
            system: true,
            type: 'vote',
            message: `${voter.name} 投票给了 ${target.name}`,
            timestamp: Date.now()
        };
        this.messages.push(voteMessage);
        this.notifyNewMessage(voteMessage);

        // 获取下一个投票者
        const currentIndex = this.gameState.speakingOrder.indexOf('host');
        const nextIndex = (currentIndex + 1) % this.gameState.speakingOrder.length;
        
        if (nextIndex === 0) {
            // 所有人都投票完成，计算结果
            this.calculateVoteResult();
        } else {
            // 下一个玩家投票
            this.gameState.currentVoter = this.gameState.speakingOrder[nextIndex];
            this.notifyVoteUpdate({
                votes: Array.from(this.gameState.votes.entries()),
                nextVoter: this.gameState.currentVoter
            });

            // 如果下一个是AI玩家，自动投票
            if (this.gameState.currentVoter !== 'host') {
                this.handleAIVote();
            }
        }
    }

    // 处理AI投票
    async handleAIVote() {
        const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentVoter);
        if (!currentPlayer) return;

        // AI投票策略：
        // 1. 如果是卧底，优先投票给说话最像平民的玩家
        // 2. 如果是平民，优先投票给说话可疑的玩家
        let targetPlayer;
        const validTargets = this.gameState.players.filter(p => 
            p.id !== currentPlayer.id && p.isAlive
        );

        if (currentPlayer.role === 'undercover') {
            // 卧底策略：随机选择一个平民投票
            const civilians = validTargets.filter(p => p.role === 'civilian');
            if (civilians.length > 0) {
                targetPlayer = civilians[Math.floor(Math.random() * civilians.length)];
            }
        } else {
            // 平民策略：优先投票给卧底，其次随机
            const undercovers = validTargets.filter(p => p.role === 'undercover');
            if (undercovers.length > 0) {
                targetPlayer = undercovers[Math.floor(Math.random() * undercovers.length)];
            }
        }

        // 如果没有找到目标，随机选择
        if (!targetPlayer) {
            targetPlayer = validTargets[Math.floor(Math.random() * validTargets.length)];
        }

        // 延迟一下再投票，模拟思考
        setTimeout(() => {
            // 记录投票
            this.gameState.votes.set(currentPlayer.id, targetPlayer.id);

            // 添加投票记录到消息
            const voteMessage = {
                system: true,
                type: 'vote',
                message: `${currentPlayer.name} 投票给了 ${targetPlayer.name}`,
                timestamp: Date.now()
            };
            this.messages.push(voteMessage);
            this.notifyNewMessage(voteMessage);

            // 获取下一个投票者
            const currentIndex = this.gameState.speakingOrder.indexOf(currentPlayer.id);
            const nextIndex = (currentIndex + 1) % this.gameState.speakingOrder.length;

            if (nextIndex === 0) {
                // 所有人都投票完成，计算结果
                this.calculateVoteResult();
            } else {
                // 继续下一个玩家投票
                this.gameState.currentVoter = this.gameState.speakingOrder[nextIndex];
                this.notifyVoteUpdate({
                    votes: Array.from(this.gameState.votes.entries()),
                    nextVoter: this.gameState.currentVoter
                });

                // 如果下一个还是AI，继续AI投票
                if (this.gameState.currentVoter !== 'host') {
                    this.handleAIVote();
                }
            }
        }, 1500);
    }

    // 发送消息
    sendMessage(message) {
        const chatMessage = {
            playerId: 'host',
            playerName: this.gameState.players[0].name,
            message,
            timestamp: Date.now(),
            type: 'speech'  // 添加消息类型
        };
        this.messages.push(chatMessage);  // 添加到历史记录
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

    // 添加重新开始游戏的方法
    restartGame() {
        if (this.gameState.currentPhase !== 'ended') return;

        // 重置所有玩家状态
        this.gameState.players = this.gameState.players.map(player => ({
            ...player,
            isAlive: true,
            role: null,
            word: null
        }));

        // 重置游戏状态
        this.gameState.currentPhase = 'waiting';
        this.gameState.myRole = null;
        this.gameState.myWord = null;
        this.gameState.currentSpeaker = null;
        this.gameState.currentVoter = null;
        this.gameState.currentRound = 0;
        this.gameState.votes = new Map();
        this.gameState.speakingOrder = [];

        // 清空消息历史
        this.messages = [];

        // 通知状态更新
        this.notifyGameStateUpdate();

        // 添加系统消息
        const message = {
            system: true,
            type: 'system',
            message: '游戏已重置，等待房主开始新游戏...',
            timestamp: Date.now()
        };
        this.messages.push(message);
        this.notifyNewMessage(message);
    }

    // 添加离开房间的方法
    leaveRoom() {
        // 清空所有状态
        this.gameState = {
            players: [],
            currentPhase: 'waiting',
            myRole: null,
            myWord: null,
            currentSpeaker: null,
            currentVoter: null,
            hostId: 'host'
        };
        this.messages = [];
        
        // 通知状态更新
        this.notifyGameStateUpdate();
    }

    // 计算投票结果
    calculateVoteResult() {
        // 统计每个玩家获得的票数
        const voteCount = new Map();
        for (const [voterId, targetId] of this.gameState.votes.entries()) {
            const count = voteCount.get(targetId) || 0;
            voteCount.set(targetId, count + 1);
        }

        // 找出票数最多的玩家
        let maxVotes = 0;
        let eliminatedPlayers = [];
        for (const [playerId, votes] of voteCount.entries()) {
            if (votes > maxVotes) {
                maxVotes = votes;
                eliminatedPlayers = [playerId];
            } else if (votes === maxVotes) {
                eliminatedPlayers.push(playerId);
            }
        }

        // 如果有平票，随机选择一个
        const eliminatedId = eliminatedPlayers[Math.floor(Math.random() * eliminatedPlayers.length)];
        const eliminatedPlayer = this.gameState.players.find(p => p.id === eliminatedId);

        // 标记玩家出局
        eliminatedPlayer.isAlive = false;

        // 添加投票结果消息
        const resultMessage = {
            system: true,
            type: 'result',
            message: `投票结束！${eliminatedPlayer.name} 被投票出局了！他的身份是${eliminatedPlayer.role === 'undercover' ? '卧底' : '平民'}！`,
            timestamp: Date.now()
        };
        this.messages.push(resultMessage);
        this.notifyNewMessage(resultMessage);

        // 检查游戏是否结束
        if (this.checkGameOver()) {
            return;
        }

        // 开始新一轮
        setTimeout(() => {
            this.startNewRound(eliminatedPlayer);
        }, 3000); // 给玩家一些时间查看结果
    }

    // 检查游戏是否结束
    checkGameOver() {
        const alivePlayers = this.gameState.players.filter(p => p.isAlive);
        const aliveUndercovers = alivePlayers.filter(p => p.role === 'undercover');
        const aliveCivilians = alivePlayers.filter(p => p.role === 'civilian');

        let gameOver = false;
        let winner = null;
        let message = '';

        // 游戏结束条件：
        // 1. 所有卧底被淘汰 - 平民胜利
        if (aliveUndercovers.length === 0) {
            gameOver = true;
            winner = 'civilians';
            message = '所有卧底都被找出来了！平民胜利！';
        }
        // 2. 卧底数量等于或超过平民数量 - 卧底胜利
        else if (aliveUndercovers.length >= aliveCivilians.length) {
            gameOver = true;
            winner = 'undercover';
            message = '卧底数量已经和平民一样多了！卧底胜利！';
        }

        if (gameOver) {
            // 添加游戏结束消息
            const endMessage = {
                system: true,
                type: 'result',
                message: message,
                timestamp: Date.now()
            };
            this.messages.push(endMessage);
            this.notifyNewMessage(endMessage);

            // 公布所有玩家身份
            const rolesMessage = {
                system: true,
                type: 'result',
                message: '游戏结束！所有玩家身份：\n' + 
                    this.gameState.players.map(p => 
                        `${p.name}: ${p.role === 'undercover' ? '卧底' : '平民'} (${p.word})`
                    ).join('\n'),
                timestamp: Date.now()
            };
            this.messages.push(rolesMessage);
            this.notifyNewMessage(rolesMessage);

            // 更新游戏状态
            this.gameState.currentPhase = 'ended';
            this.gameState.winner = winner;
            this.notifyGameStateUpdate();

            // 通知游戏结束
            this.notifyGameOver({
                winner,
                civilians: this.gameState.players.filter(p => p.role === 'civilian').map(p => p.name),
                undercovers: this.gameState.players.filter(p => p.role === 'undercover').map(p => p.name),
                message: message
            });

            return true;
        }

        return false;
    }

    // 开始新一轮
    startNewRound(eliminatedPlayer) {
        this.gameState.currentRound++;
        this.gameState.currentPhase = 'speaking';
        
        // 更新发言顺序，只包含存活玩家
        const alivePlayers = this.gameState.players.filter(p => p.isAlive);
        this.gameState.speakingOrder = alivePlayers.map(p => p.id);
        
        // 从第一个存活玩家开始
        this.gameState.currentSpeaker = this.gameState.speakingOrder[0];
        this.gameState.votes = new Map();

        // 添加新一轮开始消息
        const roundMessage = {
            system: true,
            type: 'system',
            message: `第 ${this.gameState.currentRound} 轮开始！`,
            timestamp: Date.now()
        };
        this.messages.push(roundMessage);
        this.notifyNewMessage(roundMessage);

        // 通知新一轮开始
        this.notifyRoundStart({
            round: this.gameState.currentRound,
            currentSpeaker: this.gameState.currentSpeaker,
            eliminatedPlayer: {
                name: eliminatedPlayer.name,
                role: eliminatedPlayer.role
            }
        });

        // 如果第一个发言者是AI，自动开始AI行为
        if (this.gameState.currentSpeaker !== 'host') {
            setTimeout(() => {
                this.handleAIActions();
            }, 2000);
        }

        if (this.gameState.currentSpeaker === 'host') {
            this.startTimer(this.settings.speakingTime);
        }
    }

    // 更新游戏设置
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };
        
        const message = {
            system: true,
            type: 'system',
            message: '游戏设置已更新',
            timestamp: Date.now()
        };
        this.messages.push(message);
        this.notifyNewMessage(message);
    }

    // 开始计时
    startTimer(duration) {
        this.timeLeft = duration;
        this.notifyTimerUpdate();

        clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.notifyTimerUpdate();

            if (this.timeLeft <= 0) {
                this.handleTimeUp();
            }
        }, 1000);
    }

    // 停止计时
    stopTimer() {
        clearInterval(this.timer);
        this.timer = null;
        this.timeLeft = 0;
        this.notifyTimerUpdate();
    }

    // 处理时间到
    handleTimeUp() {
        this.stopTimer();
        if (this.gameState.currentPhase === 'speaking') {
            // 自动结束发言
            if (this.gameState.currentSpeaker === 'host') {
                this.finishSpeaking('host');
            }
        } else if (this.gameState.currentPhase === 'voting') {
            // 自动随机投票
            if (this.gameState.currentVoter === 'host') {
                const validTargets = this.gameState.players.filter(p => 
                    p.id !== 'host' && p.isAlive
                );
                const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
                this.vote(randomTarget.id);
            }
        }
    }

    notifyTimerUpdate() {
        if (this.onTimerUpdate) {
            this.onTimerUpdate(this.timeLeft);
        }
    }
}

export default GameManager; 