// Advanced chat functionality for the application

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Chat
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const voiceInputIndicator = document.getElementById('voice-input-indicator');
    const textToSpeechBtn = document.getElementById('text-to-speech-btn');
    const chatSuggestions = document.getElementById('chat-suggestions');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');

    // DOM Elements - Processing
    const processingOverlay = document.getElementById('processing-overlay');
    const processingRetrieval = document.getElementById('processingRetrieval');
    const processingGeneration = document.getElementById('processingGeneration');
    const retrievalProgress = document.getElementById('retrieval-progress');
    const generationProgress = document.getElementById('generation-progress');
    const processingStatus = document.getElementById('processing-status');

    // DOM Elements - Context (removed as per requirements)
    // Context viewer elements no longer needed

    // DOM Elements - Chat History
    const chatHistoryBtn = document.getElementById('chat-history-btn');
    const chatHistorySidebar = document.getElementById('chat-history-sidebar');
    const chatHistoryItems = document.getElementById('chat-history-items');
    const closeHistoryBtn = document.getElementById('close-history');
    const searchHistoryInput = document.getElementById('search-history');

    // DOM Elements - Header Controls
    const exportChatBtn = document.getElementById('export-chat');
    const clearChatBtn = document.getElementById('clear-chat');

    // State variables
    let chatHistory = [];

    // Initialize Socket.IO
    const socket = io();

    // Socket.IO event handlers
    socket.on('connect', function() {
        console.log('Connected to server');
    });

    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        addSystemMessage('Connection lost. Please refresh the page.');
    });

    socket.on('error', function(data) {
        console.error('Socket error:', data);
        addSystemMessage(`Error: ${data.message}`);
    });

    socket.on('message', function(data) {
        // Hide processing overlay
        processingOverlay.style.display = 'none';

        // Add message to chat
        if (data.type === 'bot') {
            addBotMessage(data.content);

            // Update context viewer if context is provided
            if (data.context && data.context.length > 0) {
                updateContextViewer(data.context);
            }

            // Update visualization if provided
            if (data.visualization) {
                if (typeof updateRetrievalVisualization === 'function') {
                    updateRetrievalVisualization(data.visualization);
                }
            }

            // Update confidence chart if provided
            if (data.confidence) {
                if (typeof updateConfidenceChart === 'function') {
                    updateConfidenceChart(data.confidence);
                }
            }

            // Add to local chat history
            chatHistory.push({
                type: 'bot',
                content: data.content,
                timestamp: data.timestamp,
                context: data.context,
                visualization: data.visualization,
                confidence: data.confidence
            });
        }
    });

    socket.on('typing', function(data) {
        if (data.status) {
            typingIndicator.classList.add('active');
        } else {
            typingIndicator.classList.remove('active');
        }
    });

    socket.on('processing', function(data) {
        processingOverlay.style.display = 'flex';

        if (data.status === 'retrieving') {
            processingRetrieval.classList.add('active');
            processingGeneration.classList.remove('active');

            if (retrievalProgress && data.progress !== undefined) {
                retrievalProgress.style.width = `${data.progress}%`;
            }
        } else if (data.status === 'generating') {
            processingRetrieval.classList.add('active');
            processingGeneration.classList.add('active');

            if (generationProgress && data.progress !== undefined) {
                generationProgress.style.width = `${data.progress}%`;
            }
        }

        if (processingStatus && data.message) {
            processingStatus.textContent = data.message;

            // Add typing animation
            processingStatus.classList.add('typing-animation');
            setTimeout(() => {
                processingStatus.classList.remove('typing-animation');
            }, 1500);
        }
    });

    socket.on('chat_history', function(data) {
        if (data.history && data.history.length > 0) {
            updateChatHistorySidebar(data.history);
        }
    });

    socket.on('chat_cleared', function(data) {
        if (data.status === 'success') {
            // Clear chat messages
            chatMessages.innerHTML = '';

            // Clear local chat history
            chatHistory = [];

            // Add system message
            addSystemMessage('Chat history cleared');

            // Reset visualization
            if (retrievalVisualization) {
                retrievalVisualization.innerHTML = '';
            }

            // Reset confidence chart
            if (confidenceChartInstance) {
                confidenceChartInstance.data.datasets[0].data = [0, 0, 0, 0, 0];
                confidenceChartInstance.update();
            }
        }
    });

    socket.on('export_result', function(data) {
        if (data.status === 'success') {
            // Create a download link
            const blob = new Blob([data.content], { type: data.format === 'json' ? 'application/json' : 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.${data.format === 'json' ? 'json' : 'md'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Add system message
            addSystemMessage(`Chat exported as ${data.format.toUpperCase()}`);
        } else {
            addSystemMessage(`Error exporting chat: ${data.message}`);
        }
    });

    // Send message function
    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Add user message to chat with animation
        addUserMessage(message);

        // Add to local chat history
        chatHistory.push({
            type: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Send message to server
        socket.emit('message', {
            content: message,
            timestamp: Date.now()
        });

        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Show processing overlay with animation
        processingOverlay.style.display = 'flex';

        // Reset progress bars
        if (retrievalProgress) retrievalProgress.style.width = '0%';
        if (generationProgress) generationProgress.style.width = '0%';

        // Activate retrieval step
        processingRetrieval.classList.add('active');
        processingGeneration.classList.remove('active');

        // Update processing status
        if (processingStatus) {
            processingStatus.textContent = 'Analyzing your question...';
        }

        // Hide chat suggestions
        if (chatSuggestions) {
            chatSuggestions.style.display = 'none';
        }
    }

    // Initialize confidence chart
    function initConfidenceChart() {
        if (!confidenceChart) return;

        if (typeof Chart !== 'undefined') {
            confidenceChartInstance = new Chart(confidenceChart, {
                type: 'radar',
                data: {
                    labels: ['Relevance', 'Accuracy', 'Completeness', 'Coherence', 'Conciseness'],
                    datasets: [{
                        label: 'Response Quality',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(67, 97, 238, 0.2)',
                        borderColor: 'rgba(67, 97, 238, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(67, 97, 238, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(67, 97, 238, 1)'
                    }]
                },
                options: {
                    scales: {
                        r: {
                            angleLines: {
                                display: true
                            },
                            suggestedMin: 0,
                            suggestedMax: 100
                        }
                    },
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart'
                    }
                }
            });

            // Function to update chart with new data
            window.updateConfidenceChart = function(data) {
                confidenceChartInstance.data.datasets[0].data = [
                    data.relevance || 0,
                    data.accuracy || 0,
                    data.completeness || 0,
                    data.coherence || 0,
                    data.conciseness || 0
                ];
                confidenceChartInstance.update();
            };
        }
    }

    // Update chat history sidebar
    function updateChatHistorySidebar(history) {
        if (!chatHistoryItems) return;

        chatHistoryItems.innerHTML = '';

        if (history.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'history-empty';
            emptyMessage.innerHTML = '<i class="fas fa-history"></i><p>No chat history yet</p>';
            chatHistoryItems.appendChild(emptyMessage);
            return;
        }

        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item animate-fade-in-up';

            const historyHeader = document.createElement('div');
            historyHeader.className = 'history-item-header';

            const historyTime = document.createElement('div');
            historyTime.className = 'history-item-time';
            historyTime.textContent = formatTime(new Date(item.timestamp * 1000));

            const historyActions = document.createElement('div');
            historyActions.className = 'history-item-actions';
            historyActions.innerHTML = `
                <button class="history-action-btn hover-scale" title="Restore this conversation">
                    <i class="fas fa-redo-alt"></i>
                </button>
            `;

            historyHeader.appendChild(historyTime);
            historyHeader.appendChild(historyActions);

            const historyQuery = document.createElement('div');
            historyQuery.className = 'history-item-query';
            historyQuery.textContent = item.query.length > 60 ? item.query.substring(0, 60) + '...' : item.query;

            historyItem.appendChild(historyHeader);
            historyItem.appendChild(historyQuery);

            // Add click event to restore conversation
            historyItem.addEventListener('click', function() {
                // Clear current chat
                chatMessages.innerHTML = '';

                // Add user message
                addUserMessage(item.query);

                // Add bot message
                addBotMessage(item.response);

                // Close history sidebar
                chatHistorySidebar.classList.remove('active');
            });

            chatHistoryItems.appendChild(historyItem);
        });
    }

    // No context tabs needed

    // Add message functions
    function addUserMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-user';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTime(new Date());

        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);

        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addBotMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-bot';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = formatMessage(content);

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTime(new Date());

        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);

        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addSystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-system';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    // Context viewer functionality removed as per requirements
    function updateContextViewer(context) {
        // Function kept as a stub to prevent errors, but functionality removed
        return;
    }

    // Helper functions
    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatMessage(text) {
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        text = text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);

        // Convert newlines to <br>
        return text.replace(/\n/g, '<br>');
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // No PDF functions needed

    // Setup event listeners for chat functionality
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Setup event listeners for chat suggestions
    if (suggestionBtns) {
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                chatInput.value = this.textContent;
                sendMessage();
            });
        });
    }

    // Setup event listeners for chat history
    if (chatHistoryBtn) {
        chatHistoryBtn.addEventListener('click', function() {
            chatHistorySidebar.classList.add('active');
            socket.emit('get_chat_history');
        });
    }

    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', function() {
            chatHistorySidebar.classList.remove('active');
        });
    }

    if (searchHistoryInput) {
        searchHistoryInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            const historyItems = document.querySelectorAll('.history-item');

            historyItems.forEach(item => {
                const text = item.querySelector('.history-item-query').textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // Setup event listeners for header controls
    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', function() {
            socket.emit('export_chat', { format: 'markdown' });
        });
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear the chat history?')) {
                socket.emit('clear_chat');
            }
        });
    }

    // Initialize components
    // No PDF initialization needed

    // Initialize GSAP animations for messages
    if (typeof gsap !== 'undefined') {
        // Create a timeline for the welcome message animation
        const tl = gsap.timeline();

        // Animate the chat container
        tl.from('.chat-container', {
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });

        // Animate the chat suggestions
        tl.from('.suggestion-btn', {
            y: 20,
            opacity: 0,
            stagger: 0.1,
            duration: 0.5,
            ease: 'back.out(1.7)'
        }, '-=0.4');
    }
});
