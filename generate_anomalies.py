import pandas as pd
import numpy as np
import random

# Load dataset
df = pd.read_csv("./data/datatest2.txt")

# Define anomaly thresholds
thresholds = {
    "Temperature": {"low": 18, "high": 28},
    "Humidity": {"low": 30, "high": 70},
    "Light": {"low": 10, "high": 1500},
    "CO2": {"low": 350, "high": 1200},
    "HumidityRatio": {"low": 0.004, "high": 0.015},
}

# Probability of starting an anomaly at a row
anomaly_start_prob = 0.01  # ~1% chance per row
anomaly_duration = 10      # keep anomaly for 10 rows (~10 minutes)

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

# Save new dataset with anomalies
df.to_csv("datatest2_anomalies.csv", index=False)
print("Anomalies injected. File saved as 'datatest_with_anomalies.csv'")