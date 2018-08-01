const constants = require ('./constants');
const oauth2 = require ('simple-oauth2');

class Authentication
{
    constructor(app, opts)
    {
        this.app = app;
        if (opts && typeof opts === 'object')
        {
            this.redirectUri = opts.redirectUri;
        }
        this.oauth = oauth2.create({
            client: {
                id: app.clientId,
                secret: app.clientSecret
            },
            auth: {
                tokenHost: constants.AUTHENTICATION_URI,
                tokenPath: '/oauth2/token',
                revokePath: '/oauth2/revoke',
                authorizePath: '/oauth2/authorize'
            },
            options: {
                authorizationMethod: 'body'
            }
        });
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

    refreshToken(credentials)
    {
        return this.oauth.accessToken.create(credentials).refresh()
        .then((result) =>
        {
            this.app.emit('token-refresh', result.token, credentials);
            return result.token;
        });
    }
}

module.exports = Authentication;