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

    // 添加检查回答是否合规的方法
    checkAIResponse(response, currentPlayer) {
        // 检查是否直接包含关键词
        if (response.includes(currentPlayer.word)) {
            return {
                valid: false,
                reason: '回答中直接包含了关键词'
            };
        }

        // 检查是否包含关键词的同义词或近义词
        const sensitiveWords = [
            currentPlayer.word,
            // 可以添加更多同义词或近义词
        ];

        for (const word of sensitiveWords) {
            if (response.includes(word)) {
                return {
                    valid: false,
                    reason: '回答中包含了敏感词'
                };
            }
        }

        // 检查回答长度是否合适
        if (response.length > 50) {
            return {
                valid: false,
                reason: '回答太长了'
            };
        }

        return { valid: true };
    }

    // 修改AI行为处理方法
    async handleAIActions() {
        const currentPlayer = this.gameState.players.find(p => 
            p.id === this.gameState.currentSpeaker && p.id !== 'host'
        );

        if (!currentPlayer) return;

        let validResponse = false;
        let retryCount = 0;
        const maxRetries = 3;
        let fullMessage = '';

        while (!validResponse && retryCount < maxRetries) {
            try {
                // 构建提示词，只有重试时才添加警告
                const prompt = this.buildAIPrompt(currentPlayer, retryCount > 0);
                
                // 先获取完整回答，不直接显示
                fullMessage = await this.callLLM(prompt, () => {
                    // 在获取答案过程中不显示任何内容
                });

                // 检查回答是否合规
                const checkResult = this.checkAIResponse(fullMessage, currentPlayer);
                
                if (checkResult.valid) {
                    validResponse = true;
                    // 只有回答合规时，才逐字显示到聊天框
                    let displayedMessage = '';
                    for (const char of fullMessage) {
                        displayedMessage += char;
                        this.notifyAISpeaking({
                            playerId: currentPlayer.id,
                            playerName: currentPlayer.name,
                            message: displayedMessage,
                            isComplete: false
                        });
                        // 添加一个小延迟，实现打字效果
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } else {
                    console.log(`AI回答不合规 (${checkResult.reason})，重试中...`);
                    retryCount++;
                }
            } catch (error) {
                console.error('AI发言出错:', error);
                retryCount++;
            }
        }

        // 如果多次重试后仍然失败，使用安全的默认回答
        if (!validResponse) {
            fullMessage = '这个特征很难描述，让我想想...';
            // 显示默认回答
            this.notifyAISpeaking({
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                message: fullMessage,
                isComplete: false
            });
        }

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
    }

    // 修改提示词构建方法，强调简短回答
    buildAIPrompt(currentPlayer, isRetry = false) {
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

        let warningMessage = isRetry ? 
            '\n警告：你上一次的回答暴露了关键词或太长了。记住，要简短且不能暴露词语！\n' : '';

        return `你正在参与谁是卧底游戏，扮演玩家"${currentPlayer.name}"。
你的词语是"${currentPlayer.word}"，身份是${currentPlayer.role === 'undercover' ? '卧底' : '平民'}。
${warningMessage}
要求：
1. 回答必须简短，最多15个字
2. 只描述一个特征，不要啰嗦
3. 语气要自然，像真人说话
4. 如果是平民：
   - 描述你词语的一个特征，但绝不能说出这个词
   - 要基于词语的真实特征
5. 如果是卧底：
   - 跟随大家的思路，但要巧妙误导
   - 让描述听起来像在说平民的词

之前的发言：
${gameInfo.previousSpeeches.map(s => `${s.playerName}: ${s.content}`).join('\n')}

直接给出一句简短的描述，不要有任何解释。`;
    }

    // 修改结束发言方法
    finishSpeaking(playerId) {
        this.stopTimer();
        console.log('Finishing speech for player:', playerId);

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
            this.gameState.currentVoter = this.gameState.speakingOrder[0]; // 从第一个玩家开始投票
            this.gameState.votes = new Map();
            console.log('Round finished, entering voting phase');
            
            // 更新游戏状态
            this.notifyGameStateUpdate();

            // 如果第一个投票者是AI，开始AI投票
            if (this.gameState.currentVoter !== 'host') {
                console.log('Starting AI voting');
                setTimeout(() => {
                    this.handleAIVote();
                }, 1000);
            } else {
                // 如果是房主投票，开始计时
                this.startTimer(this.settings.votingTime);
            }
        } else {
            // 继续下一个玩家发言
            this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
            console.log('Next speaker:', this.gameState.currentSpeaker);
            
            // 更新游戏状态
            this.notifyGameStateUpdate();

            // 如果下一个是AI玩家，自动开始AI行为
            if (this.gameState.currentSpeaker !== 'host' && this.gameState.currentPhase === 'speaking') {
                console.log('Starting AI actions for next speaker');
                setTimeout(() => {
                    this.handleAIActions();
                }, 1000);
            } else if (this.gameState.currentSpeaker === 'host') {
                // 如果是房主发言，开始计时
                this.startTimer(this.settings.speakingTime);
            }
        }
    }

    // 修改AI投票处理方法
    async handleAIVote() {
        const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentVoter);
        if (!currentPlayer) return;

        try {
            // 构建投票提示词
            const prompt = this.buildAIVotePrompt(currentPlayer);
            
            // 调用大模型获取投票决策
            let targetId = null;
            const fullResponse = await this.callLLM(prompt, () => {});  // 不需要逐字显示
            
            // 从回答中提取目标玩家
            const validTargets = this.gameState.players.filter(p => 
                p.id !== currentPlayer.id && p.isAlive
            );
            
            // 尝试根据大模型的回答找到目标玩家
            for (const target of validTargets) {
                if (fullResponse.includes(target.name)) {
                    targetId = target.id;
                    break;
                }
            }

            // 如果没有找到有效目标，随机选择
            if (!targetId) {
                const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
                targetId = randomTarget.id;
            }

            // 延迟一下再投票，模拟思考
            setTimeout(() => {
                // 记录投票
                this.gameState.votes.set(currentPlayer.id, targetId);
                const targetPlayer = this.gameState.players.find(p => p.id === targetId);

                // 添加投票记录到消息
                const voteMessage = {
                    system: true,
                    type: 'vote',
                    message: `${currentPlayer.name} 投票给了 ${targetPlayer.name}`,
                    timestamp: Date.now()
                };
                this.messages.push(voteMessage);
                this.notifyNewMessage(voteMessage);

                // 处理下一个投票者
                this.handleNextVoter(currentPlayer.id);
            }, 1500);

        } catch (error) {
            console.error('AI投票出错:', error);
            // 出错时随机投票
            const validTargets = this.gameState.players.filter(p => 
                p.id !== currentPlayer.id && p.isAlive
            );
            const targetPlayer = validTargets[Math.floor(Math.random() * validTargets.length)];
            
            setTimeout(() => {
                this.gameState.votes.set(currentPlayer.id, targetPlayer.id);
                const voteMessage = {
                    system: true,
                    type: 'vote',
                    message: `${currentPlayer.name} 投票给了 ${targetPlayer.name}`,
                    timestamp: Date.now()
                };
                this.messages.push(voteMessage);
                this.notifyNewMessage(voteMessage);
                
                this.handleNextVoter(currentPlayer.id);
            }, 1500);
        }
    }

    // 处理下一个投票者
    handleNextVoter(currentVoterId) {
        const currentIndex = this.gameState.speakingOrder.indexOf(currentVoterId);
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
    }

    // 构建AI投票提示词
    buildAIVotePrompt(currentPlayer) {
        const gameInfo = {
            currentRound: this.gameState.currentRound,
            totalPlayers: this.gameState.players.length,
            myWord: currentPlayer.word,
            myRole: currentPlayer.role,
            alivePlayers: this.gameState.players.filter(p => p.isAlive && p.id !== currentPlayer.id),
            previousSpeeches: this.messages
                .filter(m => m.type === 'speech')
                .map(m => ({
                    playerName: m.playerName,
                    content: m.message
                }))
        };

        return `你正在玩谁是卧底游戏，现在是投票阶段。
你是${currentPlayer.name}，你的词语是"${currentPlayer.word}"，身份是${currentPlayer.role === 'undercover' ? '卧底' : '平民'}。

所有玩家的发言记录：
${gameInfo.previousSpeeches.map(s => `${s.playerName}: ${s.content}`).join('\n')}

当前存活的其他玩家：
${gameInfo.alivePlayers.map(p => p.name).join(', ')}

根据以上信息，分析每个玩家的发言，并决定要投票给谁。

如果你是平民：
- 分析哪些玩家的描述与大家不一致
- 找出最可能是卧底的玩家

如果你是卧底：
- 找出最有威胁的平民（描述最准确的玩家）
- 避免暴露自己的身份

请直接回答你要投票的玩家名字，不要有任何解释或推理过程。`;
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
        
        // 通知消息更新（清空聊天框）
        if (this.onNewMessage) {
            this.onNewMessage({ clear: true });
        }

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

    // 修改计算投票结果方法
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

        // 添加投票结果消息（不显示身份）
        const resultMessage = {
            system: true,
            type: 'result',
            message: `投票结束！${eliminatedPlayer.name} 被投票出局了！`,
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
        }, 3000);
    }

    // 修改游戏结束检查方法
    checkGameOver() {
        const alivePlayers = this.gameState.players.filter(p => p.isAlive);
        const aliveUndercovers = alivePlayers.filter(p => p.role === 'undercover');
        const aliveCivilians = alivePlayers.filter(p => p.role === 'civilian');

        let gameOver = false;
        let winner = null;
        let message = '';

        if (aliveUndercovers.length === 0) {
            gameOver = true;
            winner = 'civilians';
            message = '游戏结束！平民获胜！';
        }
        else if (aliveUndercovers.length >= aliveCivilians.length) {
            gameOver = true;
            winner = 'undercover';
            message = '游戏结束！卧底获胜！';
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

            // 公布所有玩家身份（只在游戏结束时）
            const rolesMessage = {
                system: true,
                type: 'result',
                message: '所有玩家身份：\n' + 
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

            return true;
        }

        return false;
    }

    // 修改开始新一轮方法
    startNewRound(eliminatedPlayer) {
        this.gameState.currentRound++;
        this.gameState.currentPhase = 'speaking';
        
        // 更新发言顺序，只包含存活玩家
        const alivePlayers = this.gameState.players.filter(p => p.isAlive);
        this.gameState.speakingOrder = alivePlayers.map(p => p.id);
        
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

        // 通知新一轮开始（只传递必要信息）
        this.notifyRoundStart({
            round: this.gameState.currentRound,
            currentSpeaker: this.gameState.currentSpeaker,
            eliminatedPlayer: {
                name: eliminatedPlayer.name
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

    // 投票方法
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

        // 处理下一个投票者
        this.handleNextVoter('host');
    }
}

export default GameManager; 