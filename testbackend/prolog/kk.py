from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

def risk_level(deforestation, turbidity, heavy_metals, soil_erosion, reports):
    if deforestation >= 70 and turbidity > 100 and heavy_metals > 50 and soil_erosion > 30 and reports > 5:
        return "High"
    elif deforestation >= 70 and turbidity > 100 and heavy_metals > 50 and soil_erosion > 30 and reports <= 5:
        return "Medium"
    elif deforestation < 70 and turbidity <= 100 and heavy_metals <= 50 and soil_erosion <= 30:
        return "Low"

def risk_level_pH_DO(pH, DO):
    if pH < 6.5 and DO < 4:
        return "High"
    elif pH < 6.5 or DO < 4:
        return "Medium"
    elif pH >= 6.5 and DO >= 4:
        return "Low"

def risk_level_biodiversity(biodiversity_loss):
    if biodiversity_loss > 50:
        return "High"
    elif 20 < biodiversity_loss <= 50:
        return "Medium"
    elif biodiversity_loss <= 20:
        return "Low"

def risk_level_air_quality(pm25):
    if pm25 > 150:
        return "High"
    elif 50 < pm25 <= 150:
        return "Medium"
    elif pm25 <= 50:
        return "Low"

def risk_level_noise(noise_level):
    if noise_level > 85:
        return "High"
    elif 60 < noise_level <= 85:
        return "Medium"
    elif noise_level <= 60:
        return "Low"

def risk_level_health(health_reports):
    if health_reports > 10:
        return "High"
    elif 5 < health_reports <= 10:
        return "Medium"
    elif health_reports <= 5:
        return "Low"

def overall_risk(risks):
    if "High" in risks:
        return "High"
    elif "Medium" in risks:
        return "Medium"
    elif all(risk == "Low" for risk in risks):
        return "Low"

@app.route('/')
def home():
    return "Welcome to the Risk Assessment API! Use the '/check_risk' endpoint for risk calculations."

@app.route('/favicon.ico')
def favicon():
    return "", 204

@app.route('/check_risk', methods=['POST'])
def check_risk():
    data = request.json

    deforestation = float(data.get('deforestation', 0))
    turbidity = float(data.get('turbidity', 0))
    heavy_metals = float(data.get('heavy_metals', 0))
    soil_erosion = float(data.get('soil_erosion', 0))
    reports = int(data.get('reports', 0))
    pH = float(data.get('pH', 7))
    DO = float(data.get('DO', 5))
    biodiversity_loss = float(data.get('biodiversity_loss', 0))
    pm25 = float(data.get('pm25', 0))
    noise_level = float(data.get('noise_level', 0))
    health_reports = int(data.get('health_reports', 0))

    risk1 = risk_level(deforestation, turbidity, heavy_metals, soil_erosion, reports)
    risk2 = risk_level_pH_DO(pH, DO)
    risk3 = risk_level_biodiversity(biodiversity_loss)
    risk4 = risk_level_air_quality(pm25)
    risk5 = risk_level_noise(noise_level)
    risk6 = risk_level_health(health_reports)

    overall = overall_risk([risk1, risk2, risk3, risk4, risk5, risk6])

    return jsonify({
        "risk_levels": {
            "Deforestation and Pollution": risk1,
            "pH and Dissolved Oxygen": risk2,
            "Biodiversity Loss": risk3,
            "Air Quality": risk4,
            "Noise Pollution": risk5,
            "Community Health": risk6
        },
        "overall_risk": overall
    })

if __name__ == '__main__':
    app.run(debug=True)
