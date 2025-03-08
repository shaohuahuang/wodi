const wordPairs = [
    { civilian: '手机', undercover: '电话' },
    { civilian: '西瓜', undercover: '南瓜' },
    { civilian: '眼睛', undercover: '眼镜' },
    { civilian: '铅笔', undercover: '钢笔' },
    { civilian: '手表', undercover: '闹钟' },
    { civilian: '太阳', undercover: '月亮' },
    { civilian: '自行车', undercover: '电动车' },
    { civilian: '笔记本', undercover: '台式机' },
    { civilian: '耳机', undercover: '音响' },
    { civilian: '汽车', undercover: '公交车' }
];

let currentWordPairs = [...wordPairs];

function initializeWordPairs() {
    currentWordPairs = [...wordPairs];
}

function getRandomWordPair() {
    if (currentWordPairs.length === 0) {
        currentWordPairs = [...wordPairs];
    }
    const randomIndex = Math.floor(Math.random() * currentWordPairs.length);
    const wordPair = currentWordPairs[randomIndex];
    currentWordPairs.splice(randomIndex, 1);
    return wordPair;
}

module.exports = {
    initializeWordPairs,
    getRandomWordPair
}; 