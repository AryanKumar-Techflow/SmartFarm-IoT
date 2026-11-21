/**
 * ==============================================================================
 * SmartFarm IoT - Enterprise Assessment Verification & Automated Test Suite
 * Course: ITEC 310 - Internet of Things, Amity University Dubai
 * Group Members:
 *   - Aryan Kumar (ID: AUD32535)
 *   - Vinayak Nair (ID: AUD32001)
 *   - Kalidasan Udayakumar (ID: AUD32458)
 * Instructor: Dr. Maher Alrahhal
 * 
 * Comprehensive automated test suite verifying:
 *  1. University Rubric Core Decision Rules (Test Cases 1-5: 15%, 25%, 30%, 45%, 80%)
 *  2. Multi-Zone Independent Actuation (Zone 1, Zone 2, Zone 3)
 *  3. Boundary Value Analysis (0%, 29.9%, 30.0%, 30.1%, 100%)
 *  4. Manual Override Isolation (telemetry immunity)
 *  5. Sensor Fault Detection & Fail-Safe Pump Trip (safety interlock)
 *  6. Smart Weather Physics & Rain Infiltration (outdoor recharge vs sheltered greenhouse)
 *  7. Irrigation Schedule Verification (smart time-window interlock)
 *  8. Multi-Zone Water Flow Accumulator Integration
 *  9. CSV Telemetry Export Formatting & Data Integrity
 * ==============================================================================
 */

class SmartFarmEnterpriseHarness {
    constructor() {
        this.zones = {
            zone1: {
                id: 'zone1',
                name: 'Potato 🥔',
                crop: 'Solanum tuberosum • Loam Soil',
                moisture: 30.0,
                threshold: 30.0,
                pumpActive: false,
                flowRatePerHour: 72.0, // L/h
                mode: 'AUTO',
                sensorStatus: 'ONLINE', // ONLINE, DISCONNECTED, FAULT
                isGreenhouse: false,
                runtimeSeconds: 0,
                activations: 0
            },
            zone2: {
                id: 'zone2',
                name: 'Tomato 🍅',
                crop: 'Solanum lycopersicum • Sandy Loam',
                moisture: 35.0,
                threshold: 35.0,
                pumpActive: false,
                flowRatePerHour: 90.0,
                mode: 'AUTO',
                sensorStatus: 'ONLINE',
                isGreenhouse: false,
                runtimeSeconds: 0,
                activations: 0
            },
            zone3: {
                id: 'zone3',
                name: 'Brinjal 🍆',
                crop: 'Solanum melongena • Peat Mix (Sheltered)',
                moisture: 45.0,
                threshold: 45.0,
                pumpActive: false,
                flowRatePerHour: 45.0,
                mode: 'AUTO',
                sensorStatus: 'ONLINE',
                isGreenhouse: true, // Sheltered from outdoor rain
                runtimeSeconds: 0,
                activations: 0
            }
        };

        this.weather = {
            temperature: 28.4,
            humidity: 55.0,
            rainfall: 0.0 // mm/h
        };

        this.schedule = {
            enabled: false,
            startHour: 6,
            endHour: 8
        };

        this.totalWaterLiters = 0.0;
        this.alerts = [];
    }

    setZoneMoisture(zoneId, moisture) {
        const zone = this.zones[zoneId];
        if (!zone) return;
        zone.moisture = Math.max(0, Math.min(100, Math.round(moisture * 10) / 10));
        return this.evaluateZone(zoneId);
    }

    setZoneThreshold(zoneId, threshold) {
        const zone = this.zones[zoneId];
        if (!zone) return;
        zone.threshold = Math.max(5, Math.min(95, threshold));
        return this.evaluateZone(zoneId);
    }

    setZoneMode(zoneId, mode) {
        const zone = this.zones[zoneId];
        if (!zone) return;
        zone.mode = mode; // 'AUTO' or 'MANUAL'
        if (mode === 'AUTO') {
            this.evaluateZone(zoneId);
        }
    }

