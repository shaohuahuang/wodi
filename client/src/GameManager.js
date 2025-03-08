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
1. 你的回答要像一个真实的玩家，不要用太书面或机械的语言
2. 描述要含糊但合理，不要太明显地暴露或掩饰自己的身份
3. 要参考之前玩家的发言，保持描述的连贯性
4. 发言要简短自然，控制在30个字以内
5. 如果是平民，要巧妙地描述自己的词语，但绝对不能直接说出来
6. 如果是卧底，要假装理解了大家在说什么，适当地跟随和误导

之前的发言：
${gameInfo.previousSpeeches.map(s => `${s.playerName}: ${s.content}`).join('\n')}

请直接给出你的发言内容，不要有任何解释或推理过程。`;
    }

    // 修改结束发言方法
    finishSpeaking(playerId) {
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
        // 实现投票逻辑
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
}

export default GameManager; 