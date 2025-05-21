(function() {
    'use strict';

    // Application scope variables
    let map;
    let markers = [];
    let pincodeData = {}; // Stores processed data from CSV

    /**
     * Initializes the Google Map.
     * This function is globally exposed via window.initMap for the Google Maps API callback.
     */
    function initMap() {
        map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 20.5937, lng: 78.9629 }, // Default center for India
            zoom: 5
        });
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
     * Clears all markers from the map and the internal markers array.
     */
    function clearMarkers() {
        markers.forEach(marker => marker.setMap(null));
        markers = [];
    }
    
    /**
     * Creates and adds a single marker to the map with an InfoWindow.
     * @param {{lat: number, lng: number}} position - The latitude and longitude for the marker.
     * @param {string} title - The title for the marker (tooltip).
     * @param {string} contentString - HTML content for the InfoWindow.
     */
    function createMarkerWithInfoWindow(position, title, contentString) {
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: title
        });

        const infoWindow = new google.maps.InfoWindow({
            content: contentString
        });

        marker.addListener('click', () => {
            // Close other open info windows
            markers.forEach(m => {
                if (m.infoWindow) m.infoWindow.close();
            });
            infoWindow.open(map, marker);
            marker.infoWindow = infoWindow; // Store reference to close it later
        });
        return marker;
    }


    /**
     * Plots a location on the map based on a pincode.
     */
    function plotPincode() {
        clearMarkers();
        const pincodeInput = document.getElementById('pincodeInput');
        const pincode = pincodeInput.value.trim();

        if (!pincode) {
            showNotification('Pincode cannot be empty.', 'error');
            return;
        }

        if (pincodeData[pincode]) {
            const data = pincodeData[pincode];
            const position = { lat: data.lat, lng: data.lng };
            
            map.setCenter(position);
            map.setZoom(12);

            const storeListHtml = data.stores.length > 0 ?
                `<ul>${data.stores.map(s => `<li>${s}</li>`).join('')}</ul>` :
                'No stores listed for this pincode.';
            const contentString = `
                <div class="infowindow-content">
                    <p><strong>Pincode:</strong> ${pincode}</p>
                    <p><strong>Stores:</strong></p>
                    ${storeListHtml}
                </div>`;
            
            const marker = createMarkerWithInfoWindow(position, `Pincode: ${pincode}`, contentString);
            markers.push(marker);

            showNotification(`Pincode ${pincode} plotted. Stores: ${data.stores.join(', ')}`, 'success');
        } else {
            showNotification('Pincode not found in uploaded data.', 'error');
        }
    }

    /**
     * Searches for stores by name and plots their locations.
     */
    function searchStore() {
        clearMarkers();
        const storeNameInput = document.getElementById('storeNameInput');
        const storeNameQuery = storeNameInput.value.trim().toLowerCase();
        
        if (!storeNameQuery) {
            showNotification('Store name cannot be empty.', 'error');
            return;
        }

        let foundStoresCount = 0;
        const bounds = new google.maps.LatLngBounds();

        for (const pincode in pincodeData) {
            const data = pincodeData[pincode];
            const matchingStores = data.stores.filter(store => store.toLowerCase().includes(storeNameQuery));

            if (matchingStores.length > 0) {
                foundStoresCount += matchingStores.length;
                const position = { lat: data.lat, lng: data.lng };

                const storeListHtml = `<ul>${matchingStores.map(s => `<li>${s}</li>`).join('')}</ul>`;
                const contentString = `
                    <div class="infowindow-content">
                        <p><strong>Pincode:</strong> ${pincode}</p>
                        <p><strong>Matching Stores:</strong></p>
                        ${storeListHtml}
                    </div>`;
                
                const marker = createMarkerWithInfoWindow(
                    position, 
                    `Pincode: ${pincode}\nMatching Stores: ${matchingStores.join(', ')}`, 
                    contentString
                );
                markers.push(marker);
                bounds.extend(position);
            }
        }

        if (foundStoresCount > 0) {
            map.fitBounds(bounds);
            if (markers.length === 1) { // If only one location, zoom in more
                map.setCenter(markers[0].getPosition());
                map.setZoom(12);
            }
            showNotification(`${foundStoresCount} store(s) found matching "${storeNameQuery}".`, 'success');
        } else {
            showNotification(`No stores found matching "${storeNameQuery}".`, 'error');
        }
    }

    // Expose functions to global scope for HTML event handlers and Maps API callback
    window.initMap = initMap;
    window.handleFileUpload = handleFileUpload;
    window.plotPincode = plotPincode;
    window.searchStore = searchStore;
    // Expose for testing purposes
    if (window.location.pathname.endsWith('tests.html')) { // Only expose for tests.html
        window.testableScript = {
            parsePincodeCSVData: parsePincodeCSVData,
            showNotification: showNotification // Potentially useful for observing test side effects
        };
    }
})();
