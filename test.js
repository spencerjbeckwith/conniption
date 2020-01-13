///Use this file to ensure that conniption.js is extensible and can be used as simply a "require"

cn = require("./conniption.js");
cn.launch();

let rm = cn.RoomManager;
rm.addRoom("lobby1");
rm.addRoom("lobby2","bitch!");
rm.addRoom("lobby3","");
rm.addRoom("yoted!");

