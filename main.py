from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load AI artifacts
model = joblib.load('student_model.pkl')
model_columns = joblib.load('model_columns.pkl')
explainer = joblib.load('shap_explainer.pkl')

# --- ENHANCED DATASET LOADING ---
# We now load and merge the data so the "Classroom" has real clicks and scores
try:
    info = pd.read_csv('studentInfo.csv')
    vle = pd.read_csv('studentVle.csv')
    assess = pd.read_csv('studentAssessment.csv')

    # Calculate total clicks
    clicks = vle.groupby('id_student')['sum_click'].sum().reset_index()
    clicks.columns = ['id_student', 'total_clicks']

    # Calculate average scores
    assess['score'] = pd.to_numeric(assess['score'], errors='coerce')
    scores = assess.groupby('id_student')['score'].mean().reset_index()
    scores.columns = ['id_student', 'avg_score']

    # Merge demographics with activity data
    student_df = pd.merge(info, clicks, on='id_student', how='left')
    student_df = pd.merge(student_df, scores, on='id_student', how='left')
    student_df = student_df.fillna({'total_clicks': 0, 'avg_score': 0})
    
except Exception as e:
    print(f"Data loading error: {e}")
    student_df = pd.DataFrame()

class StudentData(BaseModel):
    gender: str
    region: str
    highest_education: str = "A Level" 
    age_band: str
    total_clicks: int
    avg_score: float 

@app.get("/students")
def get_students():
    """Returns students with their REAL clicks and scores."""
    if student_df.empty: return []
    return student_df.head(50).to_dict(orient='records')

@app.post("/predict")
def predict_student(data: StudentData):
    input_df = pd.DataFrame([data.dict()])
    encoded_input = pd.get_dummies(input_df)
    full_input = pd.DataFrame(columns=model_columns).fillna(0)
    for col in encoded_input.columns:
        if col in full_input.columns:
            full_input[col] = encoded_input[col]

    prediction = int(model.predict(full_input)[0])
    probability = float(model.predict_proba(full_input)[0][1])
    shap_vals = explainer.shap_values(full_input)
    display_shap = shap_vals[1].flatten().tolist() if isinstance(shap_vals, list) else shap_vals.flatten().tolist()

    return {
        "success_prediction": "Pass" if prediction == 1 else "Fail",
        "probability": round(probability, 2),
        "feature_importance": dict(zip(model_columns, display_shap))
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)