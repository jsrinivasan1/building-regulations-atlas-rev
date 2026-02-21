// Building Regulations Atlas - Main Application

// Global state
let atlasData = null;
let map = null;
let geojsonLayer = null;
let countryLayers = {};

// Country code to name mapping for Africa
const countryCoordinates = {
    'AGO': { lat: -12.5, lng: 18.5, name: 'Angola' },
    'BEN': { lat: 9.3, lng: 2.3, name: 'Benin' },
    'BWA': { lat: -22.3, lng: 24.7, name: 'Botswana' },
    'BFA': { lat: 12.2, lng: -1.5, name: 'Burkina Faso' },
    'CMR': { lat: 5.9, lng: 12.4, name: 'Cameroon' },
    'CPV': { lat: 15.1, lng: -23.6, name: 'Cabo Verde' },
    'CAF': { lat: 6.6, lng: 20.9, name: 'Central African Republic' },
    'TCD': { lat: 15.4, lng: 18.7, name: 'Chad' },
    'COD': { lat: -4.0, lng: 21.8, name: 'Congo, Dem. Rep.' },
    'COG': { lat: -0.2, lng: 15.8, name: 'Congo, Rep.' },
    'GNQ': { lat: 1.6, lng: 10.3, name: 'Equatorial Guinea' },
    'GMB': { lat: 13.4, lng: -15.4, name: 'Gambia, The' },
    'GHA': { lat: 7.9, lng: -1.0, name: 'Ghana' },
    'LSO': { lat: -29.6, lng: 28.2, name: 'Lesotho' },
    'MDG': { lat: -18.9, lng: 46.9, name: 'Madagascar' },
    'MLI': { lat: 17.6, lng: -4.0, name: 'Mali' },
    'MUS': { lat: -20.3, lng: 57.6, name: 'Mauritius' },
    'NAM': { lat: -22.6, lng: 17.1, name: 'Namibia' },
    'RWA': { lat: -1.9, lng: 29.9, name: 'Rwanda' },
    'SEN': { lat: 14.5, lng: -14.5, name: 'Senegal' },
    'SYC': { lat: -4.7, lng: 55.5, name: 'Seychelles' },
    'SLE': { lat: 8.5, lng: -11.8, name: 'Sierra Leone' },
    'SSD': { lat: 7.9, lng: 30.0, name: 'South Sudan' },
    'SWZ': { lat: -26.5, lng: 31.5, name: 'Eswatini' },
    'TZA': { lat: -6.4, lng: 34.9, name: 'Tanzania' },
    'TGO': { lat: 8.6, lng: 0.8, name: 'Togo' }
};

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    await loadData();
    initializeMap();
    populateCountrySelect();
    setupEventListeners();
});

// Load all data
async function loadData() {
    try {
        const response = await fetch('data/atlas_data.json');
        atlasData = await response.json();
        console.log('Data loaded:', atlasData.countries.length, 'countries,', atlasData.indicators.length, 'indicators');
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Initialize Leaflet map
function initializeMap() {
    // Create map centered on Africa
    map = L.map('map', {
        center: [0, 20],
        zoom: 3,
        minZoom: 2,
        maxZoom: 8,
        zoomControl: true
    });

    // Add tile layer (using CartoDB light style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Load GeoJSON for African countries
    loadCountryBoundaries();
}

// Load country boundaries
async function loadCountryBoundaries() {
    try {
        // Using Natural Earth data via GitHub
        const response = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
        const geojson = await response.json();
        
        // Filter to only include our countries
        const ourCountryCodes = Object.keys(countryCoordinates);
        const filteredFeatures = geojson.features.filter(feature => {
            const code = feature.properties.ISO_A3;
            return ourCountryCodes.includes(code);
        });

        // Add to map
        geojsonLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
            style: feature => getCountryStyle(feature.properties.ISO_A3),
            onEachFeature: onEachCountry
        }).addTo(map);

        // Fit bounds to show all countries
        if (filteredFeatures.length > 0) {
            map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
        }
    } catch (error) {
        console.error('Error loading boundaries:', error);
        // Fallback: add circle markers for each country
        addCountryMarkers();
    }
}

