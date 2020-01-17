
const Config = require("./config.js");

/**
 * Returns if the name supplied passes all checks placed on the use of usernames.
 * @param {String} name The name to test.
 * @returns {Boolean} Whether or not the name passes the test.
 */
function nameIsValid(name) {
    if (typeof name !== "string") {
        return false; //not a string
    }
    if (name.length < Config.get().Users.Name.MinLength || name.length > Config.get().Users.Name.MaxLength) {
        return false; //too long
    }
    let disallowedCharacters = Config.get().Users.Name.DisallowedCharacters;
    for (let i = 0; i < name.length; i++) {
        for (let d = 0; d < disallowedCharacters.length; d++) {
            if (name.charAt(i) === disallowedCharacters.charAt(d)) {
                return false;
            }
        }
    }
    return true;
}

module.exports = {
    nameIsValid: nameIsValid
}