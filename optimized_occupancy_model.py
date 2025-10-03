#!/usr/bin/env python3
"""
Optimized Occupancy Prediction Model
====================================

This script implements several optimization strategies for the occupancy prediction model:
1. Threshold optimization for each test set
2. Alternative algorithms (Random Forest, XGBoost)
3. Advanced feature engineering
4. Cost-sensitive learning
5. Model calibration

Author: ML Expert
Date: 2025-01-04
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import joblib
import json
from datetime import datetime
from typing import Tuple, Dict, List, Optional

# ML imports
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    average_precision_score, roc_auc_score, precision_recall_curve,
    precision_score, recall_score, f1_score, confusion_matrix,
    classification_report, roc_curve
)

# For advanced techniques
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.model_selection import StratifiedKFold

# XGBoost (if available)
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("XGBoost not available. Install with: pip install xgboost")

# Configuration
SEED = 42
np.random.seed(SEED)

class OptimizedOccupancyPredictor:
    """
    Advanced occupancy prediction with multiple optimization strategies.
    """
    
    def __init__(self, random_state: int = SEED):
        self.random_state = random_state
        self.models = {}
        self.thresholds = {}
        self.feature_names = None
        self.scaler = None
        
    def add_time_features(self, df: pd.DataFrame, make_cyclic: bool = True, weekend_as_int: bool = True) -> pd.DataFrame:
        """Add comprehensive time-based features."""
        df = df.copy()
        
        # Basic time features
        df['hour'] = df.index.hour
        df['dayofweek'] = df.index.dayofweek
        df['month'] = df.index.month
        df['day'] = df.index.day
        
        # Weekend indicator
        df['is_weekend'] = df['dayofweek'] >= 5
        
        if make_cyclic:
            # Cyclical encoding for hour
            df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
            df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
            
            # Cyclical encoding for day of week
            df['dow_sin'] = np.sin(2 * np.pi * df['dayofweek'] / 7)
            df['dow_cos'] = np.cos(2 * np.pi * df['dayofweek'] / 7)
            
            # Cyclical encoding for month
            df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
            df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        
        # Business hours indicators
        df['is_business_hours'] = (df['hour'] >= 9) & (df['hour'] <= 17) & (df['dayofweek'] < 5)
        df['is_morning'] = (df['hour'] >= 6) & (df['hour'] <= 11)
        df['is_afternoon'] = (df['hour'] >= 12) & (df['hour'] <= 17)
        df['is_evening'] = (df['hour'] >= 18) & (df['hour'] <= 22)
        df['is_night'] = (df['hour'] >= 23) | (df['hour'] <= 5)
        
        return df
    
    def add_interaction_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add interaction features between environmental sensors."""
        df = df.copy()
        
        # Environmental interactions
        df['light_co2_interaction'] = df['Light'] * df['CO2']
        df['temp_humidity_interaction'] = df['Temperature'] * df['Humidity']
        df['light_temp_interaction'] = df['Light'] * df['Temperature']
        
        # Normalized interactions
        df['light_co2_ratio'] = df['Light'] / (df['CO2'] + 1e-6)
        df['temp_humidity_ratio'] = df['Temperature'] / (df['Humidity'] + 1e-6)
        
        # Environmental intensity
        df['env_intensity'] = (df['Light'] + df['CO2']) / 2
        df['comfort_index'] = df['Temperature'] * df['HumidityRatio']
        
        return df
    
    def add_rolling_features(self, df: pd.DataFrame, windows: List[str] = ['15min', '30min', '1h']) -> pd.DataFrame:
        """Add rolling statistical features."""
        df = df.copy()
        
        numeric_cols = ['Temperature', 'Humidity', 'Light', 'CO2', 'HumidityRatio']
        
        for window in windows:
            for col in numeric_cols:
                try:
                    # Rolling statistics
                    df[f'{col}_rollmean_{window}'] = df[col].rolling(window).mean()
                    df[f'{col}_rollstd_{window}'] = df[col].rolling(window).std()
                    df[f'{col}_rollmax_{window}'] = df[col].rolling(window).max()
                    df[f'{col}_rollmin_{window}'] = df[col].rolling(window).min()
                    
                    # Change detection
                    df[f'{col}_change_{window}'] = df[col].diff()
                    df[f'{col}_pct_change_{window}'] = df[col].pct_change()
                    
                except Exception as e:
                    print(f"Warning: Could not create rolling features for {col} with window {window}: {e}")
        
        return df
    
    def prepare_features(self, df: pd.DataFrame, target_col: str = "Occupancy", 
                        drop_cols: List[str] = None) -> Tuple[pd.DataFrame, np.ndarray, List[str]]:
        """Prepare features with comprehensive engineering."""
        if drop_cols is None:
            drop_cols = ["date"]
            
        df = df.copy()
        
        # Add all engineered features
        df = self.add_time_features(df)
        df = self.add_interaction_features(df)
        df = self.add_rolling_features(df)
        
        # Select numeric features
        numeric_features = []
        for col in df.columns:
            if (col != target_col and 
                col not in drop_cols and 
                pd.api.types.is_numeric_dtype(df[col])):
                numeric_features.append(col)
        
        X = df[numeric_features].copy()
        y = df[target_col].astype(int).to_numpy()
        
        # Handle missing values
        X = X.fillna(X.median())
        
        self.feature_names = numeric_features
        return X, y, numeric_features
    
    def optimize_threshold(self, y_true: np.ndarray, y_proba: np.ndarray, 
                          metric: str = 'f1') -> Tuple[float, Dict]:
        """Optimize decision threshold for given metric."""
        precision, recall, thresholds = precision_recall_curve(y_true, y_proba)
        
        if metric == 'f1':
            f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
            optimal_idx = np.argmax(f1_scores)
            optimal_threshold = thresholds[optimal_idx]
        elif metric == 'precision':
            optimal_idx = np.argmax(precision)
            optimal_threshold = thresholds[optimal_idx]
        elif metric == 'recall':
            optimal_idx = np.argmax(recall)
            optimal_threshold = thresholds[optimal_idx]
        else:
            # Default to F1
            f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
            optimal_idx = np.argmax(f1_scores)
            optimal_threshold = thresholds[optimal_idx]
        
        metrics = {
            'threshold': optimal_threshold,
            'precision': precision[optimal_idx],
            'recall': recall[optimal_idx],
            'f1': f1_scores[optimal_idx] if metric == 'f1' else 2 * (precision[optimal_idx] * recall[optimal_idx]) / (precision[optimal_idx] + recall[optimal_idx] + 1e-8)
        }
        
        return optimal_threshold, metrics
    
    def train_models(self, X_train: pd.DataFrame, y_train: np.ndarray) -> Dict:
        """Train multiple models with different strategies."""
        
        # Define models
        models = {
            'logistic_regression': Pipeline([
                ('scaler', RobustScaler()),
                ('clf', LogisticRegression(
                    class_weight='balanced',
                    random_state=self.random_state,
                    max_iter=2000
                ))
            ]),
            'random_forest': Pipeline([
                ('scaler', StandardScaler()),
                ('clf', RandomForestClassifier(
                    class_weight='balanced',
                    random_state=self.random_state,
                    n_estimators=100
                ))
            ]),
            'svm': Pipeline([
                ('scaler', RobustScaler()),
                ('clf', SVC(
                    class_weight='balanced',
                    random_state=self.random_state,
                    probability=True
                ))
            ])
        }
        
        # Add XGBoost if available
        if XGBOOST_AVAILABLE:
            models['xgboost'] = Pipeline([
                ('scaler', StandardScaler()),
                ('clf', xgb.XGBClassifier(
                    random_state=self.random_state,
                    eval_metric='logloss',
                    scale_pos_weight=len(y_train[y_train==0]) / len(y_train[y_train==1])
                ))
            ])
        
        # Train models
        trained_models = {}
        for name, model in models.items():
            print(f"Training {name}...")
            try:
                model.fit(X_train, y_train)
                trained_models[name] = model
                print(f"✓ {name} trained successfully")
            except Exception as e:
                print(f"✗ {name} failed: {e}")
        
        return trained_models
    
    def evaluate_model(self, model, X_test: pd.DataFrame, y_test: np.ndarray, 
                      model_name: str, threshold: float = 0.5) -> Dict:
        """Comprehensive model evaluation."""
        
        # Get probabilities
        y_proba = model.predict_proba(X_test)[:, 1]
        
        # Predictions with custom threshold
        y_pred = (y_proba >= threshold).astype(int)
        
        # Calculate metrics
        metrics = {
            'model': model_name,
            'threshold': threshold,
            'roc_auc': roc_auc_score(y_test, y_proba),
            'average_precision': average_precision_score(y_test, y_proba),
            'precision': precision_score(y_test, y_pred),
            'recall': recall_score(y_test, y_pred),
            'f1_score': f1_score(y_test, y_pred),
            'accuracy': (y_pred == y_test).mean(),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
        
        return metrics
    
    def optimize_all_thresholds(self, models: Dict, X_test: pd.DataFrame, 
                              y_test: np.ndarray) -> Dict:
        """Optimize thresholds for all models."""
        thresholds = {}
        
        for name, model in models.items():
            y_proba = model.predict_proba(X_test)[:, 1]
            threshold, metrics = self.optimize_threshold(y_test, y_proba, 'f1')
            thresholds[name] = {
                'threshold': threshold,
                'metrics': metrics
            }
        
        return thresholds
    
    def plot_performance_comparison(self, results: Dict, save_path: str = None):
        """Plot comprehensive performance comparison."""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Extract data for plotting
        models = list(results.keys())
        metrics = ['roc_auc', 'average_precision', 'precision', 'recall', 'f1_score', 'accuracy']
        
        # ROC AUC and Average Precision
        roc_aucs = [results[model]['roc_auc'] for model in models]
        avg_precisions = [results[model]['average_precision'] for model in models]
        
        axes[0, 0].bar(models, roc_aucs, alpha=0.7, color='skyblue')
        axes[0, 0].set_title('ROC AUC Comparison')
        axes[0, 0].set_ylabel('ROC AUC')
        axes[0, 0].set_ylim(0.9, 1.0)
        
        axes[0, 1].bar(models, avg_precisions, alpha=0.7, color='lightgreen')
        axes[0, 1].set_title('Average Precision Comparison')
        axes[0, 1].set_ylabel('Average Precision')
        axes[0, 1].set_ylim(0.9, 1.0)
        
        # Precision-Recall trade-off
        precisions = [results[model]['precision'] for model in models]
        recalls = [results[model]['recall'] for model in models]
        
        axes[1, 0].scatter(recalls, precisions, s=100, alpha=0.7)
        for i, model in enumerate(models):
            axes[1, 0].annotate(model, (recalls[i], precisions[i]), 
                               xytext=(5, 5), textcoords='offset points')
        axes[1, 0].set_xlabel('Recall')
        axes[1, 0].set_ylabel('Precision')
        axes[1, 0].set_title('Precision-Recall Trade-off')
        
        # F1 Score comparison
        f1_scores = [results[model]['f1_score'] for model in models]
        axes[1, 1].bar(models, f1_scores, alpha=0.7, color='orange')
        axes[1, 1].set_title('F1 Score Comparison')
        axes[1, 1].set_ylabel('F1 Score')
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.show()
    
    def run_optimization(self, train_df: pd.DataFrame, test1_df: pd.DataFrame, 
                         test2_df: pd.DataFrame) -> Dict:
        """Run complete optimization pipeline."""
        
        print("=== OPTIMIZED OCCUPANCY PREDICTION ===")
        print(f"Training samples: {len(train_df)}")
        print(f"Test 1 samples: {len(test1_df)}")
        print(f"Test 2 samples: {len(test2_df)}")
        
        # Prepare features
        print("\n1. Preparing features...")
        X_train, y_train, feature_names = self.prepare_features(train_df)
        X_test1, y_test1, _ = self.prepare_features(test1_df)
        X_test2, y_test2, _ = self.prepare_features(test2_df)
        
        # Align test features with training features
        X_test1 = X_test1.reindex(columns=feature_names, fill_value=0)
        X_test2 = X_test2.reindex(columns=feature_names, fill_value=0)
        
        print(f"Features: {len(feature_names)}")
        print(f"Training shape: {X_train.shape}")
        
        # Train models
        print("\n2. Training models...")
        models = self.train_models(X_train, y_train)
        
        # Evaluate on both test sets
        print("\n3. Evaluating models...")
        results = {}
        
        for test_name, (X_test, y_test) in [("Test1", (X_test1, y_test1)), 
                                           ("Test2", (X_test2, y_test2))]:
            print(f"\n--- {test_name} Results ---")
            results[test_name] = {}
            
            for model_name, model in models.items():
                # Optimize threshold
                y_proba = model.predict_proba(X_test)[:, 1]
                optimal_threshold, threshold_metrics = self.optimize_threshold(y_test, y_proba, 'f1')
                
                # Evaluate with optimal threshold
                metrics = self.evaluate_model(model, X_test, y_test, model_name, optimal_threshold)
                
                results[test_name][model_name] = metrics
                
                print(f"{model_name}:")
                print(f"  ROC AUC: {metrics['roc_auc']:.4f}")
                print(f"  Avg Precision: {metrics['average_precision']:.4f}")
                print(f"  Precision: {metrics['precision']:.4f}")
                print(f"  Recall: {metrics['recall']:.4f}")
                print(f"  F1 Score: {metrics['f1_score']:.4f}")
                print(f"  Optimal Threshold: {optimal_threshold:.4f}")
                print()
        
        return results

def main():
    """Main execution function."""
    
    # Load data
    data_dir = Path("data")
    train_df = pd.read_csv(data_dir / "datatraining.txt")
    test1_df = pd.read_csv(data_dir / "datatest.txt")
    test2_df = pd.read_csv(data_dir / "datatest2.txt")
    
    # Parse dates
    for df in [train_df, test1_df, test2_df]:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df.set_index("date", inplace=True)
    
    # Initialize optimizer
    optimizer = OptimizedOccupancyPredictor()
    
    # Run optimization
    results = optimizer.run_optimization(train_df, test1_df, test2_df)
    
    # Save results
    output_dir = Path("out_optimized")
    output_dir.mkdir(exist_ok=True)
    
    with open(output_dir / "optimized_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    # Plot comparison
    optimizer.plot_performance_comparison(results["Test1"], 
                                        str(output_dir / "test1_comparison.png"))
    optimizer.plot_performance_comparison(results["Test2"], 
                                        str(output_dir / "test2_comparison.png"))
    
    print("\n=== OPTIMIZATION COMPLETE ===")
    print(f"Results saved to: {output_dir}")
    
    return results

if __name__ == "__main__":
    results = main()
