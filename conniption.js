const fs = require("fs");
const WebSocket = require("ws");

let Config = {};
let PacketCallbacks = {};

/**
 * Loads configuration from a file.
 * @param {[String]} file The path to the file to load. Must be in JSON format.
 * @param {[Function]} callbackFn A callback function to invoke after the config has been loaded.
 */
function loadConfig(file = "config/config.json",callbackFn = function(){}) {
    console.log(`Loading configuration from ${file}...`);
    fs.readFile(file,"utf8",(error,data) => {
        try {
            if (error) {
                throw error;
            }
            try {
                Config = JSON.parse(data);
                console.log("Config loaded successfully.");
                callbackFn();
            }
            catch (jsonError) {
                throw `Error reading JSON from ${file}: ${jsonError}`;
            }
        }
        catch (error) {
            console.error(`Could not load configuration: ${error}`);
        }
    });
}

/**
 * Returns a value from the configuration file.
 * @param {String} name The name of the value to read from the loaded configuration.
 */
function getConfig(name) {
    return Config[name];
}

/**
 * Adds a new handling function when the server receives a packet of a certain type.
 * @param {String} name The label of received packets that should react this way.
 * @param {Function} callbackFn A callback function to invoke when this type of packet is received.
 */
function addPacketType(name,callbackFn) {
    PacketCallbacks[name] = PacketCallbacks[name] || [];
    PacketCallbacks[name].push(callbackFn);
}

/**
 * Internal function that opens the server.
 */
function launchServer() {
    console.log(`Opening server on port ${Config.Port}...`);

    const wss = new WebSocket.Server({
        port: Config.Port
    });

    wss.on("listening",() => {
        console.log("Server listening successfully.");
    });

    wss.on("error",(error) => {
        console.error(`A server error has occured: ${error}`);
    });

    wss.on("connection",(ws) => {
        //Handle stuff here.
    });
}

/**
 * Invoke to launch a Conniption server.
 * @param {[String]} file The optional configuration file to use.
 */
function launch(file = "config/config.json") {
    loadConfig(file,launchServer);
}

module.exports = {
    loadConfig: loadConfig,
    getConfig: getConfig,
    addPacketType: addPacketType,
    launch: launch
}