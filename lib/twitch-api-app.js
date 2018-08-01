const EventEmitter = require('events');

const Kraken = require ('./kraken');
const Helix = require ('./helix');
const Authentication = require ('./authentication');
const constants = require ('./constants');

const helpers = require('./helpers');

class TwitchApiApp extends EventEmitter
{
    constructor (opts)
    {
        if (!opts || typeof opts !== 'object') throw new Error ('You must provide options');
        super();
        if (typeof opts.clientId === 'string' && typeof opts.clientSecret === 'string')
        {
            this.clientId = opts.clientId;
            this.clientSecret = opts.clientSecret;
            this.auth = new Authentication(this, opts.auth);
        }

        this.appToken = opts.appToken;

        this.kraken = new Kraken(this);
        this.helix = new Helix(this);
    }
}

module.exports = TwitchApiApp;