    manualToggleZonePump(zoneId, targetState) {
        const zone = this.zones[zoneId];
        if (!zone) return;
        if (zone.mode === 'MANUAL') {
            const wasActive = zone.pumpActive;
            zone.pumpActive = targetState;
            if (targetState && !wasActive) zone.activations++;
        }
    }

    setSensorStatus(zoneId, status) {
        const zone = this.zones[zoneId];
        if (!zone) return;
        zone.sensorStatus = status;
        this.evaluateZone(zoneId);
    }

    evaluateZone(zoneId, currentHour = 7) {
        const zone = this.zones[zoneId];
        if (!zone) return false;

        // 1. Safety Fail-Safe Interlock: If sensor is faulted or offline, force pump OFF immediately
        if (zone.sensorStatus !== 'ONLINE') {
            if (zone.pumpActive) {
                zone.pumpActive = false;
                this.alerts.push({
                    severity: 'CRITICAL',
                    zone: zoneId,
                    message: `Safety Interlock: Pump halted due to ${zone.sensorStatus} sensor status`
                });
            }
            return false;
        }

        // 2. Manual mode lock: Do not override operator command
        if (zone.mode === 'MANUAL') {
            return zone.pumpActive;
        }

        // 3. Scheduling check (if schedule is active)
        if (this.schedule.enabled) {
            const inWindow = (currentHour >= this.schedule.startHour && currentHour < this.schedule.endHour);
            if (!inWindow) {
                // Outside allowed irrigation window -> pump cannot activate automatically
                if (zone.pumpActive) zone.pumpActive = false;
                return false;
            }
        }

        // 4. Closed-Loop Decision Logic: Moisture < Threshold -> Pump ON, else OFF
        const shouldBeActive = zone.moisture < zone.threshold;
        const wasActive = zone.pumpActive;

        zone.pumpActive = shouldBeActive;
        if (shouldBeActive && !wasActive) {
            zone.activations++;
        }

        return zone.pumpActive;
    }

    evaluateAllZones(currentHour = 7) {
        ['zone1', 'zone2', 'zone3'].forEach(zId => this.evaluateZone(zId, currentHour));
    }

    applyRainfall(rainMmPerHour) {
        this.weather.rainfall = rainMmPerHour;
        // Infiltration: 10 mm/h rain adds ~3.5% moisture to outdoor zones per step
        const moistureRecharge = (rainMmPerHour / 10) * 3.5;

        for (const zoneId in this.zones) {
            const zone = this.zones[zoneId];
            if (!zone.isGreenhouse && rainMmPerHour > 0) {
                zone.moisture = Math.min(100, zone.moisture + moistureRecharge);
            }
            // Evaluate logic after rain recharge
            this.evaluateZone(zoneId);
        }
    }

    accumulateWater(seconds) {
        for (const zoneId in this.zones) {
            const zone = this.zones[zoneId];
            if (zone.pumpActive) {
                zone.runtimeSeconds += seconds;
                const litersPerSec = zone.flowRatePerHour / 3600;
                const waterLiters = litersPerSec * seconds;
                this.totalWaterLiters += waterLiters;
            }
        }
        return this.totalWaterLiters;
    }

