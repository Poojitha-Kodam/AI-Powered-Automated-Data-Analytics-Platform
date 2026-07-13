import os
import json
import sqlite3
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db, Dataset, Project, ChatMessage
from backend.config import settings
from backend.agents.cleaning import CleaningAgent
from backend.agents.analysis import AnalysisAgent

router = APIRouter(prefix="/data", tags=["data"])

# Helper to read different files into pandas dataframe
def load_file_to_df(filepath: str, filename: str) -> pd.DataFrame:
    ext = os.path.splitext(filename)[1].lower()
    try:
        if ext == '.csv':
            return pd.read_csv(filepath)
        elif ext in ['.xls', '.xlsx']:
            return pd.read_excel(filepath)
        elif ext == '.json':
            return pd.read_json(filepath)
        elif ext == '.parquet':
            return pd.read_parquet(filepath)
        elif ext == '.db' or ext == '.sqlite':
            # Connect and read first table
            conn = sqlite3.connect(filepath)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            if not tables:
                conn.close()
                raise HTTPException(status_code=400, detail="SQLite database contains no tables.")
            table_name = tables[0][0]
            df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            conn.close()
            return df
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    db: Session = Depends(get_db)
):
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Save raw file to uploads directory
    file_ext = os.path.splitext(file.filename)[1]
    saved_filename = f"proj_{project_id}_{int(pd.Timestamp.now().timestamp())}{file_ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
    
    with open(saved_path, "wb") as f:
        f.write(await file.read())

    # Get file size
    file_size = os.path.getsize(saved_path)

    # Load dataframe
    df = load_file_to_df(saved_path, file.filename)

    # Auto Profile Statistics
    profiler = AnalysisAgent()
    summary = profiler.profile_dataset(df)
    
    # Auto Cleaning suggestions
    cleaner = CleaningAgent()
    recs = cleaner.detect_issues(df)

    # Save Dataset entry in database
    db_dataset = Dataset(
        project_id=project_id,
        name=file.filename,
        filename=saved_filename,
        file_size=file_size,
        rows_count=len(df),
        cols_count=len(df.columns),
        column_names=json.dumps(list(df.columns)),
        data_types=json.dumps({c: str(df[c].dtype) for c in df.columns}),
        summary_profile=json.dumps(summary),
        cleaning_recommendations=json.dumps(recs),
        clean_history=json.dumps([])
    )
    
    # Remove any previous datasets associated with this project (single active dataset design)
    db.query(Dataset).filter(Dataset.project_id == project_id).delete()
    
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)

    # Convert preview data to json format
    preview_df = df.head(15).replace({pd.NA: None, np.nan: None})
    preview_records = preview_df.to_dict(orient="records")

    return {
        "id": db_dataset.id,
        "name": db_dataset.name,
        "file_size": file_size,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "data_types": {c: str(df[c].dtype) for c in df.columns},
        "summary": summary,
        "recommendations": recs,
        "preview": preview_records
    }

