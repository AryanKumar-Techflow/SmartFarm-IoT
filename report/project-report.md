# PROJECT REPORT: SMART AGRICULTURE – ENTERPRISE MULTI-ZONE IoT MONITORING & SMART IRRIGATION PLATFORM

**Course:** ITEC 310 – Internet of Things  
**Assessment:** Group Lab Project — AI-Assisted IoT Application Development  
**Group Members:**
- Aryan Kumar (Student ID: AUD32535)
- Vinayak Nair (Student ID: AUD32001)
- Kalidasan Udayakumar (Student ID: AUD32458)  
**Institution:** School of Engineering, Architecture and Interior Design (EAID), Amity University Dubai  
**Instructor:** Dr. Maher Alrahhal  
**Academic Term:** Fall 2026  
**Document Format:** Maximum 5 Pages Equivalent (Markdown / Printable PDF Format)  

---

## 1. Project Overview

### 1.1 Project Title
**SmartFarm IoT Enterprise: A Multi-Zone Closed-Loop Soil Moisture Telemetry, Dynamic Micro-Climate, and Autonomous Irrigation Actuation Platform**

### 1.2 Project Objective
The primary objective of this project is to develop an enterprise-grade, client-side Internet of Things (IoT) monitoring and autonomous irrigation platform. The platform demonstrates real-time environmental sensing, deterministic closed-loop decision logic, safety fail-safe interlocks, and multi-actuator control across three distinct agricultural zones.

By dynamically controlling water dispensation only when soil moisture drops below calibrated levels across independent crop types, the application illustrates how modern IoT automation eliminates water wastage, optimizes root zone hydration, and prevents mechanical pump burnout.

### 1.3 How the Enterprise Architecture Works
The application models an end-to-end 5-stage IoT feedback architecture:

```
+-----------------------------------------------------------------------------------+
|                           1. SIMULATED SENSOR LAYER                               |
|  - Zone 1: Capacitive Soil Moisture Sensor (Pin A0: 0%–100%)                      |
|  - Zone 2: Capacitive Soil Moisture Sensor (Pin A1: 0%–100%)                      |
|  - Zone 3: Capacitive Soil Moisture Sensor (Pin A2: 0%–100%) [Sheltered]          |
|  - DHT22 Ambient Temperature Sensor (15°C–45°C) & Relative Hygrometer (20%–95%)   |
|  - Tipping-Bucket Rainfall Intensity Gauge (0–50 mm/h)                            |
+-----------------------------------------+-----------------------------------------+
                                          | (Telemetry Stream)
                                          v
+-----------------------------------------------------------------------------------+
|                     2. INGESTION, CALIBRATION & DIAGNOSTICS                       |
|  - Data Normalization, ADC Mapping & Range Clamping (0%–100%)                     |
|  - Sensor Diagnostic Health: ONLINE vs. DISCONNECTED vs. FAULT                   |
|  - Operating Mode Routing: AUTOMATIC vs. MANUAL OVERRIDE                          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                       3. DECISION-MAKING & LOGIC ENGINE                           |
|  - Rule 1 (Zone 1): IF Moisture < 30% -> Relay D4 ON; ELSE -> OFF                 |
|  - Rule 2 (Zone 2): IF Moisture < 35% -> Relay D5 ON; ELSE -> OFF                 |
|  - Rule 3 (Zone 3): IF Moisture < 45% -> Relay D6 ON; ELSE -> OFF                 |
|  - Fail-Safe Interlock: Sensor Fault -> Immediately trip pump OFF (Anti-flood)   |
|  - Smart Scheduling Window: Restrict automatic watering to low-evaporation hours  |
+-----------------------------------------+-----------------------------------------+
                                          | (Actuation Signals)
                                          v
+-----------------------------------------------------------------------------------+
|                         4. VIRTUAL ACTUATOR OUTPUT LAYER                          |
|  - Zone 1 Virtual Pump (Relay D4: Submersible, 72 L/h)                            |
|  - Zone 2 Virtual Pump (Relay D5: Drip System, 90 L/h)                            |
|  - Zone 3 Virtual Pump (Relay D6: Greenhouse Mist, 45 L/h)                        |
|  - Real-Time Water Volume Integrator: V = ∫(Σ Flow_i / 3600) dt                   |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                   5. ENTERPRISE UI & TELEMETRY FEEDBACK LAYER                     |
|  - Multi-Zone Metric Cards with SVG Circular Gauges & Animated Pump Turbines      |
|  - Smart Weather Station (Temperature, Humidity, Rain Level, Evapotranspiration)   |
|  - Multi-Series Real-Time & 24-Hour Diurnal Telemetry Charts (with Canvas Fallback)|
|  - Prioritized Audited Alert Center with Resolution Lifecycle                     |
|  - Instant CSV Telemetry & Incident Report Export Engine                          |
|  - Interactive 4-Layer IoT Architecture Visual Explorer                           |
|  - Persistent Light / Dark Mode Theming                                           |
+-----------------------------------------------------------------------------------+
```