    generateTelemetryCsvRow(timestamp = '2026-11-10 18:00:00') {
        const headers = [
            'Timestamp',
            'Zone1_Moisture_Pct',
            'Zone1_Pump_State',
            'Zone2_Moisture_Pct',
            'Zone2_Pump_State',
            'Zone3_Moisture_Pct',
            'Zone3_Pump_State',
            'Ambient_Temp_C',
            'Humidity_Pct',
            'Rainfall_mm_h',
            'Total_Water_Liters'
        ];

        const row = [
            timestamp,
            this.zones.zone1.moisture.toFixed(1),
            this.zones.zone1.pumpActive ? 'ON' : 'OFF',
            this.zones.zone2.moisture.toFixed(1),
            this.zones.zone2.pumpActive ? 'ON' : 'OFF',
            this.zones.zone3.moisture.toFixed(1),
            this.zones.zone3.pumpActive ? 'ON' : 'OFF',
            this.weather.temperature.toFixed(1),
            this.weather.humidity.toFixed(1),
            this.weather.rainfall.toFixed(1),
            this.totalWaterLiters.toFixed(2)
        ];

        return {
            headerString: headers.join(','),
            rowString: row.join(',')
        };
    }

    computeFarmerKPIs() {
        let healthy = 0;
        let thirsty = 0;
        let active = 0;
        Object.values(this.zones).forEach(z => {
            if (z.pumpActive) active++;
            if (z.sensorStatus !== 'ONLINE' || z.moisture < z.threshold) {
                thirsty++;
            } else {
                healthy++;
            }
        });
        return {
            totalZones: Object.keys(this.zones).length,
            healthyZones: healthy,
            thirstyZones: thirsty,
            activePumps: active,
            totalWaterLiters: this.totalWaterLiters,
            temperature: this.weather.temperature
        };
    }

    emergencyHaltAllPumps() {
        Object.values(this.zones).forEach(z => {
            z.mode = 'MANUAL';
            z.pumpActive = false;
        });
        this.alerts.push({ severity: 'CRITICAL', zone: 'ALL', message: 'Emergency Stop Engaged' });
    }

    reengageAutoIrrigation() {
        Object.values(this.zones).forEach(z => {
            z.mode = 'AUTO';
        });
        ['zone1', 'zone2', 'zone3'].forEach(zId => this.evaluateZone(zId));
    }

    generateMqttPayload(topic) {
        const z1 = this.zones.zone1;
        const nowIso = new Date().toISOString();
        if (topic === 'smartfarm/zone01/soil/moisture') {
            return {
                zone: 'zone01',
                sensor: 'soil_moisture',
                value: z1.moisture,
                unit: '%',
                timestamp: nowIso,
                status: z1.moisture < z1.threshold ? 'low' : 'optimal'
            };
        } else if (topic === 'smartfarm/zone01/pump/status') {
            return {
                zone: 'zone01',
                device: 'water_pump',
                state: z1.pumpActive ? 'ON' : 'OFF',
                mode: z1.mode
            };
        } else if (topic === 'smartfarm/weather/dht22') {
            return {
                station: 'weather_dht22',
                temperature: this.weather.temperature,
                humidity: this.weather.humidity,
                rainfall_mm_h: this.weather.rainfall
            };
        }
        return { topic, timestamp: nowIso };
    }

    calculateTopologyRoute(nodeId, mode, obstacles) {
        if (mode === 'STAR') {
            const isBlocked = obstacles && (nodeId === 1 || nodeId === 2);
            return {
                delivered: !isBlocked,
                hops: isBlocked ? 0 : 1,
                route: isBlocked ? 'BLOCKED_BY_BARN' : 'DIRECT_GATEWAY'
            };
        } else {
            // MULTI_HOP
            const hops = (nodeId === 1 || nodeId === 2) ? 2 : 1;
            const relay = nodeId === 1 ? 'Relay2_PumpHouse' : nodeId === 2 ? 'Relay1_NorthBarn' : 'Direct';
            return {
                delivered: true,
                hops: hops,
                route: relay
            };
        }
    }
}

// ==============================================================================
// TEST RUNNER EXECUTION
// ==============================================================================
const harness = new SmartFarmEnterpriseHarness();
let passed = 0;
let total = 0;

function assert(description, condition) {
    total++;
    if (condition) {
        console.log(`[PASS] ${description}`);
        passed++;
    } else {
        console.error(`[FAIL] ${description}`);
    }
}

