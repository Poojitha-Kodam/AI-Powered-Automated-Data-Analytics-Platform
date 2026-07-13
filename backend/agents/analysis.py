import pandas as pd
import numpy as np
from scipy import stats

class AnalysisAgent:
    def __init__(self):
        pass

    def profile_dataset(self, df: pd.DataFrame) -> dict:
        """
        Generate detailed statistics and meta-information for the dataset.
        """
        rows = len(df)
        cols = len(df.columns)
        
        # Calculate memory usage in a readable format
        memory_bytes = df.memory_usage(deep=True).sum()
        if memory_bytes < 1024:
            memory_str = f"{memory_bytes} B"
        elif memory_bytes < 1024 * 1024:
            memory_str = f"{memory_bytes / 1024:.2f} KB"
        else:
            memory_str = f"{memory_bytes / (1024 * 1024):.2f} MB"

        num_cols = []
        cat_cols = []
        date_cols = []
        
        columns_profile = {}

        for col in df.columns:
            # Drop na for calculation
            non_null_series = df[col].dropna()
            null_count = int(df[col].isnull().sum())
            unique_vals = int(df[col].nunique())
            
            # Check data type
            dtype = str(df[col].dtype)
            
            # Attempt to classify column type
            col_type = "categorical"
            if pd.api.types.is_numeric_dtype(df[col]):
                col_type = "numerical"
                num_cols.append(col)
            elif pd.api.types.is_datetime64_any_dtype(df[col]) or 'datetime' in dtype:
                col_type = "datetime"
                date_cols.append(col)
            else:
                # Try parsing as datetime if it is standard date string
                try:
                    parsed_dates = pd.to_datetime(df[col].dropna().iloc[:100], errors='coerce')
                    if parsed_dates.notnull().sum() / len(parsed_dates) > 0.8:
                        col_type = "datetime"
                        date_cols.append(col)
                except Exception:
                    pass
                
                if col_type != "datetime":
                    cat_cols.append(col)
            
            # Profile per column
            col_stats = {
                "type": col_type,
                "dtype": dtype,
                "missing_count": null_count,
                "missing_percent": float((null_count / rows) * 100) if rows > 0 else 0,
                "unique_count": unique_vals
            }

            if col_type == "numerical" and not non_null_series.empty:
                # Basic statistics
                desc = non_null_series.describe()
                
                # Mode calculation
                mode_res = non_null_series.mode()
                mode_val = float(mode_res.iloc[0]) if not mode_res.empty else None
                
                # Skewness and Kurtosis
                skew = float(non_null_series.skew()) if len(non_null_series) > 2 else 0.0
                kurt = float(non_null_series.kurt()) if len(non_null_series) > 3 else 0.0
                variance = float(non_null_series.var()) if len(non_null_series) > 1 else 0.0
                
                # IQR outlier calculation
                q25 = float(desc.get("25%", 0))
                q75 = float(desc.get("75%", 0))
                iqr = q75 - q25
                lower = q25 - 1.5 * iqr
                upper = q75 + 1.5 * iqr
                outlier_count = int(((non_null_series < lower) | (non_null_series > upper)).sum())

                col_stats.update({
                    "mean": float(desc.get("mean", 0)),
                    "median": float(desc.get("50%", 0)),
                    "mode": mode_val,
                    "min": float(desc.get("min", 0)),
                    "max": float(desc.get("max", 0)),
                    "std": float(desc.get("std", 0)),
                    "variance": variance,
                    "skewness": skew,
                    "kurtosis": kurt,
                    "q25": q25,
                    "q50": float(desc.get("50%", 0)),
                    "q75": q75,
                    "outliers_count": outlier_count
                })
                
            elif col_type == "categorical" and not non_null_series.empty:
                # Value counts
                val_counts = non_null_series.value_counts()
                top_values = []
                for val, count in val_counts.head(5).items():
                    top_values.append({"value": str(val), "count": int(count), "percent": float((count / rows) * 100)})
                
                most_common = str(val_counts.index[0]) if not val_counts.empty else None
                least_common = str(val_counts.index[-1]) if not val_counts.empty else None
                
                col_stats.update({
                    "top_values": top_values,
                    "most_common_value": most_common,
                    "most_common_freq": int(val_counts.iloc[0]) if not val_counts.empty else 0,
                    "least_common_value": least_common,
                    "least_common_freq": int(val_counts.iloc[-1]) if not val_counts.empty else 0
                })
                
            elif col_type == "datetime" and not non_null_series.empty:
                # Try to get min/max dates
                try:
                    date_series = pd.to_datetime(non_null_series, errors='coerce').dropna()
                    if not date_series.empty:
                        col_stats.update({
                            "min_date": date_series.min().isoformat(),
                            "max_date": date_series.max().isoformat(),
                            "span_days": int((date_series.max() - date_series.min()).days)
                        })
                except Exception:
                    pass

            columns_profile[col] = col_stats

        # Check duplicate rows
        dup_rows = int(df.duplicated().sum())

        summary = {
            "rows": rows,
            "columns": cols,
            "numerical_columns": num_cols,
            "categorical_columns": cat_cols,
            "date_columns": date_cols,
            "memory_usage": memory_str,
            "duplicate_rows": dup_rows,
            "columns_profile": columns_profile
        }
        
        return summary

    def calculate_correlation(self, df: pd.DataFrame) -> dict:
        """
        Calculate Pearson correlation matrix for numeric columns.
        """
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.empty or len(numeric_df.columns) < 2:
            return {"columns": [], "matrix": []}
            
        corr_matrix = numeric_df.corr().fillna(0)
        
        return {
            "columns": list(corr_matrix.columns),
            "matrix": corr_matrix.values.tolist()
        }
