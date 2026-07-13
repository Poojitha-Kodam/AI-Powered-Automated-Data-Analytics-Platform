import pandas as pd
import numpy as np
import json

class VisualizationAgent:
    def __init__(self):
        pass

    def suggest_chart_type(self, df: pd.DataFrame, x_col: str, y_col: str = None) -> str:
        """
        Suggests a suitable chart type based on column data types.
        """
        if not x_col or x_col not in df.columns:
            return "histogram"
            
        x_dtype = df[x_col].dtype
        is_x_numeric = pd.api.types.is_numeric_dtype(df[x_col])
        is_x_date = pd.api.types.is_datetime64_any_dtype(df[x_col]) or 'date' in x_col.lower() or 'time' in x_col.lower()
        
        if y_col and y_col in df.columns:
            is_y_numeric = pd.api.types.is_numeric_dtype(df[y_col])
            
            if is_x_date and is_y_numeric:
                return "line"
            elif is_x_numeric and is_y_numeric:
                return "scatter"
            elif not is_x_numeric and is_y_numeric:
                # Categorical X, Numeric Y
                if df[x_col].nunique() > 15:
                    return "bar"  # Bar works well for high cardinality
                return "bar"
        else:
            if is_x_numeric:
                return "histogram"
            else:
                return "pie"
                
        return "bar"

    def generate_plotly_config(self, df: pd.DataFrame, chart_type: str, x_col: str, y_col: str = None, title: str = "", color_col: str = None) -> dict:
        """
        Generate a dictionary structure representing Plotly chart configurations (data and layout).
        """
        chart_type = chart_type.lower()
        data = []
        layout = {
            "title": title or f"{chart_type.title()} Chart: {x_col}" + (f" vs {y_col}" if y_col else ""),
            "template": "plotly_dark", # default template, frontend can override
            "autosize": True,
            "margin": {"l": 50, "r": 30, "t": 50, "b": 50},
        }

        # Make sure columns exist
        if x_col not in df.columns:
            return {"data": [], "layout": {"title": "Error: Column not found"}}
            
        # Sample or aggregate dataframe to prevent front-end crash on huge tables
        if len(df) > 1000 and chart_type in ["bar", "pie", "line", "area"]:
            # Aggregate if possible, otherwise sample
            if y_col and pd.api.types.is_numeric_dtype(df[y_col]):
                df_plot = df.groupby(x_col)[y_col].sum().reset_index().sort_values(by=y_col, ascending=False).head(100)
            else:
                df_plot = df.sample(n=1000, random_state=42)
        else:
            df_plot = df.copy()

        # Handle NaNs in plotting data
        df_plot = df_plot.replace({np.nan: None})

        try:
            if chart_type == "bar":
                # For bar, check if we should aggregate
                if y_col:
                    agg_df = df_plot.groupby(x_col)[y_col].sum().reset_index()
                    x_data = agg_df[x_col].tolist()
                    y_data = agg_df[y_col].tolist()
                else:
                    counts = df_plot[x_col].value_counts()
                    x_data = counts.index.tolist()
                    y_data = counts.values.tolist()
                    
                data.append({
                    "x": x_data,
                    "y": y_data,
                    "type": "bar",
                    "marker": {"color": "#6366f1"},
                    "name": y_col or "Count"
                })
                layout["xaxis"] = {"title": x_col}
                layout["yaxis"] = {"title": y_col or "Count"}

            elif chart_type == "line":
                if y_col:
                    # Sort by X to make lines look continuous (especially dates)
                    sorted_df = df_plot.sort_values(by=x_col)
                    data.append({
                        "x": sorted_df[x_col].tolist(),
                        "y": sorted_df[y_col].tolist(),
                        "type": "scatter",
                        "mode": "lines+markers",
                        "line": {"shape": "spline", "color": "#10b981"},
                        "name": y_col
                    })
                layout["xaxis"] = {"title": x_col}
                layout["yaxis"] = {"title": y_col or ""}

            elif chart_type == "area":
                if y_col:
                    sorted_df = df_plot.sort_values(by=x_col)
                    data.append({
                        "x": sorted_df[x_col].tolist(),
                        "y": sorted_df[y_col].tolist(),
                        "type": "scatter",
                        "mode": "lines",
                        "fill": "tozeroy",
                        "line": {"color": "#a855f7"},
                        "name": y_col
                    })
                layout["xaxis"] = {"title": x_col}
                layout["yaxis"] = {"title": y_col or ""}

            elif chart_type == "pie":
                if y_col:
                    agg_df = df_plot.groupby(x_col)[y_col].sum().reset_index().head(10)
                    labels = agg_df[x_col].tolist()
                    values = agg_df[y_col].tolist()
                else:
                    counts = df_plot[x_col].value_counts().head(10)
                    labels = counts.index.tolist()
                    values = counts.values.tolist()
                    
                data.append({
                    "labels": labels,
                    "values": values,
                    "type": "pie",
                    "hole": 0.4,
                    "textinfo": "percent+label",
                })

            elif chart_type == "scatter":
                if y_col:
                    trace = {
                        "x": df_plot[x_col].tolist(),
                        "y": df_plot[y_col].tolist(),
                        "type": "scatter",
                        "mode": "markers",
                        "marker": {"size": 8, "opacity": 0.7, "color": "#f59e0b"}
                    }
                    if color_col and color_col in df_plot.columns:
                        trace["marker"]["color"] = df_plot[color_col].tolist()
                        trace["marker"]["showscale"] = True
                    data.append(trace)
                layout["xaxis"] = {"title": x_col}
                layout["yaxis"] = {"title": y_col or ""}

            elif chart_type == "histogram":
                data.append({
                    "x": df_plot[x_col].tolist(),
                    "type": "histogram",
                    "nbinsx": 30,
                    "marker": {"color": "#ec4899"}
                })
                layout["xaxis"] = {"title": x_col}
                layout["yaxis"] = {"title": "Frequency"}

            elif chart_type == "box":
                if y_col:
                    # Categorical X, Numeric Y
                    data.append({
                        "x": df_plot[x_col].tolist(),
                        "y": df_plot[y_col].tolist(),
                        "type": "box",
                        "marker": {"color": "#3b82f6"}
                    })
                else:
                    data.append({
                        "y": df_plot[x_col].tolist(),
                        "type": "box",
                        "name": x_col,
                        "marker": {"color": "#3b82f6"}
                    })
                layout["xaxis"] = {"title": x_col if y_col else ""}
                layout["yaxis"] = {"title": y_col if y_col else x_col}

            elif chart_type == "heatmap":
                # Correlation Heatmap
                numeric_df = df_plot.select_dtypes(include=[np.number])
                if not numeric_df.empty and len(numeric_df.columns) > 1:
                    corr = numeric_df.corr().fillna(0)
                    data.append({
                        "z": corr.values.tolist(),
                        "x": list(corr.columns),
                        "y": list(corr.columns),
                        "type": "heatmap",
                        "colorscale": "Viridis"
                    })
                    layout["title"] = "Correlation Heatmap"

            elif chart_type == "treemap":
                if y_col:
                    agg_df = df_plot.groupby(x_col)[y_col].sum().reset_index().head(20)
                    data.append({
                        "type": "treemap",
                        "labels": agg_df[x_col].tolist(),
                        "parents": [""] * len(agg_df),
                        "values": agg_df[y_col].tolist(),
                        "marker": {"colorscale": "Blues"}
                    })

            elif chart_type == "funnel":
                if y_col:
                    agg_df = df_plot.groupby(x_col)[y_col].sum().reset_index().sort_values(by=y_col, ascending=False)
                    data.append({
                        "type": "funnel",
                        "y": agg_df[x_col].tolist(),
                        "x": agg_df[y_col].tolist()
                    })

            elif chart_type == "waterfall":
                if y_col:
                    agg_df = df_plot.groupby(x_col)[y_col].sum().reset_index().head(10)
                    data.append({
                        "type": "waterfall",
                        "x": agg_df[x_col].tolist(),
                        "y": agg_df[y_col].tolist(),
                        "connector": {"line": {"color": "rgb(63, 63, 63)"}}
                    })

            else:
                # Fallback to bar
                data.append({
                    "x": df_plot[x_col].tolist(),
                    "y": df_plot[y_col].tolist() if y_col else [1]*len(df_plot),
                    "type": "bar"
                })

        except Exception as e:
            return {"data": [], "layout": {"title": f"Failed to generate plot: {str(e)}"}}

        return {"data": data, "layout": layout}