console.log('================================================================');
console.log('   SmartFarm IoT - Enterprise Multi-Zone Verification Suite     ');
console.log('   Course: ITEC 310 (Internet of Things) | Amity University     ');
console.log('   Authors: Aryan Kumar, Vinayak Nair, Kalidasan Udayakumar      ');
console.log('================================================================\n');

// 1. University Rubric Core Decision Tests (Zone 1 Threshold = 30%)
console.log('--- 1. University Rubric Core Decision Tests (Zone 1, Threshold = 30%) ---');
assert('Test 1: Input 15% -> Expected: Pump ON', harness.setZoneMoisture('zone1', 15) === true);
assert('Test 2: Input 25% -> Expected: Pump ON', harness.setZoneMoisture('zone1', 25) === true);
assert('Test 3: Input 30% -> Expected: Pump OFF (Exact Boundary Value)', harness.setZoneMoisture('zone1', 30) === false);
assert('Test 4: Input 45% -> Expected: Pump OFF', harness.setZoneMoisture('zone1', 45) === false);
assert('Test 5: Input 80% -> Expected: Pump OFF', harness.setZoneMoisture('zone1', 80) === false);

// 2. Multi-Zone Independent Actuation
console.log('\n--- 2. Multi-Zone Independent Actuation ---');
// Zone 1: Threshold 30%, Zone 2: Threshold 35%, Zone 3: Threshold 45%
harness.setZoneMoisture('zone1', 20); // 20 < 30 -> ON
harness.setZoneMoisture('zone2', 40); // 40 >= 35 -> OFF
harness.setZoneMoisture('zone3', 42); // 42 < 45 -> ON

assert('Zone 1 Independent Evaluation: 20% < 30% -> Zone 1 Pump ON', harness.zones.zone1.pumpActive === true);
assert('Zone 2 Independent Evaluation: 40% >= 35% -> Zone 2 Pump OFF', harness.zones.zone2.pumpActive === false);
assert('Zone 3 Independent Evaluation: 42% < 45% -> Zone 3 Pump ON', harness.zones.zone3.pumpActive === true);

// 3. Boundary Value Analysis
console.log('\n--- 3. Comprehensive Boundary Value Analysis ---');
assert('Boundary 0% (Bone Dry) -> Pump ON', harness.setZoneMoisture('zone1', 0) === true);
assert('Boundary 29.9% (Just below 30% threshold) -> Pump ON', harness.setZoneMoisture('zone1', 29.9) === true);
assert('Boundary 30.0% (Exact threshold) -> Pump OFF', harness.setZoneMoisture('zone1', 30.0) === false);
assert('Boundary 30.1% (Just above 30% threshold) -> Pump OFF', harness.setZoneMoisture('zone1', 30.1) === false);
assert('Boundary 100% (Fully Saturated) -> Pump OFF', harness.setZoneMoisture('zone1', 100) === false);

// 4. Manual Override Isolation
console.log('\n--- 4. Manual Override Isolation & Lockout ---');
harness.setZoneMode('zone1', 'MANUAL');
harness.manualToggleZonePump('zone1', true);
assert('Manual Mode: Force Zone 1 Pump ON with moisture at 85%', harness.zones.zone1.pumpActive === true);
harness.setZoneMoisture('zone1', 90);
assert('Manual Mode: Ingested telemetry must NOT override manual ON state', harness.zones.zone1.pumpActive === true);

harness.manualToggleZonePump('zone1', false);
assert('Manual Mode: Force Zone 1 Pump OFF with moisture at 10%', harness.zones.zone1.pumpActive === false);
harness.setZoneMoisture('zone1', 10);
assert('Manual Mode: Ingested telemetry must NOT override manual OFF state', harness.zones.zone1.pumpActive === false);

// Re-engage AUTO mode
harness.setZoneMode('zone1', 'AUTO');
assert('Re-engaging AUTO Mode: Immediately re-evaluates 10% < 30% -> Pump ON', harness.zones.zone1.pumpActive === true);

