import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from typing import Tuple


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = (
    df.columns
      .str.strip()
      .str.lower()
      .str.replace(r'[^\w]+', '_', regex=True)
      .str.replace(r'_+', '_', regex=True)
      .str.strip('_')
    )
    return df

def load_data(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = normalize_columns(df)
    if "date" not in df.columns:
        raise ValueError(f"Expected a 'date' column in {path}. Found: {list(df.columns)}")
    
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    return df


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["hour"] = out["date"].dt.hour
    out["dow"] = out["date"].dt.dayofweek
    out["hour_sin"] = np.sin(2 * np.pi * out["hour"] / 24)
    out["hour_cos"] = np.cos(2 * np.pi * out["hour"] / 24)
    
    out["is_weekend"] = out["dow"].isin([5, 6]).astype(int)
    out["is_work_hours"] = out["hour"].between(8, 18).astype(int)
    return out

def split_X_y(df: pd.DataFrame, target: str = "occupancy") -> Tuple[pd.DataFrame, pd.Series]:
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found. Columns: {list(df.columns)}")
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    feature_cols = [c for c in numeric_cols if c != target]
    X = df[feature_cols]
    y = df[target].astype(int)
    return X, y


def main(args):
    args.target = "occupancy"
    
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    test1 = load_data(Path(args.test1))
    train = load_data(Path(args.train))
    test2 = load_data(Path(args.test2))
    
    train_fe = add_time_features(train)
    test1_fe = add_time_features(test1)
    test2_fe = add_time_features(test2)

    X_train, y_train = split_X_y(train_fe, target=args.target)
    X_test1, y_test1 = split_X_y(test1_fe, target=args.target)
    X_test2, y_test2 = split_X_y(test2_fe, target=args.target)
    
    print(X_train.head())
    print(y_train.head())
    



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=str, default="data/datatraining.txt")
    parser.add_argument("--test1", type=str, default="data/datatest.txt")
    parser.add_argument("--test2", type=str, default="data/datatest2.txt")
    parser.add_argument("--outdir", type=str, default="./out_logreg")
    args = parser.parse_args()
    main(args)