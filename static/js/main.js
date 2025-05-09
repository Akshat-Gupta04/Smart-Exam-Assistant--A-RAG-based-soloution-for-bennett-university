// Main JavaScript file for the application

document.addEventListener('DOMContentLoaded', function() {
    // Modal functionality
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');

    // Close modal when clicking the close button
    if (modalClose) {
        modalClose.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }

    // Close modal when clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Settings button functionality
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            openSettingsModal();
        });
    }

    // About, Help, and Privacy links
    const aboutLink = document.getElementById('about-link');
    const helpLink = document.getElementById('help-link');
    const privacyLink = document.getElementById('privacy-link');

    if (aboutLink) {
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            openAboutModal();
        });
    }

    if (helpLink) {
        helpLink.addEventListener('click', function(e) {
            e.preventDefault();
            openHelpModal();
        });
    }

    if (privacyLink) {
        privacyLink.addEventListener('click', function(e) {
            e.preventDefault();
            openPrivacyModal();
        });
    }

    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');

    // Check for saved theme preference or use preferred color scheme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-theme');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }

    // Theme toggle click handler
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');

        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            localStorage.setItem('theme', 'light');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    });

    // Auto-resize textarea
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';

            // Reset height if empty
            if (this.value === '') {
                this.style.height = 'auto';
            }
        });
    }

    // Prevent form submission on Enter (unless Shift+Enter)
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('send-button').click();
            }
        });
    }

    // Add smooth scrolling to all elements
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add animation classes when elements come into view
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.animate-on-scroll');

        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            if (elementPosition < windowHeight - 50) {
                element.classList.add('animated');
            }
        });
    };

    // Run once on page load
    animateOnScroll();

    // Run on scroll
    window.addEventListener('scroll', animateOnScroll);

    // Modal content functions
    function openSettingsModal() {
        modalTitle.textContent = 'Settings';
        modalBody.innerHTML = `
            <div class="settings-container">
                <div class="settings-section">
                    <h3>Appearance</h3>
                    <div class="settings-option">
                        <label for="font-size">Font Size</label>
                        <select id="font-size" class="settings-select">
                            <option value="small">Small</option>
                            <option value="medium" selected>Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>
                    <div class="settings-option">
                        <label for="chat-width">Chat Width</label>
                        <select id="chat-width" class="settings-select">
                            <option value="narrow">Narrow</option>
                            <option value="medium" selected>Medium</option>
                            <option value="wide">Wide</option>
                        </select>
                    </div>
                </div>
                <div class="settings-section">
                    <h3>Voice & Sound</h3>
                    <div class="settings-option">
                        <label for="voice-speed">Voice Speed</label>
                        <select id="voice-speed" class="settings-select">
                            <option value="slow">Slow</option>
                            <option value="normal" selected>Normal</option>
                            <option value="fast">Fast</option>
                        </select>
                    </div>
                    <div class="settings-option">
                        <label>Notification Sounds</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="notification-sounds" checked>
                            <label for="notification-sounds"></label>
                        </div>
                    </div>
                </div>
                <div class="settings-section">
                    <h3>Privacy</h3>
                    <div class="settings-option">
                        <label>Save Chat History</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="save-history" checked>
                            <label for="save-history"></label>
                        </div>
                    </div>
                    <div class="settings-option">
                        <button id="clear-all-data" class="danger-btn">Clear All Data</button>
                    </div>
                </div>
                <div class="settings-actions">
                    <button id="save-settings" class="primary-btn">Save Settings</button>
                </div>
            </div>
        `;

        // Add event listeners for settings controls
        setTimeout(() => {
            const saveSettingsBtn = document.getElementById('save-settings');
            if (saveSettingsBtn) {
                saveSettingsBtn.addEventListener('click', function() {
                    // Save settings to localStorage
                    const fontSize = document.getElementById('font-size').value;
                    const chatWidth = document.getElementById('chat-width').value;
                    const voiceSpeed = document.getElementById('voice-speed').value;
                    const notificationSounds = document.getElementById('notification-sounds').checked;
                    const saveHistory = document.getElementById('save-history').checked;

                    localStorage.setItem('settings', JSON.stringify({
                        fontSize,
                        chatWidth,
                        voiceSpeed,
                        notificationSounds,
                        saveHistory
                    }));

                    // Apply settings
                    applySettings();

                    // Close modal
                    modal.style.display = 'none';

                    // Show success message
                    alert('Settings saved successfully!');
                });
            }

            const clearAllDataBtn = document.getElementById('clear-all-data');
            if (clearAllDataBtn) {
                clearAllDataBtn.addEventListener('click', function() {
                    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
                        // Clear localStorage
                        localStorage.clear();

                        // Show success message
                        alert('All data cleared successfully!');

                        // Close modal
                        modal.style.display = 'none';

                        // Reload page
                        window.location.reload();
                    }
                });
            }
        }, 100);

        modal.style.display = 'block';
    }

    function openAboutModal() {
        modalTitle.textContent = 'About Smart Exam Assistant';
        modalBody.innerHTML = `
            <div class="about-container">
                <div class="about-logo">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <h3>Smart Exam Assistant v1.0</h3>
                <p>Smart Exam Assistant is an AI-powered tool designed to help students and faculty navigate examination policies and procedures.</p>
                <p>Using advanced natural language processing and retrieval-augmented generation, it provides accurate and contextual answers to questions about examination policies.</p>
                <h4>Features:</h4>
                <ul>
                    <li>Instant answers to examination policy questions</li>
                    <li>Voice input and text-to-speech capabilities</li>
                    <li>Source citations for all information</li>
                    <li>Dark mode support</li>
                    <li>Mobile-friendly interface</li>
                </ul>
                <h4>Developer:</h4>
                <p><strong>Akshat Gupta</strong></p>
                <p class="about-footer">Created with ❤️ for Bennett University</p>
            </div>
        `;
        modal.style.display = 'block';
    }

    function openHelpModal() {
        modalTitle.textContent = 'Help & FAQ';
        modalBody.innerHTML = `
            <div class="help-container">
                <div class="help-section">
                    <h3>Getting Started</h3>
                    <p>Simply type your question about examination policies in the chat box and press Enter or click the send button. The assistant will provide an answer based on the examination manual.</p>
                </div>
                <div class="help-section">
                    <h3>Voice Input</h3>
                    <p>Click the microphone icon to use voice input. Speak clearly, and your words will be transcribed into the chat box.</p>
                </div>
                <div class="help-section">
                    <h3>Text-to-Speech</h3>
                    <p>Click the speaker icon to have the assistant's responses read aloud.</p>
                </div>
                <div class="help-section">
                    <h3>Frequently Asked Questions</h3>
                    <div class="faq-item">
                        <h4>How accurate are the answers?</h4>
                        <p>The assistant provides answers based on the examination manual. All sources are cited for verification.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Can I export my chat history?</h4>
                        <p>Yes, click the download icon in the header to export your chat history as a text file.</p>
                    </div>
                    <div class="faq-item">
                        <h4>How do I clear my chat history?</h4>
                        <p>Click the trash icon in the header to clear your current chat history.</p>
                    </div>
                </div>
                <div class="help-section">
                    <h3>Need More Help?</h3>
                    <p>Contact us at <a href="mailto:support@smartexamassistant.com">support@smartexamassistant.com</a></p>
                </div>
            </div>
        `;
        modal.style.display = 'block';
    }

    function openPrivacyModal() {
        modalTitle.textContent = 'Privacy Policy';
        modalBody.innerHTML = `
            <div class="privacy-container">
                <div class="privacy-section">
                    <h3>Data Collection</h3>
                    <p>Smart Exam Assistant collects and stores your chat history locally in your browser. This data is not transmitted to our servers unless you explicitly choose to share it.</p>
                </div>
                <div class="privacy-section">
                    <h3>Voice Data</h3>
                    <p>When using voice input, your audio is processed locally in your browser and is not stored or transmitted to our servers.</p>
                </div>
                <div class="privacy-section">
                    <h3>Cookies & Local Storage</h3>
                    <p>We use local storage to save your preferences and chat history. You can clear this data at any time through the Settings menu.</p>
                </div>
                <div class="privacy-section">
                    <h3>Third-Party Services</h3>
                    <p>Smart Exam Assistant uses the following third-party services:</p>
                    <ul>
                        <li>Web Speech API for voice recognition (browser-based)</li>
                        <li>Font Awesome for icons</li>
                        <li>Google Fonts for typography</li>
                    </ul>
                </div>
                <div class="privacy-section">
                    <h3>Changes to Privacy Policy</h3>
                    <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>
                </div>
                <div class="privacy-section">
                    <p>Last updated: May 2025</p>
                </div>
            </div>
        `;
        modal.style.display = 'block';
    }

    // Function to apply settings
    function applySettings() {
        const settings = JSON.parse(localStorage.getItem('settings')) || {
            fontSize: 'medium',
            chatWidth: 'medium',
            voiceSpeed: 'normal',
            notificationSounds: true,
            saveHistory: true
        };

        // Apply font size
        document.documentElement.setAttribute('data-font-size', settings.fontSize);

        // Apply chat width
        document.documentElement.setAttribute('data-chat-width', settings.chatWidth);

        // Apply voice speed (for text-to-speech)
        window.voiceSpeed = settings.voiceSpeed === 'slow' ? 0.8 :
                           settings.voiceSpeed === 'fast' ? 1.2 : 1;

        // Apply notification sounds setting
        window.notificationSounds = settings.notificationSounds;

        // Apply save history setting
        window.saveHistory = settings.saveHistory;
    }

    // Apply settings on page load
    applySettings();
});
