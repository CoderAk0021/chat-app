const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static('public'));

// Store connected users
const connectedUsers = new Map();

// Chat history file path
const CHAT_LOG_FILE = 'chat-log.txt';

// Ensure chat log file exists
if (!fs.existsSync(CHAT_LOG_FILE)) {
    fs.writeFileSync(CHAT_LOG_FILE, '');
}

// Function to read chat history from file
function readChatHistory() {
    try {
        const data = fs.readFileSync(CHAT_LOG_FILE, 'utf8');
        if (!data.trim()) return [];
        
        return data.trim().split('\n').map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
    } catch (error) {
        console.error('Error reading chat history:', error);
        return [];
    }
}

// Function to append message to chat history file
function appendToChatHistory(message) {
    try {
        fs.appendFileSync(CHAT_LOG_FILE, JSON.stringify(message) + '\n');
    } catch (error) {
        console.error('Error writing to chat history:', error);
    }
}

// Function to get connected users list
function getConnectedUsersList() {
    return Array.from(connectedUsers.values()).map(user => ({
        id: user.id,
        color: user.color,
        joinedAt: user.joinedAt
    }));
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle user joining
    socket.on('user_join', (userData) => {
        const user = {
            id: userData.id,
            color: userData.color,
            socketId: socket.id,
            joinedAt: new Date().toISOString()
        };
        
        // Store user in connected users
        connectedUsers.set(socket.id, user);
        
        // Join the user to the chat room
        socket.join('chat');
        
        // Send chat history to the new user
        const chatHistory = readChatHistory();
        socket.emit('chat_history', chatHistory);
        
        // Create and broadcast join message
        const joinMessage = {
            type: 'system',
            message: `User ${userData.id} joined the chat`,
            timestamp: new Date().toISOString(),
            userId: userData.id,
            userColor: userData.color
        };
        
        // Save join message to history
        appendToChatHistory(joinMessage);
        
        // Broadcast join message to all clients
        io.to('chat').emit('new_message', joinMessage);
        
        // Send updated users list to all clients
        io.to('chat').emit('users_update', getConnectedUsersList());
        
        console.log(`User ${userData.id} joined the chat`);
    });

    // Handle new chat messages
    socket.on('send_message', (messageData) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;
        
        const message = {
            type: 'message',
            message: messageData.message,
            timestamp: new Date().toISOString(),
            userId: user.id,
            userColor: user.color
        };
        
        // Save message to history
        appendToChatHistory(message);
        
        // Broadcast message to all clients in the chat room
        io.to('chat').emit('new_message', message);
        
        console.log(`Message from ${user.id}: ${messageData.message}`);
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            // Remove user from connected users
            connectedUsers.delete(socket.id);
            
            // Create and broadcast leave message
            const leaveMessage = {
                type: 'system',
                message: `User ${user.id} left the chat`,
                timestamp: new Date().toISOString(),
                userId: user.id,
                userColor: user.color
            };
            
            // Save leave message to history
            appendToChatHistory(leaveMessage);
            
            // Broadcast leave message to remaining clients
            socket.to('chat').emit('new_message', leaveMessage);
            
            // Send updated users list to all clients
            io.to('chat').emit('users_update', getConnectedUsersList());
            
            console.log(`User ${user.id} left the chat`);
        }
        
        console.log('Client disconnected:', socket.id);
    });

    // Handle typing indicators (optional enhancement)
    socket.on('typing_start', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            socket.to('chat').emit('user_typing', { userId: user.id, typing: true });
        }
    });

    socket.on('typing_stop', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            socket.to('chat').emit('user_typing', { userId: user.id, typing: false });
        }
    });
});

// Error handling
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Chat server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});