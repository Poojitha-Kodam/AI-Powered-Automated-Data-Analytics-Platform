import os
import json
from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, Dataset
from backend.agents.forecast import ForecastAgent
from backend.config import settings

router = APIRouter(prefix="/ml", tags=["ml"])
ml_agent = ForecastAgent()

@router.post("/train-model")
def train_model(
    dataset_id: int = Form(...),
    task_type: str = Form(...), # regression, classification, clustering, anomaly
    target_col: str = Form(None),
    features: str = Form(...), # JSON-encoded list of strings
    n_clusters: int = Form(3),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    filepath = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Raw dataset file not found on disk.")

    from backend.routes.data import load_file_to_df
    df = load_file_to_df(filepath, dataset.name)

    try:
        feature_list = json.loads(features)
    except Exception:
        raise HTTPException(status_code=400, detail="Features parameter must be a JSON-encoded array of column strings.")

    # Validate features exist
    for f in feature_list:
        if f not in df.columns:
            raise HTTPException(status_code=400, detail=f"Feature column '{f}' not found in dataset.")

    if task_type == "regression":
        if not target_col or target_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found in dataset.")
        res = ml_agent.run_regression(df, target_col, feature_list)
        
    elif task_type == "classification":
        if not target_col or target_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found in dataset.")
        res = ml_agent.run_classification(df, target_col, feature_list)
        
    elif task_type == "clustering":
        res = ml_agent.run_clustering(df, feature_list, n_clusters)
        
    elif task_type == "anomaly":
        res = ml_agent.run_anomaly_detection(df, feature_list)
        
    else:
        raise HTTPException(status_code=400, detail=f"Invalid task type: {task_type}")

    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
        
    return res

@router.post("/forecast")
def forecast_trends(
    dataset_id: int = Form(...),
    date_col: str = Form(...),
    value_col: str = Form(...),
    periods: int = Form(12),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    filepath = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Dataset file not found.")

    from backend.routes.data import load_file_to_df
    df = load_file_to_df(filepath, dataset.name)

    if date_col not in df.columns or value_col not in df.columns:
        raise HTTPException(status_code=400, detail="Specified date or value column not found in dataset.")

    res = ml_agent.forecast_values(df, date_col, value_col, periods)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
        
    return res