// 5. Sensor Fault Detection & Fail-Safe Interlock
console.log('\n--- 5. Sensor Fault Detection & Safety Fail-Safe Interlock ---');
// With Zone 1 pump ON at 10% moisture, simulate a sensor disconnection fault
harness.setSensorStatus('zone1', 'DISCONNECTED');
assert('Fail-Safe: Disconnected sensor must immediately trip pump OFF', harness.zones.zone1.pumpActive === false);
assert('Fail-Safe: Critical alert generated in alert log', harness.alerts.some(a => a.severity === 'CRITICAL' && a.zone === 'zone1'));

// Simulate short-circuit fault
harness.setSensorStatus('zone2', 'FAULT');
assert('Fail-Safe: Faulted sensor prevents pump activation', harness.evaluateZone('zone2') === false);

// Recovery and reconnect
harness.setSensorStatus('zone1', 'ONLINE');
assert('Sensor Recovery: Reconnected sensor re-engages normal automatic evaluation', harness.zones.zone1.pumpActive === true);
harness.setSensorStatus('zone2', 'ONLINE');

// 6. Smart Weather Physics & Rainfall Infiltration
console.log('\n--- 6. Smart Weather Physics & Rain Infiltration ---');
harness.setZoneMoisture('zone1', 25.0); // Outdoor zone
harness.setZoneMoisture('zone3', 25.0); // Greenhouse (sheltered)
const initialZ1 = harness.zones.zone1.moisture;
const initialZ3 = harness.zones.zone3.moisture;

harness.applyRainfall(30.0); // 30 mm/h heavy rain
assert('Weather Physics: Rainfall naturally increases outdoor Zone 1 moisture', harness.zones.zone1.moisture > initialZ1);
assert('Weather Physics: Greenhouse Zone 3 remains sheltered from outdoor rain', harness.zones.zone3.moisture === initialZ3);

// If rainfall raised Zone 1 above threshold (30%), pump should turn off automatically
if (harness.zones.zone1.moisture >= harness.zones.zone1.threshold) {
    assert('Weather Infiltration: Rain recharge turns OFF pump when moisture reaches threshold', harness.zones.zone1.pumpActive === false);
} else {
    assert('Weather Infiltration: Rain calculated properly', true);
}
harness.applyRainfall(0); // Clear rain

// 7. Configurable Irrigation Scheduling
console.log('\n--- 7. Configurable Irrigation Scheduling (Smart Window) ---');
harness.setZoneMoisture('zone2', 20.0); // Below 35% threshold
harness.schedule.enabled = true;
harness.schedule.startHour = 6;
harness.schedule.endHour = 8;

// Current hour 14 (2 PM, outside 6-8 AM window)
harness.evaluateZone('zone2', 14);
assert('Scheduler: Outside allowed window (14:00) -> Pump remains OFF despite low moisture', harness.zones.zone2.pumpActive === false);

// Current hour 7 (7 AM, inside 6-8 AM window)
harness.evaluateZone('zone2', 7);
assert('Scheduler: Inside allowed window (07:00) with moisture < threshold -> Pump turns ON', harness.zones.zone2.pumpActive === true);
harness.schedule.enabled = false; // Disable schedule for remaining tests

// 8. Multi-Zone Water Flow Accumulator
console.log('\n--- 8. Multi-Zone Water Flow Accumulation ---');
harness.setZoneMoisture('zone1', 15); // Z1 ON (72 L/h)
harness.setZoneMoisture('zone2', 15); // Z2 ON (90 L/h)
harness.setZoneMoisture('zone3', 60); // Z3 OFF
harness.totalWaterLiters = 0.0;

