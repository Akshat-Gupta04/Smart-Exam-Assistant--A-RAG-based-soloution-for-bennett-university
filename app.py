import os
import logging
from pathlib import Path
import fitz
import json
from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain.prompts import PromptTemplate
from langchain.text_splitter import CharacterTextSplitter
from io import BytesIO
from PIL import Image
import uuid
import time

try:
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logging.warning("pytesseract not installed. OCR functionality disabled.")

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not set.")
base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1/")
pdf_path = "./Examination-Manual-2024-25--2.pdf"  # Update as needed
persist_directory = "./chroma_db"
summary_collection_name = "examination_manual_summaries"
chunk_collection_name = "examination_manual_chunks"
max_history = 3  # Number of past exchanges to retain for context

# Initialize LangChain components
embeddings = OpenAIEmbeddings(api_key=api_key, base_url=base_url, model="text-embedding-ada-002")
llm = ChatOpenAI(api_key=api_key, base_url=base_url, model="gpt-3.5-turbo", temperature=0.2)

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file, using OCR for image-based pages if available."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        logger.error(f"PDF file not found: {pdf_path}")
        return ""
    try:
        pdf = fitz.open(pdf_path)
        text = ""
        image_page_count = 0
        total_pages = len(pdf)

        for page_num in range(total_pages):
            page = pdf[page_num]
            page_text = page.get_text("text").strip()
            if page_text:
                text += page_text + "\n"
                logger.info(f"Page {page_num + 1}: Extracted {len(page_text)} characters (text-based)")
            elif OCR_AVAILABLE:
                images = page.get_images(full=True)
                if images:
                    logger.info(f"Page {page_num + 1}: No text found. Attempting OCR on {len(images)} images.")
                    for img_index, img in enumerate(images):
                        xref = img[0]
                        base_image = pdf.extract_image(xref)
                        image_bytes = base_image["image"]
                        image = Image.open(BytesIO(image_bytes))
                        try:
                            ocr_text = pytesseract.image_to_string(
                                image, lang='eng', config='--psm 6 --dpi 300'
                            ).strip()
                            if ocr_text:
                                text += ocr_text + "\n"
                                logger.info(f"Page {page_num + 1}, Image {img_index + 1}: OCR extracted {len(ocr_text)} characters")
                            else:
                                logger.warning(f"Page {page_num + 1}, Image {img_index + 1}: OCR found no text")
                        except Exception as e:
                            logger.error(f"Page {page_num + 1}, Image {img_index + 1}: OCR failed: {e}")
                    image_page_count += 1
                else:
                    logger.warning(f"Page {page_num + 1}: No text or images found.")
            else:
                logger.warning(f"Page {page_num + 1}: No text found and OCR not available.")

        pdf.close()
        if not text.strip():
            logger.error("No text extracted from PDF. Ensure pytesseract and Pillow are installed for OCR support.")
            return ""
        logger.info(f"Extracted {len(text)} characters from {pdf_path}. Image-based pages: {image_page_count}/{total_pages}")
        return text
    except Exception as e:
        logger.error(f"Error extracting PDF {pdf_path}: {e}")
        return ""

def generate_summary(text, chunk_index):
    """Generate a summary for a chunk of text."""
    prompt = PromptTemplate(
        input_variables=["text"],
        template="Summarize the following text in 2-3 sentences, capturing key points:\n\n{text}\n\nSummary:"
    )
    try:
        logger.info(f"Generating summary for chunk {chunk_index}")
        chain = prompt | llm
        summary = chain.invoke({"text": text[:4000]}).content.strip()  # Limit input to avoid token limits
        logger.debug(f"Generated summary for chunk {chunk_index}: {summary[:100]}...")
        return summary
    except Exception as e:
        logger.error(f"Error generating summary for chunk {chunk_index}: {e}")
        return "Summary unavailable."

