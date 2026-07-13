import json
from sqlalchemy.orm import Session
from database import VectorStore
from config import settings
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class RAGAgent:
    def __init__(self):
        pass

    def add_document(self, db: Session, doc_name: str, text: str, api_key: str = "", provider: str = "gemini"):
        """
        Split a document into paragraphs, calculate embeddings (or mock if no key), and save to the database.
        """
        # Chunk text by double newlines or paragraph segments (roughly 500 chars)
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        for p in paragraphs:
            if len(p) > 800:
                # Sub-chunk if too large
                words = p.split()
                sub_chunk = []
                word_count = 0
                for w in words:
                    sub_chunk.append(w)
                    word_count += 1
                    if word_count >= 100:
                        chunks.append(" ".join(sub_chunk))
                        sub_chunk = []
                        word_count = 0
                if sub_chunk:
                    chunks.append(" ".join(sub_chunk))
            else:
                chunks.append(p)

        for i, chunk in enumerate(chunks):
            embedding_vector = self._get_embedding(chunk, api_key, provider)
            
            db_entry = VectorStore(
                doc_name=doc_name,
                text_chunk=chunk,
                embedding=json.dumps(embedding_vector),
                doc_metadata=json.dumps({"index": i, "doc_name": doc_name})
            )
            db.add(db_entry)
        
        db.commit()
        return len(chunks)

    def retrieve_context(self, db: Session, query: str, top_n: int = 3, api_key: str = "", provider: str = "gemini") -> list[dict]:
        """
        Retrieve the top N relevant document chunks matching the user's query.
        """
        # Load all documents from vector store
        records = db.query(VectorStore).all()
        if not records:
            return []

        # If we have an API key, we do vector similarity
        if (api_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY):
            try:
                query_vector = self._get_embedding(query, api_key, provider)
                
                scored_records = []
                for rec in records:
                    rec_vector = json.loads(rec.embedding)
                    # Vector Cosine similarity
                    if rec_vector and query_vector and len(rec_vector) == len(query_vector):
                        v1 = np.array(query_vector)
                        v2 = np.array(rec_vector)
                        dot = np.dot(v1, v2)
                        norm_a = np.linalg.norm(v1)
                        norm_b = np.linalg.norm(v2)
                        score = float(dot / (norm_a * norm_b)) if norm_a > 0 and norm_b > 0 else 0.0
                        scored_records.append((score, rec))
                
                scored_records = sorted(scored_records, key=lambda x: x[0], reverse=True)
                return [{"chunk": item[1].text_chunk, "doc": item[1].doc_name, "score": item[0]} for item in scored_records[:top_n]]
            except Exception:
                # Fall back to TF-IDF if vector math errors out
                pass

        # TF-IDF Cosine Similarity Fallback
        documents = [rec.text_chunk for rec in records]
        vectorizer = TfidfVectorizer()
        try:
            tfidf_matrix = vectorizer.fit_transform(documents)
            query_tfidf = vectorizer.transform([query])
            similarities = cosine_similarity(query_tfidf, tfidf_matrix).flatten()
            
            top_indices = np.argsort(similarities)[::-1][:top_n]
            results = []
            for idx in top_indices:
                score = float(similarities[idx])
                if score > 0.05: # threshold
                    rec = records[idx]
                    results.append({
                        "chunk": rec.text_chunk,
                        "doc": rec.doc_name,
                        "score": score
                    })
            return results
        except Exception:
            # Fallback to simple substring matching if TF-IDF fails
            results = []
            for rec in records:
                if any(word in rec.text_chunk.lower() for word in query.lower().split() if len(word) > 3):
                    results.append({"chunk": rec.text_chunk, "doc": rec.doc_name, "score": 0.5})
            return results[:top_n]

    def _get_embedding(self, text: str, api_key: str = "", provider: str = "gemini") -> list[float]:
        """
        Get vector embedding. Returns a list of floats, or a mock representation if no key.
        """
        # If API is available, get real embeddings
        try:
            if provider == "gemini" and (api_key or settings.GEMINI_API_KEY):
                import google.generativeai as genai
                genai.configure(api_key=api_key or settings.GEMINI_API_KEY)
                # Call Gemini embedding API
                response = genai.embed_content(
                    model="models/text-embedding-004",
                    content=text,
                    task_type="retrieval_document"
                )
                return response['embedding']
                
            elif provider == "openai" and (api_key or settings.OPENAI_API_KEY):
                from openai import OpenAI
                client = OpenAI(api_key=api_key or settings.OPENAI_API_KEY)
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                return response.data[0].embedding
        except Exception:
            pass

        # Local simple pseudo-embedding (returns a dummy array for db structure compatibility)
        # We will rely on the TF-IDF search fallback if vector similarities fail
        return [0.0] * 10
