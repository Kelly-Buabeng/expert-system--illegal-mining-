import React, { useState } from 'react';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    deforestation: '',
    turbidity: '',
    heavy_metals: '',
    soil_erosion: '',
    reports: '',
    pH: '',
    DO: '',
    biodiversity_loss: '',
    pm25: '',
    noise_level: '',
    health_reports: ''
  });

  const [results, setResults] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/check_risk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const RiskBadge = ({ level }) => {
    let color = 'gray';
    if (level === 'High') color = 'red';
    if (level === 'Medium') color = 'orange';
    if (level === 'Low') color = 'green';

    return (
      <span className="risk-badge" style={{ backgroundColor: color }}>
        {level}
      </span>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Environmental Risk Assessment</h1>
        <p>Analyze environmental factors and calculate risk levels</p>
      </header>

      <div className="content-wrapper">
        <form onSubmit={handleSubmit} className="assessment-form">
          <div className="form-grid">
            {/* Form Input Groups */}
            {Object.keys(formData).map((field) => (
              <div className="form-group" key={field}>
                <label>
                  {field.split('_').join(' ').toUpperCase()}:
                  <input
                    type="number"
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    step={field === 'pH' ? '0.1' : '1'}
                    required
                  />
                </label>
              </div>
            ))}
          </div>
          <button type="submit" className="submit-btn">
            Calculate Risk
          </button>
        </form>

        {results && (
          <div className="results-card">
            <h2>Assessment Results</h2>
            <div className="risk-results">
              {Object.entries(results.risk_levels).map(([category, level]) => (
                <div key={category} className="risk-category">
                  <span>{category}:</span>
                  <RiskBadge level={level} />
                </div>
              ))}
            </div>
            <div className="overall-risk">
              <h3>Overall Risk:</h3>
              <RiskBadge level={results.overall_risk} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;