---

## 2. AI-Assisted Development Methodology

In adherence to the course remit guidelines regarding AI-assisted software engineering, **Google Antigravity** was employed as the primary AI coding assistant throughout the project lifecycle. The development methodology followed a disciplined, iterative pair-programming workflow: architectural planning, component scaffolding, automated test-driven verification, and UI/UX design engineering.

### 2.1 Actual AI Prompts Used & Technical Explanations

#### Prompt 1: Multi-Zone Architectural Extension & Domain Modeling
> **Prompt:**  
> *"Act as a senior software architect and professional IoT developer. Upgrade the existing SmartFarm IoT project into an enterprise multi-zone platform for ITEC 310 at Amity University Dubai. Design three independent zones: Zone 1 (Orchard Grove, Pin A0, Relay D4, 30% threshold), Zone 2 (Vegetable Field, Pin A1, Relay D5, 35% threshold), and Zone 3 (Greenhouse Nursery, Pin A2, Relay D6, 45% threshold). Ensure each zone operates its own simulated capacitive sensor, threshold, and virtual pump independently while preserving 100% of the working assessment test presets (15%, 25%, 30%, 45%, 80%)."*  
>  
> **Explanation & Outcome:**  
> This prompt established the multi-zone domain model. It ensured that each agricultural zone acts as an independent closed-loop subsystem, preventing cross-zone interference while retaining backward compatibility with the instructor's assessment rubric.

#### Prompt 2: Smart Weather Physics & Sensor Fault Fail-Safe Interlock
> **Prompt:**  
> *"Implement dynamic environmental physics and sensor diagnostics in JavaScript. Add simulated temperature, relative humidity, and rainfall intensity. When rainfall occurs, model natural precipitation infiltration by increasing soil moisture in outdoor zones (Zones 1 and 2), while keeping Zone 3 (Greenhouse) sheltered. Furthermore, implement sensor health monitoring: if a sensor is disconnected or faulted, engage an automatic safety fail-safe that de-energizes the pump immediately and triggers a CRITICAL alert to prevent flooding."*  
>  
> **Explanation & Outcome:**  
> This prompt introduced realistic agricultural physical feedback and industrial safety interlocks. It demonstrated fail-safe engineering principles essential for university IoT coursework.

#### Prompt 3: Advanced Analytics, 24-Hour Diurnal History & CSV Export Engine
> **Prompt:**  
> *"Expand the telemetry analytics section to support dual modes: real-time streaming and a 24-hour diurnal history showing daytime heat curves, solar evaporation, and morning/evening irrigation spikes. In addition, build a zero-dependency client-side CSV export function that generates downloadable timestamped CSV files containing multi-zone moisture readings, weather parameters, actuator states, and cumulative water consumption."*  
>  
> **Explanation & Outcome:**  
> This prompt delivered enterprise data management capabilities. Presenters and evaluators can switch between live and historical views, and export empirical CSV data without external server dependencies.

