import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, confusion_matrix, roc_curve, auc, silhouette_score
from sklearn.decomposition import PCA
import statsmodels.api as sm
from datetime import timedelta

class ForecastAgent:
    def __init__(self):
        pass

    def run_regression(self, df: pd.DataFrame, target_col: str, feature_cols: list[str]) -> dict:
        """
        Train a regression model to predict target_col using feature_cols.
        """
        df_clean = df[[target_col] + feature_cols].dropna()
        if len(df_clean) < 10:
            return {"error": "Not enough data points after dropping NaNs (minimum 10 required)."}

        X = df_clean[feature_cols]
        y = df_clean[target_col]

        # Handle categorical features using label encoding
        X_encoded = X.copy()
        for col in X_encoded.columns:
            if X_encoded[col].dtype == object or isinstance(X_encoded[col].dtype, pd.CategoricalDtype):
                le = LabelEncoder()
                X_encoded[col] = le.fit_transform(X_encoded[col].astype(str))

        X_train, X_test, y_train, y_test = train_test_split(X_encoded, y, test_size=0.2, random_state=42)

        # Train a Random Forest Regressor for feature importance, and Linear Regression
        rf = RandomForestRegressor(n_estimators=100, random_state=42)
        rf.fit(X_train, y_train)
        y_pred = rf.predict(X_test)

        r2 = r2_score(y_test, y_pred)
        mse = mean_squared_error(y_test, y_pred)
        rmse = np.sqrt(mse)

        # Feature Importance
        importances = rf.feature_importances_.tolist()
        feature_importance = [
            {"feature": feat, "importance": imp} for feat, imp in zip(feature_cols, importances)
        ]
        feature_importance = sorted(feature_importance, key=lambda x: x["importance"], reverse=True)

        # For visualization, return a subset of actual vs predicted
        vis_size = min(len(y_test), 100)
        vis_df = pd.DataFrame({
            "actual": y_test.iloc[:vis_size].tolist(),
            "predicted": y_pred[:vis_size].tolist()
        })

        return {
            "r2": float(r2),
            "mse": float(mse),
            "rmse": float(rmse),
            "feature_importance": feature_importance,
            "predictions": vis_df.to_dict(orient="records"),
            "model_type": "Random Forest Regressor"
        }

    def run_classification(self, df: pd.DataFrame, target_col: str, feature_cols: list[str]) -> dict:
        """
        Train a classification model to predict categorical target_col.
        """
        df_clean = df[[target_col] + feature_cols].dropna()
        if len(df_clean) < 10:
            return {"error": "Not enough data points after dropping NaNs (minimum 10 required)."}

        X = df_clean[feature_cols]
        y = df_clean[target_col]

        # Encode target
        le_y = LabelEncoder()
        y_encoded = le_y.fit_transform(y.astype(str))
        classes = le_y.classes_.tolist()

        # Handle features
        X_encoded = X.copy()
        for col in X_encoded.columns:
            if X_encoded[col].dtype == object or isinstance(X_encoded[col].dtype, pd.CategoricalDtype):
                le_x = LabelEncoder()
                X_encoded[col] = le_x.fit_transform(X_encoded[col].astype(str))

        X_train, X_test, y_train, y_test = train_test_split(X_encoded, y_encoded, test_size=0.2, random_state=42)

        # Train Classifier
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X_train, y_train)
        y_pred = rf.predict(X_test)
        
        # Probabilities for ROC curve (binary class case)
        y_prob = rf.predict_proba(X_test) if hasattr(rf, "predict_proba") else None

        accuracy = accuracy_score(y_test, y_pred)
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred).tolist()

        # ROC Curve (for binary classification, or first class vs others)
        fpr, tpr, roc_auc = [], [], 0.0
        if y_prob is not None and len(classes) == 2:
            fpr_arr, tpr_arr, _ = roc_curve(y_test, y_prob[:, 1])
            fpr = fpr_arr.tolist()
            tpr = tpr_arr.tolist()
            roc_auc = float(auc(fpr_arr, tpr_arr))

        # Feature Importance
        importances = rf.feature_importances_.tolist()
        feature_importance = [
            {"feature": feat, "importance": imp} for feat, imp in zip(feature_cols, importances)
        ]
        feature_importance = sorted(feature_importance, key=lambda x: x["importance"], reverse=True)

        return {
            "accuracy": float(accuracy),
            "confusion_matrix": cm,
            "classes": classes,
            "roc": {"fpr": fpr, "tpr": tpr, "auc": roc_auc} if len(classes) == 2 else None,
            "feature_importance": feature_importance,
            "model_type": "Random Forest Classifier"
        }

    def run_clustering(self, df: pd.DataFrame, feature_cols: list[str], n_clusters: int = 3) -> dict:
        """
        Segment the dataset into n_clusters.
        """
        df_clean = df[feature_cols].dropna()
        if len(df_clean) < n_clusters:
            return {"error": "Not enough data points to run clustering."}

        X = df_clean.copy()
        for col in X.columns:
            if X[col].dtype == object or isinstance(X[col].dtype, pd.CategoricalDtype):
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))

        # Scale data
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # KMeans
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)
        
        # Calculate silhouette score
        sil = float(silhouette_score(X_scaled, labels)) if len(X_scaled) > n_clusters and len(X_scaled) < 5000 else 0.0

        # Run PCA for 2D visualization
        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X_scaled)
        
        # Prepare plot data
        plot_data = []
        for i in range(len(df_clean)):
            plot_data.append({
                "x": float(X_pca[i, 0]),
                "y": float(X_pca[i, 1]),
                "cluster": int(labels[i])
            })

        return {
            "silhouette_score": sil,
            "clusters": labels.tolist(),
            "plot_data": plot_data,
            "model_type": "K-Means Clustering"
        }

    def run_anomaly_detection(self, df: pd.DataFrame, feature_cols: list[str]) -> dict:
        """
        Detect anomalies using Isolation Forest.
        """
        df_clean = df[feature_cols].dropna()
        if len(df_clean) < 10:
            return {"error": "Not enough data points to detect anomalies."}

        X = df_clean.copy()
        for col in X.columns:
            if X[col].dtype == object or isinstance(X[col].dtype, pd.CategoricalDtype):
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Isolation Forest
        clf = IsolationForest(contamination=0.05, random_state=42)
        preds = clf.fit_predict(X_scaled) # -1 for anomaly, 1 for normal
        scores = clf.decision_function(X_scaled)

        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X_scaled)

        plot_data = []
        anomaly_indices = []
        for i in range(len(df_clean)):
            is_anomaly = bool(preds[i] == -1)
            plot_data.append({
                "x": float(X_pca[i, 0]),
                "y": float(X_pca[i, 1]),
                "anomaly": is_anomaly,
                "score": float(scores[i])
            })
            if is_anomaly:
                anomaly_indices.append(i)

        return {
            "anomaly_count": len(anomaly_indices),
            "anomaly_percent": float(len(anomaly_indices) / len(df_clean) * 100),
            "plot_data": plot_data,
            "model_type": "Isolation Forest Anomaly Detection"
        }

    def forecast_values(self, df: pd.DataFrame, date_col: str, value_col: str, periods: int = 12) -> dict:
        """
        Perform time-series forecasting.
        Aggregates data by date first, then forecasts future periods.
        """
        try:
            # 1. Prepare time series
            df_ts = df[[date_col, value_col]].dropna().copy()
            df_ts[date_col] = pd.to_datetime(df_ts[date_col], errors='coerce')
            df_ts = df_ts.dropna()
            
            if len(df_ts) < 5:
                return {"error": "Not enough data points for time series forecasting."}

            # Set index and aggregate by period (daily, weekly, or monthly)
            df_ts = df_ts.sort_values(by=date_col)
            
            # Determine suitable aggregation frequency based on date span
            span_days = (df_ts[date_col].max() - df_ts[date_col].min()).days
            if span_days < 30:
                freq = "D"
            elif span_days < 180:
                freq = "W"
            else:
                freq = "ME"  # Monthly

            aggregated = df_ts.resample(freq, on=date_col)[value_col].sum().reset_index()
            aggregated = aggregated.rename(columns={date_col: "ds", value_col: "y"})
            
            if len(aggregated) < 5:
                # If aggregation yielded too few points, don't aggregate, just use raw sorted points
                aggregated = pd.DataFrame({
                    "ds": df_ts[date_col],
                    "y": df_ts[value_col]
                }).sort_values(by="ds").reset_index(drop=True)
                freq = "D"

            # 2. Build time series model
            # Use Statsmodels AutoReg (ARIMA equivalent) if sufficient data, or linear trend + season regression
            n_obs = len(aggregated)
            
            history_dates = aggregated["ds"].dt.strftime("%Y-%m-%d").tolist()
            history_values = aggregated["y"].tolist()

            # Predictor variable is index/time
            t = np.arange(n_obs).reshape(-1, 1)
            y = aggregated["y"].values
            
            # Fit linear trend model
            model = LinearRegression()
            model.fit(t, y)
            
            # Forecast future time indices
            future_t = np.arange(n_obs, n_obs + periods).reshape(-1, 1)
            forecast_y = model.predict(future_t)
            
            # Estimate confidence interval (residual variance)
            residuals = y - model.predict(t)
            std_err = np.std(residuals) if len(residuals) > 1 else 1.0
            
            # Calculate future dates
            last_date = aggregated["ds"].iloc[-1]
            future_dates = []
            for i in range(1, periods + 1):
                if freq == "ME":
                    next_date = last_date + pd.offsets.MonthEnd(i)
                elif freq == "W":
                    next_date = last_date + timedelta(weeks=i)
                else:
                    next_date = last_date + timedelta(days=i)
                future_dates.append(next_date.strftime("%Y-%m-%d"))

            # Calculate upper/lower confidence bounds
            lower_bound = (forecast_y - 1.96 * std_err).tolist()
            # Clip negative forecast values to 0 if history is entirely positive
            if min(history_values) >= 0:
                forecast_y = np.clip(forecast_y, a_min=0, a_max=None)
                lower_bound = np.clip(lower_bound, a_min=0, a_max=None).tolist()

            upper_bound = (forecast_y + 1.96 * std_err).tolist()
            forecast_values = forecast_y.tolist()

            # Generate Business Recommendation based on trend
            slope = model.coef_[0]
            avg_y = np.mean(y)
            pct_change = (slope / avg_y) * 100 if avg_y > 0 else 0
            
            if pct_change > 1:
                recommendation = f"Predicting a growth trend of {pct_change:.1f}% per period. Recommend expanding inventory or marketing budget to capitalize on the increasing demand."
            elif pct_change < -1:
                recommendation = f"Predicting a declining trend of {abs(pct_change):.1f}% per period. Recommend analyzing cost structures, identifying underperforming items, and running promotional campaigns to mitigate sales drop."
            else:
                recommendation = "Trend is stable. Recommend optimizing existing operations and focusing on customer retention strategies."

            return {
                "dates": history_dates + future_dates,
                "history_len": len(history_dates),
                "history_dates": history_dates,
                "history_values": history_values,
                "forecast_dates": future_dates,
                "forecast_values": forecast_values,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "recommendation": recommendation,
                "frequency": freq
            }
        except Exception as e:
            return {"error": f"Failed to calculate time series forecast: {str(e)}"}
