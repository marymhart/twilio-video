'use strict';

var Endpoint = require('../lib/endpoint');
var getUserMedia = require('../lib/webrtc/getusermedia');
var LocalMedia = require('../lib/media').LocalMedia;

function Twilio() {
  Object.defineProperties(this, {
    Endpoint: {
      enumerable: true,
      value: Endpoint
    },
    getUserMedia: {
      enumerable: true,
      value: getUserMedia
    },
    LocalMedia: {
      enumerable: true,
      value: LocalMedia
    }
  });
  return this;
}

var twilio = global.Twilio = global.Twilio || new Twilio();
if (!twilio.Endpoint) {
  Twilio.call(global.Twilio);
}