#### Prompt 4: Comprehensive Automated Test Suite (31 Assertions)
> **Prompt:**  
> *"Upgrade the standalone test harness `test-runner.js` to execute 31 automated assertions in Node.js. Cover rubric test cases 1-5, multi-zone independent actuation, boundary value analysis at 29.9% and 30.0%, manual override isolation, sensor fault trip fail-safes, rain infiltration, time-window scheduling, water accumulation integrals, and CSV formatting."*  
>  
> **Explanation & Outcome:**  
> This prompt generated a rigorous, automated verification suite that validated the entire platform with a 100% pass rate prior to deployment.

---

## 3. Results & System Demonstration

### 3.1 Rubric Test Case Verification Matrix

The platform was evaluated against the university assessment rubric and boundary conditions:

| Test Case | Zone / Context | Ingested Moisture | Target Threshold | Actuator State | UI Feedback Observed | Result |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Test 1** | Zone 1 (Orchard) | **15%** | 30% | **PUMP ON** | Red circular gauge, spinning turbine, water ripples active, flow accumulating | **PASS** |
| **Test 2** | Zone 1 (Orchard) | **25%** | 30% | **PUMP ON** | Amber gauge, pump energized, alert logged | **PASS** |
| **Test 3** | Zone 1 (Orchard) | **30%** | 30% | **PUMP OFF** | Standby badge, turbine halted, relay open (Exact Boundary Value) | **PASS** |
| **Test 4** | Zone 1 (Orchard) | **45%** | 30% | **PUMP OFF** | Emerald optimal gauge, pump standby | **PASS** |
| **Test 5** | Zone 1 (Orchard) | **80%** | 30% | **PUMP OFF** | Cyan saturated gauge, pump standby | **PASS** |
| **Boundary** | Zone 1 (Orchard) | **29.9%** | 30% | **PUMP ON** | Boundary just below threshold correctly activates pump | **PASS** |
| **Boundary** | Zone 1 (Orchard) | **30.1%** | 30% | **PUMP OFF** | Boundary just above threshold correctly deactivates pump | **PASS** |
| **Multi-Zone** | Zone 1, 2, 3 | 20%, 40%, 42% | 30%, 35%, 45% | **Z1: ON, Z2: OFF, Z3: ON** | Independent actuation verified across all 3 zones | **PASS** |
| **Fail-Safe** | Zone 1 (Sensor Fault) | Disconnected | 30% | **PUMP OFF (Halted)** | Safety interlock halts pump; CRITICAL alert logged | **PASS** |
| **Weather** | Outdoor vs Greenhouse | Rain 30 mm/h | - | **Infiltration Active** | Zone 1 & 2 moisture increases; Zone 3 sheltered | **PASS** |

### 3.2 Automated Test Runner Output
Executing `node test-runner.js` in the terminal outputs:
```
================================================================
   SmartFarm IoT - Enterprise Multi-Zone Verification Suite     
   Course: ITEC 310 (Internet of Things) | Amity University     
   Authors: Aryan Kumar, Vinayak Nair, Kalidasan Udayakumar      
================================================================
TOTAL TESTS: 68 | PASSED: 68 | FAILED: 0
STATUS: ALL ENTERPRISE IOT DECISION & MULTI-ZONE RULES VERIFIED SUCCESSFULLY!
```

---

## 4. Discussion & Technical Evaluation

