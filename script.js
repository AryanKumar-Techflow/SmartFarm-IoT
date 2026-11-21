/**
 * ==============================================================================
 * SmartFarm IoT — Friendly Multi-Zone Platform & Simulation Engine
 * Authors: Aryan Kumar (ID: AUD32535), Vinayak Nair (ID: AUD32001), Kalidasan Udayakumar (ID: AUD32458)
 * Course: ITEC 310 - Internet of Things, Amity University Dubai
 * Instructor: Dr. Maher Alrahhal
 * 
 * System Architecture:
 *   [Simulated Capacitive Probes (A0, A1, A2) + DHT22 + Rain Gauge]
 *                                 ↓
 *                  [IoT Ingestion & Safety Interlock]
 *                                 ↓
 *              [Decision-Making & Irrigation Logic Engine]
 *       ├── Zone 1 (Potato 🥔):    Moisture < 30% ? Pump 1 ON (D4) : OFF
 *       ├── Zone 2 (Tomato 🍅):    Moisture < 35% ? Pump 2 ON (D5) : OFF
 *       └── Zone 3 (Brinjal 🍆):   Moisture < 45% ? Pump 3 ON (D6) : OFF
 *                                 ↓
 *   [Actuators (Virtual Relays D4, D5, D6) & Flow Volume Integrator]
 *                                 ↓
 *    [Sprout Companion, Gamification, Real-Time Analytics & Alert Center]
 * ==============================================================================
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'smartfarm_iot_friendly_v3_settings';
    const ACHIEVEMENTS_KEY = 'smartfarm_iot_friendly_achievements_v3';
    const GAUGE_CIRCUMFERENCE = 364.4; // 2 * Math.PI * 58
    const HEALTH_RING_CIRCUMFERENCE = 213.6; // 2 * Math.PI * 34

    const DEFAULTS = {
        zones: {
            zone1: {
                id: 'zone1',
                name: 'Potato 🥔',
                crop: 'Solanum tuberosum • Loam Soil',
                illustration: 'assets/images/potato.svg',
                pin: 'A0',
                relay: 'D4',
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
                illustration: 'assets/images/tomato.svg',
                pin: 'A1',
                relay: 'D5',
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
                name: 'Brinjal / Eggplant 🍆',
                crop: 'Solanum melongena • Peat Mix (Sheltered)',
                illustration: 'assets/images/eggplant.svg',
                pin: 'A2',
                relay: 'D6',
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
        },
        weather: {
            temperature: 28.4,
            humidity: 55.0,
            rainfall: 0.0, // mm/h
            condition: 'Temperate / Mild'
        },
        schedule: {
            enabled: false,
            startHour: 6,
            endHour: 9
        },
        globalMode: 'AUTO',
        tickInterval: 2500,
        persistenceEnabled: true,
        theme: 'light'
    };

    const FARMING_TIPS = [
        {
            category: 'Soil Permittivity',
            headline: 'Capacitive Moisture Sensing',
            body: 'Capacitive sensors measure soil dielectric permittivity rather than electrical resistance, preventing galvanic probe corrosion and ensuring years of stable readings.'
        },
        {
            category: 'Evapotranspiration',
            headline: 'Thermal Evaporation Index',
            body: 'High ambient temperature combined with vapor saturation deficit accelerates soil moisture depletion. Irrigating in early morning hours saves up to 35% water loss.'
        },
        {
            category: 'Companion Planting',
            headline: 'Potato, Tomato & Brinjal Synergy',
            body: 'Potatoes and tomatoes share beneficial soil mycorrhizae while sheltered greenhouse brinjals flourish in balanced ambient humidity without nutrient competition.'
        },
        {
            category: 'Conservation',
            headline: 'Targeted Drip vs Overhead Spray',
            body: 'Targeted micro-drip emitters deliver water directly to the plant root zone, achieving 94%+ application efficiency with near-zero runoff or weed germination.'
        },
        {
            category: 'Soil Biology',
            headline: 'Peat Moss vs Loam Retention',
            body: 'Greenhouse peat moss mix retains significantly more water than sandy loam but requires careful aeration to prevent root hypoxia during high-humidity cycles.'
        }
    ];

    /**
     * Master SmartFarm Controller
     */
    class SmartFarmFriendlyController {
        constructor() {
            // Deep clone defaults to initialize state
            this.state = JSON.parse(JSON.stringify(DEFAULTS));
            this.state.totalWaterLiters = 0.0;
            this.state.pumpActivations = 0;
            this.state.autoTickerRunning = false;
            this.state.activeSimZone = 'all'; // 'all', 'zone1', 'zone2', 'zone3'
            this.state.chartMode = 'LIVE';    // 'LIVE' or '24H'

            this.history = [];
            this.maxHistoryPoints = 20;
            this.history24h = [];
            this.alerts = [];
            this.alertFilter = 'ALL';

            // Gamification & Tracking
            this.achievements = {
                greenGuardian: false,
                waterSaver: false,
                potatoHarvest: false,
                herbMaster: false,
                quickResponder: false,
                smartFarmer: false
            };
            this.consecutiveHealthyTicks = 0;
            this.lastFaultTime = null;
            this.potatoWasLow = false;
            this.currentTipIndex = 0;
            this.tipTimer = null;

            this.tickerTimer = null;
            this.secondTimer = null;
            this.chartInstance = null;
            this.canvasFallbackMode = false;

            this.init();
        }

        init() {
            this.loadSettings();
            this.loadAchievements();
            this.cacheDom();
            this.generate24HourHistory();
            this.bindEvents();
            this.applyTheme(this.state.theme);
            this.initChart();
            this.startLiveClock();
            this.startRuntimeCounter();
            this.startTipsRotator();

            // Initialize Farmer Control Dashboard and IoT Architecture Academy
            this.initViewModes();
            this.initFarmerDashboard();
            this.initMqttCenter();
            this.initTopologySimulator();
            this.initFlowsSimulator();
            this.initArchComparator();

            // Run initial closed-loop evaluation on all zones
            this.evaluateAllZones(true);
            this.updateWeatherUI();
            this.updateSummaryStrip();
            this.updateSproutMood();
            this.renderAchievementsUI();

            // Initial log entries
            this.logAlert('SYSTEM_BOOT', 'INFO', 'All Zones', 'SmartFarm IoT Friendly Edition online & initialized');
            this.showToast('Welcome to SmartFarm IoT! 🌱 Your farm is online.', 'success');
        }

        /**
         * Cache DOM elements
         */
        cacheDom() {
            this.dom = {
                // Header & Theme
                liveClock: document.getElementById('liveClock'),
                btnThemeToggle: document.getElementById('btnThemeToggle'),
                menuToggle: document.getElementById('menuToggle'),
                sidebar: document.getElementById('sidebar'),
                openSettingsBtn: document.getElementById('openSettingsBtn'),
                toastContainer: document.getElementById('toastContainer'),

                // Welcome Hero Dashboard
                heroGreeting: document.getElementById('heroGreeting'),
                heroDateBadge: document.getElementById('heroDateBadge'),
                heroHealthyZones: document.getElementById('heroHealthyZones'),
                heroAttentionZones: document.getElementById('heroAttentionZones'),
                heroActivePumps: document.getElementById('heroActivePumps'),
                heroPumpsSub: document.getElementById('heroPumpsSub'),
                heroTotalWater: document.getElementById('heroTotalWater'),
                healthScoreRing: document.getElementById('healthScoreRing'),
                healthScoreVal: document.getElementById('healthScoreVal'),
                healthScoreText: document.getElementById('healthScoreText'),

                // Sprout Plant Companion
                sproutCompanionCard: document.getElementById('sproutCompanionCard'),
                sproutCharacterSvg: document.getElementById('sproutCharacterSvg'),
                sproutMoodTag: document.getElementById('sproutMoodTag'),
                sproutMoodLabel: document.getElementById('sproutMoodLabel'),
                sproutSpeechBubble: document.getElementById('sproutSpeechBubble'),
                sproutSweat: document.getElementById('sproutSweat'),
                sproutBloomTop: document.getElementById('sproutBloomTop'),

                // Farming Tips Rotator
                btnTipPrev: document.getElementById('btnTipPrev'),
                btnTipNext: document.getElementById('btnTipNext'),
                tipCategory: document.getElementById('tipCategory'),
                tipHeadline: document.getElementById('tipHeadline'),
                tipBody: document.getElementById('tipBody'),
                tipDots: document.getElementById('tipDots'),

                // Zone Cards & Elements
                cards: {
                    zone1: document.getElementById('cardZone1'),
                    zone2: document.getElementById('cardZone2'),
                    zone3: document.getElementById('cardZone3')
                },
                zoneUi: {
                    zone1: {
                        card: document.getElementById('cardZone1'),
                        moistureDisplay: document.getElementById('z1MoistureDisplay'),
                        gaugeFill: document.getElementById('z1MoistureGaugeFill'),
                        caption: document.getElementById('z1MoistureCaption'),
                        healthBadge: document.getElementById('z1SensorHealthBadge'),
                        pumpBadge: document.getElementById('z1PumpBadge'),
                        thresholdVal: document.getElementById('z1ThresholdVal'),
                        modeDisplay: document.getElementById('z1ModeDisplay'),
                        runtimeDisplay: document.getElementById('z1RuntimeDisplay'),
                        flowDisplay: document.getElementById('z1FlowDisplay'),
                        manualBtn: document.getElementById('z1ManualToggleBtn'),
                        statusNote: document.getElementById('z1StatusNote'),
                        pumpVisual: document.getElementById('z1PumpVisual'),
                        moistureBar: document.getElementById('z1MoistureBar'),
                        moistureProgressText: document.getElementById('z1MoistureProgressText'),
                        thresholdPin: document.getElementById('z1ThresholdPin'),
                        healthIndicator: document.getElementById('z1HealthIndicator'),
                        tempDisplay: document.getElementById('z1TempDisplay'),
                        pipeStream: document.getElementById('z1PipeStream')
                    },
                    zone2: {
                        card: document.getElementById('cardZone2'),
                        moistureDisplay: document.getElementById('z2MoistureDisplay'),
                        gaugeFill: document.getElementById('z2MoistureGaugeFill'),
                        caption: document.getElementById('z2MoistureCaption'),
                        healthBadge: document.getElementById('z2SensorHealthBadge'),
                        pumpBadge: document.getElementById('z2PumpBadge'),
                        thresholdVal: document.getElementById('z2ThresholdVal'),
                        modeDisplay: document.getElementById('z2ModeDisplay'),
                        runtimeDisplay: document.getElementById('z2RuntimeDisplay'),
                        flowDisplay: document.getElementById('z2FlowDisplay'),
                        manualBtn: document.getElementById('z2ManualToggleBtn'),
                        statusNote: document.getElementById('z2StatusNote'),
                        pumpVisual: document.getElementById('z2PumpVisual'),
                        moistureBar: document.getElementById('z2MoistureBar'),
                        moistureProgressText: document.getElementById('z2MoistureProgressText'),
                        thresholdPin: document.getElementById('z2ThresholdPin'),
                        healthIndicator: document.getElementById('z2HealthIndicator'),
                        tempDisplay: document.getElementById('z2TempDisplay'),
                        pipeStream: document.getElementById('z2PipeStream')
                    },
                    zone3: {
                        card: document.getElementById('cardZone3'),
                        moistureDisplay: document.getElementById('z3MoistureDisplay'),
                        gaugeFill: document.getElementById('z3MoistureGaugeFill'),
                        caption: document.getElementById('z3MoistureCaption'),
                        healthBadge: document.getElementById('z3SensorHealthBadge'),
                        pumpBadge: document.getElementById('z3PumpBadge'),
                        thresholdVal: document.getElementById('z3ThresholdVal'),
                        modeDisplay: document.getElementById('z3ModeDisplay'),
                        runtimeDisplay: document.getElementById('z3RuntimeDisplay'),
                        flowDisplay: document.getElementById('z3FlowDisplay'),
                        manualBtn: document.getElementById('z3ManualToggleBtn'),
                        statusNote: document.getElementById('z3StatusNote'),
                        pumpVisual: document.getElementById('z3PumpVisual'),
                        moistureBar: document.getElementById('z3MoistureBar'),
                        moistureProgressText: document.getElementById('z3MoistureProgressText'),
                        thresholdPin: document.getElementById('z3ThresholdPin'),
                        healthIndicator: document.getElementById('z3HealthIndicator'),
                        tempDisplay: document.getElementById('z3TempDisplay'),
                        pipeStream: document.getElementById('z3PipeStream')
                    }
                },

                // Farm Overview Glance Strip
                glance: {
                    z1: {
                        health: document.getElementById('glanceHealthZ1'),
                        moist: document.getElementById('glanceMoistZ1'),
                        temp: document.getElementById('glanceTempZ1')
                    },
                    z2: {
                        health: document.getElementById('glanceHealthZ2'),
                        moist: document.getElementById('glanceMoistZ2'),
                        temp: document.getElementById('glanceTempZ2')
                    },
                    z3: {
                        health: document.getElementById('glanceHealthZ3'),
                        moist: document.getElementById('glanceMoistZ3'),
                        temp: document.getElementById('glanceTempZ3')
                    }
                },

                // Animated Irrigation Modal Elements
                irrigationModal: {
                    overlay: document.getElementById('irrigationModalOverlay'),
                    card: document.getElementById('irrigationModalCard'),
                    closeBtn: document.getElementById('closeIrrigationModalBtn'),
                    zoneTitle: document.getElementById('modalZoneTitle'),
                    cropSubtitle: document.getElementById('modalCropSubtitle'),
                    plantImg: document.getElementById('modalPlantImg'),
                    plantWrap: document.getElementById('modalPlantWrap'),
                    pumpStatusPill: document.getElementById('modalPumpStatusPill'),
                    pumpStatusText: document.getElementById('modalPumpStatusText'),
                    durationVal: document.getElementById('modalDurationVal'),
                    waterVal: document.getElementById('modalWaterVal'),
                    flowVal: document.getElementById('modalFlowVal'),
                    stopPumpBtn: document.getElementById('modalStopPumpBtn'),
                    minimizeBtn: document.getElementById('modalMinimizeBtn')
                },

                // Irrigation Control Hub
                hubModeTag: document.getElementById('hubModeTag'),
                masterPumpToggle: document.getElementById('masterPumpToggle'),
                masterSwitchSubtext: document.getElementById('masterSwitchSubtext'),
                dropletsStage: document.getElementById('dropletsStage'),
                hubTotalWaterDisplay: document.getElementById('hubTotalWaterDisplay'),
                hubEfficiencyDisplay: document.getElementById('hubEfficiencyDisplay'),
                hubCyclesDisplay: document.getElementById('hubCyclesDisplay'),

                // Weather Station
                weatherConditionBadge: document.getElementById('weatherConditionBadge'),
                weatherConditionText: document.getElementById('weatherConditionText'),
                weatherTempC: document.getElementById('weatherTempC'),
                weatherTempF: document.getElementById('weatherTempF'),
                weatherThermoLevel: document.getElementById('weatherThermoLevel'),
                weatherTempDesc: document.getElementById('weatherTempDesc'),
                weatherHumidity: document.getElementById('weatherHumidity'),
                humidityStatusBadge: document.getElementById('humidityStatusBadge'),
                weatherHumidityDesc: document.getElementById('weatherHumidityDesc'),
                weatherRainfall: document.getElementById('weatherRainfall'),
                weatherRainLevel: document.getElementById('weatherRainLevel'),
                rainStatusBadge: document.getElementById('rainStatusBadge'),
                etRateBadge: document.getElementById('etRateBadge'),
                etCategoryLabel: document.getElementById('etCategoryLabel'),
                wsDrought: document.getElementById('wsDrought'),
                wsOptimal: document.getElementById('wsOptimal'),
                wsRain: document.getElementById('wsRain'),
                btnTriggerRainShower: document.getElementById('btnTriggerRainShower'),

                // Operating Mode
                btnModeAuto: document.getElementById('btnModeAuto'),
                btnModeManual: document.getElementById('btnModeManual'),
                modeExplanation: document.getElementById('modeExplanation'),

                // Simulation Deck
                zonePills: document.querySelectorAll('.zone-pill'),
                sliderTargetZoneLabel: document.getElementById('sliderTargetZoneLabel'),
                soilMoistureSlider: document.getElementById('soilMoistureSlider'),
                soilMoistureInput: document.getElementById('soilMoistureInput'),
                presetButtons: document.querySelectorAll('.btn-preset'),
                btnFaultDisconnect: document.getElementById('btnFaultDisconnect'),
                btnFaultShort: document.getElementById('btnFaultShort'),
                btnFaultRecover: document.getElementById('btnFaultRecover'),
                btnResetSimulation: document.getElementById('btnResetSimulation'),
                btnToggleAutoTicker: document.getElementById('btnToggleAutoTicker'),
                tickerButtonText: document.getElementById('tickerButtonText'),

                // Analytics
                chartCanvas: document.getElementById('telemetryChart'),
                btnChartModeLive: document.getElementById('btnChartModeLive'),
                btnChartMode24h: document.getElementById('btnChartMode24h'),
                btnExportTelemetryCsv: document.getElementById('btnExportTelemetryCsv'),
                chartSamplingInterval: document.getElementById('chartSamplingInterval'),
                chartPointsCount: document.getElementById('chartPointsCount'),
                chartStatusText: document.getElementById('chartStatusText'),
                totalWaterDisplay: document.getElementById('totalWaterDisplay'),
                conservationEfficiency: document.getElementById('conservationEfficiency'),
                efficiencyFill: document.getElementById('efficiencyFill'),
                activationCountDisplay: document.getElementById('activationCountDisplay'),
                dailyProjectionDisplay: document.getElementById('dailyProjectionDisplay'),

                // Alert Center
                alertCountBadge: document.getElementById('alertCountBadge'),
                alertFilterPills: document.querySelectorAll('.filter-pill'),
                eventLogContainer: document.getElementById('eventLogContainer'),
                btnExportAlertsCsv: document.getElementById('btnExportAlertsCsv'),
                btnClearResolvedAlerts: document.getElementById('btnClearResolvedAlerts'),
                btnClearLog: document.getElementById('btnClearLog'),

                // Architecture Explorer
                archLayers: document.querySelectorAll('.arch-layer-card'),
                inspectorLayerBadge: document.getElementById('inspectorLayerBadge'),
                inspectorTitle: document.getElementById('inspectorTitle'),
                inspectorBody: document.getElementById('inspectorBody'),

                // Configuration Form
                settingsForm: document.getElementById('settingsForm'),
                cfgThresholdZ1: document.getElementById('cfgThresholdZ1'),
                cfgThresholdZ2: document.getElementById('cfgThresholdZ2'),
                cfgThresholdZ3: document.getElementById('cfgThresholdZ3'),
                cfgSimInterval: document.getElementById('cfgSimInterval'),
                cfgFlowRateZ1: document.getElementById('cfgFlowRateZ1'),
                cfgPersistenceToggle: document.getElementById('cfgPersistenceToggle'),
                cfgScheduleToggle: document.getElementById('cfgScheduleToggle'),
                cfgScheduleStart: document.getElementById('cfgScheduleStart'),
                cfgScheduleEnd: document.getElementById('cfgScheduleEnd'),
                btnRestoreDefaults: document.getElementById('btnRestoreDefaults')
            };
        }

        /**
         * Event Listeners Binding
         */
        bindEvents() {
            // Theme Toggle
            this.dom.btnThemeToggle.addEventListener('click', () => {
                const nextTheme = this.state.theme === 'light' ? 'dark' : 'light';
                this.applyTheme(nextTheme);
            });

            // Mobile Menu Toggle
            if (this.dom.menuToggle) {
                this.dom.menuToggle.addEventListener('click', () => {
                    this.dom.sidebar.classList.toggle('open');
                });
            }

            // Navigation Links
            document.querySelectorAll('.nav-item').forEach(link => {
                link.addEventListener('click', () => {
                    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    if (window.innerWidth <= 1024) {
                        this.dom.sidebar.classList.remove('open');
                    }
                });
            });

            // Open Settings button scroll
            this.dom.openSettingsBtn.addEventListener('click', () => {
                const target = document.getElementById('settings-section');
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });

            // Sprout Character Interactive Click
            if (this.dom.sproutCompanionCard) {
                this.dom.sproutCompanionCard.addEventListener('click', () => {
                    this.dom.sproutCharacterSvg.classList.add('mood-celebrate');
                    const cuteQuotes = [
                        "I love listening to the soil sensors hum! 🎵",
                        "Did you know potatoes grow cozy underground tubers? 🥔",
                        "Tomatoes and brinjals love soaking in warm garden sunshine! 🍅🍆",
                        "Watering in the early morning keeps our roots cozy! ☀️",
                        "You're doing an amazing job taking care of the farm! 🌱"
                    ];
                    const quote = cuteQuotes[Math.floor(Math.random() * cuteQuotes.length)];
                    this.dom.sproutSpeechBubble.textContent = quote;
                    setTimeout(() => {
                        this.updateSproutMood();
                    }, 2400);
                });
            }

            // Farming Tips Controls
            if (this.dom.btnTipPrev) {
                this.dom.btnTipPrev.addEventListener('click', () => this.prevTip());
            }
            if (this.dom.btnTipNext) {
                this.dom.btnTipNext.addEventListener('click', () => this.nextTip());
            }
            if (this.dom.tipDots) {
                this.dom.tipDots.querySelectorAll('.tip-dot').forEach(dot => {
                    dot.addEventListener('click', () => {
                        const idx = parseInt(dot.getAttribute('data-index'), 10);
                        this.showTip(idx);
                    });
                });
            }

            // Operating Mode: Auto vs Manual
            this.dom.btnModeAuto.addEventListener('click', () => this.setGlobalMode('AUTO'));
            this.dom.btnModeManual.addEventListener('click', () => this.setGlobalMode('MANUAL'));

            // Master Irrigation Lever Toggle (in Irrigation Center)
            if (this.dom.masterPumpToggle) {
                this.dom.masterPumpToggle.addEventListener('change', (e) => {
                    if (this.state.globalMode !== 'MANUAL') return;
                    const turnOn = e.target.checked;
                    ['zone1', 'zone2', 'zone3'].forEach(zId => {
                        this.state.zones[zId].pumpActive = turnOn;
                        if (turnOn) {
                            this.state.zones[zId].activations += 1;
                            this.state.pumpActivations += 1;
                        }
                        this.updateZoneUI(zId);
                    });
                    this.updateSummaryStrip();
                    this.updateSproutMood();
                    if (turnOn) {
                        this.showToast('Master Lever: All virtual pumps started (ON)! 🚿', 'info');
                        this.logAlert('MASTER_PUMP_ON', 'INFO', 'All Zones', 'Master lever engaged: All 3 pumps pumping');
                    } else {
                        this.showToast('Master Lever: All virtual pumps stopped (OFF).', 'info');
                        this.logAlert('MASTER_PUMP_OFF', 'INFO', 'All Zones', 'Master lever disengaged: All pumps idle');
                    }
                });
            }

            // Zone Selection for Simulation Deck
            this.dom.zonePills.forEach(pill => {
                pill.addEventListener('click', () => {
                    this.dom.zonePills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.state.activeSimZone = pill.getAttribute('data-zone');
                    this.updateSliderLabelForTargetZone();
                });
            });

            // Soil Moisture Slider
            this.dom.soilMoistureSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.dom.soilMoistureInput.value = val;
                this.applyMoistureToTarget(val);
            });

            // Soil Moisture Numeric Input
            this.dom.soilMoistureInput.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                val = Math.max(0, Math.min(100, val));
                this.dom.soilMoistureSlider.value = val;
                this.applyMoistureToTarget(val);
            });

            // Rubric Preset Buttons
            this.dom.presetButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.getAttribute('data-val'));
                    this.dom.soilMoistureSlider.value = val;
                    this.dom.soilMoistureInput.value = val;
                    this.applyMoistureToTarget(val);
                    this.showToast(`Test Case: ${val}% Moisture Applied`, 'info');
                });
            });

            // Manual Zone Pump Interactive Buttons
            ['zone1', 'zone2', 'zone3'].forEach(zoneId => {
                const btn = this.dom.zoneUi[zoneId].manualBtn;
                if (btn) {
                    btn.addEventListener('click', () => {
                        this.toggleManualZonePump(zoneId);
                    });
                }
            });

            // Animated Irrigation Control Modal Listeners
            if (this.dom.irrigationModal && this.dom.irrigationModal.stopPumpBtn) {
                this.dom.irrigationModal.stopPumpBtn.addEventListener('click', () => {
                    if (this.activeIrrigationZone) {
                        this.stopManualZonePump(this.activeIrrigationZone);
                    } else {
                        ['zone1', 'zone2', 'zone3'].forEach(zId => {
                            if (this.state.zones[zId].pumpActive) this.stopManualZonePump(zId);
                        });
                        this.closeIrrigationModal();
                    }
                });
            }
            if (this.dom.irrigationModal && this.dom.irrigationModal.closeBtn) {
                this.dom.irrigationModal.closeBtn.addEventListener('click', () => {
                    this.closeIrrigationModal();
                });
            }
            if (this.dom.irrigationModal && this.dom.irrigationModal.minimizeBtn) {
                this.dom.irrigationModal.minimizeBtn.addEventListener('click', () => {
                    this.closeIrrigationModal();
                });
            }
            if (this.dom.irrigationModal && this.dom.irrigationModal.overlay) {
                this.dom.irrigationModal.overlay.addEventListener('click', (e) => {
                    if (e.target === this.dom.irrigationModal.overlay) {
                        this.closeIrrigationModal();
                    }
                });
            }

            // Weather Preset Buttons
            this.dom.wsDrought.addEventListener('click', () => this.applyWeatherPreset(41.0, 22.0, 0.0, 'Arid Heatwave'));
            this.dom.wsOptimal.addEventListener('click', () => this.applyWeatherPreset(26.0, 55.0, 0.0, 'Temperate / Mild'));
            this.dom.wsRain.addEventListener('click', () => this.applyWeatherPreset(21.0, 92.0, 35.0, 'Tropical Downpour'));
            this.dom.btnTriggerRainShower.addEventListener('click', () => this.triggerRainShower());

            // Sensor Fault Injection Buttons
            this.dom.btnFaultDisconnect.addEventListener('click', () => this.injectSensorFault('DISCONNECTED'));
            this.dom.btnFaultShort.addEventListener('click', () => this.injectSensorFault('FAULT'));
            this.dom.btnFaultRecover.addEventListener('click', () => this.recoverSensors());

            // Simulation Deck Controls
            this.dom.btnToggleAutoTicker.addEventListener('click', () => this.toggleAutoTicker());
            this.dom.btnResetSimulation.addEventListener('click', () => this.resetSimulation());

            // Analytics Controls
            this.dom.btnChartModeLive.addEventListener('click', () => this.setChartMode('LIVE'));
            this.dom.btnChartMode24h.addEventListener('click', () => this.setChartMode('24H'));
            this.dom.btnExportTelemetryCsv.addEventListener('click', () => this.exportTelemetryCsv());
            this.dom.btnExportAlertsCsv.addEventListener('click', () => this.exportAlertsCsv());

            // Alert Center Filters & Actions
            this.dom.alertFilterPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    this.dom.alertFilterPills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.alertFilter = pill.getAttribute('data-filter');
                    this.renderAlertsUI();
                });
            });

            this.dom.btnClearResolvedAlerts.addEventListener('click', () => {
                this.alerts = this.alerts.filter(a => !a.resolved);
                this.renderAlertsUI();
                this.showToast('Resolved alerts cleared', 'info');
            });

            this.dom.btnClearLog.addEventListener('click', () => {
                this.alerts = [];
                this.renderAlertsUI();
                this.showToast('Alert feed cleared', 'info');
            });

            // Interactive Architecture Layer Click
            this.dom.archLayers.forEach(layer => {
                layer.addEventListener('click', () => {
                    this.dom.archLayers.forEach(l => l.classList.remove('active'));
                    layer.classList.add('active');
                    const layerKey = layer.getAttribute('data-layer');
                    this.renderArchitectureInspector(layerKey);
                });
            });

            // Settings Form
            this.dom.settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });

            this.dom.btnRestoreDefaults.addEventListener('click', () => this.restoreDefaults());
        }

        // ======================================================================
        // THEME MANAGEMENT
        // ======================================================================
        applyTheme(theme) {
            this.state.theme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            if (this.state.persistenceEnabled) {
                this.saveSettingsToLocalStorage();
            }
            if (this.chartInstance) {
                this.updateChartTheme();
            }
        }

        // ======================================================================
        // CORE CLOSED-LOOP DECISION ENGINE (INDEPENDENT MULTI-ZONE)
        // ======================================================================
        evaluateZone(zoneId, force = false) {
            const zone = this.state.zones[zoneId];
            if (!zone) return;

            const wasActive = zone.pumpActive;

            // 1. Safety Fail-Safe Interlock: Faulted or disconnected sensor
            if (zone.sensorStatus !== 'ONLINE') {
                if (zone.pumpActive) {
                    zone.pumpActive = false;
                    this.logAlert('PUMP_SAFETY_TRIP', 'CRITICAL', zone.name, `Safety Interlock: Virtual pump tripped OFF due to ${zone.sensorStatus} sensor status.`);
                    this.showToast(`Fail-Safe: ${zone.name} pump halted due to sensor fault!`, 'danger');
                }
                this.updateZoneUI(zoneId);
                return;
            }

            // 2. Manual Mode Isolation
            if (zone.mode === 'MANUAL') {
                this.updateZoneUI(zoneId);
                return;
            }

            // 3. Scheduling check
            if (this.state.schedule.enabled) {
                const currentHour = new Date().getHours();
                const inWindow = currentHour >= this.state.schedule.startHour && currentHour < this.state.schedule.endHour;
                if (!inWindow && zone.pumpActive) {
                    zone.pumpActive = false;
                    this.logAlert('SCHEDULE_CUTOFF', 'INFO', zone.name, `Scheduled cutoff: Outside allowed window (${this.state.schedule.startHour}:00 - ${this.state.schedule.endHour}:00).`);
                    this.updateZoneUI(zoneId);
                    return;
                }
            }

            // 4. Closed-Loop Threshold Decision
            const shouldPumpBeOn = zone.moisture < zone.threshold;

            if (shouldPumpBeOn !== wasActive || force) {
                zone.pumpActive = shouldPumpBeOn;

                if (shouldPumpBeOn && !wasActive) {
                    zone.activations += 1;
                    this.state.pumpActivations += 1;
                    this.logAlert('PUMP_ACTIVATED', 'INFO', zone.name, `Auto Trigger: Moisture (${zone.moisture}%) < Threshold (${zone.threshold}%). Relay ${zone.relay} energized.`);
                    this.showToast(`💧 ${zone.name}: Virtual Pump Activated (ON)`, 'info');
                } else if (!shouldPumpBeOn && wasActive) {
                    this.logAlert('PUMP_DEACTIVATED', 'INFO', zone.name, `Auto Cutoff: Moisture (${zone.moisture}%) reached target (${zone.threshold}%). Relay ${zone.relay} de-energized.`);
                    this.showToast(`🌿 ${zone.name}: Moisture Restored (Pump Standby)`, 'success');
                }
            }

            // 5. Critical Moisture Warning (< 15%)
            if (zone.moisture < 15 && zone.sensorStatus === 'ONLINE') {
                if (!zone.lastCritAlertTime || (Date.now() - zone.lastCritAlertTime > 15000)) {
                    zone.lastCritAlertTime = Date.now();
                    this.logAlert('MOISTURE_CRITICAL', 'CRITICAL', zone.name, `Severe root moisture deficit at ${zone.moisture}%.`);
                }
            }

            // Gamification checks
            if (zoneId === 'zone1') {
                if (zone.moisture < 25) this.potatoWasLow = true;
                if (this.potatoWasLow && zone.moisture >= 50) {
                    this.unlockAchievement('potatoHarvest');
                }
            }

            this.updateZoneUI(zoneId);
            if (typeof this.updateFarmerDashboardUI === 'function') {
                this.updateFarmerDashboardUI();
            }
        }

        evaluateAllZones(force = false) {
            ['zone1', 'zone2', 'zone3'].forEach(zId => this.evaluateZone(zId, force));
            this.updateSummaryStrip();
            this.updateSproutMood();
            this.checkAchievements();
            if (typeof this.updateFarmerDashboardUI === 'function') {
                this.updateFarmerDashboardUI();
            }
        }

        /**
         * Update UI for an individual zone card
         */
        updateZoneUI(zoneId) {
            const zone = this.state.zones[zoneId];
            const ui = this.dom.zoneUi[zoneId];
            if (!zone || !ui) return;

            // 1. Moisture & Circular Gauge
            ui.moistureDisplay.textContent = Math.round(zone.moisture);
            const fillRatio = Math.max(0, Math.min(100, zone.moisture)) / 100;
            const offset = GAUGE_CIRCUMFERENCE * (1 - fillRatio);
            ui.gaugeFill.style.strokeDashoffset = offset;

            // Gauge Color & Caption
            if (zone.sensorStatus !== 'ONLINE') {
                ui.gaugeFill.style.stroke = 'var(--color-danger)';
                ui.caption.textContent = zone.sensorStatus === 'DISCONNECTED' ? 'OFFLINE' : 'FAULT';
                ui.caption.style.color = 'var(--color-danger)';
                ui.caption.style.backgroundColor = '#FEE2E2';
            } else if (zone.moisture < zone.threshold) {
                ui.gaugeFill.style.stroke = 'var(--color-danger)';
                ui.caption.textContent = 'Thirsty 💧';
                ui.caption.style.color = 'var(--color-danger)';
                ui.caption.style.backgroundColor = '#FEE2E2';
            } else if (zone.moisture <= 70) {
                ui.gaugeFill.style.stroke = 'var(--primary-green)';
                ui.caption.textContent = 'Thriving ✨';
                ui.caption.style.color = 'var(--primary-green)';
                ui.caption.style.backgroundColor = 'var(--light-green)';
            } else {
                ui.gaugeFill.style.stroke = 'var(--sky-blue-deep)';
                ui.caption.textContent = 'Saturated';
                ui.caption.style.color = 'var(--sky-blue-deep)';
                ui.caption.style.backgroundColor = 'var(--sky-blue-light)';
            }

            // 2. Sensor Health Pill
            ui.healthBadge.className = 'sensor-health-pill';
            if (zone.sensorStatus === 'ONLINE') {
                ui.healthBadge.classList.add('pill-online');
                ui.healthBadge.textContent = `Pin ${zone.pin}: Online`;
            } else if (zone.sensorStatus === 'DISCONNECTED') {
                ui.healthBadge.classList.add('pill-fault');
                ui.healthBadge.textContent = `Pin ${zone.pin}: Disconnected`;
            } else {
                ui.healthBadge.classList.add('pill-fault');
                ui.healthBadge.textContent = `Pin ${zone.pin}: Short-Circuit`;
            }

            // 3. Pump Status & Visual Turbine
            if (zone.pumpActive) {
                ui.pumpBadge.className = 'pump-status-badge badge-on';
                ui.pumpBadge.textContent = 'PUMP ON 🚿';
                ui.pumpVisual.classList.add('pump-active');
            } else {
                ui.pumpBadge.className = 'pump-status-badge badge-off';
                ui.pumpBadge.textContent = 'PUMP OFF';
                ui.pumpVisual.classList.remove('pump-active');
            }

            // 4. Specs
            ui.thresholdVal.textContent = `< ${zone.threshold}%`;
            ui.modeDisplay.textContent = zone.mode;
            ui.flowDisplay.textContent = `${zone.flowRatePerHour} L/h`;

            // 5. Manual button
            if (zone.mode === 'MANUAL') {
                ui.manualBtn.disabled = false;
                ui.manualBtn.classList.remove('btn-outline');
                ui.manualBtn.classList.add('btn-primary');
                if (zone.pumpActive) {
                    ui.manualBtn.textContent = 'Stop Pump (Turn OFF)';
                } else {
                    ui.manualBtn.textContent = 'Start Pump (Turn ON)';
                }
                ui.statusNote.textContent = 'Manual Operator Control Authorized';
            } else {
                ui.manualBtn.disabled = true;
                ui.manualBtn.classList.remove('btn-primary');
                ui.manualBtn.classList.add('btn-outline');
                ui.manualBtn.textContent = 'Manual Override Pump';
                ui.statusNote.textContent = `Auto: Triggers when moisture < ${zone.threshold}%`;
            }
        }

        /**
         * Update Sprout Plant Companion, Hero KPIs & Farm Health Score
         */
        updateSproutMood() {
            const z = this.state.zones;
            let healthyCount = 0;
            let thirstyCount = 0;
            let activePumps = 0;
            let anyFault = false;

            ['zone1', 'zone2', 'zone3'].forEach(zId => {
                const zone = z[zId];
                if (zone.pumpActive) activePumps++;
                if (zone.sensorStatus !== 'ONLINE') {
                    anyFault = true;
                    thirstyCount++;
                } else if (zone.moisture < zone.threshold) {
                    thirstyCount++;
                } else {
                    healthyCount++;
                }
            });

            // Compute overall Farm Vitality Health Score (0-100)
            let score = 100;
            if (anyFault) score -= 30;
            score -= thirstyCount * 12;
            if (this.state.weather.temperature > 38 || this.state.weather.temperature < 18) score -= 8;
            score = Math.max(10, Math.min(100, Math.round(score)));

            // Update Hero Dashboard Badges
            this.dom.heroHealthyZones.textContent = `${healthyCount} of 3`;
            this.dom.heroAttentionZones.textContent = `${thirstyCount} ${thirstyCount === 1 ? 'Zone' : 'Zones'}`;
            this.dom.heroActivePumps.textContent = `${activePumps} of 3`;
            this.dom.heroPumpsSub.textContent = activePumps > 0 ? 'Water flowing' : 'Relays idle';
            this.dom.heroTotalWater.textContent = `${this.state.totalWaterLiters.toFixed(2)} L`;

            // Health Score Ring
            this.dom.healthScoreVal.textContent = score;
            const healthOffset = HEALTH_RING_CIRCUMFERENCE * (1 - (score / 100));
            this.dom.healthScoreRing.style.strokeDashoffset = healthOffset;

            if (score >= 85) {
                this.dom.healthScoreText.textContent = '🌿 Flourishing';
                this.dom.healthScoreText.style.backgroundColor = 'var(--light-green)';
                this.dom.healthScoreText.style.color = 'var(--primary-green)';
                this.dom.healthScoreRing.style.stroke = 'var(--primary-green)';
            } else if (score >= 60) {
                this.dom.healthScoreText.textContent = '⛅ Stable';
                this.dom.healthScoreText.style.backgroundColor = 'var(--sun-yellow-light)';
                this.dom.healthScoreText.style.color = 'var(--sun-yellow-dark)';
                this.dom.healthScoreRing.style.stroke = 'var(--sun-yellow-dark)';
            } else {
                this.dom.healthScoreText.textContent = '⚠️ Needs Care';
                this.dom.healthScoreText.style.backgroundColor = '#FEE2E2';
                this.dom.healthScoreText.style.color = 'var(--color-danger)';
                this.dom.healthScoreRing.style.stroke = 'var(--color-danger)';
            }

            // Dynamic Greeting
            const hr = new Date().getHours();
            let greeting = 'Good morning, Farmer! 🌱';
            if (hr >= 12 && hr < 17) greeting = 'Good afternoon, Farmer! 🌱';
            else if (hr >= 17 || hr < 5) greeting = 'Good evening, Farmer! 🌱';
            this.dom.heroGreeting.textContent = greeting;

            // Sprout Character Reaction
            const svg = this.dom.sproutCharacterSvg;
            svg.classList.remove('mood-happy', 'mood-thirsty', 'mood-watering', 'mood-celebrate');

            if (activePumps > 0) {
                svg.classList.add('mood-watering');
                this.dom.sproutMoodLabel.textContent = 'Watering! 🚿';
                this.dom.sproutSweat.style.opacity = '0';
                this.dom.sproutBloomTop.style.opacity = '0';
                this.dom.sproutSpeechBubble.textContent = "Mmm! Fresh hydration incoming! Our roots are soaking up cool water! 💧";
                this.dom.dropletsStage.classList.add('pumping-active');
            } else if (thirstyCount > 0) {
                svg.classList.add('mood-thirsty');
                this.dom.sproutMoodLabel.textContent = 'Thirsty 💧';
                this.dom.sproutSweat.style.opacity = '1';
                this.dom.sproutBloomTop.style.opacity = '0';
                const thirstyNames = [];
                if (z.zone1.moisture < z.zone1.threshold) thirstyNames.push('Potato 🥔');
                if (z.zone2.moisture < z.zone2.threshold) thirstyNames.push('Tomato 🍅');
                if (z.zone3.moisture < z.zone3.threshold) thirstyNames.push('Brinjal 🍆');
                const target = thirstyNames.length > 0 ? thirstyNames.join(' and ') : 'Our plants';
                this.dom.sproutSpeechBubble.textContent = `Oh dear! ${target} needs some water to stay healthy! 🥀`;
                this.dom.dropletsStage.classList.remove('pumping-active');
            } else {
                if (score >= 90) {
                    svg.classList.add('mood-celebrate');
                    this.dom.sproutMoodLabel.textContent = 'Thriving! ✨';
                    this.dom.sproutBloomTop.style.opacity = '1';
                    this.dom.sproutSpeechBubble.textContent = "All 3 zones are flourishing! You're a natural green-thumb farmer! 🌿✨";
                } else {
                    svg.classList.add('mood-happy');
                    this.dom.sproutMoodLabel.textContent = 'Happy 😊';
                    this.dom.sproutBloomTop.style.opacity = '0';
                    this.dom.sproutSpeechBubble.textContent = "Everything looks lovely today! Soil moisture is well balanced! 🌱";
                }
                this.dom.sproutSweat.style.opacity = '0';
                this.dom.dropletsStage.classList.remove('pumping-active');
            }

            // Irrigation Hub Master Switch State
            if (this.dom.masterPumpToggle) {
                if (this.state.globalMode === 'MANUAL') {
                    this.dom.masterPumpToggle.disabled = false;
                    this.dom.masterPumpToggle.checked = (activePumps === 3);
                    this.dom.masterSwitchSubtext.textContent = 'Toggle master lever to turn all pumps ON or OFF';
                } else {
                    this.dom.masterPumpToggle.disabled = true;
                    this.dom.masterPumpToggle.checked = false;
                    this.dom.masterSwitchSubtext.textContent = 'Switch to Manual mode to activate master lever';
                }
            }

            // Hub Metrics
            this.dom.hubTotalWaterDisplay.textContent = `${this.state.totalWaterLiters.toFixed(2)} L`;
            this.dom.hubCyclesDisplay.textContent = this.state.pumpActivations;
        }

        // ======================================================================
        // ROTATING FARMING TIPS ENGINE
        // ======================================================================
        startTipsRotator() {
            this.showTip(0);
            this.tipTimer = setInterval(() => {
                this.nextTip();
            }, 8500);
        }

        showTip(index) {
            this.currentTipIndex = (index + FARMING_TIPS.length) % FARMING_TIPS.length;
            const tip = FARMING_TIPS[this.currentTipIndex];
            if (!tip) return;

            this.dom.tipCategory.textContent = tip.category;
            this.dom.tipHeadline.textContent = tip.headline;
            this.dom.tipBody.textContent = tip.body;

            if (this.dom.tipDots) {
                this.dom.tipDots.querySelectorAll('.tip-dot').forEach((dot, idx) => {
                    dot.classList.toggle('active', idx === this.currentTipIndex);
                });
            }
        }

        nextTip() {
            this.showTip(this.currentTipIndex + 1);
        }

        prevTip() {
            this.showTip(this.currentTipIndex - 1);
        }

        // ======================================================================
        // GAMIFICATION & ACHIEVEMENTS SYSTEM
        // ======================================================================
        loadAchievements() {
            try {
                const saved = localStorage.getItem(ACHIEVEMENTS_KEY);
                if (saved) {
                    this.achievements = Object.assign(this.achievements, JSON.parse(saved));
                }
            } catch (e) {
                console.warn('Achievements load failed:', e);
            }
        }

        saveAchievements() {
            try {
                localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(this.achievements));
            } catch (e) {
                console.warn('Achievements save failed:', e);
            }
        }

        unlockAchievement(key) {
            if (this.achievements[key]) return;
            this.achievements[key] = true;
            this.saveAchievements();
            this.renderAchievementsUI();

            const names = {
                greenGuardian: 'Green Guardian 🛡️',
                waterSaver: 'Water Saver 💧',
                potatoHarvest: 'Potato Harvest 🥔',
                herbMaster: 'Herb Master 🌿',
                quickResponder: 'Quick Responder ⚡',
                smartFarmer: 'Smart Farmer 🧑‍🌾'
            };
            this.showToast(`🏆 Achievement Unlocked: ${names[key] || key}!`, 'success');
            this.logAlert('ACHIEVEMENT_UNLOCKED', 'INFO', 'Gamification', `Unlocked ${names[key] || key}`);
        }

        checkAchievements() {
            const z = this.state.zones;
            const allHealthy = (z.zone1.moisture >= z.zone1.threshold) &&
                               (z.zone2.moisture >= z.zone2.threshold) &&
                               (z.zone3.moisture >= z.zone3.threshold) &&
                               (z.zone1.sensorStatus === 'ONLINE');

            if (allHealthy) {
                this.consecutiveHealthyTicks++;
                if (this.consecutiveHealthyTicks >= 48) { // ~2 mins of continuous health
                    this.unlockAchievement('greenGuardian');
                }
            } else {
                this.consecutiveHealthyTicks = 0;
            }

            // Water saver check
            if (this.state.totalWaterLiters > 4.0) {
                this.unlockAchievement('waterSaver');
            }

            // Rain check
            if (this.state.weather.rainfall > 20 && z.zone3.isGreenhouse) {
                this.unlockAchievement('herbMaster');
            }
        }

        renderAchievementsUI() {
            const map = [
                { key: 'greenGuardian', card: 'achieveGreenGuardian', tag: 'tagGreenGuardian' },
                { key: 'waterSaver', card: 'achieveWaterSaver', tag: 'tagWaterSaver' },
                { key: 'potatoHarvest', card: 'achievePotatoHarvest', tag: 'tagPotatoHarvest' },
                { key: 'herbMaster', card: 'achieveHerbMaster', tag: 'tagHerbMaster' },
                { key: 'quickResponder', card: 'achieveQuickResponder', tag: 'tagQuickResponder' },
                { key: 'smartFarmer', card: 'achieveSmartFarmer', tag: 'tagSmartFarmer' }
            ];

            map.forEach(item => {
                const cardEl = document.getElementById(item.card);
                const tagEl = document.getElementById(item.tag);
                if (cardEl && tagEl) {
                    if (this.achievements[item.key]) {
                        cardEl.classList.remove('locked');
                        cardEl.classList.add('unlocked');
                        tagEl.textContent = 'Unlocked 🏆';
                    } else {
                        cardEl.classList.add('locked');
                        cardEl.classList.remove('unlocked');
                        tagEl.textContent = 'Locked';
                    }
                }
            });
        }

        // ======================================================================
        // ZONE DETAILS MODAL DIALOG
        // ======================================================================
        showZoneDetails(zoneId) {
            const zone = this.state.zones[zoneId];
            if (!zone) return;

            const modalHtml = `
                <div class="card" style="max-width: 500px; width: 90%; margin: 20px auto; position: relative;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
                        <h3 style="font-size: 1.3rem;">${zone.name} Details</h3>
                        <button id="closeZoneModalBtn" class="btn btn-sm btn-outline" style="border-radius: 9999px;">✕</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap: 8px; font-size: 0.88rem;">
                        <p><strong>Botanical Crop:</strong> ${zone.crop}</p>
                        <p><strong>Sensor Hardware:</strong> Analog Capacitive Probe (Simulated Pin ${zone.pin})</p>
                        <p><strong>Irrigation Actuator:</strong> Submersible Pump Relay (Simulated Pin ${zone.relay})</p>
                        <p><strong>Flow Rating:</strong> ${zone.flowRatePerHour} Liters/hour</p>
                        <p><strong>Current Moisture:</strong> ${zone.moisture.toFixed(1)}%</p>
                        <p><strong>Trigger Threshold:</strong> &lt; ${zone.threshold}% (Pump ON)</p>
                        <p><strong>Active Status:</strong> ${zone.pumpActive ? 'Pumping Water 🚿' : 'Idle Standby'}</p>
                        <p><strong>Total Runtime:</strong> ${zone.runtimeSeconds} seconds (${zone.activations} cycles)</p>
                    </div>
                </div>
            `;

            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'zoneDetailsModalOverlay';
            modalOverlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(20,46,31,0.5); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:9999;';
            modalOverlay.innerHTML = modalHtml;
            document.body.appendChild(modalOverlay);

            const closeBtn = modalOverlay.querySelector('#closeZoneModalBtn');
            const close = () => {
                if (modalOverlay.parentElement) modalOverlay.parentElement.removeChild(modalOverlay);
            };
            closeBtn.addEventListener('click', close);
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) close();
            });
        }

        // ======================================================================
        // OPERATING MODES & MANUAL OVERRIDE
        // ======================================================================
        setGlobalMode(mode) {
            this.state.globalMode = mode;
            ['zone1', 'zone2', 'zone3'].forEach(zId => {
                this.state.zones[zId].mode = mode;
            });

            if (mode === 'AUTO') {
                this.dom.btnModeAuto.classList.add('active', 'btn-primary');
                this.dom.btnModeAuto.classList.remove('btn-outline');
                this.dom.btnModeManual.classList.remove('active', 'btn-primary');
                this.dom.btnModeManual.classList.add('btn-outline');
                this.dom.hubModeTag.textContent = 'AUTO Active';
                this.dom.modeExplanation.innerHTML = `<strong>Automatic Mode Active:</strong> All 3 virtual pumps are governed by closed-loop decision logic (Moisture &lt; Zone Threshold).`;
                this.logAlert('MODE_CHANGE', 'INFO', 'Global', 'Operating mode switched to AUTOMATIC across all zones');
                this.showToast('Operating Mode: AUTOMATIC 🌱', 'info');
                this.evaluateAllZones(true);
            } else {
                this.dom.btnModeAuto.classList.remove('active', 'btn-primary');
                this.dom.btnModeAuto.classList.add('btn-outline');
                this.dom.btnModeManual.classList.add('active', 'btn-primary');
                this.dom.btnModeManual.classList.remove('btn-outline');
                this.dom.hubModeTag.textContent = 'MANUAL Active';
                this.dom.modeExplanation.innerHTML = `<strong>Manual Override Active:</strong> Automatic control is <em>suspended</em>. Direct operator control enabled on individual zone pump buttons.`;
                this.logAlert('MODE_CHANGE', 'WARNING', 'Global', 'Operating mode switched to MANUAL OVERRIDE');
                this.showToast('Operating Mode: MANUAL OVERRIDE ✋', 'info');
                this.unlockAchievement('smartFarmer');
                this.evaluateAllZones();
            }

            if (this.state.persistenceEnabled) {
                this.saveSettingsToLocalStorage();
            }
        }

        toggleManualZonePump(zoneId) {
            const zone = this.state.zones[zoneId];
            if (!zone || zone.mode !== 'MANUAL') return;

            zone.pumpActive = !zone.pumpActive;
            if (zone.pumpActive) {
                zone.activations += 1;
                this.state.pumpActivations += 1;
                this.logAlert('MANUAL_ACTUATION', 'INFO', zone.name, `Manual Override: Operator energized Relay ${zone.relay} (Pump ON)`);
                this.showToast(`${zone.name}: Manually Started 🚿`, 'info');
            } else {
                this.logAlert('MANUAL_ACTUATION', 'INFO', zone.name, `Manual Override: Operator de-energized Relay ${zone.relay} (Pump OFF)`);
                this.showToast(`${zone.name}: Manually Stopped`, 'info');
            }
            this.updateZoneUI(zoneId);
            this.updateSummaryStrip();
            this.updateSproutMood();
            if (typeof this.updateFarmerDashboardUI === 'function') {
                this.updateFarmerDashboardUI();
            }
        }

        // ======================================================================
        // SENSOR SIMULATION & FAULT INJECTION
        // ======================================================================
        applyMoistureToTarget(value) {
            const val = Math.max(0, Math.min(100, Math.round(value * 10) / 10));

            if (this.state.activeSimZone === 'all') {
                ['zone1', 'zone2', 'zone3'].forEach(zId => {
                    this.state.zones[zId].moisture = val;
                    this.evaluateZone(zId);
                });
            } else {
                const zId = this.state.activeSimZone;
                if (this.state.zones[zId]) {
                    this.state.zones[zId].moisture = val;
                    this.evaluateZone(zId);
                }
            }

            this.updateSummaryStrip();
            this.updateSproutMood();
            this.recordTelemetryPoint();
        }

        updateSliderLabelForTargetZone() {
            const map = {
                all: 'Applying to All Zones (0% to 100%)',
                zone1: 'Applying to Zone 1: Potato 🥔',
                zone2: 'Applying to Zone 2: Tomato 🍅',
                zone3: 'Applying to Zone 3: Brinjal 🍆'
            };
            this.dom.sliderTargetZoneLabel.textContent = map[this.state.activeSimZone] || 'Adjust Soil Moisture';
        }

        injectSensorFault(faultType) {
            const targetZone = this.state.activeSimZone === 'all' ? 'zone1' : this.state.activeSimZone;
            const zone = this.state.zones[targetZone];
            if (!zone) return;

            this.lastFaultTime = Date.now();
            zone.sensorStatus = faultType;
            this.logAlert('SENSOR_FAULT_INJECTED', 'CRITICAL', zone.name, `Simulated sensor failure: ${faultType} on Pin ${zone.pin}`);
            this.showToast(`Fault Injected on ${zone.name}: ${faultType}`, 'danger');
            this.evaluateZone(targetZone);
            this.updateSproutMood();
        }

        recoverSensors() {
            if (this.lastFaultTime && (Date.now() - this.lastFaultTime < 30000)) {
                this.unlockAchievement('quickResponder');
            }

            ['zone1', 'zone2', 'zone3'].forEach(zId => {
                this.state.zones[zId].sensorStatus = 'ONLINE';
                this.evaluateZone(zId);
            });
            this.logAlert('SENSOR_RECOVERY', 'INFO', 'All Zones', 'Sensors recalibrated and restored online');
            this.showToast('All Sensors Recalibrated & Restored Online ✅', 'success');
            this.updateSummaryStrip();
            this.updateSproutMood();
        }

        // ======================================================================
        // SMART WEATHER ENGINE & ENVIRONMENTAL PHYSICS
        // ======================================================================
        applyWeatherPreset(temp, humidity, rain, condition) {
            this.state.weather.temperature = temp;
            this.state.weather.humidity = humidity;
            this.state.weather.rainfall = rain;
            this.state.weather.condition = condition;

            // Rainfall infiltrates outdoor zones
            if (rain > 0) {
                const infiltration = (rain / 10) * 3.5;
                ['zone1', 'zone2'].forEach(zId => {
                    const z = this.state.zones[zId];
                    z.moisture = Math.min(100, z.moisture + infiltration);
                    this.evaluateZone(zId);
                });
            }

            this.updateWeatherUI();
            this.updateSummaryStrip();
            this.updateSproutMood();
            this.logAlert('WEATHER_SCENARIO', 'INFO', 'Microclimate', `Weather preset applied: ${condition}`);
            this.showToast(`Weather Scenario: ${condition}`, 'info');
        }

        triggerRainShower() {
            this.applyWeatherPreset(22.0, 85.0, 25.0, 'Simulated Rain Shower');
            this.showToast('🌧️ Rain Shower Event Activated! Outdoor zones recharging.', 'info');
        }

        updateWeatherUI() {
            const w = this.state.weather;
            this.dom.weatherConditionText.textContent = w.condition;
            this.dom.weatherTempC.textContent = w.temperature.toFixed(1);
            const fahrenheit = (w.temperature * 9 / 5) + 32;
            this.dom.weatherTempF.textContent = `${fahrenheit.toFixed(1)} °F`;

            // Thermometer
            const tempPct = Math.max(0, Math.min(100, ((w.temperature - 15) / 30) * 100));
            this.dom.weatherThermoLevel.style.height = `${tempPct}%`;

            // Humidity
            this.dom.weatherHumidity.textContent = Math.round(w.humidity);
            if (w.humidity < 35) {
                this.dom.humidityStatusBadge.textContent = 'Low Humidity (Arid)';
            } else if (w.humidity <= 70) {
                this.dom.humidityStatusBadge.textContent = 'Optimal Humidity';
            } else {
                this.dom.humidityStatusBadge.textContent = 'High Saturation';
            }

            // Rainfall
            this.dom.weatherRainfall.textContent = w.rainfall.toFixed(1);
            if (w.rainfall === 0) {
                this.dom.rainStatusBadge.textContent = 'Dry Spell (0 mm/h)';
            } else if (w.rainfall < 15) {
                this.dom.rainStatusBadge.textContent = 'Light Precipitation';
            } else {
                this.dom.rainStatusBadge.textContent = 'Heavy Rain';
            }

            // Evapotranspiration
            const et = Math.max(0.1, ((w.temperature / 25) * (1 - (w.humidity / 120)) * 2.2));
            this.dom.etRateBadge.textContent = et.toFixed(2);
            if (et < 1.0) {
                this.dom.etCategoryLabel.textContent = 'Low Evaporation';
            } else if (et <= 2.5) {
                this.dom.etCategoryLabel.textContent = 'Moderate Loss';
            } else {
                this.dom.etCategoryLabel.textContent = 'High Loss';
            }
        }

        // ======================================================================
        // AUTOMATED SIMULATION TICKER
        // ======================================================================
        toggleAutoTicker() {
            if (this.state.autoTickerRunning) {
                this.stopAutoTicker();
            } else {
                this.startAutoTicker();
            }
        }

        startAutoTicker() {
            this.state.autoTickerRunning = true;
            this.dom.btnToggleAutoTicker.classList.remove('btn-primary');
            this.dom.btnToggleAutoTicker.classList.add('btn-outline');
            this.dom.tickerButtonText.textContent = 'Pause Auto Simulation';
            this.dom.chartStatusText.textContent = 'Live Auto Ticking';

            this.tickerTimer = setInterval(() => {
                this.simulateEnvironmentalStep();
            }, this.state.tickInterval);

            this.logAlert('SIMULATION_RUN', 'INFO', 'Global', `Automated drift active at ${this.state.tickInterval / 1000}s interval`);
            this.showToast('Automatic Simulation Running ⏳', 'info');
        }

        stopAutoTicker() {
            this.state.autoTickerRunning = false;
            if (this.tickerTimer) {
                clearInterval(this.tickerTimer);
                this.tickerTimer = null;
            }
            this.dom.btnToggleAutoTicker.classList.remove('btn-outline');
            this.dom.btnToggleAutoTicker.classList.add('btn-primary');
            this.dom.tickerButtonText.textContent = 'Start Auto Simulation';
            this.dom.chartStatusText.textContent = 'Manual / Idle';

            this.logAlert('SIMULATION_PAUSE', 'INFO', 'Global', 'Automated simulation paused');
            this.showToast('Simulation Paused', 'info');
        }

        simulateEnvironmentalStep() {
            const w = this.state.weather;

            // Drift
            const tempDelta = (Math.random() - 0.5) * 0.4;
            w.temperature = Math.max(16, Math.min(43, w.temperature + tempDelta));
            const humDelta = (Math.random() - 0.5) * 1.0;
            w.humidity = Math.max(20, Math.min(95, w.humidity + humDelta));

            const evapBase = (w.temperature > 30 ? 1.4 : 0.8) * (1 - (w.humidity / 130));

            ['zone1', 'zone2', 'zone3'].forEach(zId => {
                const zone = this.state.zones[zId];

                if (zone.pumpActive) {
                    const addition = 2.8 + Math.random() * 2.0;
                    zone.moisture = Math.min(98, zone.moisture + addition);
                } else {
                    const drain = evapBase + (Math.random() * 0.4);
                    zone.moisture = Math.max(5, zone.moisture - drain);
                }

                if (w.rainfall > 0 && !zone.isGreenhouse) {
                    const rainInfil = (w.rainfall / 10) * 1.5;
                    zone.moisture = Math.min(100, zone.moisture + rainInfil);
                }

                this.evaluateZone(zId);
            });

            this.updateWeatherUI();
            this.updateSummaryStrip();
            this.updateSproutMood();
            this.checkAchievements();
            this.recordTelemetryPoint();
            if (typeof this.updateFarmerDashboardUI === 'function') {
                this.updateFarmerDashboardUI();
            }
        }

        resetSimulation() {
            if (this.state.autoTickerRunning) {
                this.stopAutoTicker();
            }
            this.state.zones = JSON.parse(JSON.stringify(DEFAULTS.zones));
            this.state.weather = JSON.parse(JSON.stringify(DEFAULTS.weather));
            this.evaluateAllZones(true);
            this.updateWeatherUI();
            this.showToast('Simulation reset to baseline', 'info');
            this.logAlert('SIMULATION_RESET', 'INFO', 'Global', 'Simulation parameters reset.');
        }

        // ======================================================================
        // WATER INTEGRATOR & RUNTIME COUNTERS
        // ======================================================================
        startRuntimeCounter() {
            this.secondTimer = setInterval(() => {
                let anyPumpActive = false;

                ['zone1', 'zone2', 'zone3'].forEach(zId => {
                    const zone = this.state.zones[zId];
                    if (zone.pumpActive) {
                        anyPumpActive = true;
                        zone.runtimeSeconds += 1;
                        const litersPerSec = zone.flowRatePerHour / 3600;
                        this.state.totalWaterLiters += litersPerSec;

                        const s = zone.runtimeSeconds;
                        const hh = String(Math.floor(s / 3600)).padStart(2, '0');
                        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
                        const ss = String(s % 60).padStart(2, '0');
                        this.dom.zoneUi[zId].runtimeDisplay.textContent = `${hh}:${mm}:${ss}`;
                    }
                });

                if (anyPumpActive) {
                    this.updateWaterMetricsUI();
                }
            }, 1000);
        }

        updateWaterMetricsUI() {
            this.dom.totalWaterDisplay.textContent = this.state.totalWaterLiters.toFixed(2);
            this.dom.heroTotalWater.textContent = `${this.state.totalWaterLiters.toFixed(2)} L`;
            this.dom.hubTotalWaterDisplay.textContent = `${this.state.totalWaterLiters.toFixed(2)} L`;
            this.dom.activationCountDisplay.textContent = this.state.pumpActivations;
            this.dom.hubCyclesDisplay.textContent = this.state.pumpActivations;

            const projected = Math.max(12.5, this.state.totalWaterLiters * 1.8 + 14.2);
            this.dom.dailyProjectionDisplay.textContent = projected.toFixed(1);
        }

        updateSummaryStrip() {
            // Internal summary fields preserved
            const z = this.state.zones;
            const avg = (z.zone1.moisture + z.zone2.moisture + z.zone3.moisture) / 3;
            if (this.dom.summaryAvgMoisture) {
                this.dom.summaryAvgMoisture.textContent = `${avg.toFixed(1)}% across 3 Zones`;
            }
        }

        // ======================================================================
        // TELEMETRY HISTORY, 24H SIMULATION & CHARTS
        // ======================================================================
        recordTelemetryPoint() {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const z = this.state.zones;

            this.history.push({
                time: timeStr,
                z1: z.zone1.moisture,
                z2: z.zone2.moisture,
                z3: z.zone3.moisture,
                temp: this.state.weather.temperature,
                threshold: z.zone1.threshold
            });

            if (this.history.length > this.maxHistoryPoints) {
                this.history.shift();
            }

            this.dom.chartPointsCount.textContent = this.history.length;
            if (this.state.chartMode === 'LIVE') {
                this.updateChart();
            }
        }

        generate24HourHistory() {
            this.history24h = [];
            for (let h = 0; h < 24; h++) {
                const hourStr = `${String(h).padStart(2, '0')}:00`;
                const tempCurve = 26 + 7 * Math.sin(((h - 9) / 24) * 2 * Math.PI);
                let z1M = 32 - 6 * Math.sin(((h - 8) / 24) * 2 * Math.PI);
                let z2M = 38 - 8 * Math.sin(((h - 8) / 24) * 2 * Math.PI);
                let z3M = 48 - 4 * Math.sin(((h - 8) / 24) * 2 * Math.PI);

                if (h === 7 || h === 19) {
                    z1M += 12;
                    z2M += 15;
                    z3M += 10;
                }

                this.history24h.push({
                    time: hourStr,
                    z1: Math.round(z1M * 10) / 10,
                    z2: Math.round(z2M * 10) / 10,
                    z3: Math.round(z3M * 10) / 10,
                    temp: Math.round(tempCurve * 10) / 10,
                    threshold: 30
                });
            }
        }

        setChartMode(mode) {
            this.state.chartMode = mode;
            if (mode === 'LIVE') {
                this.dom.btnChartModeLive.classList.add('active');
                this.dom.btnChartMode24h.classList.remove('active');
                this.dom.chartStatusText.textContent = 'Live Streaming';
            } else {
                this.dom.btnChartModeLive.classList.remove('active');
                this.dom.btnChartMode24h.classList.add('active');
                this.dom.chartStatusText.textContent = '24-Hour Diurnal Telemetry';
            }
            this.updateChart();
        }

        initChart() {
            const ctx = this.dom.chartCanvas.getContext('2d');
            if (typeof window.Chart !== 'undefined') {
                try {
                    const isDark = this.state.theme === 'dark';
                    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(20, 46, 31, 0.05)';
                    const tickColor = isDark ? '#B5D4C0' : '#688572';

                    this.chartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: [],
                            datasets: [
                                {
                                    label: 'Potato 🥔 (%)',
                                    data: [],
                                    borderColor: '#EAB308', // Potato Gold
                                    backgroundColor: 'rgba(234, 179, 8, 0.08)',
                                    fill: true,
                                    tension: 0.4,
                                    borderWidth: 2.5,
                                    pointRadius: 3,
                                    yAxisID: 'y'
                                },
                                {
                                    label: 'Tomato 🍅 (%)',
                                    data: [],
                                    borderColor: '#E65D4F', // Tomato Red
                                    fill: false,
                                    tension: 0.4,
                                    borderWidth: 2.5,
                                    pointRadius: 3,
                                    yAxisID: 'y'
                                },
                                {
                                    label: 'Brinjal 🍆 (%)',
                                    data: [],
                                    borderColor: '#A855F7', // Brinjal Purple
                                    backgroundColor: 'rgba(168, 85, 247, 0.08)',
                                    fill: false,
                                    tension: 0.4,
                                    borderWidth: 2.5,
                                    pointRadius: 3,
                                    yAxisID: 'y'
                                },
                                {
                                    label: 'Ambient Temp (°C)',
                                    data: [],
                                    borderColor: '#F59E0B',
                                    borderDash: [4, 4],
                                    fill: false,
                                    tension: 0.35,
                                    borderWidth: 2,
                                    pointRadius: 2,
                                    yAxisID: 'y1'
                                },
                                {
                                    label: 'Threshold Boundary',
                                    data: [],
                                    borderColor: '#EF4444',
                                    borderDash: [6, 6],
                                    fill: false,
                                    borderWidth: 1.5,
                                    pointRadius: 0,
                                    yAxisID: 'y'
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: { duration: 300 },
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                x: {
                                    grid: { color: gridColor },
                                    ticks: { font: { family: 'Inter', size: 10 }, color: tickColor }
                                },
                                y: {
                                    type: 'linear',
                                    position: 'left',
                                    min: 0,
                                    max: 100,
                                    grid: { color: gridColor },
                                    title: { display: true, text: 'Moisture (%)', color: '#397B4B', font: { weight: 'bold' } },
                                    ticks: { font: { family: 'Inter' }, stepSize: 20, color: tickColor }
                                },
                                y1: {
                                    type: 'linear',
                                    position: 'right',
                                    min: 10,
                                    max: 50,
                                    grid: { drawOnChartArea: false },
                                    title: { display: true, text: 'Temp (°C)', color: '#F59E0B', font: { weight: 'bold' } },
                                    ticks: { font: { family: 'Inter' }, stepSize: 10, color: tickColor }
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.warn('Chart.js initialization failed, switching to Canvas fallback:', e);
                    this.canvasFallbackMode = true;
                }
            } else {
                console.info('Chart.js CDN unavailable. Using Canvas fallback.');
                this.canvasFallbackMode = true;
            }
        }

        updateChartTheme() {
            if (!this.chartInstance) return;
            const isDark = this.state.theme === 'dark';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(20, 46, 31, 0.05)';
            const tickColor = isDark ? '#B5D4C0' : '#688572';

            this.chartInstance.options.scales.x.grid.color = gridColor;
            this.chartInstance.options.scales.x.ticks.color = tickColor;
            this.chartInstance.options.scales.y.grid.color = gridColor;
            this.chartInstance.options.scales.y.ticks.color = tickColor;
            this.chartInstance.options.scales.y1.ticks.color = tickColor;
            this.chartInstance.update();
        }

        updateChart() {
            const dataSet = this.state.chartMode === 'LIVE' ? this.history : this.history24h;

            if (this.chartInstance && !this.canvasFallbackMode) {
                this.chartInstance.data.labels = dataSet.map(d => d.time);
                this.chartInstance.data.datasets[0].data = dataSet.map(d => d.z1);
                this.chartInstance.data.datasets[1].data = dataSet.map(d => d.z2);
                this.chartInstance.data.datasets[2].data = dataSet.map(d => d.z3);
                this.chartInstance.data.datasets[3].data = dataSet.map(d => d.temp);
                this.chartInstance.data.datasets[4].data = dataSet.map(d => d.threshold);
                this.chartInstance.update();
            } else {
                this.renderCanvasFallback(dataSet);
            }
        }

        /**
         * Canvas 2D Fallback Renderer (100% Offline Guaranteed)
         */
        renderCanvasFallback(dataSet) {
            const canvas = this.dom.chartCanvas;
            const ctx = canvas.getContext('2d');
            const w = canvas.width = canvas.parentElement.clientWidth;
            const h = canvas.height = 280;

            const isDark = this.state.theme === 'dark';
            ctx.fillStyle = isDark ? '#13241A' : '#FFFFFF';
            ctx.fillRect(0, 0, w, h);

            if (dataSet.length < 2) {
                ctx.fillStyle = isDark ? '#B5D4C0' : '#688572';
                ctx.font = '14px Nunito';
                ctx.textAlign = 'center';
                ctx.fillText('Collecting real-time field telemetry...', w / 2, h / 2);
                return;
            }

            const pad = { top: 25, right: 30, bottom: 35, left: 45 };
            const cw = w - pad.left - pad.right;
            const ch = h - pad.top - pad.bottom;

            // Draw Threshold Line
            const threshY = pad.top + ch * (1 - (this.state.zones.zone1.threshold / 100));
            ctx.strokeStyle = '#EF4444';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pad.left, threshY);
            ctx.lineTo(w - pad.right, threshY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Potato (Zone 1) curve
            ctx.strokeStyle = '#EAB308';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            dataSet.forEach((d, i) => {
                const x = pad.left + (i / (dataSet.length - 1)) * cw;
                const y = pad.top + ch * (1 - (d.z1 / 100));
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        // ======================================================================
        // AUDITED ALERT CENTER & INCIDENT MANAGEMENT
        // ======================================================================
        logAlert(type, severity, zoneName, message) {
            const timeStr = new Date().toLocaleTimeString();
            const alertItem = {
                id: 'ALT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                timestamp: timeStr,
                type: type,
                severity: severity,
                zone: zoneName,
                message: message,
                resolved: false
            };

            this.alerts.unshift(alertItem);
            if (this.alerts.length > 50) this.alerts.pop();

            this.renderAlertsUI();
        }

        renderAlertsUI() {
            this.dom.eventLogContainer.innerHTML = '';

            const filtered = this.alerts.filter(a => {
                if (this.alertFilter === 'ALL') return true;
                if (this.alertFilter === 'UNRESOLVED') return !a.resolved;
                return a.severity === this.alertFilter;
            });

            const unresolvedCount = this.alerts.filter(a => !a.resolved).length;
            this.dom.alertCountBadge.textContent = unresolvedCount;

            filtered.forEach(alert => {
                const row = document.createElement('div');
                row.className = 'log-stream-row';

                let sevClass = 'sev-info';
                if (alert.severity === 'WARNING') sevClass = 'sev-warning';
                if (alert.severity === 'CRITICAL') sevClass = 'sev-critical';

                row.innerHTML = `
                    <span style="font-size:0.76rem; color:var(--text-muted);">${alert.timestamp}</span>
                    <div><span class="log-severity-pill ${sevClass}">${alert.severity}</span></div>
                    <span style="font-weight:700;">${alert.zone}</span>
                    <span>${alert.message}</span>
                    <div>
                        ${alert.resolved 
                            ? '<span style="color: var(--primary-green); font-size: 0.74rem; font-weight:700;">Resolved</span>'
                            : `<button class="btn btn-sm btn-outline btn-resolve" data-id="${alert.id}">Resolve</button>`
                        }
                    </div>
                `;

                const resolveBtn = row.querySelector('.btn-resolve');
                if (resolveBtn) {
                    resolveBtn.addEventListener('click', () => {
                        alert.resolved = true;
                        this.renderAlertsUI();
                        this.showToast(`Alert resolved`, 'info');
                    });
                }

                this.dom.eventLogContainer.appendChild(row);
            });
        }

        // ======================================================================
        // CSV EXPORT ENGINE
        // ======================================================================
        exportTelemetryCsv() {
            const dataSet = this.state.chartMode === 'LIVE' ? this.history : this.history24h;
            if (dataSet.length === 0) {
                this.showToast('No telemetry data available to export', 'danger');
                return;
            }

            const headers = [
                'Time_Stamp',
                'Zone1_Potato_Moisture_Pct',
                'Zone2_Tomato_Moisture_Pct',
                'Zone3_Brinjal_Moisture_Pct',
                'Ambient_Temperature_C',
                'Threshold_Boundary_Pct',
                'Active_Weather_Condition'
            ];

            const rows = dataSet.map(d => [
                d.time,
                d.z1,
                d.z2,
                d.z3,
                d.temp,
                d.threshold,
                `"${this.state.weather.condition}"`
            ]);

            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `smartfarm-telemetry-${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showToast('Telemetry CSV exported successfully! 📊', 'success');
        }

        exportAlertsCsv() {
            if (this.alerts.length === 0) {
                this.showToast('No alerts to export', 'danger');
                return;
            }

            const headers = ['Alert_ID', 'Timestamp', 'Severity', 'Zone', 'Message', 'Status'];
            const rows = this.alerts.map(a => [
                a.id,
                a.timestamp,
                a.severity,
                `"${a.zone}"`,
                `"${a.message}"`,
                a.resolved ? 'RESOLVED' : 'UNRESOLVED'
            ]);

            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `smartfarm-alerts-${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showToast('Alert log CSV exported', 'success');
        }

        // ======================================================================
        // INTERACTIVE IOT ARCHITECTURE EXPLORER
        // ======================================================================
        renderArchitectureInspector(layerKey) {
            const data = {
                perception: {
                    badge: 'Layer 1: Perception Layer',
                    title: 'Perception & Transducer Sensing Layer',
                    body: `
                        <p><strong>Curriculum Alignment:</strong> Models physical transducers in IoT. Analog soil moisture permittivity and ambient thermal readings are transduced into calibrated electrical telemetry.</p>
                        <div class="inspector-specs-table">
                            <div class="spec-row"><span>Transducer Types:</span> <strong>3x Capacitive Soil Probes (Pins A0, A1, A2) + DHT22 Microclimate</strong></div>
                            <div class="spec-row"><span>ADC Resolution:</span> <strong>10-bit Analog-to-Digital (0-1023 mapped to 0-100% moisture)</strong></div>
                            <div class="spec-row"><span>Micro-Climate Input:</span> <strong>Tipping-bucket rainfall gauge & relative hygrometer</strong></div>
                        </div>
                        <div class="inspector-formula">
                            $$\\text{Soil Moisture (\\%)} = \\left(\\frac{\\text{ADC}_{\\text{dry}} - \\text{ADC}_{\\text{reading}}}{\\text{ADC}_{\\text{dry}} - \\text{ADC}_{\\text{wet}}}\\right) \\times 100\\%$$
                        </div>
                    `
                },
                ingestion: {
                    badge: 'Layer 2: Edge Ingestion',
                    title: 'Edge Ingestion & Communication Layer',
                    body: `
                        <p><strong>Curriculum Alignment:</strong> Models edge telemetry buffering, range validation, CRC integrity, and simulated MQTT pub/sub publish routines.</p>
                        <div class="inspector-specs-table">
                            <div class="spec-row"><span>Simulated Protocol:</span> <strong>MQTT over WebSockets (TCP/IP Broker)</strong></div>
                            <div class="spec-row"><span>Topic Bus:</span> <code>smartfarm/zones/{zoneId}/telemetry</code></div>
                            <div class="spec-row"><span>Fault Detection:</span> <strong>Open-circuit & short-circuit signal guard (0% / 100% stuck)</strong></div>
                            <div class="spec-row"><span>QoS Level:</span> <strong>QoS 1 (Guaranteed delivery with ACK)</strong></div>
                        </div>
                    `
                },
                decision: {
                    badge: 'Layer 3: Decision Logic',
                    title: 'Decision-Making & Irrigation Logic Engine',
                    body: `
                        <p><strong>Curriculum Alignment:</strong> Demonstrates deterministic closed-loop feedback algorithms, fail-safe safety interlocks, and scheduling windows.</p>
                        <div class="inspector-specs-table">
                            <div class="spec-row"><span>Zone 1 (Potato):</span> <code>IF moisture &lt; 30% THEN Relay D4 = ON ELSE OFF</code></div>
                            <div class="spec-row"><span>Zone 2 (Tomato):</span> <code>IF moisture &lt; 35% THEN Relay D5 = ON ELSE OFF</code></div>
                            <div class="spec-row"><span>Zone 3 (Brinjal):</span> <code>IF moisture &lt; 45% THEN Relay D6 = ON ELSE OFF</code></div>
                            <div class="spec-row"><span>Fail-Safe Guard:</span> <strong>Sensor Fault &rarr; Immediately de-energize relay to prevent flood</strong></div>
                        </div>
                    `
                },
                actuation: {
                    badge: 'Layer 4: Physical Actuation',
                    title: 'Actuation & Flow Integration Layer',
                    body: `
                        <p><strong>Curriculum Alignment:</strong> Translates decision commands into physical electrical outputs (solenoids, relays, pumps) and calculates water flow integrals.</p>
                        <div class="inspector-specs-table">
                            <div class="spec-row"><span>Relay Pins:</span> <strong>Pin D4 (Potato), Pin D5 (Tomato), Pin D6 (Brinjal)</strong></div>
                            <div class="spec-row"><span>Calibrated Flow:</span> <strong>Potato: 72 L/h | Tomato: 90 L/h | Brinjal: 45 L/h</strong></div>
                            <div class="spec-row"><span>Flow Accumulation:</span> <strong>$$V = \\int_0^t \\left(\\sum \\frac{\\text{Flow}_i}{3600}\\right) dt$$</strong></div>
                        </div>
                    `
                }
            };

            const layer = data[layerKey] || data.perception;
            this.dom.inspectorLayerBadge.textContent = layer.badge;
            this.dom.inspectorTitle.textContent = layer.title;
            this.dom.inspectorBody.innerHTML = layer.body;
        }

        // ======================================================================
        // SETTINGS & LOCALSTORAGE PERSISTENCE
        // ======================================================================
        loadSettings() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.zones) {
                        ['zone1', 'zone2', 'zone3'].forEach(zId => {
                            if (parsed.zones[zId]) {
                                if (parsed.zones[zId].threshold !== undefined) this.state.zones[zId].threshold = parsed.zones[zId].threshold;
                                if (parsed.zones[zId].flowRatePerHour !== undefined) this.state.zones[zId].flowRatePerHour = parsed.zones[zId].flowRatePerHour;
                            }
                        });
                    }
                    if (parsed.tickInterval) this.state.tickInterval = parsed.tickInterval;
                    if (parsed.theme) this.state.theme = parsed.theme;
                    if (parsed.schedule) this.state.schedule = parsed.schedule;
                    if (parsed.persistenceEnabled !== undefined) this.state.persistenceEnabled = parsed.persistenceEnabled;
                }
            } catch (e) {
                console.warn('LocalStorage load failed:', e);
            }
        }

        saveSettingsToLocalStorage() {
            if (!this.state.persistenceEnabled) return;
            try {
                const payload = {
                    zones: {
                        zone1: { threshold: this.state.zones.zone1.threshold, flowRatePerHour: this.state.zones.zone1.flowRatePerHour },
                        zone2: { threshold: this.state.zones.zone2.threshold, flowRatePerHour: this.state.zones.zone2.flowRatePerHour },
                        zone3: { threshold: this.state.zones.zone3.threshold, flowRatePerHour: this.state.zones.zone3.flowRatePerHour }
                    },
                    tickInterval: this.state.tickInterval,
                    schedule: this.state.schedule,
                    theme: this.state.theme,
                    persistenceEnabled: this.state.persistenceEnabled
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            } catch (e) {
                console.warn('LocalStorage save failed:', e);
            }
        }

        saveSettings() {
            const z1Thresh = parseFloat(this.dom.cfgThresholdZ1.value);
            const z2Thresh = parseFloat(this.dom.cfgThresholdZ2.value);
            const z3Thresh = parseFloat(this.dom.cfgThresholdZ3.value);
            const z1Flow = parseFloat(this.dom.cfgFlowRateZ1.value);
            const interval = parseInt(this.dom.cfgSimInterval.value, 10);
            const persist = this.dom.cfgPersistenceToggle.checked;
            const schedOn = this.dom.cfgScheduleToggle.checked;
            const sStart = parseInt(this.dom.cfgScheduleStart.value, 10);
            const sEnd = parseInt(this.dom.cfgScheduleEnd.value, 10);

            this.state.zones.zone1.threshold = z1Thresh;
            this.state.zones.zone2.threshold = z2Thresh;
            this.state.zones.zone3.threshold = z3Thresh;
            this.state.zones.zone1.flowRatePerHour = z1Flow;
            this.state.tickInterval = interval;
            this.state.persistenceEnabled = persist;
            this.state.schedule.enabled = schedOn;
            this.state.schedule.startHour = sStart;
            this.state.schedule.endHour = sEnd;

            this.dom.chartSamplingInterval.textContent = `${interval / 1000}s`;

            this.saveSettingsToLocalStorage();
            this.evaluateAllZones(true);
            this.logAlert('CONFIG_SAVED', 'INFO', 'Global', 'Configuration settings updated');
            this.showToast('Settings Saved Successfully! ✅', 'success');
        }

        restoreDefaults() {
            localStorage.removeItem(STORAGE_KEY);
            this.state = JSON.parse(JSON.stringify(DEFAULTS));
            this.dom.cfgThresholdZ1.value = 30;
            this.dom.cfgThresholdZ2.value = 35;
            this.dom.cfgThresholdZ3.value = 45;
            this.dom.cfgFlowRateZ1.value = 72;
            this.dom.cfgSimInterval.value = 2500;
            this.dom.cfgPersistenceToggle.checked = true;
            this.dom.cfgScheduleToggle.checked = false;

            this.evaluateAllZones(true);
            this.showToast('Factory baseline restored', 'info');
        }

        // ======================================================================
        // HELPERS: TOAST NOTIFICATIONS & LIVE CLOCK
        // ======================================================================
        showToast(message, variant = 'info') {
            const toast = document.createElement('div');
            let vClass = 'toast-info';
            if (variant === 'success') vClass = 'toast-success';
            if (variant === 'danger') vClass = 'toast-error';
            if (variant === 'warning') vClass = 'toast-warning';

            toast.className = `toast ${vClass}`;
            toast.textContent = message;
            this.dom.toastContainer.appendChild(toast);

            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 3600);
        }

        // ======================================================================
        // 18. VIEW MODE MANAGEMENT (FARMER vs LEARNING vs ENGINEER vs ALL)
        // ======================================================================
        initViewModes() {
            this.currentViewMode = 'farmer'; // Default view: Friendly Farmer Dashboard
            this.applyViewMode(this.currentViewMode);

            // Header View Mode Switcher Buttons
            const viewBtns = document.querySelectorAll('.view-switch-btn');
            viewBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const view = btn.getAttribute('data-view');
                    this.applyViewMode(view);
                });
            });

            // Handle Sidebar Nav Link Click View Mode Alignment
            document.querySelectorAll('.sidebar-nav a.nav-item').forEach(link => {
                link.addEventListener('click', (e) => {
                    const targetView = link.getAttribute('data-view');
                    if (targetView && targetView !== this.currentViewMode && this.currentViewMode !== 'all') {
                        this.applyViewMode(targetView);
                    }
                    const targetId = link.getAttribute('href').replace('#', '');
                    const el = document.getElementById(targetId);
                    if (el) {
                        setTimeout(() => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                    }
                });
            });

            // Check initial hash
            if (window.location.hash) {
                const h = window.location.hash.toLowerCase();
                if (h.includes('farmer')) this.applyViewMode('farmer');
                else if (h.includes('mqtt') || h.includes('topo') || h.includes('flow') || h.includes('learning') || h.includes('sensor-network') || h.includes('local-remote')) {
                    this.applyViewMode('learning');
                } else if (h.includes('overview') || h.includes('my-farm') || h.includes('weather') || h.includes('irrigation') || h.includes('simulation') || h.includes('analytics')) {
                    this.applyViewMode('engineer');
                }
            }
        }

        applyViewMode(mode) {
            this.currentViewMode = mode;
            document.body.classList.remove('view-farmer', 'view-learning', 'view-engineer');
            if (mode !== 'all') {
                document.body.classList.add(`view-${mode}`);
            }

            // Update View Switcher Buttons
            document.querySelectorAll('.view-switch-btn').forEach(btn => {
                if (btn.getAttribute('data-view') === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Update Sidebar Navigation Active Status
            document.querySelectorAll('.sidebar-nav a.nav-item').forEach(link => {
                const linkView = link.getAttribute('data-view');
                if (linkView === mode) {
                    link.classList.add('active');
                } else if (mode !== 'all') {
                    link.classList.remove('active');
                }
            });

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ======================================================================
        // 19. FARMER CONTROL CENTRE IMPLEMENTATION
        // ======================================================================
        initFarmerDashboard() {
            this.farmerActivityHistory = [];

            // Cache Farmer DOM Elements
            this.farmerDom = {
                // KPIs
                kpiTotalZones: document.getElementById('fKpiTotalZones'),
                kpiHealthyZones: document.getElementById('fKpiHealthyZones'),
                kpiThirstyZones: document.getElementById('fKpiThirstyZones'),
                kpiActivePumps: document.getElementById('fKpiActivePumps'),
                kpiTemperature: document.getElementById('fKpiTemperature'),
                kpiTotalWater: document.getElementById('fKpiTotalWater'),

                // Actions
                btnAutoAll: document.getElementById('btnFarmerAutoAll'),
                btnEmergencyStop: document.getElementById('btnFarmerEmergencyStop'),

                // Zones
                zones: {
                    zone1: {
                        card: document.getElementById('farmerCardZone1'),
                        waterBanner: document.getElementById('fZ1WaterBanner'),
                        sensorBadge: document.getElementById('fZ1SensorBadge'),
                        moistureVal: document.getElementById('fZ1MoistureVal'),
                        moistureTag: document.getElementById('fZ1MoistureTag'),
                        moistureBar: document.getElementById('fZ1MoistureBar'),
                        thresholdVal: document.getElementById('fZ1ThresholdVal'),
                        tempDisplay: document.getElementById('fZ1TempDisplay'),
                        pumpStatusText: document.getElementById('fZ1PumpStatusText'),
                        lastUpdate: document.getElementById('fZ1LastUpdate'),
                        pumpBtn: document.getElementById('fZ1PumpBtn'),
                        pumpBtnText: document.getElementById('fZ1PumpBtnText'),
                        modeText: document.getElementById('fZ1ModeText'),
                        modeSwitchBtn: document.getElementById('fZ1ModeSwitchBtn')
                    },
                    zone2: {
                        card: document.getElementById('farmerCardZone2'),
                        waterBanner: document.getElementById('fZ2WaterBanner'),
                        sensorBadge: document.getElementById('fZ2SensorBadge'),
                        moistureVal: document.getElementById('fZ2MoistureVal'),
                        moistureTag: document.getElementById('fZ2MoistureTag'),
                        moistureBar: document.getElementById('fZ2MoistureBar'),
                        thresholdVal: document.getElementById('fZ2ThresholdVal'),
                        tempDisplay: document.getElementById('fZ2TempDisplay'),
                        pumpStatusText: document.getElementById('fZ2PumpStatusText'),
                        lastUpdate: document.getElementById('fZ2LastUpdate'),
                        pumpBtn: document.getElementById('fZ2PumpBtn'),
                        pumpBtnText: document.getElementById('fZ2PumpBtnText'),
                        modeText: document.getElementById('fZ2ModeText'),
                        modeSwitchBtn: document.getElementById('fZ2ModeSwitchBtn')
                    },
                    zone3: {
                        card: document.getElementById('farmerCardZone3'),
                        waterBanner: document.getElementById('fZ3WaterBanner'),
                        sensorBadge: document.getElementById('fZ3SensorBadge'),
                        moistureVal: document.getElementById('fZ3MoistureVal'),
                        moistureTag: document.getElementById('fZ3MoistureTag'),
                        moistureBar: document.getElementById('fZ3MoistureBar'),
                        thresholdVal: document.getElementById('fZ3ThresholdVal'),
                        tempDisplay: document.getElementById('fZ3TempDisplay'),
                        pumpStatusText: document.getElementById('fZ3PumpStatusText'),
                        lastUpdate: document.getElementById('fZ3LastUpdate'),
                        pumpBtn: document.getElementById('fZ3PumpBtn'),
                        pumpBtnText: document.getElementById('fZ3PumpBtnText'),
                        modeText: document.getElementById('fZ3ModeText'),
                        modeSwitchBtn: document.getElementById('fZ3ModeSwitchBtn')
                    }
                },

                // Activity Table & Alerts
                activityTableBody: document.getElementById('farmerActivityTableBody'),
                alertStream: document.getElementById('farmerAlertStream'),
                btnDismissAlerts: document.getElementById('btnDismissFarmerAlerts'),

                // Confirmation Modal
                confirmModal: document.getElementById('farmerConfirmModal'),
                confirmTitle: document.getElementById('farmerConfirmTitle'),
                confirmBody: document.getElementById('farmerConfirmBody'),
                btnConfirmCancel: document.getElementById('btnFarmerConfirmCancel'),
                btnConfirmProceed: document.getElementById('btnFarmerConfirmProceed')
            };

            // Pending action for modal confirmation
            this.pendingFarmerAction = null;

            // Bind Zone Pump Buttons
            ['zone1', 'zone2', 'zone3'].forEach(zId => {
                const zUi = this.farmerDom.zones[zId];
                if (!zUi || !zUi.pumpBtn) return;

                zUi.pumpBtn.addEventListener('click', () => {
                    const zone = this.state.zones[zId];
                    if (zone.sensorStatus !== 'ONLINE') {
                        this.showToast(`Cannot start pump: ${zone.name} sensor is ${zone.sensorStatus}`, 'danger');
                        return;
                    }

                    if (zone.pumpActive) {
                        // Stop Pump
                        if (zone.mode === 'AUTO') {
                            zone.mode = 'MANUAL';
                        }
                        this.stopFarmerPump(zId);
                    } else {
                        // Start Pump
                        if (zone.mode === 'AUTO') {
                            // Show confirmation modal to switch to manual and start
                            this.showFarmerConfirmationModal(
                                `Start Watering ${zone.name}?`,
                                `Zone is currently in Automatic mode. Starting the pump will switch ${zone.name} to Manual Operator Mode so you have full direct control.`,
                                () => {
                                    zone.mode = 'MANUAL';
                                    this.startFarmerPump(zId);
                                }
                            );
                        } else {
                            this.startFarmerPump(zId);
                        }
                    }
                });

                // Mode switch toggle
                zUi.modeSwitchBtn.addEventListener('click', () => {
                    const zone = this.state.zones[zId];
                    zone.mode = zone.mode === 'AUTO' ? 'MANUAL' : 'AUTO';
                    this.showToast(`${zone.name} switched to ${zone.mode} mode`, 'info');
                    if (zone.mode === 'AUTO') {
                        this.evaluateZone(zId);
                    }
                    this.updateFarmerDashboardUI();
                    this.updateZoneUI(zId);
                });
            });

            // Bind Global Farmer Actions
            if (this.farmerDom.btnAutoAll) {
                this.farmerDom.btnAutoAll.addEventListener('click', () => {
                    ['zone1', 'zone2', 'zone3'].forEach(zId => {
                        this.state.zones[zId].mode = 'AUTO';
                    });
                    this.evaluateAllZones(true);
                    this.logFarmerActivity('All Zones', 'Re-engaged Automatic Schedule', '0.00 L', 'AUTO MODE');
                    this.pushFarmerAlert('info', 'All farm zones restored to Automatic Closed-Loop Irrigation.');
                    this.showToast('All zones switched to Automatic Closed-Loop! 🌿', 'success');
                });
            }

            if (this.farmerDom.btnEmergencyStop) {
                this.farmerDom.btnEmergencyStop.addEventListener('click', () => {
                    ['zone1', 'zone2', 'zone3'].forEach(zId => {
                        this.state.zones[zId].mode = 'MANUAL';
                        this.state.zones[zId].pumpActive = false;
                        this.updateZoneUI(zId);
                    });
                    this.logFarmerActivity('All Zones', 'EMERGENCY PUMP HALT', '0.00 L', 'OPERATOR OVERRIDE');
                    this.pushFarmerAlert('critical', 'Emergency Stop Engaged: All irrigation pumps powered down.');
                    this.showToast('Emergency Stop Triggered: All pumps halted! 🛑', 'danger');
                    this.updateFarmerDashboardUI();
                    this.updateSummaryStrip();
                    this.updateSproutMood();
                });
            }

            if (this.farmerDom.btnDismissAlerts) {
                this.farmerDom.btnDismissAlerts.addEventListener('click', () => {
                    this.farmerDom.alertStream.innerHTML = `
                        <div class="farmer-alert-pill alert-info">
                            <span>🌱</span>
                            <div><strong>Alerts Cleared:</strong> Farm telemetry running smoothly.</div>
                        </div>
                    `;
                    this.showToast('Crop alerts acknowledged', 'info');
                });
            }

            // Modal listeners
            if (this.farmerDom.btnConfirmCancel) {
                this.farmerDom.btnConfirmCancel.addEventListener('click', () => {
                    this.farmerDom.confirmModal.classList.remove('open');
                    this.pendingFarmerAction = null;
                });
            }

            if (this.farmerDom.btnConfirmProceed) {
                this.farmerDom.btnConfirmProceed.addEventListener('click', () => {
                    this.farmerDom.confirmModal.classList.remove('open');
                    if (typeof this.pendingFarmerAction === 'function') {
                        this.pendingFarmerAction();
                        this.pendingFarmerAction = null;
                    }
                });
            }

            this.updateFarmerDashboardUI();
        }

        showFarmerConfirmationModal(title, message, onProceed) {
            this.farmerDom.confirmTitle.textContent = title;
            this.farmerDom.confirmBody.textContent = message;
            this.pendingFarmerAction = onProceed;
            this.farmerDom.confirmModal.classList.add('open');
        }

        startFarmerPump(zoneId) {
            const zone = this.state.zones[zoneId];
            if (!zone) return;
            zone.pumpActive = true;
            zone.activations += 1;
            this.state.pumpActivations += 1;
            this.logAlert('MANUAL_ACTUATION', 'INFO', zone.name, `Farmer Operator activated Relay ${zone.relay} (Pump ON)`);
            this.logFarmerActivity(zone.name, 'Started Irrigation Pump', `${(zone.flowRatePerHour / 60).toFixed(2)} L/min`, 'MANUAL COMMAND');
            this.pushFarmerAlert('info', `Watering started for ${zone.name}. Relay ${zone.relay} energized.`);
            this.showToast(`💧 Started Pump for ${zone.name}`, 'success');

            this.updateZoneUI(zoneId);
            this.updateFarmerDashboardUI();
            this.updateSummaryStrip();
            this.updateSproutMood();
        }

        stopFarmerPump(zoneId) {
            const zone = this.state.zones[zoneId];
            if (!zone) return;
            zone.pumpActive = false;
            this.logAlert('MANUAL_ACTUATION', 'INFO', zone.name, `Farmer Operator stopped Relay ${zone.relay} (Pump OFF)`);
            this.logFarmerActivity(zone.name, 'Halted Irrigation Pump', 'Flow Idle', 'OPERATOR STOP');
            this.pushFarmerAlert('info', `Watering stopped for ${zone.name}. Pump returned to standby.`);
            this.showToast(`Stopped Pump for ${zone.name}`, 'info');

            this.updateZoneUI(zoneId);
            this.updateFarmerDashboardUI();
            this.updateSummaryStrip();
            this.updateSproutMood();
        }

        updateFarmerDashboardUI() {
            if (!this.farmerDom || !this.farmerDom.kpiTotalZones) return;

            let healthyCount = 0;
            let thirstyCount = 0;
            let activeCount = 0;

            ['zone1', 'zone2', 'zone3'].forEach(zId => {
                const zone = this.state.zones[zId];
                const zUi = this.farmerDom.zones[zId];
                if (!zone || !zUi) return;

                if (zone.pumpActive) activeCount++;

                if (zone.sensorStatus !== 'ONLINE') {
                    thirstyCount++;
                } else if (zone.moisture < zone.threshold) {
                    thirstyCount++;
                } else {
                    healthyCount++;
                }

                // Update Zone UI
                zUi.moistureVal.textContent = Math.round(zone.moisture);
                zUi.moistureBar.style.width = `${Math.max(0, Math.min(100, zone.moisture))}%`;
                zUi.thresholdVal.textContent = `< ${zone.threshold}% Moisture`;
                zUi.tempDisplay.textContent = `${(this.state.weather.temperature + (zId === 'zone1' ? -2.6 : zId === 'zone2' ? -2.0 : -1.2)).toFixed(1)}°C`;
                zUi.lastUpdate.textContent = 'Just now';
                zUi.modeText.textContent = `${zone.mode} MODE`;
                zUi.modeSwitchBtn.textContent = zone.mode === 'AUTO' ? 'Switch to Manual' : 'Switch to Auto';

                // Sensor Badge
                zUi.sensorBadge.className = 'farmer-zone-status-badge sensor-health-pill';
                if (zone.sensorStatus === 'ONLINE') {
                    zUi.sensorBadge.classList.add('pill-online');
                    zUi.sensorBadge.textContent = 'Online';
                } else {
                    zUi.sensorBadge.classList.add('pill-fault');
                    zUi.sensorBadge.textContent = zone.sensorStatus;
                }

                // Moisture Tag & Color
                if (zone.sensorStatus !== 'ONLINE') {
                    zUi.moistureTag.textContent = 'Sensor Fault ⚠️';
                    zUi.moistureTag.style.background = '#FEE2E2';
                    zUi.moistureTag.style.color = '#991B1B';
                    zUi.moistureBar.style.background = '#DC2626';
                } else if (zone.moisture < zone.threshold) {
                    zUi.moistureTag.textContent = 'Thirsty 💧';
                    zUi.moistureTag.style.background = '#FEE2E2';
                    zUi.moistureTag.style.color = '#B91C1C';
                    zUi.moistureBar.style.background = '#EF4444';
                } else if (zone.moisture <= 70) {
                    zUi.moistureTag.textContent = 'Optimal Soil 🌿';
                    zUi.moistureTag.style.background = '#DCFCE7';
                    zUi.moistureTag.style.color = '#15803D';
                    zUi.moistureBar.style.background = '#16A34A';
                } else {
                    zUi.moistureTag.textContent = 'Saturated 🌊';
                    zUi.moistureTag.style.background = '#E0F2FE';
                    zUi.moistureTag.style.color = '#0369A1';
                    zUi.moistureBar.style.background = '#0284C7';
                }

                // Pump Status & Button
                if (zone.pumpActive) {
                    zUi.card.classList.add('watering-active');
                    zUi.pumpStatusText.textContent = 'ON (Watering... 🚿)';
                    zUi.pumpStatusText.style.color = '#0284C7';
                    zUi.pumpBtn.className = 'farmer-pump-toggle-btn btn-pump-stop';
                    zUi.pumpBtnText.textContent = 'STOP PUMP';
                } else {
                    zUi.card.classList.remove('watering-active');
                    zUi.pumpStatusText.textContent = 'OFF (Standby)';
                    zUi.pumpStatusText.style.color = 'var(--text-primary)';
                    zUi.pumpBtn.className = 'farmer-pump-toggle-btn btn-pump-start';
                    zUi.pumpBtnText.textContent = 'START PUMP';
                }
            });

            // Update KPIs
            this.farmerDom.kpiTotalZones.textContent = '3 Zones';
            this.farmerDom.kpiHealthyZones.textContent = `${healthyCount} of 3`;
            this.farmerDom.kpiThirstyZones.textContent = `${thirstyCount} ${thirstyCount === 1 ? 'Zone' : 'Zones'}`;
            this.farmerDom.kpiActivePumps.textContent = `${activeCount} Active`;
            this.farmerDom.kpiTemperature.textContent = `${this.state.weather.temperature.toFixed(1)}°C`;
            this.farmerDom.kpiTotalWater.textContent = `${this.state.totalWaterLiters.toFixed(2)} L`;
        }

        logFarmerActivity(zoneName, action, waterLiters, mode) {
            const timeStr = new Date().toLocaleTimeString();
            this.farmerActivityHistory.unshift({
                time: timeStr,
                zone: zoneName,
                action: action,
                water: waterLiters,
                mode: mode
            });
            if (this.farmerActivityHistory.length > 8) this.farmerActivityHistory.pop();

            if (this.farmerDom.activityTableBody) {
                this.farmerDom.activityTableBody.innerHTML = this.farmerActivityHistory.map(item => `
                    <tr>
                        <td>${item.time}</td>
                        <td><strong>${item.zone}</strong></td>
                        <td>${item.action}</td>
                        <td>${item.water}</td>
                        <td><span class="badge-tag">${item.mode}</span></td>
                    </tr>
                `).join('');
            }
        }

        pushFarmerAlert(type, message) {
            if (!this.farmerDom.alertStream) return;
            const icon = type === 'critical' ? '🛑' : type === 'warning' ? '⚠️' : '🌱';
            const pillClass = type === 'critical' ? 'alert-critical' : type === 'warning' ? 'alert-warning' : 'alert-info';
            const item = document.createElement('div');
            item.className = `farmer-alert-pill ${pillClass}`;
            item.innerHTML = `<span>${icon}</span><div>${message}</div>`;
            this.farmerDom.alertStream.prepend(item);

            const children = this.farmerDom.alertStream.children;
            if (children.length > 6) {
                this.farmerDom.alertStream.removeChild(children[children.length - 1]);
            }
        }

        // ======================================================================
        // 20. MQTT COMMUNICATION CENTRE IMPLEMENTATION
        // ======================================================================
        initMqttCenter() {
            this.mqttCurrentTopic = 'smartfarm/zone01/soil/moisture';
            this.mqttTickerTimer = null;
            this.mqttMessageCount = 1;

            this.mqttDom = {
                topicPills: document.querySelectorAll('.mqtt-topic-pill'),
                btnPublishData: document.getElementById('btnPublishMqttData'),
                btnPublishPump: document.getElementById('btnPublishMqttPump'),
                btnToggleTicker: document.getElementById('btnToggleMqttTicker'),
                tickerStateText: document.getElementById('mqttTickerStateText'),

                publisherCard: document.getElementById('mqttPublisherCard'),
                brokerCard: document.getElementById('mqttBrokerCard'),
                subscriberCard: document.getElementById('mqttSubscriberCard'),
                bullet1: document.getElementById('mqttPacketBullet1'),
                bullet2: document.getElementById('mqttPacketBullet2'),

                publisherSource: document.getElementById('mqttPublisherSource'),
                publisherStatus: document.getElementById('mqttPublisherStatus'),
                brokerStatus: document.getElementById('mqttBrokerStatus'),
                subscriberStatus: document.getElementById('mqttSubscriberStatus'),

                topicLabel: document.getElementById('mqttCurrentTopicLabel'),
                codeBlock: document.getElementById('mqttPayloadCodeBlock'),
                btnCopy: document.getElementById('btnCopyMqttPayload'),
                historyTableBody: document.getElementById('mqttHistoryTableBody'),
                countBadge: document.getElementById('mqttMsgCountBadge')
            };

            // Topic Selector Pills
            this.mqttDom.topicPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    this.mqttDom.topicPills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.mqttCurrentTopic = pill.getAttribute('data-topic');
                    this.mqttDom.topicLabel.textContent = this.mqttCurrentTopic;
                    this.updateMqttPayloadViewer();
                });
            });

            // Action Buttons
            if (this.mqttDom.btnPublishData) {
                this.mqttDom.btnPublishData.addEventListener('click', () => {
                    this.executeMqttPubSubCycle(this.mqttCurrentTopic);
                });
            }

            if (this.mqttDom.btnPublishPump) {
                this.executeMqttPubSubCycle('smartfarm/zone01/pump/status');
            }

            if (this.mqttDom.btnToggleTicker) {
                this.mqttDom.btnToggleTicker.addEventListener('click', () => {
                    if (this.mqttTickerTimer) {
                        clearInterval(this.mqttTickerTimer);
                        this.mqttTickerTimer = null;
                        this.mqttDom.tickerStateText.textContent = 'OFF';
                        this.showToast('MQTT Telemetry Stream Paused', 'info');
                    } else {
                        this.mqttTickerTimer = setInterval(() => {
                            this.executeMqttPubSubCycle(this.mqttCurrentTopic);
                        }, 3500);
                        this.mqttDom.tickerStateText.textContent = 'LIVE (3.5s)';
                        this.showToast('MQTT Stream Streaming Live Telemetry! 🚀', 'info');
                    }
                });
            }

            if (this.mqttDom.btnCopy) {
                this.mqttDom.btnCopy.addEventListener('click', () => {
                    const text = this.mqttDom.codeBlock.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        this.mqttDom.btnCopy.textContent = 'Copied! ✅';
                        setTimeout(() => this.mqttDom.btnCopy.textContent = 'Copy JSON', 2000);
                    }).catch(() => {
                        this.showToast('JSON Copied to clipboard', 'info');
                    });
                });
            }

            this.updateMqttPayloadViewer();
        }

        generateMqttPayload(topic) {
            const z1 = this.state.zones.zone1;
            const z2 = this.state.zones.zone2;
            const z3 = this.state.zones.zone3;
            const w = this.state.weather;
            const nowIso = new Date().toISOString();

            if (topic === 'smartfarm/zone01/soil/moisture') {
                return {
                    zone: 'zone01',
                    crop: 'Potato 🥔',
                    sensor: 'capacitive_soil_moisture',
                    pin: 'A0',
                    value: Math.round(z1.moisture * 10) / 10,
                    unit: '%',
                    threshold: z1.threshold,
                    status: z1.moisture < z1.threshold ? 'low' : z1.moisture <= 70 ? 'optimal' : 'saturated',
                    sensor_health: z1.sensorStatus,
                    timestamp: nowIso
                };
            } else if (topic === 'smartfarm/zone02/soil/moisture') {
                return {
                    zone: 'zone02',
                    crop: 'Tomato 🍅',
                    sensor: 'capacitive_soil_moisture',
                    pin: 'A1',
                    value: Math.round(z2.moisture * 10) / 10,
                    unit: '%',
                    threshold: z2.threshold,
                    status: z2.moisture < z2.threshold ? 'low' : z2.moisture <= 70 ? 'optimal' : 'saturated',
                    sensor_health: z2.sensorStatus,
                    timestamp: nowIso
                };
            } else if (topic === 'smartfarm/zone03/soil/moisture') {
                return {
                    zone: 'zone03',
                    crop: 'Brinjal 🍆',
                    sensor: 'capacitive_soil_moisture',
                    pin: 'A2',
                    value: Math.round(z3.moisture * 10) / 10,
                    unit: '%',
                    threshold: z3.threshold,
                    status: z3.moisture < z3.threshold ? 'low' : z3.moisture <= 70 ? 'optimal' : 'saturated',
                    sensor_health: z3.sensorStatus,
                    timestamp: nowIso
                };
            } else if (topic === 'smartfarm/zone01/pump/status') {
                return {
                    zone: 'zone01',
                    device: 'water_pump',
                    relay_pin: 'D4',
                    state: z1.pumpActive ? 'ON' : 'OFF',
                    mode: z1.mode,
                    flow_rate_lph: z1.flowRatePerHour,
                    cumulative_water_liters: Math.round(this.state.totalWaterLiters * 100) / 100,
                    timestamp: nowIso
                };
            } else if (topic === 'smartfarm/weather/dht22') {
                return {
                    station: 'weather_dht22',
                    temperature: Math.round(w.temperature * 10) / 10,
                    humidity: Math.round(w.humidity * 10) / 10,
                    rainfall_mm_h: Math.round(w.rainfall * 10) / 10,
                    condition: w.condition,
                    timestamp: nowIso
                };
            }

            return { topic, timestamp: nowIso, status: 'ok' };
        }

        updateMqttPayloadViewer() {
            if (!this.mqttDom.codeBlock) return;
            const payload = this.generateMqttPayload(this.mqttCurrentTopic);
            this.mqttDom.codeBlock.textContent = JSON.stringify(payload, null, 2);
        }

        executeMqttPubSubCycle(topic) {
            const payload = this.generateMqttPayload(topic);
            this.mqttDom.codeBlock.textContent = JSON.stringify(payload, null, 2);
            this.mqttDom.topicLabel.textContent = topic;

            // Step 1: Publisher glows
            this.mqttDom.publisherCard.classList.add('glow-active');
            this.mqttDom.publisherStatus.textContent = '● Publishing payload...';

            // Step 2: Packet bullet 1 flies
            this.mqttDom.bullet1.classList.remove('anim-wire-1');
            void this.mqttDom.bullet1.offsetWidth; // trigger reflow
            this.mqttDom.bullet1.classList.add('anim-wire-1');

            setTimeout(() => {
                this.mqttDom.publisherCard.classList.remove('glow-active');
                this.mqttDom.publisherStatus.textContent = '● Ready to transmit';

                // Step 3: Broker receives
                this.mqttDom.brokerCard.classList.add('glow-active');
                this.mqttDom.brokerStatus.textContent = `● Routing topic: ${topic}`;

                // Step 4: Packet bullet 2 flies
                this.mqttDom.bullet2.classList.remove('anim-wire-2');
                void this.mqttDom.bullet2.offsetWidth;
                this.mqttDom.bullet2.classList.add('anim-wire-2');

                setTimeout(() => {
                    this.mqttDom.brokerCard.classList.remove('glow-active');
                    this.mqttDom.brokerStatus.textContent = '● Ingestion queue online';

                    // Step 5: Subscriber receives
                    this.mqttDom.subscriberCard.classList.add('glow-active');
                    this.mqttDom.subscriberStatus.textContent = '● Match: smartfarm/# (dispatched)';

                    this.addMqttHistoryEntry(topic, payload);
                    this.showToast(`MQTT Pub/Sub: Delivered ${topic} to Farmer Dashboard! 📨`, 'info');

                    setTimeout(() => {
                        this.mqttDom.subscriberCard.classList.remove('glow-active');
                        this.mqttDom.subscriberStatus.textContent = '● Listening on wildcard filter';
                    }, 800);
                }, 600);
            }, 600);
        }

        addMqttHistoryEntry(topic, payload) {
            this.mqttMessageCount++;
            if (this.mqttDom.countBadge) {
                this.mqttDom.countBadge.textContent = `${this.mqttMessageCount} Messages Sent`;
            }

            const timeStr = new Date().toLocaleTimeString();
            const preview = JSON.stringify(payload).substring(0, 32) + '...';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${timeStr}</td>
                <td><span class="badge-tag" style="background: #E0E7FF; color: #4338CA;">PUB</span></td>
                <td><code>${topic}</code></td>
                <td>QoS 1</td>
                <td><code>${preview}</code></td>
                <td><span style="color: #16A34A; font-weight: 700;">Delivered</span></td>
            `;

            if (this.mqttDom.historyTableBody) {
                this.mqttDom.historyTableBody.prepend(row);
                const rows = this.mqttDom.historyTableBody.children;
                if (rows.length > 7) {
                    this.mqttDom.historyTableBody.removeChild(rows[rows.length - 1]);
                }
            }
        }

        // ======================================================================
        // 21. MULTI-HOP TOPOLOGY SIMULATOR IMPLEMENTATION (FARM REDESIGN)
        // ======================================================================
        initTopologySimulator() {
            this.topoState = {
                mode: 'MULTI_HOP', // 'STAR' or 'MULTI_HOP'
                obstacles: true,
                showPaths: true,
                selectedNode: 1, // 1: Potato, 2: Tomato, 3: Brinjal
                isTransmitting: false
            };

            this.topoDom = {
                btnStar: document.getElementById('btnTopoStar'),
                btnMultiHop: document.getElementById('btnTopoMultiHop'),
                btnToggleObstacles: document.getElementById('btnToggleObstacles'),
                obstacleStatusText: document.getElementById('topoObstacleStatusText'),
                btnTogglePaths: document.getElementById('btnTogglePaths'),
                pathsStatusText: document.getElementById('topoPathsStatusText'),
                btnTransmit: document.getElementById('btnTransmitPacket'),
                btnReset: document.getElementById('btnResetTopology'),

                btnNode1: document.getElementById('btnNodeSelect1'),
                btnNode2: document.getElementById('btnNodeSelect2'),
                btnNode3: document.getElementById('btnNodeSelect3'),

                svgMap: document.getElementById('topologySvgMap'),
                obstacleGroup: document.getElementById('svgObstacleGroup'),
                routingLinesGroup: document.getElementById('svgRoutingLinesGroup'),
                relayGroup: document.getElementById('svgRelayNodesGroup'),
                animatedPacket: document.getElementById('svgAnimatedPacket'),

                svgNode1: document.getElementById('svgSensorNode1'),
                svgNode2: document.getElementById('svgSensorNode2'),
                svgNode3: document.getElementById('svgSensorNode3'),
                svgRelay1: document.getElementById('svgRelay1'),
                svgRelay2: document.getElementById('svgRelay2'),
                relay1Halo: document.getElementById('relay1Halo'),
                relay2Halo: document.getElementById('relay2Halo'),
                svgGateway: document.getElementById('svgCentralGateway'),

                sourceSensorVal: document.getElementById('topoSourceSensorVal'),
                activeModeVal: document.getElementById('topoActiveModeVal'),
                hopCount: document.getElementById('topoHopCount'),
                relayUsedVal: document.getElementById('topoRelayUsedVal'),
                obstacleInterferenceVal: document.getElementById('topoObstacleInterferenceVal'),
                deliveryStatus: document.getElementById('topoDeliveryStatus'),
                routeText: document.getElementById('topoRouteText'),
                rssiText: document.getElementById('topoRssiText')
            };

            // Mode Switching
            if (this.topoDom.btnStar) {
                this.topoDom.btnStar.addEventListener('click', () => {
                    this.topoState.mode = 'STAR';
                    this.topoDom.btnStar.className = 'btn btn-sm btn-primary active';
                    this.topoDom.btnMultiHop.className = 'btn btn-sm btn-outline';
                    if (this.topoDom.relayGroup) {
                        this.topoDom.relayGroup.style.opacity = '0.35';
                    }
                    this.renderTopologyPaths();
                    this.showToast('Topology: Star (Direct Point-to-Point). Packets must reach Gateway directly.', 'info');
                });
            }

            if (this.topoDom.btnMultiHop) {
                this.topoDom.btnMultiHop.addEventListener('click', () => {
                    this.topoState.mode = 'MULTI_HOP';
                    this.topoDom.btnMultiHop.className = 'btn btn-sm btn-primary active';
                    this.topoDom.btnStar.className = 'btn btn-sm btn-outline';
                    if (this.topoDom.relayGroup) {
                        this.topoDom.relayGroup.style.opacity = '1';
                    }
                    this.renderTopologyPaths();
                    this.showToast('Topology: Multi-Hop Mesh. Relay nodes forward packets around obstacles.', 'info');
                });
            }

            // Obstacle Toggle
            if (this.topoDom.btnToggleObstacles) {
                this.topoDom.btnToggleObstacles.addEventListener('click', () => {
                    this.topoState.obstacles = !this.topoState.obstacles;
                    if (this.topoDom.obstacleStatusText) {
                        this.topoDom.obstacleStatusText.textContent = this.topoState.obstacles ? 'ENABLED' : 'DISABLED';
                    }
                    if (this.topoDom.obstacleGroup) {
                        this.topoDom.obstacleGroup.style.display = this.topoState.obstacles ? 'block' : 'none';
                    }
                    this.renderTopologyPaths();
                    this.showToast(`Farm Obstacles ${this.topoState.obstacles ? 'Enabled (Storage Barn & Tree Foliage active)' : 'Cleared (Line-of-Sight open)'}`, 'info');
                });
            }

            // Visual Path Toggle
            if (this.topoDom.btnTogglePaths) {
                this.topoDom.btnTogglePaths.addEventListener('click', () => {
                    this.topoState.showPaths = !this.topoState.showPaths;
                    if (this.topoDom.pathsStatusText) {
                        this.topoDom.pathsStatusText.textContent = this.topoState.showPaths ? 'SHOWN' : 'HIDDEN';
                    }
                    if (this.topoDom.routingLinesGroup) {
                        this.topoDom.routingLinesGroup.style.display = this.topoState.showPaths ? 'block' : 'none';
                    }
                    this.showToast(`Wireless Path Lines ${this.topoState.showPaths ? 'Displayed' : 'Hidden'}`, 'info');
                });
            }

            // Reset Simulator
            if (this.topoDom.btnReset) {
                this.topoDom.btnReset.addEventListener('click', () => {
                    this.topoState.mode = 'MULTI_HOP';
                    this.topoState.obstacles = true;
                    this.topoState.showPaths = true;
                    this.topoState.selectedNode = 1;
                    this.topoState.isTransmitting = false;

                    if (this.topoDom.btnMultiHop) this.topoDom.btnMultiHop.className = 'btn btn-sm btn-primary active';
                    if (this.topoDom.btnStar) this.topoDom.btnStar.className = 'btn btn-sm btn-outline';
                    if (this.topoDom.obstacleStatusText) this.topoDom.obstacleStatusText.textContent = 'ENABLED';
                    if (this.topoDom.obstacleGroup) this.topoDom.obstacleGroup.style.display = 'block';
                    if (this.topoDom.pathsStatusText) this.topoDom.pathsStatusText.textContent = 'SHOWN';
                    if (this.topoDom.routingLinesGroup) this.topoDom.routingLinesGroup.style.display = 'block';
                    if (this.topoDom.relayGroup) this.topoDom.relayGroup.style.opacity = '1';

                    this.selectTopologyNode(1);
                    this.showToast('Simulator reset: Multi-Hop active with obstacles enabled', 'info');
                });
            }

            // Node Selection Handlers (Both UI Buttons and SVG Map Elements)
            const nodeBtns = [
                { id: 1, btn: this.topoDom.btnNode1, svg: this.topoDom.svgNode1 },
                { id: 2, btn: this.topoDom.btnNode2, svg: this.topoDom.svgNode2 },
                { id: 3, btn: this.topoDom.btnNode3, svg: this.topoDom.svgNode3 }
            ];

            nodeBtns.forEach(item => {
                if (item.btn) {
                    item.btn.addEventListener('click', () => {
                        this.selectTopologyNode(item.id);
                    });
                }
                if (item.svg) {
                    item.svg.addEventListener('click', () => {
                        this.selectTopologyNode(item.id);
                        const names = { 1: 'Potato Sensor (Zone 1)', 2: 'Tomato Sensor (Zone 2)', 3: 'Brinjal Sensor (Zone 3)' };
                        this.showToast(`Selected ${names[item.id]} on the farm map`, 'info');
                    });
                }
            });

            // Transmit Packet Action
            if (this.topoDom.btnTransmit) {
                this.topoDom.btnTransmit.addEventListener('click', () => {
                    this.simulatePacketTransmission();
                });
            }

            this.selectTopologyNode(1);
        }

        selectTopologyNode(nodeId) {
            this.topoState.selectedNode = nodeId;
            const nodeBtns = [
                { id: 1, btn: this.topoDom.btnNode1 },
                { id: 2, btn: this.topoDom.btnNode2 },
                { id: 3, btn: this.topoDom.btnNode3 }
            ];
            nodeBtns.forEach(n => {
                if (n.btn) {
                    n.btn.className = (n.id === nodeId) ? 'btn btn-sm btn-outline active' : 'btn btn-sm btn-outline';
                }
            });
            this.renderTopologyPaths();
        }

        renderTopologyPaths() {
            if (!this.topoDom.routingLinesGroup) return;

            // Clear previous paths
            this.topoDom.routingLinesGroup.innerHTML = '';

            const nId = this.topoState.selectedNode;
            const mode = this.topoState.mode;
            const obstacles = this.topoState.obstacles;

            // Accurate coordinates on the 1000x580 Illustrated Farm Map
            // Gateway: (630, 275)
            // Node 1 (Potato): (160, 426)
            // Node 2 (Tomato): (160, 141)
            // Node 3 (Brinjal): (820, 146)
            // Relay 1 (North Path): (440, 99)
            // Relay 2 (South Path): (465, 479)
            // Obstacle Hit 1 (Barn & Foliage): (425, 345)
            // Obstacle Hit 2 (Barn): (390, 209)

            const nodeMetadata = {
                1: { x: 160, y: 426, name: 'Zone 1: Potato Sensor 🥔', crop: 'Potato Farm' },
                2: { x: 160, y: 141, name: 'Zone 2: Tomato Sensor 🍅', crop: 'Tomato Farm' },
                3: { x: 820, y: 146, name: 'Zone 3: Brinjal Sensor 🍆', crop: 'Brinjal Farm' }
            };

            const src = nodeMetadata[nId];

            // Update Telemetry Panel Common Fields
            if (this.topoDom.sourceSensorVal) {
                this.topoDom.sourceSensorVal.textContent = src.name;
            }
            if (this.topoDom.activeModeVal) {
                this.topoDom.activeModeVal.textContent = (mode === 'STAR') ? 'Star (Direct Link)' : 'Multi-Hop Mesh';
            }

            if (mode === 'STAR') {
                // Point-to-Point direct path to Central Gateway (630, 275)
                const isBlocked = obstacles && (nId === 1 || nId === 2);
                const hitX = (nId === 1) ? 425 : 390;
                const hitY = (nId === 1) ? 345 : 209;

                if (isBlocked) {
                    // Draw red dashed line from Sensor that terminates at Obstacle
                    this.topoDom.routingLinesGroup.innerHTML = `
                        <!-- Blocked Direct Signal Path -->
                        <line x1="${src.x}" y1="${src.y}" x2="${hitX}" y2="${hitY}" 
                              stroke="#EF4444" stroke-width="3.5" stroke-dasharray="6,5" stroke-linecap="round"/>
                        <!-- Projected Ghost Path (Blocked) -->
                        <line x1="${hitX}" y1="${hitY}" x2="630" y2="275" 
                              stroke="#7F1D1D" stroke-width="2" stroke-dasharray="3,6" opacity="0.45"/>
                        <!-- Obstruction Barrier Marker -->
                        <g transform="translate(${hitX}, ${hitY})">
                            <circle cx="0" cy="0" r="16" fill="#DC2626" opacity="0.9" filter="url(#topoShadowFilter)"/>
                            <text x="0" y="5" fill="#FFFFFF" font-size="14" font-weight="900" text-anchor="middle">✕</text>
                            <circle cx="0" cy="0" r="22" fill="none" stroke="#EF4444" stroke-width="2" opacity="0.75" class="topo-pulse-anim"/>
                        </g>
                    `;

                    const obstacleName = (nId === 1) ? 'Storage Barn & Tree Foliage' : 'Concrete Storage Barn';
                    if (this.topoDom.deliveryStatus) {
                        this.topoDom.deliveryStatus.textContent = 'PACKET DROPPED ❌';
                        this.topoDom.deliveryStatus.style.color = '#DC2626';
                    }
                    if (this.topoDom.hopCount) {
                        this.topoDom.hopCount.textContent = '0 Hops (Path Blocked)';
                    }
                    if (this.topoDom.relayUsedVal) {
                        this.topoDom.relayUsedVal.textContent = 'None (Direct Star Link)';
                    }
                    if (this.topoDom.obstacleInterferenceVal) {
                        this.topoDom.obstacleInterferenceVal.textContent = `${obstacleName} Blocks LOS 🧱`;
                        this.topoDom.obstacleInterferenceVal.style.color = '#EF4444';
                    }
                    if (this.topoDom.routeText) {
                        this.topoDom.routeText.textContent = `${src.name} ─X─> [${obstacleName}] ──> Gateway`;
                    }
                    if (this.topoDom.rssiText) {
                        this.topoDom.rssiText.textContent = '-110 dBm (Unreachable)';
                    }
                } else {
                    // Clear direct line of sight to Central Gateway
                    this.topoDom.routingLinesGroup.innerHTML = `
                        <!-- Direct Line of Sight Path -->
                        <line x1="${src.x}" y1="${src.y}" x2="630" y2="275" 
                              stroke="#10B981" stroke-width="3.5" stroke-dasharray="6,4" stroke-linecap="round"/>
                        <circle cx="${(src.x + 630) / 2}" cy="${(src.y + 275) / 2}" r="12" fill="#047857" opacity="0.85"/>
                        <text x="${(src.x + 630) / 2}" y="${(src.y + 275) / 2 + 4}" fill="#FFFFFF" font-size="11" font-weight="900" text-anchor="middle">✓</text>
                    `;

                    if (this.topoDom.deliveryStatus) {
                        this.topoDom.deliveryStatus.textContent = 'DELIVERED (100%) ✅';
                        this.topoDom.deliveryStatus.style.color = '#10B981';
                    }
                    if (this.topoDom.hopCount) {
                        this.topoDom.hopCount.textContent = '1 Hop (Direct Line-of-Sight)';
                    }
                    if (this.topoDom.relayUsedVal) {
                        this.topoDom.relayUsedVal.textContent = 'None (Direct Path Available)';
                    }
                    if (this.topoDom.obstacleInterferenceVal) {
                        this.topoDom.obstacleInterferenceVal.textContent = 'Clear Line-of-Sight (Unobstructed) ✨';
                        this.topoDom.obstacleInterferenceVal.style.color = '#10B981';
                    }
                    if (this.topoDom.routeText) {
                        this.topoDom.routeText.textContent = `${src.name} ──> Central Gateway`;
                    }
                    if (this.topoDom.rssiText) {
                        this.topoDom.rssiText.textContent = '-58 dBm (Strong LOS)';
                    }
                }
            } else {
                // MULTI-HOP Mesh Forwarding
                let waypoints = [];
                let routeStr = '';
                let hops = 1;
                let relayName = 'None (Direct Path)';
                let rssi = '-58 dBm';
                let obstacleStatus = 'Clear Line-of-Sight ✨';

                if (nId === 1) {
                    // Node 1 (Potato) -> Relay Node 02 (South: 465, 479) -> Central Gateway (630, 275)
                    waypoints = [
                        { x1: 160, y1: 426, x2: 465, y2: 479, label: 'Hop 1' },
                        { x1: 465, y1: 479, x2: 630, y2: 275, label: 'Hop 2' }
                    ];
                    routeStr = 'Potato Sensor ➔ Relay Node 02 (South) ➔ Central Gateway';
                    hops = 2;
                    relayName = 'Relay Node 02 (South Path)';
                    rssi = '-68 dBm (Strong via Relay 2)';
                    obstacleStatus = 'Bypassed around Trees & Barn via Relay 02 🛡️';
                } else if (nId === 2) {
                    // Node 2 (Tomato) -> Relay Node 01 (North: 440, 99) -> Central Gateway (630, 275)
                    waypoints = [
                        { x1: 160, y1: 141, x2: 440, y2: 99, label: 'Hop 1' },
                        { x1: 440, y1: 99, x2: 630, y2: 275, label: 'Hop 2' }
                    ];
                    routeStr = 'Tomato Sensor ➔ Relay Node 01 (North) ➔ Central Gateway';
                    hops = 2;
                    relayName = 'Relay Node 01 (North Path)';
                    rssi = '-66 dBm (Strong via Relay 1)';
                    obstacleStatus = 'Bypassed around Storage Barn via Relay 01 🛡️';
                } else {
                    // Node 3 (Brinjal) -> Central Gateway (Direct LOS)
                    waypoints = [
                        { x1: 820, y1: 146, x2: 630, y2: 275, label: 'Direct Hop' }
                    ];
                    routeStr = 'Brinjal Sensor ➔ Central Gateway (Direct LOS)';
                    hops = 1;
                    relayName = 'None (Direct Path Available)';
                    rssi = '-58 dBm (Excellent Direct LOS)';
                    obstacleStatus = 'Clear Line-of-Sight (Unobstructed) ✨';
                }

                this.topoDom.routingLinesGroup.innerHTML = waypoints.map(wp => `
                    <line x1="${wp.x1}" y1="${wp.y1}" x2="${wp.x2}" y2="${wp.y2}" 
                          stroke="#38BDF8" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="8,4"/>
                    <!-- Midpoint Hop Arrow Badge -->
                    <g transform="translate(${(wp.x1 + wp.x2) / 2}, ${(wp.y1 + wp.y2) / 2})">
                        <circle cx="0" cy="0" r="10" fill="#0C4A6E" stroke="#38BDF8" stroke-width="1.5"/>
                        <text x="0" y="3.5" fill="#38BDF8" font-size="9" font-weight="900" text-anchor="middle">➔</text>
                    </g>
                `).join('');

                if (this.topoDom.deliveryStatus) {
                    this.topoDom.deliveryStatus.textContent = 'DELIVERED (100%) ✅';
                    this.topoDom.deliveryStatus.style.color = '#10B981';
                }
                if (this.topoDom.hopCount) {
                    this.topoDom.hopCount.textContent = `${hops} ${hops === 1 ? 'Hop (Direct)' : 'Hops (Relayed Mesh)'}`;
                }
                if (this.topoDom.relayUsedVal) {
                    this.topoDom.relayUsedVal.textContent = relayName;
                }
                if (this.topoDom.obstacleInterferenceVal) {
                    this.topoDom.obstacleInterferenceVal.textContent = obstacleStatus;
                    this.topoDom.obstacleInterferenceVal.style.color = '#10B981';
                }
                if (this.topoDom.routeText) {
                    this.topoDom.routeText.textContent = routeStr;
                }
                if (this.topoDom.rssiText) {
                    this.topoDom.rssiText.textContent = rssi;
                }
            }
        }

        simulatePacketTransmission() {
            if (this.topoState.isTransmitting) return;
            this.topoState.isTransmitting = true;

            const nId = this.topoState.selectedNode;
            const mode = this.topoState.mode;
            const obstacles = this.topoState.obstacles;
            const pkt = this.topoDom.animatedPacket;

            const nodeCoords = {
                1: { x: 160, y: 426, name: 'Potato Sensor' },
                2: { x: 160, y: 141, name: 'Tomato Sensor' },
                3: { x: 820, y: 146, name: 'Brinjal Sensor' }
            };
            const src = nodeCoords[nId];

            pkt.setAttribute('cx', src.x);
            pkt.setAttribute('cy', src.y);
            pkt.style.opacity = '1';
            pkt.setAttribute('fill', '#FACC15');

            if (mode === 'STAR' && obstacles && (nId === 1 || nId === 2)) {
                // Packet travels towards Gateway but collides with physical obstacle
                const targetX = (nId === 1) ? 425 : 390;
                const targetY = (nId === 1) ? 345 : 209;
                const obstacleLabel = (nId === 1) ? 'Storage Barn & Tree Foliage' : 'Concrete Storage Barn';

                let progress = 0;
                const interval = setInterval(() => {
                    progress += 0.05;
                    const curX = src.x + (targetX - src.x) * progress;
                    const curY = src.y + (targetY - src.y) * progress;
                    pkt.setAttribute('cx', curX);
                    pkt.setAttribute('cy', curY);

                    if (progress >= 1) {
                        clearInterval(interval);
                        pkt.setAttribute('fill', '#EF4444');
                        this.showToast(`Transmission Failed: Signal blocked by ${obstacleLabel}! In Star Topology, packet cannot reach gateway. ❌`, 'danger');
                        setTimeout(() => {
                            pkt.style.opacity = '0';
                            pkt.setAttribute('fill', '#FACC15');
                            this.topoState.isTransmitting = false;
                        }, 900);
                    }
                }, 20);
            } else if (mode === 'STAR') {
                // Direct Line to Gateway (630, 275)
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 0.045;
                    const curX = src.x + (630 - src.x) * progress;
                    const curY = src.y + (275 - src.y) * progress;
                    pkt.setAttribute('cx', curX);
                    pkt.setAttribute('cy', curY);

                    if (progress >= 1) {
                        clearInterval(interval);
                        pkt.setAttribute('fill', '#10B981');
                        this.showToast('Direct Packet Delivered to Central IoT Gateway (1 Hop, Line-of-Sight) ✅', 'success');
                        setTimeout(() => {
                            pkt.style.opacity = '0';
                            pkt.setAttribute('fill', '#FACC15');
                            this.topoState.isTransmitting = false;
                        }, 600);
                    }
                }, 20);
            } else {
                // MULTI-HOP Topology Animation
                const relay = (nId === 1) ? { x: 465, y: 479, name: 'Relay Node 02 (South)', halo: this.topoDom.relay2Halo }
                            : (nId === 2) ? { x: 440, y: 99, name: 'Relay Node 01 (North)', halo: this.topoDom.relay1Halo }
                            : null;

                if (relay) {
                    // STAGE 1: Sensor -> Relay Node
                    let progress1 = 0;
                    const interval1 = setInterval(() => {
                        progress1 += 0.05;
                        pkt.setAttribute('cx', src.x + (relay.x - src.x) * progress1);
                        pkt.setAttribute('cy', src.y + (relay.y - src.y) * progress1);

                        if (progress1 >= 1) {
                            clearInterval(interval1);
                            // Flash Relay Halo
                            if (relay.halo) {
                                relay.halo.setAttribute('stroke', '#34D399');
                                relay.halo.setAttribute('stroke-width', '3.5');
                            }
                            this.showToast(`Hop 1 Complete: Packet received by ${relay.name} 🔄 Forwarding...`, 'info');

                            // STAGE 2: Relay Node -> Central Gateway
                            setTimeout(() => {
                                let progress2 = 0;
                                const interval2 = setInterval(() => {
                                    progress2 += 0.05;
                                    pkt.setAttribute('cx', relay.x + (630 - relay.x) * progress2);
                                    pkt.setAttribute('cy', relay.y + (275 - relay.y) * progress2);

                                    if (progress2 >= 1) {
                                        clearInterval(interval2);
                                        pkt.setAttribute('fill', '#10B981');
                                        if (relay.halo) {
                                            relay.halo.setAttribute('stroke', '#38BDF8');
                                            relay.halo.setAttribute('stroke-width', '1.8');
                                        }
                                        this.showToast('Hop 2 Complete: Packet Successfully Delivered to Central Gateway via Multi-Hop Mesh! (2 Hops) ✅', 'success');
                                        setTimeout(() => {
                                            pkt.style.opacity = '0';
                                            pkt.setAttribute('fill', '#FACC15');
                                            this.topoState.isTransmitting = false;
                                        }, 600);
                                    }
                                }, 20);
                            }, 250);
                        }
                    }, 20);
                } else {
                    // Node 3 Direct Line of Sight to Gateway
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += 0.045;
                        pkt.setAttribute('cx', src.x + (630 - src.x) * progress);
                        pkt.setAttribute('cy', src.y + (275 - src.y) * progress);

                        if (progress >= 1) {
                            clearInterval(interval);
                            pkt.setAttribute('fill', '#10B981');
                            this.showToast('Direct Packet Delivered from Brinjal Sensor to Gateway (1 Hop) ✅', 'success');
                            setTimeout(() => {
                                pkt.style.opacity = '0';
                                pkt.setAttribute('fill', '#FACC15');
                                this.topoState.isTransmitting = false;
                            }, 600);
                        }
                    }, 20);
                }
            }
        }

        // ======================================================================
        // 22. COMPLETE IOT DATA & CONTROL FLOW IMPLEMENTATION
        // ======================================================================
        initFlowsSimulator() {
            this.currentFlowStage = 1;
            this.flowAnimInterval = null;

            this.flowStages = [
                {
                    num: 1,
                    name: 'Stage 1: Physical Transducer Sampling',
                    detail: 'The capacitive soil moisture probe detects changes in dielectric permittivity around crop root zones and converts moisture content into an analog voltage signal ranging from 0V (dry) to 3.3V (saturated).'
                },
                {
                    num: 2,
                    name: 'Stage 2: Sensor Node ADC Conversion',
                    detail: 'The field microcontroller samples the analog pin (A0–A2) using a 10-bit Analog-to-Digital Converter, mapping voltage to a calibrated 0–100% soil moisture volumetric percentage.'
                },
                {
                    num: 3,
                    name: 'Stage 3: Multi-Hop Wireless Forwarding',
                    detail: 'The sensor node transmits a low-power radio packet to neighboring Relay Nodes to route around obstacles such as the concrete storage barn and metal grain silos.'
                },
                {
                    num: 4,
                    name: 'Stage 4: Edge Gateway Ingestion & Translation',
                    detail: 'The central farm gateway receives wireless packets from field relays, performs range verification, and normalizes telemetry into standard JSON structures.'
                },
                {
                    num: 5,
                    name: 'Stage 5: MQTT Broker Topic Processing',
                    detail: 'The gateway publishes telemetry over TCP/IP port 1883 to the MQTT broker topic "smartfarm/zone01/soil/moisture". The broker evaluates registered subscriber filters.'
                },
                {
                    num: 6,
                    name: 'Stage 6: Dashboard Subscriber Ingestion',
                    detail: 'The Farmer Dashboard application, subscribed to "smartfarm/#", receives the message packet, verifies QoS 1 delivery, and deserializes JSON into memory.'
                },
                {
                    num: 7,
                    name: 'Stage 7: Closed-Loop Decision & Visual Display',
                    detail: 'The dashboard updates large readable metrics, and the closed-loop decision engine evaluates whether Soil Moisture < Threshold to trigger reverse pump commands.'
                }
            ];

            this.flowsDom = {
                btnPlay: document.getElementById('btnPlayFlowAnim'),
                btnNext: document.getElementById('btnStepFlowNext'),
                btnPrev: document.getElementById('btnStepFlowPrev'),
                stageName: document.getElementById('flowStageName'),
                stageDetailTitle: document.getElementById('flowDetailTitle'),
                stageDetailText: document.getElementById('flowDetailText'),
                dataNodes: document.querySelectorAll('#dataFlowNodesRow .flow-node-item'),
                controlNodes: document.querySelectorAll('#controlFlowNodesRow .flow-node-item')
            };

            if (this.flowsDom.btnNext) {
                this.flowsDom.btnNext.addEventListener('click', () => {
                    this.setFlowStage((this.currentFlowStage % 7) + 1);
                });
            }

            if (this.flowsDom.btnPrev) {
                this.flowsDom.btnPrev.addEventListener('click', () => {
                    this.setFlowStage(this.currentFlowStage === 1 ? 7 : this.currentFlowStage - 1);
                });
            }

            if (this.flowsDom.btnPlay) {
                this.flowsDom.btnPlay.addEventListener('click', () => {
                    if (this.flowAnimInterval) {
                        clearInterval(this.flowAnimInterval);
                        this.flowAnimInterval = null;
                        this.flowsDom.btnPlay.innerHTML = '<span>⏯</span> Play Full Flow Animation';
                    } else {
                        this.flowsDom.btnPlay.innerHTML = '<span>⏸</span> Pause Animation';
                        this.flowAnimInterval = setInterval(() => {
                            this.setFlowStage((this.currentFlowStage % 7) + 1);
                        }, 2200);
                    }
                });
            }

            this.setFlowStage(1);
        }

        setFlowStage(index) {
            this.currentFlowStage = index;
            const stage = this.flowStages[index - 1];
            if (!stage || !this.flowsDom.stageName) return;

            this.flowsDom.stageName.textContent = stage.name;
            this.flowsDom.stageDetailTitle.textContent = stage.name;
            this.flowsDom.stageDetailText.textContent = stage.detail;

            // Highlight data flow node
            this.flowsDom.dataNodes.forEach(node => {
                const s = parseInt(node.getAttribute('data-stage'), 10);
                if (s === index) node.classList.add('active-stage');
                else node.classList.remove('active-stage');
            });

            // Highlight control flow node
            this.flowsDom.controlNodes.forEach(node => {
                const sStr = node.getAttribute('data-stage');
                const s = parseInt(sStr.replace('c', ''), 10);
                if (s === index) node.classList.add('active-stage');
                else node.classList.remove('active-stage');
            });
        }

        // ======================================================================
        // 23. LOCAL VS REMOTE ARCHITECTURE COMPARATOR
        // ======================================================================
        initArchComparator() {
            const cardLocal = document.getElementById('archCardLocal');
            const cardRemote = document.getElementById('archCardRemote');

            if (cardLocal && cardRemote) {
                cardLocal.addEventListener('click', () => {
                    cardLocal.classList.add('arch-highlight');
                    cardRemote.classList.remove('arch-highlight');
                    this.showToast('Local Edge Architecture selected (Implemented in SmartFarm)', 'info');
                });

                cardRemote.addEventListener('click', () => {
                    cardRemote.classList.add('arch-highlight');
                    cardLocal.classList.remove('arch-highlight');
                    this.showToast('Remote Cloud Architecture selected (Educational Comparison Model)', 'info');
                });
            }
        }

        startLiveClock() {
            const update = () => {
                const now = new Date();
                this.dom.liveClock.textContent = now.toLocaleTimeString();
            };
            update();
            setInterval(update, 1000);
        }
    }

    // Initialize application when DOM is ready
    window.addEventListener('DOMContentLoaded', () => {
        window.smartFarmApp = new SmartFarmFriendlyController();
    });
})();
