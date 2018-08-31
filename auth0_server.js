Auth0 = {};

Auth0.handleAuthFromAccessToken = function handleAuthFromAccessToken(accessToken, expiresAt) {
  var whitelisted = ['email', 'name', 'given_name', 'family_name',
    'picture', 'preferred_username'];

  var identity = getIdentity(accessToken);

  var serviceData = {
    accessToken: accessToken,
    expiresAt: expiresAt,
    id: identity.sub
  };

  var fields = _.pick(identity, whitelisted);
  _.extend(serviceData, fields);
  return {
    serviceData: serviceData,
    options: {profile: {name: identity.name}}
  };
};

OAuth.registerService('auth0', 2, null, function(query) {
  var response = getTokenResponse(query);
  var accessToken = response.accessToken;
  var expiresIn = response.expiresIn;

  return Auth0.handleAuthFromAccessToken(accessToken, (+new Date) + (1000 * expiresIn));
});

// checks whether a string parses as JSON
var isJSON = function (str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// returns an object containing:
// - accessToken
// - expiresIn: lifetime of token in seconds
var getTokenResponse = function (query) {
  var config = ServiceConfiguration.configurations.findOne({service: 'auth0'});
  if (!config)
    throw new ServiceConfiguration.ConfigError();

  var responseContent;
  try {
    // Request an access token
    responseContent = HTTP.post(
      `https://${config.domain}/oauth/token`, {
        params: {
          client_id: config.clientId,
          redirect_uri: OAuth._redirectUri('auth0', config),
          client_secret: OAuth.openSecret(config.secret),
          code: query.code,
          grant_type: 'authorization_code'
        }
      }).data;
  } catch (err) {
    throw _.extend(new Error("Failed to complete OAuth handshake with Auth0. " + err.message),
                   {response: err.response});
  }

  if (!responseContent.access_token) {
    throw new Error("Failed to complete OAuth handshake with auth0 " +
                    "-- can't find access token in HTTP response. " + responseContent);
  }
  return {
    accessToken: responseContent.access_token,
    expiresIn: responseContent.expires_in
  };
};

var getIdentity = function (accessToken) {
  var config = ServiceConfiguration.configurations.findOne({service: 'auth0'});
  if (!config)
    throw new ServiceConfiguration.ConfigError();

  try {
    return HTTP.get(`https://${config.domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }).data;
  } catch (err) {
    throw _.extend(new Error("Failed to fetch identity from Auth0. " + err.message),
                   {response: err.response});
  }
};

Auth0.retrieveCredential = function(credentialToken, credentialSecret) {
  return OAuth.retrieveCredential(credentialToken, credentialSecret);
};