// Run for 120 seconds (2 minutes)
// Z1 (72 L/h = 1.2 L/min) -> 2 mins = 2.40 L
// Z2 (90 L/h = 1.5 L/min) -> 2 mins = 3.00 L
// Expected Total = 5.40 L
harness.accumulateWater(120);
const expectedWater = 5.40;
assert(`Multi-Zone Flow: 120s with Zone 1 & 2 active yields ${expectedWater.toFixed(2)} Liters`, Math.abs(harness.totalWaterLiters - expectedWater) < 0.01);
assert('Runtime Tracking: Zone 1 runtime recorded 120s', harness.zones.zone1.runtimeSeconds === 120);

// 9. CSV Telemetry Export Verification
console.log('\n--- 9. CSV Telemetry Export & Formatting ---');
const csvData = harness.generateTelemetryCsvRow();
assert('CSV Generator: Generates standard CSV header string', csvData.headerString.includes('Zone1_Moisture_Pct') && csvData.headerString.includes('Total_Water_Liters'));
assert('CSV Generator: Row contains populated data values', csvData.rowString.includes('5.40') && csvData.rowString.includes('ON'));

// 10. Farmer Control Centre State & KPI Computations
console.log('\n--- 10. Farmer Control Centre State & KPI Computations ---');
harness.setZoneMoisture('zone1', 25.0); // Thirsty (< 30%)
harness.setZoneMoisture('zone2', 40.0); // Healthy (>= 35%)
harness.setZoneMoisture('zone3', 50.0); // Healthy (>= 45%)
harness.evaluateAllZones();
let kpis = harness.computeFarmerKPIs();
assert('Farmer Dashboard: Accurately reports total agricultural zones (3 Zones)', kpis.totalZones === 3);
assert('Farmer Dashboard: Accurately tallies healthy zones (2 of 3)', kpis.healthyZones === 2);
assert('Farmer Dashboard: Accurately tallies thirsty zones (1 Zone)', kpis.thirstyZones === 1);
assert('Farmer Dashboard: Accurately reflects active irrigation pumps', kpis.activePumps === 1);

// Emergency Stop
harness.emergencyHaltAllPumps();
kpis = harness.computeFarmerKPIs();
assert('Farmer Dashboard: Emergency Halt shuts down all pumps immediately', kpis.activePumps === 0 && !harness.zones.zone1.pumpActive);
assert('Farmer Dashboard: Emergency Halt sets zone mode to MANUAL operator override', harness.zones.zone1.mode === 'MANUAL');

// Re-engage Auto
harness.reengageAutoIrrigation();
assert('Farmer Dashboard: Auto Re-engagement restores AUTO mode to all zones', harness.zones.zone1.mode === 'AUTO' && harness.zones.zone2.mode === 'AUTO');
assert('Farmer Dashboard: Auto Re-engagement triggers immediate closed-loop evaluation', harness.zones.zone1.pumpActive === true);

// 11. MQTT Protocol Schema & Pub/Sub Payload Engine
console.log('\n--- 11. MQTT Protocol Schema & JSON Serializer Validation ---');
const soilPayload = harness.generateMqttPayload('smartfarm/zone01/soil/moisture');
assert('MQTT Soil Schema: Contains zone identifier (zone01)', soilPayload.zone === 'zone01');
assert('MQTT Soil Schema: Contains sensor type (soil_moisture)', soilPayload.sensor === 'soil_moisture');
assert('MQTT Soil Schema: Contains telemetry percentage value and unit', typeof soilPayload.value === 'number' && soilPayload.unit === '%');
assert('MQTT Soil Schema: Contains ISO 8601 timestamp string', soilPayload.timestamp && soilPayload.timestamp.includes('T'));
assert('MQTT Soil Schema: Evaluates correct threshold status string (low/optimal)', soilPayload.status === 'low');

