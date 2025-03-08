import React from 'react';
import { BrowserRouter as Router, Route, Routes, useParams } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Home from './pages/Home';
import Room from './components/Room';
import './styles/App.css';

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomId" element={<RoomWrapper />} />
          </Routes>
        </div>
      </Router>
    </SocketProvider>
  );
}

// 包装Room组件以获取URL参数
const RoomWrapper = () => {
  const { roomId } = useParams();
  return <Room roomId={roomId} />;
};

export default App; 