// Fallback: Add circle markers
function addCountryMarkers() {
    Object.entries(countryCoordinates).forEach(([code, coords]) => {
        const color = getCountryColor(code);
        const marker = L.circleMarker([coords.lat, coords.lng], {
            radius: 15,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        marker.bindTooltip(createTooltipContent(code), {
            permanent: false,
            direction: 'top',
            className: 'country-tooltip'
        });

        marker.on('click', () => openCountryModal(code));
        countryLayers[code] = marker;
    });
}

// Get country style based on data availability
function getCountryStyle(countryCode) {
    return {
        fillColor: getCountryColor(countryCode),
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.7
    };
}

// Get color based on data availability
function getCountryColor(countryCode) {
    if (!atlasData || !atlasData.data) return '#cccccc';
    
    const countryData = atlasData.data[countryCode];
    if (!countryData) return '#cccccc';
    
    const dataCount = Object.keys(countryData).length;
    
    // Check for SSBRR data (has detailed report)
    const hasSSBRR = Object.keys(countryData).some(k => k.startsWith('SSBRR'));
    
    if (hasSSBRR && dataCount > 50) {
        return '#1a5a9c'; // B-READY + BRR Report
    } else if (dataCount > 0) {
        return '#4a9fd4'; // B-READY Only
    }
    return '#cccccc'; // No Data
}

// Setup country interactions
function onEachCountry(feature, layer) {
    const code = feature.properties.ISO_A3;
    const name = countryCoordinates[code]?.name || feature.properties.ADMIN;
    
    // Tooltip on hover
    layer.bindTooltip(createTooltipContent(code), {
        permanent: false,
        direction: 'auto',
        className: 'country-tooltip'
    });

    // Highlight on hover
    layer.on({
        mouseover: e => {
            e.target.setStyle({
                weight: 3,
                color: '#002244',
                fillOpacity: 0.9
            });
        },
        mouseout: e => {
            geojsonLayer.resetStyle(e.target);
        },
        click: e => {
            openCountryModal(code);
        }
    });

    countryLayers[code] = layer;
}

// Create tooltip content
function createTooltipContent(countryCode) {
    const coords = countryCoordinates[countryCode];
    const name = coords?.name || countryCode;
    const countryData = atlasData?.data?.[countryCode] || {};
    const dataCount = Object.keys(countryData).length;
    
    // Check data sources
    const hasBReady = Object.keys(countryData).some(k => k.startsWith('BR_'));
    const hasSSBRR = Object.keys(countryData).some(k => k.startsWith('SSBRR'));
    const hasGABC = Object.keys(countryData).some(k => k.startsWith('GABC'));
    
    let dataStatus = 'No Data';
    if (hasBReady && hasSSBRR) dataStatus = 'B-READY + BRR Report';
    else if (hasBReady) dataStatus = 'B-READY Only';
    else if (hasSSBRR) dataStatus = 'BRR Report Only';
    
    // Check for building regulation
    const hasBuildingReg = countryData['BR_1_2_1_1_1'] === 'Yes';
    
    return `
        <div class="country-tooltip">
            <h3>${name}</h3>
            <div class="tooltip-item">
                <span class="tooltip-label">Data Available</span>
                <span class="tooltip-value">${dataStatus}</span>
            </div>
            <div class="tooltip-item">
                <span class="tooltip-label">Building Regulation</span>
                <span class="tooltip-value">${hasBuildingReg ? 'Yes' : (countryData['BR_1_2_1_1_1'] ? 'No' : 'N/A')}</span>
            </div>
            <div class="tooltip-item">
                <span class="tooltip-label">Indicators</span>
                <span class="tooltip-value">${dataCount}</span>
            </div>
            <div class="tooltip-cta">Click for full country profile</div>
        </div>
    `;
}

// Populate country dropdown
function populateCountrySelect() {
    const select = document.getElementById('country-select');
    if (!atlasData) return;

    atlasData.countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        select.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Subtopic toggles
    document.querySelectorAll('.subtopic-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const targetId = btn.dataset.target;
            const target = document.getElementById(targetId);
            target.classList.toggle('show');
            btn.classList.toggle('expanded');
        });
    });

    // Apply filters button
    document.getElementById('apply-filters').addEventListener('click', applyFilters);

    // Country select change
    document.getElementById('country-select').addEventListener('change', e => {
        if (e.target.value) {
            openCountryModal(e.target.value);
        }
    });

    // Modal close
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('country-modal').addEventListener('click', e => {
        if (e.target.id === 'country-modal') closeModal();
    });

    // Download buttons
    document.getElementById('download-csv').addEventListener('click', downloadCSV);
    document.getElementById('download-pdf').addEventListener('click', downloadPDF);

    // Close dropdowns when clicking outside
    document.addEventListener('click', e => {
        if (!e.target.closest('.topic-item')) {
            document.querySelectorAll('.subtopics').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.subtopic-toggle').forEach(el => el.classList.remove('expanded'));
        }
    });
}

