import pandas as pd
import numpy as np
import random
import os

# Define anomaly thresholds
thresholds = {
    "Temperature": {"min": 10, "max": 40},
    "Humidity": {"min": 0, "max": 100},
    "Light": {"min": 0, "max": 2000},
    "CO2": {"min": 300, "max": 2000},
    "HumidityRatio": {"min": 0, "max": 0.02}
}

# Probability of starting an anomaly at a row
anomaly_start_prob = 0.01  # ~1% chance per row
anomaly_duration = 10      # keep anomaly for 10 rows (~10 minutes)

def inject_anomalies(df):
    """Inject anomalies into a dataframe"""
    # Track anomaly state
    active_anomaly = None
    remaining_duration = 0

    for idx in range(len(df)):
        if active_anomaly is None:  
            # Decide whether to start a new anomaly
            if random.random() < anomaly_start_prob:
                active_anomaly = random.choice(list(thresholds.keys()))
                remaining_duration = anomaly_duration

                # Decide low or high anomaly
                anomaly_type = "low" if random.random() < 0.5 else "high"

        if active_anomaly:
            bounds = thresholds[active_anomaly]

            if anomaly_type == "low":
                if active_anomaly == "Temperature":
                    df.at[idx, active_anomaly] = round(bounds["low"] - random.uniform(1, 5), 2)
                elif active_anomaly == "Humidity":
                    df.at[idx, active_anomaly] = round(bounds["low"] - random.uniform(1, 10), 2)
                elif active_anomaly == "Light":
                    df.at[idx, active_anomaly] = round(random.uniform(0, bounds["low"] - 1), 2)
                elif active_anomaly == "CO2":
                    df.at[idx, active_anomaly] = round(random.uniform(100, bounds["low"] - 1), 2)
                elif active_anomaly == "HumidityRatio":
                    df.at[idx, active_anomaly] = round(bounds["low"] - random.uniform(0.0005, 0.001), 6)

            elif anomaly_type == "high":
                if active_anomaly == "Temperature":
                    df.at[idx, active_anomaly] = round(bounds["high"] + random.uniform(1, 5), 2)
                elif active_anomaly == "Humidity":
                    df.at[idx, active_anomaly] = round(bounds["high"] + random.uniform(5, 15), 2)
                elif active_anomaly == "Light":
                    df.at[idx, active_anomaly] = round(bounds["high"] + random.uniform(100, 500), 2)
                elif active_anomaly == "CO2":
                    df.at[idx, active_anomaly] = round(bounds["high"] + random.uniform(100, 500), 2)
                elif active_anomaly == "HumidityRatio":
                    df.at[idx, active_anomaly] = round(bounds["high"] + random.uniform(0.001, 0.002), 6)

            # Decrease anomaly duration counter
            remaining_duration -= 1
            if remaining_duration <= 0:
                active_anomaly = None

    return df

# Process all datasets in the data folder
data_folder = "./data"
datasets = ["datatest.txt", "datatest2.txt", "datatraining.txt"]

for dataset in datasets:
    file_path = os.path.join(data_folder, dataset)
    if os.path.exists(file_path):
        print(f"Processing {dataset}...")
        
        # Load dataset
        df = pd.read_csv(file_path)
        
        # Inject anomalies
        df_with_anomalies = inject_anomalies(df.copy())
        
        # Save with anomalies in the same data folder
        output_filename = dataset.replace('.txt', '_anomalies.csv')
        output_path = os.path.join(data_folder, output_filename)
        df_with_anomalies.to_csv(output_path, index=False)
        
        print(f"Anomalies injected. File saved as '{output_filename}'")
    else:
        print(f"Warning: {file_path} not found, skipping...")

print("All datasets processed!")
