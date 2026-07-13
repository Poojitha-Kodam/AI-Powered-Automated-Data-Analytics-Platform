import sqlite3
import pandas as pd
import time
import re
import json
from backend.config import settings

class SQLAgent:
    def __init__(self):
        pass

    def run_query_on_df(self, df: pd.DataFrame, sql_query: str) -> tuple[pd.DataFrame, float, str]:
        """
        Loads the dataframe into a temporary in-memory SQLite database, runs the query,
        and returns the result DataFrame, execution time, and any error message.
        """
        conn = sqlite3.connect(":memory:")
        # Save dataframe to sqlite
        # Convert objects to string or appropriate types to prevent serialization issues
        df_sqlite = df.copy()
        for col in df_sqlite.columns:
            if df_sqlite[col].dtype == object or isinstance(df_sqlite[col].dtype, pd.CategoricalDtype):
                df_sqlite[col] = df_sqlite[col].astype(str)
                
        df_sqlite.to_sql("dataset", conn, index=False, if_exists="replace")
        
        start_time = time.time()
        error = ""
        result_df = pd.DataFrame()
        
        try:
            # Clean up SQL query: make sure it references the 'dataset' table
            # Some LLMs write queries using the original filename or uppercase DATASET
            sql_clean = re.sub(r'\bfrom\s+[a-zA-Z0-9_\.\"]+\b', 'FROM dataset', sql_query, flags=re.IGNORECASE)
            # If query doesn't contain FROM dataset, fallback to replacing table names
            if 'FROM dataset' not in sql_clean.upper():
                sql_clean = sql_query # use original
            
            result_df = pd.read_sql_query(sql_clean, conn)
        except Exception as e:
            error = str(e)
        finally:
            conn.close()
            
        execution_time = (time.time() - start_time) * 1000 # in ms
        return result_df, execution_time, error

    def generate_sql(self, user_question: str, df: pd.DataFrame, api_key: str = "", provider: str = "gemini") -> str:
        """
        Use an LLM (Gemini or OpenAI) to generate SQL based on the schema of the dataframe.
        """
        # Get Schema
        schema_info = []
        for col in df.columns:
            schema_info.append(f"{col} ({df[col].dtype})")
        schema_str = ", ".join(schema_info)
        
        # Sample rows for context
        sample_data = df.head(3).to_dict(orient='records')
        
        prompt = f"""
You are a SQL expert that generates SQLite-compatible SQL queries.
The table name is 'dataset'. Do not use any other table name.

Columns and Types: {schema_str}
Sample Data: {json.dumps(sample_data, default=str)}

User Question: "{user_question}"

Return ONLY the raw SQL query. Do not wrap it in markdown code blocks, do not include explanations, and do not include backticks. Just return the SQL statement.
"""

        # Choose Provider
        try:
            if provider == "gemini" and (api_key or settings.GEMINI_API_KEY):
                import google.generativeai as genai
                genai.configure(api_key=api_key or settings.GEMINI_API_KEY)
                model = genai.GenerativeModel("gemini-3.5-flash")
                response = model.generate_content(prompt)
                sql = response.text.strip()
            elif provider == "openai" and (api_key or settings.OPENAI_API_KEY):
                from openai import OpenAI
                client = OpenAI(api_key=api_key or settings.OPENAI_API_KEY)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=250,
                    temperature=0.0
                )
                sql = response.choices[0].message.content.strip()
            else:
                # Rule-based fallback or mock for common queries
                sql = self._fallback_sql_generation(user_question, df)
                
            # Clean markdown code blocks if any
            sql = sql.replace("```sql", "").replace("```", "").strip()
            return sql
        except Exception as e:
            return f"-- Error generating SQL via LLM: {str(e)}\n" + self._fallback_sql_generation(user_question, df)

    def _fallback_sql_generation(self, user_question: str, df: pd.DataFrame) -> str:
        """
        Simple keyword-based SQL query generator as a fallback.
        """
        cols = [c.lower() for c in df.columns]
        q = user_question.lower()
        
        # Default select
        select_cols = "*"
        limit = "LIMIT 20"
        order_by = ""
        
        # Look for limit numbers
        limit_match = re.search(r'\b(top|first|limit)\s+(\d+)\b', q)
        if limit_match:
            limit = f"LIMIT {limit_match.group(2)}"
        elif "top" in q:
            limit = "LIMIT 10"

        # Search for columns mentioned
        matched_cols = []
        for c in df.columns:
            if c.lower() in q:
                matched_cols.append(f'"{c}"')
                
        if matched_cols:
            select_cols = ", ".join(matched_cols)

        # Try to identify sorting
        numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        if "highest" in q or "top" in q or "best" in q or "most" in q:
            if numeric_cols:
                order_by = f'ORDER BY "{numeric_cols[0]}" DESC'
        elif "lowest" in q or "worst" in q or "least" in q:
            if numeric_cols:
                order_by = f'ORDER BY "{numeric_cols[0]}" ASC'

        query = f'SELECT {select_cols} FROM dataset {order_by} {limit};'
        return query
