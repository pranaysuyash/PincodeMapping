(function() {
    'use strict';

    // Application scope variables for Leaflet
    let map;
    let markersLayer; // Layer group for markers
    let pincodeData = {}; // Stores processed data from CSV

    /**
     * Initializes the Leaflet Map.
     */
    function initializeLeafletMap() {
        map = L.map('map').setView([20.5937, 78.9629], 5); // Default view (India)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18, // Max zoom for OpenStreetMap
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        markersLayer = L.layerGroup().addTo(map);
        // console.log("Leaflet map initialized."); // Removed for final version
    }

    /**
     * Displays a notification message on the screen.
     * @param {string} message - The message to display.
     * @param {'success'|'error'|'info'|'processing'} type - The type of notification.
     * @returns {HTMLElement} The notification DOM element.
     */
    function showNotification(message, type) {
        const notificationsDiv = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.classList.add('notification', type);
        notification.innerHTML = message; // Using innerHTML to allow simple HTML tags in message
        notificationsDiv.appendChild(notification);

        // Automatically remove the notification after 5 seconds, unless it's a 'processing' type
        if (type !== 'processing') {
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
        return notification;
    }

    /**
     * Parses CSV text data into a structured pincodeData object.
     * Expected CSV format: Store Name, Pincode, Latitude, Longitude (no header row).
     * @param {string} csvText - The raw CSV text.
     * @returns {{data: object, skippedRows: number, processedRows: number, error?: string}}
     *           An object containing the parsed data, count of skipped rows, processed rows, and an optional error message.
     */
    function parsePincodeCSVData(csvText) {
        const data = {};
        let skippedRows = 0;
        let processedRows = 0;
        const lines = csvText.split('\n');

        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
            return { data, skippedRows, processedRows, error: "CSV file is empty or contains no data." };
        }

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                // Skip empty lines, potentially increment skippedRows if considered an issue
                // For now, just ignore them silently if they are truly blank.
                if (index < lines.length -1 || trimmedLine.length > 0) { // don't count last empty line if file ends with \n
                     // console.warn(`Skipping empty line at row ${index + 1}.`);
                     // skippedRows++; // Decide if truly empty lines count as skipped
                }
                return;
            }

            processedRows++;
            const parts = trimmedLine.split(',');

            if (parts.length < 4) {
                console.warn(`Skipping malformed line (not enough columns): ${trimmedLine} at row ${index + 1}`);
                skippedRows++;
                return;
            }

            const storeName = parts[0].trim();
            const pincode = parts[1].trim();
            const latStr = parts[2].trim();
            const lngStr = parts[3].trim();
            // Additional parts (parts[4] onwards) are currently ignored.

            if (!storeName) {
                console.warn(`Skipping row ${index + 1} due to missing store name: ${trimmedLine}`);
                skippedRows++;
                return;
            }
            if (!pincode) {
                console.warn(`Skipping row ${index + 1} due to missing pincode: ${trimmedLine}`);
                skippedRows++;
                return;
            }

            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);

            if (isNaN(lat) || isNaN(lng)) {
                console.warn(`Skipping row ${index + 1} due to invalid latitude/longitude: ${trimmedLine}`);
                skippedRows++;
                return;
            }

            if (!data[pincode]) {
                data[pincode] = { lat: lat, lng: lng, stores: [] };
            }
            // If lat/lng for an existing pincode differs, this will overwrite. Consider strategy if needed.
            // For now, last entry for a pincode's lat/lng wins if multiple distinct ones exist.
            data[pincode].lat = lat;
            data[pincode].lng = lng;
            data[pincode].stores.push(storeName);
        });

        return { data, skippedRows, processedRows };
    }


    /**
     * Handles the CSV file upload event.
     * Reads the file, parses its content, and updates the application state.
     * @param {Event} event - The file input change event.
     */
    function handleFileUpload(event) {
        const file = event.target.files[0];
        const csvFileNameSpan = document.getElementById('csvFileName');
        let processingNotification;

        if (file) {
            csvFileNameSpan.textContent = file.name;
            processingNotification = showNotification('Processing CSV file...', 'processing');
            const reader = new FileReader();

            reader.onload = function(e) {
                if (processingNotification) processingNotification.remove();

                try {
                    const result = parsePincodeCSVData(e.target.result);

                    if (result.error) {
                        showNotification(result.error, 'error');
                        pincodeData = {}; // Clear any existing data
                        return;
                    }
                    
                    pincodeData = result.data; // Replace existing data

                    if (result.processedRows === 0 && !result.error) {
                         showNotification('No valid data found in the CSV file.', 'info');
                    } else if (result.skippedRows > 0) {
                        showNotification(
                            `CSV processed: ${result.processedRows - result.skippedRows} valid entries. ${result.skippedRows} rows skipped.`,
                            'info'
                        );
                    } else {
                        showNotification('CSV data uploaded and processed successfully!', 'success');
                    }
                     // console.log("Pincode Data:", pincodeData); // For debugging
                } catch (error) {
                    showNotification('Error processing file: ' + error.message, 'error');
                    console.error("Error processing file:", error);
                    pincodeData = {}; // Clear data on error
                }
            };

            reader.onerror = function() {
                if (processingNotification) processingNotification.remove();
                showNotification('Error reading file.', 'error');
                csvFileNameSpan.textContent = 'No file selected';
                console.error("Error reading file:", reader.error);
                pincodeData = {}; // Clear data on error
            };
            reader.readAsText(file);
        } else {
            csvFileNameSpan.textContent = 'No file selected';
            showNotification('No file selected.', 'info');
        }
    }

    /**
     * Clears all markers from the map.
     */
    function clearMarkers() {
        if (markersLayer) {
            markersLayer.clearLayers();
        }
    }

    /**
     * Creates a Leaflet marker with a popup.
     * @param {Array|{lat: number, lng: number}} position - Latitude and longitude. Leaflet expects [lat, lng].
     * @param {string} title - Title for the marker (used as alt text).
     * @param {string} contentString - HTML content for the popup.
     * @returns {L.Marker} The Leaflet marker.
     */
    function createMarkerWithPopup(position, title, contentString) {
        // Leaflet expects [lat, lng]
        const latLng = Array.isArray(position) ? position : [position.lat, position.lng];
        const marker = L.marker(latLng, { title: title });
        marker.bindPopup(contentString);
        return marker;
    }

    /**
     * Plots a location on the map based on a pincode.
     */
    function plotPincode() {
        if (!map) {
            showNotification('Map is not initialized.', 'error');
            return;
        }
        clearMarkers();
        const pincodeInput = document.getElementById('pincodeInput');
        const pincode = pincodeInput.value.trim();

        if (!pincode) {
            showNotification('Pincode cannot be empty.', 'error');
            return;
        }

        if (pincodeData[pincode]) {
            const data = pincodeData[pincode]; // data here is pincodeDetails
            const lat = data.lat;
            const lon = data.lng; // Assuming 'lng' is used, Leaflet often uses 'lon'
            
            const storeListHtml = data.stores.length > 0 ?
                `<ul>${data.stores.map(s => `<li>${s}</li>`).join('')}</ul>` :
                'No stores listed for this pincode.';
            const popupContentString = `
                <div class="infowindow-content">
                    <p><strong>Pincode:</strong> ${pincode}</p>
                    <p><strong>Stores:</strong></p>
                    ${storeListHtml}
                </div>`;
            
            const marker = createMarkerWithPopup([lat, lon], `Pincode: ${pincode}`, popupContentString);
            marker.addTo(markersLayer);
            map.setView([lat, lon], 12); // Zoom level 12
            marker.openPopup();

            showNotification(`Pincode ${pincode} plotted. Stores: ${data.stores.join(', ')}`, 'success');
        } else {
            showNotification('Pincode not found in uploaded data.', 'error');
        }
    }

    /**
     * Searches for stores by name and plots their locations.
     */
    function searchStore() {
        if (!map) {
            showNotification('Map is not initialized.', 'error');
            return;
        }
        clearMarkers();
        const storeNameInput = document.getElementById('storeNameInput');
        const storeNameQuery = storeNameInput.value.trim().toLowerCase();
        
        if (!storeNameQuery) {
            showNotification('Store name cannot be empty.', 'error');
            return;
        }

        let foundStoresCount = 0;
        
        for (const pincode in pincodeData) {
            const entry = pincodeData[pincode]; // entry here is pincodeDetails
            const matchingStores = entry.stores.filter(store => store.toLowerCase().includes(storeNameQuery));

            if (matchingStores.length > 0) {
                foundStoresCount += matchingStores.length;
                const lat = entry.lat;
                const lon = entry.lng;

                const storeListHtml = `<ul>${matchingStores.map(s => `<li>${s}</li>`).join('')}</ul>`;
                const popupContentStringForEntry = `
                    <div class="infowindow-content">
                        <p><strong>Pincode:</strong> ${pincode}</p>
                        <p><strong>Matching Stores:</strong></p>
                        ${storeListHtml}
                    </div>`;
                
                const marker = createMarkerWithPopup(
                    [lat, lon], 
                    `Pincode: ${pincode}\nMatching Stores: ${matchingStores.join(', ')}`, 
                    popupContentStringForEntry
                );
                marker.addTo(markersLayer);
            }
        }

        if (markersLayer.getLayers().length > 0) {
            map.fitBounds(markersLayer.getBounds().pad(0.1)); // pad(0.1) adds some padding
            showNotification(`${foundStoresCount} store(s) found matching "${storeNameQuery}".`, 'success');
        } else {
            showNotification(`No stores found matching "${storeNameQuery}".`, 'error');
        }
    }

    // Expose functions to global scope for HTML event handlers
    window.handleFileUpload = handleFileUpload;
    window.plotPincode = plotPincode;
    window.searchStore = searchStore;

    // Initialize the map when the DOM is ready
    document.addEventListener('DOMContentLoaded', initializeLeafletMap);

    // Expose for testing purposes
    if (window.location.pathname.endsWith('tests.html')) { // Only expose for tests.html
        window.testableScript = {
            parsePincodeCSVData: parsePincodeCSVData,
            showNotification: showNotification, // Potentially useful for observing test side effects
            // Note: Leaflet specific functions like createMarkerWithPopup are not exposed here
            // as they depend on Leaflet's L object. Tests for them would need a mock/stub for L.
        };
    }
})();
