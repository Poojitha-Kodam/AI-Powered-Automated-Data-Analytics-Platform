import re
import json
import os
import pandas as pd
import numpy as np
from backend.config import settings
from backend.agents.cleaning import CleaningAgent
from backend.agents.analysis import AnalysisAgent
from backend.agents.visualization import VisualizationAgent
from backend.agents.sql_agent import SQLAgent
from backend.agents.forecast import ForecastAgent
from backend.agents.insight import InsightAgent
from backend.agents.rag_agent import RAGAgent

class PlannerAgent:
    def __init__(self):
        self.clean_agent = CleaningAgent()
        self.analysis_agent = AnalysisAgent()
        self.viz_agent = VisualizationAgent()
        self.sql_agent = SQLAgent()
        self.forecast_agent = ForecastAgent()
        self.insight_agent = InsightAgent()
        self.rag_agent = RAGAgent()

    def route_and_execute(self, query: str, df: pd.DataFrame = None, db_session = None, api_key: str = "", provider: str = "gemini") -> dict:
        """
        Analyze the user's intent, route to the correct agent, run the tool, and return structured results.
        """
        q = query.lower()
        
        # 1. Determine Intent
        intent = "general_chat"
        reason = ""
        
        # Simple rule-based router (highly accurate for specific commands)
        if any(w in q for w in ["clean", "null", "missing", "duplicate", "fix", "outlier", "spaces"]):
            intent = "clean"
            reason = "Query mentions data problems like missing values or duplicates."
        elif any(w in q for w in ["profile", "summary", "statistics", "describe", "skewness", "kurtosis"]):
            intent = "profile"
            reason = "Query asks for data profile, columns description or statistics."
        elif any(w in q for w in ["predict", "forecast", "future", "arima", "time series", "trend"]):
            intent = "forecast"
            reason = "Query asks for trend forecasts or future modeling."
        elif any(w in q for w in ["classify", "regress", "model", "cluster", "segment", "anomaly", "train"]):
            intent = "ml"
            reason = "Query asks for machine learning tasks like training models, clustering, or anomalies."
        elif any(w in q for w in ["plot", "chart", "graph", "visualize", "show a line", "show a bar", "pie"]):
            intent = "visualize"
            reason = "Query explicitly asks to generate a visual representation."
        elif any(w in q for w in ["sql", "select", "query", "database", "where", "group by"]):
            intent = "sql"
            reason = "Query indicates SQL query generation or execution."
        elif any(w in q for w in ["define", "policy", "dictionary", "catalog", "manual", "glossary", "what does"]):
            intent = "rag"
            reason = "Query asks for definitions, guidelines, or business document lookup."
        elif any(w in q for w in ["report", "export", "pdf", "docx", "presentation", "pptx"]):
            intent = "report"
            reason = "Query asks to construct or export document reports."

        # If LLM is available, we can let the LLM check/override this classification
        if (api_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY):
            try:
                llm_intent = self._classify_intent_via_llm(query, api_key, provider)
                if llm_intent in ["clean", "profile", "forecast", "ml", "visualize", "sql", "rag", "report", "general_chat"]:
                    intent = llm_intent
                    reason = f"Routed by LLM coordinator ({provider})."
            except Exception:
                pass # fall back to rule-based routing

        # 2. Execute routed action
        result = {"intent": intent, "reason": reason, "response_text": "", "plotly_json": None}

        if df is None and intent not in ["rag", "general_chat"]:
            result["response_text"] = "Please upload a dataset or connect a database first before performing data actions."
            return result

        try:
            if intent == "clean":
                recs = self.clean_agent.detect_issues(df)
                result["response_text"] = f"I scanned the dataset and found {len(recs)} potential cleaning operations. You can accept, reject, or customize them in the cleaning tab."
                result["recommendations"] = recs
                
            elif intent == "profile":
                profile = self.analysis_agent.profile_dataset(df)
                result["response_text"] = f"Here is the statistical profile summary of the dataset. It contains {profile['rows']} rows and {profile['columns']} columns."
                result["profile_data"] = profile
                
            elif intent == "forecast":
                # Find date column and numeric column
                date_cols = df.select_dtypes(include=['datetime', 'datetime64']).columns.tolist()
                if not date_cols:
                    # check for string cols containing 'date'
                    date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
                
                numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                
                if not date_cols:
                    result["response_text"] = "I couldn't identify a valid date/time column in the dataset to perform time series forecasting."
                elif not numeric_cols:
                    result["response_text"] = "I couldn't find any numerical columns in the dataset to forecast."
                else:
                    date_col = date_cols[0]
                    value_col = numeric_cols[0]
                    # If query specifies a columns, try to extract them
                    for c in df.columns:
                        if c.lower() in q and c != date_col:
                            if pd.api.types.is_numeric_dtype(df[c]):
                                value_col = c
                        if c.lower() in q and ('date' in c.lower() or 'time' in c.lower()):
                            date_col = c
                            
                    forecast_res = self.forecast_agent.forecast_values(df, date_col, value_col, periods=12)
                    if "error" in forecast_res:
                        result["response_text"] = forecast_res["error"]
                    else:
                        result["response_text"] = f"Generated forecasting for '{value_col}' using date column '{date_col}':\n\n{forecast_res['recommendation']}"
                        result["forecast_data"] = forecast_res
                        
                        # Generate forecasting Plotly config
                        # We build an interactive Plotly structure with historical lines, forecast lines, and confidence fills
                        hist_len = forecast_res["history_len"]
                        all_dates = forecast_res["dates"]
                        hist_vals = forecast_res["history_values"]
                        fore_vals = forecast_res["forecast_values"]
                        lower_vals = forecast_res["lower_bound"]
                        upper_vals = forecast_res["upper_bound"]
                        
                        plotly_data = [
                            # Historical
                            {
                                "x": all_dates[:hist_len],
                                "y": hist_vals,
                                "type": "scatter",
                                "mode": "lines",
                                "name": "Historical",
                                "line": {"color": "#10b981"}
                            },
                            # Forecasted
                            {
                                "x": all_dates[hist_len:],
                                "y": fore_vals,
                                "type": "scatter",
                                "mode": "lines+markers",
                                "name": "Forecasted",
                                "line": {"color": "#6366f1", "dash": "dash"}
                            },
                            # Confidence Lower
                            {
                                "x": all_dates[hist_len:],
                                "y": lower_vals,
                                "type": "scatter",
                                "mode": "lines",
                                "line": {"width": 0},
                                "showlegend": False,
                                "name": "Lower Bound"
                            },
                            # Confidence Upper (with fill)
                            {
                                "x": all_dates[hist_len:],
                                "y": upper_vals,
                                "type": "scatter",
                                "mode": "lines",
                                "fill": "tonexty",
                                "fillcolor": "rgba(99, 102, 241, 0.15)",
                                "line": {"width": 0},
                                "name": "Confidence Interval",
                                "showlegend": True
                            }
                        ]
                        result["plotly_json"] = {
                            "data": plotly_data,
                            "layout": {
                                "title": f"Forecast for {value_col}",
                                "template": "plotly_dark",
                                "xaxis": {"title": date_col},
                                "yaxis": {"title": value_col}
                            }
                        }

            elif intent == "ml":
                # Detect target and features
                numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
                
                # Check for classification
                if "cluster" in q or "segment" in q:
                    features = numeric_cols[:3] # use first 3 numeric features
                    cl_res = self.forecast_agent.run_clustering(df, features, n_clusters=3)
                    if "error" in cl_res:
                        result["response_text"] = cl_res["error"]
                    else:
                        result["response_text"] = f"Calculated K-Means clustering segmentation using features {features}. Silhouette Score: {cl_res['silhouette_score']:.3f}."
                        result["ml_data"] = cl_res
                elif "anomaly" in q or "unusual" in q:
                    features = numeric_cols[:3]
                    an_res = self.forecast_agent.run_anomaly_detection(df, features)
                    if "error" in an_res:
                        result["response_text"] = an_res["error"]
                    else:
                        result["response_text"] = f"Detected anomalies in the dataset using features {features}. Isolation Forest identified {an_res['anomaly_count']} outliers ({an_res['anomaly_percent']:.1f}% of data)."
                        result["ml_data"] = an_res
                else:
                    # Regression or Classification
                    target = df.columns[-1] # default to last column
                    # try to extract target mentioned
                    for c in df.columns:
                        if f"predict {c.lower()}" in q or f"determine {c.lower()}" in q or f"target {c.lower()}" in q:
                            target = c
                            
                    features = [c for c in df.columns if c != target][:5] # first 5 columns as features
                    
                    if target in numeric_cols:
                        # Regression
                        reg_res = self.forecast_agent.run_regression(df, target, features)
                        if "error" in reg_res:
                            result["response_text"] = reg_res["error"]
                        else:
                            result["response_text"] = f"Trained a Random Forest Regressor to predict target '{target}' using features {features}. R-squared Accuracy: {reg_res['r2']:.3f}."
                            result["ml_data"] = reg_res
                    else:
                        # Classification
                        cls_res = self.forecast_agent.run_classification(df, target, features)
                        if "error" in cls_res:
                            result["response_text"] = cls_res["error"]
                        else:
                            result["response_text"] = f"Trained a Random Forest Classifier to predict label '{target}' using features {features}. Model Accuracy: {cls_res['accuracy']*100:.1f}%."
                            result["ml_data"] = cls_res

            elif intent == "visualize":
                # Parse column names
                x_col = df.columns[0]
                y_col = None
                
                # Check for columns mentioned
                matched_cols = []
                for c in df.columns:
                    if c.lower() in q:
                        matched_cols.append(c)
                
                if len(matched_cols) == 1:
                    x_col = matched_cols[0]
                elif len(matched_cols) >= 2:
                    x_col = matched_cols[0]
                    y_col = matched_cols[1]
                    
                # Determine chart type
                chart_type = self.viz_agent.suggest_chart_type(df, x_col, y_col)
                for t in ["bar", "line", "pie", "scatter", "histogram", "box", "heatmap", "treemap", "funnel", "waterfall"]:
                    if t in q:
                        chart_type = t
                        
                plotly_config = self.viz_agent.generate_plotly_config(df, chart_type, x_col, y_col)
                result["plotly_json"] = plotly_config
                result["response_text"] = f"Here is the generated {chart_type} chart representing '{x_col}'" + (f" vs '{y_col}'" if y_col else "") + "."

            elif intent == "sql":
                # Query generation and execution
                sql = self.sql_agent.generate_sql(query, df, api_key, provider)
                res_df, exe_time, error = self.sql_agent.run_query_on_df(df, sql)
                
                if error:
                    result["response_text"] = f"Generated SQL query:\n```sql\n{sql}\n```\n\nExecution error:\n`{error}`"
                else:
                    result["response_text"] = f"Generated SQL query (executed in {exe_time:.1f}ms, returned {len(res_df)} rows):\n```sql\n{sql}\n```"
                    result["sql_data"] = {
                        "query": sql,
                        "execution_time": exe_time,
                        "columns": list(res_df.columns),
                        "rows": res_df.head(10).to_dict(orient="records")
                    }
                    
                    # Generate auto visualization for the SQL query results
                    if not res_df.empty:
                        x = res_df.columns[0]
                        y = res_df.columns[1] if len(res_df.columns) > 1 else None
                        chart_t = self.viz_agent.suggest_chart_type(res_df, x, y)
                        result["plotly_json"] = self.viz_agent.generate_plotly_config(res_df, chart_t, x, y, title="SQL Results Visualization")

            elif intent == "rag":
                if db_session is None:
                    result["response_text"] = "RAG database session not available."
                else:
                    context = self.rag_agent.retrieve_context(db_session, query, api_key=api_key, provider=provider)
                    if not context:
                        result["response_text"] = "I searched the business documentation but couldn't find any relevant guides or glossary entries."
                    else:
                        ans = "\n\n".join([f"From doc: *{item['doc']}* (relevance: {item['score']:.2f}):\n{item['chunk']}" for item in context])
                        result["response_text"] = f"Here is what I found in the reference documents:\n\n{ans}"
                        result["rag_data"] = context

            elif intent == "report":
                # Create a temporary path
                reports_dir = os.path.join(settings.UPLOAD_DIR, "reports")
                os.makedirs(reports_dir, exist_ok=True)
                
                pdf_path = os.path.join(reports_dir, "analytics_report.pdf")
                
                # Gather pieces
                summary = "This dataset contains information that was automatically analyzed by our AI-Powered Analytics Platform."
                cols = list(df.columns)
                clean_hist = []
                insights = self.insight_agent.generate_insights(df, api_key, provider)
                
                # Check for forecast
                forecast_res = None
                date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
                num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                if date_cols and num_cols:
                    forecast_res = self.forecast_agent.forecast_values(df, date_cols[0], num_cols[0])

                from backend.agents.report import ReportAgent
                rep_generator = ReportAgent()
                rep_generator.generate_pdf_report(pdf_path, "Executive Business Report", summary, cols, clean_hist, insights, forecast_res)
                
                result["response_text"] = "I have compiled the executive summary, cleaning logs, insights, and forecast predictions into a PDF report."
                result["report_file"] = "/api/v1/data/download-report/analytics_report.pdf"

            else:
                # General Chat
                # If LLM API available, prompt it with general user query, else simple fallback
                if (api_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY):
                    try:
                        result["response_text"] = self._run_general_chat_via_llm(query, df, api_key, provider)
                    except Exception as e:
                        result["response_text"] = f"Hello! I am your AI Data Analyst. Ask me to clean your dataset, generate a profile summary, run a SQL query, display a custom chart, segment your data, or build a report. (LLM chat error: {str(e)})"
                else:
                    result["response_text"] = "Hello! I am your AI Data Analyst. Currently running in local mode. Upload a dataset (CSV, Excel, JSON, SQLite) and I can help you clean it, profile statistics, visualize trends, run forecasting models, or answer database queries!"

        except Exception as e:
            result["response_text"] = f"An error occurred while executing the {intent} agent: {str(e)}"

        return result

    def _classify_intent_via_llm(self, query: str, api_key: str, provider: str) -> str:
        prompt = f"""
You are the central coordinator for an AI Data Analytics platform. Your job is to classify the user's intent into one of these specific actions:
- 'clean': User wants to clean data, remove duplicates, handle missing values, cap outliers, format strings, correct datatypes.
- 'profile': User wants a general statistical summary, schema overview, column listings, mean, median, skewness, variance, data distribution profile.
- 'forecast': User wants to project future trends, run time series forecasting, predict sales/inventory/revenue over future periods.
- 'ml': User wants to train machine learning models (classification, regression, clustering, anomaly detection).
- 'visualize': User wants to create a chart, line plot, bar graph, scatter plot, pie, heatmap.
- 'sql': User wants to query the database, run SQL queries, filter/aggregate data using database language.
- 'rag': User wants to look up definitions of KPIs, company business guidelines, product catalogs from uploaded documents.
- 'report': User wants to generate, export, or download a PDF, Word document, or PowerPoint presentation report.
- 'general_chat': General greeting, greeting the assistant, talking about how the system works.

User Query: "{query}"

Respond with ONLY the string name of the class (e.g. clean, profile, forecast, ml, visualize, sql, rag, report, general_chat). Do not add punctuation, formatting or markdown.
"""
        if provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key or settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-3.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip().lower()
        elif provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=api_key or settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0.0
            )
            return response.choices[0].message.content.strip().lower()
        return "general_chat"

    def _run_general_chat_via_llm(self, query: str, df: pd.DataFrame, api_key: str, provider: str) -> str:
        # Prompt including small sample of dataframe metadata to enable data-aware answers
        df_summary = "No dataset loaded."
        if df is not None:
            df_summary = f"Loaded dataset columns: {list(df.columns)}, rows count: {len(df)}, columns count: {len(df.columns)}"
            
        prompt = f"""
You are an intelligent AI Data Analyst assistant inside the AI-Powered Automated Data Analytics Platform.
You are talking to a user about their data.

Current Dataset status: {df_summary}

User Question: "{query}"

Answer the user in a helpful, conversational, professional tone. If they are asking about how to perform actions (like cleaning, forecasting, visualizing), explain how they can do it on the platform, and offer to help. Keep your response concise.
"""
        if provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key or settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-3.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip()
        elif provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=api_key or settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            return response.choices[0].message.content.strip()
        return ""


