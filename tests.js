/**
 * Basic assertion function for testing.
 * @param {*} actual - The actual value.
 * @param {*} expected - The expected value.
 * @param {string} testName - The name of the test.
 */
function assertEqual(actual, expected, testName) {
    const resultsDiv = document.getElementById('testResults');
    // Using JSON.stringify for deep comparison of simple objects/arrays.
    // For more complex scenarios, a dedicated deep comparison library might be needed.
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`PASS: ${testName}`);
        if (resultsDiv) resultsDiv.innerHTML += `<p style="color: green;">PASS: ${testName}</p>`;
    } else {
        console.error(`FAIL: ${testName} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
        if (resultsDiv) resultsDiv.innerHTML += `<p style="color: red;">FAIL: ${testName} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}</p>`;
    }
}

/**
 * Test suite for the parsePincodeCSVData function.
 */
function testParsePincodeCSVData() {
    const parseFunction = window.testableScript ? window.testableScript.parsePincodeCSVData : null;

    if (!parseFunction) {
        const resultsDiv = document.getElementById('testResults');
        console.error("FAIL: Critical - parsePincodeCSVData function not found for testing.");
        if(resultsDiv) resultsDiv.innerHTML += `<p style="color: red;">FAIL: Critical - parsePincodeCSVData function not found. Ensure script.js is loaded and the function is exposed via window.testableScript.</p>`;
        return;
    }

    // Test 1: Valid CSV Data
    let input1 = "Store A,12345,10.0,20.0\nStore B,67890,12.5,22.5\nStore C,12345,10.0,20.0"; // Store C in same pincode
    let expected1 = {
        data: {
            "12345": { lat: 10.0, lng: 20.0, stores: ["Store A", "Store C"] },
            "67890": { lat: 12.5, lng: 22.5, stores: ["Store B"] }
        },
        skippedRows: 0,
        processedRows: 3
    };
    let result1 = parseFunction(input1);
    assertEqual(result1, expected1, "Test 1: Valid CSV Data");

    // Test 2: Row with incorrect number of fields
    let input2 = "Store A,12345,10.0,20.0\nStore B,67890,12.5"; // Missing longitude
    let expected2 = {
        data: {
            "12345": { lat: 10.0, lng: 20.0, stores: ["Store A"] }
        },
        skippedRows: 1,
        processedRows: 2
    };
    let result2 = parseFunction(input2);
    assertEqual(result2, expected2, "Test 2: Row with incorrect number of fields");

    // Test 3: Row with non-numeric latitude/longitude
    let input3 = "Store A,12345,TEN,20.0\nStore B,67890,12.5,22.5";
    let expected3 = {
        data: {
            "67890": { lat: 12.5, lng: 22.5, stores: ["Store B"] }
        },
        skippedRows: 1,
        processedRows: 2
    };
    let result3 = parseFunction(input3);
    assertEqual(result3, expected3, "Test 3: Row with non-numeric latitude/longitude");

    // Test 4: Empty input string
    let input4 = "";
    let expected4 = {
        data: {},
        skippedRows: 0,
        processedRows: 0,
        error: "CSV file is empty or contains no data."
    };
    let result4 = parseFunction(input4);
    assertEqual(result4, expected4, "Test 4: Empty input string");
    
    // Test 4b: Input string with only whitespace
    let input4b = "   \n   \n ";
    let expected4b = { // Behavior for whitespace lines: they are effectively ignored, result in 0 processed.
        data: {},
        skippedRows: 0, // Current implementation skips blank lines silently before processing
        processedRows: 0,
        error: "CSV file is empty or contains no data." // As all lines are effectively empty
    };
    let result4b = parseFunction(input4b);
    assertEqual(result4b, expected4b, "Test 4b: Input string with only whitespace");


    // Test 5: Input with only invalid lines
    let input5 = "Store A,12345,TEN,20.0\nStore B,67890,12.5";
    let expected5 = {
        data: {},
        skippedRows: 2,
        processedRows: 2
    };
    let result5 = parseFunction(input5);
    assertEqual(result5, expected5, "Test 5: Input with only invalid lines");

    // Test 6: Input with missing store name
    let input6 = ",12345,10.0,20.0\nStore B,67890,12.5,22.5";
    let expected6 = {
        data: {
            "67890": { lat: 12.5, lng: 22.5, stores: ["Store B"] }
        },
        skippedRows: 1,
        processedRows: 2
    };
    let result6 = parseFunction(input6);
    assertEqual(result6, expected6, "Test 6: Row with missing store name");

    // Test 7: Input with missing pincode
    let input7 = "Store A,,10.0,20.0\nStore B,67890,12.5,22.5";
    let expected7 = {
        data: {
            "67890": { lat: 12.5, lng: 22.5, stores: ["Store B"] }
        },
        skippedRows: 1,
        processedRows: 2
    };
    let result7 = parseFunction(input7);
    assertEqual(result7, expected7, "Test 7: Row with missing pincode");
    
    // Test 8: CSV with trailing newline
    let input8 = "Store A,12345,10.0,20.0\nStore B,67890,12.5,22.5\n";
    let expected8 = {
        data: {
            "12345": { lat: 10.0, lng: 20.0, stores: ["Store A"] },
            "67890": { lat: 12.5, lng: 22.5, stores: ["Store B"] }
        },
        skippedRows: 0,
        processedRows: 2 // Trailing newline is handled gracefully
    };
    let result8 = parseFunction(input8);
    assertEqual(result8, expected8, "Test 8: CSV with trailing newline");

    // Test 9: Pincode with different lat/lng in subsequent rows (last one wins)
    let input9 = "Store A,12345,10.0,20.0\nStore B,12345,10.1,20.1";
    let expected9 = {
        data: {
            "12345": { lat: 10.1, lng: 20.1, stores: ["Store A", "Store B"] }
        },
        skippedRows: 0,
        processedRows: 2
    };
    let result9 = parseFunction(input9);
    assertEqual(result9, expected9, "Test 9: Pincode with different lat/lng (last wins)");

}


/**
 * Main test runner function.
 * Calls all individual test suites.
 */
function runAllTests() {
    const resultsDiv = document.getElementById('testResults');
    resultsDiv.innerHTML += '<h3>Running parsePincodeCSVData Tests:</h3>';
    testParsePincodeCSVData();
    // Add calls to other test suites here if any
    resultsDiv.innerHTML += '<p><strong>All tests completed.</strong></p>';
}
