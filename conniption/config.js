const fs = require("fs");
let ConfigObject = {};

/**
 * Loads configuration from a file.
 * @param {[String]} file The path to the file to load. Must be in JSON format.
 * @param {[Function]} callbackFn A callback function to invoke after the config has been loaded.
 */
function load(file = "config/config.json",callbackFn = function(){}) {
    console.log(`Loading configuration from ${file}...`);
    fs.readFile(file,"utf8",(error,data) => {
        try {
            if (error) {
                throw error;
            }
            try {
                ConfigObject = JSON.parse(data);
            }
            catch (jsonError) {
                throw `Error reading JSON from ${file}: ${jsonError}`;
            }
        }
        catch (error) {
            console.error(`Could not load configuration: ${error}`);
        }
        console.log("Config loaded successfully.");
        callbackFn();
    });
}

/**
 * Returns the value from the loaded Configuration object.
 */
function get() {
    return ConfigObject;
}

module.exports = {
    load: load,
    get: get
}