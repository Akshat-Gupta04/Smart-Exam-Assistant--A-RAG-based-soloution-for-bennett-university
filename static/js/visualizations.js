// Advanced visualizations for the application

document.addEventListener('DOMContentLoaded', function() {
    // Initialize particles background if the container exists
    const particlesContainer = document.getElementById('particles-container');
    if (particlesContainer) {
        initParticles();
    }
    
    // Initialize retrieval visualization if the container exists
    const retrievalVisualization = document.getElementById('retrieval-visualization');
    if (retrievalVisualization) {
        initRetrievalVisualization();
    }
    
    // Initialize confidence chart if the container exists
    const confidenceChart = document.getElementById('confidence-chart');
    if (confidenceChart) {
        initConfidenceChart();
    }
});

// Initialize particles background
function initParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-container', {
            particles: {
                number: {
                    value: 80,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: '#4361ee'
                },
                shape: {
                    type: 'circle',
                    stroke: {
                        width: 0,
                        color: '#000000'
                    },
                    polygon: {
                        nb_sides: 5
                    }
                },
                opacity: {
                    value: 0.5,
                    random: false,
                    anim: {
                        enable: false,
                        speed: 1,
                        opacity_min: 0.1,
                        sync: false
                    }
                },
                size: {
                    value: 3,
                    random: true,
                    anim: {
                        enable: false,
                        speed: 40,
                        size_min: 0.1,
                        sync: false
                    }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#4361ee',
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false,
                    attract: {
                        enable: false,
                        rotateX: 600,
                        rotateY: 1200
                    }
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: {
                        enable: true,
                        mode: 'grab'
                    },
                    onclick: {
                        enable: true,
                        mode: 'push'
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 140,
                        line_linked: {
                            opacity: 1
                        }
                    },
                    bubble: {
                        distance: 400,
                        size: 40,
                        duration: 2,
                        opacity: 8,
                        speed: 3
                    },
                    repulse: {
                        distance: 200,
                        duration: 0.4
                    },
                    push: {
                        particles_nb: 4
                    },
                    remove: {
                        particles_nb: 2
                    }
                }
            },
            retina_detect: true
        });
    } else {
        console.warn('particles.js not loaded');
    }
}

// Initialize retrieval visualization
function initRetrievalVisualization() {
    // This function will be called when a new query is processed
    window.updateRetrievalVisualization = function(data) {
        const container = document.getElementById('retrieval-visualization');
        if (!container) return;
        
        // Clear previous visualization
        container.innerHTML = '';
        
        // Create hierarchical visualization
        const hierarchyContainer = document.createElement('div');
        hierarchyContainer.className = 'hierarchy-container';
        
        // Create query node
        const queryNode = document.createElement('div');
        queryNode.className = 'hierarchy-node query-node animate-fade-in-up';
        queryNode.innerHTML = `
            <div class="node-icon"><i class="fas fa-question-circle"></i></div>
            <div class="node-content">${data.query}</div>
        `;
        hierarchyContainer.appendChild(queryNode);
        
        // Create connections container
        const connectionsContainer = document.createElement('div');
        connectionsContainer.className = 'hierarchy-connections';
        hierarchyContainer.appendChild(connectionsContainer);
        
        // Create summary nodes
        const summaryNodesContainer = document.createElement('div');
        summaryNodesContainer.className = 'hierarchy-level summary-level';
        
        data.summaries.forEach((summary, index) => {
            const summaryNode = document.createElement('div');
            summaryNode.className = `hierarchy-node summary-node animate-fade-in-up stagger-${index + 1}`;
            summaryNode.innerHTML = `
                <div class="node-icon"><i class="fas fa-file-alt"></i></div>
                <div class="node-content">${summary.text.substring(0, 100)}...</div>
                <div class="node-score">Score: ${summary.score.toFixed(2)}</div>
            `;
            summaryNodesContainer.appendChild(summaryNode);
            
            // Add connection line
            const connection = document.createElement('div');
            connection.className = 'hierarchy-connection';
            connectionsContainer.appendChild(connection);
        });
        
        hierarchyContainer.appendChild(summaryNodesContainer);
        
        // Create chunk nodes
        const chunkNodesContainer = document.createElement('div');
        chunkNodesContainer.className = 'hierarchy-level chunk-level';
        
        data.chunks.forEach((chunk, index) => {
            const chunkNode = document.createElement('div');
            chunkNode.className = `hierarchy-node chunk-node animate-fade-in-up stagger-${index + 3}`;
            chunkNode.innerHTML = `
                <div class="node-icon"><i class="fas fa-puzzle-piece"></i></div>
                <div class="node-content">${chunk.text.substring(0, 100)}...</div>
                <div class="node-score">Score: ${chunk.score.toFixed(2)}</div>
            `;
            chunkNodesContainer.appendChild(chunkNode);
        });
        
        hierarchyContainer.appendChild(chunkNodesContainer);
        container.appendChild(hierarchyContainer);
    };
}

// Initialize confidence chart
function initConfidenceChart() {
    if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById('confidence-chart').getContext('2d');
        
        // Create initial empty chart
        window.confidenceChart = new Chart(ctx, {
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
            window.confidenceChart.data.datasets[0].data = [
                data.relevance || 0,
                data.accuracy || 0,
                data.completeness || 0,
                data.coherence || 0,
                data.conciseness || 0
            ];
            window.confidenceChart.update();
        };
    } else {
        console.warn('Chart.js not loaded');
    }
}