def process_document(pdf_path, chunk_size=800, chunk_overlap=200):
    """Process PDF and store in Chroma vector stores for summaries and chunks."""
    # Check if Chroma DB already exists
    if os.path.exists(persist_directory) and os.listdir(persist_directory):
        logger.info(f"Found existing Chroma database at {persist_directory}. Attempting to load...")
        try:
            summary_store = Chroma(
                collection_name=summary_collection_name,
                embedding_function=embeddings,
                persist_directory=persist_directory
            )
            chunk_store = Chroma(
                collection_name=chunk_collection_name,
                embedding_function=embeddings,
                persist_directory=persist_directory
            )
            # Verify collections have data
            summary_count = summary_store._collection.count()
            chunk_count = chunk_store._collection.count()
            if summary_count > 0 and chunk_count > 0:
                logger.info(f"Successfully loaded Chroma stores: {summary_count} summaries, {chunk_count} chunks")
                return [], summary_store, chunk_store
            else:
                logger.warning("Chroma stores are empty. Rebuilding database...")
        except Exception as e:
            logger.error(f"Failed to load Chroma stores: {e}. Rebuilding database...")

    # If no DB exists or loading failed, process the PDF
    logger.info("Processing PDF to create new Chroma vector stores.")
    text = extract_text_from_pdf(pdf_path)
    if not text:
        logger.warning("No text extracted. Creating empty vector stores.")
        return [], Chroma(persist_directory=persist_directory, embedding_function=embeddings, collection_name=summary_collection_name), Chroma(persist_directory=persist_directory, embedding_function=embeddings, collection_name=chunk_collection_name)

    # Split text into chunks
    text_splitter = CharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = text_splitter.split_text(text)
    logger.info(f"Created {len(chunks)} chunks with chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")

    # Generate summaries and prepare metadata
    summaries = []
    chunk_texts = []
    summary_metadatas = []
    chunk_metadatas = []
    for i, chunk in enumerate(chunks):
        chunk_id = str(uuid.uuid4())
        summary = generate_summary(chunk, i)
        summaries.append(summary)
        chunk_texts.append(chunk)
        summary_metadatas.append({"chunk_id": chunk_id, "index": i})
        chunk_metadatas.append({"chunk_id": chunk_id, "index": i})

    # Create Chroma vector stores
    try:
        logger.info(f"Storing {len(chunks)} summaries in {summary_collection_name}")
        summary_store = Chroma.from_texts(
            texts=summaries,
            embedding=embeddings,
            collection_name=summary_collection_name,
            persist_directory=persist_directory,
            metadatas=summary_metadatas,
            collection_metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"Storing {len(chunks)} chunks in {chunk_collection_name}")
        chunk_store = Chroma.from_texts(
            texts=chunk_texts,
            embedding=embeddings,
            collection_name=chunk_collection_name,
            persist_directory=persist_directory,
            metadatas=chunk_metadatas,
            collection_metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"Saved {len(chunks)} summaries and chunks to local Chroma database at {persist_directory}")
        return chunks, summary_store, chunk_store
    except Exception as e:
        logger.error(f"Error creating vector stores: {e}")
        return [], Chroma(persist_directory=persist_directory, embedding_function=embeddings, collection_name=summary_collection_name), Chroma(persist_directory=persist_directory, embedding_function=embeddings, collection_name=chunk_collection_name)

def hierarchical_retrieval(query, summary_store, chunk_store, k=2):
    """Retrieve documents using hierarchical RAG: search summaries, then fetch detailed chunks."""
    try:
        logger.info(f"Processing query: {query[:50]}...")
        # Step 1: Search summaries
        summary_retriever = summary_store.as_retriever(search_kwargs={"k": k * 2})  # Broader search for summaries
        summary_docs = summary_retriever.invoke(query)
        logger.info(f"Retrieved {len(summary_docs)} summaries for query")

        # Step 2: Get corresponding chunks
        chunk_ids = [doc.metadata.get("chunk_id") for doc in summary_docs if doc.metadata.get("chunk_id")]
        if not chunk_ids:
            logger.warning("No relevant summaries found.")
            return []

        # Query chunk store using chunk IDs
        chunk_docs = chunk_store.get(where={"chunk_id": {"$in": chunk_ids}})
        retrieved_docs = [
            {"text": doc, "metadata": meta}
            for doc, meta in zip(chunk_docs.get("documents", []), chunk_docs.get("metadatas", []))
        ]
        logger.info(f"Retrieved {len(retrieved_docs)} detailed chunks")
        return retrieved_docs[:k]  # Return up to k documents
    except Exception as e:
        logger.error(f"Error in hierarchical retrieval: {e}")
        return []

