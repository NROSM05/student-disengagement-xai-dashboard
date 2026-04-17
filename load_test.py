import joblib

# Loading the 'frozen' objects to make sure they work in a standard script
try:
    model = joblib.load('student_model.pkl')
    columns = joblib.load('model_columns.pkl')
    explainer = joblib.load('shap_explainer.pkl')

    print("✅ Model and Explainer loaded successfully!")
    print(f"The model is expecting these {len(columns)} features.")
except Exception as e:
    print(f"❌ Error loading files: {e}")
    print("Make sure the .pkl files are in the same folder as this script.")