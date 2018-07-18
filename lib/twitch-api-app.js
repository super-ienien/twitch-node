const oauth2 = require ('simple-oauth2');
const EventEmitter = require('events');

const TwitchApiError = require ('./twitch-api-error');
const TwitchApiResponse = require ('./twitch-api-response');

const TWITCH_ID_HOST = 'https://id.twitch.tv/';
const TWITCH_API_HOST = 'https://api.twitch.tv/';
const TWITCH_API_VERSION = 'helix';

const helpers = require('./helpers');

const request = require ('request');

class TwitchApiApp extends EventEmitter
{
    constructor (opts)
    {
        super();
        if (typeof opts.clientId === 'string' && typeof opts.clientSecret === 'string')
        {
            this.oauth = oauth2.create({
                client: {
                    id: opts.clientId,
                    secret: opts.clientSecret
                },
                auth: {
                    tokenHost: TWITCH_ID_HOST,
                    tokenPath: '/oauth2/token',
                    revokePath: '/oauth2/revoke',
                    authorizePath: '/oauth2/authorize'
                },
                options: {
                    authorizationMethod: 'body'
                }
            });
        }

        this.appToken = opts.appToken;
        this.redirectUri = opts.redirectUri;

        this.rateLimit = {
            limit: 120,
            remaining: 120,
            reset: -1
        };
    }

    rateLimitInterval (minimum = 0)
    {
        let current;
        if (this.rateLimit.reset > Date.now())
        {
            current = (this.rateLimit.reset - Date.now()) / this.rateLimit.remaining;
        }
        else
        {
            current = 500;
        }

        return current > minimum ? current:minimum;
    }

    createUser(token)
    {
        return new TwitchUser(this, token);
    }

    authenticate(scope)
    {
        if (!this.oauth) throw new Error ('You must provide clientID and clientSecret');

        return this.oauth.clientCredentials.getToken({
            scope,
        })
        .then((result) => {
            this.appToken = this.oauth.accessToken.create(result);
            return result;
        });
    }

    authenticateUser(opts)
    {
        if (!this.oauth) throw new Error('You must provide clientID and clientSecret');

        let scope = opts.scope || this.scope;
        const state = opts.state;
        const forceVerify = opts.forceVerify;
        const redirectUri = opts.redirectUri || this.redirectUri;

        if (Array.isArray(scope)) scope = scope.join(' ');

        // Authorization oauth2 URI
        const uri = this.oauth.authorizationCode.authorizeURL({
            redirect_uri: redirectUri,
            scope,
            state,
            force_verify: forceVerify
        });

        return {
            uri,
            getToken: (code, incomingState) =>
            {
                if (typeof state !== 'undefined' && incomingState !== state) throw new Error ('states does not match, possible CSRF attack');

                return this.oauth.authorizationCode.getToken({
                    code,
                    redirect_uri: redirectUri,
                    scope
                });
            }
        }
    }

    get (endpoint, params, requestOptions)
    {
        return this.send(endpoint, params, {...requestOptions, method: 'GET'});
    }

    post (endpoint, params, requestOptions)
    {
        return this.send(endpoint, params, {...requestOptions, method: 'POST'});
    }

    put (endpoint, params, requestOptions)
    {
        return this.send(endpoint, params, {...requestOptions, method: 'PUT'});
    }

    send (endpoint, params = {}, requestOptions)
    {
        const options = {
            uri: TWITCH_API_HOST + TWITCH_API_VERSION + '/' + endpoint,
            json: true,
            qs: Object.assign({}, params),
            ...requestOptions
        };

        const deferred = helpers.deferred();

        let credentials;
        if (params.credentials  && typeof params.credentials === 'object')
        {
            credentials = Object.assign({}, params.credentials);
            delete options.qs.credentials;
        }

        return this._send(options, credentials, deferred);
    }

    _send (requestOptions, credentials, deferred)
    {
        if (credentials)
        {
            requestOptions.auth = {
                bearer: credentials.access_token
            };
        }

        request(requestOptions, (error, response, json) => {
            if (error)
            {
                return deferred.reject(new TwitchApiError (this, requestOptions, credentials, null, error))
            }

            switch (response.statusCode)
            {
                case 401:
                    if (credentials && credentials.refresh_token && deferred.retryCount === 0) //response.headers['WWW-Authenticate'] && response.headers['WWW-Authenticate'].indexOf('invalid_token') > -1 &&
                    {
                        deferred.retryCount = 1;
                        this.refreshToken(credentials)
                        .then((result) => {
                            this._send(requestOptions, result, deferred);
                        })
                        .catch((error) => {
                            deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, error))
                        });
                    }
                    else deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, new Error (response.statusMessage)));
                    break;
                case 501:
                    deferred.retryCount++;
                    if (deferred.retryCount > 3)
                    {
                        deferred.reject(new TwitchApiError (this, requestOptions, credentials, null, new Error (response.statusMessage)));
                    }
                    else
                    {
                        this._send(requestOptions, credentials, deferred);
                    }
                    break;
                case 200:
                    deferred.resolve(new TwitchApiResponse (this, requestOptions, credentials, response, json));
                    break;
                default:
                    deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, new Error (response.statusMessage)));
            }
        });

        return deferred.promise;
    }

    refreshToken(credentials)
    {
        return this.oauth.accessToken.create(credentials).refresh()
        .then((result) =>
        {
            this.emit('token-refresh', result.token, credentials);
            return result.token;
        });
    }
}

module.exports = TwitchApiApp;