% Facts and rules for illegal mining pollution detection

% Rule 1: Determines risk based on deforestation (%), water turbidity, heavy metal concentration, and soil erosion.
risk_level(Deforestation, Turbidity, HeavyMetals, SoilErosion, Reports, 'High') :-
    Deforestation >= 70,  % High deforestation percentage
    Turbidity > 100,      % High turbidity
    HeavyMetals > 50,     % High heavy metal concentration
    SoilErosion > 30,     % High soil erosion
    Reports > 5.          % High number of community reports

risk_level(Deforestation, Turbidity, HeavyMetals, SoilErosion, Reports, 'Medium') :-
    Deforestation >= 70,
    Turbidity > 100,
    HeavyMetals > 50,
    SoilErosion > 30,
    Reports =< 5.

risk_level(Deforestation, Turbidity, HeavyMetals, SoilErosion, Reports, 'Low') :-
    Deforestation < 70,
    Turbidity =< 100,
    HeavyMetals =< 50,
    SoilErosion =< 30.

% Rule 2: Determines risk based on pH level and dissolved oxygen.
risk_level_pH_DO(pH, DO, 'High') :-
    pH < 6.5,  % Acidic water
    DO < 4.    % Low dissolved oxygen

risk_level_pH_DO(pH, DO, 'Medium') :-
    (pH < 6.5; DO < 4).  % Either acidic water or low dissolved oxygen

risk_level_pH_DO(pH, DO, 'Low') :-
    pH >= 6.5,
    DO >= 4.

% Rule 3: Determines risk based on biodiversity loss.
risk_level_biodiversity(BiodiversityLoss, 'High') :-
    BiodiversityLoss > 50.  % High biodiversity loss (%)

risk_level_biodiversity(BiodiversityLoss, 'Medium') :-
    BiodiversityLoss > 20,
    BiodiversityLoss =< 50.

risk_level_biodiversity(BiodiversityLoss, 'Low') :-
    BiodiversityLoss =< 20.

% Rule 4: Determines risk based on air quality (PM2.5 levels).
risk_level_air_quality(PM25, 'High') :-
    PM25 > 150.  % High PM2.5 concentration (µg/m³)

risk_level_air_quality(PM25, 'Medium') :-
    PM25 > 50,
    PM25 =< 150.

risk_level_air_quality(PM25, 'Low') :-
    PM25 =< 50.

% Rule 5: Determines risk based on noise levels.
risk_level_noise(NoiseLevel, 'High') :-
    NoiseLevel > 85.  % High noise level (dB)

risk_level_noise(NoiseLevel, 'Medium') :-
    NoiseLevel > 60,
    NoiseLevel =< 85.

risk_level_noise(NoiseLevel, 'Low') :-
    NoiseLevel =< 60.

% Rule 6: Determines risk based on community health reports.
risk_level_health(HealthReports, 'High') :-
    HealthReports > 10.  % High number of health reports

risk_level_health(HealthReports, 'Medium') :-
    HealthReports > 5,
    HealthReports =< 10.

risk_level_health(HealthReports, 'Low') :-
    HealthReports =< 5.

% Query to evaluate overall risk.
evaluate_risk :-
    write('Enter deforestation rate (%): '), read(Deforestation),
    write('Enter water turbidity (NTU): '), read(Turbidity),
    write('Enter heavy metal concentration (ppb): '), read(HeavyMetals),
    write('Enter soil erosion rate (%): '), read(SoilErosion),
    write('Enter number of community reports: '), read(Reports),
    write('Enter pH level of water: '), read(pH),
    write('Enter dissolved oxygen level (mg/L): '), read(DO),
    write('Enter biodiversity loss (%): '), read(BiodiversityLoss),
    write('Enter air quality (PM2.5 in µg/m³): '), read(PM25),
    write('Enter noise level (dB): '), read(NoiseLevel),
    write('Enter number of community health reports: '), read(HealthReports),
    
    risk_level(Deforestation, Turbidity, HeavyMetals, SoilErosion, Reports, Risk1),
    risk_level_pH_DO(pH, DO, Risk2),
    risk_level_biodiversity(BiodiversityLoss, Risk3),
    risk_level_air_quality(PM25, Risk4),
    risk_level_noise(NoiseLevel, Risk5),
    risk_level_health(HealthReports, Risk6),
    
    overall_risk([Risk1, Risk2, Risk3, Risk4, Risk5, Risk6], OverallRisk),
    
    write('The overall risk level is: '), write(OverallRisk), nl.

% Rule to determine overall risk based on individual risk levels.
overall_risk(Risks, 'High') :-
    member('High', Risks).  % If any risk is 'High', overall risk is 'High'

overall_risk(Risks, 'Medium') :-
    \+ member('High', Risks),
    member('Medium', Risks).  % If no 'High' risks but at least one 'Medium'

overall_risk(Risks, 'Low') :-
    \+ member('High', Risks),
    \+ member('Medium', Risks).  % If all risks are 'Low'