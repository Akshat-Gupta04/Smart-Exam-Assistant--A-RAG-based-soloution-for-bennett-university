// Enhanced PDF viewer functionality

document.addEventListener('DOMContentLoaded', function() {
    // PDF viewer elements
    const pdfContainer = document.querySelector('.pdf-container');
    const pdfPage = document.getElementById('pdf-page');
    const pdfLoading = document.getElementById('pdf-loading');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const rotateBtn = document.getElementById('rotate-pdf');
    const fullscreenBtn = document.getElementById('fullscreen-pdf');
    const searchPdfInput = document.getElementById('search-pdf');
    const searchPdfBtn = document.getElementById('search-pdf-btn');
    const annotateBtn = document.getElementById('annotate-pdf');
    const thumbnailsBtn = document.getElementById('thumbnails-pdf');
    const thumbnailsContainer = document.getElementById('pdf-thumbnails');
    const pdfOutlineBtn = document.getElementById('pdf-outline-btn');
    const pdfOutlineContainer = document.getElementById('pdf-outline');
    
    // PDF state
    let currentPage = 0;
    let totalPages = 0;
    let currentZoom = 1;
    let currentRotation = 0;
    let pdfThumbnails = [];
    let pdfOutline = [];
    let annotations = [];
    let searchResults = [];
    let currentSearchIndex = -1;
    
    // Initialize PDF viewer
    function initPdfViewer() {
        loadPdfInfo();
        
        // Add event listeners for PDF controls
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function() {
                navigateToPdfPage(currentPage - 1);
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function() {
                navigateToPdfPage(currentPage + 1);
            });
        }
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function() {
                zoomPdf(0.1);
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', function() {
                zoomPdf(-0.1);
            });
        }
        
        if (rotateBtn) {
            rotateBtn.addEventListener('click', function() {
                rotatePdf(90);
            });
        }
        
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function() {
                toggleFullscreen();
            });
        }
        
        if (searchPdfBtn && searchPdfInput) {
            searchPdfBtn.addEventListener('click', function() {
                searchPdf(searchPdfInput.value);
            });
            
            searchPdfInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    searchPdf(searchPdfInput.value);
                }
            });
        }
        
        if (annotateBtn) {
            annotateBtn.addEventListener('click', function() {
                toggleAnnotationMode();
            });
        }
        
        if (thumbnailsBtn) {
            thumbnailsBtn.addEventListener('click', function() {
                toggleThumbnails();
            });
        }
        
        if (pdfOutlineBtn) {
            pdfOutlineBtn.addEventListener('click', function() {
                toggleOutline();
            });
        }
        
        // Add keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'input') {
                return;
            }
            
            if (e.key === 'ArrowLeft') {
                navigateToPdfPage(currentPage - 1);
            } else if (e.key === 'ArrowRight') {
                navigateToPdfPage(currentPage + 1);
            } else if (e.key === '+') {
                zoomPdf(0.1);
            } else if (e.key === '-') {
                zoomPdf(-0.1);
            } else if (e.key === 'r') {
                rotatePdf(90);
            } else if (e.key === 'f') {
                toggleFullscreen();
            }
        });
        
        // Add touch gestures for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        if (pdfContainer) {
            pdfContainer.addEventListener('touchstart', function(e) {
                touchStartX = e.changedTouches[0].screenX;
            });
            
            pdfContainer.addEventListener('touchend', function(e) {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            });
        }
        
        function handleSwipe() {
            if (touchEndX < touchStartX - 50) {
                // Swipe left
                navigateToPdfPage(currentPage + 1);
            } else if (touchEndX > touchStartX + 50) {
                // Swipe right
                navigateToPdfPage(currentPage - 1);
            }
        }
    }
    
    // Load PDF information
    function loadPdfInfo() {
        if (!pdfPage) return;
        
        fetch('/pdf')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    totalPages = data.total_pages;
                    if (totalPagesEl) totalPagesEl.textContent = totalPages;
                    
                    // Load first page
                    navigateToPdfPage(0);
                    
                    // Enable navigation buttons
                    if (nextPageBtn) nextPageBtn.disabled = false;
                    
                    // Load thumbnails if available
                    if (thumbnailsContainer) {
                        loadThumbnails();
                    }
                    
                    // Load outline if available
                    if (pdfOutlineContainer) {
                        loadOutline();
                    }
                } else {
                    console.error('Error loading PDF:', data.message);
                    if (pdfLoading) {
                        pdfLoading.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Error loading PDF: ${data.message}</p>`;
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching PDF info:', error);
                if (pdfLoading) {
                    pdfLoading.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Error loading PDF</p>`;
                }
            });
    }
    
    // Navigate to a specific PDF page
    function navigateToPdfPage(pageNum) {
        if (!pdfPage) return;
        if (pageNum < 0 || pageNum >= totalPages) return;
        
        currentPage = pageNum;
        if (currentPageEl) currentPageEl.textContent = currentPage + 1;
        
        // Update navigation buttons
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 0;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages - 1;
        
        // Show loading indicator
        if (pdfLoading) pdfLoading.style.display = 'flex';
        pdfPage.style.opacity = '0.3';
        
        // Apply current zoom and rotation
        const transformStyle = `scale(${currentZoom}) rotate(${currentRotation}deg)`;
        pdfPage.style.transform = transformStyle;
        
        fetch(`/pdf/${pageNum}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    pdfPage.src = data.image_data;
                    pdfPage.onload = function() {
                        if (pdfLoading) pdfLoading.style.display = 'none';
                        pdfPage.style.opacity = '1';
                        
                        // Highlight search results if any
                        highlightSearchResults();
                        
                        // Show annotations if any
                        showAnnotations();
                        
                        // Update active thumbnail
                        updateActiveThumbnail();
                    };
                } else {
                    console.error('Error loading PDF page:', data.message);
                    if (pdfLoading) {
                        pdfLoading.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Error loading page: ${data.message}</p>`;
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching PDF page:', error);
                if (pdfLoading) {
                    pdfLoading.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Error loading page</p>`;
                }
            });
    }
    
    // Zoom PDF
    function zoomPdf(delta) {
        currentZoom = Math.max(0.5, Math.min(3, currentZoom + delta));
        if (pdfPage) {
            pdfPage.style.transform = `scale(${currentZoom}) rotate(${currentRotation}deg)`;
        }
    }
    
    // Rotate PDF
    function rotatePdf(degrees) {
        currentRotation = (currentRotation + degrees) % 360;
        if (pdfPage) {
            pdfPage.style.transform = `scale(${currentZoom}) rotate(${currentRotation}deg)`;
        }
    }
    
    // Toggle fullscreen
    function toggleFullscreen() {
        const pdfViewer = document.querySelector('.pdf-viewer');
        if (!pdfViewer) return;
        
        if (!document.fullscreenElement) {
            pdfViewer.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    // Initialize if PDF viewer elements exist
    if (pdfPage) {
        initPdfViewer();
    }
});