def generate_response(query, docs, history):
    """Generate response using retrieved documents and conversation history."""
    # Prepare context with better formatting and structure
    if docs:
        context_parts = []
        for i, doc in enumerate(docs):
            # Add source number and text with clear separation
            context_parts.append(f"SOURCE {i+1}:\n{doc['text']}")
        context = "\n\n".join(context_parts)
    else:
        context = "No relevant information found in the examination manual."

    # Build conversation history string with clear formatting
    history_text = ""
    if history:
        history_text = "Previous conversation:\n"
        for hist_query, hist_response in history[-max_history:]:
            history_text += f"User: {hist_query}\nAssistant: {hist_response}\n\n"

    # Enhanced prompt with better instructions for maintaining context
    prompt = PromptTemplate(
        input_variables=["history", "context", "question"],
        template=(
            "You are a chatbot assisting with Bennett University's Examination Manual. "
            "Your goal is to provide accurate, helpful information while maintaining proper context throughout the conversation.\n\n"
            "INSTRUCTIONS:\n"
            "1. Use the conversation history to understand the context of the current question\n"
            "2. Reference the provided context from the manual to answer accurately\n"
            "3. Maintain continuity with previous exchanges\n"
            "4. If the question relates to previous questions, acknowledge that relationship\n"
            "5. If information is missing from the context, clearly state that you don't have that specific information\n"
            "6. Always cite the relevant section from the manual when possible\n"
            "7. Be concise but complete in your response\n\n"
            "{history}\n\n"
            "CONTEXT FROM EXAMINATION MANUAL:\n{context}\n\n"
            "CURRENT QUESTION: {question}\n\n"
            "RESPONSE:"
        )
    )

    try:
        logger.info(f"Generating response for query: {query[:50]}... with {len(history)} history entries")
        chain = prompt | llm
        response = chain.invoke({
            "history": history_text,
            "context": context,
            "question": query
        }).content.strip()

        # Add a reference to the conversation context if appropriate
        if history and not "previous" in response.lower() and not "earlier" in response.lower():
            # Check if this question is related to previous ones
            if any(is_related_query(query, hist_query) for hist_query, _ in history[-max_history:]):
                response += "\n\n(Note: This answer takes into account our previous conversation context.)"

        logger.info(f"Response generated successfully")
        return response
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        return "Sorry, I couldn't generate a response due to a technical issue. Please try again or rephrase your question."

def is_related_query(current_query, previous_query):
    """Check if the current query is related to a previous one using simple heuristics."""
    # Convert to lowercase for comparison
    current = current_query.lower()
    previous = previous_query.lower()

    # Check for pronouns that might indicate reference to previous context
    reference_terms = ["it", "this", "that", "these", "those", "they", "them", "their", "he", "she", "his", "her"]
    if any(term in current.split() for term in reference_terms):
        return True

    # Check for shared significant words (excluding common words)
    common_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "about", "like", "through", "over", "before", "after", "since", "during", "above", "below", "from", "up", "down", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "can", "could", "will", "would", "shall", "should", "may", "might", "must"}
    current_words = set(current.split()) - common_words
    previous_words = set(previous.split()) - common_words

    # If there's significant word overlap, consider them related
    common_significant_words = current_words.intersection(previous_words)
    return len(common_significant_words) >= 2

# Global variables to store state
summary_store = None
chunk_store = None
chat_history = {}  # Dictionary to store chat history for each session

# Flask routes
@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/pdf')
def get_pdf_info():
    """Get PDF information."""
    if os.path.exists(pdf_path):
        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            doc.close()
            return jsonify({
                'status': 'success',
                'filename': os.path.basename(pdf_path),
                'total_pages': total_pages
            })
        except Exception as e:
            logger.error(f"Error reading PDF: {e}")
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'PDF file not found'})

@app.route('/pdf/<int:page_num>')
def get_pdf_page(page_num):
    """Get a specific page from the PDF as an image."""
    if os.path.exists(pdf_path):
        try:
            doc = fitz.open(pdf_path)
            if 0 <= page_num < len(doc):
                page = doc[page_num]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_bytes = pix.tobytes("png")
                doc.close()
                return jsonify({
                    'status': 'success',
                    'page_num': page_num,
                    'image_data': f"data:image/png;base64,{img_bytes.decode('latin1')}"
                })
            else:
                doc.close()
                return jsonify({'status': 'error', 'message': 'Page number out of range'})
        except Exception as e:
            logger.error(f"Error getting PDF page: {e}")
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'PDF file not found'})

