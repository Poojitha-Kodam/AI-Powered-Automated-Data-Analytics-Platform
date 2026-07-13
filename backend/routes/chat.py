import os
import json
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from backend.database import get_db, ChatMessage, Project, Dataset
from backend.agents.planner import PlannerAgent
from backend.agents.rag_agent import RAGAgent
from backend.config import settings
import pandas as pd

router = APIRouter(prefix="/chat", tags=["chat"])
planner = PlannerAgent()
rag = RAGAgent()

@router.post("/send")
def send_message(
    project_id: int = Form(...),
    message: str = Form(...),
    api_key: str = Form(None),
    provider: str = Form("gemini"),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Save User message
    user_msg = ChatMessage(
        project_id=project_id,
        role="user",
        content=message
    )
    db.add(user_msg)
    db.commit()

    # Load project active dataset if any
    dataset = db.query(Dataset).filter(Dataset.project_id == project_id).first()
    df = None
    if dataset:
        filepath = os.path.join(settings.UPLOAD_DIR, dataset.filename)
        if os.path.exists(filepath):
            try:
                # Import load function helper from data router
                from backend.routes.data import load_file_to_df
                df = load_file_to_df(filepath, dataset.name)
            except Exception:
                pass

    # Run Multi-Agent execution
    agent_result = planner.route_and_execute(
        query=message,
        df=df,
        db_session=db,
        api_key=api_key or "",
        provider=provider
    )

    # Save Assistant message
    assistant_msg = ChatMessage(
        project_id=project_id,
        role="assistant",
        content=agent_result.get("response_text", ""),
        plotly_json=json.dumps(agent_result.get("plotly_json")) if agent_result.get("plotly_json") else None,
        recommendations=json.dumps(agent_result.get("recommendations")) if agent_result.get("recommendations") else None
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    # Compile result body
    return {
        "id": assistant_msg.id,
        "role": "assistant",
        "content": assistant_msg.content,
        "plotly_json": agent_result.get("plotly_json"),
        "recommendations": agent_result.get("recommendations"),
        "intent": agent_result.get("intent"),
        "reason": agent_result.get("reason"),
        "sql_data": agent_result.get("sql_data"),
        "profile_data": agent_result.get("profile_data"),
        "ml_data": agent_result.get("ml_data"),
        "forecast_data": agent_result.get("forecast_data"),
        "rag_data": agent_result.get("rag_data"),
        "report_file": agent_result.get("report_file")
    }

@router.get("/history/{project_id}")
def get_chat_history(project_id: int, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.project_id == project_id).order_by(ChatMessage.created_at.asc()).all()
    
    result = []
    for msg in messages:
        rec_data = None
        if msg.recommendations:
            try:
                rec_data = json.loads(msg.recommendations)
            except Exception:
                pass
                
        plot_data = None
        if msg.plotly_json:
            try:
                plot_data = json.loads(msg.plotly_json)
            except Exception:
                pass

        result.append({
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "plotly_json": plot_data,
            "recommendations": rec_data,
            "created_at": msg.created_at.isoformat()
        })
    return result

@router.post("/upload-doc")
async def upload_rag_document(
    doc_file: UploadFile = File(...),
    api_key: str = Form(None),
    provider: str = Form("gemini"),
    db: Session = Depends(get_db)
):
    try:
        content = await doc_file.read()
        text_content = content.decode("utf-8", errors="ignore")
        
        chunks_added = rag.add_document(
            db=db,
            doc_name=doc_file.filename,
            text=text_content,
            api_key=api_key or "",
            provider=provider
        )
        return {
            "success": True,
            "filename": doc_file.filename,
            "chunks_added": chunks_added,
            "message": f"Processed reference document. Generated {chunks_added} searchable chunks."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process business document: {str(e)}")
