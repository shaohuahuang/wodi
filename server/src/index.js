const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { handleGameEvents } = require('./controllers/gameController');
const { initializeWordPairs } = require('./models/wordPairs');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// 初始化词语对
initializeWordPairs();

// 处理Socket.IO连接
handleGameEvents(io);

// 添加在现有代码之后
io.on('connect', (socket) => {
    console.log('New client connected:', socket.id);
});

io.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 