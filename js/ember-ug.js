/*
 * Licensed under  the  Apache  License, Version 2.0 (the "License") you may not
 * use this file except in compliance with the License. You may obtain a copy of 
 * the License at:
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless  required  by  applicable  law  or  agreed  to  in  writing,  software 
 * distributed  under  the  License  is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY  KIND,  either  express  or implied.  See the 
 * License for the specific language governing permissions and limitations under 
 * the License.
 */


var UG = Ember.Namespace.create({
  VERSION: '0.1'
});


UG.Config = Ember.Namespace.create({
  orgName: "",
  appName: "",
  url: "",

  setProperties: function( props ) {
    this.orgName = props.orgName;
    this.appName = props.appName;
    this.url = props.url;
  },

  getAppUrl : function() {
    return this.url + "/" + this.orgName + "/" + this.appName;
  }
});


//-----------------------------------------------------------------------------
// Adapter


UG.RESTAdapter = DS.RESTAdapter.extend({

  // Instead of overriding init(), hook in via the init event
  // http://reefpoints.dockyard.com/2014/04/28/dont-override-init.html
  construct: function() {

    if ( !UG.Config.url || !UG.Config.appName || !UG.Config.orgName ) {
      throw Error("UG.Config not configured");
    }
    // set base URL Of this RESTAdapter
    this.reopen({ host: UG.Config.getAppUrl() });

  }.on('init'),

  // Override to add Usegrid access token to all calls
  headers: function() {
    if ( UG.Config.accessToken ) {
      return { "Authorization": "Bearer " + UG.Config.accessToken };
    } 
    return {};
  }.property().volatile(), // ensure value not cached

  // Override because some Usergrid types require unconventional paths
  pathForType: function(type) {
    var ret = Ember.String.camelize(type);
    ret = "/" + Ember.String.pluralize(ret);

    if ( ret == "newActivities" ) {
      // Must have a special logic here for new activity because new Activities 
      // must be posted to the path /{org}/{app}/users/activities, instead of the
      // path /{org}/{app}/activities as Ember-Data expects.
      ret = "/users/" + UG.Config.user.username + "/activities";
    }
    return ret;
  }

});


//-----------------------------------------------------------------------------
// Serialization


UG.RESTSerializer = DS.RESTSerializer.extend({

  // Override to extract an Ember-Data array from a Usergrid response.
  extractArray: function(store, type, payload) {
    var newPayload = this.deserializeUsergridResponse(payload);
    return this._super(store, type, newPayload);
  },

  // Override to extract an Ember-Data array from a Usergrid response.
  extractSave: function(store, type, payload, id, requestType) {
    var newPayload = this.deserializeUsergridResponse(payload);
    return this._super( store, type, newPayload, id, requestType);
  },

  // Override to serialize Ember-Data object to Usergrid compatible JSON format
  serializeIntoHash: function( hash, type, record, options ) {

    // Get rid of what Ember-Data calls the "type key"
    record.eachAttribute(function( name, meta ) {
      hash[name] = record.get(name);
    });

    // bring in what Ember-Data calls "embedded records"
    record.eachRelationship(function( name, meta ) {
      hash[name] = record.get(name)._attributes;
    });

    return hash;
  },

  deserializeUsergridResponse: function (payload) {

    // Difference: Usergrid returns ID in "uuid" field, Ember-Data expects "id"
    // and embedded records also need an id, but it can be an arbitrary one

    // "id" field for each Entity, with its "uuid" value.
    for (var i in payload.entities) {
      if (payload.entities[i] && payload.entities[i].uuid) {
        payload.entities[i].id = payload.entities[i].uuid;

        // create id field for any embedded objects
        var entity = payload.entities[i];
        for ( var key in entity ) {
          if ( typeof entity[key] == "object") {
            entity[key].id = "dummy";
          }
        }
      }
    }

    // Difference: Usergrid does not return wrapper object with type-key
    // Ember-Data expects a JSON wrapper object around the results with a single
    // field that is also the type of the data being returned. Usergrid returns
    // a JSON objects with lots of fields, with an array field named "entities"
    // that contains the Usergrid Entities returned.

    // Grab the Usergrid Entities and stick them under a type-key
    var typeKey = payload.path.substring(1);
    var newPayload = {};
    newPayload[typeKey] = payload.entities;

    // TODO: would be nice to make other response data available some how
    // Include the other payload properties as a single "response" object in an array
    //payload.entities = null;
    //newPayload["responses"] = payload;

    return newPayload;
  }

});


//-----------------------------------------------------------------------------
// Authentication


UG.Auth = Ember.Namespace.create({
  accessToken: "",
  user: {},

  login: function( username, password, callback ) {

    var loginData = {
      grant_type: "password",
      username: username,
      password: password
    };

    $.ajax({
      type: "POST",
      url: UG.Config.getAppUrl() + "/token",
      data: loginData,
      error: function( data ) {
        callback.error( data.responseJSON.error_description );
      },
      success: function( data ) {
        UG.Auth.user = data.user;
        callback.success( {
          user: data.user,
          access_token: data.access_token });
      }
    });
  },

  logout: function() {
    UG.Auth.user = null;
    UG.Auth.token = null;
  },

  register: function ( username, email, password, callback) {

    var user = {
      username: username,
      email: email,
      password: password
    };

    $.ajax({
      context: this,
      type: "POST",
      url: UG.Config.getAppUrl() + "/users/",
      headers: {
        "Authorization": "Bearer " + accessToken
      },
      error: function( data ) {
        callback.error();
      },
      success: function( data ) {
        callback.success();
      }
    });

  },

  validateToken: function( token, username, callback ) {

    $.ajax({
      context: this,
      type: "GET",
      url: UG.Config.getAppUrl() + "/users/" + username,
      headers: {
        "Authorization": "Bearer " + token
      },
      error: function( data ) {
        callback.error();
      },
      success: function( data ) {
        UG.Auth.accessToken = token;
        callback.success();
      }
    });

  }

});

// Define models for each Usergrid Entity type needed for this app

UG.Entity = DS.Model.extend({
  name: DS.attr("string")
});

UG.User = UG.Entity.extend({
  username: DS.attr("string"),
  email: DS.attr("string"),
  password: DS.attr("string")
});