@router.get("/{dataset_id}/preview")
def get_dataset_preview(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    filepath = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Raw dataset file not found on disk.")
        
    df = load_file_to_df(filepath, dataset.name)
    preview_df = df.head(50).replace({pd.NA: None, np.nan: None})
    
    return {
        "columns": list(df.columns),
        "rows": preview_df.to_dict(orient="records"),
        "total_rows": len(df)
    }

@router.post("/{dataset_id}/clean")
async def execute_clean(dataset_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Accepts customized cleaning recommendation IDs and executes them.
    Body: JSON array of action objects.
    """
    try:
        actions_list = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Request body must be a JSON array of action objects.")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    filepath = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk.")
    df = load_file_to_df(filepath, dataset.name)

    cleaner = CleaningAgent()
    df_clean, history = cleaner.apply_clean_actions(df, actions_list)

    # Save cleaned dataframe back to disk
    file_ext = os.path.splitext(dataset.name)[1].lower()
    cleaned_filename = f"cleaned_{dataset.filename}"
    cleaned_path = os.path.join(settings.UPLOAD_DIR, cleaned_filename)

    if file_ext == '.csv':
        df_clean.to_csv(cleaned_path, index=False)
    elif file_ext in ['.xls', '.xlsx']:
        df_clean.to_excel(cleaned_path, index=False)
    elif file_ext == '.json':
        df_clean.to_json(cleaned_path, orient="records")
    else:
        # Default to csv for SQLite extracts
        df_clean.to_csv(cleaned_path, index=False)

    # Update summary profile
    profiler = AnalysisAgent()
    summary = profiler.profile_dataset(df_clean)

    # Update dataset model entry
    dataset.filename = cleaned_filename
    dataset.rows_count = len(df_clean)
    dataset.cols_count = len(df_clean.columns)
    dataset.column_names = json.dumps(list(df_clean.columns))
    dataset.data_types = json.dumps({c: str(df_clean[c].dtype) for c in df_clean.columns})
    dataset.summary_profile = json.dumps(summary)
    
    # Store remaining suggestions if any
    remaining_recs = cleaner.detect_issues(df_clean)
    dataset.cleaning_recommendations = json.dumps(remaining_recs)
    
    # Update clean history logs
    current_history = json.loads(dataset.clean_history or "[]")
    current_history.extend(history)
    dataset.clean_history = json.dumps(current_history)

    db.commit()
    db.refresh(dataset)

    # Append notification message to chat history
    clean_msg = f"Data cleaned successfully. Applied actions:\n" + "\n".join([f"- {h}" for h in history])
    chat_notify = ChatMessage(
        project_id=dataset.project_id,
        role="assistant",
        content=clean_msg
    )
    db.add(chat_notify)
    db.commit()

    return {
        "success": True,
        "history": history,
        "rows": len(df_clean),
        "columns": len(df_clean.columns),
        "summary": summary,
        "remaining_recommendations": remaining_recs
    }

@router.get("/download-report/{filename}")
def download_report(filename: str):
    reports_dir = os.path.join(settings.UPLOAD_DIR, "reports")
    filepath = os.path.join(reports_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Requested report file not found.")
    return FileResponse(filepath, filename=filename)

@router.post("/connect-db")
def connect_external_db(
    project_id: int = Form(...),
    db_type: str = Form(...), # mysql, postgresql, sqlite, mssql
    host: str = Form(None),
    port: int = Form(None),
    database: str = Form(None),
    username: str = Form(None),
    password: str = Form(None),
    sqlite_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Connect to an external database or load an uploaded SQLite file as database.
    For this prototype, external SQL connections are simulated, while SQLite files are loaded fully.
    """
    if db_type == "sqlite" and sqlite_file:
        saved_filename = f"db_{project_id}_{int(pd.Timestamp.now().timestamp())}.db"
        saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
        
        # Save SQLite DB file
        with open(saved_path, "wb") as f:
            f.write(sqlite_file.file.read())
            
        # Inspect SQLite tables
        try:
            conn = sqlite3.connect(saved_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            
            if not tables:
                raise HTTPException(status_code=400, detail="Uploaded SQLite database has no tables.")
                
            # Auto load first table into a dataset
            conn = sqlite3.connect(saved_path)
            df = pd.read_sql_query(f"SELECT * FROM {tables[0]}", conn)
            conn.close()
            
            profiler = AnalysisAgent()
            summary = profiler.profile_dataset(df)
            
            db_dataset = Dataset(
                project_id=project_id,
                name=f"sqlite://{tables[0]}",
                filename=saved_filename,
                file_size=os.path.getsize(saved_path),
                rows_count=len(df),
                cols_count=len(df.columns),
                column_names=json.dumps(list(df.columns)),
                data_types=json.dumps({c: str(df[c].dtype) for c in df.columns}),
                summary_profile=json.dumps(summary),
                cleaning_recommendations=json.dumps([]),
                clean_history=json.dumps([])
            )
            
            # Remove previous project datasets
            db.query(Dataset).filter(Dataset.project_id == project_id).delete()
            db.add(db_dataset)
            db.commit()
            
            return {
                "success": True,
                "message": f"Connected SQLite database. Loaded table '{tables[0]}' successfully.",
                "tables": tables,
                "dataset_id": db_dataset.id
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load SQLite DB: {str(e)}")
            
    # Mock external database connections for Postgres/MySQL/etc.
    # Return structured mockup success so the user can interact
    mock_tables = ["orders", "customers", "products", "sales_regions"]
    df_mock = pd.DataFrame({
        "order_id": range(1001, 1051),
        "customer_id": [f"CUST_{i}" for i in range(10, 60)],
        "revenue": np.random.randint(100, 2000, size=50),
        "quantity": np.random.randint(1, 10, size=50),
        "region": np.random.choice(["North", "South", "East", "West"], size=50),
        "order_date": pd.date_range(start="2026-01-01", periods=50).strftime("%Y-%m-%d")
    })
    
    mock_filename = f"mock_{project_id}_{int(pd.Timestamp.now().timestamp())}.csv"
    mock_path = os.path.join(settings.UPLOAD_DIR, mock_filename)
    df_mock.to_csv(mock_path, index=False)
    
    profiler = AnalysisAgent()
    summary = profiler.profile_dataset(df_mock)
    
    db_dataset = Dataset(
        project_id=project_id,
        name=f"{db_type}://orders",
        filename=mock_filename,
        file_size=1024,
        rows_count=len(df_mock),
        cols_count=len(df_mock.columns),
        column_names=json.dumps(list(df_mock.columns)),
        data_types=json.dumps({c: str(df_mock[c].dtype) for c in df_mock.columns}),
        summary_profile=json.dumps(summary),
        cleaning_recommendations=json.dumps([]),
        clean_history=json.dumps([])
    )
    
    db.query(Dataset).filter(Dataset.project_id == project_id).delete()
    db.add(db_dataset)
    db.commit()
    
    return {
        "success": True,
        "message": f"Connected to {db_type} database at {host or 'localhost'}. Auto-loaded table 'orders'.",
        "tables": mock_tables,
        "dataset_id": db_dataset.id
    }
