import pandas as pd
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import shap

# --- Data Loading ---
data_path = './' 

def load_df(file_name):
    try:
        return pd.read_csv(os.path.join(data_path, file_name))
    except FileNotFoundError:
        print(f"Error: {file_name} not found.")
        return None

student_info = load_df('studentInfo.csv')
student_vle = load_df('studentVle.csv')
student_assessment = load_df('studentAssessment.csv')

def prepare_intelligence_layer(info_df, vle_df, assess_df):
    # 1. Target Variable
    binary_map = {'Pass': 1, 'Distinction': 1, 'Fail': 0, 'Withdrawn': 0}
    info_df['target_success'] = info_df['final_result'].map(binary_map)
    
    # 2. VLE Engagement (Total Clicks)
    clicks = vle_df.groupby(['id_student', 'code_module', 'code_presentation'])['sum_click'].sum().reset_index()
    clicks.columns = ['id_student', 'code_module', 'code_presentation', 'total_clicks']

    # 3. Assessment Performance (Average Score)
    # FIX: Force 'score' to be numeric. errors='coerce' turns non-numbers into NaN
    assess_df['score'] = pd.to_numeric(assess_df['score'], errors='coerce')
    avg_scores = assess_df.groupby('id_student')['score'].mean().reset_index()
    avg_scores.columns = ['id_student', 'avg_score']

    # 4. Merging all together
    df = pd.merge(info_df, clicks, on=['id_student', 'code_module', 'code_presentation'], how='left')
    df = pd.merge(df, avg_scores, on='id_student', how='left')
    
    # Fill missing values (0 clicks, and 0 score if they haven't submitted anything)
    df = df.fillna({'total_clicks': 0, 'avg_score': 0})

    # 5. Feature Selection
    feature_cols = ['gender', 'region', 'highest_education', 'age_band', 'total_clicks', 'avg_score']
    
    X = pd.get_dummies(df[feature_cols], drop_first=True)
    y = df['target_success']
    
    return X, y

if all(df is not None for df in [student_info, student_vle, student_assessment]):
    X, y = prepare_intelligence_layer(student_info, student_vle, student_assessment)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train Model
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    print(f"New Model Accuracy: {accuracy_score(y_test, model.predict(X_test)):.2%}")

    # Re-save the artifacts with the new 'avg_score' column
    explainer = shap.TreeExplainer(model)
    joblib.dump(model, 'student_model.pkl')
    joblib.dump(X.columns.tolist(), 'model_columns.pkl')
    joblib.dump(explainer, 'shap_explainer.pkl')
    print("Sprint 1.1 Complete: Model now includes Assessment Scores.")