// Apply filters
function applyFilters() {
    const selectedCountry = document.getElementById('country-select').value;
    
    // Get selected topics
    const selectedTopics = [];
    document.querySelectorAll('.topic-checkboxes > .topic-item > input:checked').forEach(cb => {
        selectedTopics.push(cb.value);
    });

    // Get selected subtopics
    const selectedSubtopics = [];
    document.querySelectorAll('.subtopics input:checked').forEach(cb => {
        selectedSubtopics.push(cb.value);
    });

    console.log('Filters applied:', { selectedCountry, selectedTopics, selectedSubtopics });

    // If country selected, open modal
    if (selectedCountry) {
        openCountryModal(selectedCountry, selectedTopics, selectedSubtopics);
    }

    // Update map colors based on topic filter
    updateMapForTopics(selectedTopics, selectedSubtopics);
}

// Update map based on topics
function updateMapForTopics(topics, subtopics) {
    // For now, just highlight/dim countries based on data availability for selected topics
    // This could be enhanced to show more detailed filtering
    console.log('Map update for topics:', topics);
}

// Open country modal
function openCountryModal(countryCode, filterTopics = null, filterSubtopics = null) {
    const modal = document.getElementById('country-modal');
    const countryInfo = atlasData.countries.find(c => c.code === countryCode);
    const countryData = atlasData.data[countryCode] || {};

    if (!countryInfo) {
        console.error('Country not found:', countryCode);
        return;
    }

    // Set country name
    document.getElementById('modal-country-name').textContent = countryInfo.name;

    // Set highlights
    const highlightsContainer = document.getElementById('modal-highlights');
    const dataCount = Object.keys(countryData).length;
    const hasBuildingReg = countryData['BR_1_2_1_1_1'] === 'Yes';
    
    highlightsContainer.innerHTML = `
        <div class="highlight-item">
            <div class="highlight-label">Region</div>
            <div class="highlight-value">${countryInfo.region || 'Sub-Saharan Africa'}</div>
        </div>
        <div class="highlight-item">
            <div class="highlight-label">Income Group</div>
            <div class="highlight-value">${countryInfo.income_group || 'N/A'}</div>
        </div>
        <div class="highlight-item">
            <div class="highlight-label">Building Regulation</div>
            <div class="highlight-value">${hasBuildingReg ? 'Available' : 'Not Available'}</div>
        </div>
        <div class="highlight-item">
            <div class="highlight-label">Data Points</div>
            <div class="highlight-value">${dataCount}</div>
        </div>
    `;

    // Build modal body content
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = buildCountryDataSections(countryCode, countryData, filterTopics, filterSubtopics);

    // Setup section toggles
    modalBody.querySelectorAll('.data-section-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });

    // Store current country for downloads
    modal.dataset.countryCode = countryCode;

    // Show modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Build data sections HTML
function buildCountryDataSections(countryCode, countryData, filterTopics, filterSubtopics) {
    const sections = {
        'Planning and Zoning': { icon: '📍', indicators: [] },
        'Building Design': {
            icon: '🏗️',
            subsections: {
                'General Provisions': [],
                'Building Classification': [],
                'Structural Resilience': [],
                'Fire Safety': [],
                'Green Buildings': [],
                'Universal Accessibility': [],
                'Services': []
            }
        },
        'Materials': { icon: '🧱', indicators: [] },
        'Compliance Mechanisms': {
            icon: '✓',
            subsections: {
                'Building Control': [],
                'Transparency and Access to Information': [],
                'Dispute Resolution': [],
                'Professional Registration': []
            }
        }
    };

    // Group indicators by topic
    atlasData.indicators.forEach(indicator => {
        const topic = indicator.main_topic;
        const subtopic = indicator.sub_topic;
        const value = countryData[indicator.id];
        
        if (value === undefined || value === null) return;

        const entry = {
            id: indicator.id,
            name: indicator.name || indicator.id,
            value: value,
            source: indicator.source
        };

        if (sections[topic]) {
            if (sections[topic].subsections && subtopic) {
                if (sections[topic].subsections[subtopic]) {
                    sections[topic].subsections[subtopic].push(entry);
                }
            } else if (sections[topic].indicators) {
                sections[topic].indicators.push(entry);
            }
        }
    });

    // Build HTML
    let html = '';

    Object.entries(sections).forEach(([topicName, topicData]) => {
        // Check if topic should be shown based on filters
        if (filterTopics && !filterTopics.includes(topicName)) return;

        let hasData = false;
        let contentHtml = '';

        if (topicData.subsections) {
            Object.entries(topicData.subsections).forEach(([subName, indicators]) => {
                // Check subtopic filter
                if (filterSubtopics && filterSubtopics.length > 0 && !filterSubtopics.includes(subName)) return;
                
                if (indicators.length > 0) {
                    hasData = true;
                    contentHtml += `<h5 style="margin: 1rem 0 0.5rem; color: #58595b; font-size: 0.9rem;">${subName}</h5>`;
                    contentHtml += buildDataTable(indicators);
                }
            });
        } else if (topicData.indicators && topicData.indicators.length > 0) {
            hasData = true;
            contentHtml = buildDataTable(topicData.indicators);
        }

        if (hasData) {
            html += `
                <div class="data-section">
                    <div class="data-section-header">
                        <div class="data-section-title">
                            <span class="section-icon">${topicData.icon}</span>
                            ${topicName}
                        </div>
                        <span class="section-toggle">▼</span>
                    </div>
                    <div class="data-section-content">
                        ${contentHtml}
                    </div>
                </div>
            `;
        }
    });

    if (!html) {
        html = '<p style="text-align: center; color: #999; padding: 2rem;">No data available for selected filters.</p>';
    }

    return html;
}

// Build data table
function buildDataTable(indicators) {
    let html = '<table class="data-table">';
    
    indicators.forEach(ind => {
        let valueClass = '';
        let displayValue = ind.value;
        
        if (ind.value === 'Yes') valueClass = 'data-value-yes';
        else if (ind.value === 'No') valueClass = 'data-value-no';
        else if (ind.value === null || ind.value === undefined || ind.value === 'N/A') {
            valueClass = 'data-value-na';
            displayValue = 'N/A';
        }

        html += `
            <tr>
                <td>${ind.name || ind.id}</td>
                <td class="${valueClass}">${displayValue}</td>
            </tr>
        `;
    });

    html += '</table>';
    return html;
}

// Close modal
function closeModal() {
    const modal = document.getElementById('country-modal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Reset country select
    document.getElementById('country-select').value = '';
}

// Download CSV
function downloadCSV() {
    const modal = document.getElementById('country-modal');
    const countryCode = modal.dataset.countryCode;
    const countryInfo = atlasData.countries.find(c => c.code === countryCode);
    const countryData = atlasData.data[countryCode] || {};

    let csv = 'Indicator ID,Topic,Sub-topic,Indicator Name,Value,Source\n';

    atlasData.indicators.forEach(indicator => {
        const value = countryData[indicator.id];
        if (value !== undefined && value !== null) {
            const row = [
                indicator.id,
                indicator.main_topic,
                indicator.sub_topic || '',
                `"${(indicator.name || '').replace(/"/g, '""')}"`,
                `"${String(value).replace(/"/g, '""')}"`,
                indicator.source || ''
            ].join(',');
            csv += row + '\n';
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${countryInfo.name.replace(/[^a-z0-9]/gi, '_')}_building_regulations.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Download PDF (simplified - creates printable HTML)
function downloadPDF() {
    const modal = document.getElementById('country-modal');
    const countryCode = modal.dataset.countryCode;
    const countryInfo = atlasData.countries.find(c => c.code === countryCode);

    // Open print dialog for the modal content
    const printContent = document.querySelector('.modal-content').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${countryInfo.name} - Building Regulations Atlas</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; }
                h2 { color: #002244; }
                table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                td { padding: 0.5rem; border-bottom: 1px solid #ddd; }
                td:last-child { text-align: right; font-weight: bold; }
                .data-section { margin: 1.5rem 0; }
                .data-section-header { background: #e8e8e8; padding: 0.75rem; font-weight: bold; }
                .modal-footer { display: none; }
                .modal-close { display: none; }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Console welcome message
console.log('%c Building Regulations Atlas ', 'background: #002244; color: white; font-size: 16px; padding: 8px;');
console.log('Data loaded from World Bank Group');
