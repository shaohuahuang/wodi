// 使用动态导入 fetch
let fetch;
(async () => {
    const { default: _fetch } = await import('node-fetch');
    fetch = _fetch;
})();

class AIPlayer {
    constructor(name, gameState) {
        this.name = name;
        this.role = null;
        this.word = null;
        this.gameState = gameState;
        this.chatHistory = [];
        this.voteHistory = [];  // 记录每轮的投票结果
        this.eliminatedPlayers = []; // 记录已出局的玩家
    }

    // 记录聊天历史
    addToHistory(message) {
        this.chatHistory.push(message);
    }

    // 记录投票历史
    addVoteHistory(votes) {
        this.voteHistory.push(votes);
    }

    // 记录出局玩家
    addEliminatedPlayer(player) {
        this.eliminatedPlayers.push(player);
    }

    // 构建提示信息
    buildPrompt(phase) {
        let prompt = `你正在玩谁是卧底游戏。\n`;
        prompt += `你的名字是: ${this.name}\n`;
        prompt += `你的身份是: ${this.role === 'undercover' ? '卧底' : '平民'}\n`;
        prompt += `你拿到的词语是: ${this.word}\n\n`;

        prompt += `当前游戏中的玩家:\n`;
        this.gameState.players.forEach(player => {
            prompt += `- ${player.name}${player.isAlive ? '' : ' (已出局)'}\n`;
        });

        if (this.eliminatedPlayers.length > 0) {
            prompt += `\n已出局的玩家:\n`;
            this.eliminatedPlayers.forEach(player => {
                prompt += `- ${player.name} (${player.role === 'undercover' ? '卧底' : '平民'})\n`;
            });
        }

        prompt += `\n历史聊天记录:\n`;
        this.chatHistory.forEach(msg => {
            if (msg.system) {
                prompt += `[系统] ${msg.message}\n`;
            } else {
                prompt += `${msg.playerName}: ${msg.message}\n`;
            }
        });

        if (this.voteHistory.length > 0) {
            prompt += `\n历史投票记录:\n`;
            this.voteHistory.forEach((votes, round) => {
                prompt += `第${round + 1}轮投票结果:\n`;
                votes.forEach(([voterId, targetId]) => {
                    const voter = this.gameState.players.find(p => p.id === voterId);
                    const target = this.gameState.players.find(p => p.id === targetId);
                    if (voter && target) {
                        prompt += `- ${voter.name} 投票给了 ${target.name}\n`;
                    }
                });
            });
        }

        if (phase === 'speaking') {
            prompt += `\n现在是你的发言回合。如果你是平民，你应该描述你拿到的词语，但要注意不要太明显。如果你是卧底，你需要根据其他人的发言，猜测平民拿到的词语并进行相应的描述。请给出你的发言内容。`;
        } else if (phase === 'voting') {
            prompt += `\n现在是投票阶段。根据之前的发言和行为，分析谁最可能是卧底/平民，并说明你要投票给谁，以及投票的理由。`;
        }

        return prompt;
    }

    // 修改 callAPI 方法
    async *callAPI(prompt) {
        try {
            console.log('Calling AI API with prompt:', prompt);  // 调试日志
            
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-r1:8b',
                    prompt: prompt,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const decoder = new TextDecoder();
            const reader = response.body.getReader();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            console.log('AI response chunk:', data.response);  // 调试日志
                            yield data.response;
                        }
                    } catch (e) {
                        console.error('解析响应数据失败:', e);
                    }
                }
            }
        } catch (error) {
            console.error('调用 AI API 失败:', error);
            yield '我需要思考一下...';
        }
    }

    // 修改 generateSpeech 方法
    async *generateSpeech() {
        console.log('AI player generating speech...');  // 调试日志
        const prompt = this.buildPrompt('speaking');
        console.log('Generated prompt:', prompt);  // 调试日志
        yield* this.callAPI(prompt);
    }

    // 修改 decideVote 方法
    async decideVote(players) {
        console.log('AI player deciding vote...');  // 调试日志
        const prompt = this.buildPrompt('voting');
        
        let fullResponse = '';
        for await (const chunk of this.callAPI(prompt)) {
            fullResponse += chunk;
        }
        
        console.log('AI vote response:', fullResponse);  // 调试日志

        // 分析响应，找出要投票的目标
        const match = fullResponse.match(/我决定投票给\s*([^,，。\s]+)/);
        if (match) {
            const targetName = match[1];
            const targetPlayer = players.find(p => 
                p.name === targetName && p.isAlive && p.id !== this.id
            );
            if (targetPlayer) {
                return targetPlayer.id;
            }
        }

        // 如果无法从回复中提取有效的目标，随机选择
        const alivePlayers = players.filter(p => p.isAlive && p.id !== this.id);
        return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
    }

    // 更新游戏状态
    updateGameState(newState) {
        this.gameState = newState;
    }
}

module.exports = AIPlayer; 