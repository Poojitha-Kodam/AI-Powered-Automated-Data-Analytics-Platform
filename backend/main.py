import json
from fastapi import FastAPI, Depends, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from config import settings
from database import init_db, get_db, Project, Dataset, Dashboard, Report, User
from routes import data, chat, ml


print("Gemini:", settings.GEMINI_API_KEY[:10])
print("OpenAI:", settings.OPENAI_API_KEY[:10])

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

# Setup CORS to allow React frontend (running locally on port 5173 or elsewhere)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database schemas
init_db()

# Mount API routes
app.include_router(data.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(ml.router, prefix=settings.API_V1_STR)

# --- Direct Project Management Endpoints ---

@app.post(settings.API_V1_STR + "/projects")
def create_project(name: str = Form(...), db: Session = Depends(get_db)):
    # Simple user lookup or registration (use default user id = 1 for local workspace)
    default_user = db.query(User).filter(User.username == "admin").first()
    if not default_user:
        default_user = User(username="admin", email="admin@example.com", hashed_password="mocked_password")
        db.add(default_user)
        db.commit()
        db.refresh(default_user)

    proj = Project(name=name, user_id=default_user.id)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return {"id": proj.id, "name": proj.name, "created_at": proj.created_at.isoformat()}

@app.get(settings.API_V1_STR + "/projects")
def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    result = []
    for p in projects:
        # Check active dataset
        dataset = db.query(Dataset).filter(Dataset.project_id == p.id).first()
        result.append({
            "id": p.id,
            "name": p.name,
            "created_at": p.created_at.isoformat(),
            "dataset": {
                "id": dataset.id,
                "name": dataset.name,
                "rows": dataset.rows_count,
                "columns": dataset.cols_count
            } if dataset else None
        })
    return result

@app.delete(settings.API_V1_STR + "/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete associated physical dataset files if any
    for ds in proj.datasets:
        filepath = os.path.join(settings.UPLOAD_DIR, ds.filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
                
    db.delete(proj)
    db.commit()
    return {"success": True, "message": "Project and associated assets deleted successfully."}

# --- Dashboard Builder Endpoints ---

@app.post(settings.API_V1_STR + "/projects/{project_id}/dashboard")
def save_dashboard(project_id: int, name: str = Form(...), layout: str = Form(...), db: Session = Depends(get_db)):
    """
    Save or update a project dashboard layout config.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    dash = db.query(Dashboard).filter(Dashboard.project_id == project_id).first()
    if dash:
        dash.name = name
        dash.layout = layout
    else:
        dash = Dashboard(project_id=project_id, name=name, layout=layout)
        db.add(dash)
        
    db.commit()
    db.refresh(dash)
    return {"id": dash.id, "name": dash.name, "layout": json.loads(dash.layout)}

@app.get(settings.API_V1_STR + "/projects/{project_id}/dashboard")
def get_dashboard(project_id: int, db: Session = Depends(get_db)):
    dash = db.query(Dashboard).filter(Dashboard.project_id == project_id).first()
    if not dash:
        return {"layout": []}
    return {
        "id": dash.id,
        "name": dash.name,
        "layout": json.loads(dash.layout)
    }

# --- Root Check ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "AI-Powered Automated Data Analytics Platform Backend API Online."
    }

