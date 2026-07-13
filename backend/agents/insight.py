import pandas as pd
import numpy as np
from backend.config import settings

class InsightAgent:
    def __init__(self):
        pass

    def generate_insights(self, df: pd.DataFrame, api_key: str = "", provider: str = "gemini") -> list[str]:
        """
        Generate executive insights summarizing key patterns, correlations, or anomalies in the dataset.
        """
        insights = []
        
        # Rule-based generation (always run to provide a baseline or fallback)
        rule_insights = self._generate_rule_based_insights(df)
        
        # If API key is available, use the LLM to refine and expand these insights
        if (api_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY):
            try:
                # Compile dataset summary for prompt
                rows, cols = df.shape
                col_info = []
                for c in df.columns[:10]: # first 10 columns
                    unique_c = df[c].nunique()
                    dtype = str(df[c].dtype)
                    col_info.append(f"{c} ({dtype}, {unique_c} unique)")
                
                # Summary statistics for numeric
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                num_summary = ""
                if not numeric_cols.empty:
                    num_summary = df[numeric_cols].describe().to_string()

                # Categorical summaries
                cat_summary = ""
                cat_cols = df.select_dtypes(exclude=[np.number]).columns
                if not cat_cols.empty:
                    cat_summary_parts = []
                    for c in cat_cols[:3]:
                        cat_summary_parts.append(f"Top values for {c}:\n{df[c].value_counts().head(3).to_string()}")
                    cat_summary = "\n\n".join(cat_summary_parts)

                prompt = f"""
You are an expert Data Analyst and business strategist. Review this dataset summary and write 4 to 6 high-level executive insights.
Each insight should explain a clear business takeaway, highlight interesting ratios, identify correlation trends, or warn of potential concerns.

Dataset Dimensions: {rows} rows, {cols} columns.
Columns: {', '.join(col_info)}

Numerical Summary:
{num_summary}

Categorical Summary:
{cat_summary}

Baseline Rule-Based Insights (you can expand on these):
{chr(10).join(['- ' + r for r in rule_insights])}

Provide the insights as a list of bullet points. Avoid preamble or general comments. Make each insight actionable, professional, and specific.
"""

                if provider == "gemini" and (api_key or settings.GEMINI_API_KEY):
                    import google.generativeai as genai
                    genai.configure(api_key=api_key or settings.GEMINI_API_KEY)
                    model = genai.GenerativeModel("gemini-3.5-flash")
                    response = model.generate_content(prompt)
                    insights_text = response.text.strip()
                    llm_insights = [line.lstrip('- ').strip() for line in insights_text.split('\n') if line.strip()]
                    if len(llm_insights) >= 2:
                        return llm_insights
                elif provider == "openai" and (api_key or settings.OPENAI_API_KEY):
                    from openai import OpenAI
                    client = OpenAI(api_key=api_key or settings.OPENAI_API_KEY)
                    response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.7
                    )
                    insights_text = response.choices[0].message.content.strip()
                    llm_insights = [line.lstrip('- ').strip() for line in insights_text.split('\n') if line.strip()]
                    if len(llm_insights) >= 2:
                        return llm_insights
            except Exception as e:
                # LLM failed, append warning and proceed with rule insights
                rule_insights.append(f"Note: Deep AI insights generation bypassed ({str(e)}). Showing rule-based results.")
                
        return rule_insights

    def _generate_rule_based_insights(self, df: pd.DataFrame) -> list[str]:
        insights = []
        rows, cols = df.shape
        
        insights.append(f"The dataset consists of {rows} records and {cols} variables.")
        
        # 1. Check Missing Values ratio
        total_missing = df.isnull().sum().sum()
        total_cells = df.size
        if total_missing > 0 and total_cells > 0:
            pct_missing = (total_missing / total_cells) * 100
            if pct_missing > 5:
                insights.append(f"Warning: {pct_missing:.1f}% of data points are missing across the dataset. Automated data cleaning/imputation is recommended.")
            else:
                insights.append(f"Data quality is high with minimal missing values ({pct_missing:.1f}% of cells are empty).")

        # 2. Key categorical concentrations
        cat_cols = df.select_dtypes(exclude=[np.number]).columns
        for c in cat_cols[:2]:
            counts = df[c].value_counts()
            if not counts.empty:
                top_val = counts.index[0]
                top_pct = (counts.iloc[0] / rows) * 100
                if top_pct > 30:
                    insights.append(f"Highly concentrated: '{top_val}' accounts for {top_pct:.1f}% of all items in category '{c}'.")

        # 3. High Correlation Detection
        num_df = df.select_dtypes(include=[np.number])
        if len(num_df.columns) >= 2:
            corr = num_df.corr().abs()
            # Find pairs with high correlation
            high_corr_pairs = []
            for i in range(len(corr.columns)):
                for j in range(i+1, len(corr.columns)):
                    c1, c2 = corr.columns[i], corr.columns[j]
                    val = corr.iloc[i, j]
                    if val > 0.7:
                        high_corr_pairs.append((c1, c2, val))
            
            for c1, c2, val in high_corr_pairs[:2]:
                insights.append(f"Strong relationship: Columns '{c1}' and '{c2}' exhibit a high correlation of {val:.2f}, indicating they vary closely together.")

        # 4. Outliers Warning
        numeric_cols = num_df.columns
        outliers_detected = []
        for col in numeric_cols[:3]:
            q25 = df[col].quantile(0.25)
            q75 = df[col].quantile(0.75)
            iqr = q75 - q25
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            outlier_count = ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
            if outlier_count > 0:
                outliers_detected.append((col, outlier_count))
                
        if outliers_detected:
            cols_str = ", ".join([f"'{c}' ({n} items)" for c, n in outliers_detected[:2]])
            insights.append(f"Outliers detected in columns: {cols_str}. Capping or filtration may be required for modeling.")

        return insights
