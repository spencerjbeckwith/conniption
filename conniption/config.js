const fs = require("fs");
var ConfigObject = {};
var WhiteList = "";
var BlackList = "";

/**
 * Loads configuration from a file.
 * @param {[String]} file The optional path to the file to load. Must be in JSON format. Defaults to config/config.json.
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
        if (ConfigObject.UseWhiteList) {
            ConfigObject.UseBlackList = false;
            loadWhiteList();
        } else {
            if (ConfigObject.UseBlackList) {
                loadBlackList();
            }
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

/**
 * Loads or reloads the server's WhiteList of IPs. Must be enabled in your configuration file.
 * @param {[String]} file The optional path to the file to load. Defaults to config/whitelist.txt.
 */
function loadWhiteList(file = "config/whitelist.txt") {
    if (ConfigObject.UseWhiteList) {
        try {
            WhiteList = fs.readFileSync(file,"utf8");
            console.log(`Loaded WhiteList.`);
        }
        catch (error) {
            console.error(error);
        }
    } else {
        console.warn(`Cannot load the WhiteList, as it is not enabled.`);
    }
}

/**
 * Loads or reloads the server's BlackList of IPs. Must be enabled in your configuration file.
 * @param {[String]} file The optional path to the file to load. Defaults to config/blacklist.txt.
 */
function loadBlackList(file = "config/blacklist.txt") {
    if (ConfigObject.UseBlackList) {
        try {
            BlackList = fs.readFileSync(file,"utf8");
            console.log(`Loaded BlackList.`);
        }
        catch (error) {
            console.error(error);
        }
    } else {
        console.warn(`Cannot load the BlackList, as it is not enabled.`);
    }
}

/**
 * Returns the WhiteList.
 * @returns {String} A full copy of the contents of the loaded WhiteList.
 */
function getWhiteList() {
    if (ConfigObject.UseWhiteList) {
        if (WhiteList === "") {
            loadWhiteList();
        }
        return WhiteList;
    } else {
        console.warn(`Cannot get the WhiteList, as it is not enabled.`);
        return "";
    }
}

/**
 * Returns the BlackList.
 * @returns {String} A full copy of the contents of the loaded BlackList.
 */
function getBlackList() {
    if (ConfigObject.UseBlackList) {
        if (BlackList === "") {
            loadBlackList();
        }
        return BlackList;
    } else {
        console.warn(`Cannot get the BlackList, as it is not enabled.`);
        return "";
    }
}

/**
 * Adds new content to the WhiteList. The WhiteList doesn't need to be enabled for this.
 * @param {String} str The new content to add. Must, at least, include an IP address.
 * @param {[String]} file The optional path to the file to add to. Defaults to config/whitelist.txt.
 */
function addToWhiteList(str,file = "config/whitelist.txt") {
    fs.writeFile(file,str+"\n",{flag:"a"},(error) => {
        if (error) {console.log(error); return;}
        console.log(`Added "${str}" to the WhiteList.`);
    });
    loadWhiteList();
}

/**
 * Adds new content to the BlackList. The BlackList doesn't need to be enabled for this.
 * @param {String} str The new content to add. Must, at least, include an IP address.
 * @param {[String]} file The optional path to the file to add to. Defaults to config/blacklist.txt.
 */
function addToBlackList(str,file = "config/blacklist.txt") {
    fs.writeFile(file,str+"\n",{flag:"a"},(error) => {
        if (error) {console.log(error); return;}
        console.log(`Added "${str}" to the BlackList.`);
    });
    loadBlackList();
}

/**
 * Returns if the given string should be allowed to connect to the server.
 * @param {String} str The content to check for. Should be an IP address.
 * @returns {Boolean} If the IP was either found on the WhiteList, or not found on the BlackList.
 */
function checkAllowed(str) {
    if (ConfigObject.UseWhiteList) {
        if (!WhiteList.includes(str)) {
            console.log(`Non-WhiteListed connection from IP ${str}.`);
            return false;
        }
    } else {
        if (ConfigObject.UseBlackList) {
            if (BlackList.includes(str)) {
                console.log(`BlackListed connection from IP ${str}.`)
                return false;
            }
        }
    }
    return true;
}

module.exports = {
    load: load,
    get: get,
    loadWhiteList: loadWhiteList,
    loadBlackList: loadBlackList,
    getWhiteList: getWhiteList,
    getBlackList: getBlackList,
    addToWhiteList: addToWhiteList,
    addToBlackList: addToBlackList,
    checkAllowed: checkAllowed
}