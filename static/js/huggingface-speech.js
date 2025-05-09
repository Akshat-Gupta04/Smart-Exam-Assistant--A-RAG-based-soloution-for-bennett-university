// Hugging Face Speech Recognition Implementation
// This file implements speech recognition using Hugging Face's Whisper model via Transformers.js

class HuggingFaceSpeechRecognition {
    constructor(options = {}) {
        this.options = {
            model: 'Xenova/whisper-tiny.en',
            language: 'english',
            task: 'transcribe',
            ...options
        };
        
        this.isListening = false;
        this.pipeline = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.transcription = '';
        this.continuous = false;
        this.interimResults = false;
        this.lang = 'en';
        
        // Event handlers
        this.onstart = null;
        this.onend = null;
        this.onresult = null;
        this.onerror = null;
        
        // Initialize the pipeline
        this._initPipeline();
    }
    
    async _initPipeline() {
        try {
            // Show loading indicator
            this._showLoadingMessage();
            
            // Import the pipeline
            const { pipeline } = await import('@xenova/transformers');
            
            // Load the model
            this.pipeline = await pipeline('automatic-speech-recognition', this.options.model);
            
            // Hide loading indicator
            this._hideLoadingMessage();
            
            console.log('Hugging Face speech recognition model loaded successfully');
        } catch (error) {
            console.error('Error initializing Hugging Face speech recognition:', error);
            this._hideLoadingMessage();
            
            if (this.onerror) {
                this.onerror({ error: 'model_load_error', message: error.message });
            }
        }
    }
    
    _showLoadingMessage() {
        // Create loading message if it doesn't exist
        if (!document.getElementById('hf-loading-message')) {
            const loadingMessage = document.createElement('div');
            loadingMessage.id = 'hf-loading-message';
            loadingMessage.style.position = 'fixed';
            loadingMessage.style.top = '20px';
            loadingMessage.style.left = '50%';
            loadingMessage.style.transform = 'translateX(-50%)';
            loadingMessage.style.backgroundColor = '#4361ee';
            loadingMessage.style.color = 'white';
            loadingMessage.style.padding = '10px 20px';
            loadingMessage.style.borderRadius = '30px';
            loadingMessage.style.zIndex = '9999';
            loadingMessage.style.boxShadow = '0 4px 15px rgba(67, 97, 238, 0.3)';
            loadingMessage.style.fontWeight = 'bold';
            loadingMessage.textContent = 'Loading speech recognition model...';
            document.body.appendChild(loadingMessage);
        }
    }
    
    _hideLoadingMessage() {
        const loadingMessage = document.getElementById('hf-loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
    }
    
    async start() {
        if (this.isListening) {
            return;
        }
        
        if (!this.pipeline) {
            console.warn('Speech recognition model not loaded yet. Initializing...');
            await this._initPipeline();
        }
        
        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create media recorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
                
                // For interim results
                if (this.interimResults && this.audioChunks.length > 0) {
                    this._processInterimAudio();
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                await this._processAudio();
                
                // If continuous mode is enabled, restart recording
                if (this.continuous && this.isListening) {
                    this.mediaRecorder.start(1000); // Collect data every second
                } else {
                    this.isListening = false;
                    
                    // Stop all tracks in the stream
                    stream.getTracks().forEach(track => track.stop());
                    
                    if (this.onend) {
                        this.onend();
                    }
                }
            };
            
            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.isListening = true;
            
            if (this.onstart) {
                this.onstart();
            }
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            
            if (this.onerror) {
                this.onerror({ error: 'start_error', message: error.message });
            }
        }
    }
    
    stop() {
        if (!this.isListening || !this.mediaRecorder) {
            return;
        }
        
        this.mediaRecorder.stop();
    }
    
    async _processInterimAudio() {
        try {
            // Create a copy of the current audio chunks
            const currentChunks = [...this.audioChunks];
            
            // Create a blob from the audio chunks
            const audioBlob = new Blob(currentChunks, { type: 'audio/webm' });
            
            // Process the audio in the background
            this._transcribeAudio(audioBlob, true);
        } catch (error) {
            console.error('Error processing interim audio:', error);
        }
    }
    
    async _processAudio() {
        try {
            if (this.audioChunks.length === 0) {
                return;
            }
            
            // Create a blob from the audio chunks
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // Process the audio
            await this._transcribeAudio(audioBlob, false);
            
            // Clear the audio chunks
            this.audioChunks = [];
        } catch (error) {
            console.error('Error processing audio:', error);
            
            if (this.onerror) {
                this.onerror({ error: 'process_error', message: error.message });
            }
        }
    }
    
    async _transcribeAudio(audioBlob, isInterim) {
        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Transcribe the audio
            const result = await this.pipeline(new Blob([arrayBuffer]), {
                language: this.lang.split('-')[0] || 'en',
                task: this.options.task
            });
            
            // Get the transcription
            const transcription = result.text || '';
            
            if (transcription && this.onresult) {
                // Create a result object similar to the Web Speech API
                const resultEvent = {
                    resultIndex: 0,
                    results: [
                        [
                            {
                                transcript: transcription,
                                confidence: 0.9
                            }
                        ]
                    ]
                };
                
                // Set isFinal based on whether this is an interim result
                resultEvent.results[0].isFinal = !isInterim;
                
                // Call the onresult handler
                this.onresult(resultEvent);
            }
        } catch (error) {
            console.error('Error transcribing audio:', error);
            
            if (this.onerror) {
                this.onerror({ error: 'transcribe_error', message: error.message });
            }
        }
    }
}

// Make the class available globally
window.HuggingFaceSpeechRecognition = HuggingFaceSpeechRecognition;
