// Voice input and text-to-speech functionality using Web Speech API

document.addEventListener('DOMContentLoaded', function() {
    // Voice input elements
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const chatInput = document.getElementById('chat-input');
    const voiceInputIndicator = document.getElementById('voice-input-indicator');

    // Text-to-speech elements
    const textToSpeechBtn = document.getElementById('text-to-speech-btn');

    let recognition = null;
    let isListening = false;

    // Check if Web Speech API is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        // Create a new speech recognition instance
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Initialize voice input
        initVoiceInput();
    } else {
        console.warn('Speech Recognition API not supported');
        if (voiceInputBtn) {
            voiceInputBtn.style.display = 'none';
        }
    }

    // Initialize text-to-speech
    if ('speechSynthesis' in window) {
        initTextToSpeech();
    } else {
        console.warn('Text-to-Speech API not supported');
        if (textToSpeechBtn) {
            textToSpeechBtn.style.display = 'none';
        }
    }

    // Initialize voice input
    function initVoiceInput() {
        if (!voiceInputBtn || !chatInput) return;

        // Variables for tracking voice input state
        let originalText = '';
        let lastInterimResult = '';

        voiceInputBtn.addEventListener('click', toggleVoiceInput);

        recognition.onstart = function() {
            isListening = true;
            voiceInputBtn.classList.add('active');

            // Show the voice input indicator
            if (voiceInputIndicator) {
                voiceInputIndicator.style.display = 'flex';

                // Ensure the chat input wrapper remains visible
                const chatInputWrapper = document.querySelector('.chat-input-wrapper');
                if (chatInputWrapper) {
                    chatInputWrapper.style.opacity = '1';
                    chatInputWrapper.style.visibility = 'visible';
                    chatInputWrapper.style.display = 'flex';
                }

                // Position the indicator properly
                voiceInputIndicator.style.position = 'absolute';
                voiceInputIndicator.style.top = '10px';
                voiceInputIndicator.style.left = '50%';
                voiceInputIndicator.style.transform = 'translateX(-50%)';
                voiceInputIndicator.style.zIndex = '100';

                // Add a pulsing effect to make it more noticeable
                voiceInputIndicator.style.animation = 'pulse-border 2s infinite';
            }

            console.log('Speech recognition started');
        };

        recognition.onend = function() {
            isListening = false;
            voiceInputBtn.classList.remove('active');

            if (voiceInputIndicator) {
                voiceInputIndicator.style.display = 'none';
            }

            // Reset the variables for the next voice input session
            originalText = '';
            lastInterimResult = '';

            console.log('Speech recognition ended');
        };

        // Store the original text and interim results
        // Variables are declared at the top of the function scope

        recognition.onresult = function(event) {
            // Get the current input value when recognition starts
            if (originalText === '') {
                originalText = chatInput.value || '';
            }

            let interimTranscript = '';
            let finalTranscript = '';

            // Process all results
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                    console.log('Final transcript:', finalTranscript);
                } else {
                    interimTranscript += transcript;
                    console.log('Interim transcript:', interimTranscript);
                }
            }

            // Handle final transcript - append to original text
            if (finalTranscript !== '') {
                // Add a space if needed
                const separator = (originalText && !originalText.endsWith(' ')) ? ' ' : '';

                // Update the input value with original text + final transcript
                chatInput.value = originalText + separator + finalTranscript;

                // Update the original text to include this final transcript
                originalText = chatInput.value;

                // Clear the last interim result
                lastInterimResult = '';

                // Trigger input event to resize textarea
                const inputEvent = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                chatInput.dispatchEvent(inputEvent);
            }
            // Handle interim transcript - temporarily show but don't permanently add
            else if (interimTranscript !== '') {
                // First remove the previous interim result if there was one
                if (lastInterimResult !== '') {
                    chatInput.value = chatInput.value.substring(0, chatInput.value.length - lastInterimResult.length);
                }

                // Add a space if needed
                const separator = (originalText && !originalText.endsWith(' ')) ? ' ' : '';

                // Show the interim result
                chatInput.value = originalText + separator + interimTranscript;

                // Store this interim result to remove it next time
                lastInterimResult = (separator + interimTranscript);

                // Trigger input event to resize textarea
                const inputEvent = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                chatInput.dispatchEvent(inputEvent);
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);

            // Show error message to user
            alert('Speech recognition error: ' + event.error + '. Please try again.');

            isListening = false;
            voiceInputBtn.classList.remove('active');

            if (voiceInputIndicator) {
                voiceInputIndicator.style.display = 'none';
            }

            // Try to restart recognition after error
            try {
                recognition.abort();
            } catch (e) {
                console.error('Error aborting recognition:', e);
            }
        };
    }

    // Toggle voice input
    function toggleVoiceInput() {
        if (isListening) {
            // Stop listening
            try {
                recognition.stop();
                console.log('Stopping speech recognition');
            } catch (error) {
                console.error('Error stopping speech recognition:', error);

                // Reset state if there's an error
                isListening = false;
                voiceInputBtn.classList.remove('active');
                if (voiceInputIndicator) {
                    voiceInputIndicator.style.display = 'none';
                }
            }
        } else {
            // Start listening
            try {
                // First, request microphone permission
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function(stream) {
                        // Permission granted, start recognition
                        console.log('Microphone permission granted, starting speech recognition');

                        // Stop all tracks to release the microphone
                        stream.getTracks().forEach(track => track.stop());

                        // Start recognition
                        recognition.start();
                    })
                    .catch(function(error) {
                        // Permission denied or error
                        console.error('Error accessing microphone:', error);
                        alert('Please allow microphone access to use voice input.');
                    });
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                alert('Error starting speech recognition. Please try again.');
            }
        }
    }

    // Initialize text-to-speech
    function initTextToSpeech() {
        if (!textToSpeechBtn) return;

        // Global variable to store the current utterance
        window.currentUtterance = null;

        // Ensure voices are loaded
        let voices = [];

        function loadVoices() {
            voices = window.speechSynthesis.getVoices();
            console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`).join(', '));

            // Log Indian voices specifically
            const indianVoices = voices.filter(v => v.lang.includes('en-IN') || v.name.includes('Indian'));
            if (indianVoices.length > 0) {
                console.log('Indian voices available:', indianVoices.map(v => `${v.name} (${v.lang})`).join(', '));
            } else {
                console.log('No specific Indian voices found, will fall back to other English voices');
            }
        }

        // Load voices immediately if available
        loadVoices();

        // Chrome loads voices asynchronously, so we need this event
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        // Function to speak text
        window.speakText = function(text) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Create a new utterance
            const utterance = new SpeechSynthesisUtterance(text);

            // Get available voices - use our cached voices or get them again if needed
            const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();

            // Try to find an Indian English voice
            const indianVoice = availableVoices.find(voice =>
                (voice.lang.includes('en-IN') || voice.name.includes('Indian')) && !voice.name.includes('Male')
            ) || availableVoices.find(voice =>
                voice.lang.includes('en-IN') || voice.name.includes('Indian')
            ) || availableVoices.find(voice =>
                voice.lang.includes('hi-') // Hindi voices as fallback
            ) || availableVoices.find(voice =>
                voice.lang.includes('en') && voice.name.includes('Google') && !voice.name.includes('Male')
            ) || availableVoices.find(voice =>
                voice.lang.includes('en')
            ) || availableVoices[0];

            if (indianVoice) {
                utterance.voice = indianVoice;
                console.log('Using voice:', indianVoice.name, indianVoice.lang);
            }

            // Set properties for Indian accent
            utterance.rate = 0.9;    // Slightly slower rate for better clarity
            utterance.pitch = 1.1;   // Slightly higher pitch typical for Indian accent
            utterance.volume = 1;    // Full volume

            // Store the current utterance
            window.currentUtterance = utterance;

            // Add event listeners
            utterance.onstart = function() {
                textToSpeechBtn.classList.add('active');
            };

            utterance.onend = function() {
                textToSpeechBtn.classList.remove('active');
                window.currentUtterance = null;
            };

            utterance.onerror = function(event) {
                console.error('Speech synthesis error:', event);
                textToSpeechBtn.classList.remove('active');
                window.currentUtterance = null;
            };

            // Speak the text
            window.speechSynthesis.speak(utterance);
        };

        // Function to stop speaking
        window.stopSpeaking = function() {
            window.speechSynthesis.cancel();
            textToSpeechBtn.classList.remove('active');
            window.currentUtterance = null;
        };

        // Toggle text-to-speech for the latest bot message
        textToSpeechBtn.addEventListener('click', function() {
            if (window.currentUtterance) {
                window.stopSpeaking();
            } else {
                const botMessages = document.querySelectorAll('.message-bot');
                if (botMessages.length > 0) {
                    const latestBotMessage = botMessages[botMessages.length - 1];
                    const messageContent = latestBotMessage.querySelector('.message-content');
                    if (messageContent) {
                        // Get text content without HTML tags
                        const textToSpeak = messageContent.textContent;
                        window.speakText(textToSpeak);
                    }
                }
            }
        });
    }
});
