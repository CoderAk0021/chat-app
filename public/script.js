class ChatApp {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.userColor = null;
        this.typingTimer = null;
        this.isTyping = false;
        
        this.init();
    }

    init() {
        this.setupUserIdentity();
        this.setupDarkMode();
        this.setupSocketConnection();
        this.setupEventListeners();
        this.showUserInfo();
    }

    // Setup persistent user identity
    setupUserIdentity() {
        // Get or create user ID
        this.userId = localStorage.getItem('chatUserId');
        if (!this.userId) {
            this.userId = 'User' + Math.random().toString(36).substr(2, 6);
            localStorage.setItem('chatUserId', this.userId);
        }

        // Get or create user color
        this.userColor = localStorage.getItem('chatUserColor');
        if (!this.userColor) {
            const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
            ];
            this.userColor = colors[Math.floor(Math.random() * colors.length)];
            localStorage.setItem('chatUserColor', this.userColor);
        }
    }

    // Setup dark mode functionality
    setupDarkMode() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        const sunIcon = document.getElementById('sunIcon');
        const moonIcon = document.getElementById('moonIcon');
        
        // Get saved dark mode preference
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        // Apply dark mode
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
        
        // Toggle dark mode
        darkModeToggle.addEventListener('click', () => {
            const currentlyDark = document.documentElement.classList.contains('dark');
            
            if (currentlyDark) {
                document.documentElement.classList.remove('dark');
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
                localStorage.setItem('darkMode', 'false');
            } else {
                document.documentElement.classList.add('dark');
                sunIcon.classList.remove('hidden');
                moonIcon.classList.add('hidden');
                localStorage.setItem('darkMode', 'true');
            }
        });
    }

    // Setup Socket.IO connection
    setupSocketConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
            this.hideLoadingOverlay();
            
            // Join the chat with user identity
            this.socket.emit('user_join', {
                id: this.userId,
                color: this.userColor
            });
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus(false);
        });

        // Listen for chat history
        this.socket.on('chat_history', (history) => {
            this.loadChatHistory(history);
        });

        // Listen for new messages
        this.socket.on('new_message', (message) => {
            this.addMessage(message);
        });

        // Listen for users list updates
        this.socket.on('users_update', (users) => {
            this.updateUsersList(users);
        });

        // Listen for typing indicators
        this.socket.on('user_typing', (data) => {
            this.handleTypingIndicator(data);
        });
    }

    // Setup event listeners
    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');

        // Send message on button click
        sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Send message on Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Typing indicators
        messageInput.addEventListener('input', () => {
            this.handleTypingStart();
        });

        // Auto-resize input and enable/disable send button
        messageInput.addEventListener('input', (e) => {
            sendButton.disabled = e.target.value.trim() === '';
        });

        // Initially disable send button
        sendButton.disabled = true;
    }

    // Show user info
    showUserInfo() {
        const userIdElement = document.getElementById('userId');
        userIdElement.textContent = this.userId;
        userIdElement.style.color = this.userColor;
    }

    // Send message
    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (message && this.socket) {
            this.socket.emit('send_message', { message });
            messageInput.value = '';
            document.getElementById('sendButton').disabled = true;
            
            // Stop typing indicator
            this.handleTypingStop();
        }
    }

    // Add message to chat
    addMessage(messageData) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        
        const isOwnMessage = messageData.userId === this.userId;
        const isSystemMessage = messageData.type === 'system';
        
        if (isSystemMessage) {
            // System message styling
            messageElement.className = 'text-center text-sm text-gray-500 dark:text-gray-400 py-2';
            messageElement.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${messageData.userColor}"></div>
                    <span>${messageData.message}</span>
                    <span class="text-xs">${this.formatTimestamp(messageData.timestamp)}</span>
                </div>
            `;
        } else {
            // Regular message styling
            messageElement.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`;
            
            const messageContent = `
                <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwnMessage 
                        ? 'bg-blue-500 text-white rounded-br-none' 
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-600'
                }">
                    ${!isOwnMessage ? `
                        <div class="flex items-center space-x-2 mb-1">
                            <div class="w-3 h-3 rounded-full" style="background-color: ${messageData.userColor}"></div>
                            <span class="text-xs font-semibold" style="color: ${messageData.userColor}">${messageData.userId}</span>
                        </div>
                    ` : ''}
                    <div class="text-sm">${this.escapeHtml(messageData.message)}</div>
                    <div class="text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'} mt-1 text-right">
                        ${this.formatTimestamp(messageData.timestamp)}
                    </div>
                </div>
            `;
            
            messageElement.innerHTML = messageContent;
        }
        
        chatMessages.appendChild(messageElement);
        
        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Add smooth scroll animation
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(10px)';
        setTimeout(() => {
            messageElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 10);
    }

    // Load chat history
    loadChatHistory(history) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        history.forEach(message => {
            this.addMessage(message);
        });
    }

    // Update users list
    updateUsersList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'flex items-center space-x-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700';
            
            const isCurrentUser = user.id === this.userId;
            
            userElement.innerHTML = `
                <div class="w-3 h-3 rounded-full" style="background-color: ${user.color}"></div>
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-800 dark:text-white">
                        ${user.id}${isCurrentUser ? ' (You)' : ''}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Joined ${this.formatTimestamp(user.joinedAt)}
                    </div>
                </div>
            `;
            
            if (isCurrentUser) {
                userElement.classList.add('ring-2', 'ring-blue-500');
            }
            
            usersList.appendChild(userElement);
        });
    }

    // Handle typing indicators
    handleTypingStart() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.socket.emit('typing_start');
        }
        
        // Reset typing timer
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.handleTypingStop();
        }, 1000);
    }

    handleTypingStop() {
        if (this.isTyping) {
            this.isTyping = false;
            this.socket.emit('typing_stop');
        }
        clearTimeout(this.typingTimer);
    }

    handleTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        const typingText = document.getElementById('typingText');
        
        if (data.typing) {
            typingText.textContent = `${data.userId} is typing...`;
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    // Update connection status
    updateConnectionStatus(connected) {
        const connectionStatus = document.getElementById('connectionStatus');
        const statusDot = connectionStatus.querySelector('div');
        const statusText = connectionStatus.querySelector('span');
        
        if (connected) {
            statusDot.className = 'w-3 h-3 bg-green-500 rounded-full mr-2';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'w-3 h-3 bg-red-500 rounded-full mr-2';
            statusText.textContent = 'Disconnected';
        }
    }

    // Hide loading overlay
    hideLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }

    // Format timestamp
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInMinutes = (now - date) / (1000 * 60);
        
        if (diffInMinutes < 1) {
            return 'Just now';
        } else if (diffInMinutes < 60) {
            return `${Math.floor(diffInMinutes)}m ago`;
        } else if (diffInMinutes < 1440) {
            return `${Math.floor(diffInMinutes / 60)}h ago`;
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the chat app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, could pause some operations
    } else {
        // Page is visible, resume operations
    }
});