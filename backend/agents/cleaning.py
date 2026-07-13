import pandas as pd
import numpy as np
import json

class CleaningAgent:
    def __init__(self):
        pass

    def detect_issues(self, df: pd.DataFrame) -> list:
        """
        Scan the dataframe and return a list of cleaning recommendations.
        """
        recommendations = []
        
        # 1. Duplicate rows
        dup_count = int(df.duplicated().sum())
        if dup_count > 0:
            recommendations.append({
                "id": "remove_duplicates",
                "column": "All Columns",
                "issue": f"Found {dup_count} duplicate rows.",
                "recommendation": "Remove all duplicate rows.",
                "action": "remove_duplicates",
                "parameters": {},
                "status": "pending"
            })
            
        # Scan columns
        for col in df.columns:
            # 2. Missing values
            null_count = int(df[col].isnull().sum())
            if null_count > 0:
                is_numeric = pd.api.types.is_numeric_dtype(df[col])
                rec_action = "fill_median" if is_numeric else "fill_mode"
                rec_text = f"Fill missing values with median ({df[col].median()})" if is_numeric else f"Fill with mode (most frequent value)"
                recommendations.append({
                    "id": f"fill_missing_{col}",
                    "column": col,
                    "issue": f"Found {null_count} missing value(s) ({(null_count / len(df) * 100):.1f}%).",
                    "recommendation": rec_text,
                    "action": rec_action,
                    "parameters": {"value": str(df[col].median()) if is_numeric and not df[col].isnull().all() else ""},
                    "status": "pending"
                })

            # 3. String formatting issues (leading/trailing spaces, special characters)
            if pd.api.types.is_string_dtype(df[col]):
                # Check for leading/trailing whitespaces
                non_nulls = df[col].dropna().astype(str)
                spaced_count = int((non_nulls.str.strip() != non_nulls).sum())
                if spaced_count > 0:
                    recommendations.append({
                        "id": f"strip_whitespace_{col}",
                        "column": col,
                        "issue": f"Found {spaced_count} string value(s) with leading/trailing spaces.",
                        "recommendation": "Strip leading and trailing whitespaces.",
                        "action": "strip_whitespace",
                        "parameters": {},
                        "status": "pending"
                    })
                
                # Check for currency symbols or percentages that could be numeric
                currency_count = int(non_nulls.str.contains(r'^\s*[\$\€\£\¥]', regex=True).sum())
                percent_count = int(non_nulls.str.contains(r'%\s*$', regex=True).sum())
                if currency_count > 0.5 * len(non_nulls) and len(non_nulls) > 0:
                    recommendations.append({
                        "id": f"convert_currency_{col}",
                        "column": col,
                        "issue": "Column contains currency symbols and should likely be numerical.",
                        "recommendation": "Remove currency symbols ($/€/etc) and convert to float.",
                        "action": "convert_currency",
                        "parameters": {},
                        "status": "pending"
                    })
                elif percent_count > 0.5 * len(non_nulls) and len(non_nulls) > 0:
                    recommendations.append({
                        "id": f"convert_percentage_{col}",
                        "column": col,
                        "issue": "Column contains percentage symbols (%) and should likely be numerical.",
                        "recommendation": "Remove '%' sign, divide by 100, and convert to float.",
                        "action": "convert_percentage",
                        "parameters": {},
                        "status": "pending"
                    })

            # 4. Outliers detection for numerical columns
            if pd.api.types.is_numeric_dtype(df[col]) and not df[col].isnull().all():
                q25 = df[col].quantile(0.25)
                q75 = df[col].quantile(0.75)
                iqr = q75 - q25
                lower_bound = q25 - 1.5 * iqr
                upper_bound = q75 + 1.5 * iqr
                outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)][col]
                outlier_count = len(outliers)
                if outlier_count > 0 and outlier_count < 0.05 * len(df): # only suggest if small fraction
                    recommendations.append({
                        "id": f"cap_outliers_{col}",
                        "column": col,
                        "issue": f"Found {outlier_count} potential outlier(s) using the IQR rule.",
                        "recommendation": f"Cap outliers at 1.5x IQR boundaries: [{lower_bound:.2f}, {upper_bound:.2f}].",
                        "action": "cap_outliers",
                        "parameters": {"lower_bound": float(lower_bound), "upper_bound": float(upper_bound)},
                        "status": "pending"
                    })

        return recommendations

    def apply_clean_actions(self, df: pd.DataFrame, actions: list) -> tuple[pd.DataFrame, list]:
        """
        Apply a list of user-accepted/customized clean actions to the dataframe.
        Returns the modified dataframe and a history of changes.
        """
        history = []
        df_clean = df.copy()

        for action_item in actions:
            action = action_item.get("action")
            column = action_item.get("column")
            params = action_item.get("parameters", {})

            try:
                if action == "remove_duplicates":
                    before = len(df_clean)
                    df_clean = df_clean.drop_duplicates()
                    after = len(df_clean)
                    history.append(f"Removed {before - after} duplicate rows.")

                elif action == "fill_median":
                    if column in df_clean.columns:
                        fill_val = df_clean[column].median()
                        if pd.isna(fill_val):
                            fill_val = 0
                        df_clean[column] = df_clean[column].fillna(fill_val)
                        history.append(f"Filled missing values in column '{column}' with median ({fill_val}).")

                elif action == "fill_mode":
                    if column in df_clean.columns:
                        mode_vals = df_clean[column].mode()
                        fill_val = mode_vals.iloc[0] if not mode_vals.empty else "Missing"
                        df_clean[column] = df_clean[column].fillna(fill_val)
                        history.append(f"Filled missing values in column '{column}' with mode ('{fill_val}').")

                elif action == "fill_custom":
                    if column in df_clean.columns:
                        val = params.get("value", "")
                        # Try casting to numeric if applicable
                        if pd.api.types.is_numeric_dtype(df_clean[column]):
                            try:
                                val = float(val)
                            except ValueError:
                                pass
                        df_clean[column] = df_clean[column].fillna(val)
                        history.append(f"Filled missing values in column '{column}' with custom value '{val}'.")

                elif action == "drop_column":
                    if column in df_clean.columns:
                        df_clean = df_clean.drop(columns=[column])
                        history.append(f"Dropped column '{column}'.")

                elif action == "strip_whitespace":
                    if column in df_clean.columns:
                        df_clean[column] = df_clean[column].astype(str).str.strip()
                        history.append(f"Stripped leading/trailing whitespaces in column '{column}'.")

                elif action == "convert_currency":
                    if column in df_clean.columns:
                        # Remove common currency symbols and commas, convert to numeric
                        clean_col = df_clean[column].astype(str).str.replace(r'[\$\€\£\¥\,]', '', regex=True)
                        df_clean[column] = pd.to_numeric(clean_col, errors='coerce')
                        history.append(f"Cleaned currency symbols and converted column '{column}' to float.")

                elif action == "convert_percentage":
                    if column in df_clean.columns:
                        clean_col = df_clean[column].astype(str).str.replace(r'[\%\s]', '', regex=True)
                        df_clean[column] = pd.to_numeric(clean_col, errors='coerce') / 100.0
                        history.append(f"Converted column '{column}' from percentage string to decimal float.")

                elif action == "cap_outliers":
                    if column in df_clean.columns:
                        lb = float(params.get("lower_bound", df_clean[column].min()))
                        ub = float(params.get("upper_bound", df_clean[column].max()))
                        df_clean[column] = df_clean[column].clip(lower=lb, upper=ub)
                        history.append(f"Capped values in column '{column}' between {lb:.2f} and {ub:.2f}.")

            except Exception as e:
                history.append(f"Error applying clean action '{action}' on '{column}': {str(e)}")

        return df_clean, history
