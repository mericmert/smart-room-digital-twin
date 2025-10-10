"""
Anomaly detection module for occupancy sensor data.

This module provides various methods to detect anomalies in sensor data
before training ML models to prevent them from learning from corrupted data.
"""

from __future__ import annotations
from typing import Dict, List, Tuple, Optional, Union
import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from scipy import stats
import warnings

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    A comprehensive anomaly detector for occupancy sensor data.
    
    Supports multiple detection methods:
    - Statistical methods (Z-score, IQR)
    - Machine learning methods (Isolation Forest)
    - Domain-specific thresholds
    """
    
    def __init__(
        self,
        method: str = "combined",
        contamination: float = 0.1,
        z_threshold: float = 3.0,
        iqr_multiplier: float = 1.5,
        domain_thresholds: Optional[Dict[str, Dict[str, float]]] = None
    ):
        """
        Initialize the anomaly detector.
        
        Args:
            method: Detection method ('statistical', 'isolation_forest', 'domain', 'combined')
            contamination: Expected proportion of anomalies (for Isolation Forest)
            z_threshold: Z-score threshold for statistical detection
            iqr_multiplier: IQR multiplier for outlier detection
            domain_thresholds: Domain-specific thresholds for each sensor
        """
        self.method = method
        self.contamination = contamination
        self.z_threshold = z_threshold
        self.iqr_multiplier = iqr_multiplier
        
        # Default domain thresholds based on typical sensor ranges
        self.domain_thresholds = domain_thresholds or {
            "Temperature": {"min": 18, "max": 28},
            "Humidity": {"min": 30, "max": 70},
            "Light": {"min": 10, "max": 1500},
            "CO2": {"min": 350, "max": 1200},
            "HumidityRatio": {"min": 0.004, "max": 0.015}
        }
        
        self.scaler = StandardScaler()
        self.isolation_forest = None
        self.fitted = False
        
    def _detect_statistical_anomalies(self, df: pd.DataFrame, numeric_cols: List[str]) -> pd.DataFrame:
        """Detect anomalies using statistical methods (Z-score and IQR)."""
        anomaly_mask = pd.Series(False, index=df.index)
        
        for col in numeric_cols:
            if col not in df.columns:
                continue
                
            # Z-score method
            z_scores = np.abs(stats.zscore(df[col].dropna()))
            z_anomalies = z_scores > self.z_threshold
            
            # IQR method
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - self.iqr_multiplier * IQR
            upper_bound = Q3 + self.iqr_multiplier * IQR
            iqr_anomalies = (df[col] < lower_bound) | (df[col] > upper_bound)
            
            # Combine both methods
            col_anomalies = z_anomalies | iqr_anomalies
            anomaly_mask |= col_anomalies
            
            logger.debug(f"Statistical anomalies in {col}: {col_anomalies.sum()}")
            
        return anomaly_mask
    
    def _detect_domain_anomalies(self, df: pd.DataFrame, numeric_cols: List[str]) -> pd.DataFrame:
        """Detect anomalies using domain-specific thresholds."""
        anomaly_mask = pd.Series(False, index=df.index)
        
        for col in numeric_cols:
            if col not in df.columns or col not in self.domain_thresholds:
                continue
                
            thresholds = self.domain_thresholds[col]
            col_anomalies = (df[col] < thresholds["min"]) | (df[col] > thresholds["max"])
            anomaly_mask |= col_anomalies
            
            logger.debug(f"Domain anomalies in {col}: {col_anomalies.sum()}")
            
        return anomaly_mask
    
    def _detect_isolation_forest_anomalies(self, df: pd.DataFrame, numeric_cols: List[str]) -> pd.DataFrame:
        """Detect anomalies using Isolation Forest."""
        if not self.fitted:
            raise ValueError("Detector must be fitted before using Isolation Forest method")
            
        # Prepare data for Isolation Forest
        data = df[numeric_cols].fillna(df[numeric_cols].median())
        scaled_data = self.scaler.transform(data)
        
        # Predict anomalies
        anomaly_scores = self.isolation_forest.decision_function(scaled_data)
        anomaly_predictions = self.isolation_forest.predict(scaled_data)
        
        # Convert to boolean mask (1 = normal, -1 = anomaly)
        anomaly_mask = pd.Series(anomaly_predictions == -1, index=df.index)
        
        logger.debug(f"Isolation Forest anomalies: {anomaly_mask.sum()}")
        return anomaly_mask
    
    def fit(self, df: pd.DataFrame, numeric_cols: List[str]) -> None:
        """
        Fit the anomaly detector on training data.
        
        Args:
            df: Training DataFrame
            numeric_cols: List of numeric column names to analyze
        """
        logger.info(f"Fitting anomaly detector with method: {self.method}")
        
        # Filter to only numeric columns that exist
        available_cols = [col for col in numeric_cols if col in df.columns]
        if not available_cols:
            raise ValueError("No valid numeric columns found for anomaly detection")
            
        # Prepare data for fitting
        data = df[available_cols].fillna(df[available_cols].median())
        
        if self.method in ["isolation_forest", "combined"]:
            # Fit scaler and isolation forest
            scaled_data = self.scaler.fit_transform(data)
            
            effective_contamination = max(self.contamination, 0.15)  # Ensure minimum 15% contamination
            
            self.isolation_forest = IsolationForest(
                contamination=effective_contamination,
                random_state=42,
                n_estimators=200,  # More trees for better detection
                max_samples='auto',  # Use all samples for training
                max_features=1.0,   # Use all features for better detection
                bootstrap=False     # Use all samples without replacement
            )
            self.isolation_forest.fit(scaled_data)
            
        self.fitted = True
        logger.info("Anomaly detector fitted successfully")
    
    def detect_anomalies(self, df: pd.DataFrame, numeric_cols: List[str]) -> pd.DataFrame:
        """
        Detect anomalies in the given DataFrame.
        
        Args:
            df: DataFrame to analyze
            numeric_cols: List of numeric column names to analyze
            
        Returns:
            Boolean Series indicating anomalies (True = anomaly)
        """
        if not self.fitted and self.method in ["isolation_forest", "combined"]:
            raise ValueError("Detector must be fitted before detecting anomalies")
            
        # Filter to only numeric columns that exist
        available_cols = [col for col in numeric_cols if col in df.columns]
        if not available_cols:
            logger.warning("No valid numeric columns found for anomaly detection")
            return pd.Series(False, index=df.index)
        
        anomaly_masks = []
        
        if self.method == "statistical":
            anomaly_masks.append(self._detect_statistical_anomalies(df, available_cols))
        elif self.method == "domain":
            anomaly_masks.append(self._detect_domain_anomalies(df, available_cols))
        elif self.method == "isolation_forest":
            anomaly_masks.append(self._detect_isolation_forest_anomalies(df, available_cols))
        elif self.method == "combined":
            # Combine all methods
            stat_mask = self._detect_statistical_anomalies(df, available_cols)
            domain_mask = self._detect_domain_anomalies(df, available_cols)
            ml_mask = self._detect_isolation_forest_anomalies(df, available_cols)
            
            # Anomaly if detected by any method
            combined_mask = stat_mask | domain_mask | ml_mask
            anomaly_masks.append(combined_mask)
        else:
            raise ValueError(f"Unknown method: {self.method}")
        
        final_mask = anomaly_masks[0]
        for mask in anomaly_masks[1:]:
            final_mask |= mask
            
        logger.info(f"Detected {final_mask.sum()} anomalies out of {len(df)} records")
        return final_mask
    
    def get_anomaly_summary(self, df: pd.DataFrame, anomaly_mask: pd.DataFrame) -> Dict:
        """Get a summary of detected anomalies."""
        total_records = len(df)
        anomaly_count = anomaly_mask.sum()
        anomaly_rate = anomaly_count / total_records if total_records > 0 else 0
        
        return {
            "total_records": total_records,
            "anomaly_count": int(anomaly_count),
            "anomaly_rate": float(anomaly_rate),
            "clean_records": int(total_records - anomaly_count)
        }


def remove_anomalies(df: pd.DataFrame, anomaly_mask: pd.DataFrame) -> pd.DataFrame:
    """Remove rows with anomalies from the DataFrame."""
    clean_df = df[~anomaly_mask].copy()
    logger.info(f"Removed {anomaly_mask.sum()} anomalous records")
    return clean_df


def flag_anomalies(df: pd.DataFrame, anomaly_mask: pd.DataFrame) -> pd.DataFrame:
    """Add an anomaly flag column to the DataFrame."""
    flagged_df = df.copy()
    flagged_df['is_anomaly'] = anomaly_mask.astype(int)
    logger.info(f"Flagged {anomaly_mask.sum()} anomalous records")
    return flagged_df


def correct_anomalies(df: pd.DataFrame, anomaly_mask: pd.DataFrame, method: str = "median") -> pd.DataFrame:
    """
    Correct anomalies by replacing them with statistical values.
    
    Args:
        df: DataFrame with anomalies
        anomaly_mask: Boolean mask indicating anomalies
        method: Correction method ('median', 'mean', 'interpolate')
    """
    corrected_df = df.copy()
    
    for col in df.select_dtypes(include=[np.number]).columns:
        if col in ['is_anomaly']:  # Skip flag columns
            continue
            
        col_anomalies = anomaly_mask & df[col].notna()
        if not col_anomalies.any():
            continue
            
        if method == "median":
            replacement_value = df[col].median()
        elif method == "mean":
            replacement_value = df[col].mean()
        elif method == "interpolate":
            # Use forward fill, then backward fill for remaining NaNs
            corrected_df[col] = corrected_df[col].fillna(method='ffill').fillna(method='bfill')
            continue
        else:
            raise ValueError(f"Unknown correction method: {method}")
            
        corrected_df.loc[col_anomalies, col] = replacement_value
        logger.debug(f"Corrected {col_anomalies.sum()} anomalies in {col} using {method}")
    
    logger.info(f"Corrected {anomaly_mask.sum()} anomalous records using {method}")
    return corrected_df