### 4.1 Evaluation Against Coursework Objectives
1. **Multi-Zone Architectural Separation:** The implementation of 3 independent zones with dedicated virtual pins, thresholds, and actuators satisfies real-world agricultural requirements where different crop types possess distinct soil moisture saturation limits.
2. **Farmer Control Dashboard (User-Centred Design):** Designed specifically for operational agriculturalists, providing high-contrast large numerical displays, playful vegetable iconography (Potato 🥔, Tomato 🍅, Brinjal 🍆), independent Start/Stop pump buttons with operator confirmation modals, and real-time alerts.
3. **MQTT Communication Centre:** Clear demonstration of the 5 pillars of MQTT (Publisher, Broker, Subscriber, Topic, and Payload). Telemetry schemas for soil moisture (`smartfarm/zone01/soil/moisture`) and pump status (`smartfarm/zone01/pump/status`) follow standardized JSON formatting and QoS 1 delivery semantics.
4. **Multi-Hop Mesh Topology vs Star Topology:** An illustrated agricultural environment featuring three distinct botanical crop plots (Zone 1: Potato 🥔, Zone 2: Tomato 🍅, and Zone 3: Brinjal 🍆, each arranged in clean rows and columns with 10+ botanical plants), alongside a dedicated Livestock & Poultry yard (Pig Farm and Chicken Farm) and an avenue of pathway trees. The simulation models physical obstructions (concrete storage barn and dense tree foliage) causing direct Star topology signals to suffer 100% packet drop. It then demonstrates cooperative 2-hop mesh routing via intermediate pole-mounted relay nodes, achieving 100% packet delivery to the central IoT gateway.
5. **Dual Data & Control Flows:** Rigorous breakdown of upstream data collection (Physical Transducer → Microcontroller ADC → Wireless Relay → Gateway → MQTT Broker → Subscriber → Dashboard) alongside the reverse downstream control path (Farmer Click → Dashboard Logic → Broker Dispatch → Gateway Forwarding → Relay Node → Pump Relay Energization).
6. **Local Edge vs Remote Cloud Trade-Offs:** Explains how local edge deployment guarantees autonomous off-grid operation (5ms latency) without internet dependencies, whereas remote cloud deployment enables centralized telemetry monitoring at the cost of cloud broker reliance and wide-area latency (140ms).
7. **Resilience & Offline Guarantee:** The platform functions 100% offline. If the university lab lacks internet connectivity and Chart.js cannot be reached, the custom 2D Canvas fallback engine renders graphs cleanly without throwing fatal errors.
8. **Safety Engineering:** The fail-safe interlock prevents runaway water dispensation when sensor communications are severed, illustrating industrial fail-safe principles.
9. **Data Portability:** The client-side CSV generator enables direct data export for agricultural auditability without requiring a cloud backend.

---

## 5. Conclusion

The upgraded **SmartFarm IoT Enterprise** platform provides an advanced, polished demonstration of Internet of Things concepts for the **ITEC 310** curriculum. By combining multi-zone sensing, realistic weather feedback loops, fail-safe actuator protection, a friendly Farmer Control Centre, an interactive MQTT and Multi-Hop Network Learning Centre, and an interactive 4-layer architecture explorer, the project bridges the gap between academic theory and commercial smart agriculture implementations.

Through the strategic use of **Google Antigravity**, the development cycle was executed systematically from planning and modular architecture to comprehensive automated testing (68 passing tests) and enterprise UI/UX polishing.

---

## 6. References (APA Format)

- Amity University Dubai. (2026). *ITEC 310: Internet of Things — Course Handbook & Assessment Remit*. School of Engineering, Architecture and Interior Design.
- Alrahhal, M. (2026). *IoT Sensor Networks, Actuators, and Embedded Control Systems*. Lecture notes, Amity University Dubai.
- Chart.js Contributors. (2024). *Chart.js: Open source HTML5 Charts for most modern web browsers* (Version 4.4.1). https://www.chartjs.org/
- MDN Web Docs. (2024). *Window: localStorage property and HTML5 Canvas API documentation*. Mozilla Corporation. https://developer.mozilla.org/
- World Meteorological Organization. (2023). *Smart Agriculture and IoT-Driven Water Conservation Practices*. WMO Technical Publications.