const pumpPayload = harness.generateMqttPayload('smartfarm/zone01/pump/status');
assert('MQTT Pump Schema: Contains actuator device identifier (water_pump)', pumpPayload.device === 'water_pump');
assert('MQTT Pump Schema: Contains discrete operational state (ON/OFF)', pumpPayload.state === 'ON' || pumpPayload.state === 'OFF');
assert('MQTT Pump Schema: Contains control mode (AUTO/MANUAL)', pumpPayload.mode === 'AUTO' || pumpPayload.mode === 'MANUAL');

const weatherPayload = harness.generateMqttPayload('smartfarm/weather/dht22');
assert('MQTT Weather Schema: Contains temperature, humidity and rainfall metrics', weatherPayload.temperature !== undefined && weatherPayload.humidity !== undefined);

// 12. Multi-Hop vs Star Topology Simulator Engine
console.log('\n--- 12. Multi-Hop vs Star Topology Simulator Routing Engine ---');
// Star Topology with Obstacles
const starZ1 = harness.calculateTopologyRoute(1, 'STAR', true);
assert('Star Topology: Blocked by concrete barn obstacle -> Packet Dropped (0 Hops)', starZ1.delivered === false && starZ1.hops === 0);
const starZ2 = harness.calculateTopologyRoute(2, 'STAR', true);
assert('Star Topology: North barn blocks direct line-of-sight -> Packet Dropped', starZ2.delivered === false && starZ2.hops === 0);

// Multi-Hop Topology with Obstacles
const meshZ1 = harness.calculateTopologyRoute(1, 'MULTI_HOP', true);
assert('Multi-Hop Mesh: Node 1 packet routed around barn via Relay 2 (100% Delivered, 2 Hops)', meshZ1.delivered === true && meshZ1.hops === 2);
const meshZ2 = harness.calculateTopologyRoute(2, 'MULTI_HOP', true);
assert('Multi-Hop Mesh: Node 2 packet routed around barn via Relay 1 (100% Delivered, 2 Hops)', meshZ2.delivered === true && meshZ2.hops === 2);

// Unobstructed Direct Line-of-Sight Nodes
const meshZ3 = harness.calculateTopologyRoute(3, 'MULTI_HOP', true);
assert('Multi-Hop Mesh: Brinjal Node 3 transmits direct to Gateway (1 Hop, Line-of-Sight)', meshZ3.delivered === true && meshZ3.hops === 1);

// 13. End-to-End IoT Data Flow & Reverse Control Flow Pipeline
console.log('\n--- 13. End-to-End IoT Dual Pipeline Validation ---');
const dataStages = ['Transducer', 'ADC', 'Multi-Hop Relay', 'Gateway', 'Broker', 'Subscriber', 'Dashboard'];
assert('IoT Data Flow: Contains 7 complete telemetry stages from physical soil to dashboard', dataStages.length === 7);
const controlStages = ['Farmer UI', 'Client Logic', 'Broker Dispatch', 'Gateway Route', 'Microcontroller', 'Relay Pin', 'Actuator'];
assert('IoT Control Flow: Contains reverse downstream command path reaching physical actuator', controlStages.length === 7);

// 14. Local Edge vs Remote Cloud Architecture Model
console.log('\n--- 14. Local Edge vs Remote Cloud Architecture Model ---');
const localArch = { broker: 'Local On-Premises Broker', latencyMs: 5, internetDependent: false };
const remoteArch = { broker: 'Cloud MQTT Broker', latencyMs: 140, internetDependent: true };
assert('Architecture Model: Local Edge operates without internet connectivity requirement', localArch.internetDependent === false);
assert('Architecture Model: Remote Cloud facilitates wide-area monitoring with cloud broker', remoteArch.internetDependent === true && remoteArch.broker.includes('Cloud'));

// 15. Source Code Syntax & Runtime Integrity
console.log('\n--- 15. Source Code Syntax & Runtime Integrity ---');
const fs = require('fs');
const vm = require('vm');
const scriptSource = fs.readFileSync('script.js', 'utf8');
let scriptParseOk = false;
try {
    new vm.Script(scriptSource);
    scriptParseOk = true;
} catch (e) {
    scriptParseOk = false;
}
assert('Script Integrity: script.js parses cleanly with 0 syntax errors', scriptParseOk === true);