@app.route('/pdf/thumbnails')
def get_pdf_thumbnails():
    """Get thumbnails for all pages in the PDF."""
    if os.path.exists(pdf_path):
        try:
            doc = fitz.open(pdf_path)
            thumbnails = []

            # Generate thumbnails for the first 20 pages (to avoid too much data)
            max_pages = min(20, len(doc))
            for i in range(max_pages):
                page = doc[i]
                pix = page.get_pixmap(matrix=fitz.Matrix(0.2, 0.2))  # Small thumbnail
                img_bytes = pix.tobytes("png")
                thumbnails.append({
                    'page_num': i,
                    'image_data': f"data:image/png;base64,{img_bytes.decode('latin1')}"
                })

            doc.close()
            return jsonify({
                'status': 'success',
                'thumbnails': thumbnails
            })
        except Exception as e:
            logger.error(f"Error generating thumbnails: {e}")
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'PDF file not found'})

@app.route('/pdf/outline')
def get_pdf_outline():
    """Get the outline/table of contents of the PDF."""
    if os.path.exists(pdf_path):
        try:
            doc = fitz.open(pdf_path)
            toc = doc.get_toc()
            doc.close()

            # Format the TOC for easier consumption
            outline = []
            for item in toc:
                level, title, page = item
                outline.append({
                    'level': level,
                    'title': title,
                    'page': page - 1  # Convert from 1-based to 0-based
                })

            return jsonify({
                'status': 'success',
                'outline': outline
            })
        except Exception as e:
            logger.error(f"Error getting PDF outline: {e}")
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'PDF file not found'})

@app.route('/pdf/search')
def search_pdf():
    """Search for text in the PDF."""
    query = request.args.get('query', '')
    if not query:
        return jsonify({'status': 'error', 'message': 'No search query provided'})

    if os.path.exists(pdf_path):
        try:
            doc = fitz.open(pdf_path)
            results = []

            for page_num in range(len(doc)):
                page = doc[page_num]
                text_instances = page.search_for(query)

                if text_instances:
                    results.append({
                        'page_num': page_num,
                        'count': len(text_instances),
                        'rects': [{'x0': rect[0], 'y0': rect[1], 'x1': rect[2], 'y1': rect[3]}
                                 for rect in text_instances]
                    })

            doc.close()
            return jsonify({
                'status': 'success',
                'query': query,
                'results': results,
                'total_matches': sum(r['count'] for r in results)
            })
        except Exception as e:
            logger.error(f"Error searching PDF: {e}")
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'PDF file not found'})

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    session_id = request.sid
    logger.info(f"Client connected: {session_id}")
    chat_history[session_id] = []

    # Initialize RAG system
    global summary_store, chunk_store
    if summary_store is None or chunk_store is None:
        try:
            _, summary_store, chunk_store = process_document(pdf_path)
            logger.info("RAG system initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing RAG system: {e}")
            emit('error', {'message': f"Error initializing chatbot: {str(e)}"})
            return

    # Send welcome message
    welcome_message = {
        'type': 'bot',
        'content': (
            "Welcome to the Examination Manual Chatbot!\n\n"
            "Ask about Bennett University's exam policies.\n"
            "Examples:\n"
            "- Re-evaluation fee?\n"
            "- Grievance process?\n"
            "- Missing an exam due to medical reasons?\n\n"
            "What would you like to know?"
        ),
        'timestamp': time.time()
    }
    emit('message', welcome_message)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    session_id = request.sid
    logger.info(f"Client disconnected: {session_id}")
    if session_id in chat_history:
        del chat_history[session_id]

