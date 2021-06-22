'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var mixinRemoteMediaTrack = require('./remotemediatrack');
var VideoTrack = require('./videotrack');
var documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
var NullObserver = require('../../util/nullobserver.js').NullObserver;
var RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);
/**
 * A {@link RemoteVideoTrack} represents a {@link VideoTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @property {boolean} isEnabled - Whether the {@link RemoteVideoTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteVideoTrack}
 * @emits RemoteVideoTrack#dimensionsChanged
 * @emits RemoteVideoTrack#disabled
 * @emits RemoteVideoTrack#enabled
 * @emits RemoteVideoTrack#started
 * @emits RemoteVideoTrack#switchedOff
 * @emits RemoteVideoTrack#switchedOn
 */
var RemoteVideoTrack = /** @class */ (function (_super) {
    __extends(RemoteVideoTrack, _super);
    /**
     * Construct a {@link RemoteVideoTrack}.
     * @param {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
     * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
     * @param {boolean} isEnabled - whether the {@link RemoteVideoTrack} is enabled
     * @param {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
     * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
     *  {@link Track.Priority} of the {@link RemoteVideoTrack}
     * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
     * @param {{log: Log}} options - The {@link RemoteTrack} options
     */
    function RemoteVideoTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options) {
        var _this = this;
        options = Object.assign({
            clientTrackSwitchOffControl: 'auto',
            contentPreferencesMode: 'auto',
            enableDocumentVisibilityTurnOff: true,
        }, options);
        options = Object.assign({
            IntersectionObserver: typeof IntersectionObserver === 'undefined' || options.clientTrackSwitchOffControl !== 'auto' ? NullObserver : IntersectionObserver,
            ResizeObserver: typeof ResizeObserver === 'undefined' || options.contentPreferencesMode !== 'auto' ? NullObserver : ResizeObserver,
        }, options);
        _this = _super.call(this, sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options) || this;
        Object.defineProperties(_this, {
            _enableDocumentVisibilityTurnOff: {
                value: options.enableDocumentVisibilityTurnOff === true && options.clientTrackSwitchOffControl === 'auto',
            },
            _documentVisibilityTurnOffCleanup: {
                value: null,
                writable: true
            },
            _clientTrackSwitchOffControl: {
                value: options.clientTrackSwitchOffControl,
            },
            _contentPreferencesMode: {
                value: options.contentPreferencesMode,
            },
            _invisibleElements: {
                value: new WeakSet(),
            },
            _resizeObserver: {
                value: new options.ResizeObserver(function (entries) {
                    // NOTE(mpatwardhan): we ignore elements in _invisibleElements
                    // to ensure that ResizeObserver does not end-up turning off a track when a fresh Video element is
                    // attached and IntersectionObserver has not had its callback executed yet.
                    var visibleElementResized = entries.find(function (entry) { return !_this._invisibleElements.has(entry.target); });
                    if (visibleElementResized) {
                        maybeUpdateRenderHints(_this);
                    }
                })
            },
            _intersectionObserver: {
                value: new options.IntersectionObserver(function (entries) {
                    var shouldSetRenderHint = false;
                    entries.forEach(function (entry) {
                        var wasVisible = !_this._invisibleElements.has(entry.target);
                        if (wasVisible !== entry.isIntersecting) {
                            if (entry.isIntersecting) {
                                _this._log.debug('intersectionObserver detected: Off => On');
                                _this._invisibleElements.delete(entry.target);
                            }
                            else {
                                _this._log.debug('intersectionObserver detected: On => Off');
                                _this._invisibleElements.add(entry.target);
                            }
                            shouldSetRenderHint = true;
                        }
                    });
                    if (shouldSetRenderHint) {
                        maybeUpdateRenderHints(_this);
                    }
                }, { threshold: 0.25 })
            },
        });
        return _this;
    }
    /**
     * @private
     */
    RemoteVideoTrack.prototype._start = function (dummyEl) {
        var result = _super.prototype._start.call(this, dummyEl);
        // NOTE(mpatwardhan): after emitting started, update render hints only if clientTrackSwitchOffControl is 'auto'.
        if (this._clientTrackSwitchOffControl === 'auto') {
            maybeUpdateRenderHints(this);
        }
        return result;
    };
    /**
     * Request to switch on a {@link RemoteVideoTrack}, This method is applicable only for the group rooms and only when connected with
     * clientTrackSwitchOffControl in video bandwidth profile options set to 'manual'
     * @returns {this}
     */
    RemoteVideoTrack.prototype.switchOn = function () {
        if (this._clientTrackSwitchOffControl !== 'manual') {
            throw new Error('Invalid state. You can call switchOn only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
        }
        this._setRenderHint({ enabled: true });
        return this;
    };
    /**
     * Request to switch off a {@link RemoteVideoTrack}, This method is applicable only for the group rooms and only when connected with
     * clientTrackSwitchOffControl in video bandwidth profile options set to 'manual'
     * @returns {this}
     */
    RemoteVideoTrack.prototype.switchOff = function () {
        if (this._clientTrackSwitchOffControl !== 'manual') {
            throw new Error('Invalid state. You can call switchOff only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
        }
        this._setRenderHint({ enabled: false });
        return this;
    };
    /**
     * Set the {@link RemoteVideoTrack}'s content preferences. This method is applicable only for the group rooms and only when connected with
     * videoContentPreferencesMode in video bandwidth profile options set to 'manual'
     * @param {VideoContentPreferences} contentPreferences - requested preferences.
     * @returns {this}
     */
    RemoteVideoTrack.prototype.setContentPreferences = function (contentPreferences) {
        if (this._contentPreferencesMode !== 'manual') {
            throw new Error('Invalid state. You can call switchOn only when bandwidthProfile.video.contentPreferencesMode is set to "manual"');
        }
        if (contentPreferences.renderDimensions) {
            this._setRenderHint({ renderDimensions: contentPreferences.renderDimensions });
        }
        return this;
    };
    RemoteVideoTrack.prototype.attach = function (el) {
        var result = _super.prototype.attach.call(this, el);
        if (this._clientTrackSwitchOffControl === 'auto') {
            // start off the element as invisible. will mark it
            // visible once intersection observer calls back.
            this._invisibleElements.add(result);
            // NOTE(mpatwardhan): we do not call maybeUpdateRenderHints here,
            // because the dimensions are not known for freshly created
            // elements. we will get non-zero dimensions in _intersectionObserver
            // callback and then will call maybeUpdateRenderHints.
        }
        this._intersectionObserver.observe(result);
        this._resizeObserver.observe(result);
        if (this._enableDocumentVisibilityTurnOff) {
            this._documentVisibilityTurnOffCleanup = this._documentVisibilityTurnOffCleanup || setupDocumentVisibilityTurnOff(this);
        }
        return result;
    };
    RemoteVideoTrack.prototype.detach = function (el) {
        var _this = this;
        var result = _super.prototype.detach.call(this, el);
        var elements = Array.isArray(result) ? result : [result];
        elements.forEach(function (element) {
            _this._intersectionObserver.unobserve(element);
            _this._resizeObserver.unobserve(element);
            _this._invisibleElements.delete(element);
        });
        if (this._attachments.size === 0) {
            if (this._documentVisibilityTurnOffCleanup) {
                this._documentVisibilityTurnOffCleanup();
                this._documentVisibilityTurnOffCleanup = null;
            }
        }
        maybeUpdateRenderHints(this);
        return result;
    };
    /**
     * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
     * When a Participant un-publishes and re-publishes a VideoTrack, a new RemoteVideoTrack is created and
     * any VideoProcessors attached to the previous RemoteVideoTrack would have to be re-added again.
     * Only Chrome supports this as of now. Calling this API from a non-supported browser will result in a log warning.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrameBuffer, outputFrameBuffer) {
     *     const context = outputFrameBuffer.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
     *   }
     * }
     *
     * const grayscaleProcessor = new GrayScaleProcessor(100);
     *
     * Array.from(room.participants.values()).forEach(participant => {
     *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
     *   remoteVideoTrack.addProcessor(grayscaleProcessor);
     * });
     */
    RemoteVideoTrack.prototype.addProcessor = function () {
        return _super.prototype.addProcessor.apply(this, arguments);
    };
    /**
     * Remove the previously added {@link VideoProcessor} using `addProcessor` API.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to remove.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrameBuffer, outputFrameBuffer) {
     *     const context = outputFrameBuffer.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
     *   }
     * }
     *
     * const grayscaleProcessor = new GrayScaleProcessor(100);
     *
     * Array.from(room.participants.values()).forEach(participant => {
     *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
     *   remoteVideoTrack.addProcessor(grayscaleProcessor);
     * });
     *
     * document.getElementById('remove-button').onclick = () => {
     *   Array.from(room.participants.values()).forEach(participant => {
     *     const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
     *     remoteVideoTrack.removeProcessor(grayscaleProcessor);
     *   });
     * }
     */
    RemoteVideoTrack.prototype.removeProcessor = function () {
        return _super.prototype.removeProcessor.apply(this, arguments);
    };
    RemoteVideoTrack.prototype.toString = function () {
        return "[RemoteVideoTrack #" + this._instanceId + ": " + this.sid + "]";
    };
    /**
     * Update the subscribe {@link Track.Priority} of the {@link RemoteVideoTrack}.
     * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
     *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
     *   means the {@link Track.Priority} set by the publisher is now the effective priority.
     * @returns {this}
     * @throws {RangeError}
     */
    RemoteVideoTrack.prototype.setPriority = function (priority) {
        return _super.prototype.setPriority.call(this, priority);
    };
    return RemoteVideoTrack;
}(RemoteMediaVideoTrack));
function setupDocumentVisibilityTurnOff(removeVideoTrack) {
    function onVisibilityChanged() {
        maybeUpdateRenderHints(removeVideoTrack);
    }
    documentVisibilityMonitor.onVisibilityChange(1, onVisibilityChanged);
    return function () {
        documentVisibilityMonitor.offVisibilityChange(1, onVisibilityChanged);
    };
}
function maybeUpdateRenderHints(removeVideoTrack) {
    // maybeUpdateRenderHints is applicable only for "auto" modes.
    if (removeVideoTrack._clientTrackSwitchOffControl !== 'auto' && removeVideoTrack._contentPreferencesMode !== 'auto') {
        return;
    }
    var elements = removeVideoTrack._getAllAttachedElements();
    var updatedRenderHint = {};
    if (removeVideoTrack._clientTrackSwitchOffControl === 'auto') {
        // consider only visible elements.
        elements = elements.filter(function (el) { return !removeVideoTrack._invisibleElements.has(el); });
        updatedRenderHint.enabled = document.visibilityState === 'visible' && elements.length > 0;
    }
    if (removeVideoTrack._contentPreferencesMode === 'auto' && elements.length > 0) {
        var _a = __read(elements.sort(function (el1, el2) {
            return el2.clientHeight + el2.clientWidth - el1.clientHeight - el1.clientWidth - 1;
        }), 1), _b = _a[0], clientHeight = _b.clientHeight, clientWidth = _b.clientWidth;
        updatedRenderHint.renderDimensions = { height: clientHeight, width: clientWidth };
    }
    removeVideoTrack._log.debug('updating render hint:', updatedRenderHint);
    removeVideoTrack._setRenderHint(updatedRenderHint);
}
/**
 * @typedef {object} VideoContentPreferences
 * @property {VideoTrack.Dimensions} [renderDimensions] - Render Dimensions to request for the {@link RemoteVideoTrack}.
 */
/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */
/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */
/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "resumed".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */
/**
 * The {@link RemoteVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that started
 * @event RemoteVideoTrack#started
 */
/**
 * A {@link RemoteVideoTrack} was switched off.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched off
 * @event RemoteVideoTrack#switchedOff
 */
/**
 * A {@link RemoteVideoTrack} was switched on.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched on
 * @event RemoteVideoTrack#switchedOn
 */
module.exports = RemoteVideoTrack;
//# sourceMappingURL=remotevideotrack.js.map