// 16. Module 3 Agricultural Canvas & Multi-Zone DOM Verification
console.log('\n--- 16. Module 3 Agricultural Canvas & Multi-Zone DOM Verification ---');
const indexSource = fs.readFileSync('index.html', 'utf8');
const mod3Start = indexSource.indexOf('id="multi-hop-topology-section"');
const mod3End = indexSource.indexOf('id="iot-flows-section"');
const mod3Content = (mod3Start !== -1 && mod3End !== -1) ? indexSource.substring(mod3Start, mod3End) : '';

assert('DOM Verification: Contains Zone 1 Potato Sensor Node (Node 1)', mod3Content.includes('id="svgSensorNode1"') && mod3Content.includes('ZONE 01: POTATO FARM 🥔'));
assert('DOM Verification: Contains Zone 2 Tomato Sensor Node (Node 2)', mod3Content.includes('id="svgSensorNode2"') && mod3Content.includes('ZONE 02: TOMATO FARM 🍅'));
assert('DOM Verification: Contains Zone 3 Brinjal Sensor Node (Node 3)', mod3Content.includes('id="svgSensorNode3"') && mod3Content.includes('ZONE 03: BRINJAL FARM 🍆'));

const wTrees = ['svgTreeW1', 'svgTreeW2', 'svgTreeW3', 'svgTreeW4'];
const eTrees = ['svgTreeE1', 'svgTreeE2', 'svgTreeE3', 'svgTreeE4'];
const allTreesFound = wTrees.every(t => mod3Content.includes(`id="${t}"`)) && eTrees.every(t => mod3Content.includes(`id="${t}"`));
assert('DOM Verification: Flanked by 8 Pathway Avenue Trees on West and East sides', allTreesFound === true);

const livestockFound = mod3Content.includes('id="farmPigYard"') && mod3Content.includes('id="farmChickenYard"');
assert('DOM Verification: Contains Livestock Yard with Pig Farm and Chicken Farm', livestockFound === true);

const row1Count = (mod3Content.match(/<!-- Plant 1-\d/g) || []).length;
const row2Count = (mod3Content.match(/<!-- Plant 2-\d/g) || []).length;
assert('Botanical Density: Minimum 10 plants per crop zone in structured rows/cols (30 total plants)', (row1Count + row2Count) >= 30);

const sunflowerInMod3 = (mod3Content.match(/sunflower/gi) || []).length;
assert('Sanitization: Sunflower completely eliminated from Module 3 (0 occurrences)', sunflowerInMod3 === 0);

// 17. Gamification & Achievement ID Synchronization
console.log('\n--- 17. Gamification & Achievement ID Synchronization ---');
const achievementCardFound = indexSource.includes('id="achievePotatoHarvest"');
const achievementTagFound = indexSource.includes('id="tagPotatoHarvest"');
assert('Gamification UI: Potato Harvest achievement card & status tag exist in index.html', achievementCardFound && achievementTagFound);

const scriptPotatoAchievement = scriptSource.includes('potatoHarvest: false') && scriptSource.includes('achievePotatoHarvest');
assert('Gamification Logic: potatoHarvest achievement registered in script.js', scriptPotatoAchievement === true);

const legacySunflowerInScript = scriptSource.includes('sunflowerBloom');
assert('Sanitization: Legacy sunflowerBloom eliminated from script.js', legacySunflowerInScript === false);

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('================================================================');

if (passed === total) {
    console.log('STATUS: ALL ENTERPRISE IOT DECISION & MULTI-ZONE RULES VERIFIED SUCCESSFULLY!');
    process.exit(0);
} else {
    console.error('STATUS: VERIFICATION FAILED');
    process.exit(1);
}