@socketio.on('message')
def handle_message(data):
    """Handle incoming messages."""
    session_id = request.sid
    query = data.get('content', '').strip()

    if not query:
        emit('message', {
            'type': 'bot',
            'content': "Please enter a query.",
            'timestamp': time.time()
        })
        return

    # Send typing indicator
    emit('typing', {'status': True})

    try:
        # Get session history
        history = chat_history.get(session_id, [])

        # Process query
        emit('processing', {'status': 'retrieving', 'progress': 0})

        # Simulate progress updates for better UX
        emit('processing', {'status': 'retrieving', 'progress': 30, 'message': 'Searching through summaries...'})
        time.sleep(0.5)  # Simulate processing time

        emit('processing', {'status': 'retrieving', 'progress': 60, 'message': 'Finding relevant chunks...'})
        docs = hierarchical_retrieval(query, summary_store, chunk_store, k=2)

        emit('processing', {'status': 'retrieving', 'progress': 100, 'message': 'Retrieval complete'})
        time.sleep(0.3)  # Simulate processing time

        emit('processing', {'status': 'generating', 'progress': 0, 'message': 'Analyzing context...'})
        time.sleep(0.3)  # Simulate processing time

        emit('processing', {'status': 'generating', 'progress': 50, 'message': 'Formulating response...'})
        response = generate_response(query, docs, history)

        emit('processing', {'status': 'generating', 'progress': 100, 'message': 'Response ready'})

        # Update history
        history.append((query, response))
        chat_history[session_id] = history[-max_history:]  # Keep only the last max_history entries

        # Prepare context data for visualization
        context_data = []
        for i, doc in enumerate(docs):
            context_data.append({
                'text': doc['text'][:300] + '...' if len(doc['text']) > 300 else doc['text'],
                'metadata': doc['metadata']
            })

        # Generate confidence metrics (simulated for now)
        confidence_metrics = {
            'relevance': min(95, 70 + len(docs) * 10),  # Higher with more docs
            'accuracy': min(90, 65 + len(docs) * 10),
            'completeness': min(85, 60 + len(docs) * 10),
            'coherence': 88,
            'conciseness': 92
        }

        # Prepare hierarchical visualization data
        visualization_data = {
            'query': query,
            'summaries': [
                {
                    'text': doc['text'][:150] + '...',
                    'score': 0.85 - (i * 0.1),  # Simulated scores
                    'metadata': doc['metadata']
                } for i, doc in enumerate(docs[:2])  # Top 2 summaries
            ],
            'chunks': [
                {
                    'text': doc['text'][:150] + '...',
                    'score': 0.95 - (i * 0.05),  # Simulated scores
                    'metadata': doc['metadata']
                } for i, doc in enumerate(docs)
            ]
        }

        # Send response with all the enhanced data
        emit('message', {
            'type': 'bot',
            'content': response,
            'context': context_data,
            'confidence': confidence_metrics,
            'visualization': visualization_data,
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        emit('message', {
            'type': 'bot',
            'content': f"Sorry, an error occurred: {str(e)}",
            'timestamp': time.time()
        })
    finally:
        # Stop typing indicator
        emit('typing', {'status': False})

@socketio.on('get_chat_history')
def handle_get_chat_history():
    """Get chat history for the current session."""
    session_id = request.sid
    history = chat_history.get(session_id, [])

    # Format history for the client
    formatted_history = []
    for i, (query, response) in enumerate(history):
        formatted_history.append({
            'id': i,
            'query': query,
            'response': response,
            'timestamp': time.time() - (len(history) - i) * 300  # Simulate timestamps
        })

    emit('chat_history', {
        'history': formatted_history
    })

@socketio.on('clear_chat')
def handle_clear_chat():
    """Clear chat history for the current session."""
    session_id = request.sid
    chat_history[session_id] = []

    emit('chat_cleared', {
        'status': 'success',
        'message': 'Chat history cleared'
    })

@socketio.on('export_chat')
def handle_export_chat(data):
    """Export chat history in the requested format."""
    session_id = request.sid
    history = chat_history.get(session_id, [])
    format_type = data.get('format', 'markdown')

    if not history:
        emit('export_result', {
            'status': 'error',
            'message': 'No chat history to export'
        })
        return

    try:
        if format_type == 'markdown':
            content = "# Examination Manual Chat Export\n\n"
            content += f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n"

            for i, (query, response) in enumerate(history):
                content += f"## Question {i+1}\n\n"
                content += f"**User**: {query}\n\n"
                content += f"**Assistant**: {response}\n\n"
                content += "---\n\n"

        elif format_type == 'json':
            content = json.dumps({
                'timestamp': time.time(),
                'date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'conversations': [
                    {
                        'index': i,
                        'user': query,
                        'assistant': response
                    } for i, (query, response) in enumerate(history)
                ]
            }, indent=2)

        else:
            emit('export_result', {
                'status': 'error',
                'message': f'Unsupported export format: {format_type}'
            })
            return

        emit('export_result', {
            'status': 'success',
            'format': format_type,
            'content': content
        })

    except Exception as e:
        logger.error(f"Error exporting chat: {e}")
        emit('export_result', {
            'status': 'error',
            'message': f'Error exporting chat: {str(e)}'
        })

if __name__ == "__main__":
    # Initialize RAG system at startup
    try:
        _, summary_store, chunk_store = process_document(pdf_path)
        logger.info("RAG system initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing RAG system: {e}")

    # Run the Flask app with Socket.IO
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)
